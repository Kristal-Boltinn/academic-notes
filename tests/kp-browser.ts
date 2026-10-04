import { createParagraphLayoutController, hasParagraphSelection, layoutParagraphs, restoreParagraphs } from '../src/typography/dom';
import { renderMath, finishRenderMath } from 'obsidian';

const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 180));
const english = 'A paragraph is a sequence of related ideas. Mathematical writing benefits from a careful choice of line breaks, because the paragraph can be considered as a whole. Local choices sometimes create awkward gaps, while a global search can balance the spacing across several lines. ';
const chinese = '数学笔记需要清楚的段落排版。对于“整体最优”的断行，我们同时考虑每行的字距，而不是只在当前行放入尽可能多的文字。（括号中的论述）与标点符号也应保留正确的位置。';
const nodesEqual = (p: HTMLElement, original: Node[]) => p.childNodes.length === original.length && original.every((node, index) => p.childNodes[index] === node);
function paragraph(host: HTMLElement, text: string, width = 420) {
    const p = document.createElement('p'); p.textContent = text;
    p.style.cssText = `width:${width}px;font:18px/1.65 'Times New Roman','Microsoft YaHei',serif;direction:ltr;writing-mode:horizontal-tb;text-indent:0;white-space:normal;text-align:left;margin:12px 0;padding:0;border:0`;
    host.appendChild(p); return p;
}
function linesFit(p: HTMLElement) { return [...p.querySelectorAll<HTMLElement>('.an-kp-line')].every(line => line.scrollWidth <= p.clientWidth + 2); }

export async function runKpBrowserRegressions() {
    const host = document.createElement('main'); host.className = 'markdown-rendered'; host.style.cssText = 'width:920px;max-width:none'; document.body.appendChild(host);
    const geometry = document.createElement('style'); geometry.textContent = '.an-kp-line{display:inline-block;width:100%;box-sizing:border-box;vertical-align:top;white-space:nowrap;text-align:start;font:inherit;margin:0;padding:0;border:0}.an-kp-space{display:inline-block;white-space:pre;font-size:0;height:0;line-height:0;margin:0;padding:0;border:0}.an-kp-measure{white-space:nowrap!important}'; host.appendChild(geometry);
    document.getSelection()?.removeAllRanges();
    await document.fonts.ready;
    let markup = '';
    try {
        const prose = paragraph(host, english.repeat(2));
        const original = [...prose.childNodes], text = prose.textContent, proseBefore = prose.outerHTML;
        const report = layoutParagraphs(prose);
        check(report.processed === 1 && prose.querySelectorAll('.an-kp-line').length > 2, 'Latin prose should use globally selected line breaks');
        check(prose.textContent === text && linesFit(prose), 'Latin layout must preserve exact text and fit its measured content width');
        const copied = document.createRange(); copied.selectNodeContents(prose); document.getSelection()!.addRange(copied);
        check(document.getSelection()!.toString() === text, 'Generated visual line boundaries must not add clipboard newlines or remove source spaces'); document.getSelection()!.removeAllRanges();
        restoreParagraphs(prose); check(nodesEqual(prose, original) && prose.outerHTML === proseBefore, 'Disabling paragraph layout must restore exact original text nodes and class-attribute absence');

        const cjk = paragraph(host, chinese.repeat(3), 370);
        const cjkText = cjk.textContent;
        check(layoutParagraphs(cjk).processed === 1 && linesFit(cjk), 'CJK grapheme gaps must produce a fitting optimized paragraph');
        for (const line of cjk.querySelectorAll('.an-kp-line')) {
            const value = line.textContent?.trim() || '';
            check(!/^[）］｝〉》」』】、。，！？：；’”]/u.test(value), 'A CJK line must not begin with closing punctuation');
            check(!/[（［｛〈《「『【‘“]$/u.test(value), 'A CJK line must not end with opening punctuation');
        }
        check(cjk.textContent === cjkText, 'CJK layout must preserve all original punctuation and text');

        const inline = paragraph(host, english, 450);
        const link = document.createElement('a'); link.href = '#kp-test-target'; link.dataset.href = 'chapter#^theorem'; link.textContent = 'a theorem';
        let clicks = 0; link.addEventListener('click', event => { event.preventDefault(); clicks++; });
        const bold = document.createElement('strong'); bold.textContent = 'important details';
        const formula = renderMath('\\frac{a+b}{c}', false);
        inline.append('This argument refers to ', link, ' and preserves ', bold, ', with ', formula, '. ', english);
        await finishRenderMath();
        const inlineNodes = [...inline.childNodes], inlineText = inline.textContent;
        const svg = formula.querySelector('svg'), glyph = formula.querySelector('[id]'), glyphId = glyph?.id;
        check(layoutParagraphs(inline).processed === 1 && linesFit(inline), 'Inline formatting and rendered mathematics must fit in optimized prose');
        check(inline.querySelector('a') === link && inline.querySelector('strong') === bold && formula.querySelector('svg') === svg && glyph?.id === glyphId, 'Original link, formatting and math glyph nodes must retain identity');
        link.click(); check(clicks === 1 && link.dataset.href === 'chapter#^theorem' && inline.textContent === inlineText, 'Original link listener, metadata and full text must survive layout');
        restoreParagraphs(inline); check(nodesEqual(inline, inlineNodes), 'Inline elements and text nodes must restore in exact source order');
        const updated = paragraph(host, english.repeat(2), 350);
        check(layoutParagraphs(updated).processed === 1, 'Host-update fixture must be optimized');
        updated.querySelector('.an-kp-line')!.append(' Updated by the host.');
        const updatedText = updated.textContent; restoreParagraphs(updated);
        check(updated.textContent === updatedText && !updated.querySelector('.an-kp-line,.an-kp-space'), 'Restoration must preserve host-updated text and remove its owned presentation spans');

        const unicode = paragraph(host, 'A\u00a0B\u2060C e\u0301 👩‍🔬 🇨🇳 ' + english.repeat(2), 370);
        const unicodeText = unicode.textContent;
        check(layoutParagraphs(unicode).processed === 1 && unicode.textContent === unicodeText, 'Nonbreaking joins, combining marks and emoji must retain their original text');
        check([...unicode.querySelectorAll('.an-kp-line')].some(line => line.textContent?.includes('A\u00a0B\u2060C')), 'Nonbreaking joins must remain on the same line');
        check([...unicode.querySelectorAll('.an-kp-line')].some(line => line.textContent?.includes('e\u0301 👩‍🔬 🇨🇳')), 'Combining and emoji sequences must remain intact');

        const short = paragraph(host, 'A short paragraph.', 450); const shortNodes = [...short.childNodes];
        check(layoutParagraphs(short).processed === 0 && nodesEqual(short, shortNodes), 'One-line paragraphs should retain native DOM');
        const long = paragraph(host, 'W'.repeat(180), 300); const longNodes = [...long.childNodes], beforeLong = long.outerHTML;
        check(layoutParagraphs(long).fallback === 1 && nodesEqual(long, longNodes) && long.outerHTML === beforeLong, 'An oversized unsplittable token must fall back without altering the source paragraph');
        const huge = paragraph(host, chinese.repeat(100), 300); const hugeBefore = huge.outerHTML;
        check(layoutParagraphs(huge).skipped === 1 && huge.outerHTML === hugeBefore, 'Large paragraphs must stay native under bounded-work limits');

        const editor = document.createElement('div'); editor.className = 'cm-editor'; editor.contentEditable = 'true'; host.appendChild(editor);
        const editable = paragraph(editor, english.repeat(2), 320), editorBefore = editor.outerHTML;
        check(layoutParagraphs(editor).processed === 0 && editor.outerHTML === editorBefore, 'CodeMirror/editable DOM must never be rewritten');
        const noEditorLayout = createParagraphLayoutController(editor, { enabled: true }); await settle();
        check(editor.outerHTML === editorBefore && editable.firstChild?.nodeType === Node.TEXT_NODE, 'A controller must remain inert inside an editor'); noEditorLayout.dispose();
        const proof = document.createElement('div'); proof.className = 'callout'; proof.dataset.callout = 'proof'; host.appendChild(proof);
        const proofP = paragraph(proof, english.repeat(2), 350), proofBefore = proofP.outerHTML;
        check(layoutParagraphs(proof).processed === 1 && linesFit(proofP), 'Proof prose must participate in KP layout');
        restoreParagraphs(proof); check(proofP.outerHTML === proofBefore, 'Proof prose must restore exactly');
        const indented = paragraph(host, english.repeat(2), 350); indented.style.textIndent = '2em'; const indentBefore = indented.outerHTML;
        check(layoutParagraphs(indented).processed === 1, 'Positive first-line indentation must participate in KP');
        const indentRows = [...indented.querySelectorAll<HTMLElement>(':scope > .an-kp-line')];
        check(Math.abs(indentRows[0].getBoundingClientRect().left - indented.getBoundingClientRect().left - 36) < 2 && Math.abs(indentRows[1].getBoundingClientRect().left - indented.getBoundingClientRect().left) < 2, 'Only the first line must indent by exactly two em');
        restoreParagraphs(indented); check(indented.outerHTML === indentBefore, 'Indentation layout must restore the original style and nodes');
        const hardBreak = paragraph(host, english, 350); hardBreak.appendChild(document.createElement('br')); hardBreak.append(english); const breakBefore = hardBreak.outerHTML;
        check(layoutParagraphs(hardBreak).processed === 0 && hardBreak.outerHTML === breakBefore, 'Author-specified line breaks must not be rewritten');

        const responsive = document.createElement('section'); responsive.style.width = '430px'; host.appendChild(responsive);
        const dynamic = paragraph(responsive, english.repeat(3)); dynamic.style.width = '100%';
        const dynamicNodes = [...dynamic.childNodes]; let enabled = false;
        const disabledBefore = dynamic.outerHTML;
        const controller = createParagraphLayoutController(responsive, { enabled: () => enabled, onError: error => { throw error; } });
        try {
            await settle(); check(dynamic.outerHTML === disabledBefore, 'An initially disabled controller must not write any DOM');
            enabled = true; controller.refresh(); await settle();
            check(dynamic.querySelectorAll('.an-kp-line').length > 2 && linesFit(dynamic), 'Enabling a controller must lay out loaded reading prose');
            const firstLines = [...dynamic.children], firstCount = firstLines.length;
            const selection = document.getSelection()!, range = document.createRange(); range.selectNodeContents(firstLines[0]); selection.addRange(range);
            check(hasParagraphSelection(responsive), 'A reading text selection must be recognized');
            responsive.style.width = '285px'; await settle();
            check(firstLines.every((node, index) => dynamic.children[index] === node) && !selection.isCollapsed, 'Resize must defer reflow without collapsing a reading selection');
            selection.removeAllRanges(); document.dispatchEvent(new Event('selectionchange')); await settle();
            check(dynamic.children.length > firstCount && linesFit(dynamic), `After selection collapse, resizing must recompute fitting narrower lines (${firstCount}→${dynamic.children.length}, fit=${linesFit(dynamic)}, width=${dynamic.clientWidth})`);
            let mutations = 0; const observer = new MutationObserver(records => { mutations += records.length; });
            observer.observe(dynamic, { childList: true, characterData: true, attributes: true, subtree: true }); await settle(); observer.disconnect();
            check(mutations === 0, 'Idle reading layout must not create a resize/mutation feedback loop');
            dynamic.style.fontSize = '21px'; await settle(); check(linesFit(dynamic), 'Font changes must recompute paragraph geometry');
            enabled = false; controller.refresh(); await settle(); check(nodesEqual(dynamic, dynamicNodes), 'Disabling the controller must restore its original text nodes');
            enabled = true; controller.refresh(); await settle();
        } finally { controller.dispose(); }
        check(nodesEqual(dynamic, dynamicNodes), 'Controller disposal must restore the native paragraph');

        restoreParagraphs(prose); restoreParagraphs(cjk);
        const comparison = document.createElement('section'); comparison.style.cssText = 'display:flex;gap:28px;width:900px';
        const normal = document.createElement('div'), optimized = document.createElement('div');
        for (const [column, title] of [[normal, 'Browser justification'], [optimized, 'Knuth–Plass · Beta']] as const) {
            const heading = document.createElement('h3'); heading.textContent = title; column.appendChild(heading); comparison.appendChild(column);
            paragraph(column, english, 420).style.textAlign = 'justify'; paragraph(column, chinese, 420).style.textAlign = 'justify';
        }
        host.appendChild(comparison); layoutParagraphs(optimized);
        markup = comparison.outerHTML;
        const serialized = document.createElement('div'); serialized.innerHTML = markup; host.appendChild(serialized);
        const serializedP = serialized.querySelector<HTMLElement>('[data-an-kp="1"]')!;
        check(!!serializedP, 'Comparison fixture must include optimized markup');
        const serializedText = serializedP.textContent; restoreParagraphs(serializedP);
        check(serializedP.textContent === serializedText && !serializedP.querySelector('.an-kp-line,.an-kp-space'), 'Static export markup must unwrap cleanly before a new layout pass');
    } finally { document.getSelection()?.removeAllRanges(); restoreParagraphs(host); host.remove(); }
    return { message: 'Knuth–Plass reading layout: Latin/CJK, punctuation, inline nodes/math, exact restoration, selection-safe resizing, inert editors and bounded native fallback passed', markup };
}

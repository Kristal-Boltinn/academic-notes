// Build the snapshot in Obsidian; the isolated print window receives static HTML.
interface TocEntry { id: string; title: string; level: number; path?: string }
interface Declaration { line: number; type: string; key: string; name: string; number: string }
const TYPES: Record<string, string[]> = { "def": ["Definition", "definition", "def"], "thm": ["Theorem", "theorem", "thm"], "lem": ["Lemma", "lemma", "lem"], "prop": ["Proposition", "proposition", "prop", "prp"], "cor": ["Corollary", "corollary", "cor"], "claim": ["Claim", "claim", "clm"], "example": ["Example", "example", "ex", "exa", "exm"], "proof": ["Proof", "proof", "pf"], "remark": ["Remark", "remark", "rem", "rmk"], "axiom": ["Axiom", "axiom", "axm"], "assumption": ["Assumption", "assumption", "asm"], "exercise": ["Exercise", "exercise", "exr"], "conjecture": ["Conjecture", "conjecture", "cnj"], "hypothesis": ["Hypothesis", "hypothesis", "hyp"], "solution": ["Solution", "solution", "sol"] };
const aliases = Object.fromEntries(Object.entries(TYPES).flatMap(([k, a]) => a.slice(1).map(x => [x, k])));
const canon = (s: string | null | undefined): string | null => aliases[String(s || '').toLowerCase()] || null;
const norm = (p: string) => {
    const result: string[] = [];
    for (const s of p.replace(/\\/g, '/').split('/')) {
        if (!s || s === '.')
            continue;
        if (s === '..')
            result.pop();
        else
            result.push(s);
    }
    return result.join('/').replace(/\.md$/i, '');
};
const decode = (s: string) => { try {
    return decodeURIComponent(s);
}
catch {
    return s;
} };
const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const seqLabel = (key: string, prefix: string, counts: Record<string, number>, numbered: boolean) => {
    if (!numbered || key === 'proof' || key === 'remark' || key === 'solution')
        return '';
    counts[key] = (counts[key] || 0) + 1;
    return (prefix ? prefix + '.' : '') + counts[key];
};
/** Scan only declarations, never infer numbering from a virtualized editor DOM. */
function scanSource(source: string, numbered = true, chapter = '') {
    let fence: string | null = null, section = '', sectionCount = 0, counts = {}, inDisplay = false;
    const result: Declaration[] = [];
    source.split(/\r?\n/).forEach((raw, line) => {
        const bare = raw.replace(/^(?:\s*>\s?)+/, '').trimStart();
        const f = bare.match(/^(`{3,}|~{3,})/);
        if (f) {
            if (!fence)
                fence = f[1];
            else if (f[1][0] === fence[0] && f[1].length >= fence.length)
                fence = null;
            return;
        }
        if (fence)
            return;
        if (/^\$\$/.test(bare)) {
            if ((bare.match(/\$\$/g) || []).length % 2)
                inDisplay = !inDisplay;
            return;
        }
        if (inDisplay)
            return;
        const h = raw.match(/^ {0,3}##\s+(.+)/);
        if (h && !chapter) {
            sectionCount++;
            section = (h[1].match(/^(\d+(?:\.\d+)*)\s/) || [null, String(sectionCount)])[1];
            counts = {};
        }
        const m = raw.match(/^(?:\s*>\s?)+\[!([\w-]+)(?:\|[^\]]*)?\][+-]?(?:\s+(.*))?$/);
        if (m && canon(m[1])) {
            const key = canon(m[1])!;
            result.push({ line, type: m[1].toLowerCase(), key, name: (m[2] || '').trim(), number: seqLabel(key, chapter || section, counts, numbered) });
        }
    });
    return result;
}
function setTitle(box: HTMLElement, number = '') {
    const key = canon(box.getAttribute('data-callout'));
    if (!key)
        return;
    const title = box.querySelector<HTMLElement>(':scope > .callout-title > .callout-title-inner');
    if (!title)
        return;
    if (title.dataset.phbDecorated) {
        const label = title.querySelector('.phb-type-label');
        if (label)
            label.textContent = TYPES[key][0] + (number ? ' ' + number : '');
        return;
    }
    // Do not prepend a second number to a title already owned by another theorem plugin.
    if (/^(Definition|Theorem|Lemma|Proposition|Corollary|Claim|Example)\s+\d/i.test(title.textContent?.trim() || ''))
        return;
    const original = title.ownerDocument.win.createSpan();
    original.className = 'phb-title-name';
    const text = (title.textContent || '').trim().toLowerCase();
    const defaults = [...TYPES[key].map(x => x.toLowerCase()), ''];
    if (!defaults.includes(text))
        while (title.firstChild)
            original.appendChild(title.firstChild);
    else
        title.replaceChildren();
    const label = title.ownerDocument.win.createSpan();
    label.className = 'phb-type-label';
    label.textContent = TYPES[key][0] + (number ? ' ' + number : '');
    title.replaceChildren(label, original);
    title.dataset.phbDecorated = 'true';
}
function decorateWhole(root: HTMLElement, numbered = true, chapter = '') {
    let section = '', n = 0, counts = {};
    for (const node of root.querySelectorAll<HTMLElement>('h2,.callout[data-callout]')) {
        if (node.tagName === 'H2' && !node.closest('.callout') && !chapter) {
            n++;
            section = ((node.textContent || '').trim().match(/^(\d+(?:\.\d+)*)\s/) || [null, String(n)])[1];
            counts = {};
        }
        else if (node.matches('.callout')) {
            const key = canon(node.dataset.callout);
            if (key)
                setTitle(node, seqLabel(key, chapter || section, counts, numbered));
        }
    }
}
function unfold(root: HTMLElement) {
    for (const c of root.querySelectorAll<HTMLElement>('.callout.is-collapsed'))
        c.classList.remove('is-collapsed');
    for (const c of root.querySelectorAll<HTMLElement>('.callout > .callout-content')) {
        c.hidden = false;
        ['display', 'height', 'max-height', 'overflow'].forEach(p => c.style.removeProperty(p));
    }
}
/** Copy inline markup, giving SVG glyph IDs fresh names to avoid duplicate anchors. */
function inlineCopy(el: HTMLElement, prefix: string) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>('.heading-collapse-indicator,.phb-probe,.phb-chapter-kicker').forEach(e => e.remove());
    const ids = new Map();
    clone.querySelectorAll<HTMLElement>('[id]').forEach(e => { const old = e.id; e.id = prefix + old; ids.set(old, e.id); });
    clone.querySelectorAll<HTMLElement>('*').forEach(e => {
        for (const a of [...e.attributes]) {
            if ((a.name === 'href' || a.name === 'xlink:href') && a.value[0] === '#' && ids.has(a.value.slice(1)))
                e.setAttribute(a.name, '#' + ids.get(a.value.slice(1)));
            else if (/url\(#/.test(a.value))
                e.setAttribute(a.name, a.value.replace(/url\(#([^)]*)\)/g, (m, id) => ids.has(id) ? `url(#${ids.get(id)})` : m));
        }
    });
    return clone.childNodes;
}
function makeToc(doc: Document, entries: TocEntry[], headingMap = new Map<string, HTMLElement>(), title = '目录') {
    const nav = doc.win.createEl('nav');
    nav.className = 'phb-toc';
    nav.setAttribute('aria-label', title);
    const tab = doc.win.createDiv();
    tab.className = 'phb-toc-title';
    tab.textContent = title;
    nav.appendChild(tab);
    const min = entries.length ? Math.min(...entries.map(e => e.level)) : 1;
    for (const [i, ent] of entries.entries()) {
        const row = doc.win.createDiv();
        row.className = 'phb-toc-row';
        row.dataset.level = String(ent.level);
        row.style.setProperty('--phb-depth', String(ent.level - min));
        const link = doc.win.createEl('a');
        link.href = '#' + ent.id;
        link.dataset.phbTarget = ent.id;
        if (headingMap.has(ent.id))
            link.replaceChildren(...inlineCopy(headingMap.get(ent.id)!, `phb-toc-${i}-`));
        else
            link.textContent = ent.title;
        const dots = doc.win.createSpan();
        dots.className = 'phb-toc-leader';
        dots.setAttribute('aria-hidden', 'true');
        const page = doc.win.createEl('a');
        page.className = 'phb-toc-page';
        page.href = '#' + ent.id;
        page.dataset.phbPage = ent.id;
        page.textContent = '—';
        row.append(link, dots, page);
        nav.appendChild(row);
    }
    return nav;
}
function addProbes(root: HTMLElement, entries: TocEntry[]) {
    for (const ent of entries) {
        const node = root.ownerDocument.getElementById(ent.id);
        if (!node || node.querySelector(':scope > .phb-probe'))
            continue;
        const a = node.ownerDocument.win.createEl('a');
        a.className = 'phb-probe';
        a.href = 'https://phb-anchor.invalid/' + encodeURIComponent(ent.id);
        a.setAttribute('aria-hidden', 'true');
        a.textContent = '.';
        node.appendChild(a);
    }
}
/** Called once on a complete native snapshot or on the local Markdown renderer's DOM. */
function prepare(root: HTMLElement, options: {
    book?: boolean;
    tocDepth?: number;
    preNumbered?: boolean;
    numbered?: boolean;
    title?: string;
    subtitle?: string;
    toc?: boolean;
} = {}) {
    const doc = root.ownerDocument, warnings: string[] = [], entries: TocEntry[] = [], headingMap = new Map<string, HTMLElement>(), maps = new Map<string, Map<string, string | null>>();
    const chapters = [...root.querySelectorAll<HTMLElement>(':scope > .phb-chapter')];
    if (!chapters.length)
        throw new Error('No chapter containers in export document.');
    const book = options.book ?? chapters.length > 1;
    const depth = Math.max(1, Math.min(6, Number(options.tocDepth) || 3));
    unfold(root);
    chapters.forEach((ch, i) => {
        const path = norm(ch.dataset.path || String(i));
        const map = new Map<string, string | null>();
        maps.set(path, map);
        ch.id = `phb-c${i + 1}`;
        map.set('', ch.id);
        ch.querySelectorAll<HTMLElement>('.metadata-container,.frontmatter-container,.mod-header,.embedded-backlinks,.copy-code-button').forEach(x => x.remove());
        let main = [...ch.querySelectorAll<HTMLElement>('h1')].find(h => !h.closest('.callout'));
        if (!main) {
            main = doc.win.createEl('h1');
            main.textContent = ch.dataset.title || path.split('/').pop() || '';
            ch.prepend(main);
        }
        if (book) {
            const kicker = doc.win.createDiv();
            kicker.className = 'phb-chapter-kicker';
            kicker.textContent = `CHAPTER ${String(i + 1).padStart(2, '0')}`;
            main.before(kicker);
        }
        // Ordinary HTML/block/footnote IDs must be chapter-local. Math/SVG IDs are already unique.
        ch.querySelectorAll<HTMLElement>('[id]').forEach(e => {
            if (/^H[1-6]$/.test(e.tagName) || e.closest('svg,mjx-container'))
                return;
            const old = e.id;
            e.id = `phb-c${i + 1}-i-${old}`;
            map.set(old, e.id);
        });
        ch.querySelectorAll<HTMLElement>('[data-phb-block],[data-block-id],[data-phb-blocks]').forEach(e => {
            const key = e.dataset.phbBlock || e.dataset.blockId;
            let keys = key ? [key] : [];
            try {
                const parsed: unknown = JSON.parse(e.dataset.phbBlocks || '[]');
                if (Array.isArray(parsed)) keys.push(...parsed.filter((key): key is string => typeof key === 'string'));
            }
            catch { /* Malformed optional block metadata is ignored. */ }
            keys = [...new Set(keys.filter(k => typeof k === 'string' && /^[A-Za-z0-9-]+$/.test(k)))];
            if (!keys.length)
                return;
            if (!e.id)
                e.id = `phb-c${i + 1}-b-${keys[0]}`;
            for (const k of keys) {
                if (map.has('^' + k) && map.get('^' + k) !== e.id) {
                    map.set('^' + k, null);
                    map.set(k, null);
                    warnings.push(`重复块 ID：${path}#^${k}`);
                }
                else {
                    map.set('^' + k, e.id);
                    map.set(k, e.id);
                }
            }
        });
        if (!options.preNumbered)
            decorateWhole(ch, options.numbered !== false, book ? String(i + 1) : '');
        let j = 0;
        for (const h of ch.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')) {
            if (h.closest('.callout,.phb-toc'))
                continue;
            const old = h.id, raw = h.dataset.heading || h.textContent?.trim() || '', id = `phb-c${i + 1}-h${++j}`;
            h.id = id;
            if (old)
                map.set(old, id);
            if (!map.has(raw))
                map.set(raw, id);
            if (!map.has(h.textContent?.trim() || ''))
                map.set(h.textContent?.trim() || '', id);
            const level = Number(h.tagName.slice(1));
            if (level <= depth) {
                const title = raw.replace(/\$/g, '');
                entries.push({ id, title, level, path: ch.dataset.path || path });
                headingMap.set(id, h);
            }
        }
        map.set('', main.id);
    });
    // Resolve wiki and ordinary fragment links AFTER every chapter's IDs exist.
    for (const ch of chapters)
        for (const a of ch.querySelectorAll<HTMLAnchorElement>('a[href],a[data-href]')) {
            if (a.closest('svg,mjx-container,.phb-toc'))
                continue;
            const raw = decode(a.dataset.phbLink || a.dataset.href || a.getAttribute('href') || '');
            if (/^(https?:|mailto:|tel:|data:|obsidian:)/i.test(raw))
                continue;
            const here = norm(ch.dataset.path || ''), hash = raw.indexOf('#');
            const file = hash < 0 ? raw : raw.slice(0, hash), sub = hash < 0 ? '' : raw.slice(hash + 1);
            const candidates = a.dataset.phbCanonical === 'true' ? [norm(file)] : file ? [norm(file), norm(here.split('/').slice(0, -1).join('/') + '/' + file)] : [here];
            let target = candidates.find(p => maps.has(p));
            if (!target && file && a.dataset.phbCanonical !== 'true') {
                const base = norm(file).split('/').pop(), choices = [...maps.keys()].filter(p => p.split('/').pop() === base);
                if (choices.length === 1)
                    target = choices[0];
            }
            const id = a.dataset.phbMissing === 'true' ? undefined : target !== undefined ? maps.get(target)?.get(sub) : undefined;
            if (id) {
                a.href = '#' + id;
                a.dataset.phbResolved = id;
            }
            else if (a.classList.contains('internal-link') || raw.startsWith('#') || /\.md(?:#|$)/i.test(raw)) {
                warnings.push(`未纳入书籍或无法定位的链接：${ch.dataset.path} -> ${raw}`);
                a.dataset.phbUnresolved = 'true';
                if (file)
                    a.href = 'obsidian://open?file=' + encodeURIComponent(file + (sub ? '#' + sub : ''));
            }
        }
    // Existing live TOC markup is replaced, not appended to a second time.
    root.querySelectorAll<HTMLElement>('.phb-toc').forEach(n => {
        const p = doc.win.createDiv();
        p.className = 'phb-toc-placeholder';
        n.replaceWith(p);
    });
    root.querySelectorAll<HTMLElement>('p').forEach(p => { if (/^\[toc\]$/i.test(p.textContent?.trim() || ''))
        p.className = 'phb-toc-placeholder'; });
    root.querySelectorAll<HTMLElement>('.phb-toc-placeholder').forEach(p => {
        if (p.parentElement?.tagName === 'P' && !(p.parentElement.textContent || '').trim())
            p.parentElement.replaceWith(p);
    });
    if (book) {
        root.querySelectorAll<HTMLElement>('.phb-toc-placeholder').forEach(n => n.remove());
        const front = doc.win.createEl('section');
        front.className = 'phb-frontmatter';
        const title = doc.win.createEl('h1');
        title.className = 'phb-book-title';
        title.textContent = options.title || '讲义';
        const sub = doc.win.createEl('p');
        sub.className = 'phb-book-subtitle';
        sub.textContent = options.subtitle || '数学笔记 · 合订本';
        front.append(title, sub, makeToc(doc, entries, headingMap));
        root.prepend(front);
    }
    else {
        let holders = [...root.querySelectorAll<HTMLElement>('.phb-toc-placeholder')];
        if (!holders.length && options.toc !== false && entries.length > 1) {
            const p = doc.win.createDiv();
            chapters[0].querySelector('h1')!.after(p);
            holders = [p];
        }
        // Single-note TOC excludes its document title, matching the supplied PDF.
        const subentries = entries.filter(e => e.id !== chapters[0].querySelector('h1')!.id);
        holders.forEach(n => n.replaceWith(makeToc(doc, subentries, headingMap)));
    }
    addProbes(root, entries);
    return { version: 1, prepared: true, title: options.title || chapters[0].dataset.title || '数学笔记', book, entries, warnings };
}
function updatePages(root: HTMLElement, positions: Record<string, { page: number }>) {
    root.querySelectorAll<HTMLElement>('[data-phb-page]').forEach(el => {
        const p = positions[el.dataset.phbPage || ''];
        if (!p)
            throw new Error('Missing printed destination: ' + el.dataset.phbPage);
        el.textContent = String(p.page + 1);
    });
}
export default { TYPES, canon, escape, norm, scanSource, setTitle, decorateWhole, unfold, makeToc, prepare, addProbes, updatePages };

import { readEnvironments, readReferenceOverrides, validEnvironmentKey, type CustomEnvironment } from './environments';
import { algorithmBlocks, parseAlgorithm, type AlgorithmData } from '../algorithms/model';
import { t } from '../i18n';
import { diagramBlocks, parseDiagram } from '../diagrams/model';
import { figureMetadata, type FigureLayout } from '../rendering/figure-layout';
export type ChapterSpec = number | string | { chapter: number | string; mode: string };
export type NoteGraph = ReturnType<typeof graph>;
export interface SourceRecord {
    kind: string;
    key: string;
    path: string;
    line: number;
    endLine: number;
    from: number;
    to: number;
    depth: number;
    number: string;
    id: string | null;
    ids: string[];
    manual?: string | null;
    title?: string;
    tex?: string;
    rawType?: string;
    multiTag?: boolean;
    suppress: boolean;
    parent?: SourceRecord | null;
    scope?: string;
    prefix?: string;
    subletter?: string;
    referenced?: boolean;
    layout?: FigureLayout;
    proofOwnLine?: boolean;
    diagram?: boolean;
    algorithm?: AlgorithmData;
    algorithmError?: string;
    environment?: CustomEnvironment;
    /** Labels grouped by the multi-line row they belong to; each group gets one number. */
    rowGroups?: string[][];
    /** Every label in a numbered row, mapped to that row's number. */
    rowNumbers?: Record<string, string>;
}
export interface SourceReference {
    file: string;
    block: string;
    raw: string;
    alias: string | null;
    embed: boolean;
    from: number;
    to: number;
    line: number;
    syntax: string;
    command?: 'eqref' | 'ref';
    label?: string;
    targetPath?: string | null;
    target?: SourceRecord | null;
}
export interface ParsedNote {
    path: string;
    source: string;
    lines: string[];
    starts: number[];
    records: SourceRecord[];
    equations: SourceRecord[];
    theorems: SourceRecord[];
    media: SourceRecord[];
    callouts: SourceRecord[];
    blocks: Map<string, SourceRecord | null>;
    anchors?: Map<string, number[]>;
    refs: SourceReference[];
    headings: {
        line: number;
        level: number;
        title: string;
    }[];
    warnings: string[];
    _environments?: string;
    _mtime?: number;
    _fromEditor?: boolean;
    _blocks?: string;
}
const TYPES: Record<string, string[]> = {
    def: ['Definition', 'definition', 'def'], thm: ['Theorem', 'theorem', 'thm'],
    lem: ['Lemma', 'lemma', 'lem'], prop: ['Proposition', 'proposition', 'prop', 'prp'],
    cor: ['Corollary', 'corollary', 'cor'], claim: ['Claim', 'claim', 'clm'],
    example: ['Example', 'example', 'ex', 'exa', 'exm'], proof: ['Proof', 'proof', 'pf'],
    remark: ['Remark', 'remark', 'rem', 'rmk'], axiom: ['Axiom', 'axiom', 'axm'],
    assumption: ['Assumption', 'assumption', 'asm'], exercise: ['Exercise', 'exercise', 'exr'],
    conjecture: ['Conjecture', 'conjecture', 'cnj'], hypothesis: ['Hypothesis', 'hypothesis', 'hyp'],
    solution: ['Solution', 'solution', 'sol']
};
const MEDIA: Record<string, string[]> = { figure: ['Figure', 'figure', 'fig'], subfigure: ['Subfigure', 'subfigure', 'subfig'], table: ['Table', 'table', 'tbl'], algorithm: ['Algorithm', 'algorithm'] };
const ABBR: Record<string, string> = { def: 'def', thm: 'thm', lem: 'lem', prop: 'prop', cor: 'cor', claim: 'clm', example: 'ex', proof: 'pf', remark: 'rem', axiom: 'ax', assumption: 'asm', exercise: 'exr', conjecture: 'conj', hypothesis: 'hyp', solution: 'sol', equation: 'eq', figure: 'fig', subfigure: 'fig', table: 'tab', algorithm: 'alg' };
const mediaAliases = Object.fromEntries(Object.entries(MEDIA).flatMap(([k, v]) => v.slice(1).map(a => [a, k])));
const mediaCanon = (s: string | null | undefined): string | null => { const key = String(s || '').toLowerCase(); return Object.hasOwn(mediaAliases, key) ? mediaAliases[key] : null; };
const aliases = Object.fromEntries(Object.entries(TYPES).flatMap(([k, v]) => v.slice(1).map(a => [a, k])));
const reservedEnvironmentKeys = [...Object.keys(TYPES), ...Object.keys(MEDIA), ...Object.keys(aliases), ...Object.keys(mediaAliases), 'equation'];
const environments = (opts: { customEnvironments?: string } = {}) => readEnvironments(opts.customEnvironments || '{}', reservedEnvironmentKeys);
const canon = (s: string | null | undefined, opts: { customEnvironments?: string } = {}): string | null => {
    const key = String(s || '').toLowerCase();
    return Object.hasOwn(aliases, key) ? aliases[key] : Object.hasOwn(environments(opts), key) ? key : null;
};
const DEFAULTS = { numbered: true, equationMode: 'referenced', numbering: 'section', sharedCounter: false,
    eqFormat: 'eq:{number}', theoremFormat: '{type} {number}', respectAliases: true, numberPrefix: '',
    sectionPrefix: true, sectionNumberSource: 'order', shortReferences: true, mediaNumbered: true, figureFormat: 'fig {number}', tableFormat: 'tab {number}', algorithmFormat: 'alg {number}', algorithmNumbered: true, algorithmLineNumbers: false, customEnvironments: '{}', referenceOverrides: '{}' };
const blank = (s: string) => s.replace(/[^\r\n]/g, ' ');
const decode = (s: string) => { try {
    return decodeURIComponent(s);
}
catch {
    return s;
} };
const cleanPath = (s: string) => { const a: string[] = []; for (const p of s.replace(/\\/g, '/').split('/')) {
    if (!p || p === '.')
        continue;
    if (p === '..')
        a.pop();
    else
        a.push(p);
} return a.join('/'); };
const plain = (s: string | null | undefined) => String(s || '').replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim();
function lineOf(starts: number[], offset: number) { let l = 0, r = starts.length; while (l + 1 < r) {
    const m = (l + r) >> 1;
    if (starts[m] <= offset)
        l = m;
    else
        r = m;
} return l; }
function quote(s: string) { const m = s.match(/^[ \t]*(?:>[ \t]*)*/)![0]; return { depth: (m.match(/>/g) || []).length, prefix: m, body: s.slice(m.length) }; }
function maskedSource(source: string) {
    // Preserve UTF-16 offsets: CodeMirror and Obsidian positions use those offsets.
    let masked = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, blank);
    // Generated lists must not make unreferenced equations numbered, or index themselves.
    masked = masked.replace(/<!-- academic-notes:index:start[^]*?<!-- academic-notes:index:end -->/g, blank);
    masked = masked.replace(/<!--[\s\S]*?(?:-->|$)/g, blank).replace(/%%[\s\S]*?(?:%%|$)/g, blank);
    let fence: string | null = null;
    masked = masked.split('\n').map(line => {
        const q = quote(line), m = q.body.match(/^(`{3,}|~{3,})/);
        if (fence) {
            const ending = m && m[1][0] === fence[0] && m[1].length >= fence.length;
            if (ending)
                fence = null;
            return blank(line);
        }
        if (m) {
            fence = m[1];
            return blank(line);
        }
        if (!q.depth && /^(?: {4}|\t)/.test(line))
            return blank(line);
        return line.replace(/(`+)[^`\n]*?\1/g, blank);
    }).join('\n');
    return masked;
}
function parse(path: string, source: string, cache: {
    blocks?: Record<string, { position: { start: { line: number }; end: { line: number } } }>;
} = {}, opts: Partial<typeof DEFAULTS> = {}): ParsedNote {
    const custom = environments(opts);
    const calloutCanon = (key: string) => Object.hasOwn(aliases, key.toLowerCase()) ? aliases[key.toLowerCase()] : Object.hasOwn(custom, key.toLowerCase()) ? key.toLowerCase() : null;
    const lines = source.split('\n'), starts: number[] = [];
    let offset = 0;
    lines.forEach(l => { starts.push(offset); offset += l.length + 1; });
    let mask = maskedSource(source);
    const records: SourceRecord[] = [], equations: SourceRecord[] = [], theorems: SourceRecord[] = [], media: SourceRecord[] = [], callouts: SourceRecord[] = [], warnings: string[] = [];
    const labelBindings: { rec: SourceRecord; names: string[] }[] = [], latexReferences: SourceReference[] = [];
    const algorithms = algorithmBlocks(source);
    for (const block of algorithms) {
        mask = mask.slice(0, block.from) + blank(mask.slice(block.from, block.to)) + mask.slice(block.to);
        const meta = (block.metadata ?? 'auto').trim();
        const numbering = meta.split(/\s+/).filter(part => !/^lines=(?:true|false)$/.test(part)).join(' ') || (meta ? 'auto' : '');
        const rec: SourceRecord = { kind: 'algorithm', key: 'algorithm', path, line: block.line, endLine: block.endLine, from: block.from, to: block.to, depth: block.depth,
            title: block.title || '', manual: numbering && !['auto','*','-'].includes(numbering) ? numbering : null, suppress: ['','*','-'].includes(numbering), number: '', id: null, ids: [] };
        try {
            rec.algorithm = parseAlgorithm(block.source, block.title);
            const lineNumbers = meta.match(/(?:^|\s)lines=(true|false)(?:$|\s)/);
            if (lineNumbers) rec.algorithm.lineNumbers = lineNumbers[1] === 'true';
            rec.title = rec.algorithm.title;
        } catch (error) { rec.suppress = true; rec.manual = null; rec.algorithmError = String(error instanceof Error ? error.message : error); warnings.push(`${path}:${block.line + 1}: ${rec.algorithmError}`); }
        records.push(rec); media.push(rec); if (block.callout) callouts.push(rec);
    }
    // All $$ pairs, including display expressions embedded in a quoted paragraph.
    const delimiters = [...mask.matchAll(/(?<!\\)\$\$/g)];
    for (let i = 0; i + 1 < delimiters.length; i += 2) {
        const from = delimiters[i].index, close = delimiters[i + 1].index, to = close + 2;
        const line = lineOf(starts, from), endLine = lineOf(starts, to - 1), depth = quote(lines[line]).depth;
        const tex = source.slice(from + 2, close).split('\n').map((l, i) => { if (!i || !depth)
            return l; for (let d = 0; d < depth; d++)
            l = l.replace(/^[ \t]*>[ \t]?/, ''); return l; }).join('\n').trim();
        const tags = [...tex.replace(/(?<!\\)%[^\n]*/g, '').matchAll(/\\tag(\*)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)];
        const rec: SourceRecord = { kind: 'equation', key: 'equation', path, line, endLine, from, to, depth: quote(lines[line]).depth,
            tex, id: null, manual: tags.length === 1 ? tags[0][2] : null, multiTag: tags.length > 1,
            suppress: /\\(?:notag|nonumber)\b/.test(tex) && tags.length === 0, number: '', ids: [] };
        if (rec.multiTag)
            warnings.push(t("{0}:{1} 含多个手写 tag，保留公式但不猜测整块引用编号。", path, line + 1));
        // \label and \eqref are ordinary LaTeX commands; their names are block IDs.
        const latex = latexCommands(tex);
        if (latex.labels.length)
            labelBindings.push({ rec, names: latex.labels.map(label => label.name) });
        // A label directly on a row of a multi-line environment numbers that row.
        const env = rowEnvironment(tex);
        if (env && ROW_ENVIRONMENTS.has(env.name)) {
            const rows = rowGroups(env.body, latex.labels, env.bodyStart);
            if (rows.multi && rows.groups.length)
                rec.rowGroups = rows.groups;
        }
        const content = source.slice(from + 2, close), lead = content.length - content.trimStart().length;
        const leadLines = (content.slice(0, lead).match(/\n/g) || []).length;
        for (const ref of latex.refs) {
            const target = labelTarget(ref.label);
            if (!target)
                continue;
            const at = from + 2 + lead + ref.index, refLine = line + leadLines + (tex.slice(0, ref.index).match(/\n/g) || []).length;
            latexReferences.push({ file: target.file, block: target.block, raw: ref.source, alias: null, embed: false,
                from: at, to: at + ref.source.length, line: refLine, syntax: 'latex', command: ref.command, label: ref.label });
        }
        equations.push(rec);
        records.push(rec);
    }
    if (delimiters.length % 2)
        warnings.push(t("{0}: 存在未闭合的 $$，最后一段不参与编号。", path));
    // Math contents cannot declare headings, callouts, block IDs or links.
    const chars = mask.split('');
    for (const e of equations)
        for (let i = e.from; i < e.to; i++)
            if (chars[i] !== '\n' && chars[i] !== '\r')
                chars[i] = ' ';
    const prose = chars.join(''), proseLines = prose.split('\n');
    for (let line = 0; line < lines.length; line++) {
        const q = quote(proseLines[line]);
        if (!q.depth)
            continue;
        const m = q.body.match(/^\[!([\w-]+)(?:\|([^\]]*))?\]([+-])?[ \t]*(.*?)\r?$/);
        if (!m || !(calloutCanon(m[1]) || mediaCanon(m[1])))
            continue;
        let endLine = line;
        for (let n = line + 1; n < lines.length; n++) {
            const nq = quote(lines[n]);
            if (nq.depth < q.depth)
                break;
            if (nq.depth === q.depth && /^\[![\w-]+(?:\|[^\]]*)?\]/.test(nq.body))
                break;
            endLine = n;
        }
        const key = (calloutCanon(m[1]) || mediaCanon(m[1]))!;
        const rawMeta = m[2] === undefined ? 'auto' : m[2].trim();
        const figure = key === 'figure' ? figureMetadata(rawMeta) : undefined;
        const meta = figure ? figure.numbering : rawMeta;
        const rec: SourceRecord = { kind: calloutCanon(m[1]) ? 'theorem' : key, key, rawType: m[1], path, line, endLine, from: starts[line],
            to: starts[endLine] + lines[endLine].length, depth: q.depth, title: (m[4] || '').trim(),
            manual: meta && !['auto', '*', '-'].includes(meta) ? meta : null,
            suppress: meta === '' || meta === '*' || meta === '-', number: '', id: null, ids: [], layout: figure?.layout,
            environment: custom[key], proofOwnLine: key === 'proof' && (!(m[4] || '').trim() || !quote(lines[line + 1] || '').body.trim()) };
        (rec.kind === 'theorem' ? theorems : media).push(rec);
        callouts.push(rec);
        records.push(rec);
    }
    const visible = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, blank).replace(/<!--[\s\S]*?(?:-->|$)/g, blank).replace(/%%[\s\S]*?(?:%%|$)/g, blank).split('\n');
    for (const block of diagramBlocks(source)) {
        const line = lineOf(starts, block.from), endLine = lineOf(starts, Math.max(block.from, block.to - 1)), depth = quote(lines[line]).depth;
        if (!visible[line]?.trim()) continue;
        if (!depth && /^(?: {4}|\t)/.test(lines[line]) || media.some(r => ['figure','subfigure'].includes(r.kind) && r.line < line && r.endLine >= endLine)) continue;
        try {
            const data = parseDiagram(block.source);
            const rec: SourceRecord = { kind: 'figure', key: 'figure', path, line, endLine, from: block.from, to: block.to, depth, title: data.caption || '', manual: null, suppress: false, number: '', id: null, ids: [], diagram: true };
            media.push(rec); records.push(rec);
        } catch { /* Invalid diagrams render their own error and do not consume a number. */ }
    }
    const blocks = new Map<string, SourceRecord | null>();
    function bind(rec: SourceRecord | undefined, id: string) { if (!rec || !id)
        return; if (blocks.has(id) && blocks.get(id) !== rec) {
        blocks.set(id, null);
        warnings.push(t("{0}: 重复块 ID ^{1}，不解析歧义引用。", path, id));
        return;
    } blocks.set(id, rec); if (!rec.ids.includes(id))
        rec.ids.push(id); if (!rec.id)
        rec.id = id; }
    const ids = [...prose.matchAll(/(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*\r?$/gm)];
    const anchors = new Map<string, number[]>();
    for (const m of ids) {
        const ln = lineOf(starts, m.index + m[0].indexOf('^')), q = quote(lines[ln]);
        const locations = anchors.get(m[1]) || []; locations.push(ln); anchors.set(m[1], locations);
        const standalone = /^\^[\w-]+\s*$/.test(q.body.trim());
        let rec: SourceRecord | undefined;
        if (standalone) {
            const candidates = records.filter(r => r.endLine < ln && r.depth <= q.depth &&
                lines.slice(r.endLine + 1, ln).every(x => !quote(x).body.trim()));
            // An unquoted ID after a callout refers to the entire callout.
            candidates.push(...callouts.filter(r => r.depth === q.depth + 1 && r.endLine < ln && lines.slice(r.endLine + 1, ln).every(x => !quote(x).body.trim())));
            candidates.sort((a, b) => b.endLine - a.endLine || a.depth - b.depth || (a.kind === 'theorem' ? -1 : 1));
            rec = candidates[0];
            if (!rec)
                rec = callouts.filter(r => r.line < ln && r.endLine >= ln && r.depth === q.depth).sort((a, b) => b.line - a.line)[0];
        }
        else
            rec = records.filter(r => r.endLine === ln).sort((a, b) => a.depth - b.depth || (a.kind === 'theorem' ? -1 : 1))[0];
        // $$...$$ ^id on its closing line is outside the mathematical content.
        const eq = equations.find(r => r.endLine === ln && m.index >= r.to);
        if (eq)
            rec = eq;
        bind(rec, m[1]);
    }
    for (const block of algorithms) {
        const rec = records.find(r => r.kind === 'algorithm' && r.from === block.from);
        for (const id of block.ids) bind(rec, id);
        for (let line = block.line; line <= block.endLine; line++) {
            const id = quote(lines[line]).body.trim().match(/^\^([A-Za-z0-9-]+)$/)?.[1];
            if (id && block.ids.includes(id)) { const locations = anchors.get(id) || []; if (!locations.includes(line)) locations.push(line); anchors.set(id, locations); }
        }
    }
    // Explicit ^id markers stay canonical; \label names are additional aliases.
    for (const { rec, names } of labelBindings)
        for (const name of names)
            bind(rec, name);
    // Cache supplements missing bindings; it must not overwrite an explicit nested subfigure ID.
    for (const [id, b] of Object.entries(cache.blocks || {})) {
        const p = b.position;
        if (!p || blocks.has(id))
            continue;
        const lo = p.start.line, hi = p.end.line;
        const exact = records.filter(r => r.line === lo && r.endLine <= hi);
        const rec = exact.sort((a, b) => b.to - a.to)[0];
        if (rec && !(blocks.has(id) && blocks.get(id) === null)) {
            bind(rec, id);
        }
    }
    const refs: SourceReference[] = [...latexReferences];
    for (const m of prose.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
        const pieces = m[2].split(/(?<!\\)\|/), raw = pieces.shift()!.trim().replace(/\\\|/g, '|');
        const target = splitTarget(raw);
        if (!target)
            continue;
        refs.push({ ...target, raw, alias: pieces.length ? pieces.join('|') : null, embed: !!m[1], from: m.index, to: m.index + m[0].length, line: lineOf(starts, m.index), syntax: 'wiki' });
    }
    for (const m of prose.matchAll(/(?<!!)\[([^\]\n]*)\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
        const raw = decode(m[2] || m[3]), target = splitTarget(raw);
        if (target)
            refs.push({ ...target, raw, alias: m[1], embed: false, from: m.index, to: m.index + m[0].length, line: lineOf(starts, m.index), syntax: 'markdown' });
    }
    refs.sort((a, b) => a.from - b.from);
    records.sort((a, b) => a.from - b.from);
    media.sort((a, b) => a.from - b.from);
    const headings: ParsedNote["headings"] = [];
    for (let i = 0; i < proseLines.length; i++) {
        const m = proseLines[i].match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
        if (m)
            headings.push({ line: i, level: m[1].length, title: m[2] });
    }
    for (const r of media.filter(r => r.kind === 'subfigure')) {
        r.parent = media.filter(p => p.kind === 'figure' && p.depth < r.depth && p.line < r.line && p.endLine >= r.endLine).sort((a, b) => b.depth - a.depth)[0] || null;
        if (!r.parent)
            warnings.push(t("{0}:{1} subfigure 不在 figure 内，仅显示题注，不猜测主图编号。", path, r.line + 1));
    }
    for (const [id, locations] of anchors) if (locations.length > 1 && blocks.has(id)) blocks.set(id, null);
    return { _environments: opts.customEnvironments || '{}', path, source, lines, starts, records, theorems, equations, media, callouts, blocks, anchors, refs, headings, warnings };
}
function splitTarget(raw: string) {
    raw = decode(raw);
    // LaTeX labels may contain ':' and '.', so plugin-resolved block IDs are wider
    // than Obsidian's native [A-Za-z0-9-] block IDs.
    const block = (value: string) => !!value && !/[\s#|\[\]]/.test(value);
    let at = raw.indexOf('#^');
    if (at >= 0 && block(raw.slice(at + 2)))
        return { file: raw.slice(0, at), block: raw.slice(at + 2) };
    if (raw.startsWith('^') && block(raw.slice(1)))
        return { file: '', block: raw.slice(1) };
    return null;
}
/** A LaTeX label may be a bare block ID, ^id, #^id or a cross-file file#^id. */
function labelTarget(raw: string) {
    const value = decode(String(raw || '')).trim();
    if (!value || /[{}]/.test(value))
        return null;
    const at = value.indexOf('#');
    if (at >= 0) {
        const file = value.slice(0, at).trim(), block = value.slice(at + 1).replace(/^\^/, '').trim();
        return block ? { file, block } : null;
    }
    const block = value.replace(/^\^/, '').trim();
    return block ? { file: '', block } : null;
}
function latexCommands(tex: string) {
    // Mask comments while preserving offsets so edits do not shift source lines.
    const masked = tex.replace(/(?<!\\)%[^\n]*/g, comment => ' '.repeat(comment.length)), labels: { name: string; index: number }[] = [], refs: { command: 'eqref' | 'ref'; label: string; index: number; source: string }[] = [];
    for (const m of masked.matchAll(/\\label\s*\{([^{}]*)\}/g)) {
        const name = (m[1] || '').trim().replace(/^\^/, '');
        if (name)
            labels.push({ name, index: m.index ?? 0 });
    }
    for (const m of masked.matchAll(/(?<![A-Za-z\\])\\(eq)?ref\s*\{([^{}]*)\}/g)) {
        const label = (m[2] || '').trim();
        if (label)
            refs.push({ command: m[1] ? 'eqref' : 'ref', label, index: m.index ?? 0, source: m[0] });
    }
    return { labels, refs };
}
/** Top-level environments whose rows accept an explicit \tag. */
const ROW_ENVIRONMENTS = new Set(['align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'eqnarray', 'eqnarray*', 'aligned', 'gathered', 'split']);
const ROW_ENV_TARGET: Record<string, string> = { aligned: 'align', gathered: 'gather', split: 'align', align: 'align', gather: 'gather', equation: 'equation', multline: 'multline', eqnarray: 'eqnarray' };
function rowEnvironment(tex: string) {
    const begin = tex.match(/^\s*\\begin\{([A-Za-z]+\*?)\}/), end = tex.match(/\\end\{([A-Za-z]+\*?)\}\s*$/);
    if (!begin || !end || begin[1] !== end[1])
        return null;
    const bodyStart = begin[0].length;
    return { name: begin[1], bodyStart, body: tex.slice(bodyStart, tex.length - end[0].length) };
}
/** Group top-level labels by the top-level row they sit on. */
function rowGroups(body: string, labels: { name: string; index: number }[], bodyStart: number) {
    const groups: string[][] = [], sorted = labels.filter(label => label.index >= bodyStart && label.index <= bodyStart + body.length)
        .map(label => ({ name: label.name, index: label.index - bodyStart })).sort((a, b) => a.index - b.index);
    let depth = 0, row = 0, i = 0, li = 0, multi = false;
    const push = () => {
        const label = sorted[li++];
        if (!depth && label)
            (groups[row] ||= []).push(label.name);
    };
    while (i < body.length) {
        while (li < sorted.length && sorted[li].index === i)
            push();
        if (body.startsWith('\\begin{', i)) { depth++; i += 7; continue; }
        if (body.startsWith('\\end{', i)) { depth = Math.max(0, depth - 1); i += 5; continue; }
        if (!depth && body.startsWith('\\\\', i)) { multi = true; row++; i += 2; continue; }
        i++;
    }
    while (li < sorted.length)
        push();
    return { groups: groups.filter(Boolean), multi };
}
/** MathJax rejects \tag inside aligned/gathered/split; use the display equivalent. */
function starRowEnvironment(tex: string) {
    const begin = tex.match(/^(\s*)\\begin\{([A-Za-z]+)(\*?)\}(?:\[[^\]]*\])?/), end = tex.match(/\\end\{([A-Za-z]+)(\*?)\}(\s*)$/);
    if (!begin || !end || begin[2] !== end[1])
        return tex;
    const target = ROW_ENV_TARGET[begin[2]];
    return target ? begin[1] + '\\begin{' + target + '*}' + tex.slice(begin[0].length, end.index) + '\\end{' + target + '*' + '}' + end[3] : tex;
}
function encodeLabel(label: string) {
    return Array.from(new TextEncoder().encode(label), byte => byte.toString(16).padStart(2, '0')).join('');
}
function decodeLabel(value: string) {
    if (!value || value.length % 2 || !/^[0-9a-f]+$/i.test(value))
        return '';
    const bytes = new Uint8Array(value.length / 2);
    for (let i = 0; i < bytes.length; i++)
        bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
}
function resolvePath(name: string, here: string, paths: Set<string>, resolver?: (name: string, here: string) => string | null) {
    if (!name)
        return here;
    if (resolver) {
        const p = resolver(name, here);
        if (p)
            return paths.has(p) ? p : null;
    }
    const directory = here.split('/').slice(0, -1).join('/');
    const cs = [cleanPath(name), cleanPath(directory + '/' + name)].flatMap(p => /\.md$/i.test(p) ? [p] : [p + '.md', p]);
    for (const c of cs)
        if (paths.has(c))
            return c;
    const wanted = name.replace(/\.md$/i, '');
    const bs = [...paths].filter(p => p.replace(/\.md$/i, '').split('/').pop() === wanted);
    return bs.length === 1 ? bs[0] : null;
}
function assign(note: ParsedNote, settings: typeof DEFAULTS, referenced: Set<string>, chapter?: ChapterSpec) {
    const reserved = new Map<string, Set<string>>(), counters = new Map<string, number>();
    const h2 = note.headings.filter(h => h.level === 2);
    const chapterSpec = chapter === undefined || chapter === null ? null : (typeof chapter === 'object' ? chapter : { chapter, mode: 'chapter' });
    function scopeAt(r: SourceRecord) {
        const hs = h2.filter(h => h.line < r.line), h = hs[hs.length - 1], index = hs.length;
        const section = h ? (settings.sectionNumberSource === 'heading' ? ((h.title.match(/^(\d+(?:\.\d+)*)\b/) || [])[1] || String(index)) : String(index)) : (h2.length ? '0' : '');
        if (chapterSpec) {
            const c = String(chapterSpec.chapter);
            if (chapterSpec.mode === 'chapter-section')
                return { scope: 'chapter-' + c + '-section-' + index, prefix: c + '.' + (section || '0') };
            return { scope: 'chapter-' + c, prefix: c };
        }
        if (settings.numbering === 'file')
            return { scope: 'file', prefix: settings.numberPrefix || '' };
        // Counter scope must NOT be the printed prefix: hiding prefixes still resets at H2.
        return { scope: 'section-' + index, prefix: [settings.numberPrefix, settings.sectionPrefix ? section : ''].filter(Boolean).join('.') };
    }
    const bucket = (r: SourceRecord) => `${r.scope}|${r.kind === 'equation' ? 'equation' : r.kind !== 'theorem' ? r.kind : settings.sharedCounter ? 'theorems' : r.key}`;
    for (const r of note.records) {
        const s = scopeAt(r);
        r.prefix = s.prefix;
        r.scope = s.scope;
        r.number = '';
        r.subletter = '';
        r.rowNumbers = undefined;
        r.referenced = r.ids.some(id => referenced.has(note.path + '#^' + id));
        if (r.manual) {
            const k = bucket(r);
            if (!reserved.has(k))
                reserved.set(k, new Set());
            reserved.get(k)!.add(r.manual);
        }
    }
    for (const r of note.records) {
        if (r.kind === 'subfigure')
            continue;
        if (r.manual) {
            r.number = r.manual;
            continue;
        }
        // A \label on a row is an explicit request to number that row, even when
        // global automatic numbering is limited to referenced equations.
        if (r.kind === 'equation' && r.rowGroups?.length && !r.multiTag) {
            const k = bucket(r), taken = reserved.get(k) || new Set(), numbers: Record<string, string> = {};
            let n = counters.get(k) || 0;
            for (const group of r.rowGroups) {
                let label;
                do {
                    n++;
                    label = (r.prefix ? r.prefix + '.' : '') + n;
                } while (taken.has(label));
                for (const name of group)
                    numbers[name] = label;
                if (!r.number)
                    r.number = label;
            }
            if (Object.keys(numbers).length) {
                counters.set(k, n);
                r.rowNumbers = numbers;
                continue;
            }
        }
        const should = r.kind === 'algorithm' ? settings.algorithmNumbered : r.kind === 'equation' ? (settings.equationMode === 'all' || settings.equationMode === 'referenced' && r.referenced) : r.kind === 'theorem' ? settings.numbered && (r.environment ? r.environment.numbered : !['proof', 'remark', 'solution'].includes(r.key)) : settings.mediaNumbered;
        if (!should || r.suppress || r.multiTag)
            continue;
        const k = bucket(r), taken = reserved.get(k) || new Set();
        let n = counters.get(k) || 0, label;
        do {
            n++;
            label = (r.prefix ? r.prefix + '.' : '') + n;
        } while (taken.has(label));
        counters.set(k, n);
        r.number = label;
    }
    const subcounts = new Map<SourceRecord, number>();
    const alpha = (n: number) => { let a = ''; do {
        n--;
        a = String.fromCharCode(97 + n % 26) + a;
        n = Math.floor(n / 26);
    } while (n); return a; };
    for (const r of note.media.filter(r => r.kind === 'subfigure')) {
        if (r.manual) {
            r.number = r.manual;
            continue;
        }
        if (!r.parent || !r.parent.number || !settings.mediaNumbered || r.suppress)
            continue;
        // A decorative image needs neither a caption nor a letter. Merely having
        // a block ID (e.g. from the insertion command) is not a reference.
        if (!r.title?.trim() && !r.referenced)
            continue;
        const n = (subcounts.get(r.parent) || 0) + 1;
        subcounts.set(r.parent, n);
        r.subletter = alpha(n);
        r.number = r.parent.number + '(' + r.subletter + ')';
    }
}
function graph(notes: ParsedNote[], opts: Partial<typeof DEFAULTS> = {}, resolver?: (name: string, here: string) => string | null, chapters?: Map<string, ChapterSpec>) {
    const settings = { ...DEFAULTS, ...opts }, map = new Map(notes.map(n => [n.path, n])), paths = new Set(map.keys()), referenced = new Set<string>(), warnings = notes.flatMap(n => n.warnings);
    for (const note of notes)
        for (const ref of note.refs) {
            const p = resolvePath(ref.file, note.path, paths, resolver);
            ref.targetPath = p;
            ref.target = p ? map.get(p)!.blocks.get(ref.block) ?? null : null;
            if (ref.target)
                referenced.add(p + '#^' + ref.block);
        }
    for (const n of notes)
        assign(n, settings, referenced, chapters?.get(n.path));
    return { notes: map, settings, warnings, referenced, resolve(raw: string, here: string) { const t = splitTarget(raw); if (!t)
            return null; const p = resolvePath(t.file, here, paths, resolver); return p ? map.get(p)!.blocks.get(t.block) || null : null; },
        resolveLabel(raw: string, here: string) { const t = labelTarget(raw); if (!t)
            return null; const p = resolvePath(t.file, here, paths, resolver); return p ? map.get(p)!.blocks.get(t.block) || null : null; } };
}
/** Move exclusive legacy defaults into the single per-environment editor. */
function migrateReferenceFormats(settings: typeof DEFAULTS) {
    const overrides=referenceOverrides(settings);let changed=false;
    for(const [field,keys] of [['algorithmFormat',['algorithm']],['figureFormat',['figure','subfigure']],['tableFormat',['table']],['eqFormat',['equation']]] as const) {
        if(settings[field]===DEFAULTS[field]) continue;
        const value=settings[field];
        if(value) for(const key of keys) overrides[key]={...overrides[key],format:overrides[key]?.format || value};
        settings[field]=DEFAULTS[field];changed=true;
    }
    if(changed) settings.referenceOverrides=JSON.stringify(overrides);
    return changed;
}
function referenceFormat(key: string, opts: Partial<typeof DEFAULTS> = {}, kind = key) {
    const settings = { ...DEFAULTS, ...opts }, override = referenceOverrides(settings)[key] || {};
    let format = override.format || (kind === 'algorithm' ? settings.algorithmFormat : kind === 'equation' ? settings.eqFormat : kind === 'table' ? settings.tableFormat : kind === 'figure' || kind === 'subfigure' ? settings.figureFormat : settings.theoremFormat);
    // Legacy defaults contain literal English prefixes; an abbreviation override
    // must still take effect without making users replace those defaults first.
    if (!override.format && override.abbr) {
        const key = kind === 'algorithm' ? 'algorithmFormat' : kind === 'equation' ? 'eqFormat' : kind === 'table' ? 'tableFormat' : ['figure', 'subfigure'].includes(kind) ? 'figureFormat' : null;
        if (key && format === DEFAULTS[key]) format = kind === 'equation' ? '{abbr}:{number}' : '{abbr} {number}';
    }
    return format;
}
function refText(r: SourceRecord | null | undefined, settings = DEFAULTS) {
    if (!r)
        return null;
    settings = { ...DEFAULTS, ...settings };
    const override = referenceOverrides(settings)[r.key] || {};
    const name = override.name || typeNames(r.key, settings)[0];
    const abbr = override.abbr || r.environment?.abbr || ABBR[r.key] || r.key, type = settings.shortReferences ? abbr : name;
    if (!r.number)
        return `${type}${r.title ? ' · ' + plain(r.title) : t("（未编号）")}`;
    const format = referenceFormat(r.key, settings, r.kind);
    return String(format).replace(/\{(number|type|name|abbr|title|file)\}/g, (_, k: 'number' | 'type' | 'name' | 'abbr' | 'title' | 'file') => ({ number: r.number, type, name, abbr, title: plain(r.title), file: r.path.replace(/\.md$/i, '').split('/').pop() || '' })[k]);
}
function taggedTex(eq: SourceRecord, resolve?: (label: string) => SourceRecord | null, links = false) {
    let tex = eq.tex || '';
    const rowGroups = eq.rowGroups, rowNumbers = eq.rowNumbers;
    const rowTagged = !!rowNumbers && !!rowGroups?.length && !eq.manual && !eq.multiTag;
    if (!eq.manual && !eq.multiTag) {
        if (rowTagged) {
            tex = starRowEnvironment(tex);
        }
        else {
            // One native block = one identifier/number. No implicit AMS row counters.
            tex = tex.replace(/^\s*\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*)\\end\{\1\}\s*$/, (_, env: string, body: string) => env.startsWith('align') ? '\\begin{aligned}' + body + '\\end{aligned}' : env.startsWith('gather') ? '\\begin{gathered}' + body + '\\end{gathered}' : body);
            if (eq.number)
                tex += '\\tag{' + eq.number + '}';
        }
    }
    // Native MathJax labels persist between conversions and collide on re-render;
    // the index owns labels, so only the first label of a numbered row becomes \tag.
    tex = tex.replace(/\\label\s*\{([^{}]*)\}/g, (_, raw: string) => {
        const name = raw.trim().replace(/^\^/, '');
        if (!rowTagged || !rowGroups || !rowNumbers)
            return '';
        const group = rowGroups.find(entry => entry.includes(name));
        const number = group?.[0] === name ? rowNumbers[name] : '';
        return number ? '\\tag{' + number + '}' : '';
    });
    if (resolve)
        tex = tex.replace(/(?<![A-Za-z\\])\\(eq)?ref\s*\{([^{}]*)\}/g, (whole, kind: string | undefined, label: string) => {
            const key = label.trim(), target = resolve(key), name = labelTarget(key)?.block || key.replace(/^\^/, '');
            const raw = target?.rowNumbers?.[name] ?? target?.number;
            if (!raw)
                return whole;
            const number = raw.replace(/[\\{}%#&$]/g, ch => '\\' + ch), shown = '\\text{' + (kind ? '(' + number + ')' : number) + '}';
            return links ? '\\href{an-eqref:' + encodeLabel(key) + '}{' + shown + '}' : shown;
        });
    return tex;
}
function typeNames(key: string, opts: Partial<typeof DEFAULTS> = {}) {
    const custom = environments(opts)[key];
    return custom ? [custom.name, key] : TYPES[key] || MEDIA[key] || [key === 'equation' ? 'Equation' : key, key];
}
function referenceOverrides(opts: Partial<typeof DEFAULTS> = {}) {
    return readReferenceOverrides(opts.referenceOverrides || '{}', [...Object.keys(TYPES), ...Object.keys(MEDIA), 'equation', ...Object.keys(environments(opts))]);
}
function labelName(key: string, opts: Partial<typeof DEFAULTS> = {}) {
    return referenceOverrides(opts)[key]?.name || (key === 'algorithm' ? t('算法') : typeNames(key, opts)[0]);
}
const validCustomKey = (key: string) => validEnvironmentKey(key, reservedEnvironmentKeys);
const APPEARANCE_TYPES: Record<string, string[]> = { ...TYPES, algorithm: MEDIA.algorithm };
export default { migrateReferenceFormats, referenceFormat, environments, referenceOverrides, typeNames, labelName, validCustomKey, TYPES, APPEARANCE_TYPES, MEDIA, ABBR, mediaCanon, canon, DEFAULTS, maskedSource, parse, graph, refText, taggedTex, splitTarget, labelTarget, encodeLabel, decodeLabel, resolvePath, cleanPath, lineOf, quote, plain };

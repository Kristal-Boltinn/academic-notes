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
    refs: SourceReference[];
    headings: {
        line: number;
        level: number;
        title: string;
    }[];
    warnings: string[];
    _mtime?: number;
    _fromEditor?: boolean;
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
const MEDIA: Record<string, string[]> = { figure: ['Figure', 'figure', 'fig'], subfigure: ['Subfigure', 'subfigure', 'subfig'], table: ['Table', 'table', 'tbl'] };
const ABBR: Record<string, string> = { def: 'def', thm: 'thm', lem: 'lem', prop: 'prop', cor: 'cor', claim: 'clm', example: 'ex', proof: 'pf', remark: 'rem', axiom: 'ax', assumption: 'asm', exercise: 'exr', conjecture: 'conj', hypothesis: 'hyp', solution: 'sol', equation: 'eq', figure: 'fig', subfigure: 'fig', table: 'tab' };
const mediaAliases = Object.fromEntries(Object.entries(MEDIA).flatMap(([k, v]) => v.slice(1).map(a => [a, k])));
const mediaCanon = (s: string | null | undefined): string | null => mediaAliases[String(s || '').toLowerCase()] || null;
const aliases = Object.fromEntries(Object.entries(TYPES).flatMap(([k, v]) => v.slice(1).map(a => [a, k])));
const canon = (s: string | null | undefined): string | null => aliases[String(s || '').toLowerCase()] || null;
const DEFAULTS = { numbered: true, equationMode: 'referenced', numbering: 'section', sharedCounter: false,
    eqFormat: 'eq:{number}', theoremFormat: '{type} {number}', respectAliases: true, numberPrefix: '',
    sectionPrefix: true, sectionNumberSource: 'order', shortReferences: true, mediaNumbered: true, figureFormat: 'fig {number}', tableFormat: 'tab {number}' };
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
} = {}): ParsedNote {
    const lines = source.split('\n'), starts: number[] = [];
    let offset = 0;
    lines.forEach(l => { starts.push(offset); offset += l.length + 1; });
    let mask = maskedSource(source);
    const records: SourceRecord[] = [], equations: SourceRecord[] = [], theorems: SourceRecord[] = [], media: SourceRecord[] = [], callouts: SourceRecord[] = [], warnings: string[] = [];
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
            warnings.push(`${path}:${line + 1} 含多个手写 tag，保留公式但不猜测整块引用编号。`);
        equations.push(rec);
        records.push(rec);
    }
    if (delimiters.length % 2)
        warnings.push(`${path}: 存在未闭合的 $$，最后一段不参与编号。`);
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
        const m = q.body.match(/^\[!([\w-]+)(?:\|([^\]]*))?\]([+-])?(?:[ \t]+(.*))?\r?$/);
        if (!m || !(canon(m[1]) || mediaCanon(m[1])))
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
        const meta = m[2] === undefined ? 'auto' : m[2].trim();
        const key = (canon(m[1]) || mediaCanon(m[1]))!;
        const rec: SourceRecord = { kind: canon(m[1]) ? 'theorem' : key, key, rawType: m[1], path, line, endLine, from: starts[line],
            to: starts[endLine] + lines[endLine].length, depth: q.depth, title: (m[4] || '').trim(),
            manual: meta && !['auto', '*', '-'].includes(meta) ? meta : null,
            suppress: meta === '' || meta === '*' || meta === '-', number: '', id: null, ids: [] };
        (rec.kind === 'theorem' ? theorems : media).push(rec);
        callouts.push(rec);
        records.push(rec);
    }
    const blocks = new Map<string, SourceRecord | null>();
    function bind(rec: SourceRecord | undefined, id: string) { if (!rec || !id)
        return; if (blocks.has(id) && blocks.get(id) !== rec) {
        blocks.set(id, null);
        warnings.push(`${path}: 重复块 ID ^${id}，不解析歧义引用。`);
        return;
    } blocks.set(id, rec); if (!rec.ids.includes(id))
        rec.ids.push(id); if (!rec.id)
        rec.id = id; }
    const ids = [...prose.matchAll(/(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*\r?$/gm)];
    for (const m of ids) {
        const ln = lineOf(starts, m.index + m[0].indexOf('^')), q = quote(lines[ln]);
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
    const refs: SourceReference[] = [];
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
    const headings: ParsedNote["headings"] = [];
    for (let i = 0; i < proseLines.length; i++) {
        const m = proseLines[i].match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
        if (m)
            headings.push({ line: i, level: m[1].length, title: m[2] });
    }
    for (const r of media.filter(r => r.kind === 'subfigure')) {
        r.parent = media.filter(p => p.kind === 'figure' && p.depth < r.depth && p.line < r.line && p.endLine >= r.endLine).sort((a, b) => b.depth - a.depth)[0] || null;
        if (!r.parent)
            warnings.push(`${path}:${r.line + 1} subfigure 不在 figure 内，仅显示题注，不猜测主图编号。`);
    }
    return { path, source, lines, starts, records, theorems, equations, media, callouts, blocks, refs, headings, warnings };
}
function splitTarget(raw: string) {
    raw = decode(raw);
    let at = raw.indexOf('#^');
    if (at >= 0 && /^[A-Za-z0-9-]+$/.test(raw.slice(at + 2)))
        return { file: raw.slice(0, at), block: raw.slice(at + 2) };
    if (/^\^[A-Za-z0-9-]+$/.test(raw))
        return { file: '', block: raw.slice(1) };
    return null;
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
        const should = r.kind === 'equation' ? (settings.equationMode === 'all' || settings.equationMode === 'referenced' && r.referenced) : r.kind === 'theorem' ? settings.numbered && !['proof', 'remark', 'solution'].includes(r.key) : settings.mediaNumbered;
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
            return null; const p = resolvePath(t.file, here, paths, resolver); return p ? map.get(p)!.blocks.get(t.block) || null : null; } };
}
function refText(r: SourceRecord | null | undefined, settings = DEFAULTS) {
    if (!r)
        return null;
    settings = { ...DEFAULTS, ...settings };
    const name = r.kind === 'equation' ? 'Equation' : (TYPES[r.key] || MEDIA[r.key])[0];
    const abbr = ABBR[r.key] || r.key, type = settings.shortReferences ? abbr : name;
    if (!r.number)
        return `${type}${r.title ? ' · ' + plain(r.title) : '（未编号）'}`;
    const format = r.kind === 'equation' ? settings.eqFormat : r.kind === 'table' ? settings.tableFormat : r.kind === 'figure' || r.kind === 'subfigure' ? settings.figureFormat : settings.theoremFormat;
    return String(format).replace(/\{(number|type|name|abbr|title|file)\}/g, (_, k: 'number' | 'type' | 'name' | 'abbr' | 'title' | 'file') => ({ number: r.number, type, name, abbr, title: plain(r.title), file: r.path.replace(/\.md$/i, '').split('/').pop() || '' })[k]);
}
function taggedTex(eq: SourceRecord) {
    if (eq.manual || eq.multiTag)
        return eq.tex || '';
    // One native block = one identifier/number. No implicit AMS row counters.
    let tex = (eq.tex || '').replace(/^\s*\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*)\\end\{\1\}\s*$/, (_, env: string, body: string) => env.startsWith('align') ? '\\begin{aligned}' + body + '\\end{aligned}' : env.startsWith('gather') ? '\\begin{gathered}' + body + '\\end{gathered}' : body);
    if (eq.number)
        tex += '\\tag{' + eq.number + '}';
    return tex;
}
export default { TYPES, MEDIA, ABBR, mediaCanon, canon, DEFAULTS, maskedSource, parse, graph, refText, taggedTex, splitTarget, resolvePath, cleanPath, lineOf, quote, plain };

import type { FigureLayout } from '../rendering/figure-layout';
import { t } from '../i18n';

export type EnvironmentKind = 'thm' | 'def' | 'proof' | 'remark' | 'figure' | 'subfigures' | 'table' | 'tikz' | 'algorithm' | 'algorithm-fence';
export function environmentTemplate(kind: string, source: string, count = 2, columns: FigureLayout['columns'] = 'auto', height?: number) {
    const used = new Set([...source.matchAll(/\^([A-Za-z0-9-]+)/g)].map(m => m[1]));
    const id = (prefix: string) => { let n = 1; while (used.has(prefix + '-' + n)) n++; const value = prefix + '-' + n; used.add(value); return value; };
    const title = t('在此填写标题');
    const body = t('在此填写正文');
    let text: string;
    if (kind === 'algorithm' || kind === 'algorithm-fence') {
        const body = '\\INPUT $a,b\\in\\mathbb{N}$\n\\WHILE{$b\\ne 0$}\n  \\STATE $(a,b)\\gets(b,a\\bmod b)$\n\\ENDWHILE\n\\RETURN $a$';
        text = kind === 'algorithm' ? `> [!algorithm] ${title}\n${body.split('\n').map(line => '> ' + line).join('\n')}\n\n^${id('alg')}` : '```algorithm\n\\begin{algorithm}\n\\caption{' + title + '}\n\\begin{algorithmic}\n' + body + '\n\\end{algorithmic}\n\\end{algorithm}\n```\n\n^' + id('alg');
    } else if (kind === 'tikz') {
        text = '```tikz\n\\usepackage{tikz}\n\\begin{document}\n\\begin{tikzpicture}\n  \\node (A) at (0,0) {$A$};\n  \\node (B) at (3,0) {$B$};\n  \\draw[->] (A) -- (B) node[midway,above] {$f$};\n\\end{tikzpicture}\n\\end{document}\n```';
    } else if (kind === 'subfigures') {
        if (!Number.isInteger(count) || count < 2 || count > 12) throw new Error(t('子图数量须为 2–12。'));
        const group = id('fig');
        const options = `cols=${columns}` + (height ? ` height=${height}` : '');
        const children = Array.from({ length: count }, (_, i) =>
            `> > [!subfigure] ${t('子图')} ${i + 1}\n> > ![[image-${i + 1}.png]]\n>\n> ^${id(group + '-sub')}\n>`).join('\n');
        text = `> [!figure|${options}] ${title}\n${children}\n\n^${group}`;
    } else {
        const content = kind === 'figure' ? '![[image.png]]' : kind === 'table' ? '| A | B |\n> | --- | --- |\n> | 1 | 2 |' : body;
        text = `> [!${kind}] ${title}\n> ${content}\n\n^${id(kind === 'figure' ? 'fig' : kind === 'table' ? 'tab' : kind)}`;
    }
    const start = text.indexOf(kind === 'tikz' ? '$A$' : title);
    return { text, selection: { start, end: start + (kind === 'tikz' ? 3 : title.length) } };
}

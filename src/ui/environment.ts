import type { FigureLayout } from '../rendering/figure-layout';
import { t } from '../i18n';

export type EnvironmentKind = 'thm' | 'def' | 'proof' | 'remark' | 'figure' | 'subfigures' | 'table';
export function environmentTemplate(kind: EnvironmentKind, source: string, count = 2, columns: FigureLayout['columns'] = 'auto', height?: number) {
    const used = new Set([...source.matchAll(/\^([A-Za-z0-9-]+)/g)].map(m => m[1]));
    const id = (prefix: string) => { let n = 1; while (used.has(prefix + '-' + n)) n++; const value = prefix + '-' + n; used.add(value); return value; };
    const title = t('在此填写标题');
    const body = t('在此填写正文');
    let text: string;
    if (kind === 'subfigures') {
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
    const start = text.indexOf(title);
    return { text, selection: { start, end: start + title.length } };
}

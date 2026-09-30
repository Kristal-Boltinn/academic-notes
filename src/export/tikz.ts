import { t } from '../i18n';
let sequence = 0;
/** TikZJax owns compilation. Wait for static SVG before removing snapshot scripts. */
export async function waitForTikz(root: HTMLElement, timeout = 60000, active = () => true) {
    const blocks = [...root.querySelectorAll<HTMLElement>('.block-language-tikz')];
    if (root.querySelector('pre code.language-tikz') || blocks.some(b => b.querySelector('pre code'))) throw new Error(t('TikZ 未渲染：请安装并启用可选的 TikZJax 插件，再重新导出。'));
    if (!blocks.length) return;
    const deadline = Date.now() + timeout;
    while (blocks.some(b => !b.querySelector('svg'))) {
        if (!active()) throw new Error(t('插件已停用。'));
        if (Date.now() >= deadline) throw new Error(t('TikZ 绘图未在 60 秒内完成；请先在阅读模式确认 TikZ 源码能正常渲染。'));
        await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    await new Promise(resolve => window.setTimeout(resolve, 100));
    const batch = ++sequence;
    blocks.forEach((block, index) => [...block.querySelectorAll('svg')].filter(svg => !svg.parentElement?.closest('svg')).forEach((svg, svgIndex) => {
        const ids = new Map<string, string>();
        svg.querySelectorAll('[id]').forEach(node => { const old = node.id, next = `an-tikz-${batch}-${index}-${svgIndex}-${old}`; ids.set(old, next); node.id = next; });
        svg.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => {
            if (['href', 'xlink:href'].includes(attr.name) && attr.value.startsWith('#') && ids.has(attr.value.slice(1))) node.setAttribute(attr.name, '#' + ids.get(attr.value.slice(1)));
            else if (attr.value.includes('url(#')) node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]*)\)/g, (all, key: string) => ids.has(key) ? `url(#${ids.get(key)})` : all));
        }));
    }));
}

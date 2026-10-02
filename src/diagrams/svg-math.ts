import { HTMLAdaptor } from 'mathjax-full/js/adaptors/HTMLAdaptor.js';
import type { browserAdaptor } from 'mathjax-full/js/adaptors/browserAdaptor.js';
import { HTMLHandler } from 'mathjax-full/js/handlers/html/HTMLHandler.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/configmacros/ConfigMacrosConfiguration.js';

/** A private, bundled TeX→SVG fallback. Never changes the host MathJax renderer. */
const renderers = new WeakMap<Document, ReturnType<HTMLHandler<HTMLElement, Text, Document>['create']>>();
export function localMathSvg(doc: Document, source: string) {
    let renderer = renderers.get(doc);
    if (!renderer) {
        if (!doc.defaultView) throw new Error('Diagram document has no rendering window.');
        // MathJax's minimal DOM typings predate nullable DOM properties. Its
        // browser adaptor uses this same implementation with the native DOM.
        const Adaptor = HTMLAdaptor as unknown as new (win: Window) => ReturnType<typeof browserAdaptor>;
        const handler = new HTMLHandler(new Adaptor(doc.defaultView));
        renderer = handler.create(doc, { InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'configmacros'] }), OutputJax: new SVG({ fontCache: 'local' }) });
        renderers.set(doc, renderer);
    }
    return renderer.convert(source, { display: false, em: 20, ex: 10, containerWidth: 700 }) as HTMLElement;
}

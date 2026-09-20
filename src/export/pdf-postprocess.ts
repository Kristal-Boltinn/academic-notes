import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib';
export interface HeadingEntry {
    id: string;
    title: string;
    level: number;
}
export interface Position {
    page: number;
    x: number;
    y: number;
}
export interface ExportMeta {
    title: string;
    entries: HeadingEntry[];
    warnings?: string[];
    prepared: boolean;
}
export const PROBE = 'https://phb-anchor.invalid/';
const key = PDFName.of;
const stringValue = (value: unknown): string | undefined => value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : undefined;
export async function measurePdf(bytes: Uint8Array) {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const positions: Record<string, Position> = {};
    doc.getPages().forEach((page, index) => {
        const annots = page.node.Annots();
        for (let i = 0; annots && i < annots.size(); i++) {
            const annotation = annots.lookup(i, PDFDict);
            const action = annotation.lookupMaybe(key('A'), PDFDict);
            const uri = action && stringValue(action.get(key('URI')));
            if (!uri?.startsWith(PROBE))
                continue;
            const id = decodeURIComponent(uri.slice(PROBE.length));
            const rect = annotation.lookup(key('Rect'), PDFArray);
            positions[id] ??= {
                page: index, x: rect.lookup(0, PDFNumber).asNumber(),
                y: Math.max(rect.lookup(1, PDFNumber).asNumber(), rect.lookup(3, PDFNumber).asNumber())
            };
        }
    });
    return { positions, pages: doc.getPageCount() };
}
export async function finishPdf(bytes: Uint8Array, meta: ExportMeta, positions: Record<string, Position>) {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPages();
    const named = new Map<string, unknown>();
    const visitNames = (node: PDFDict) => {
        const names = node.lookupMaybe(key('Names'), PDFArray);
        for (let i = 0; names && i + 1 < names.size(); i += 2) {
            const name = stringValue(names.get(i));
            if (name)
                named.set(name, names.get(i + 1));
        }
        const kids = node.lookupMaybe(key('Kids'), PDFArray);
        for (let i = 0; kids && i < kids.size(); i++)
            visitNames(kids.lookup(i, PDFDict));
    };
    const names = doc.catalog.lookupMaybe(key('Names'), PDFDict);
    const destNames = names?.lookupMaybe(key('Dests'), PDFDict);
    if (destNames)
        visitNames(destNames);
    const dests = doc.catalog.lookupMaybe(key('Dests'), PDFDict);
    if (dests)
        for (const [name, value] of dests.entries())
            named.set(name.decodeText(), value);
    const pageRefs = new Set(pages.map(p => p.ref.toString()));
    const validDestination = (value: unknown, seen = new Set<string>()): boolean => {
        const dest = value instanceof PDFRef ? doc.context.lookup(value) : value;
        if (dest instanceof PDFArray)
            return pageRefs.has(dest.get(0).toString());
        if (dest instanceof PDFDict)
            return validDestination(dest.get(key('D')), seen);
        const name = dest instanceof PDFName ? dest.decodeText() : stringValue(dest);
        if (!name || seen.has(name))
            return false;
        seen.add(name);
        return validDestination(named.get(name), seen);
    };
    let validInternalLinks = 0, externalLinks = 0;
    for (const page of pages) {
        const annots = page.node.Annots();
        for (let i = (annots?.size() ?? 0) - 1; annots && i >= 0; i--) {
            const annotation = annots.lookup(i, PDFDict);
            const action = annotation.lookupMaybe(key('A'), PDFDict);
            const uri = action && stringValue(action.get(key('URI')));
            if (uri?.startsWith(PROBE)) {
                annots.remove(i);
                continue;
            }
            const destination = annotation.get(key('Dest')) ??
                (action?.get(key('S'))?.toString() === '/GoTo' ? action.get(key('D')) : undefined);
            if (destination) {
                if (!validDestination(destination))
                    throw new Error('PDF 内部链接目标无效，已停止输出。');
                validInternalLinks++;
            }
            else if (uri)
                externalLinks++;
        }
    }
    // Build a real nested PDF outline; each destination comes from measured annotations.
    interface OutlineNode {
        entry?: HeadingEntry;
        ref: PDFRef;
        dict: PDFDict;
        children: OutlineNode[];
    }
    const rootDict = doc.context.obj({ Type: 'Outlines' });
    const root: OutlineNode = { ref: doc.context.register(rootDict), dict: rootDict, children: [] };
    const stack = [root];
    for (const entry of meta.entries) {
        const pos = positions[entry.id];
        if (!pos || !pages[pos.page])
            throw new Error('PDF 缺少目录目标：' + entry.id);
        while (stack.length > 1 && stack.at(-1)!.entry!.level >= entry.level)
            stack.pop();
        const parent = stack.at(-1)!;
        const dict = doc.context.obj({
            Title: PDFHexString.fromText(entry.title), Parent: parent.ref,
            Dest: [pages[pos.page].ref, 'XYZ', pos.x, Math.min(pos.y + 8, pages[pos.page].getHeight()), null]
        });
        const node: OutlineNode = { entry, ref: doc.context.register(dict), dict, children: [] };
        parent.children.push(node);
        stack.push(node);
    }
    const connect = (node: OutlineNode): number => {
        let total = 0;
        node.children.forEach((child, i, children) => {
            if (i)
                child.dict.set(key('Prev'), children[i - 1].ref);
            if (i + 1 < children.length)
                child.dict.set(key('Next'), children[i + 1].ref);
            total += 1 + connect(child);
        });
        if (node.children.length) {
            node.dict.set(key('First'), node.children[0].ref);
            node.dict.set(key('Last'), node.children.at(-1)!.ref);
            node.dict.set(key('Count'), PDFNumber.of(total));
        }
        return total;
    };
    connect(root);
    doc.catalog.set(key('Outlines'), root.ref);
    doc.setTitle(meta.title);
    doc.setProducer('Academic Notes / Electron + pdf-lib');
    return {
        bytes: await doc.save(),
        stats: { pages: pages.length, validInternalLinks, externalLinks, invalidInternalLinks: [] }
    };
}

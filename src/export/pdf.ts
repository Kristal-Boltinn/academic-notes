import * as electron from 'electron';
import { setTimeout as scheduleTimeout, clearTimeout as cancelTimeout } from 'node:timers';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserWindow as ElectronWindow, BrowserWindowConstructorOptions } from 'electron';
import { finishPdf, measurePdf, type ExportMeta } from './pdf-postprocess';
type WindowConstructor = new (options: BrowserWindowConstructorOptions) => ElectronWindow;
function nativeWindow(): WindowConstructor {
    // Obsidian exposes Electron's main-process API through its remote bridge.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional Obsidian bridge; eager import breaks hosts exposing electron.remote.
    const remote = (electron as typeof electron & { remote?: { BrowserWindow?: WindowConstructor } }).remote || require('@electron/remote') as { BrowserWindow?: WindowConstructor };
    if (typeof remote?.BrowserWindow !== 'function')
        throw new Error('当前 Obsidian 未提供 Electron PDF 接口，请更新桌面安装程序。');
    return remote.BrowserWindow;
}
export function pdfAvailability() {
    try {
        nativeWindow();
        return { interfaceAvailable: true, verification: 'interface-only', engine: 'Electron printToPDF', note: '仅确认 Electron 接口存在，不代表实际导出已通过；请查看 lastPdfExport 和 errors。' };
    }
    catch (error) {
        return { interfaceAvailable: false, verification: 'interface-only', error: String(error) };
    }
}
/** Only called with an internally generated snapshot. No document scripts or network are enabled. */
export async function exportPdf(html: string, log: (line: string) => void = () => { }, signal?: AbortSignal, Window: WindowConstructor = nativeWindow()) {
    if (signal?.aborted)
        throw new Error('导出已取消。');
    const win = new Window({
        show: false, width: 1000, height: 800, autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false, contextIsolation: true, sandbox: true,
            backgroundThrottling: false, partition: 'academic-notes-' + crypto.randomUUID()
        }
    });
    let timedOut = false;
    let tempDirectory: string | undefined;
    const close = () => { if (!win.isDestroyed())
        win.destroy(); };
    const timer = scheduleTimeout(() => { timedOut = true; close(); }, 240000);
    signal?.addEventListener('abort', close, { once: true });
    try {
        const wc = win.webContents;
        tempDirectory = await mkdtemp(join(tmpdir(), 'academic-notes-'));
        const htmlPath = join(tempDirectory, 'document.html');
        await writeFile(htmlPath, html, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        const documentUrl = pathToFileURL(htmlPath).href;
        wc.session.webRequest.onBeforeRequest((details, callback) => {
            callback({ cancel: !(details.url.split('#')[0] === documentUrl || /^(data:|blob:|about:blank$)/.test(details.url)) });
        });
        wc.setWindowOpenHandler(() => ({ action: 'deny' }));
        wc.on('will-navigate', event => event.preventDefault());
        try {
            log('正在加载本地打印快照（' + Buffer.byteLength(html, 'utf8') + ' 字节）…');
            await win.loadFile(htmlPath);
        }
        catch (error) {
            // Keep local paths and document contents out of the public-facing error.
            const code = (error as {
                code?: string;
            }).code || 'unknown';
            throw new Error('Electron 打印窗口加载失败：' + code);
        }
        const meta = await wc.executeJavaScript(`JSON.parse(document.getElementById('phb-meta').textContent)`) as ExportMeta;
        if (!meta.prepared || !meta.entries?.length)
            throw new Error('快照缺少已解析的标题与目录信息。');
        await wc.executeJavaScript(`(${preparePrint.toString()})()`);
        const dark = Boolean(await wc.executeJavaScript(`document.body.classList.contains('theme-dark')`));
        const options = {
            pageSize: 'A4' as const, printBackground: true, preferCSSPageSize: true,
            displayHeaderFooter: true, headerTemplate: '<span></span>',
            footerTemplate: `<div style="width:100%;text-align:center;font:8px Arial;color:${dark ? '#bbb' : '#666'}">` +
                '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            margins: { top: 18 / 25.4, right: 18 / 25.4, bottom: 20 / 25.4, left: 18 / 25.4 },
            scale: 1
        };
        let previous = '', finalBytes: Uint8Array | undefined;
        let measured: Awaited<ReturnType<typeof measurePdf>> | undefined;
        let iterations = 0;
        for (iterations = 1; iterations <= 6; iterations++) {
            if (signal?.aborted)
                throw new Error('导出已取消。');
            log('打印并校准目录：第 ' + iterations + ' 轮');
            finalBytes = await wc.printToPDF(options);
            measured = await measurePdf(finalBytes);
            for (const entry of meta.entries)
                if (!measured.positions[entry.id])
                    throw new Error('无法定位 PDF 标题：' + entry.title);
            const signature = JSON.stringify([measured.pages, meta.entries.map(e => measured!.positions[e.id].page)]);
            if (signature === previous)
                break;
            const positions = JSON.stringify(measured.positions);
            await wc.executeJavaScript(`((positions) => {
        document.querySelectorAll('[data-phb-page]').forEach(el => {
          const position = positions[el.dataset.phbPage];
          if (!position) throw new Error('Missing printed destination');
          el.textContent = String(position.page + 1);
        });
      })(${positions})`);
            previous = signature;
        }
        if (iterations > 6 || !finalBytes || !measured)
            throw new Error('6 轮后目录页码仍未稳定，请调整目录标题或字体。');
        // Remove probe annotations from the measured PDF itself, avoiding a divergent final reprint.
        const finished = await finishPdf(finalBytes, meta, measured.positions);
        const overflow = await wc.executeJavaScript(`(${findOverflow.toString()})()`) as ReturnType<typeof findOverflow>;
        return {
            bytes: finished.bytes,
            report: {
                ...finished.stats, iterations, engine: 'Electron printToPDF', warnings: meta.warnings || [],
                horizontalOverflow: overflow,
                entries: meta.entries.map(e => ({ ...e, ...measured.positions[e.id], printedPage: measured.positions[e.id].page + 1 }))
            }
        };
    }
    catch (error) {
        if (timedOut)
            throw new Error('PDF 导出超过 4 分钟，窗口已关闭。');
        if (signal?.aborted)
            throw new Error('导出已取消。');
        throw error;
    }
    finally {
        cancelTimeout(timer);
        signal?.removeEventListener('abort', close);
        close();
        if (tempDirectory)
            await rm(tempDirectory, { recursive: true, force: true }).catch(() => log('临时打印文件清理失败，请检查系统临时目录中的 academic-notes 文件夹。'));
    }
}
// This function is serialized into the isolated print window; keep it self-contained.
async function preparePrint() {
    await document.fonts.ready;
    await Promise.all([...document.images].map(async (img) => {
        try {
            await img.decode();
        }
        catch {
            throw new Error('图片无法加载：' + img.alt);
        }
    }));
    if (document.querySelector('[data-mml-node="merror"],mjx-merror'))
        throw new Error('公式渲染错误。');
    if ([...document.fonts].some(font => font.status === 'error'))
        throw new Error('快照字体加载失败。');
    document.querySelectorAll<HTMLElement>('.callout:not(.an-media)').forEach(box => {
        // Runs serialized in isolated Chromium, without Obsidian DOM helpers.
        const wrapper = document.createElement('div');
        wrapper.className = 'phb-callout-wrap';
        box.before(wrapper);
        wrapper.appendChild(box);
        const height = box.getBoundingClientRect().height;
        wrapper.dataset.phbKeep = box.dataset.phbKeep = String(height < 390);
        box.dataset.phbLong = String(height > 870);
    });
    document.querySelectorAll<SVGElement>('mjx-container > svg').forEach(svg => {
        const block = svg.closest('.callout-content,p,li,td,.phb-chapter');
        const available = block?.clientWidth ?? 0, bounds = svg.getBoundingClientRect();
        if (available > 0 && bounds.width > available + 1) {
            svg.style.width = available + 'px';
            svg.style.height = bounds.height * available / bounds.width + 'px';
        }
    });
    document.documentElement.style.setProperty('--phb-page-background', getComputedStyle(document.body).backgroundColor);
}
function findOverflow() {
    const main = document.getElementById('phb-document')!.getBoundingClientRect();
    return [...document.querySelectorAll('.callout,.phb-toc,p,table,img')].filter(el => {
        if (el.closest('svg,mjx-container'))
            return false;
        const r = el.getBoundingClientRect();
        return r.width && (r.right > main.right + 2 || r.left < main.left - 2);
    }).map(el => ({ tag: el.tagName, text: el.textContent?.trim().slice(0, 90) }));
}

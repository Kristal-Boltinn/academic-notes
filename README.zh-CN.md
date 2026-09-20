# Academic Notes

[English](README.md) | **简体中文**

**LaTeX-like numbering, cross-references and local PDF export for Obsidian.**

数学环境、公式、图表与子图自动编号；跨文件块引用、目录和多篇笔记合订本。配色独立于特定主题，PDF 使用 Obsidian 自带的 Electron，安装后无需 Python、Chrome 或其他外部程序。

**2.2.2 · Community Release Candidate**。尚未通过社区审核，不代表已在 Community Plugins 上架。

![Theorem environments](screenshots/theorem.png)

## 安装

需要桌面版 Obsidian 1.9.0+。将 Release 的三个文件放入笔记库的 `.obsidian/plugins/academic-notes/`：

```text
academic-notes/
├─ main.js
├─ manifest.json
└─ styles.css
```

在「设置 → 第三方插件」启用 **Academic Notes**。图表布局已内置，不需要再启用 CSS 片段。插件设置保存在本机 `data.json`；不要将它上传到公共仓库。

仅需三线表和手写图表题注布局、不需编号时，可以单独使用 [snippets/academic-layout.css](snippets/academic-layout.css)，复制到 `.obsidian/snippets/` 后在外观设置中启用。

## 数学框与引用：最小示例

```markdown
## 连续映射

> [!def] 连续性
> 若每个开集的原像都是开集，则称映射连续。

^def-continuity

> [!thm] 复合映射
> 两个连续映射的复合仍连续。

^thm-composition

根据 [[#^def-continuity]] 可以证明 [[#^thm-composition]]。

> [!proof]
> 逐次取原像即可。
```

默认显示 `Definition 1.1 · 连续性` 和 `Theorem 1.1 · 复合映射`；链接显示 `def 1.1`、`thm 1.1`。不同类型默认分别计数。点击引用跳转到目标。

| 环境 | 支持的类型名 | 自动编号 |
|---|---|---|
| 定义 | `def`、`definition` | 是 |
| 定理 | `thm`、`theorem` | 是 |
| 引理 | `lem`、`lemma` | 是 |
| 命题 | `prop`、`proposition`、`prp` | 是 |
| 推论 | `cor`、`corollary` | 是 |
| 断言 | `claim`、`clm` | 是 |
| 例子 | `example`、`ex`、`exa`、`exm` | 是 |
| 公理 | `axiom`、`axm` | 是 |
| 假设 | `assumption`、`asm` | 是 |
| 习题 | `exercise`、`exr` | 是 |
| 猜想 | `conjecture`、`cnj` | 是 |
| 假说 | `hypothesis`、`hyp` | 是 |
| 证明 | `proof`、`pf` | 否 |
| 注记 | `remark`、`rem`、`rmk` | 否 |
| 解答 | `solution`、`sol` | 否 |

`> [!thm]- 标题` 为默认折叠，`> [!thm]+ 标题` 为默认展开。嵌套框每层增加一个 `>`；导出时展开折叠内容。

手写编号：`> [!thm|A.1] 标题`。不编号：`> [!thm|*] 标题`；`|-` 和空元数据 `|` 也表示不编号。省略元数据或 `|auto` 表示自动编号。自动计数避开同一计数范围内已有的相同手写编号。

## 公式编号

```markdown
## 恒等式

$$
a^2+b^2=c^2
$$

^eq-example

由 [[#^eq-example]] 得到结论。
```

默认仅为**全库中被引用**的独立 `$$...$$` 公式自动编号，未引用的公式不占号。可设为全部编号或关闭自动编号；行内公式不编号。

保留手写 `\tag{A}`；没有手写编号时，`\notag` / `\nonumber` 阻止自动编号。一个公式块对应一个自动编号。需要逐行引用时拆成不同块。一个块含多个手写 `\tag` 时保留原式，不猜测整块引用编号。

## 跨文件引用和命令

```markdown
同文件：[[#^thm-composition]]
跨文件：[[第一章#^thm-composition]]
手写文字：[[第一章#^thm-composition|复合映射定理]]
Markdown 链接：[复合映射定理](第一章.md#^thm-composition)
```

块 ID 只使用英文字母、数字、连字符，一篇笔记内必须唯一。块结束后空一行，再单独写 `^id`。嵌套块建议使用命令自动添加，避免引用层级放错。

在命令面板（Windows：`Ctrl+P`）搜索 Academic Notes：

- **为光标所在公式、定理或图表添加块 ID**：为当前块写入唯一 ID。
- **插入定理、公式或图表引用**：选择已有 ID 的目标并插入链接。
- **重建定理公式索引并刷新引用**：手动刷新。

输入 `\ref`、`\tref` 或 `\eqref` 可触发引用建议，后两种分别筛选数学框和公式。阅读模式和实时预览替换链接显示；源码模式保留写法，实时预览中光标进入链接时也恢复源码。默认保留手写链接别名。

## 编号设置

| 设置 | 说明 |
|---|---|
| 按 H2 分节重置（默认） | 每遇源码中的 `##` 重置计数器；H3–H6 不参与 |
| 编号前加入 H2 节号 | 开启为 `2.1`；关闭为 `1`，但仍按 H2 重置 |
| H2 节号来源 | 按出现顺序，或优先取 `## 3.2 标题` 开头的数字 |
| 整篇连续编号 | 不按 H2 重置，不添加 H2 节号 |
| 不同定理类型共享计数器 | 开启后定义、定理等共同计数；公式、图、表仍独立 |
| 编号前缀 | 手动指定；不会从日期或文件名猜测 |
| 排除索引的路径 | 相对库根目录的文件或目录，每行一个 |

有 H2 时，首个 H2 前属于第 0 节；完全没有 H2 时省略节号。代码块、公式、注释中的标题不计入分节。

公式引用格式默认 `eq:{number}`；数学框默认 `{type} {number}`。`{type}` 受缩写开关控制，`{abbr}` 始终缩写，`{name}` 始终全称；还支持 `{title}`、`{file}`。图表默认 `fig {number}` / `tab {number}`。

## 图、表与子图

题注写在 Callout 标题中。图注在图下方，表注在表上方，表格使用三线表。图片路径换成库中实际存在的文件。

```markdown
> [!figure] 函数曲线
> ![[附件/曲线.svg]]

^fig-curve

> [!table] 参数
> | 参数 | 数值 |
> | --- | --- |
> | $a$ | 1 |
> | $b$ | 2 |

^tab-parameters

参见 [[#^fig-curve]]、[[#^tab-parameters]]。
```

子图必须嵌套在主图内：

```markdown
> [!figure] 两种状态
> > [!subfigure] 初始状态
> > ![[附件/初始.svg]]
>
> ^fig-initial
>
> > [!subfigure] 最终状态
> > ![[附件/最终.svg]]
>
> ^fig-final

^fig-states
```

子图显示 `(a)`、`(b)`；引用 `[[#^fig-initial]]` 显示例如 `fig 1.1(a)`。窄窗口自动换行。孤立的子图只显示题注并给出诊断警告。支持别名 `fig`、`tbl`、`subfig`。

普通图片不从 alt 文本猜测题注。**H6 始终是六级标题**；图表必须使用明确的 Callout 语法。

可选笔记属性：

```yaml
---
cssclasses:
  - academic-serif
  - academic-indent
---
```

`academic-serif` 使用本机可用的衬线字体；`academic-indent` 让普通段落首行缩进，框内、列表等不缩进；`academic-keep-table-style` 保留主题的表格样式。

## 配色：哪些会跟随主题？

浅色：Forest（默认）、Sakura、Mint、Sky、Mauve、Golden、Cherry、Prussian。深色：Radiation（默认）、Vampire、Abyss。每套按数学环境区分颜色。浅深模式跟随 **Obsidian 当前模式**；Obsidian 设为跟随系统时，会间接跟随系统的浅深模式。

**跟随 Obsidian 主题配色**不会匹配某套预设，也不直接读取操作系统主色调。定义取主题公开的 `--text-accent`，定理/断言取蓝色，引理取紫色，命题取绿色，推论取青色，例子取橙色，证明/注记取次要文字色，再混入普通正文色。强调色只影响部分环境。选择固定色板即可让边框与底色色系独立于主题；没有主题专用适配开关。

**框内正文使用普通正文色**：开启后，正文和笔记普通文字同色；关闭时混入 36% 当前框色。它只影响正文颜色，不改变字体、标题、边框或底色。主题正文色可能带色，并不保证纯黑/纯灰；链接和代码保留各自语义样式。

浅色框内部为 **6% 框色 + 94% 白色**，深色框为 **8% 框色 + 92% 中性深灰**，避免彩色页面背景使框内部偏色。深色模式保留低亮度同色系底色。嵌套框各用自己的颜色。右下角图案可单独隐藏。可选 Style Settings 可调边框和圆角，并非运行依赖。

## 目录

独立段落写 `[toc]`，或使用带深度的代码块：

````markdown
```academic-toc
3
```
````

支持深度 1–6，省略则用设置值。笔记中的目录可点击；PDF 目录的页码通过实际打印测量得到，并建立 PDF 书签。

## PDF / HTML 导出

**无需安装导出引擎**。运行「直接导出当前笔记为 PDF」或「导出当前笔记为 HTML 快照」。HTML 是静态快照；修改笔记后需要重新导出。

多篇导出运行「选择多篇笔记并导出合订本 PDF」，勾选文件、调整顺序和标题。也可创建清单笔记：

```yaml
---
phb-book:
  title: Analysis Notes
  subtitle: A sample collection
  tocDepth: 3
  files:
    - 第一章.md
    - path: 第二章.md
      title: 第二章：连续映射
---
```

`phb-book` 是笔记顶部 YAML 属性里的合订本章节清单，不是目录或额外插件。单篇直接导出不需要它；也可以使用多篇选择窗口而不写清单。

打开清单运行「按 phb-book 清单导出 PDF」或 HTML 命令。路径相对库根目录，按清单顺序组章；清单本身不作为章节。

合订本编号有三种：**章.节.序号**（默认，如 `2.3.1`）、**章.序号**（章内连续，如 `2.1`）、**保留库内显示编号**（可能跨章重号）。无 H2 或首个 H2 前，在章.节模式属于第 0 节。前两种在导出副本中重新编号，原笔记不变。跨文件目标要纳入本次导出，否则报告提示未解析引用。

「PDF 捕获当前主题与片段样式」开启时复制当前 CSS，关闭时用内置数学框、图表和打印样式；都保留当前浅深模式和色板。折叠框展开，长框允许跨页，过宽 SVG 公式按可用宽度缩放。

默认输出到库内 `_exports/`；只能使用库内相对目录，不能使用绝对路径或 `..`。生成带时间戳的 HTML 快照、快照报告、PDF 和分页校验报告。最多进行 6 轮目录校准，未收敛、图片/公式/字体错误或内部链接无效时停止输出，不猜测页码。

## 隐私和权限

- 本地索引库内 Markdown，以解析跨文件引用；支持排除文件/目录。无账号、遥测或开发者服务器，不传输笔记内容。
- 插件不安装程序、不启动外部命令、不下载运行依赖。Electron 和 PDF 后处理都在本机执行。
- Node 文件系统接口仅用于创建和清理独立的打印快照，不扫描任意系统目录。PDF 临时将 HTML 写入系统临时目录中的独立 `academic-notes-*` 文件夹，结束后删除；应用崩溃时可能留下临时文件。PDF 使用隔离的隐藏窗口，禁用 Node 集成、文档脚本和网络请求。普通外部链接可保留为 PDF 链接，不会因导出自动访问。
- 为保存主题外观，快照可能读取本机已加载的 CSS、字体和图片资源，包括主题引用的库外本地资源。这些资源仅内嵌进本地快照；关闭捕获主题可减少主题资源读取。
- 导出文件与报告只写入库内指定目录。报告可能包含文件路径、标题和警告；公开分享前应检查内容。
- 网络图片请先保存到库内。插件不会在导出时下载远程图片或 CSS 资源。Obsidian 和其他插件自己的网络行为不由本插件控制。
- 自动索引和导出不改写笔记；添加块 ID 和插入引用命令会按用户操作编辑当前笔记。

## 查看导出失败原因

导出进度窗口会显示错误。关闭窗口后，用命令面板运行「检查插件状态与导出环境」，查看 `errors` 和 `lastPdfExport`；点击「保存诊断 JSON 到导出目录」保存到默认 `_exports/academic-diagnostics-*.json`。错误历史保留在当前插件会话，重载前请保存。`pdf.interfaceAvailable` 只检查接口存在，不代表导出成功。成功导出才会生成 `.report.json`；失败时 `.phb.html` 快照可能已经保存。更完整的日志可在 `Ctrl+Shift+I` 的 Console 中搜索 `[Academic Notes]`。

## 排错与兼容性

| 问题 | 检查 |
|---|---|
| 公式未编号 | 默认仅编号被引用公式；检查 ID、路径、排除设置和 `\notag` |
| 引用未替换 | 手写别名默认保留；源码模式不替换；重复 ID 不解析 |
| 数学框或图表异常 | 停用重复的编号插件/数学框 CSS/布局片段，确认支持的 Callout 类型 |
| 框内颜色偏差 | 检查是否选择跟随主题；普通正文色开关只控制文字 |
| Electron 接口不可用 | 运行「检查插件状态与导出环境」，更新 Obsidian 桌面安装程序 |
| PDF 导出失败 | 查看进度窗口和报告；确认图片已存入库、公式和字体可正常加载 |
| 编号没有刷新 | 运行重建索引命令 |

桌面专用；不支持移动端 PDF。最低应用版本表示 API 下限，不代表所有操作系统、主题和插件组合都已实机验收。PDF 原生窗口桥接依赖 Obsidian 桌面提供的 Electron 接口；应用更新后应重新测试。

## 开发与发布

Node.js 22+：

```sh
npm ci
npm test
npm run build
npm run test:electron
npm run check:release
```

`npm ci` 仅用于开发/CI，会安装测试用 Electron；用户安装的插件不运行它。`npm run dev` 监听源码。TypeScript 源码位于 `src/`，esbuild 将 pdf-lib 和 CSS 后备资源内嵌；构建只需分发 `main.js`、`manifest.json`、`styles.css`。`snippets/` 是可选独立布局，`examples/` 为合成示例，`tests/` 不使用个人笔记。

原生测试会启动隐藏的独立 Electron 测试窗口，在 `output/` 输出截图、PDF 和报告。它验证真实 Chromium 打印和样式，不等同于真实 Obsidian 实时预览验收。

修改版本时同步 `package.json`、lockfile、`manifest.json`、`versions.json` 和 CHANGELOG。推送与 manifest 版本一致的 tag（例如 `2.2.2`）后，GitHub Actions 构建、测试并创建**草稿 Release**，上传三个安装文件；人工审阅后再公开。发布前按 [RELEASING.md](RELEASING.md) 核对作者、唯一 ID、实际桌面验收和 Community Directory 扫描。

## License

[MIT](LICENSE)。第三方依赖许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

# FreeMarkdown 文档范围更新

## 产品定位

FreeMarkdown 参考 Typora 在 Markdown 编辑器上的低干扰交互、即时预览和文档阅读体验，但不承诺 Typora 级完整 WYSIWYG，也不复制其实现或引入其依赖。V1.0 的所见即所得仍采用 CodeMirror decorations，并始终保留 Markdown 源码语义。

## 版本边界

- **V0.1**：源码编辑、CommonMark/GFM 预览、Shiki（含 YAML/YML）、多 Tab、UTF-8 文件、三套主题、Undo/Redo、原生菜单/拖拽和基础统计。V0.1 的 `mermaid` fence 按普通代码块显示。
- **V0.5**：Mermaid 图表、KaTeX 公式、多编码、CJK 排版、文档内搜索替换、导出、外部文件监听、大文件策略，以及侧栏 Markdown 标题大纲导航。
- **V1.0**：有限 WYSIWYG、工作区文件目录/文件树、正文内 TOC、全局搜索、命令面板和完整设置。

## Mermaid

Mermaid 是正式支持的扩展格式，使用 ` ```mermaid ` fenced code block。V0.5 开始调用 Mermaid.js，按需渲染、主题跟随并在失败时回退显示源码；V0.1 不执行图表脚本，避免影响核心编辑性能和安全边界。

## 侧栏

侧栏按版本拆分为三个独立能力：

1. V0.1：侧栏容器与显示/隐藏。
2. V0.5：当前文档标题大纲，点击标题定位源码，不修改文档内容。
3. V1.0：打开工作区后的递归文件目录、过滤和文件操作。

侧栏大纲不等同于 Markdown 正文中的 `[TOC]`；正文 TOC 生成属于 V1.0。

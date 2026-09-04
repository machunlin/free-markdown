# FreeMarkdown 高层设计文档（HLD）

| 字段 | 值 |
|---|---|
| 文档版本 | V1.0 |
| 创建日期 | 2026-09-03 |
| 关联 PRD | PRD-FreeMarkdown-v3.0.md |
| 技术方案 | Tauri 2 + React 19 + CodeMirror 6 + markdown-it |
| 文档状态 | 发布 |

---

## 1. 系统概述

FreeMarkdown 是一款面向 macOS 中文技术用户的免费 Markdown 编辑器。本文档为高层设计（HLD），描述系统整体架构、模块边界、数据流、接口契约和技术决策，作为低层设计（LLD）和编码的依据。

### 1.1 设计目标

| 目标 | 指标 |
|---|---|
| 冷启动 | < 1.5s |
| 预览渲染延迟 | < 100ms（< 1MB 文档） |
| 10MB 文件 | 可编辑（Large File Mode） |
| 内存占用 | < 300MB（单文档） |
| 包体积 | < 15MB |

### 1.2 设计原则

1. **前后端分离**——React 负责全部 UI 和编辑器逻辑；Rust 仅负责需要原生能力的操作（文件 IO、编码检测、文件监听、系统集成）。
2. **单一编辑器引擎**——全程使用 CodeMirror 6，不引入 ProseMirror，WYSIWYG 通过 decorations 实现。
3. **插件化渲染管线**——markdown-it 插件链，按兼容性分层启用/禁用。
4. **渐进增强**——V0.1 → V0.5 → V1.0 逐步增加功能，每个版本可独立交付。
5. **降级安全**——所有增强功能（WYSIWYG、Mermaid、KaTeX）在失败时退回纯文本/源码显示。

---

## 2. 系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri 2 主进程 (Rust)                    │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  FileService  │  │ EncodingSvc   │  │  FileWatcher     │  │
│  │  (文件读写)    │  │ (编码检测/转换)│  │  (外部修改检测)   │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  WindowMgr   │  │  ClipboardMgr │  │  SystemMenu      │  │
│  │  (窗口管理)    │  │ (剪贴板)      │  │  (原生菜单)       │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ExportSvc   │  │  SQLiteStore  │  │  ShellCmd        │  │
│  │ (PDF导出)     │  │ (元数据存储)   │  │  (Finder等)      │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│          Tauri IPC Bridge (invoke / event)                  │
├─────────────────────────────────────────────────────────────┤
│                     WebView (Chromium/WKWebView)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    React 19 UI 层                    │   │
│  │  TabBar │ Toolbar │ Sidebar │ StatusBar │ Panes     │   │
│  │  CommandPalette │ SettingsPanel │ ThemePanel       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                  编辑器引擎层                         │   │
│  │  CodeMirror 6 (EditorView + EditorState)           │   │
│  │  ├─ MarkdownLanguage (语法高亮)                     │   │
│  │  ├─ DecorationPlugin (WYSIWYG)                      │   │
│  │  ├─ SearchPlugin (搜索替换)                         │   │
│  │  ├─ HistoryField (Undo/Redo 1000步)                 │   │
│  │  ├─ CompletionPlugin (自动补全)                     │   │
│  │  ├─ FoldPlugin (代码折叠)                           │   │
│  │  └─ LineNumberPlugin (行号)                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                Markdown 渲染管线                     │   │
│  │  markdown-it                                        │   │
│  │  ├─ CommonMark parser                               │   │
│  │  ├─ GFM plugin (表格/任务列表/删除线)                │   │
│  │  ├─ KaTeX plugin (数学公式)                         │   │
│  │  ├─ Mermaid plugin (图表)                           │   │
│  │  ├─ TOC plugin (目录)                               │   │
│  │  ├─ Footnote plugin (脚注)                         │   │
│  │  ├─ Emoji plugin (Emoji)                           │   │
│  │  ├─ Iconify plugin (图标)                           │   │
│  │  └─ HTML sanitizer (安全白名单)                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                  渲染引擎层                          │   │
│  │  Shiki (代码高亮) │ KaTeX (公式) │ Mermaid (图表)   │   │
│  │  Iconify (图标)                                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                  主题引擎层                          │   │
│  │  CSS Variables → :root / .cm-* / .preview-*         │   │
│  │  ThemeStore (Zustand) → 主题JSON → CSS注入          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   状态管理层                          │   │
│  │  Zustand Stores:                                     │   │
│  │  ├─ fileStore (打开的文件/Tab/工作区)                │   │
│  │  ├─ editorStore (当前编辑器状态/光标/布局模式)         │   │
│  │  ├─ themeStore (当前主题/自定义主题列表)              │   │
│  │  ├─ settingsStore (用户设置)                         │   │
│  │  └─ searchStore (搜索状态)                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 架构分层说明

| 层级 | 职责 | 技术 | 运行环境 |
|---|---|---|---|
| **Rust 后端** | 文件 IO、编码检测、文件监听、窗口管理、PDF 导出、系统菜单、SQLite | Rust + Tauri 2 API | 原生进程 |
| **Tauri IPC** | 前后端通信桥梁 | `invoke()` / `listen()` | WebView ↔ Rust |
| **React UI 层** | 全部界面渲染和交互 | React 19 + TypeScript | WebView |
| **编辑器引擎层** | Markdown 源码编辑、语法高亮、搜索、补全、折叠、Undo/Redo | CodeMirror 6 | WebView |
| **Markdown 渲染管线** | 源码 → AST → HTML | markdown-it + 插件链 | WebView |
| **渲染引擎层** | 代码高亮、公式、图表、图标 | Shiki / KaTeX / Mermaid / Iconify | WebView |
| **主题引擎层** | CSS 变量管理、主题切换、自定义主题 | CSS Variables + Zustand | WebView |
| **状态管理层** | 全局状态（文件/编辑器/主题/设置/搜索） | Zustand | WebView |

---

## 3. 模块设计

### 3.1 模块依赖图

```
                    ┌──────────┐
                    │  App.tsx │ (根组件)
                    └────┬─────┘
           ┌────────────┼────────────┐
           ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ WindowManager│ │ TabManager│ │SidebarMgr│
     └──────┬───┘ └──────┬───┘ └──────┬───┘
            │            │            │
            ▼            ▼            │
     ┌──────────┐ ┌──────────┐        │
     │ Toolbar   │ │ EditorPane│◄──────┘
     └──────────┘ └──────┬───┘
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
        ┌──────────┐┌──────────┐┌──────────┐
        │CM6 Editor││PreviewPane││StatusBar │
        └──────┬───┘└──────┬───┘└──────────┘
               │           │
               ▼           ▼
        ┌──────────┐┌──────────────┐
        │EditorCore││RenderPipeline│
        │(CM6 Plugins)│(markdown-it)│
        └──────────┘└──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐┌──────────┐┌──────────┐
        │  Shiki   ││  KaTeX   ││ Mermaid  │
        └──────────┘└──────────┘└──────────┘
```

### 3.2 核心模块职责

#### 3.2.1 Rust 后端模块

| 模块 | 职责 | Tauri Commands |
|---|---|---|
| FileService | 文件读取、写入、创建、删除、重命名 | `read_file`, `write_file`, `create_file`, `delete_file`, `rename_file` |
| EncodingService | 编码检测、编码转换 | `detect_encoding`, `convert_encoding` |
| FileWatcher | 监听文件变化、触发事件 | `watch_file`, `unwatch_file` → 事件 `file_changed` |
| WindowManager | 窗口创建、聚焦、关闭 | `new_window`, `close_window` |
| ClipboardManager | 富文本剪贴板操作 | `read_clipboard`, `write_clipboard`, `write_rich_text` |
| ExportService | PDF 导出 | `export_pdf` |
| SystemMenu | 原生菜单栏配置 | `setup_menu` |
| SQLiteStore | 文档元数据、最近文件、版本快照 | `query_db`, `execute_db` |
| ShellCommand | Finder 定位、在 Finder 中显示 | `show_in_finder`, `reveal_path` |

#### 3.2.2 前端核心模块

| 模块 | 职责 | 关键依赖 |
|---|---|---|
| WindowManager (React) | 多窗口 UI 管理、窗口状态 | Zustand `windowStore` |
| TabManager | 多 Tab 管理、拖拽排序、右键菜单 | `@dnd-kit/core` |
| EditorPane | 编辑器面板容器、布局模式切换 | CodeMirror 6 |
| EditorCore | CodeMirror 6 实例管理、插件注册 | `@codemirror/*` |
| PreviewPane | 预览渲染容器、滚动同步 | markdown-it |
| RenderPipeline | markdown-it 实例、插件链管理 | `markdown-it` + 插件 |
| ThemeEngine | 主题加载、CSS 变量注入、切换 | Zustand `themeStore` |
| FileTree | 侧边栏文件树、工作区管理 | `react-arborist` |
| SearchPanel | 文档内搜索、全局搜索 | CodeMirror search API |
| CommandPalette | `⌘⇧P` 命令面板 | 自研组件 |
| StatusBar | 底部状态栏 | Zustand `editorStore` |

---

## 4. 数据流设计

### 4.1 文件打开流程

```
用户 ⌘O / 拖拽文件
    │
    ▼
React: TabManager.openFile(path)
    │
    ▼
Tauri invoke('read_file', { path })
    │
    ▼
Rust: FileService.read_file(path)
    │  ├─ 读取文件字节
    │  ├─ EncodingService.detect_encoding(bytes) → { encoding, confidence }
    │  ├─ 按检测编码解码为字符串
    │  └─ 返回 { content, encoding, confidence, mtime }
    │
    ▼
React: fileStore.addTab({ path, content, encoding, mtime })
    │
    ▼
EditorCore: 创建 CodeMirror EditorState
    │  ├─ content → Doc
    │  ├─ 注册插件 (语言/高亮/搜索/历史/折叠)
    │  └─ EditorView.update(state)
    │
    ▼
RenderPipeline: render(content) → HTML
    │
    ▼
PreviewPane: 更新 innerHTML
    │
    ▼
StatusBar: 更新字数/编码/保存状态
```

### 4.2 实时预览渲染流程

```
用户输入字符
    │
    ▼
CodeMirror: dispatch transaction
    │
    ▼
EditorView.update() → doc 变化
    │
    ├─→ EditorCore: 增量更新语法高亮 (debounce 50ms)
    │
    └─→ RenderPipeline: 增量渲染 (debounce 100ms)
         │
         ├─ 文档 < 1MB: 全量 markdown-it.render(doc)
         │
         ├─ 文档 1-5MB: 仅渲染可视区域对应源码段
         │
         └─ 文档 > 10MB: Large File Mode → 不自动渲染
         │
         ▼
    PreviewPane: 更新 HTML (diff patch DOM)
         │
         ▼
    滚动同步: 根据光标位置同步预览区滚动
         │
         ▼
    StatusBar: 更新字数统计
```

### 4.3 文件保存流程

```
用户 ⌘S / 自动保存触发
    │
    ▼
React: fileStore.saveFile(tabId)
    │
    ├─ 获取当前 EditorView.doc.toString()
    │
    ▼
Tauri invoke('write_file', { path, content, encoding })
    │
    ▼
Rust: FileService.write_file(path, content, encoding)
    │  ├─ 按指定编码编码字符串为字节
    │  ├─ 写入临时文件 (path.tmp)
    │  ├─ 原子重命名 (path.tmp → path)
    │  └─ 返回 { success, mtime }
    │
    ▼
React: fileStore.updateTab(tabId, { saved: true, mtime })
    │
    ▼
标题栏: 移除 ● 修改标记
    │
    ▼
版本历史 (V1.5): 创建快照
```

### 4.4 外部文件修改检测流程

```
Rust: FileWatcher 监听到 path 的 mtime 变化
    │
    ▼
Tauri event: 'file_changed' { path, newMtime, newSize }
    │
    ▼
React: fileStore 收到事件
    │
    ├─ 当前文档是否有未保存修改？
    │   │
    │   ├─ 否 → 重新加载文件 (静默)
    │   │        ├─ read_file(path)
    │   │        └─ EditorView.dispatch({ changes: { from: 0, to: doc.length, insert: newContent } })
    │   │
    │   └─ 是 → 弹窗 [重新加载] [保留当前修改] [比较差异]
    │            ├─ 重新加载 → 同上
    │            ├─ 保留 → 标记 tab.conflictResolved = true
    │            └─ 比较差异 → 打开 Diff 视图 (V1.5)
```

### 4.5 主题切换流程

```
用户选择主题 / ⌘⌥T
    │
    ▼
themeStore.setTheme(themeId)
    │
    ▼
ThemeEngine: 加载主题 JSON
    │
    ├─ 预置主题: 从内置 themes/*.json 加载
    ├─ 自定义主题: 从 Application Support/themes/*.fmtheme 加载
    │
    ▼
ThemeEngine: 转换为主题 CSS 变量
    │
    ▼
注入 :root 和 .cm-editor 和 .preview-container
    │  --fm-bg: #ffffff
    │  --fm-text: #333333
    │  --fm-heading-color: #222222
    │  --fm-code-bg: #1e1e1e
    │  --fm-link-color: #0066cc
    │  ...
    │
    ▼
CodeMirror: 重新加载语法高亮主题 (Shiki)
    │
    ▼
200ms CSS 过渡动画
```

### 4.6 编辑模式切换流程

```
用户 ⌘1 / ⌘2 / ⌘3 / ⌘4
    │
    ▼
editorStore.setLayoutMode(mode)
    │
    ├─ 'edit-only':
    │   ├─ EditorPane: flex 100%
    │   └─ PreviewPane: display none
    │
    ├─ 'preview-only':
    │   ├─ EditorPane: display none
    │   └─ PreviewPane: flex 100%
    │
    ├─ 'split' (默认):
    │   ├─ EditorPane: flex 50% (可调 30%-70%)
    │   └─ PreviewPane: flex 50%
    │
    └─ 'wysiwyg' (V1.0):
        ├─ EditorPane: flex 100%
        └─ DecorationPlugin: 启用行内渲染装饰
            ├─ 标题 → 大字号 + 字重
            ├─ 加粗 → font-weight: bold
            ├─ 代码 → 背景色 + 等宽字体
            ├─ 链接 → 蓝色 + 下划线
            └─ 图片 → 内联渲染
```

---

## 5. 接口设计

### 5.1 Tauri IPC 接口（Rust → 前端）

所有前端调用 Rust 的接口通过 `@tauri-apps/api` 的 `invoke()` 调用。

#### 5.1.1 文件操作接口

```typescript
// 读取文件
interface ReadFileRequest { path: string }
interface ReadFileResponse {
  content: string
  encoding: string
  confidence: number  // 0-100
  mtime: number       // Unix timestamp
  size: number        // bytes
}
invoke('read_file', { path: string }): Promise<ReadFileResponse>

// 写入文件（原子写入）
interface WriteFileRequest {
  path: string
  content: string
  encoding: string
}
interface WriteFileResponse { success: boolean; mtime: number }
invoke('write_file', { path, content, encoding }): Promise<WriteFileResponse>

// 创建文件
invoke('create_file', { dir: string, name: string }): Promise<string>  // 返回新文件路径

// 删除文件（移至废纸篓）
invoke('delete_file', { path: string }): Promise<boolean>

// 重命名文件
invoke('rename_file', { oldPath: string, newPath: string }): Promise<boolean>

// 列出目录
interface ListDirRequest { path: string; showAll?: boolean }
interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mtime: number
}
invoke('list_dir', { path, showAll }): Promise<FileEntry[]>
```

#### 5.1.2 编码接口

```typescript
// 检测编码
interface EncodingResult {
  encoding: string      // "UTF-8" | "GBK" | "GB18030" | "Big5" | ...
  confidence: number    // 0-100
  alternatives: { encoding: string; confidence: number }[]
}
invoke('detect_encoding', { path: string }): Promise<EncodingResult>

// 转换编码（重新以指定编码打开）
invoke('read_file_with_encoding', { path: string, encoding: string }): Promise<ReadFileResponse>

// 获取支持的编码列表
invoke('list_encodings'): Promise<string[]>
```

#### 5.1.3 文件监听接口

```typescript
// 监听文件变化
invoke('watch_file', { path: string }): Promise<number>  // 返回 watcher ID
invoke('unwatch_file', { id: number }): Promise<void>

// 事件监听（前端）
interface FileChangedEvent {
  path: string
  newMtime: number
  newSize: number
  deleted: boolean
  renamed: boolean
  newPath?: string
}
listen('file_changed', (event: FileChangedEvent) => void)
```

#### 5.1.4 导出接口

```typescript
// 导出 PDF
interface ExportPdfRequest {
  html: string       // 渲染后的 HTML
  css: string        // 主题 CSS
  options: {
    pageSize: 'A4' | 'A3' | 'Letter'
    margin: { top: number; bottom: number; left: number; right: number }
    includeToc: boolean
    includePageNumbers: boolean
    header?: string
    footer?: string
  }
}
invoke('export_pdf', request): Promise<string>  // 返回保存路径

// 导出 HTML
interface ExportHtmlRequest {
  html: string
  css: string
  inlineAssets: boolean
}
invoke('export_html', request): Promise<string>
```

#### 5.1.5 系统集成接口

```typescript
// 在 Finder 中显示
invoke('show_in_finder', { path: string }): Promise<void>

// 复制文件路径
invoke('copy_path', { path: string }): Promise<void>

// 新建窗口
invoke('new_window'): Promise<void>

// 获取系统外观
invoke('get_system_appearance'): Promise<'light' | 'dark'>

// 监听系统外观变化
listen('appearance_changed', (event: { appearance: 'light' | 'dark' }) => void)
```

### 5.2 前端内部接口（TypeScript 类型定义）

#### 5.2.1 文件/Tab 状态

```typescript
interface Tab {
  id: string              // UUID
  filePath: string | null // null = 未保存文件
  fileName: string        // 显示名
  content: string         // 文档内容
  encoding: string        // "UTF-8" | "GBK" | ...
  saved: boolean          // 是否已保存
  modified: boolean       // 是否有未保存修改
  mtime: number          // 文件最后修改时间
  cursorPos: number       // 光标位置
  scrollTop: number       // 滚动位置
  pinned: boolean         // 是否固定
  conflictResolved: boolean // 外部修改是否已处理
}

interface Workspace {
  rootPath: string
  fileTree: FileTreeNode[]
}

interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
  expanded?: boolean
}
```

#### 5.2.2 编辑器状态

```typescript
type LayoutMode = 'edit-only' | 'preview-only' | 'split' | 'wysiwyg'

interface EditorState {
  activeTabId: string | null
  layoutMode: LayoutMode
  splitRatio: number       // 0.3 - 0.7
  fontSize: number         // 编辑区字号
  previewFontSize: number  // 预览区字号
  showSidebar: boolean
  showToolbar: boolean
  showStatusBar: boolean
  showOutline: boolean
  fullscreen: boolean
  largeFileMode: boolean
}
```

#### 5.2.3 主题状态

```typescript
interface Theme {
  id: string
  name: string
  isBuiltin: boolean
  isDark: boolean
  config: ThemeConfig
}

interface ThemeConfig {
  font: {
    body: string
    heading: string
    code: string
    size: number
    codeSize: number
    lineHeight: number
    letterSpacing: number
    paragraphSpacing: number
    weight: number
  }
  colors: {
    background: string
    text: string
    heading: string[]
    link: string
    linkHover: string
    codeBg: string
    codeText: string
    quoteText: string
    quoteBorder: string
    tableHeaderBg: string
    tableBorderColor: string
    tableZebraBg: string
  }
  page: {
    maxWidth: number
    padding: number
  }
  table: {
    style: 'simple' | 'zebra' | 'grid' | 'borderless'
    headerBg: string
    borderColor: string
    zebra: boolean
    cellPadding: number
    borderRadius: number
  }
  image: {
    maxWidth: number  // percentage
    centered: boolean
    borderRadius: number
    shadow: 'none' | 'light' | 'medium' | 'dark'
    clickToZoom: boolean
  }
  codeHighlight: string  // Shiki theme name
}
```

#### 5.2.4 设置状态

```typescript
interface Settings {
  general: {
    startupMode: 'last-file' | 'blank' | 'recent'
    defaultEncoding: string
    lineEnding: 'LF' | 'CRLF'
    language: 'zh-CN' | 'en'
    cjkFallbackFont: string
    imageCopyStrategy: 'keep-path' | 'doc-assets' | 'workspace-assets' | 'ask'
    markdownCompatibility: 'strict' | 'gfm' | 'extended'
    autoSave: boolean
  }
  editor: {
    showLineNumbers: boolean
    wordWrap: boolean
    tabSize: number
    insertSpaces: boolean
    codeFolding: boolean
    showWhitespace: boolean
    cursorStyle: 'line' | 'underline' | 'block'
    cursorBlink: boolean
    fontSize: number
  }
  preview: {
    liveRefresh: boolean
    fontSize: number
    codeLineNumbers: boolean
    codeFolding: boolean
    imageLazyLoad: boolean
    mathEngine: 'katex' | 'mathjax'
    mermaidThemeFollow: boolean
    footnoteRender: boolean
    taskListInteractive: boolean
    emojiRender: boolean
    iconifyRender: boolean
    autoLink: boolean
    lineBreak: 'soft' | 'hard'
  }
  largeFile: {
    threshold: number  // bytes, default 10MB
    autoEnable: boolean
  }
  undo: {
    maxSteps: number  // default 1000
  }
  keybindings: Record<string, string>  // action → shortcut
}
```

---

## 6. 编辑器引擎设计（CodeMirror 6）

### 6.1 CodeMirror 6 扩展架构

```
EditorState.create({
  doc: content,
  extensions: [
    // === 基础 ===
    EditorView.lineWrapping,           // 自动换行
    EditorState.tabSize.of(2),         // Tab 大小
    EditorView.theme(baseTheme),      // 基础主题

    // === 语言 ===
    markdown(),                        // CodeMirror Markdown 语言支持
    languages,                         // 代码块嵌套语言支持

    // === 语法高亮 ===
    syntaxHighlighting(markdownHighlightStyle),

    // === 编辑增强 ===
    history({ depth: 1000 }),          // Undo/Redo 栈
    searchKeymap,                      // 搜索替换
    autocompletion,                    // 自动补全
    foldGutter(),                      // 代码折叠
    lineNumbers(),                     // 行号
    highlightActiveLine(),             // 当前行高亮
    highlightActiveLineGutter(),
    bracketMatching(),

    // === 快捷键 ===
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...foldKeymap,
      ...customKeymap,                 // 自定义快捷键
    ]),

    // === WYSIWYG (V1.0) ===
    decorationPlugin,                  // 行内渲染装饰

    // === 滚动同步 ===
    scrollSyncPlugin,                  // 与预览区双向同步

    // === 文档变化监听 ===
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onDocChange(update)
      }
    }),
  ]
})
```

### 6.2 WYSIWYG Decoration 插件设计（V1.0）

```typescript
// 核心思路：遍历 Markdown 语法树，为每种元素添加 Decoration
// 底层仍为 Markdown 源码，光标和撤销栈天然正确

const decorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const widgets: Range<Decoration>[] = []
      const tree = syntaxTree(view.state)

      tree.iterate({
        enter(node) {
          switch (node.name) {
            case 'ATXHeading':
              // 为标题文本添加大字号 + 字重 Decoration
              widgets.push(Decoration.mark({
                attributes: { class: 'cm-wysiwyg-heading' },
                style: `font-size: ${headingSize(level)}px; font-weight: 600;`
              }).range(node.from, node.to))
              break

            case 'Emphasis':
              widgets.push(Decoration.mark({
                style: 'font-style: italic;'
              }).range(node.from, node.to))
              break

            case 'StrongEmphasis':
              widgets.push(Decoration.mark({
                style: 'font-weight: bold;'
              }).range(node.from, node.to))
              break

            case 'InlineCode':
              widgets.push(Decoration.mark({
                class: 'cm-wysiwyg-code',
                style: 'background: var(--fm-code-bg); font-family: var(--fm-code-font);'
              }).range(node.from, node.to))
              break

            case 'Link':
              widgets.push(Decoration.mark({
                style: 'color: var(--fm-link-color); text-decoration: underline;'
              }).range(node.from, node.to))
              break
          }
        }
      })

      return Decoration.set(widgets, true)
    }
  },
  {
    decorations: v => v.decorations
  }
)
```

**降级安全：** 如果 decoration 构建失败（如语法树解析异常），catch 错误并返回空 DecorationSet，编辑器退回纯源码模式。

### 6.3 滚动同步设计

```
编辑区滚动 → debounce(30ms) → 计算当前可视区域首行 → 查找预览区对应元素 → 预览区 scrollTo()
预览区滚动 → debounce(30ms) → 计算当前可视元素 → 查找编辑区对应行 → 编辑区 scrollTo()
```

实现方式：
1. 编辑区：CodeMirror `ViewPlugin` 监听 `scrollDOM` 滚动事件。
2. 预览区：监听容器 `scroll` 事件。
3. 映射表：维护 `sourceLine → previewElementId` 的映射，在每次渲染后更新。
4. 防循环：标记当前正在同步的一方，避免互相触发。

---

## 7. Markdown 渲染管线设计

### 7.1 markdown-it 插件链

```typescript
import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import emoji from 'markdown-it-emoji'
import deflist from 'markdown-it-deflist'

// 自定义插件
import tocPlugin from './plugins/toc'
import mermaidPlugin from './plugins/mermaid'
import katexPlugin from './plugins/katex'
import iconifyPlugin from './plugins/iconify'
import imageSizePlugin from './plugins/image-size'
import htmlSanitizer from './plugins/html-sanitizer'

function createRenderer(compatibility: 'strict' | 'gfm' | 'extended'): MarkdownIt {
  const md = new MarkdownIt({
    html: compatibility !== 'strict',  // HTML 支持
    linkify: true,                     // 自动链接
    typographer: true,
    breaks: false,                     // soft break
  })

  // GFM 层
  if (compatibility !== 'strict') {
    md.use(taskLists, { enabled: true, label: true })
    md.use(footnote)
    md.use(deflist)
  }

  // Extended 层
  if (compatibility === 'extended') {
    md.use(katexPlugin)
    md.use(mermaidPlugin)
    md.use(tocPlugin)
    md.use(emoji)
    md.use(iconifyPlugin)
    md.use(imageSizePlugin)
  }

  // 安全层（始终启用）
  md.use(htmlSanitizer)

  return md
}
```

### 7.2 自定义插件设计

#### 7.2.1 Mermaid 插件

```typescript
// 将 ```mermaid 代码块替换为 <div class="mermaid"> 容器
// 异步渲染：预览区渲染后调用 mermaid.run() 渲染图表
// 失败降级：显示源码 + 错误信息

const mermaidPlugin: MarkdownIt.PluginSimple = (md) => {
  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx]
    if (token.info === 'mermaid') {
      const code = token.content
      return `<div class="mermaid" data-source="${escapeHtml(code)}">${code}</div>`
    }
    return defaultFence(tokens, idx, options, env, self)
  }
}
```

#### 7.2.2 KaTeX 插件

```typescript
// 行内公式 $...$ → <span class="math-inline" data-tex="..."></span>
// 块级公式 $$...$$ → <div class="math-block" data-tex="..."></div>
// 预览区渲染后调用 katex.render() 填充
```

#### 7.2.3 TOC 插件

```typescript
// [TOC] 或 [[toc]] → 收集所有标题 → 生成目录树 HTML
// 目录项带锚点 id，可点击跳转
// 标题变化时自动重新生成
```

#### 7.2.4 HTML Sanitizer

```typescript
// 白名单标签
const ALLOWED_TAGS = [
  'sub', 'sup', 'kbd', 'u', 'mark',
  'details', 'summary', 'abbr',
  'dl', 'dt', 'dd'
]

// 禁止标签（移除）
const FORBIDDEN_TAGS = [
  'script', 'iframe', 'object', 'embed',
  'form', 'input', 'style', 'link', 'meta'
]

// 白名单属性
const ALLOWED_ATTRS = ['class', 'title', 'alt', 'colspan', 'rowspan', 'id']
```

### 7.3 渲染性能策略

| 文档大小 | 策略 | 实现 |
|---|---|---|
| < 1MB | 全量渲染 | `md.render(doc)` 全量替换 |
| 1-5MB | 增量渲染 | 仅渲染可视区域对应段落；debounce 200ms |
| 5-10MB | 虚拟滚动 | 预览区仅渲染可视 DOM 节点 |
| > 10MB | Large File Mode | 关闭 Mermaid/KaTeX 实时渲染；预览手动刷新 |

---

## 8. 主题引擎设计

### 8.1 CSS 变量体系

```css
:root {
  /* === 背景与文本 === */
  --fm-bg: #ffffff;
  --fm-text: #333333;
  --fm-text-secondary: #666666;

  /* === 标题 === */
  --fm-h1-color: #222222;
  --fm-h1-size: 28px;
  --fm-h1-weight: 600;
  --fm-h2-color: #222222;
  --fm-h2-size: 24px;
  /* ... H3-H6 ... */

  /* === 链接 === */
  --fm-link-color: #0066cc;
  --fm-link-hover: #004499;

  /* === 代码 === */
  --fm-code-bg: #f5f5f5;
  --fm-code-text: #c7254e;
  --fm-code-font: 'JetBrains Mono', monospace;
  --fm-code-size: 14px;
  --fm-code-block-bg: #1e1e1e;
  --fm-code-block-radius: 6px;

  /* === 引用 === */
  --fm-quote-text: #666666;
  --fm-quote-border: #dddddd;

  /* === 表格 === */
  --fm-table-header-bg: #f5f5f5;
  --fm-table-border: #dddddd;
  --fm-table-zebra-bg: #fafafa;

  /* === 页面 === */
  --fm-page-max-width: 800px;
  --fm-page-padding: 40px;

  /* === 字体 === */
  --fm-font-body: -apple-system, 'PingFang SC', sans-serif;
  --fm-font-heading: -apple-system, 'PingFang SC', sans-serif;
  --fm-font-size: 16px;
  --fm-line-height: 1.7;
  --fm-letter-spacing: 0px;
  --fm-paragraph-spacing: 1em;

  /* === 图片 === */
  --fm-image-max-width: 100%;
  --fm-image-radius: 4px;

  /* === UI === */
  --fm-ui-bg: #f0f0f0;
  --fm-ui-border: #d0d0d0;
  --fm-ui-text: #333333;
  --fm-ui-accent: #007aff;
}
```

### 8.2 主题加载流程

```
1. 应用启动
   → settingsStore.load() → 读取 settings.json
   → themeStore.load() → 读取当前主题 ID
   → 如果是预置主题 → 从内置 JSON 加载
   → 如果是自定义主题 → 从 Application Support/themes/ 加载
   → ThemeEngine.applyTheme(config) → 生成 CSS → 注入 :root

2. 主题切换
   → themeStore.setTheme(id)
   → ThemeEngine.applyTheme(config)
   → 更新 CSS 变量 → 200ms 过渡

3. 跟随系统外观
   → 监听 appearance_changed 事件
   → 根据当前外观选择对应主题
   → ThemeEngine.applyTheme(config)
```

---

## 9. 状态管理设计

### 9.1 Zustand Store 架构

```typescript
// fileStore: 文件和 Tab 管理
interface FileStore {
  tabs: Tab[]
  activeTabId: string | null
  workspace: Workspace | null
  recentFiles: RecentFile[]

  // Actions
  openFile: (path: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  saveFile: (tabId: string) => Promise<void>
  switchTab: (tabId: string) => void
  moveTab: (from: number, to: number) => void  // 拖拽排序
  pinTab: (tabId: string) => void
  updateContent: (tabId: string, content: string) => void
  loadWorkspace: (path: string) => Promise<void>
  handleExternalChange: (path: string) => Promise<void>
}

// editorStore: 编辑器状态
interface EditorStore {
  layoutMode: LayoutMode
  splitRatio: number
  showSidebar: boolean
  showToolbar: boolean
  showStatusBar: boolean
  showOutline: boolean
  fullscreen: boolean
  largeFileMode: boolean

  setLayoutMode: (mode: LayoutMode) => void
  setSplitRatio: (ratio: number) => void
  toggleSidebar: () => void
  toggleFullscreen: () => void
}

// themeStore: 主题管理
interface ThemeStore {
  themes: Theme[]
  currentThemeId: string
  lightThemeId: string  // 跟随系统时的浅色主题
  darkThemeId: string    // 跟随系统时的深色主题
  followSystem: boolean

  setTheme: (id: string) => void
  createTheme: (baseId: string, name: string) => string
  updateTheme: (id: string, config: ThemeConfig) => void
  deleteTheme: (id: string) => void
  exportTheme: (id: string) => string  // 返回 JSON
  importTheme: (json: string) => string
}

// settingsStore: 用户设置
interface SettingsStore {
  settings: Settings
  load: () => Promise<void>
  save: () => Promise<void>
  update: (path: string, value: any) => void
  resetKeybinding: (action: string) => void
  resetAllKeybindings: () => void
}
```

### 9.2 数据持久化

```
~/Library/Application Support/FreeMarkdown/
├── settings.json          # 用户设置
├── themes/                # 自定义主题
│   ├── my-theme.fmtheme
│   └── writing-dark.fmtheme
├── keybindings.json       # 快捷键配置
├── drafts/                # 草稿（自动恢复）
│   └── <uuid>.md
├── versions/              # 版本历史快照
│   └── <file-hash>/
│       ├── 0001.md
│       └── 0002.md
├── templates/             # 自定义模板
│   └── my-template.md
└── freemarkdown.db        # SQLite（元数据、最近文件）
```

---

## 10. 项目结构设计

```
freemarkdown/
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs             # Tauri 入口
│   │   ├── commands/           # Tauri 命令
│   │   │   ├── mod.rs
│   │   │   ├── file.rs         # 文件操作
│   │   │   ├── encoding.rs     # 编码检测/转换
│   │   │   ├── watcher.rs      # 文件监听
│   │   │   ├── export.rs       # 导出
│   │   │   ├── clipboard.rs    # 剪贴板
│   │   │   ├── shell.rs        # 系统集成
│   │   │   └── db.rs           # SQLite
│   │   ├── services/           # 业务逻辑
│   │   │   ├── mod.rs
│   │   │   ├── file_service.rs
│   │   │   ├── encoding_service.rs
│   │   │   └── export_service.rs
│   │   └── models/            # 数据模型
│   │       ├── mod.rs
│   │       └── file.rs
│   ├── Cargo.toml
│   └── tauri.conf.json        # Tauri 配置
│
├── src/                        # React 前端
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 根组件
│   ├── components/             # UI 组件
│   │   ├── layout/            # 布局
│   │   │   ├── MainWindow.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── SplitPane.tsx
│   │   ├── editor/            # 编辑器
│   │   │   ├── EditorPane.tsx
│   │   │   ├── PreviewPane.tsx
│   │   │   ├── Outline.tsx
│   │   │   └── Breadcrumb.tsx
│   │   ├── theme/             # 主题
│   │   │   ├── ThemePanel.tsx
│   │   │   ├── ThemeEditor.tsx
│   │   │   └── ThemePreview.tsx
│   │   ├── search/            # 搜索
│   │   │   ├── SearchBar.tsx
│   │   │   └── GlobalSearch.tsx
│   │   ├── settings/          # 设置
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── EditorSettings.tsx
│   │   │   ├── PreviewSettings.tsx
│   │   │   └── KeybindingSettings.tsx
│   │   ├── command/           # 命令面板
│   │   │   └── CommandPalette.tsx
│   │   ├── filetree/          # 文件树
│   │   │   └── FileTree.tsx
│   │   └── common/            # 通用组件
│   │       ├── Dialog.tsx
│   │       ├── Dropdown.tsx
│   │       └── Icon.tsx
│   ├── editor/                # CodeMirror 6 核心
│   │   ├── EditorCore.ts      # 编辑器实例管理
│   │   ├── extensions/         # CM6 扩展
│   │   │   ├── wysiwyg.ts     # WYSIWYG decorations
│   │   │   ├── scrollSync.ts  # 滚动同步
│   │   │   ├── autocomplete.ts
│   │   │   └── keymap.ts      # 自定义快捷键
│   │   └── themes/            # CM6 主题
│   │       └── codemirror-theme.ts
│   ├── renderer/              # Markdown 渲染管线
│   │   ├── RenderPipeline.ts  # markdown-it 实例管理
│   │   ├── plugins/           # 自定义插件
│   │   │   ├── mermaid.ts
│   │   │   ├── katex.ts
│   │   │   ├── toc.ts
│   │   │   ├── iconify.ts
│   │   │   ├── image-size.ts
│   │   │   └── html-sanitizer.ts
│   │   └── shiki/             # 代码高亮
│   │       └── highlighter.ts
│   ├── theme/                 # 主题引擎
│   │   ├── ThemeEngine.ts
│   │   ├── themeToCss.ts
│   │   └── builtin/           # 预置主题
│   │       ├── office-light.json
│   │       ├── dark-night.json
│   │       ├── code-reader.json
│   │       ├── focus-writer.json
│   │       ├── minimal-gray.json
│   │       └── academic.json
│   ├── stores/                # Zustand 状态
│   │   ├── fileStore.ts
│   │   ├── editorStore.ts
│   │   ├── themeStore.ts
│   │   ├── settingsStore.ts
│   │   └── searchStore.ts
│   ├── hooks/                 # React Hooks
│   │   ├── useEditor.ts
│   │   ├── useTheme.ts
│   │   ├── useFileWatcher.ts
│   │   └── useLargeFile.ts
│   ├── types/                 # TypeScript 类型
│   │   ├── index.ts
│   │   ├── tab.ts
│   │   ├── theme.ts
│   │   └── settings.ts
│   ├── utils/                 # 工具函数
│   │   ├── encoding.ts
│   │   ├── file.ts
│   │   ├── markdown.ts
│   │   └── cjk.ts
│   └── styles/                # 全局样式
│       ├── global.css
│       ├── variables.css
│       └── themes.css
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 11. 安全设计

| 层面 | 措施 |
|---|---|
| 文件访问 | 仅用户明确操作时读写文件；不访问沙箱外路径 |
| HTML 渲染 | 白名单标签 + 属性过滤；禁用 script/iframe 等 |
| 外部链接 | 可设置点击前二次确认 |
| 剪贴板 | 不自动将文件内容写入剪贴板 |
| 自动保存 | 草稿写入 Application Support，不污染用户目录 |
| 网络请求 | Mermaid/KaTeX/Iconify 资源优先本地打包；Iconify 图标可离线 |
| 文件监听 | 仅监听已打开的文件；关闭 Tab 时取消监听 |

---

## 12. 性能设计

### 12.1 渲染优化

| 优化点 | 方案 |
|---|---|
| 预览增量更新 | DOM diff patch，仅更新变化部分 |
| Mermaid 异步渲染 | Web Worker 中渲染，不阻塞主线程 |
| KaTeX 异步渲染 | 按需渲染可视区域公式 |
| 图片懒加载 | IntersectionObserver，仅加载可视区域图片 |
| 虚拟滚动 | 大文件时编辑区和预览区均虚拟滚动 |
| 防抖 | 输入到预览 debounce 100ms；滚动同步 debounce 30ms |

### 12.2 内存优化

| 优化点 | 方案 |
|---|---|
| Tab 数量限制 | 最大 20 个；非活跃 Tab 释放预览 DOM |
| 大文件 | Large File Mode 关闭实时渲染 |
| Mermaid 缓存 | 相同图表源码不重复渲染 |
| Shiki 预加载 | 启动时预加载常用语言 grammar |

---

## 13. 开发里程碑与 HLD 映射

| 里程碑 | HLD 涉及模块 | 可验收状态 |
|---|---|---|
| V0.1 Alpha | §2 架构、§3.2.1 Rust 文件/窗口、§6.1-6.2 CM6 基础+滚动同步、§7.1 markdown-it 基础、§8.1 CSS 变量基础、§9 状态管理基础、§10 项目结构 | 可编辑+预览+保存+多 Tab+3 主题 |
| V0.5 Beta | §5.1.2 编码接口、§5.1.3 文件监听、§7.2 Mermaid/KaTeX 插件、§12.1 渲染优化、§4.4 外部检测流程 | 多编码+扩展格式+导出+大文件 |
| V1.0 | §6.2 WYSIWYG Decoration、§4.6 模式切换、§3.2.2 完整前端模块、§8 完整主题引擎 | 产品级发布 |

---

## 14. 风险与缓解

| 编号 | 风险 | 缓解措施 |
|---|---|---|
| H-R01 | Tauri 2 macOS API 变动 | 封装 Tauri API 为内部接口层，隔离变更 |
| H-R02 | CodeMirror 6 WYSIWYG decoration 复杂度 | V1.0 才实现；V0.1 先验证纯源码+预览；降级为纯源码 |
| H-R03 | markdown-it 插件兼容性 | 插件链按兼容性分层；Extended 层插件可独立禁用 |
| H-R04 | 大文件内存溢出 | Large File Mode 自动降级；虚拟滚动；Tab 限制 |
| H-R05 | Mermaid/KaTeX 渲染阻塞主线程 | Web Worker 异步渲染 |
| H-R06 | 编码检测误判 | 置信度机制 + 用户手动选择 |

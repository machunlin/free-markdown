# FreeMarkdown 低层设计文档（LLD）

| 字段 | 值 |
|---|---|
| 文档版本 | V1.0 |
| 创建日期 | 2026-09-03 |
| 关联文档 | PRD-FreeMarkdown-v3.0.md / HLD-FreeMarkdown-v1.0.md |
| 技术方案 | Tauri 2 + React 19 + CodeMirror 6 + markdown-it |
| 文档状态 | 发布 |

---

## 1. Rust 后端详细设计

### 1.1 文件服务 (file_service.rs)

#### 1.1.1 数据结构

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileResponse {
    pub content: String,
    pub encoding: String,
    pub confidence: f32,
    pub mtime: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
    pub encoding: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteFileResponse {
    pub success: bool,
    pub mtime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime: u64,
}
```

#### 1.1.2 文件读取逻辑

```rust
pub fn read_file(path: &str) -> Result<ReadFileResponse, String> {
    let path = Path::new(path);

    // 1. 读取文件字节
    let bytes = std::fs::read(path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("读取元数据失败: {}", e))?;

    // 2. 检测编码
    let encoding_result = detect_encoding(&bytes);

    // 3. 按检测编码解码
    let content = decode_bytes(&bytes, &encoding_result.encoding)
        .map_err(|e| format!("解码失败: {}", e))?;

    // 4. 处理 BOM
    let content = strip_bom(content, &encoding_result.encoding);

    Ok(ReadFileResponse {
        content,
        encoding: encoding_result.encoding,
        confidence: encoding_result.confidence,
        mtime: metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0),
        size: metadata.len(),
    })
}
```

#### 1.1.3 文件写入逻辑（原子写入）

```rust
pub fn write_file(req: WriteFileRequest) -> Result<WriteFileResponse, String> {
    let path = Path::new(&req.path);
    let tmp_path = path.with_extension("fm_tmp");

    // 1. 编码字符串为字节
    let bytes = encode_string(&req.content, &req.encoding)
        .map_err(|e| format!("编码失败: {}", e))?;

    // 2. 写入临时文件
    std::fs::write(&tmp_path, &bytes)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 3. 原子重命名
    std::fs::rename(&tmp_path, path)
        .map_err(|e| {
            // 清理临时文件
            let _ = std::fs::remove_file(&tmp_path);
            format!("重命名失败: {}", e)
        })?;

    // 4. 获取新 mtime
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("读取元数据失败: {}", e))?;

    Ok(WriteFileResponse {
        success: true,
        mtime: metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0),
    })
}
```

#### 1.1.4 目录列表

```rust
pub fn list_dir(path: &str, show_all: bool) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(path);
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(path)
        .map_err(|e| format!("读取目录失败: {}", e))?
    {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        // 隐藏文件过滤
        if !show_all && name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| format!("读取元数据失败: {}", e))?;

        // 只显示 .md/.markdown/.mdx/.txt 文件和目录
        let is_md = is_markdown_file(&name);
        if !metadata.is_dir() && !is_md {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            mtime: metadata.modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0),
        });
    }

    // 排序：目录在前，然后按名称排序
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

fn is_markdown_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
        || lower.ends_with(".mdx") || lower.ends_with(".txt")
}
```

#### 1.1.5 删除文件（移至废纸篓）

```rust
pub fn delete_file(path: &str) -> Result<bool, String> {
    // macOS: 使用 NSWorkspace.recycleURLs 移至废纸篓
    // 通过 cocoa crate 或 objc 调用
    // 降级方案：直接删除（需二次确认）
    trash::delete(path)
        .map_err(|e| format!("删除失败: {}", e))?;
    Ok(true)
}
```

### 1.2 编码检测服务 (encoding_service.rs)

#### 1.2.1 编码检测逻辑

```rust
use chardetng::EncodingDetector;

#[derive(Debug, Serialize)]
pub struct EncodingResult {
    pub encoding: String,
    pub confidence: f32,  // 0.0 - 1.0
    pub alternatives: Vec<EncodingCandidate>,
}

#[derive(Debug, Serialize)]
pub struct EncodingCandidate {
    pub encoding: String,
    pub confidence: f32,
}

pub fn detect_encoding(bytes: &[u8]) -> EncodingResult {
    let mut detector = EncodingDetector::new();

    // 喂入文件内容（最多前 64KB 用于检测）
    let sample = if bytes.len() > 65536 {
        &bytes[..65536]
    } else {
        bytes
    };

    detector.feed(sample, true);

    // 获取最可能的编码
    let (encoding, confidence, contains_8bit) = detector.guess_assess(None, true);

    let encoding_name = encoding.name().to_uppercase();

    // 获取候选编码列表
    let alternatives = get_encoding_alternatives(&encoding_name, confidence);

    EncodingResult {
        encoding: normalize_encoding_name(&encoding_name),
        confidence,
        alternatives,
    }
}

fn normalize_encoding_name(name: &str) -> String {
    match name {
        "UTF-8" => "UTF-8".to_string(),
        "GB18030" => "GB18030".to_string(),
        "SHIFT_JIS" => "Shift-JIS".to_string(),
        "EUC-KR" => "EUC-KR".to_string(),
        "BIG5" => "Big5".to_string(),
        "UTF-16LE" => "UTF-16 LE".to_string(),
        "UTF-16BE" => "UTF-16 BE".to_string(),
        _ => name.to_string(),
    }
}

fn get_encoding_alternatives(primary: &str, confidence: f32) -> Vec<EncodingCandidate> {
    // 如果主检测是 UTF-8 且置信度高，无候选
    // 如果置信度低，返回其他可能的编码
    let mut alts = Vec::new();

    if primary != "UTF-8" {
        alts.push(EncodingCandidate {
            encoding: "UTF-8".to_string(),
            confidence: 0.3,
        });
    }

    // CJK 互斥候选
    match primary {
        "GB18030" => {
            alts.push(EncodingCandidate {
                encoding: "Shift-JIS".to_string(),
                confidence: 0.2,
            });
        }
        "Shift-JIS" => {
            alts.push(EncodingCandidate {
                encoding: "GB18030".to_string(),
                confidence: 0.2,
            });
        }
        _ => {}
    }

    alts
}
```

#### 1.2.2 编码转换逻辑

```rust
use encoding_rs::*;

pub fn decode_bytes(bytes: &[u8], encoding: &str) -> Result<String, String> {
    let encoder = get_encoder(encoding)
        .ok_or_else(|| format!("不支持的编码: {}", encoding))?;

    let (string, _, had_errors) = encoder.decode(bytes);

    if had_errors {
        // 有替换字符但仍然返回（部分可读）
        Ok(string.to_string())
    } else {
        Ok(string.to_string())
    }
}

pub fn encode_string(string: &str, encoding: &str) -> Result<Vec<u8>, String> {
    let encoder = get_encoder(encoding)
        .ok_or_else(|| format!("不支持的编码: {}", encoding))?;

    let (bytes, _, had_errors) = encoder.encode(string);

    if had_errors {
        return Err(format!("编码 {} 时存在无法表示的字符", encoding));
    }

    Ok(bytes.to_vec())
}

fn get_encoder(encoding: &str) -> Option<&'static Encoding> {
    match encoding.to_uppercase().as_str() {
        "UTF-8" => Some(UTF_8),
        "GBK" => Some(GBK),
        "GB18030" => Some(GB18030),
        "BIG5" => Some(BIG5),
        "SHIFT-JIS" | "SHIFT_JIS" => Some(SHIFT_JIS),
        "EUC-KR" | "EUC_KR" => Some(EUC_KR),
        "UTF-16 LE" | "UTF-16LE" => Some(UTF_16LE),
        "UTF-16 BE" | "UTF-16BE" => Some(UTF_16BE),
        "ASCII" => Some(ASCII),
        _ => None,
    }
}

fn strip_bom(content: String, encoding: &str) -> String {
    if encoding == "UTF-8" && content.starts_with('\u{FEFF}') {
        content[3..].to_string()
    } else {
        content
    }
}
```

### 1.3 文件监听服务 (watcher.rs)

```rust
use std::sync::Arc;
use tauri::Manager;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use notify_debouncer_full::{new_debouncer, DebouncedEvent};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

pub struct FileWatcherService {
    watchers: Arc<Mutex<HashMap<u32, DebouncedEvent>>>,
    next_id: Arc<Mutex<u32>>,
}

impl FileWatcherService {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }

    pub fn watch_file(&self, path: &str, app_handle: &tauri::AppHandle) -> Result<u32, String> {
        let mut id_lock = self.next_id.lock().unwrap();
        let watcher_id = *id_lock;
        *id_lock += 1;
        drop(id_lock);

        let app_handle = app_handle.clone();
        let path_string = path.to_string();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500), // 防抖 500ms
            move |result: Result<Vec<DebouncedEvent>, _>| {
                if let Ok(events) = result {
                    for event in events {
                        let event_kind = &event.event.kind;

                        let (deleted, renamed) = match event_kind {
                            EventKind::Remove(_) => (true, false),
                            EventKind::Create(_) | EventKind::Modify(_) => (false, false),
                            _ => continue,
                        };

                        let _ = app_handle.emit("file_changed", serde_json::json!({
                            "path": path_string,
                            "newMtime": get_mtime(&path_string),
                            "newSize": get_file_size(&path_string),
                            "deleted": deleted,
                            "renamed": renamed,
                        }));
                    }
                }
            },
        ).map_err(|e| format!("创建监听失败: {}", e))?;

        debouncer.watcher()
            .watch(Path::new(path), RecursiveMode::NonRecursive)
            .map_err(|e| format!("监听文件失败: {}", e))?;

        let mut watchers = self.watchers.lock().unwrap();
        watchers.insert(watcher_id, debouncer);

        Ok(watcher_id)
    }

    pub fn unwatch_file(&self, watcher_id: u32) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(&watcher_id)
            .ok_or_else(|| format!("监听器 {} 不存在", watcher_id))?;
        Ok(())
    }
}
```

### 1.4 导出服务 (export_service.rs)

```rust
use std::process::Command;

pub fn export_pdf(html: &str, css: &str, options: ExportPdfOptions) -> Result<String, String> {
    // 方案：使用 WebView 渲染 HTML → 打印为 PDF
    //
    // 1. 创建临时 HTML 文件（内联 CSS + HTML）
    // 2. 使用 macOS 原生 wkhtmltopdf 或 WKWebView print
    // 3. 保存到用户选择的路径

    let full_html = format!(r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>{css}</style>
<style>
  @page {{
    size: {page_size};
    margin: {margin_top}mm {margin_right}mm {margin_bottom}mm {margin_left}mm;
  }}
  {page_numbers_css}
</style>
</head>
<body>
{html}
</body>
</html>"#,
        css = css,
        html = html,
        page_size = options.page_size,
        margin_top = options.margin.top,
        margin_right = options.margin.right,
        margin_bottom = options.margin.bottom,
        margin_left = options.margin.left,
        page_numbers_css = if options.include_page_numbers {
            r#"@page { @bottom-right { content: counter(page); } }"#
        } else { "" }
    );

    // 写入临时文件
    let tmp_path = std::env::temp_dir().join("freemarkdown_export.html");
    std::fs::write(&tmp_path, &full_html)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 使用 Tauri 的 dialog 让用户选择保存路径
    let save_path = tauri::api::dialog::blocking::FileDialogBuilder::new()
        .set_title("导出 PDF")
        .add_filter("PDF", &["pdf"])
        .set_file_name("document.pdf")
        .save_file()
        .ok_or_else(|| "用户取消了导出".to_string())?;

    // 使用 macOS 原生打印为 PDF
    // 方案 A: 通过 WKWebView (Swift)
    // 方案 B: 使用 headless Chrome / puppeteer
    // 方案 C: 使用 wkhtmltopdf（需要安装）
    // 推荐: Tauri WebView print API

    Ok(save_path.to_string_lossy().to_string())
}
```

### 1.5 Tauri 命令注册 (main.rs)

```rust
mod commands;
mod services;

use services::file_service::FileService;
use services::encoding_service::EncodingService;
use services::file_watcher::FileWatcherService;

fn main() {
    tauri::Builder::default()
        .manage(FileWatcherService::new())
        .invoke_handler(tauri::generate_handler![
            commands::file::read_file,
            commands::file::write_file,
            commands::file::create_file,
            commands::file::delete_file,
            commands::file::rename_file,
            commands::file::list_dir,
            commands::encoding::detect_encoding,
            commands::encoding::read_file_with_encoding,
            commands::encoding::list_encodings,
            commands::watcher::watch_file,
            commands::watcher::unwatch_file,
            commands::export::export_pdf,
            commands::export::export_html,
            commands::shell::show_in_finder,
            commands::shell::copy_path,
            commands::window::new_window,
            commands::system::get_system_appearance,
        ])
        .setup(|app| {
            // 设置原生菜单
            setup_menu(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // 检查未保存的文件
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running FreeMarkdown");
}
```

---

## 2. 前端详细设计

### 2.1 应用入口 (main.tsx)

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 2.2 根组件 (App.tsx)

```tsx
import React, { useEffect } from 'react'
import { MainWindow } from './components/layout/MainWindow'
import { useSettingsStore } from './stores/settingsStore'
import { useThemeStore } from './stores/themeStore'
import { useFileStore } from './stores/fileStore'
import { useEditorStore } from './stores/editorStore'
import { useFileWatcher } from './hooks/useFileWatcher'

export default function App() {
  const loadSettings = useSettingsStore(s => s.load)
  const loadTheme = useThemeStore(s => s.load)
  const loadRecent = useFileStore(s => s.loadRecentFiles)
  const loadLastFile = useFileStore(s => s.loadLastFile)

  useEffect(() => {
    // 应用启动时加载数据
    const init = async () => {
      await loadSettings()
      await loadTheme()
      await loadRecent()
      await loadLastFile()  // 恢复上次打开的文件
    }
    init()
  }, [])

  // 监听系统外观变化
  useSystemAppearance()

  // 监听文件变化事件
  useFileWatcher()

  return <MainWindow />
}

function useSystemAppearance() {
  const followSystem = useThemeStore(s => s.followSystem)
  const setThemeByAppearance = useThemeStore(s => s.setThemeByAppearance)

  useEffect(() => {
    if (!followSystem) return

    const unlisten = listen('appearance_changed', (event) => {
      setThemeByAppearance(event.payload.appearance)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [followSystem])
}
```

### 2.3 主窗口布局 (MainWindow.tsx)

```tsx
import React from 'react'
import { TabBar } from './TabBar'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { EditorPane } from '../editor/EditorPane'
import { PreviewPane } from '../editor/PreviewPane'
import { StatusBar } from './StatusBar'
import { SplitPane } from './SplitPane'
import { CommandPalette } from '../command/CommandPalette'
import { useEditorStore } from '../../stores/editorStore'

export function MainWindow() {
  const layoutMode = useEditorStore(s => s.layoutMode)
  const splitRatio = useEditorStore(s => s.splitRatio)
  const showSidebar = useEditorStore(s => s.showSidebar)
  const showToolbar = useEditorStore(s => s.showToolbar)
  const showStatusBar = useEditorStore(s => s.showStatusBar)

  return (
    <div className="main-window">
      {showToolbar && <Toolbar />}
      <TabBar />

      <div className="main-content">
        {showSidebar && <Sidebar />}

        {layoutMode === 'edit-only' && <EditorPane flex={1} />}
        {layoutMode === 'preview-only' && <PreviewPane flex={1} />}
        {layoutMode === 'split' && (
          <SplitPane ratio={splitRatio}>
            <EditorPane />
            <PreviewPane />
          </SplitPane>
        )}
        {layoutMode === 'wysiwyg' && <EditorPane flex={1} wysiwyg />}
      </div>

      {showStatusBar && <StatusBar />}
      <CommandPalette />
    </div>
  )
}
```

### 2.4 编辑器核心 (EditorCore.ts)

```typescript
import { EditorState, EditorView, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages as cmLanguages } from '@codemirror/language-data'
import { history } from '@codemirror/commands'
import { search } from '@codemirror/search'
import { autocompletion } from '@codemirror/autocomplete'
import { lineNumbers, foldGutter } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorView as EV } from '@codemirror/view'

import { createScrollSyncExtension } from './extensions/scrollSync'
import { createWysiwygExtension } from './extensions/wysiwyg'
import { createCustomKeymap } from './extensions/keymap'
import { createCompletionSource } from './extensions/autocomplete'
import { createEditorTheme } from './themes/codemirror-theme'

export interface EditorCoreOptions {
  content: string
  onChange: (doc: string) => void
  onCursorChange: (pos: number, line: number, col: number) => void
  onScroll: (scrollTop: number) => void
  fontSize: number
  showLineNumbers: boolean
  wordWrap: boolean
  tabSize: number
  insertSpaces: boolean
  codeFolding: boolean
  wysiwyg: boolean
  maxUndoSteps: number
}

export class EditorCore {
  private view: EditorView
  private themeCompartment = new Compartment()
  private keymapCompartment = new Compartment()
  private lineNumbersCompartment = new Compartment()
  private foldCompartment = new Compartment()
  private wysiwygCompartment = new Compartment()

  constructor(parent: HTMLElement, options: EditorCoreOptions) {
    const state = EditorState.create({
      doc: options.content,
      extensions: [
        // 基础
        EV.lineWrapping,
        EV.editorAttributes.of({ spellcheck: 'false' }),
        EV.theme(createEditorTheme(options.fontSize), { dark: false }),

        // 语言
        markdown({
          base: markdownLanguage,
          codeLanguages: cmLanguages,
        }),

        // 语法高亮
        syntaxHighlighting(defaultHighlightStyle),

        // Undo/Redo
        history({ depth: options.maxUndoSteps }),

        // 搜索
        search(),

        // 自动补全
        autocompletion({
          override: [createCompletionSource()],
        }),

        // 行号（可切换）
        this.lineNumbersCompartment.of(
          options.showLineNumbers ? lineNumbers() : []
        ),

        // 代码折叠（可切换）
        this.foldCompartment.of(
          options.codeFolding ? [foldGutter()] : []
        ),

        // WYSIWYG（可切换）
        this.wysiwygCompartment.of(
          options.wysiwyg ? [createWysiwygExtension()] : []
        ),

        // 滚动同步
        createScrollSyncExtension(options.onScroll),

        // 快捷键
        this.keymapCompartment.of(createCustomKeymap()),

        // 变化监听
        EV.updateListener.of(update => {
          if (update.docChanged) {
            options.onChange(update.state.doc.toString())
          }
          if (update.selectionSet) {
            const pos = update.state.selection.main.head
            const line = update.state.doc.lineAt(pos)
            options.onCursorChange(pos, line.number, pos - line.from)
          }
        }),
      ],
    })

    this.view = new EditorView({ state, parent })
  }

  // 更新内容
  setContent(content: string) {
    const currentDoc = this.view.state.doc.toString()
    if (currentDoc === content) return

    this.view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: content,
      },
    })
  }

  // 获取内容
  getContent(): string {
    return this.view.state.doc.toString()
  }

  // 切换 WYSIWYG 模式
  setWysiwyg(enabled: boolean) {
    this.view.dispatch({
      effects: this.wysiwygCompartment.reconfigure(
        enabled ? [createWysiwygExtension()] : []
      ),
    })
  }

  // 切换行号
  setLineNumbers(enabled: boolean) {
    this.view.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(
        enabled ? [lineNumbers()] : []
      ),
    })
  }

  // 切换代码折叠
  setCodeFolding(enabled: boolean) {
    this.view.dispatch({
      effects: this.foldCompartment.reconfigure(
        enabled ? [foldGutter()] : []
      ),
    })
  }

  // 获取光标位置
  getCursor(): { line: number; col: number } {
    const pos = this.view.state.selection.main.head
    const line = this.view.state.doc.lineAt(pos)
    return { line: line.number, col: pos - line.from }
  }

  // 滚动到指定位置
  scrollTo(pos: number) {
    const line = this.view.state.doc.lineAt(pos)
    this.view.dispatch({
      effects: EV.scrollIntoView(pos, { y: 'center' }),
    })
  }

  // 包裹选中文本
  wrapSelection(prefix: string, suffix: string = prefix) {
    const { from, to } = this.view.state.selection.main
    const selectedText = this.view.state.sliceDoc(from, to)
    this.view.dispatch({
      changes: {
        from,
        to,
        insert: `${prefix}${selectedText}${suffix}`,
      },
      selection: {
        anchor: from + prefix.length,
        head: to + prefix.length,
      },
    })
  }

  // 插入文本
  insert(text: string) {
    const pos = this.view.state.selection.main.head
    this.view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    })
  }

  // 销毁
  destroy() {
    this.view.destroy()
  }
}
```

### 2.5 编辑器面板组件 (EditorPane.tsx)

```tsx
import React, { useRef, useEffect } from 'react'
import { EditorCore } from '../../editor/EditorCore'
import { useFileStore } from '../../stores/fileStore'
import { useEditorStore } from '../../stores/editorStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Breadcrumb } from './Breadcrumb'

interface EditorPaneProps {
  flex?: number
  wysiwyg?: boolean
}

export function EditorPane({ flex, wysiwyg }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorCore | null>(null)
  const activeTabId = useFileStore(s => s.activeTabId)
  const tabs = useFileStore(s => s.tabs)
  const updateContent = useFileStore(s => s.updateContent)
  const settings = useSettingsStore(s => s.settings)
  const layoutMode = useEditorStore(s => s.layoutMode)
  const fontSize = useEditorStore(s => s.fontSize)

  const activeTab = tabs.find(t => t.id === activeTabId)

  useEffect(() => {
    if (!containerRef.current || !activeTab) return

    const editor = new EditorCore(containerRef.current, {
      content: activeTab.content,
      onChange: (doc) => updateContent(activeTab.id, doc),
      onCursorChange: (pos, line, col) => {
        useEditorStore.getState().updateCursor(line, col)
      },
      onScroll: (scrollTop) => {
        // 触发预览区滚动同步
        useEditorStore.getState().setEditorScroll(scrollTop)
      },
      fontSize: fontSize,
      showLineNumbers: settings.editor.showLineNumbers,
      wordWrap: settings.editor.wordWrap,
      tabSize: settings.editor.tabSize,
      insertSpaces: settings.editor.insertSpaces,
      codeFolding: settings.editor.codeFolding,
      wysiwyg: wysiwyg || layoutMode === 'wysiwyg',
      maxUndoSteps: settings.undo.maxSteps,
    })

    editorRef.current = editor

    return () => editor.destroy()
  }, [activeTabId]) // 仅在 Tab 切换时重建

  // 外部内容变化时更新编辑器（文件恢复等）
  useEffect(() => {
    if (editorRef.current && activeTab) {
      const currentDoc = editorRef.current.getContent()
      if (currentDoc !== activeTab.content) {
        editorRef.current.setContent(activeTab.content)
      }
    }
  }, [activeTab?.content])

  return (
    <div className="editor-pane" style={{ flex: flex || 1 }}>
      <Breadcrumb />
      <div ref={containerRef} className="editor-container" />
    </div>
  )
}
```

### 2.6 预览面板组件 (PreviewPane.tsx)

```tsx
import React, { useRef, useEffect, useMemo } from 'react'
import { RenderPipeline } from '../../renderer/RenderPipeline'
import { useFileStore } from '../../stores/fileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useEditorStore } from '../../stores/editorStore'
import { useLargeFile } from '../../hooks/useLargeFile'

interface PreviewPaneProps {
  flex?: number
}

export function PreviewPane({ flex }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeTabId = useFileStore(s => s.activeTabId)
  const tabs = useFileStore(s => s.tabs)
  const settings = useSettingsStore(s => s.settings)
  const editorScroll = useEditorStore(s => s.editorScroll)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const { isLargeFile, shouldRender } = useLargeFile(activeTab?.content || '')

  // 创建渲染管线（按兼容性设置）
  const renderer = useMemo(() => {
    return new RenderPipeline({
      compatibility: settings.general.markdownCompatibility,
      mathEngine: settings.preview.mathEngine,
      mermaidThemeFollow: settings.preview.mermaidThemeFollow,
      footnoteRender: settings.preview.footnoteRender,
      emojiRender: settings.preview.emojiRender,
      iconifyRender: settings.preview.iconifyRender,
      autoLink: settings.preview.autoLink,
      lineBreak: settings.preview.lineBreak,
    })
  }, [settings.general.markdownCompatibility, settings.preview])

  // 渲染内容
  useEffect(() => {
    if (!containerRef.current || !activeTab) return
    if (!shouldRender) return // Large File Mode 下不自动渲染

    const render = () => {
      const html = renderer.render(activeTab.content)
      if (containerRef.current) {
        containerRef.current.innerHTML = html
        // 后处理：渲染 Mermaid / KaTeX
        renderer.postProcess(containerRef.current)
      }
    }

    // debounce 100ms
    const timer = setTimeout(render, 100)
    return () => clearTimeout(timer)
  }, [activeTab?.content, renderer, shouldRender])

  // 滚动同步
  useEffect(() => {
    if (!containerRef.current) return
    // 根据编辑区滚动位置同步预览区
    syncScrollToPreview(containerRef.current, editorScroll)
  }, [editorScroll])

  return (
    <div className="preview-pane" style={{ flex: flex || 1 }}>
      {isLargeFile && (
        <div className="large-file-notice">
          Large File Mode — 预览已暂停，点击刷新
        </div>
      )}
      <div
        ref={containerRef}
        className="preview-content markdown-body"
      />
    </div>
  )
}
```

### 2.7 渲染管线 (RenderPipeline.ts)

```typescript
import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import emoji from 'markdown-it-emoji'
import deflist from 'markdown-it-deflist'
import { mermaidPlugin } from './plugins/mermaid'
import { katexPlugin } from './plugins/katex'
import { tocPlugin } from './plugins/toc'
import { iconifyPlugin } from './plugins/iconify'
import { imageSizePlugin } from './plugins/image-size'
import { htmlSanitizer } from './plugins/html-sanitizer'

interface RenderPipelineOptions {
  compatibility: 'strict' | 'gfm' | 'extended'
  mathEngine: 'katex' | 'mathjax'
  mermaidThemeFollow: boolean
  footnoteRender: boolean
  emojiRender: boolean
  iconifyRender: boolean
  autoLink: boolean
  lineBreak: 'soft' | 'hard'
}

export class RenderPipeline {
  private md: MarkdownIt
  private options: RenderPipelineOptions

  constructor(options: RenderPipelineOptions) {
    this.options = options
    this.md = this.createRenderer()
  }

  private createRenderer(): MarkdownIt {
    const md = new MarkdownIt({
      html: this.options.compatibility !== 'strict',
      linkify: this.options.autoLink,
      typographer: true,
      breaks: this.options.lineBreak === 'hard',
    })

    // GFM 层
    if (this.options.compatibility !== 'strict') {
      md.use(taskLists, { enabled: true, label: true })
      if (this.options.footnoteRender) {
        md.use(footnote)
      }
      md.use(deflist)
    }

    // Extended 层
    if (this.options.compatibility === 'extended') {
      if (this.options.mathEngine === 'katex') {
        md.use(katexPlugin)
      }
      md.use(mermaidPlugin)
      md.use(tocPlugin)
      if (this.options.emojiRender) {
        md.use(emoji)
      }
      md.use(iconifyPlugin)
      md.use(imageSizePlugin)
    }

    // 安全层（始终启用）
    md.use(htmlSanitizer)

    return md
  }

  render(content: string): string {
    return this.md.render(content)
  }

  renderInline(content: string): string {
    return this.md.renderInline(content)
  }

  // 后处理：渲染 Mermaid 图表和 KaTeX 公式
  async postProcess(container: HTMLElement): Promise<void> {
    // 渲染 KaTeX
    const mathElements = container.querySelectorAll('.math-inline, .math-block')
    mathElements.forEach(el => {
      const tex = el.getAttribute('data-tex') || ''
      const isBlock = el.classList.contains('math-block')
      try {
        katex.render(tex, el, {
          displayMode: isBlock,
          throwOnError: false,
          errorColor: '#cc0000',
        })
      } catch (e) {
        el.textContent = `[公式渲染错误: ${tex}]`
      }
    })

    // 渲染 Mermaid
    const mermaidElements = container.querySelectorAll('.mermaid')
    if (mermaidElements.length > 0) {
      try {
        await (window as any).mermaid.run({
          nodes: mermaidElements,
        })
      } catch (e) {
        mermaidElements.forEach(el => {
          el.innerHTML = `<div class="mermaid-error">图表渲染失败</div><pre>${el.getAttribute('data-source')}</pre>`
        })
      }
    }
  }

  updateOptions(options: Partial<RenderPipelineOptions>) {
    this.options = { ...this.options, ...options }
    this.md = this.createRenderer()
  }
}
```

### 2.8 滚动同步扩展 (extensions/scrollSync.ts)

```typescript
import { Extension, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

export function createScrollSyncExtension(
  onScroll: (scrollTop: number) => void
): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.setupScrollListener(view)
      }

      setupScrollListener(view: EditorView) {
        view.scrollDOM.addEventListener('scroll', () => {
          const scrollTop = view.scrollDOM.scrollTop
          const scrollHeight = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight
          // 归一化滚动比例 0-1
          const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0
          onScroll(ratio)
        }, { passive: true })
      }
    }
  )
}

// 在预览区根据比例同步滚动
export function syncScrollToPreview(
  previewContainer: HTMLElement,
  editorScrollRatio: number
) {
  const scrollHeight = previewContainer.scrollHeight - previewContainer.clientHeight
  const targetTop = scrollHeight * editorScrollRatio
  previewContainer.scrollTo({ top: targetTop, behavior: 'auto' })
}
```

### 2.9 大文件 Hook (hooks/useLargeFile.ts)

```typescript
import { useMemo } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

export function useLargeFile(content: string) {
  const threshold = useSettingsStore(s => s.settings.largeFile.threshold)
  const autoEnable = useSettingsStore(s => s.settings.largeFile.autoEnable)

  const sizeBytes = useMemo(() => new Blob([content]).size, [content])
  const isLargeFile = autoEnable && sizeBytes > threshold

  // 性能分级
  const performanceTier = useMemo(() => {
    if (sizeBytes < 1_000_000) return 'full'           // < 1MB
    if (sizeBytes < 5_000_000) return 'incremental'    // 1-5MB
    if (sizeBytes < 10_000_000) return 'virtual'       // 5-10MB
    return 'large-file'                                 // > 10MB
  }, [sizeBytes])

  const shouldRender = !isLargeFile || performanceTier !== 'large-file'

  return {
    isLargeFile,
    performanceTier,
    shouldRender,
    sizeMB: (sizeBytes / 1_000_000).toFixed(2),
  }
}
```

### 2.10 Tab 管理器 (TabBar.tsx)

```tsx
import React from 'react'
import { useFileStore } from '../../stores/fileStore'
import { useEditorStore } from '../../stores/editorStore'

export function TabBar() {
  const tabs = useFileStore(s => s.tabs)
  const activeTabId = useFileStore(s => s.activeTabId)
  const switchTab = useFileStore(s => s.switchTab)
  const closeTab = useFileStore(s => s.closeTab)
  const moveTab = useFileStore(s => s.moveTab)

  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  return (
    <div className="tab-bar">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab ${activeTabId === tab.id ? 'active' : ''} ${tab.pinned ? 'pinned' : ''}`}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null && dragIndex !== index) {
              moveTab(dragIndex, index)
            }
            setDragIndex(null)
          }}
          onClick={() => switchTab(tab.id)}
        >
          {tab.pinned && <span className="pin-icon">📌</span>}
          {!tab.pinned && (
            <>
              <span className="tab-name">{tab.fileName}</span>
              {tab.modified && <span className="modified-dot">●</span>}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
```

### 2.11 文件状态管理 (stores/fileStore.ts)

```typescript
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { v4 as uuid } from 'uuid'

interface FileStore {
  tabs: Tab[]
  activeTabId: string | null
  workspace: Workspace | null
  recentFiles: RecentFile[]

  openFile: (path: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  saveFile: (tabId: string) => Promise<void>
  switchTab: (tabId: string) => void
  moveTab: (from: number, to: number) => void
  pinTab: (tabId: string) => void
  updateContent: (tabId: string, content: string) => void
  loadRecent: () => Promise<void>
  loadLastFile: () => Promise<void>
  loadWorkspace: (path: string) => Promise<void>
  handleExternalChange: (path: string) => Promise<void>
}

export const useFileStore = create<FileStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  workspace: null,
  recentFiles: [],

  openFile: async (path) => {
    // 检查是否已打开
    const existing = get().tabs.find(t => t.filePath === path)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }

    // 读取文件
    const result = await invoke('read_file', { path })
    const tab: Tab = {
      id: uuid(),
      filePath: path,
      fileName: path.split('/').pop() || '未命名',
      content: result.content,
      encoding: result.encoding,
      saved: true,
      modified: false,
      mtime: result.mtime,
      cursorPos: 0,
      scrollTop: 0,
      pinned: false,
      conflictResolved: false,
    }

    set(state => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }))

    // 监听文件变化
    await invoke('watch_file', { path })
  },

  closeTab: async (tabId) => {
    const tab = get().tabs.find(t => t.id === tabId)
    if (!tab) return

    // 有未保存修改时弹窗确认
    if (tab.modified) {
      const confirmed = await showUnsavedDialog(tab.fileName)
      if (confirmed === 'cancel') return
      if (confirmed === 'save') {
        await get().saveFile(tabId)
      }
    }

    // 取消文件监听
    if (tab.filePath) {
      // invoke('unwatch_file', { path: tab.filePath })
    }

    set(state => {
      const newTabs = state.tabs.filter(t => t.id !== tabId)
      const newActive = newTabs.length > 0
        ? (state.activeTabId === tabId
            ? newTabs[newTabs.length - 1].id
            : state.activeTabId)
        : null
      return { tabs: newTabs, activeTabId: newActive }
    })
  },

  saveFile: async (tabId) => {
    const tab = get().tabs.find(t => t.id === tabId)
    if (!tab) return

    if (!tab.filePath) {
      // 未保存文件，弹出保存对话框
      const path = await showSaveDialog(tab.fileName)
      if (!path) return
      tab.filePath = path
      tab.fileName = path.split('/').pop() || tab.fileName
    }

    const result = await invoke('write_file', {
      path: tab.filePath,
      content: tab.content,
      encoding: tab.encoding,
    })

    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === tabId
          ? { ...t, saved: true, modified: false, mtime: result.mtime }
          : t
      ),
    }))
  },

  switchTab: (tabId) => {
    set({ activeTabId: tabId })
  },

  moveTab: (from, to) => {
    set(state => {
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(from, 1)
      newTabs.splice(to, 0, moved)
      return { tabs: newTabs }
    })
  },

  pinTab: (tabId) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, pinned: !t.pinned } : t
      ),
    }))
  },

  updateContent: (tabId, content) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === tabId
          ? { ...t, content, modified: true, saved: false }
          : t
      ),
    }))
  },

  loadRecent: async () => {
    // 从 SQLite 加载最近文件
    const files = await invoke('query_db', { sql: 'SELECT * FROM recent_files ORDER BY last_opened DESC LIMIT 20' })
    set({ recentFiles: files })
  },

  loadLastFile: async () => {
    // 根据设置决定启动行为
    const lastFile = get().recentFiles[0]
    if (lastFile) {
      await get().openFile(lastFile.path)
    }
  },

  loadWorkspace: async (path) => {
    const entries = await invoke('list_dir', { path, showAll: false })
    set({
      workspace: {
        rootPath: path,
        fileTree: buildFileTree(entries, path),
      },
    })
  },

  handleExternalChange: async (path) => {
    const tab = get().tabs.find(t => t.filePath === path)
    if (!tab) return

    if (!tab.modified) {
      // 无未保存修改，静默重新加载
      const result = await invoke('read_file', { path })
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === tab.id
            ? { ...t, content: result.content, mtime: result.mtime, saved: true }
            : t
        ),
      }))
    } else {
      // 有未保存修改，弹窗
      const choice = await showExternalChangeDialog(tab.fileName)
      if (choice === 'reload') {
        const result = await invoke('read_file', { path })
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === tab.id
              ? { ...t, content: result.content, mtime: result.mtime, saved: true, modified: false }
              : t
          ),
        }))
      }
      // 'keep' → 不做任何操作
      // 'diff' → 打开 Diff 视图 (V1.5)
    }
  },
}))
```

### 2.12 主题引擎 (theme/ThemeEngine.ts)

```typescript
import { ThemeConfig } from '../types/theme'

export class ThemeEngine {
  private static instance: ThemeEngine
  private styleEl: HTMLStyleElement

  private constructor() {
    this.styleEl = document.createElement('style')
    this.styleEl.id = 'fm-theme'
    document.head.appendChild(this.styleEl)
  }

  static getInstance(): ThemeEngine {
    if (!ThemeEngine.instance) {
      ThemeEngine.instance = new ThemeEngine()
    }
    return ThemeEngine.instance
  }

  applyTheme(config: ThemeConfig) {
    const css = this.themeToCss(config)
    this.styleEl.textContent = css
  }

  private themeToCss(config: ThemeConfig): string {
    const { font, colors, page, table, image, codeHighlight } = config

    return `
:root {
  --fm-bg: ${colors.background};
  --fm-text: ${colors.text};

  --fm-h1-color: ${colors.heading[0] || colors.text};
  --fm-h1-size: ${this.headingSize(1)}px;
  --fm-h1-weight: 600;
  --fm-h2-color: ${colors.heading[1] || colors.text};
  --fm-h2-size: ${this.headingSize(2)}px;
  --fm-h2-weight: 600;
  /* ... H3-H6 ... */

  --fm-link-color: ${colors.link};
  --fm-link-hover: ${colors.linkHover};

  --fm-code-bg: ${colors.codeBg};
  --fm-code-text: ${colors.codeText};
  --fm-code-font: '${font.code}', monospace;
  --fm-code-size: ${font.codeSize}px;

  --fm-quote-text: ${colors.quoteText};
  --fm-quote-border: ${colors.quoteBorder};

  --fm-table-header-bg: ${table.headerBg || colors.tableHeaderBg};
  --fm-table-border: ${table.borderColor || colors.tableBorderColor};
  --fm-table-zebra-bg: ${table.zebra ? (table.zebraBg || colors.tableZebraBg) : 'transparent'};

  --fm-font-body: '${font.body}', -apple-system, 'PingFang SC', sans-serif;
  --fm-font-heading: '${font.heading}', -apple-system, 'PingFang SC', sans-serif;
  --fm-font-size: ${font.size}px;
  --fm-line-height: ${font.lineHeight};
  --fm-letter-spacing: ${font.letterSpacing}px;
  --fm-paragraph-spacing: ${font.paragraphSpacing}em;

  --fm-page-max-width: ${page.maxWidth}px;
  --fm-page-padding: ${page.padding}px;

  --fm-image-max-width: ${image.maxWidth}%;
  --fm-image-radius: ${image.borderRadius}px;
}

.markdown-body {
  font-family: var(--fm-font-body);
  font-size: var(--fm-font-size);
  line-height: var(--fm-line-height);
  letter-spacing: var(--fm-letter-spacing);
  color: var(--fm-text);
  background: var(--fm-bg);
  max-width: var(--fm-page-max-width);
  padding: var(--fm-page-padding);
  margin: 0 auto;
}

.markdown-body h1 { color: var(--fm-h1-color); font-size: var(--fm-h1-size); font-weight: var(--fm-h1-weight); }
.markdown-body h2 { color: var(--fm-h2-color); font-size: var(--fm-h2-size); font-weight: var(--fm-h2-weight); }
/* ... H3-H6 ... */

.markdown-body a { color: var(--fm-link-color); }
.markdown-body a:hover { color: var(--fm-link-hover); }

.markdown-body code {
  background: var(--fm-code-bg);
  color: var(--fm-code-text);
  font-family: var(--fm-code-font);
  font-size: var(--fm-code-size);
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-body pre {
  background: var(--fm-code-block-bg, #1e1e1e);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}

.markdown-body blockquote {
  color: var(--fm-quote-text);
  border-left: 3px solid var(--fm-quote-border);
  padding-left: 1em;
  margin: 1em 0;
}

.markdown-body table {
  border-collapse: collapse;
  width: 100%;
}
.markdown-body th {
  background: var(--fm-table-header-bg);
  font-weight: 600;
}
.markdown-body td, .markdown-body th {
  border: 1px solid var(--fm-table-border);
  padding: 8px 12px;
}
.markdown-body tr:nth-child(even) {
  background: var(--fm-table-zebra-bg);
}

.markdown-body img {
  max-width: var(--fm-image-max-width);
  border-radius: var(--fm-image-radius);
}
    `
  }

  private headingSize(level: number): number {
    const sizes = [28, 24, 20, 18, 16, 14]
    return sizes[level - 1] || 16
  }
}
```

### 2.13 命令面板 (CommandPalette.tsx)

```tsx
import React, { useState, useEffect, useMemo } from 'react'

interface Command {
  id: string
  title: string
  shortcut?: string
  action: () => void
  keywords?: string[]
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // 注册命令
  const commands: Command[] = useMemo(() => [
    { id: 'new-file', title: '新建文件', shortcut: '⌘N', action: () => newFile(), keywords: ['new', 'file', '创建'] },
    { id: 'open-file', title: '打开文件', shortcut: '⌘O', action: () => openFile(), keywords: ['open', 'file'] },
    { id: 'save-file', title: '保存文件', shortcut: '⌘S', action: () => saveFile(), keywords: ['save', '保存'] },
    { id: 'export-pdf', title: '导出 PDF', shortcut: '⌘⇧E', action: () => exportPdf(), keywords: ['export', 'pdf', '导出'] },
    { id: 'export-html', title: '导出 HTML', action: () => exportHtml(), keywords: ['export', 'html'] },
    { id: 'switch-theme', title: '切换主题', shortcut: '⌘⌥T', action: () => switchTheme(), keywords: ['theme', '主题'] },
    { id: 'toggle-sidebar', title: '切换侧边栏', shortcut: '⌘\\', action: () => toggleSidebar(), keywords: ['sidebar', '侧边栏'] },
    { id: 'layout-edit', title: '仅编辑模式', shortcut: '⌘1', action: () => setLayout('edit-only'), keywords: ['layout', 'edit'] },
    { id: 'layout-preview', title: '仅预览模式', shortcut: '⌘2', action: () => setLayout('preview-only'), keywords: ['layout', 'preview'] },
    { id: 'layout-split', title: '分屏模式', shortcut: '⌘3', action: () => setLayout('split'), keywords: ['layout', 'split', '分屏'] },
    { id: 'fullscreen', title: '全屏', shortcut: '⌃⌘F', action: () => toggleFullscreen(), keywords: ['fullscreen', '全屏'] },
    { id: 'insert-table', title: '插入表格', shortcut: '⌘T', action: () => insertTable(), keywords: ['table', '表格'] },
    { id: 'encode-reload', title: '重新以编码打开', action: () => reloadWithEncoding(), keywords: ['encode', '编码'] },
    { id: 'toggle-lint', title: '切换 Markdown Lint', action: () => toggleLint(), keywords: ['lint', '检查'] },
  ], [])

  // 快捷键监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setOpen(true)
        setQuery('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // 模糊搜索
  const filtered = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase()
    return commands.filter(cmd => {
      if (cmd.title.toLowerCase().includes(q)) return true
      if (cmd.keywords?.some(k => k.includes(q))) return true
      return false
    })
  }, [commands, query])

  // 键盘导航
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action()
          setOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, selectedIndex])

  if (!open) return null

  return (
    <div className="command-palette-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <input
          className="command-input"
          autoFocus
          placeholder="输入命令..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
        />
        <div className="command-list">
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => { cmd.action(); setOpen(false) }}
            >
              <span className="command-title">{cmd.title}</span>
              {cmd.shortcut && <span className="command-shortcut">{cmd.shortcut}</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-empty">未找到匹配的命令</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## 3. 数据库设计 (SQLite)

### 3.1 表结构

```sql
-- 最近文件
CREATE TABLE IF NOT EXISTS recent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  last_opened INTEGER NOT NULL,  -- Unix timestamp
  exists_flag INTEGER DEFAULT 1   -- 1=存在, 0=缺失
);

-- 文档元数据
CREATE TABLE IF NOT EXISTS file_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  encoding TEXT DEFAULT 'UTF-8',
  last_cursor_pos INTEGER DEFAULT 0,
  last_scroll_top INTEGER DEFAULT 0,
  last_layout_mode TEXT DEFAULT 'split',
  updated_at INTEGER NOT NULL,
  UNIQUE(path)
);

-- 版本历史 (V1.5)
CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  snapshot_path TEXT NOT NULL,     -- 快照文件路径
  created_at INTEGER NOT NULL,
  is_important INTEGER DEFAULT 0,
  change_summary TEXT,
  file_size INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_recent_files_time ON recent_files(last_opened DESC);
CREATE INDEX IF NOT EXISTS idx_file_versions_path ON file_versions(file_path, created_at DESC);
```

---

## 4. 关键流程时序图

### 4.1 文件打开与编辑时序

```
用户          React UI         Tauri IPC         Rust 后端        CodeMirror
  │              │                 │                 │              │
  │─⌘O─────────→│                 │                 │              │
  │              │─openFile(path)─→│                 │              │
  │              │                 │─read_file()────→│              │
  │              │                 │                 │─detect_enc() │
  │              │                 │                 │─decode()      │
  │              │                 │←─{content,...}──│              │
  │              │←────────────────│                 │              │
  │              │─addTab()        │                 │              │
  │              │─watch_file()───→│                 │              │
  │              │                 │                 │              │
  │              │─new EditorCore()─────────────────────────────────→│
  │              │                 │                 │  EditorState │
  │              │                 │                 │  .create()   │
  │              │←─────────────────────────────────────────────────│
  │              │─render()        │                 │              │
  │              │  markdown-it    │                 │              │
  │              │→ PreviewPane     │                 │              │
  │              │                 │                 │              │
  │─输入文字────→│                 │                 │              │
  │              │─dispatch()──────────────────────────────────────→│
  │              │                 │                 │  update()    │
  │              │←─onChange(doc)──────────────────────────────────│
  │              │─updateContent()│                 │              │
  │              │─render()        │                 │              │
  │              │  (debounce 100ms)                │              │
```

### 4.2 外部文件修改检测时序

```
外部程序        Rust FileWatcher    Tauri Event      React
  │                  │                   │              │
  │─修改文件────────→│                   │              │
  │                  │─debounce 500ms    │              │
  │                  │─emit('file_changed')             │              │
  │                  │──────────────────→│              │
  │                  │                   │─listen()────→│
  │                  │                   │              │─handleExternalChange()
  │                  │                   │              │
  │                  │                   │              │─tab.modified?
  │                  │                   │              │  ├─否→read_file()→静默重载
  │                  │                   │              │  └─是→弹窗
  │                  │                   │              │      ├─重新加载→read_file()→setContent()
  │                  │                   │              │      ├─保留→标记冲突已解决
  │                  │                   │              │      └─比较差异→Diff视图(V1.5)
```

---

## 5. V0.1 Alpha 实现清单

以下为 V0.1 Alpha 需要实现的完整代码模块清单：

### 5.1 Rust 后端

| 文件 | 实现内容 |
|---|---|
| `src-tauri/src/main.rs` | Tauri 入口、命令注册、菜单设置 |
| `src-tauri/src/commands/file.rs` | `read_file`, `write_file`, `create_file`, `delete_file`, `rename_file`, `list_dir` |
| `src-tauri/src/commands/shell.rs` | `show_in_finder`, `copy_path` |
| `src-tauri/src/commands/window.rs` | `new_window` |
| `src-tauri/src/commands/system.rs` | `get_system_appearance` |
| `src-tauri/src/services/file_service.rs` | 文件读写逻辑（原子写入、BOM 处理） |
| `src-tauri/Cargo.toml` | 依赖：tauri, serde, chardetng, encoding_rs, trash, notify |
| `src-tauri/tauri.conf.json` | 窗口配置、权限配置、文件关联 |

### 5.2 前端

| 文件 | 实现内容 |
|---|---|
| `src/main.tsx` | React 入口 |
| `src/App.tsx` | 根组件、初始化 |
| `src/components/layout/MainWindow.tsx` | 主窗口布局 |
| `src/components/layout/TabBar.tsx` | 多 Tab 管理 |
| `src/components/layout/Toolbar.tsx` | 工具栏 |
| `src/components/layout/Sidebar.tsx` | 侧边栏文件树 |
| `src/components/layout/StatusBar.tsx` | 底部状态栏 |
| `src/components/layout/SplitPane.tsx` | 分屏容器 |
| `src/components/editor/EditorPane.tsx` | 编辑器面板 |
| `src/components/editor/PreviewPane.tsx` | 预览面板 |
| `src/components/editor/Breadcrumb.tsx` | 面包屑导航 |
| `src/editor/EditorCore.ts` | CodeMirror 6 实例管理 |
| `src/editor/extensions/scrollSync.ts` | 滚动同步 |
| `src/editor/extensions/keymap.ts` | 自定义快捷键 |
| `src/editor/themes/codemirror-theme.ts` | CM6 主题 |
| `src/renderer/RenderPipeline.ts` | markdown-it 渲染管线 |
| `src/theme/ThemeEngine.ts` | 主题引擎 |
| `src/theme/builtin/office-light.json` | 预置主题：办公白 |
| `src/theme/builtin/dark-night.json` | 预置主题：夜间深色 |
| `src/theme/builtin/code-reader.json` | 预置主题：程序员阅读 |
| `src/stores/fileStore.ts` | 文件/Tab 状态 |
| `src/stores/editorStore.ts` | 编辑器状态 |
| `src/stores/themeStore.ts` | 主题状态 |
| `src/stores/settingsStore.ts` | 设置状态 |
| `src/hooks/useLargeFile.ts` | 大文件检测 |
| `src/hooks/useFileWatcher.ts` | 文件监听 Hook |
| `src/types/index.ts` | TypeScript 类型定义 |
| `src/styles/global.css` | 全局样式 |
| `src/styles/variables.css` | CSS 变量 |
| `package.json` | 前端依赖 |
| `vite.config.ts` | Vite 配置 |
| `tsconfig.json` | TypeScript 配置 |

### 5.3 V0.1 验收标准

- [ ] `cargo build` 和 `npm run dev` 均成功
- [ ] 应用启动后显示空白编辑器 + 预览分屏
- [ ] `⌘O` 打开文件对话框，选择 `.md` 文件后加载到编辑器
- [ ] 编辑器语法高亮正确（CodeMirror Markdown 语言）
- [ ] 预览区实时渲染（< 100ms 延迟）
- [ ] 编辑区和预览区双向滚动同步
- [ ] `⌘S` 保存文件（原子写入）
- [ ] `⌘N` 新建 Tab
- `⌘W` 关闭 Tab（有修改时弹出确认）
- [ ] Tab 拖拽排序
- [ ] 3 个预置主题可切换
- [ ] 跟随系统 Dark/Light 模式
- [ ] 状态栏显示字数/行数/编码/保存状态
- [ ] `⌘1`/`⌘2`/`⌘3` 切换布局模式
- [ ] `\⌘` 切换侧边栏
- [ ] Undo/Redo 正确（每 Tab 独立，1000 步）
- [ ] Shiki 代码高亮 + 复制按钮
- [ ] 拖拽 `.md` 文件到窗口打开
- [ ] Finder 拖拽支持

---

## 6. V0.5 Beta 增量实现

### 6.1 新增 Rust 模块

| 文件 | 实现内容 |
|---|---|
| `src-tauri/src/commands/encoding.rs` | `detect_encoding`, `read_file_with_encoding`, `list_encodings` |
| `src-tauri/src/commands/watcher.rs` | `watch_file`, `unwatch_file` |
| `src-tauri/src/commands/export.rs` | `export_pdf`, `export_html` |
| `src-tauri/src/services/encoding_service.rs` | 编码检测（chardetng）、编码转换（encoding_rs）、BOM 处理 |
| `src-tauri/src/services/file_watcher.rs` | notify 文件监听、防抖 500ms、emit 事件 |
| `src-tauri/src/services/export_service.rs` | PDF 导出（WebView print）、HTML 导出 |

### 6.2 新增前端模块

| 文件 | 实现内容 |
|---|---|
| `src/components/editor/Outline.tsx` | 大纲导航面板 |
| `src/components/search/SearchBar.tsx` | 文档内搜索替换 |
| `src/renderer/plugins/mermaid.ts` | Mermaid 图表插件 |
| `src/renderer/plugins/katex.ts` | KaTeX 公式插件 |
| `src/renderer/plugins/toc.ts` | TOC 目录插件 |
| `src/renderer/plugins/html-sanitizer.ts` | HTML 安全白名单 |
| `src/renderer/shiki/highlighter.ts` | Shiki 代码高亮（独立于 CM6） |
| `src/utils/encoding.ts` | 编码检测、编码转换工具函数 |
| `src/utils/cjk.ts` | CJK 字体 fallback 逻辑 |
| `src/hooks/useFileWatcher.ts` | 文件变化事件监听 |
| `src/hooks/useEncoding.ts` | 编码检测 Hook |

### 6.3 编码检测对话框设计

```tsx
// EncodingSelector.tsx
interface EncodingSelectorProps {
  detected: EncodingResult
  onSelect: (encoding: string) => void
  onRemember: (encoding: string) => void
}

export function EncodingSelector({ detected, onSelect, onRemember }: EncodingSelectorProps) {
  return (
    <div className="encoding-dialog">
      <h3>编码检测</h3>
      <p>检测到以下可能的编码：</p>
      <ul>
        {detected.candidates.map(c => (
          <li key={c.encoding} className={c.confidence >= 0.9 ? 'high-confidence' : ''}>
            <span className="encoding-name">{c.encoding}</span>
            <span className="confidence-bar">
              <div style={{ width: `${c.confidence * 100}%` }} />
            </span>
            <span className="confidence-value">{Math.round(c.confidence * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button onClick={() => onSelect(detected.primary)}>
          使用 {detected.primary} {detected.confidence >= 0.9 ? '(自动)' : ''}
        </button>
        <label>
          <input type="checkbox" />
          记住此文件的编码选择
        </label>
      </div>
    </div>
  )
}
```

### 6.4 搜索替换组件设计

```tsx
// SearchBar.tsx
interface SearchState {
  visible: boolean
  query: string
  replacement: string
  caseSensitive: boolean
  regex: boolean
  wholeWord: boolean
  matchCount: number
  currentMatch: number
  replaceMode: boolean
}

export function SearchBar() {
  const [state, setState] = useState<SearchState>({
    visible: false,
    query: '',
    replacement: '',
    caseSensitive: false,
    regex: false,
    wholeWord: false,
    matchCount: 0,
    currentMatch: 0,
    replaceMode: false,
  })

  // 监听 ⌘F 打开搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setState(s => ({ ...s, visible: true }))
      }
      if (e.key === 'Escape' && state.visible) {
        setState(s => ({ ...s, visible: false, query: '' }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.visible])

  if (!state.visible) return null

  return (
    <div className="search-bar">
      <div className="search-row">
        <input
          autoFocus
          placeholder="搜索..."
          value={state.query}
          onChange={e => setState(s => ({ ...s, query: e.target.value }))}
        />
        <span className="match-info">
          {state.query ? `${state.currentMatch}/${state.matchCount}` : ''}
        </span>
        <button className="search-btn" onClick={prevMatch}>▲</button>
        <button className="search-btn" onClick={nextMatch}>▼</button>
        <button className="search-btn" onClick={() => setState(s => ({ ...s, replaceMode: !s.replaceMode }))}>
          {state.replaceMode ? '≡' : '≫'}
        </button>
        <button className="search-btn" onClick={() => setState(s => ({ ...s, visible: false }))}>×</button>
      </div>

      {state.replaceMode && (
        <div className="replace-row">
          <input
            placeholder="替换为..."
            value={state.replacement}
            onChange={e => setState(s => ({ ...s, replacement: e.target.value }))}
          />
          <button onClick={replaceOne}>替换</button>
          <button onClick={replaceAll}>全部替换</button>
        </div>
      )}

      <div className="search-options">
        <label>
          <input type="checkbox" checked={state.caseSensitive}
            onChange={e => setState(s => ({ ...s, caseSensitive: e.target.checked }))} />
          Aa
        </label>
        <label>
          <input type="checkbox" checked={state.wholeWord}
            onChange={e => setState(s => ({ ...s, wholeWord: e.target.checked }))} />
          ab
        </label>
        <label>
          <input type="checkbox" checked={state.regex}
            onChange={e => setState(s => ({ ...s, regex: e.target.checked }))} />
          .*
        </label>
      </div>
    </div>
  )
}
```

### 6.5 大文件降级策略实现

```typescript
// hooks/useLargeFile.ts (完整实现)

const PERFORMANCE_TIERS = {
  full: { threshold: 1_000_000, mermaid: true, katex: true, virtualScroll: false, preview: true },
  incremental: { threshold: 5_000_000, mermaid: true, katex: true, virtualScroll: false, preview: true },
  virtual: { threshold: 10_000_000, mermaid: true, katex: true, virtualScroll: true, preview: true },
  largeFile: { threshold: Infinity, mermaid: false, katex: false, virtualScroll: true, preview: false },
}

export function useLargeFile(content: string) {
  const threshold = useSettingsStore(s => s.settings.largeFile.threshold)
  const sizeBytes = useMemo(() => new Blob([content]).size, [content])

  const tier = useMemo(() => {
    if (sizeBytes < PERFORMANCE_TIERS.full.threshold) return 'full'
    if (sizeBytes < PERFORMANCE_TIERS.incremental.threshold) return 'incremental'
    if (sizeBytes < PERFORMANCE_TIERS.virtual.threshold) return 'virtual'
    return 'largeFile'
  }, [sizeBytes])

  const config = PERFORMANCE_TIERS[tier]

  const isLargeFile = tier === 'largeFile'
  const shouldRenderPreview = config.preview
  const shouldRenderMermaid = config.mermaid
  const shouldRenderKatex = config.katex
  const shouldUseVirtualScroll = config.virtualScroll

  return {
    isLargeFile,
    tier,
    shouldRenderPreview,
    shouldRenderMermaid,
    shouldRenderKatex,
    shouldUseVirtualScroll,
    sizeMB: (sizeBytes / 1_000_000).toFixed(2),
  }
}
```

### 6.6 V0.5 验收标准

- [ ] GBK/GB18030/Big5 文件正确打开无乱码
- [ ] 编码检测置信度机制正常（≥90% 自动，<90% 弹窗）
- [ ] 编码转换另存为正常
- [ ] CJK 字体 fallback 正确（中英日韩混排无方块）
- [ ] Mermaid 全图表类型正确渲染
- [ ] KaTeX 行内/块级公式正确渲染
- [ ] 公式/图表渲染失败降级为源码+错误提示
- [ ] TOC 自动生成且可点击跳转
- [ ] 脚注正确渲染且可跳转
- [ ] 文档内搜索替换（正则/大小写/全词）正常
- [ ] 导出 PDF 正确（含页面大小/边距/页码）
- [ ] 导出 HTML 在浏览器中效果一致
- [ ] 复制为 HTML 保留格式
- [ ] 复制为纯文本无残留符号
- [ ] 异常退出后文件草稿恢复正常
- [ ] 外部文件修改检测弹窗正常（[重新加载]/[保留]/[比较差异]）
- [ ] 10MB 文件 Large File Mode 自动启用
- [ ] 大文件模式下 Mermaid/KaTeX 关闭实时渲染
- [ ] 代码块行号、折叠、高亮指定行正常

---

## 7. V1.0 正式版增量实现

### 7.1 新增模块

| 文件 | 实现内容 |
|---|---|
| `src/editor/extensions/wysiwyg.ts` | WYSIWYG Decoration 插件 |
| `src/editor/extensions/autocomplete.ts` | 自动补全（代码语言/Emoji/文件名/标题） |
| `src/components/editor/Outline.tsx` | 大纲导航面板（完善） |
| `src/components/theme/ThemePanel.tsx` | 主题选择面板（含预览卡片） |
| `src/components/theme/ThemeEditor.tsx` | 自定义主题编辑器（V1.5） |
| `src/components/command/CommandPalette.tsx` | 命令面板 |
| `src/components/search/GlobalSearch.tsx` | 全局搜索 |
| `src/components/filetree/FileTree.tsx` | 文件树 |
| `src/components/settings/SettingsPanel.tsx` | 设置面板 |
| `src/components/settings/KeybindingSettings.tsx` | 快捷键自定义 |
| `src/renderer/plugins/emoji.ts` | Emoji 插件 |
| `src/renderer/plugins/iconify.ts` | Iconify 图标插件 |
| `src/renderer/plugins/image-size.ts` | 图片尺寸扩展 |
| `src/stores/searchStore.ts` | 搜索状态 |

### 7.2 WYSIWYG Decoration 详细实现

```typescript
// extensions/wysiwyg.ts

import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, RangeValue } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'

class WysiwygDecoration extends RangeValue {
  constructor(
    readonly style: string,
    readonly className: string,
  ) {
    super()
  }
}

export function createWysiwygExtension() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = this.compute(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.compute(update.view)
        }
      }

      compute(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<WysiwygDecoration>()
        const tree = syntaxTree(view.state)

        for (const { from, to } of view.visibleRanges) {
          tree.iterate({
            from,
            to,
            enter: (node) => {
              const type = node.type.name
              const config = WYSIWYG_STYLES[type]
              if (config) {
                // 隐藏 Markdown 标记符号，仅渲染内容
                const contentRange = this.getContentRange(type, node, view.state.doc)
                if (contentRange) {
                  builder.add(
                    contentRange.from,
                    contentRange.to,
                    new WysiwygDecoration(config.style, config.className),
                  )
                  // 隐藏标记符号
                  this.addHiddenMarkers(builder, type, node)
                }
              }
            },
          })
        }

        return builder.finish()
      }

      getContentRange(type: string, node: SyntaxNode, doc: Text): { from: number; to: number } | null {
        // 根据节点类型提取内容范围（去除标记符号）
        switch (type) {
          case 'ATXHeading': {
            // # 或 ## 等标记 → 隐藏；标题文本 → 渲染
            const text = doc.sliceString(node.from, node.to)
            const match = text.match(/^(#{1,6})\s+(.+)/)
            if (match) {
              return {
                from: node.from + match[1].length + 1, // 跳过 # 和空格
                to: node.to,
              }
            }
            return null
          }
          case 'Emphasis': {
            // *text* → 隐藏 * 符号
            return {
              from: node.from + 1,
              to: node.to - 1,
            }
          }
          case 'StrongEmphasis': {
            // **text** → 隐藏 ** 符号
            return {
              from: node.from + 2,
              to: node.to - 2,
            }
          }
          default:
            return { from: node.from, to: node.to }
        }
      }

      addHiddenMarkers(builder: RangeSetBuilder<WysiwygDecoration>, type: string, node: SyntaxNode) {
        // 用零宽度字符隐藏标记符号
        const hidden = new WysiwygDecoration(
          'display: none; overflow: hidden; width: 0;',
          'cm-wysiwyg-hidden',
        )
        switch (type) {
          case 'ATXHeading': {
            const text = node.state.doc.sliceString(node.from, node.to)
            const match = text.match(/^(#{1,6})\s+/)
            if (match) {
              builder.add(node.from, node.from + match[0].length, hidden)
            }
            break
          }
          case 'Emphasis': {
            builder.add(node.from, node.from + 1, hidden)
            builder.add(node.to - 1, node.to, hidden)
            break
          }
          case 'StrongEmphasis': {
            builder.add(node.from, node.from + 2, hidden)
            builder.add(node.to - 2, node.to, hidden)
            break
          }
        }
      }
    },
    {
      decorations: v => v.decorations,
    },
  )
}

// 元素样式映射
const WYSIWYG_STYLES: Record<string, { style: string; className: string }> = {
  ATXHeading: {
    style: 'font-size: var(--fm-h1-size); font-weight: var(--fm-h1-weight);',
    className: 'cm-wysiwyg-heading',
  },
  Heading: {
    style: 'font-size: var(--fm-h2-size); font-weight: var(--fm-h2-weight);',
    className: 'cm-wysiwyg-heading',
  },
  Emphasis: {
    style: 'font-style: italic;',
    className: 'cm-wysiwyg-emphasis',
  },
  StrongEmphasis: {
    style: 'font-weight: bold;',
    className: 'cm-wysiwyg-strong',
  },
  InlineCode: {
    style: 'background: var(--fm-code-bg); color: var(--fm-code-text); font-family: var(--fm-code-font); padding: 2px 4px; border-radius: 3px;',
    className: 'cm-wysiwyg-code',
  },
  Link: {
    style: 'color: var(--fm-link-color); text-decoration: underline;',
    className: 'cm-wysiwyg-link',
  },
}
```

### 7.3 自动补全实现

```typescript
// extensions/autocomplete.ts

import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { useFileStore } from '../../stores/fileStore'

export function createCompletionSource() {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\S*/)
    if (!word) return null

    // 代码块语言补全（输入 ``` 后）
    if (word.text.startsWith('```')) {
      return {
        from: word.from,
        options: LANGUAGES.map(lang => ({
          label: lang,
          type: 'keyword',
          detail: '代码语言',
        })),
      }
    }

    // Emoji 补全（输入 : 后）
    if (word.text.startsWith(':')) {
      return {
        from: word.from,
        options: EMOJI_LIST
          .filter(e => e.label.startsWith(word.text))
          .slice(0, 10)
          .map(e => ({
            label: e.label,
            type: 'text',
            detail: e.emoji,
          })),
      }
    }

    // 文件名补全（输入 [ 后）
    if (word.text.startsWith('[')) {
      const workspace = useFileStore.getState().workspace
      if (workspace) {
        const files = getMarkdownFiles(workspace)
        return {
          from: word.from,
          options: files.map(f => ({
            label: f.name,
            type: 'file',
            detail: f.path,
          })),
        }
      }
    }

    // 标题补全（输入 # 后）
    if (word.text.startsWith('#')) {
      const activeTab = useFileStore.getState().tabs.find(
        t => t.id === useFileStore.getState().activeTabId
      )
      if (activeTab) {
        const headings = extractHeadings(activeTab.content)
        return {
          from: word.from,
          options: headings.map(h => ({
            label: `#${h.level} ${h.text}`,
            type: 'function',
            detail: `标题跳转`,
          })),
        }
      }
    }

    return null
  }
}

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp',
  'shell', 'bash', 'sql', 'json', 'yaml', 'xml', 'html', 'css', 'scss',
  'markdown', 'dockerfile', 'swift', 'kotlin', 'php', 'ruby', 'lua', 'r',
  'graphql', 'proto', 'toml', 'ini', 'diff', 'makefile', 'cmake',
]

const EMOJI_LIST = [
  { label: ':smile:', emoji: '😀' },
  { label: ':rocket:', emoji: '🚀' },
  { label: ':fire:', emoji: '🔥' },
  { label: ':check:', emoji: '✅' },
  { label: ':x:', emoji: '❌' },
  { label: ':warning:', emoji: '⚠️' },
  { label: ':info:', emoji: 'ℹ️' },
  { label: ':bug:', emoji: '🐛' },
  { label: ':star:', emoji: '⭐' },
  { label: ':heart:', emoji: '❤️' },
  // ... 更多 Emoji
]

function extractHeadings(content: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = []
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match
  while ((match = regex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    })
  }
  return headings
}

function getMarkdownFiles(workspace: Workspace): { name: string; path: string }[] {
  const files: { name: string; path: string }[] = []
  const walk = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (!node.isDir) {
        files.push({ name: node.name, path: node.path })
      } else if (node.children) {
        walk(node.children)
      }
    }
  }
  walk(workspace.fileTree)
  return files
}
```

### 7.4 全局搜索实现

```typescript
// GlobalSearch.tsx

interface GlobalSearchResult {
  filePath: string
  fileName: string
  matches: SearchMatch[]
}

interface SearchMatch {
  line: number
  column: number
  text: string
  matchStart: number
  matchEnd: number
}

export async function globalSearch(
  query: string,
  options: SearchOptions,
  workspace: Workspace,
): Promise<GlobalSearchResult[]> {
  const results: GlobalSearchResult[] = []

  const searchFiles = async (filePath: string) => {
    try {
      const result = await invoke('read_file', { path: filePath })
      const matches = searchInContent(result.content, query, options)
      if (matches.length > 0) {
        results.push({
          filePath,
          fileName: filePath.split('/').pop() || filePath,
          matches,
        })
      }
    } catch {
      // 跳过无法读取的文件
    }
  }

  // 递归搜索工作区
  await Promise.all(walkFiles(workspace, searchFiles))

  return results
}

function searchInContent(
  content: string,
  query: string,
  options: SearchOptions,
): SearchMatch[] {
  const matches: SearchMatch[] = []
  const lines = content.split('\n')

  let regex: RegExp
  try {
    regex = new RegExp(
      options.regex ? query : escapeRegex(query),
      options.caseSensitive ? 'g' : 'gi',
    )
  } catch {
    return [] // 无效正则
  }

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(lines[i])) !== null) {
      if (options.wholeWord) {
        // 检查前后是否为词边界
        const before = match.index > 0 ? lines[i][match.index - 1] : ' '
        const after = match.index + match[0].length < lines[i].length
          ? lines[i][match.index + match[0].length] : ' '
        if (/\w/.test(before) || /\w/.test(after)) continue
      }

      matches.push({
        line: i + 1,
        column: match.index + 1,
        text: lines[i].trim(),
        matchStart: match.index,
        matchEnd: match.index + match[0].length,
      })
    }
  }

  return matches
}
```

### 7.5 Markdown Lint 实现

```typescript
// utils/markdown-lint.ts

interface LintRule {
  id: string
  name: string
  description: string
  severity: 'error' | 'warning' | 'info'
  autoFixable: boolean
  check: (content: string) => LintIssue[]
  fix?: (content: string) => string
}

interface LintIssue {
  ruleId: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

export class MarkdownLinter {
  private rules: LintRule[] = []
  private enabledRules: Set<string>

  constructor() {
    this.rules = this.registerRules()
    this.enabledRules = new Set(this.rules.map(r => r.id))
  }

  private registerRules(): LintRule[] {
    return [
      {
        id: 'MD001',
        name: '标题层级跳跃',
        description: '标题层级不能跳跃（如 H1 直接到 H3）',
        severity: 'warning',
        autoFixable: false,
        check: (content) => {
          const issues: LintIssue[] = []
          const lines = content.split('\n')
          let prevLevel = 0

          for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/^(#{1,6})\s/)
            if (match) {
              const level = match[1].length
              if (prevLevel > 0 && level > prevLevel + 1) {
                issues.push({
                  ruleId: 'MD001',
                  line: i + 1,
                  column: 1,
                  message: `标题层级从 H${prevLevel} 跳跃到 H${level}，中间缺少 H${prevLevel + 1}`,
                  severity: 'warning',
                })
              }
              prevLevel = level
            }
          }
          return issues
        },
      },

      {
        id: 'MD009',
        name: '行尾多余空格',
        description: '尾部空格不应存在',
        severity: 'info',
        autoFixable: true,
        check: (content) => {
          const issues: LintIssue[] = []
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/\s+$/)
            if (match) {
              issues.push({
                ruleId: 'MD009',
                line: i + 1,
                column: match.index! + 1,
                message: '行尾存在多余空格',
                severity: 'info',
              })
            }
          }
          return issues
        },
        fix: (content) => {
          return content.split('\n').map(line => line.trimEnd()).join('\n')
        },
      },

      {
        id: 'MD013',
        name: '行长度',
        description: '行长度不应超过配置值（默认 120）',
        severity: 'warning',
        autoFixable: false,
        check: (content, maxLength = 120) => {
          const issues: LintIssue[] = []
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            // 跳过代码块、链接、表格行
            if (lines[i].startsWith('```') || lines[i].startsWith('|') || lines[i].includes('http')) {
              continue
            }
            if (lines[i].length > maxLength) {
              issues.push({
                ruleId: 'MD013',
                line: i + 1,
                column: maxLength + 1,
                message: `行长度 ${lines[i].length} 超过 ${maxLength}`,
                severity: 'warning',
              })
            }
          }
          return issues
        },
      },

      {
        id: 'MD022',
        name: '标题上下缺少空行',
        description: '标题前后应有空行',
        severity: 'info',
        autoFixable: true,
        check: (content) => {
          const issues: LintIssue[] = []
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^#{1,6}\s/) && i > 0 && lines[i - 1].trim() !== '') {
              issues.push({
                ruleId: 'MD022',
                line: i + 1,
                column: 1,
                message: '标题上方缺少空行',
                severity: 'info',
              })
            }
          }
          return issues
        },
        fix: (content) => {
          const lines = content.split('\n')
          const result: string[] = []
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^#{1,6}\s/) && i > 0 && result[result.length - 1]?.trim() !== '') {
              result.push('')
            }
            result.push(lines[i])
          }
          return result.join('\n')
        },
      },

      {
        id: 'MD040',
        name: '代码块缺少语言标注',
        description: '代码块应标注语言',
        severity: 'info',
        autoFixable: false,
        check: (content) => {
          const issues: LintIssue[] = []
          const lines = content.split('\n')
          let inCodeBlock = false
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('```')) {
              if (!inCodeBlock && lines[i] === '```') {
                issues.push({
                  ruleId: 'MD040',
                  line: i + 1,
                  column: 1,
                  message: '代码块缺少语言标注',
                  severity: 'info',
                })
              }
              inCodeBlock = !inCodeBlock
            }
          }
          return issues
        },
      },
    ]
  }

  lint(content: string): LintIssue[] {
    const issues: LintIssue[] = []
    for (const rule of this.rules) {
      if (this.enabledRules.has(rule.id)) {
        issues.push(...rule.check(content))
      }
    }
    // 按行号排序
    issues.sort((a, b) => a.line - b.line || a.column - b.column)
    return issues
  }

  autoFix(content: string): string {
    let result = content
    for (const rule of this.rules) {
      if (this.enabledRules.has(rule.id) && rule.fix) {
        result = rule.fix(result)
      }
    }
    return result
  }

  setRuleEnabled(ruleId: string, enabled: boolean) {
    if (enabled) {
      this.enabledRules.add(ruleId)
    } else {
      this.enabledRules.delete(ruleId)
    }
  }
}
```

### 7.7 V1.0 验收标准

- [ ] WYSIWYG 模式渲染正确，切回源码保留原始语法
- [ ] 沉浸写作模式非当前段落透明度降低
- [ ] 多窗口独立运行
- [ ] 完整 6 主题 + 代码高亮主题独立切换
- [ ] TOC 自动生成且可点击跳转
- [ ] 脚注正确渲染且可跳转
- [ ] Emoji `:shortcode:` 正确渲染
- [ ] Iconify 图标正确渲染
- [ ] 图片拖拽/粘贴/管理器正常
- [ ] 图片 4 种复制策略（保持原路径/文档 assets/工作区 assets/每次询问）可选
- [ ] 全局搜索跨文件搜索正常
- [ ] 命令面板 `⌘⇧P` 模糊搜索 + 执行正常
- [ ] Markdown Lint 规则检查 + 自动修复正常
- [ ] 文档模板 6 个内置 + 自定义正常
- [ ] 快捷键自定义 + 冲突检测正常
- [ ] 快捷键无冲突（⌘1-4 编辑模式、⌘⌥1-9 Tab、⌃⌘F 全屏、⌘⌥T 主题）
- [ ] VoiceOver 可读编辑区和预览区
- [ ] WCAG 2.1 AA 对比度达标

---

## 8. 错误处理设计

### 8.1 错误分类

| 分类 | 错误类型 | 处理方式 |
|---|---|---|
| 文件 IO | 文件不存在、权限不足、磁盘满 | 弹窗提示用户，提供操作选项 |
| 编码 | 编码检测失败、编码转换失败 | 置信度机制 + 用户手动选择 |
| 渲染 | Mermaid/KaTeX 渲染失败 | 降级为源码 + 错误提示 |
| 大文件 | 内存溢出、渲染超时 | Large File Mode 自动降级 |
| 网络 | 外部链接无法访问 | 不阻塞，仅提示 |
| 格式 | Markdown 语法错误 | 不报错，按标准容错解析 |

### 8.2 全局错误边界

```tsx
// components/common/ErrorBoundary.tsx

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FreeMarkdown Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>出错了</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            重试
          </button>
          <button onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### 8.3 编辑器降级策略

```typescript
// 编辑器创建失败降级
function createEditorSafe(parent: HTMLElement, options: EditorCoreOptions): EditorCore | null {
  try {
    return new EditorCore(parent, options)
  } catch (error) {
    console.error('编辑器创建失败:', error)

    // 降级为纯文本编辑器
    const textarea = document.createElement('textarea')
    textarea.value = options.content
    textarea.style.width = '100%'
    textarea.style.height = '100%'
    textarea.style.resize = 'none'
    textarea.addEventListener('input', (e) => {
      options.onChange((e.target as HTMLTextAreaElement).value)
    })
    parent.appendChild(textarea)
    parent.classList.add('editor-degraded')

    // 通知用户
    showToast('编辑器加载失败，已降级为纯文本模式')

    return null
  }
}

// WYSIWYG decoration 失败降级
function createWysiwygSafe(): Extension {
  try {
    return createWysiwygExtension()
  } catch (error) {
    console.error('WYSIWYG 创建失败:', error)
    showToast('所见即所得模式加载失败，已退回源码模式')
    return [] // 返回空扩展
  }
}
```

---

## 9. 测试策略

### 9.1 测试分层

| 层级 | 工具 | 覆盖范围 |
|---|---|---|
| 单元测试 | vitest + @testing-library/react | 纯函数、工具函数、Hooks、Store |
| 组件测试 | @testing-library/react | 组件渲染、交互、状态变化 |
| 集成测试 | vitest + Playwright | 编辑→渲染→保存→恢复完整流程 |
| E2E 测试 | Playwright | 用户完整操作路径 |
| 性能测试 | vitest + 自定义脚本 | 大文件渲染、内存占用、启动时间 |

### 9.2 关键测试用例

```typescript
// stores/fileStore.test.ts

describe('fileStore', () => {
  it('打开文件应创建新 Tab', async () => {
    const { result } = renderHook(() => useFileStore())
    await act(async () => {
      await result.current.openFile('/test/readme.md')
    })
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.tabs[0].fileName).toBe('readme.md')
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
  })

  it('重复打开同一文件应切换到已有 Tab', async () => {
    const { result } = renderHook(() => useFileStore())
    await act(async () => { await result.current.openFile('/test/a.md') })
    await act(async () => { await result.current.openFile('/test/b.md') })
    expect(result.current.tabs).toHaveLength(2)
    await act(async () => { await result.current.openFile('/test/a.md') })
    expect(result.current.tabs).toHaveLength(2) // 不新增
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
  })

  it('关闭有修改的 Tab 应弹窗确认', async () => {
    const { result } = renderHook(() => useFileStore())
    await act(async () => { await result.current.openFile('/test/a.md') })
    result.current.updateContent(result.current.tabs[0].id, 'new content')
    expect(result.current.tabs[0].modified).toBe(true)
  })

  it('moveTab 应正确排序', () => {
    const { result } = renderHook(() => useFileStore())
    // 创建 3 个 tab
    act(() => {
      result.current.tabs = [
        { id: '1', fileName: 'a.md', ... },
        { id: '2', fileName: 'b.md', ... },
        { id: '3', fileName: 'c.md', ... },
      ]
    })
    act(() => result.current.moveTab(0, 2))
    expect(result.current.tabs.map(t => t.id)).toEqual(['2', '3', '1'])
  })
})

// renderer/RenderPipeline.test.ts

describe('RenderPipeline', () => {
  it('Compatibility: strict', () => {
    const pipeline = new RenderPipeline({ compatibility: 'strict' })
    const html = pipeline.render('# Hello\n\n**bold text**')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('<strong>bold text</strong>')
    // 不应包含 GFM 扩展
  })

  it('Compatibility: gfm', () => {
    const pipeline = new RenderPipeline({ compatibility: 'gfm' })
    const html = pipeline.render('- [x] done\n- [ ] todo')
    expect(html).toContain('checked')
    expect(html).toContain('task-list-item')
  })

  it('Compatibility: extended', () => {
    const pipeline = new RenderPipeline({ compatibility: 'extended' })
    const html = pipeline.render('$E=mc^2$')
    expect(html).toContain('math-inline')
    expect(html).toContain('data-tex')
  })

  it('HTML 安全过滤', () => {
    const pipeline = new RenderPipeline({ compatibility: 'extended' })
    const html = pipeline.render('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
  })
})

// editor/EditorCore.test.ts

describe('EditorCore', () => {
  let container: HTMLElement
  let editor: EditorCore

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    editor?.destroy()
    container.remove()
  })

  it('创建编辑器应显示内容', () => {
    editor = new EditorCore(container, {
      content: '# Hello World',
      onChange: vi.fn(),
      onCursorChange: vi.fn(),
      onScroll: vi.fn(),
      fontSize: 14,
      showLineNumbers: true,
      wordWrap: true,
      tabSize: 2,
      insertSpaces: true,
      codeFolding: true,
      wysiwyg: false,
      maxUndoSteps: 1000,
    })
    expect(container.querySelector('.cm-editor')).toBeTruthy()
    expect(editor.getContent()).toBe('# Hello World')
  })

  it('setContent 应更新内容', () => {
    editor = new EditorCore(container, { ...defaultOptions })
    editor.setContent('# New Content')
    expect(editor.getContent()).toBe('# New Content')
  })

  it('wrapSelection 应包裹选中文本', () => {
    editor = new EditorCore(container, {
      ...defaultOptions,
      content: 'hello world',
    })
    // 模拟选中 "hello"
    editor.wrapSelection('**')
    expect(editor.getContent()).toBe('**hello** world')
  })

  it('undo/redo 应正确', () => {
    editor = new EditorCore(container, {
      ...defaultOptions,
      content: 'line 1',
    })
    editor.setContent('line 1 modified')
    expect(editor.getContent()).toBe('line 1 modified')
    // 模拟 ⌘Z
    editor.undo()
    expect(editor.getContent()).toBe('line 1')
    // 模拟 ⌘⇧Z
    editor.redo()
    expect(editor.getContent()).toBe('line 1 modified')
  })
})
```

---

## 10. 打包与发布

### 10.1 构建配置

```json
// package.json
{
  "name": "freemarkdown",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@codemirror/autocomplete": "^6.x",
    "@codemirror/commands": "^6.x",
    "@codemirror/lang-markdown": "^6.x",
    "@codemirror/language": "^6.x",
    "@codemirror/language-data": "^6.x",
    "@codemirror/search": "^6.x",
    "@codemirror/state": "^6.x",
    "@codemirror/view": "^6.x",
    "@tauri-apps/api": "^2.x",
    "@tauri-apps/plugin-dialog": "^2.x",
    "@tauri-apps/plugin-fs": "^2.x",
    "@tauri-apps/plugin-shell": "^2.x",
    "katex": "^0.16.x",
    "markdown-it": "^14.x",
    "markdown-it-footnote": "^4.x",
    "markdown-it-task-lists": "^2.x",
    "markdown-it-emoji": "^3.x",
    "markdown-it-deflist": "^3.x",
    "mermaid": "^11.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "shiki": "^1.x",
    "uuid": "^10.x",
    "zustand": "^5.x"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.x",
    "@testing-library/react": "^16.x",
    "@types/katex": "^0.16.x",
    "@types/markdown-it": "^14.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@types/uuid": "^10.x",
    "eslint": "^9.x",
    "jsdom": "^25.x",
    "playwright": "^1.x",
    "typescript": "^5.x",
    "vite": "^6.x",
    "vitest": "^3.x"
  }
}
```

```toml
# src-tauri/Cargo.toml
[package]
name = "freemarkdown"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chardetng = "0.1"
encoding_rs = "0.8"
encoding_rs_io = "0.1"
notify = { version = "7", features = ["macos_kqueue"] }
notify-debouncer-full = "0.4"
trash = "5"
uuid = { version = "1", features = ["v4"] }
rusqlite = { version = "0.32", features = ["bundled"] }
chrono = "0.4"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

### 10.2 macOS 发布配置

```json
// tauri.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "title": "FreeMarkdown",
    "identifier": "com.freemarkdown.app",
    "windows": [
      {
        "title": "FreeMarkdown",
        "width": 1200,
        "height": 800,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "fullscreen": true,
        "decorations": true,
        "transparent": false,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ipc: http://ipc.localhost"
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "category": "DeveloperTool",
      "shortDescription": "Free Markdown Editor for macOS",
      "longDescription": "A free, native, high-performance Markdown editor for macOS with multi-encoding support, CJK font optimization, and deep theme customization.",
      "copyright": "MIT License",
      "fileAssociations": [
        {
          "ext": ["md", "markdown", "mdx", "txt"],
          "name": "Markdown",
          "role": "Editor"
        }
      ]
    }
  },
  "plugins": {
    "dialog": {},
    "fs": {
      "scope": ["**"]
    },
    "shell": {
      "open": true
    }
  }
}
```

---

## 11. 附录：关键数据结构完整定义

### 11.1 Tab 完整类型

```typescript
interface Tab {
  id: string                    // UUID v4
  filePath: string | null       // null = 未保存文件
  fileName: string              // 显示名（含扩展名）
  content: string               // 文档内容
  encoding: string              // UTF-8 | GBK | GB18030 | Big5 | Shift-JIS | EUC-KR | UTF-16 LE | UTF-16 BE
  saved: boolean                // 是否已保存到磁盘
  modified: boolean             // 是否有未保存修改
  mtime: number                 // 文件最后修改时间（Unix timestamp）
  cursorPos: number             // 光标位置（字符偏移）
  cursorLine: number            // 光标行号
  cursorCol: number             // 光标列号
  scrollTop: number             // 滚动位置（像素）
  scrollRatio: number           // 滚动比例（0-1，用于同步）
  pinned: boolean               // 是否固定
  conflictResolved: boolean     // 外部修改冲突是否已处理
  draftPath: string | null      // 草稿文件路径
  layoutMode: LayoutMode        // 该 Tab 的布局模式
  lastOpened: number            // 最后打开时间
}
```

### 11.2 最近文件类型

```typescript
interface RecentFile {
  path: string
  fileName: string
  lastOpened: number            // Unix timestamp
  exists: boolean               // 文件是否存在
  relativeTime: string          // 如 "3小时前"、"昨天"
}
```

### 11.3 工作区类型

```typescript
interface Workspace {
  id: string
  rootPath: string
  rootName: string              // 文件夹名
  fileTree: FileTreeNode[]
  lastOpened: number
}

interface FileTreeNode {
  id: string
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
  expanded?: boolean
  selected?: boolean
  size?: number
  mtime?: number
}
```

### 11.4 导出选项类型

```typescript
interface ExportPdfOptions {
  pageSize: 'A4' | 'A3' | 'Letter'
  margin: {
    top: number       // mm
    bottom: number
    left: number
    right: number
  }
  includeToc: boolean
  includePageNumbers: boolean
  header?: string
  footer?: string
  orientation: 'portrait' | 'landscape'
}

interface ExportHtmlOptions {
  standalone: boolean          // 独立文件 vs 资源文件夹
  inlineAssets: boolean        // 内联 CSS/JS
  includeMermaid: boolean
  includeKatex: boolean
  minify: boolean
}

interface ExportImageOptions {
  format: 'png' | 'jpeg'
  quality: number              // 0-100 (JPEG)
  scale: 1 | 2 | 3             // 分辨率倍数
  transparent: boolean         // PNG 透明背景
  trimWhitespace: boolean      // 裁剪空白
}
```

### 11.5 命令面板命令类型

```typescript
interface Command {
  id: string
  title: string                // 显示名
  category: string             // 分类：file | edit | view | export | theme | tool
  shortcut?: string            // 快捷键
  keywords: string[]           // 搜索关键词
  action: () => void | Promise<void>
  isEnabled?: () => boolean    // 当前是否可用
  icon?: string                // 图标名
}

// 命令注册
const COMMAND_REGISTRY: Command[] = [
  { id: 'file:new',       title: '新建文件',     category: 'file',   shortcut: '⌘N',     keywords: ['new', 'file'], action: newFile },
  { id: 'file:open',      title: '打开文件',     category: 'file',   shortcut: '⌘O',     keywords: ['open', 'file'], action: openFile },
  { id: 'file:save',      title: '保存',         category: 'file',   shortcut: '⌘S',     keywords: ['save', '保存'], action: saveFile },
  { id: 'file:save-as',   title: '另存为',       category: 'file',   shortcut: '⌘⇧S',   keywords: ['save as', '另存'], action: saveAs },
  { id: 'view:edit-only', title: '仅编辑模式',   category: 'view',   shortcut: '⌘1',     keywords: ['edit', '编辑'], action: () => setLayout('edit-only') },
  { id: 'view:preview-only', title: '仅预览模式', category: 'view',  shortcut: '⌘2',     keywords: ['preview', '预览'], action: () => setLayout('preview-only') },
  { id: 'view:split',     title: '分屏模式',     category: 'view',   shortcut: '⌘3',     keywords: ['split', '分屏'], action: () => setLayout('split') },
  { id: 'view:wysiwyg',   title: '所见即所得',   category: 'view',   shortcut: '⌘4',     keywords: ['wysiwyg', '所见即所得'], action: () => setLayout('wysiwyg') },
  { id: 'view:sidebar',   title: '切换侧边栏',   category: 'view',   shortcut: '⌘\\',   keywords: ['sidebar', '侧边栏'], action: toggleSidebar },
  { id: 'view:fullscreen', title: '全屏',        category: 'view',   shortcut: '⌃⌘F',   keywords: ['fullscreen', '全屏'], action: toggleFullscreen },
  { id: 'export:pdf',     title: '导出 PDF',     category: 'export', shortcut: '⌘⇧E',   keywords: ['export', 'pdf'], action: exportPdf },
  { id: 'export:html',    title: '导出 HTML',    category: 'export', keywords: ['export', 'html'], action: exportHtml },
  { id: 'export:image',   title: '导出为图片',   category: 'export', keywords: ['export', 'image', '图片'], action: exportImage },
  { id: 'edit:copy-html', title: '复制为 HTML',  category: 'edit',   shortcut: '⌘⇧C',   keywords: ['copy', 'html'], action: copyAsHtml },
  { id: 'edit:copy-text', title: '复制为纯文本', category: 'edit',   shortcut: '⌘⌥C',   keywords: ['copy', 'text'], action: copyAsText },
  { id: 'theme:switch',   title: '切换主题',     category: 'theme',  shortcut: '⌘⌥T',   keywords: ['theme', '主题'], action: switchTheme },
  { id: 'search:document', title: '搜索',        category: 'search', shortcut: '⌘F',     keywords: ['search', 'find', '搜索'], action: openSearch },
  { id: 'search:global',  title: '全局搜索',     category: 'search', shortcut: '⌘⇧F',   keywords: ['search', 'global', '全局'], action: openGlobalSearch },
  { id: 'search:replace', title: '替换',         category: 'search', shortcut: '⌘⌥F',   keywords: ['replace', '替换'], action: openReplace },
  { id: 'encode:reload',  title: '重新以编码打开', category: 'file', keywords: ['encode', '编码'], action: reloadWithEncoding },
  { id: 'format:table',   title: '插入表格',     category: 'edit',   shortcut: '⌘T',     keywords: ['table', '表格'], action: insertTable },
  { id: 'format:link',    title: '插入链接',     category: 'edit',   shortcut: '⌘K',     keywords: ['link', '链接'], action: insertLink },
  { id: 'format:bold',    title: '加粗',         category: 'edit',   shortcut: '⌘B',     keywords: ['bold', '加粗'], action: toggleBold },
  { id: 'format:italic',  title: '斜体',         category: 'edit',   shortcut: '⌘I',     keywords: ['italic', '斜体'], action: toggleItalic },
  { id: 'format:code',    title: '行内代码',     category: 'edit',   shortcut: '⌘E',     keywords: ['code', '代码'], action: toggleInlineCode },
  { id: 'lint:toggle',    title: '切换 Markdown Lint', category: 'tool', keywords: ['lint', '检查'], action: toggleLint },
  { id: 'tool:format',    title: '格式化文档',   category: 'tool',   keywords: ['format', '格式化'], action: formatDocument },
  { id: 'tool:diff',      title: '文件对比',     category: 'tool',   keywords: ['diff', '对比'], action: openDiff },
]
```

---

## 12. 变更记录

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| V1.0 | 2026-09-03 | 初版低层设计文档，覆盖 Rust 后端详细设计（文件服务/编码检测/文件监听/导出）、前端核心模块详细设计（EditorCore/PreviewPane/RenderPipeline/TabBar/状态管理/主题引擎/命令面板/搜索/Markdown Lint/大文件降级）、WYSIWYG Decoration 实现、自动补全实现、全局搜索实现、错误处理设计、测试策略、打包发布配置、关键数据结构完整定义 |

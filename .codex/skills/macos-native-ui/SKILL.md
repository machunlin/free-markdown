# macOS Native UI Skill

## When to Use

Load this skill when building UI components that must feel native to macOS:
- Window chrome, traffic lights behavior
- Menu bar (native, not HTML)
- Toolbar
- Tab bar
- Sidebar (source list style)
- Context menus (right-click)
- Dialogs and alerts (native, not HTML modals)
- File open/save dialogs
- Dock interactions
- Keyboard shortcut handling
- Dark/Light mode
- System font usage
- Trackpad gestures (pinch, swipe)
- Drag and drop (files, tabs)

## Core Principle

**When there is a native macOS way to do something, use it.** Don't fake native UI with HTML/CSS when Tauri provides access to the native equivalent.

## macOS Design Guidelines

### Fonts

Use system fonts exclusively. Never embed custom UI fonts.

```css
/* UI text */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;

/* Monospace */
font-family: "SF Mono", "SF Pro Text", Menlo, Monaco, Consolas, monospace;

/* Chinese text fallback */
font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif;
```

System fonts automatically:
- Adapt to Dynamic Type (if supported)
- Support SF Pro / SF Mono variants
- Handle weight correctly
- Work in Dark/Light mode

### Colors

Use macOS system colors via CSS variables that adapt to Dark/Light mode.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--window-bg` | #FFFFFF | #1E1E1E | Window background |
| `--sidebar-bg` | #F2F2F7 (translucent) | #1C1C1E (translucent) | Sidebar background |
| `--content-bg` | #FFFFFF | #262626 | Editor/preview background |
| `--text-primary` | #1D1D1F | #F5F5F7 | Primary text |
| `--text-secondary` | #6E6E73 | #A1A1A6 | Secondary text |
| `--text-tertiary` | #AEAEB2 | #6E6E73 | Tertiary/disabled text |
| `--accent` | #007AFF (system) | #0A84FF | Accent/selection color |
| `--separator` | #D2D2D7 | #38383A | Separator lines |
| `--toolbar-bg` | #F6F6F6 (translucent) | #1A1A1A (translucent) | Toolbar background |
| `--tab-active` | #FFFFFF | #3A3A3C | Active tab background |
| `--tab-inactive` | #E7E7E7 | #2D2D2D | Inactive tab background |

**Implementation note:** Use `backdrop-filter: blur(20px)` for translucent materials (sidebar, toolbar) to match macOS vibrancy effect.

### Spacing (4px grid, macOS conventions)

```
4px  → Tight spacing (icon to label in buttons)
8px  → Standard spacing (element padding)
12px → Medium spacing (between related groups)
16px → Large spacing (section padding)
20px → Default window content padding
24px → Section separation
32px → Major section separation
```

### Window Layout (Standard macOS Document Window)

```
┌─────────────────────────────────────────────────────────┐
│ Traffic Lights (system)  │  Titlebar/Toolbar            │
│  [●] [●] [●]             │  [Icon Button] [Button] ...  │
├────────┬────────────────────────────────────────────────┤
│        │  Tabs (if visible)                              │
│        │  ┌─────┬─────┬─────┐                           │
│ Side-  │  │ Tab1│ Tab2│ Tab3│ [+]                       │
│ bar    │  ├─────────────────────────────────────────────┤
│        │                                             │ │
│ Out-   │  Editor / Preview / Split View              │ │
│ line   │                                             │ │
│        │                                             │ │
│ Files  │                                             │ │
│        │                                             │ │
├────────┴────────────────────────────────────────────────┤
│ Status Bar  │  Encoding: UTF-8  │  Ln 1, Col 1  │  Markdown │
└─────────────────────────────────────────────────────────┘
```

Key points:
- Traffic lights (red/yellow/green) are at the system position (don't customize)
- Toolbar is a unified titlebar/toolbar (Tauri `decorations: false` with custom HTML or `transparentTitlebar`)
- Sidebar is on the LEFT side (can be hidden)
- Tab bar spans full width below toolbar
- Status bar at bottom with information sections

## Tauri Window Configuration

```jsonc
// src-tauri/tauri.conf.json (window section)
{
  "windows": [
    {
      "title": "FreeMarkdown",
      "width": 1200,
      "height": 800,
      "minWidth": 640,
      "minHeight": 480,
      "titleBarStyle": "Transparent",  // macOS transparent titlebar
      "hiddenTitle": true,             // Hide title text (shows in toolbar)
      "windowButtonsHeight": 28,       // Traffic lights position
      "decorations": true,
      "transparent": false,
      "shadow": true,
      "resizable": true,
      "fullscreen": false,
      "fileDropEnabled": true          // Enable drag-drop files
    }
  ]
}
```

## Native Menu Bar

Use Tauri's menu API (Rust) to create native menus — NOT HTML menus.

```rust
// src-tauri/src/menu.rs
pub fn build_menu(app: &AppHandle) -> Menu<Wry> {
    let app_name = &app.package_info().name;
    let open = MenuItem::new(app, "Open…", true, Some("CmdOrControl+O"));
    let save = MenuItem::new(app, "Save", true, Some("CmdOrControl+S"));
    let save_as = MenuItem::new(app, "Save As…", true, Some("CmdOrControl+Shift+S"));
    let close = MenuItem::new(app, "Close Tab", true, Some("CmdOrControl+W"));
    let new_file = MenuItem::new(app, "New", true, Some("CmdOrControl+N"));

    Menu::new()
        // App menu (required on macOS)
        .add_submenu(Submenu::new(app_name, Menu::new()
            .add_native_item(PredefinedMenuItem::about(Some(app_name), Some(AboutMetadata::default())))
            .add_native_item(PredefinedMenuItem::separator())
            .add_item(MenuItem::with_id(app, "preferences", "Settings…", true, Some("CmdOrControl+,"))?)
            .add_native_item(PredefinedMenuItem::separator())
            .add_native_item(PredefinedMenuItem::services(None))
            .add_native_item(PredefinedMenuItem::separator())
            .add_native_item(PredefinedMenuItem::hide(Some(&format!("Hide {}", app_name))))
            .add_native_item(PredefinedMenuItem::hide_others(None))
            .add_native_item(PredefinedMenuItem::show_all(None))
            .add_native_item(PredefinedMenuItem::separator())
            .add_native_item(PredefinedMenuItem::quit(Some(&format!("Quit {}", app_name))))
        ))
        // File menu
        .add_submenu(Submenu::new("File", Menu::new()
            .add_item(new_file)
            .add_native_item(PredefinedMenuItem::separator())
            .add_item(open)
            .add_native_item(PredefinedMenuItem::separator())
            .add_item(save)
            .add_item(save_as)
            .add_native_item(PredefinedMenuItem::separator())
            .add_item(close)
        ))
        // Edit menu (include standard edit items for macOS Services compat)
        .add_submenu(Submenu::new("Edit", build_edit_menu(app)?))
        // View menu
        .add_submenu(Submenu::new("View", build_view_menu(app)?))
        // Window menu
        .add_submenu(Submenu::new("Window", Menu::new()
            .add_native_item(PredefinedMenuItem::minimize(None))
            .add_native_item(PredefinedMenuItem::maximize(None))
            .add_item(MenuItem::with_id(app, "enter-full-screen", "Enter Full Screen", true, Some("Control+CmdOrControl+F"))?)
        ))
}
```

## Toolbar

Implement as a unified toolbar under the traffic lights:

```tsx
// src/components/toolbar/Toolbar.tsx
export function Toolbar() {
  return (
    <div className="h-[52px] flex items-center px-4 gap-2 select-none
                    bg-[var(--toolbar-bg)] backdrop-blur-xl border-b border-[var(--separator)]
                    drag-region">  {/* Tauri drag region for window dragging */}
      {/* Sidebar toggle */}
      <ToolbarButton onClick={toggleSidebar} icon="solar:sidebar-bold" />

      <div className="w-px h-6 bg-[var(--separator)] mx-1" />

      {/* Formatting buttons */}
      <ToolbarButton onClick={insertBold} icon="ph:bold" label="Bold" shortcut="⌘B" />
      <ToolbarButton onClick={insertItalic} icon="ph:italic" label="Italic" shortcut="⌘I" />
      <ToolbarButton onClick={insertHeading} icon="ph:text-h" label="Heading" />

      <div className="w-px h-6 bg-[var(--separator)] mx-1" />

      {/* View mode toggle */}
      <ViewModeToggle />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <ToolbarButton onClick={share} icon="ph:share" label="Share" />
    </div>
  );
}
```

**Important:** Use Tauri's `data-tauri-drag-region` on the toolbar to allow window dragging.

## Tab Bar

macOS-native tab style (like Safari or Finder tabs):

```tsx
// src/components/tabs/TabBar.tsx
export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useWorkspaceStore();

  return (
    <div className="h-[38px] flex items-end bg-[var(--tabbar-bg)] border-b border-[var(--separator)] px-2 gap-0.5">
      {tabs.map((tab, index) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          index={index}
          onClick={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
      <button onClick={createNewTab}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)]">
        <Icon icon="ph:plus" width="14" />
      </button>
    </div>
  );
}

function TabItem({ tab, isActive, onClick, onClose }: TabItemProps) {
  return (
    <div
      onClick={onClick}
      className={`group h-[32px] flex items-center gap-2 px-3 min-w-[120px] max-w-[240px]
                  rounded-t-md cursor-pointer transition-colors relative
                  ${isActive
                    ? 'bg-[var(--tab-active)] text-[var(--text-primary)]'
                    : 'bg-[var(--tab-inactive)] text-[var(--text-secondary)] hover:bg-[var(--tab-hover)]'}`}
    >
      {/* File icon */}
      <Icon icon="ph:file-text" width="14" className="flex-shrink-0" />

      {/* Title */}
      <span className="truncate text-[13px] flex-1">
        {tab.isDirty && <span className="mr-0.5">●</span>}
        {tab.title}
      </span>

      {/* Close button (appears on hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
      >
        <Icon icon="ph:x" width="10" />
      </button>
    </div>
  );
}
```

Tab behaviors:
- Dirty indicator: dot (●) before filename
- Close button appears on hover (macOS convention)
- Cmd+W closes active tab
- Cmd+1-9 switches tabs (Cmd+Opt+1-9 to avoid conflicting with editor mode shortcuts)
- Drag to reorder tabs
- Double-click tab header to maximize
- Middle-click to close

## Sidebar (Source List Style)

macOS Finder/Notes-style sidebar (translucent background, source list style):

```tsx
// src/components/sidebar/Sidebar.tsx
export function Sidebar() {
  return (
    <div className="w-[240px] flex-shrink-0 flex flex-col
                    bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--separator)]">
      {/* Sidebar top section: Quick access */}
      <div className="p-2">
        <SidebarItem icon="ph:clock-counter-clockwise" label="Recent Files" />
        <SidebarItem icon="ph:folder-open" label="Open Folder" />
      </div>

      <div className="h-px bg-[var(--separator)] mx-3 my-1" />

      {/* Outline section */}
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        Outline
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        <OutlineTree />
      </div>
    </div>
  );
}
```

Sidebar behaviors:
- Toggle with Cmd+Shift+S or toolbar button
- Can be fully hidden (no sidebar mode)
- Width is resizable (drag divider)
- Outline auto-generated from Markdown headings
- File explorer shown when a folder is opened

## Dialogs

Use **native Tauri dialogs** for file open/save. Use HTML dialogs (styled to match macOS) for settings and confirmation that doesn't have a native equivalent.

```tsx
// Native file open:
import { open } from '@tauri-apps/plugin-dialog';

const selected = await open({
  multiple: false,
  filters: [{
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mkd', 'mdown', 'txt'],
  }],
});
```

For settings/confirmation dialogs, use a styled modal that matches macOS sheet style:
- Centered or sheet-style (from top of window)
- Frosted background
- Standard button order: secondary buttons left, primary button right
- Cancel on Escape, primary action on Enter
- Animate in/out (macOS spring animation)

## Keyboard Shortcuts (macOS Conventions)

Follow macOS standard shortcuts. Never use Ctrl (⌃) for primary actions — use Cmd (⌘).

| Action | Shortcut | Note |
|---|---|---|
| New file | ⌘N | |
| Open file | ⌘O | |
| Save | ⌘S | |
| Save As | ⌘⇧S | |
| Close tab | ⌘W | |
| Quit | ⌘Q | |
| Bold | ⌘B | |
| Italic | ⌘I | |
| Find | ⌘F | |
| Find & Replace | ⌘⌥F | |
| Command palette | ⌘⇧P | |
| Toggle sidebar | ⌘⇧S | |
| Toggle preview | ⌘⇧P (in edit area) — use ⌘⌥P instead | |
| Source mode | ⌘1 | |
| Split mode | ⌘2 | |
| Preview mode | ⌘3 | |
| Focus mode | ⌘4 | |
| Switch tab | ⌘⌥1-9 | NOT ⌘1-9 (those are mode switches) |
| Next tab | ⌃Tab | macOS convention |
| Prev tab | ⌃⇧Tab | |
| Settings | ⌘, | |
| Full screen | ⌃⌘F | macOS standard |
| Theme toggle | ⌘⌥T | |

**Rule:** Shortcut conflicts are unacceptable. See PRD v3.0 for the resolved shortcut scheme.

## Context Menus

Use native context menus via Tauri or HTML-based menus styled to look native.

For editor context menu: Right-click shows editing options (Cut, Copy, Paste, Select All, then formatting options).
For tab context menu: Close, Close Others, Close Right, Reveal in Finder.

## Drag and Drop

1. **File drop on app icon:** Handle via Tauri file association (`.md` files)
2. **File drop on window:** Accept `.md`, `.markdown`, `.txt` files
3. **Tab drag:** Reorder tabs within window; drag out to create new window (V1.0)
4. **Image drop on editor:** Insert image reference or embed as base64 (user preference)

## Dark / Light Mode

1. Follow system by default (`prefers-color-scheme: media query`)
2. User can override in Settings
3. Use CSS variables with `.dark` class on root element
4. Update Mermaid theme and Shiki theme when mode changes
5. Update CodeMirror theme when mode changes
6. Menu bar icons adapt via CSS filters

## Forbidden UI Patterns

- ❌ Windows/Linux-style menu bars (File/Edit/View at top of web content)
- ❌ Custom window controls (close/min/max buttons in HTML)
- ❌ Windows-style title bar with text
- ❌ Bright saturated colors in UI (use subtle macOS palette)
- ❌ Animated transitions over 200ms (macOS uses subtle, quick animations)
- ❌ Non-standard scrollbar styling
- ❌ Hover effects that look like web buttons (subtle background change only)
- ❌ Rounded corners everywhere (macOS uses varying corner radii: 6px buttons, 10px cards, 12px windows)
- ❌ Material Design, Bootstrap, or web-first component libraries

## Testing Checklist for macOS UI

- [ ] App looks correct in Light mode
- [ ] App looks correct in Dark mode
- [ ] Window is draggable from toolbar area
- [ ] Traffic lights are visible and functional
- [ ] All menu items work (File > Open, Save, etc.)
- [ ] Keyboard shortcuts work
- [ ] Context menus appear at correct position
- [ ] Tabs look like macOS tabs (Safari/Finder style)
- [ ] Sidebar uses vibrant/translucent material
- [ ] File drag-drop works (drop .md file on window opens it)
- [ ] Double-clicking a .md file in Finder opens it in the app
- [ ] Full-screen mode works (⌃⌘F)
- [ ] System font rendering looks correct (no blurry text)
- [ ] No web artifacts visible (blue focus rings, default HTML form elements)

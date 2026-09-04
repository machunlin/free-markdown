//! Native macOS menu bar definition.
//!
//! Uses Tauri 2's builder API: `MenuBuilder`, `SubmenuBuilder`, `PredefinedMenuItem`.

use tauri::menu::{Menu, MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Wry};

pub fn build_menu(app: &AppHandle) -> Result<Menu<Wry>, tauri::Error> {
    let app_name = app.package_info().name.clone();

    // --- App menu (first submenu on macOS = application menu) ---
    let app_menu = SubmenuBuilder::new(app, app_name.as_str())
        .about(None)
        .separator()
        .text("app.settings", "Settings…")
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // --- File menu ---
    let file_menu = SubmenuBuilder::new(app, "File")
        .text("file.new", "New")
        .text("file.open", "Open…")
        .text("file.open-recent", "Open Recent")
        .separator()
        .text("file.save", "Save")
        .text("file.save-as", "Save As…")
        .separator()
        .text("file.close", "Close Tab")
        .build()?;

    // --- Edit menu ---
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .text("edit.undo", "Undo")
        .text("edit.redo", "Redo")
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .text("edit.find", "Find…")
        .text("edit.find-replace", "Find and Replace…")
        .build()?;

    // --- View menu ---
    let view_menu = SubmenuBuilder::new(app, "View")
        .text("view.command-palette", "Command Palette")
        .separator()
        .text("view.source", "Source Mode")
        .text("view.split", "Split Mode")
        .text("view.preview", "Preview Mode")
        .text("view.focus", "Focus Mode")
        .separator()
        .text("view.toggle-sidebar", "Toggle Sidebar")
        .text("view.toggle-theme", "Toggle Theme")
        .separator()
        .fullscreen()
        .build()?;

    // --- Window menu ---
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .show_all()
        .build()?;

    // --- Assemble top-level menu ---
    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()?;

    Ok(menu)
}

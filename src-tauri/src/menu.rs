//! Native macOS menu bar definition.
//!
//! Uses Tauri 2's builder API: `MenuBuilder`, `SubmenuBuilder`, `PredefinedMenuItem`.

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Wry};

pub fn build_menu(app: &AppHandle) -> Result<Menu<Wry>, tauri::Error> {
    let app_name = app.package_info().name.clone();

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

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("file.new", "New")
            .accelerator("CmdOrControl+N")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("file.open", "Open…")
            .accelerator("CmdOrControl+O")
            .build(app)?)
        .text("file.open-recent", "Open Recent")
        .separator()
        .item(&MenuItemBuilder::with_id("file.save", "Save")
            .accelerator("CmdOrControl+S")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("file.save-as", "Save As…")
            .accelerator("CmdOrControl+Shift+S")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("file.close", "Close Tab")
            .accelerator("CmdOrControl+W")
            .build(app)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&MenuItemBuilder::with_id("edit.undo", "Undo")
            .accelerator("CmdOrControl+Z")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("edit.redo", "Redo")
            .accelerator("CmdOrControl+Shift+Z")
            .build(app)?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .text("edit.find", "Find…")
        .text("edit.find-replace", "Find and Replace…")
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text("view.command-palette", "Command Palette")
        .separator()
        .text("view.source", "Source Mode")
        .text("view.split", "Split Mode")
        .text("view.preview", "Preview Mode")
        .text("view.focus", "Focus Mode")
        .separator()
        .text("view.toggle-sidebar", "Toggle Sidebar")
        .separator()
        .text("view.appearance-system", "Follow System")
        .text("view.appearance-light", "Light Appearance")
        .text("view.appearance-dark", "Dark Appearance")
        .separator()
        .text("view.theme-office", "Office Theme")
        .text("view.theme-night", "Night Theme")
        .text("view.theme-programmer", "Programmer Theme")
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .show_all()
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

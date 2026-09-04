//! FreeMarkdown backend library.
//!
//! Registers Tauri commands, application state, and the native menu bar.

mod commands;
mod error;
mod menu;
mod models;
mod services;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Build and set the native menu bar.
            let menu = menu::build_menu(app.handle())?;
            app.set_menu(menu)?;

            // Forward menu item selections to the frontend as an event.
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app: &tauri::AppHandle, event| {
                let id = event.id().0.as_str().to_string();
                let _ = app_handle.emit(
                    "menu-event",
                    serde_json::json!({ "id": id }),
                );
            });

            tracing::info!("FreeMarkdown started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::open_file,
            commands::fs::save_file,
            commands::fs::create_file,
            commands::fs::read_directory,
            commands::fs::delete_file,
            commands::fs::rename_file,
            commands::fs::exists_file,
            commands::fs::show_save_dialog,
            commands::encoding::detect_encoding,
            commands::encoding::get_supported_encodings,
            commands::watcher::watch_file,
            commands::watcher::unwatch_file,
            commands::window::set_title,
            commands::window::toggle_fullscreen,
            commands::recent::get_recent_files,
            commands::recent::add_recent_file,
            commands::recent::clear_recent_files,
            commands::external::open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FreeMarkdown");
}

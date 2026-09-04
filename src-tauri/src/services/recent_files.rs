//! Recent files list, persisted as a plain JSON file in the app data directory.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;

const MAX_RECENT: usize = 20;
const FILE_NAME: &str = "recent_files.json";

#[derive(Debug, Default, Serialize, Deserialize)]
struct RecentStore {
    paths: Vec<String>,
}

fn file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|mut p| {
        let _ = std::fs::create_dir_all(&p);
        p.push(FILE_NAME);
        p
    })
}

fn load(app: &AppHandle) -> RecentStore {
    let Some(path) = file_path(app) else {
        return RecentStore::default();
    };
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => RecentStore::default(),
    }
}

fn save(app: &AppHandle, store: &RecentStore) {
    let Some(path) = file_path(app) else { return };
    if let Ok(json) = serde_json::to_string_pretty(store) {
        let _ = std::fs::write(path, json);
    }
}

/// Return the list of recent file paths (most recent first).
pub fn get(app: &AppHandle) -> Vec<String> {
    load(app)
        .paths
        .into_iter()
        .filter(|p| std::path::Path::new(p).exists())
        .collect()
}

/// Add a path to the top of the recent list.
pub fn add(app: &AppHandle, path: &str) {
    let mut store = load(app);
    store.paths.retain(|p| p != path);
    store.paths.insert(0, path.to_string());
    store.paths.truncate(MAX_RECENT);
    save(app, &store);
}

/// Clear the entire recent list.
pub fn clear(app: &AppHandle) {
    save(app, &RecentStore { paths: Vec::new() });
}

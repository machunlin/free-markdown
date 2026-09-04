//! Filesystem watcher with debounced events.
//!
//! Uses `notify` crate to watch files for external modifications. Events are
//! debounced (300ms) and forwarded to the frontend as `file-changed` events.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

use crate::models::{FileChangeKind, FileChangedEvent};

const DEBOUNCE_MS: u64 = 300;

struct Shared {
    watcher: Option<RecommendedWatcher>,
    watched: HashMap<PathBuf, ()>,
    app_handle: Option<tauri::AppHandle>,
}

pub struct WatcherHandle {
    shared: Arc<Mutex<Shared>>,
    // Keep the debounce thread alive.
    pub(crate) thread: Option<std::thread::JoinHandle<()>>,
}

impl WatcherHandle {
    pub fn new() -> Self {
        Self {
            shared: Arc::new(Mutex::new(Shared {
                watcher: None,
                watched: HashMap::new(),
                app_handle: None,
            })),
            thread: None,
        }
    }

    pub fn bind(&mut self, app_handle: tauri::AppHandle) -> anyhow::Result<()> {
        let shared = self.shared.clone();
        let (tx, rx) = channel::<PathBuf>();

        // Create the notify watcher.
        let watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                for path in event.paths.iter() {
                    let _ = tx.send(path.clone());
                }
            }
        })?;

        {
            let mut g = shared.lock().unwrap();
            g.watcher = Some(watcher);
            g.app_handle = Some(app_handle.clone());
        }

        // Spawn a debounce thread.
        let shared_clone = shared.clone();
        let handle = std::thread::spawn(move || {
            let rt = match tokio::runtime::Builder::new_current_thread()
                .enable_time()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    tracing::error!("failed to build watcher debounce runtime: {e}");
                    return;
                }
            };
            rt.block_on(async move {
                let mut pending: HashMap<PathBuf, tokio::time::Instant> = HashMap::new();
                let mut interval = tokio::time::interval(Duration::from_millis(100));
                loop {
                    // Drain pending channel messages
                    while let Ok(path) = rx.try_recv() {
                        pending.insert(
                            path,
                            tokio::time::Instant::now() + Duration::from_millis(DEBOUNCE_MS),
                        );
                    }
                    interval.tick().await;
                    let now = tokio::time::Instant::now();
                    let mut fired = Vec::new();
                    pending.retain(|p, until| {
                        if now >= *until {
                            fired.push(p.clone());
                            false
                        } else {
                            true
                        }
                    });
                    let app = {
                        let g = shared_clone.lock().unwrap();
                        g.app_handle.clone()
                    };
                    if let Some(app) = app {
                        for path in fired {
                            let kind = if path.exists() {
                                FileChangeKind::Modified
                            } else {
                                FileChangeKind::Deleted
                            };
                            let modified = std::fs::metadata(&path)
                                .and_then(|m| m.modified())
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_millis())
                                .unwrap_or(0);
                            let _ = app.emit(
                                "file-changed",
                                FileChangedEvent {
                                    path: path.to_string_lossy().to_string(),
                                    kind,
                                    modified,
                                },
                            );
                        }
                    }
                }
            });
        });
        self.thread = Some(handle);
        Ok(())
    }

    pub fn watch(&self, path: &Path) -> anyhow::Result<()> {
        let mut g = self.shared.lock().unwrap();
        let watcher = g
            .watcher
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("watcher not bound"))?;
        watcher.watch(path, RecursiveMode::NonRecursive)?;
        g.watched.insert(path.to_path_buf(), ());
        Ok(())
    }

    pub fn unwatch(&self, path: &Path) -> anyhow::Result<()> {
        let mut g = self.shared.lock().unwrap();
        if let Some(watcher) = g.watcher.as_mut() {
            let _ = watcher.unwatch(path);
        }
        g.watched.remove(path);
        Ok(())
    }
}

//! Watches the project and the settings file, and notifies the UI.

use std::collections::BTreeSet;
use std::path::Path;
use std::time::Duration;

use fusen_core::project::Project;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{Debouncer, new_debouncer};
use tauri::{AppHandle, Emitter};

use crate::images;

pub type Watcher = Debouncer<RecommendedWatcher>;

/// Events sent to the UI.
pub const FILES_CHANGED: &str = "files-changed";
pub const DOCUMENT_CHANGED: &str = "document-changed";
pub const SETTINGS_CHANGED: &str = "settings-changed";
pub const IMAGES_CHANGED: &str = "images-changed";

/// Watches a project. Changes to Markdown files and fusen files are sent as
/// `document-changed` (with the document path) and `files-changed`, and
/// changes to images as `images-changed`.
pub fn watch_project(
    app: &AppHandle,
    project: &Project,
) -> notify_debouncer_mini::notify::Result<Watcher> {
    let app = app.clone();
    let project_for_events = project.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(150), move |res| {
        let Ok(events) = res else { return };
        let events: Vec<notify_debouncer_mini::DebouncedEvent> = events;
        if events.iter().any(|e| images::media_type(&e.path).is_some()) {
            let _ = app.emit(IMAGES_CHANGED, ());
        }
        let docs: BTreeSet<String> = events
            .iter()
            .filter_map(|e| {
                project_for_events
                    .doc_of_fusen_path(&e.path)
                    .or_else(|| project_for_events.doc_of_path(&e.path))
            })
            .collect();
        if docs.is_empty() {
            return;
        }
        for doc in docs {
            let _ = app.emit(DOCUMENT_CHANGED, doc);
        }
        let _ = app.emit(FILES_CHANGED, ());
    })?;
    debouncer
        .watcher()
        .watch(project.root(), RecursiveMode::Recursive)?;
    Ok(debouncer)
}

/// Watches the directory of the settings file and sends `settings-changed`.
pub fn watch_settings(app: &AppHandle, settings: &Path) -> Option<Watcher> {
    let dir = settings.parent()?;
    std::fs::create_dir_all(dir).ok()?;
    let app = app.clone();
    let file = settings.to_path_buf();
    let mut debouncer = new_debouncer(Duration::from_millis(150), move |res| {
        let Ok(events) = res else { return };
        let events: Vec<notify_debouncer_mini::DebouncedEvent> = events;
        if events.iter().any(|e| e.path == file) {
            let _ = app.emit(SETTINGS_CHANGED, ());
        }
    })
    .ok()?;
    debouncer
        .watcher()
        .watch(dir, RecursiveMode::NonRecursive)
        .ok()?;
    Some(debouncer)
}

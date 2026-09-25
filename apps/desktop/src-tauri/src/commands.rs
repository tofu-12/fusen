//! Tauri commands exposed to the UI. They only call fusen-core.

use std::sync::Mutex;

use fusen_core::config::{Config, Settings};
use fusen_core::fusen::ops::{self, DocumentState, NewAnchor};
use fusen_core::fusen::{Fusen, Status};
use fusen_core::project::Project;
use serde::Serialize;
use tauri::State;
use ts_rs::TS;

use crate::session::{Session, SessionInfo};

pub type AppState = Mutex<Option<Session>>;

type Result<T> = std::result::Result<T, String>;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FileEntry {
    pub path: String,
    pub open_count: u32,
    pub outdated_count: u32,
}

fn with_project<T>(
    state: &State<AppState>,
    f: impl FnOnce(&Project, &Session) -> fusen_core::Result<T>,
) -> Result<T> {
    let guard = state.lock().unwrap();
    let session = guard.as_ref().ok_or("no project is open")?;
    f(&session.project, session).map_err(|e| e.to_string())
}

/// Resolves a document path from the UI, making sure it is inside the project.
fn doc(project: &Project, path: &str) -> fusen_core::Result<String> {
    project.resolve_file(path)
}

#[tauri::command]
pub fn get_session(state: State<AppState>) -> Option<SessionInfo> {
    state.lock().unwrap().as_ref().map(Session::info)
}

#[tauri::command]
pub fn list_files(state: State<AppState>) -> Result<Vec<FileEntry>> {
    with_project(&state, |project, session| {
        Ok(project
            .markdown_files(&session.target)
            .into_iter()
            .map(|path| {
                // An invalid fusen file should not hide the whole list; its
                // error is shown when the document is opened.
                let (open, outdated) = ops::state_counts(project, &path).unwrap_or((0, 0));
                FileEntry {
                    path,
                    open_count: open as u32,
                    outdated_count: outdated as u32,
                }
            })
            .collect())
    })
}

/// Checks that a link target is a Markdown file in the project, and returns
/// its path relative to the project root.
#[tauri::command]
pub fn resolve_document(state: State<AppState>, path: String) -> Result<String> {
    with_project(&state, |project, _| doc(project, &path))
}

#[tauri::command]
pub fn read_document(state: State<AppState>, path: String) -> Result<DocumentState> {
    with_project(&state, |project, _| {
        ops::read_document(project, &doc(project, &path)?)
    })
}

#[tauri::command]
pub fn add_fusen(
    state: State<AppState>,
    path: String,
    doc_hash: String,
    kind: String,
    body: String,
    anchor: Option<NewAnchor>,
) -> Result<Fusen> {
    with_project(&state, |project, _| {
        ops::add_fusen(
            project,
            &doc(project, &path)?,
            Some(doc_hash),
            &kind,
            &body,
            anchor,
        )
    })
}

#[tauri::command]
pub fn edit_fusen(
    state: State<AppState>,
    path: String,
    id: String,
    kind: String,
    body: String,
) -> Result<()> {
    with_project(&state, |project, _| {
        ops::edit_fusen(project, &doc(project, &path)?, &id, &kind, &body)
    })
}

#[tauri::command]
pub fn delete_fusen(state: State<AppState>, path: String, ids: Vec<String>) -> Result<()> {
    with_project(&state, |project, _| {
        ops::delete_fusen(project, &doc(project, &path)?, &ids)
    })
}

#[tauri::command]
pub fn set_status(
    state: State<AppState>,
    path: String,
    ids: Vec<String>,
    status: Status,
) -> Result<()> {
    // No IDs would mean every fusen on the document.
    if ids.is_empty() {
        return Ok(());
    }
    with_project(&state, |project, _| {
        for result in ops::set_status(project, &doc(project, &path)?, &ids, status)? {
            result?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn add_reply(state: State<AppState>, path: String, id: String, body: String) -> Result<()> {
    with_project(&state, |project, _| {
        let author = Config::load_default()?.user_name();
        ops::add_reply(project, &doc(project, &path)?, &id, &author, &body).map(|_| ())
    })
}

#[tauri::command]
pub fn get_settings() -> Result<Settings> {
    Config::load_default()
        .map(|c| c.settings())
        .map_err(|e| e.to_string())
}

/// The settings with every key at its default, for the Reset buttons.
#[tauri::command]
pub fn default_settings() -> Settings {
    Config::default().settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<()> {
    let mut config = Config::load_default().map_err(|e| e.to_string())?;
    config.replace(&settings).map_err(|e| e.to_string())?;
    config.save().map_err(|e| e.to_string())
}

mod commands;
mod session;
mod watcher;

use std::path::Path;
use std::sync::Mutex;

use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

use commands::AppState;

/// Sent to the UI when `fusen <path>` opens a path.
const OPEN_TARGET: &str = "open-target";

/// Sent to the UI when Settings is chosen from the menu.
const SHOW_SETTINGS: &str = "show-settings";

struct Watchers {
    project: Mutex<Option<watcher::Watcher>>,
    _settings: Option<watcher::Watcher>,
}

/// Opens the path from `--root <dir> --path <path>`, switching projects if needed.
fn open_from_args(app: &AppHandle, args: &[String]) {
    let Some((root, path)) = session::parse_args(args) else {
        return;
    };
    let session = match session::open(&root, &path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("{e}");
            return;
        }
    };
    let info = session.info();
    let state = app.state::<AppState>();
    let mut current = state.lock().unwrap();
    let project_changed = current.as_ref().map(|s| &s.project) != Some(&session.project);
    if project_changed {
        let watcher = watcher::watch_project(app, &session.project)
            .map_err(|e| eprintln!("could not watch {}: {e}", root.display()))
            .ok();
        *app.state::<Watchers>().project.lock().unwrap() = watcher;
    }
    *current = Some(session);
    drop(current);

    if let Some(window) = app.get_webview_window("main") {
        let name = Path::new(&info.root)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let _ = window.set_title(&format!("{name} — Fusen"));
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit(OPEN_TARGET, info);
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let settings = MenuItemBuilder::with_id("settings", "Settings…").build(app)?;
    let app_menu = SubmenuBuilder::new(app, "Fusen")
        .about(Some(AboutMetadata::default()))
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &window_menu])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            open_from_args(app, &argv);
        }))
        .plugin(tauri_plugin_opener::init())
        .manage::<AppState>(Mutex::new(None))
        .setup(|app| {
            let handle = app.handle();
            app.manage(Watchers {
                project: Mutex::new(None),
                _settings: watcher::watch_settings(handle, &fusen_core::config::default_path()),
            });
            app.set_menu(build_menu(handle)?)?;
            app.on_menu_event(|app, event| {
                if event.id() == "settings" {
                    let _ = app.emit(SHOW_SETTINGS, ());
                }
            });
            let args: Vec<String> = std::env::args().collect();
            open_from_args(handle, &args);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_session,
            commands::list_files,
            commands::read_document,
            commands::add_fusen,
            commands::edit_fusen,
            commands::delete_fusen,
            commands::set_status,
            commands::add_reply,
            commands::get_settings,
            commands::save_settings,
            commands::default_settings,
            commands::resolve_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

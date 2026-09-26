mod commands;
mod images;
mod session;
mod watcher;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use commands::AppState;
use session::MAIN_WINDOW;

/// Sent to a window when `fusen <path>` opens a path in it.
const OPEN_TARGET: &str = "open-target";

/// Sent to the focused window when Settings is chosen from the menu.
const SHOW_SETTINGS: &str = "show-settings";

struct Watchers {
    /// One watcher per project root, shared by the windows showing it.
    projects: Mutex<HashMap<PathBuf, watcher::Watcher>>,
    _settings: Option<watcher::Watcher>,
}

/// Opens the path from `--root <dir> --path <path> [--window <name>]` in the
/// named window, creating the window if it is not open.
fn open_from_args(app: &AppHandle, args: &[String]) {
    let Some(request) = session::parse_args(args) else {
        return;
    };
    let session = match session::open(&request.root, &request.path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("{e}");
            return;
        }
    };
    let info = session.info();
    let label = request.window;
    // Stored before a new window is created, so that its first `get_session`
    // finds it.
    app.state::<AppState>()
        .lock()
        .unwrap()
        .insert(label.clone(), session);
    sync_watchers(app);

    let title = window_title(&info.root);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_title(&title);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(label.as_str(), OPEN_TARGET, info);
    } else if let Err(e) = create_window(app, &label, &title) {
        eprintln!("could not open window {label}: {e}");
        app.state::<AppState>().lock().unwrap().remove(&label);
        sync_watchers(app);
    }
}

/// `<name> — Fusen`, where `<name>` is the name of the project root directory.
fn window_title(root: &str) -> String {
    let name = Path::new(root)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    format!("{name} — Fusen")
}

fn create_window(app: &AppHandle, label: &str, title: &str) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::default())
        .title(title)
        .inner_size(1280.0, 800.0)
        .min_inner_size(720.0, 480.0)
        .build()?;
    Ok(())
}

/// Watches every project open in a window, and stops watching the others.
fn sync_watchers(app: &AppHandle) {
    let projects: Vec<_> = app
        .state::<AppState>()
        .lock()
        .unwrap()
        .values()
        .map(|s| s.project.clone())
        .collect();
    let watchers = app.state::<Watchers>();
    let mut watched = watchers.projects.lock().unwrap();
    let unused: Vec<PathBuf> = watched
        .keys()
        .filter(|root| !projects.iter().any(|p| p.root() == *root))
        .cloned()
        .collect();
    // Stopping a watcher waits for its thread, so it is done after unlocking.
    let stopped: Vec<_> = unused
        .iter()
        .filter_map(|root| watched.remove(root))
        .collect();
    for project in projects {
        let root = project.root();
        if watched.contains_key(root) {
            continue;
        }
        match watcher::watch_project(app, &project) {
            Ok(w) => {
                watched.insert(root.to_path_buf(), w);
            }
            Err(e) => eprintln!("could not watch {}: {e}", root.display()),
        }
    }
    drop(watched);
    drop(stopped);
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
        .register_uri_scheme_protocol(images::PROTOCOL, images::handle)
        .manage::<AppState>(Mutex::new(HashMap::new()))
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                let app = window.app_handle();
                // `fusen <path> --window <name>` may have opened a new window
                // with the same label while this one was closing.
                if app.get_webview_window(window.label()).is_none() {
                    app.state::<AppState>()
                        .lock()
                        .unwrap()
                        .remove(window.label());
                    sync_watchers(app);
                }
            }
        })
        .setup(|app| {
            let handle = app.handle();
            app.manage(Watchers {
                projects: Mutex::new(HashMap::new()),
                _settings: watcher::watch_settings(handle, &fusen_core::config::default_path()),
            });
            app.set_menu(build_menu(handle)?)?;
            app.on_menu_event(|app, event| {
                if event.id() == "settings" {
                    let label = app
                        .webview_windows()
                        .into_iter()
                        .find(|(_, w)| w.is_focused().unwrap_or(false))
                        .map_or_else(|| MAIN_WINDOW.to_string(), |(label, _)| label);
                    let _ = app.emit_to(label.as_str(), SHOW_SETTINGS, ());
                }
            });
            let args: Vec<String> = std::env::args().collect();
            open_from_args(handle, &args);
            // Opened from Finder, or the path could not be opened: the main
            // window explains how to open a project.
            if app.webview_windows().is_empty() {
                create_window(handle, MAIN_WINDOW, "Fusen")?;
            }
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

use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

use fusen_core::Error;
use fusen_core::project::{Project, Target};

/// `fusen <path>`: launches Fusen.app with the path and exits. If the app is
/// already running, it receives the path through its single-instance handler.
pub fn run(path: &Path) -> super::Result {
    let project = Project::current()?;
    let target = match project.resolve(path)? {
        Target::Dir(rel) | Target::File(rel) => project.root().join(rel),
    };
    let app = app_executable().ok_or(Error::AppNotFound)?;
    Command::new(&app)
        .arg("--root")
        .arg(project.root())
        .arg("--path")
        .arg(&target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn()
        .map_err(Error::io(&app))?;
    Ok(ExitCode::SUCCESS)
}

fn app_executable() -> Option<PathBuf> {
    if let Some(app) = std::env::var_os("FUSEN_APP").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(app));
    }
    let home = std::env::var_os("HOME").map(PathBuf::from);
    [
        Some(PathBuf::from("/Applications")),
        home.map(|h| h.join("Applications")),
    ]
    .into_iter()
    .flatten()
    .map(|dir| dir.join("Fusen.app/Contents/MacOS/Fusen"))
    .find(|p| p.is_file())
}

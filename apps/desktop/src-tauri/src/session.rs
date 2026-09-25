//! The open project and what the window shows.

use std::path::{Path, PathBuf};

use fusen_core::project::{Project, Target};
use serde::Serialize;
use ts_rs::TS;

/// What `fusen <path>` asked the window to show.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SessionInfo {
    /// Absolute path of the project root.
    pub root: String,
    /// `true` for `fusen <file>`: only that file is listed.
    pub single_file: bool,
    /// The directory or file whose Markdown files are listed, relative to the root.
    pub scope: String,
    /// The document to open first, if any.
    pub document: Option<String>,
}

pub struct Session {
    pub project: Project,
    pub target: Target,
}

impl Session {
    pub fn info(&self) -> SessionInfo {
        let (single_file, scope, document) = match &self.target {
            Target::Dir(rel) => (false, rel.clone(), None),
            Target::File(rel) => (true, rel.clone(), Some(rel.clone())),
        };
        SessionInfo {
            root: self.project.root().display().to_string(),
            single_file,
            scope,
            document,
        }
    }
}

/// Parses `--root <dir> --path <path>` from the command line.
pub fn parse_args(args: &[String]) -> Option<(PathBuf, PathBuf)> {
    let value = |flag: &str| {
        args.iter()
            .position(|a| a == flag)
            .and_then(|i| args.get(i + 1))
            .map(PathBuf::from)
    };
    Some((value("--root")?, value("--path")?))
}

pub fn open(root: &Path, path: &Path) -> fusen_core::Result<Session> {
    let project = Project::new(root)?;
    let target = project.resolve(path)?;
    Ok(Session { project, target })
}

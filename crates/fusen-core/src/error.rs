//! Errors, with the messages listed in the command reference.

use std::path::PathBuf;

pub type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("no such file or directory: {0}")]
    NoSuchPath(String),
    #[error("not a Markdown file or directory: {0}")]
    NotMarkdown(String),
    #[error("not a Markdown file: {0}")]
    NotMarkdownFile(String),
    #[error("path is outside the project root: {0}")]
    OutsideRoot(String),
    #[error("unknown key: {0}")]
    UnknownKey(String),
    #[error("no such kind: {0}")]
    NoSuchKind(String),
    #[error("invalid kind id: {0}")]
    InvalidKindId(String),
    #[error("invalid color: {0}")]
    InvalidColor(String),
    #[error("invalid theme: {0}")]
    InvalidTheme(String),
    #[error("no fusen with id: {id} in {file}")]
    NoFusenWithId { id: String, file: String },
    #[error("ambiguous id: {id} in {file}")]
    AmbiguousId {
        id: String,
        file: String,
        matches: Vec<String>,
    },
    #[error("Fusen.app not found")]
    AppNotFound,
    #[error("could not copy to the clipboard: {0}")]
    Clipboard(String),
    #[error("reply message is empty")]
    EmptyReply,
    #[error("fusen text is empty")]
    EmptyBody,
    #[error("invalid fusen file: {path}: {message}")]
    InvalidFusenFile { path: PathBuf, message: String },
    #[error("invalid settings file: {path}: {message}")]
    InvalidSettings { path: PathBuf, message: String },
    #[error("{path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

impl Error {
    /// The `hint:` line shown after the message, if any.
    pub fn hint(&self) -> Option<String> {
        match self {
            Error::OutsideRoot(_) => {
                Some("run fusen from a directory that contains this path".into())
            }
            Error::UnknownKey(_) => Some(
                "available keys are user.name, prompt.language, appearance.theme, kinds.<id>.label, kinds.<id>.description, kinds.<id>.color"
                    .into(),
            ),
            Error::InvalidKindId(_) => Some(
                r#"use lowercase letters, digits, "-" and "_" (up to 32 characters)"#.into(),
            ),
            Error::InvalidTheme(_) => Some("use light or dark".into()),
            Error::InvalidColor(_) => Some("use the #rrggbb format, for example #87ceeb".into()),
            Error::AppNotFound => Some(
                "install Fusen.app in /Applications, or set FUSEN_APP to its executable".into(),
            ),
            Error::AmbiguousId { matches, .. } => Some(format!("matches {}", matches.join(", "))),
            _ => None,
        }
    }

    pub fn io(path: impl Into<PathBuf>) -> impl FnOnce(std::io::Error) -> Error {
        let path = path.into();
        move |source| Error::Io { path, source }
    }
}

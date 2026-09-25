//! Fusen files (`.fusen/<path>.fusen.yaml`): types, reading, and writing.
//!
//! See docs/fusen-format/v1.md.

pub mod anchor;
pub mod hash;
pub mod id;
pub mod ops;
mod yaml;

use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::Path;

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use serde_norway::Mapping;
use ts_rs::TS;

use self::anchor::LineRange;
use crate::config::is_valid_kind_id;
use crate::error::{Error, Result};

pub const FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FusenFile {
    pub version: u32,
    pub document: String,
    pub fusen: Vec<Fusen>,
    #[serde(flatten, skip_serializing)]
    #[ts(skip)]
    pub extra: Mapping,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Fusen {
    pub id: String,
    pub kind: String,
    pub status: Status,
    pub body: String,
    #[serde(default)]
    pub anchor: Option<Anchor>,
    pub doc_hash: String,
    pub created_at: String,
    #[serde(default)]
    pub replies: Vec<Reply>,
    #[serde(flatten, skip_serializing)]
    #[ts(skip)]
    pub extra: Mapping,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum Status {
    Open,
    Closed,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Status::Open => "open",
            Status::Closed => "closed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Anchor {
    pub quote: String,
    #[ts(type = "string")]
    pub lines: LineRange,
    #[serde(flatten, skip_serializing)]
    #[ts(skip)]
    pub extra: Mapping,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Reply {
    pub id: String,
    pub author: String,
    pub body: String,
    pub created_at: String,
    #[serde(flatten, skip_serializing)]
    #[ts(skip)]
    pub extra: Mapping,
}

impl Fusen {
    pub fn lines(&self) -> Option<LineRange> {
        self.anchor.as_ref().map(|a| a.lines)
    }

    /// The state of the fusen for a document whose hash is `current_hash`.
    pub fn state(&self, current_hash: &str) -> State {
        match self.status {
            Status::Closed => State::Closed,
            Status::Open if self.doc_hash != current_hash => State::Outdated,
            Status::Open => State::Open,
        }
    }
}

/// How a fusen is shown and filtered. Each fusen is in exactly one state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum State {
    /// `open`, and the document has not changed since the fusen was added.
    Open,
    /// `open`, but the document has changed since the fusen was added.
    Outdated,
    /// `closed`, whether or not the document has changed.
    Closed,
}

impl State {
    pub fn as_str(self) -> &'static str {
        match self {
            State::Open => "open",
            State::Outdated => "outdated",
            State::Closed => "closed",
        }
    }
}

impl FusenFile {
    pub fn new(document: impl Into<String>) -> Self {
        Self {
            version: FORMAT_VERSION,
            document: document.into(),
            fusen: Vec::new(),
            extra: Mapping::new(),
        }
    }

    /// Parses a fusen file. `path` is only used in error messages.
    pub fn parse(text: &str, path: &Path) -> Result<Self> {
        let invalid = |message: String| Error::InvalidFusenFile {
            path: path.to_path_buf(),
            message,
        };
        let file: FusenFile = serde_norway::from_str(text).map_err(|e| invalid(e.to_string()))?;
        if file.version != FORMAT_VERSION {
            return Err(invalid(format!("unsupported version: {}", file.version)));
        }
        file.validate().map_err(invalid)?;
        Ok(file)
    }

    /// Checks the rules of the format that serde cannot express.
    fn validate(&self) -> std::result::Result<(), String> {
        let mut ids = HashSet::new();
        let mut check_id = |id: &str| {
            if !id::is_valid_id(id) {
                return Err(format!("invalid id: {id}"));
            }
            if !ids.insert(id.to_string()) {
                return Err(format!("duplicate id: {id}"));
            }
            Ok(())
        };
        for fusen in &self.fusen {
            check_id(&fusen.id)?;
            if !is_valid_kind_id(&fusen.kind) {
                return Err(format!("invalid kind: {} (fusen {})", fusen.kind, fusen.id));
            }
            if fusen.body.is_empty() {
                return Err(format!("empty body (fusen {})", fusen.id));
            }
            if fusen.anchor.as_ref().is_some_and(|a| a.quote.is_empty()) {
                return Err(format!("empty quote (fusen {})", fusen.id));
            }
            for reply in &fusen.replies {
                check_id(&reply.id)?;
                if reply.body.is_empty() {
                    return Err(format!("empty body (reply {})", reply.id));
                }
            }
        }
        Ok(())
    }

    /// Reads a fusen file. Returns `None` if it does not exist.
    pub fn read(path: &Path) -> Result<Option<Self>> {
        match fs::read_to_string(path) {
            Ok(text) => Self::parse(&text, path).map(Some),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(Error::io(path)(e)),
        }
    }

    /// Serializes the file in canonical form (see the format's "Rules for writers").
    pub fn to_yaml(&self) -> String {
        let mut file = self.clone();
        sort_by_created_at(&mut file.fusen, |f| &f.created_at);
        for fusen in &mut file.fusen {
            sort_by_created_at(&mut fusen.replies, |r| &r.created_at);
        }
        yaml::write(&file)
    }

    /// Writes the file atomically, or deletes it if it has no fusen.
    pub fn write(&self, path: &Path) -> Result<()> {
        if self.fusen.is_empty() {
            return remove_file(path);
        }
        let dir = path.parent().expect("fusen file path has a parent");
        fs::create_dir_all(dir).map_err(Error::io(dir))?;
        let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(Error::io(dir))?;
        tmp.write_all(self.to_yaml().as_bytes())
            .map_err(Error::io(tmp.path()))?;
        tmp.persist(path).map_err(|e| Error::io(path)(e.error))?;
        Ok(())
    }

    /// Re-reads the file, applies `f`, and writes it back (read-modify-write).
    pub fn update<R>(
        path: &Path,
        document: &str,
        f: impl FnOnce(&mut FusenFile) -> Result<R>,
    ) -> Result<R> {
        let mut file = Self::read(path)?.unwrap_or_else(|| Self::new(document));
        let before = file.clone();
        let result = f(&mut file)?;
        if file != before {
            file.write(path)?;
        }
        Ok(result)
    }

    pub fn find_mut(&mut self, id: &str) -> Option<&mut Fusen> {
        self.fusen.iter_mut().find(|f| f.id == id)
    }
}

fn remove_file(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(Error::io(path)(e)),
    }
    // Remove directories left empty inside `.fusen/`, but keep `.fusen/` itself.
    let mut dir = path.parent();
    while let Some(d) = dir {
        if d.file_name().is_some_and(|n| n == ".fusen") || fs::remove_dir(d).is_err() {
            break;
        }
        dir = d.parent();
    }
    Ok(())
}

fn sort_by_created_at<T>(items: &mut [T], key: impl Fn(&T) -> &str) {
    // Stable, so entries with equal or unparsable timestamps keep their order.
    items.sort_by_key(|item| DateTime::parse_from_rfc3339(key(item)).ok());
}

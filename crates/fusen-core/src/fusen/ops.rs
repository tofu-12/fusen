//! Operations on the fusen of one document, shared by the CLI and the app.

use std::fs;

use chrono::{Local, SecondsFormat};
use serde::{Deserialize, Serialize};
use serde_norway::Mapping;
use ts_rs::TS;

use super::anchor::{LineRange, location};
use super::hash::doc_hash;
use super::id::{Resolved, new_id, resolve_prefix};
use super::{Anchor, Fusen, FusenFile, Reply, State, Status};
use crate::config::is_valid_kind_id;
use crate::error::{Error, Result};
use crate::project::Project;

/// A document and its fusen, as shown in the Fusen window.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct DocumentState {
    pub path: String,
    pub content: String,
    pub hash: String,
    pub fusen: Vec<FusenState>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct FusenState {
    #[serde(flatten)]
    pub fusen: Fusen,
    pub state: State,
}

/// The range of the document a new fusen refers to.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export)]
pub struct NewAnchor {
    pub quote: String,
    #[ts(type = "string")]
    pub lines: LineRange,
}

/// The result of closing or reopening one fusen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusChange {
    pub id: String,
    pub location: String,
    /// `false` if the fusen already had the status.
    pub changed: bool,
}

pub fn now() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, false)
}

/// Reads a document and its fusen.
pub fn read_document(project: &Project, doc: &str) -> Result<DocumentState> {
    let path = project.doc_path(doc);
    let bytes = fs::read(&path).map_err(Error::io(&path))?;
    let hash = doc_hash(&bytes);
    let file = FusenFile::read(&project.fusen_path(doc))?;
    let fusen = file
        .map(|f| f.fusen)
        .unwrap_or_default()
        .into_iter()
        .map(|fusen| FusenState {
            state: fusen.state(&hash),
            fusen,
        })
        .collect();
    Ok(DocumentState {
        path: doc.to_string(),
        content: String::from_utf8_lossy(&bytes).into_owned(),
        hash,
        fusen,
    })
}

/// The number of `open` and `outdated` fusen on a document.
pub fn state_counts(project: &Project, doc: &str) -> Result<(usize, usize)> {
    let Some(file) = FusenFile::read(&project.fusen_path(doc))? else {
        return Ok((0, 0));
    };
    let path = project.doc_path(doc);
    let hash = doc_hash(&fs::read(&path).map_err(Error::io(&path))?);
    let count = |state| {
        file.fusen
            .iter()
            .filter(|f| f.state(&hash) == state)
            .count()
    };
    Ok((count(State::Open), count(State::Outdated)))
}

/// Adds a fusen. `doc_hash` is the hash of the document the anchor was taken
/// from; it defaults to the current document.
pub fn add_fusen(
    project: &Project,
    doc: &str,
    doc_hash_at_add: Option<String>,
    kind: &str,
    body: &str,
    anchor: Option<NewAnchor>,
) -> Result<Fusen> {
    if !is_valid_kind_id(kind) {
        return Err(Error::InvalidKindId(kind.to_string()));
    }
    let doc_hash_at_add = match doc_hash_at_add {
        Some(h) => h,
        None => {
            let path = project.doc_path(doc);
            doc_hash(&fs::read(&path).map_err(Error::io(&path))?)
        }
    };
    let anchor = anchor
        .map(|a| Anchor {
            quote: a.quote.replace("\r\n", "\n"),
            lines: a.lines,
            extra: Mapping::new(),
        })
        .filter(|a| !a.quote.is_empty());
    let fusen = Fusen {
        id: new_id(),
        kind: kind.to_string(),
        status: Status::Open,
        body: fusen_body(body),
        anchor,
        doc_hash: doc_hash_at_add,
        created_at: now(),
        replies: Vec::new(),
        extra: Mapping::new(),
    };
    FusenFile::update(&project.fusen_path(doc), doc, |file| {
        file.fusen.push(fusen.clone());
        Ok(())
    })?;
    Ok(fusen)
}

/// Changes the kind and text of a fusen.
pub fn edit_fusen(project: &Project, doc: &str, id: &str, kind: &str, body: &str) -> Result<()> {
    if !is_valid_kind_id(kind) {
        return Err(Error::InvalidKindId(kind.to_string()));
    }
    FusenFile::update(&project.fusen_path(doc), doc, |file| {
        let fusen = file.find_mut(id).ok_or_else(|| not_found(id, doc))?;
        fusen.kind = kind.to_string();
        fusen.body = fusen_body(body);
        Ok(())
    })
}

/// The text of a fusen may be empty, such as a fusen that only marks a
/// passage. Text with only whitespace counts as empty.
fn fusen_body(body: &str) -> String {
    if body.trim().is_empty() {
        String::new()
    } else {
        body.to_string()
    }
}

/// Deletes fusen and their replies. `ids` are full IDs.
pub fn delete_fusen(project: &Project, doc: &str, ids: &[String]) -> Result<()> {
    FusenFile::update(&project.fusen_path(doc), doc, |file| {
        // Check every ID first, so that nothing is deleted if one is missing.
        if let Some(missing) = ids.iter().find(|id| file.find_mut(id).is_none()) {
            return Err(not_found(missing, doc));
        }
        file.fusen.retain(|f| !ids.contains(&f.id));
        Ok(())
    })
}

/// Closes or reopens fusen. `ids` may be shortened; if empty, all fusen on the
/// document are changed. Each ID gets its own result, so missing IDs do not
/// stop the others.
pub fn set_status(
    project: &Project,
    doc: &str,
    ids: &[String],
    status: Status,
) -> Result<Vec<Result<StatusChange>>> {
    FusenFile::update(&project.fusen_path(doc), doc, |file| {
        let targets: Vec<Result<String>> = if ids.is_empty() {
            file.fusen.iter().map(|f| Ok(f.id.clone())).collect()
        } else {
            ids.iter()
                .map(|prefix| resolve(file, prefix, doc))
                .collect()
        };
        Ok(targets
            .into_iter()
            .map(|target| {
                let id = target?;
                let fusen = file.find_mut(&id).expect("resolved id exists");
                let changed = fusen.status != status;
                fusen.status = status;
                Ok(StatusChange {
                    location: location(doc, fusen.lines()),
                    id,
                    changed,
                })
            })
            .collect())
    })
}

/// Finds one fusen on a document by a possibly shortened ID, with its state.
pub fn find_fusen(project: &Project, doc: &str, id: &str) -> Result<(Fusen, State)> {
    let file = FusenFile::read(&project.fusen_path(doc))?.unwrap_or_else(|| FusenFile::new(doc));
    let id = resolve(&file, id, doc)?;
    let path = project.doc_path(doc);
    let hash = doc_hash(&fs::read(&path).map_err(Error::io(&path))?);
    let fusen = file
        .fusen
        .into_iter()
        .find(|f| f.id == id)
        .expect("resolved id exists");
    let state = fusen.state(&hash);
    Ok((fusen, state))
}

/// Adds a reply to a fusen. Returns the full ID and location of the fusen.
pub fn add_reply(
    project: &Project,
    doc: &str,
    id: &str,
    author: &str,
    body: &str,
) -> Result<(String, String)> {
    if body.trim().is_empty() {
        return Err(Error::EmptyReply);
    }
    FusenFile::update(&project.fusen_path(doc), doc, |file| {
        let id = resolve(file, id, doc)?;
        let fusen = file.find_mut(&id).expect("resolved id exists");
        fusen.replies.push(Reply {
            id: new_id(),
            author: author.to_string(),
            body: body.to_string(),
            created_at: now(),
            extra: Mapping::new(),
        });
        Ok((id, location(doc, fusen.lines())))
    })
}

fn resolve(file: &FusenFile, prefix: &str, doc: &str) -> Result<String> {
    match resolve_prefix(file.fusen.iter().map(|f| f.id.as_str()), prefix) {
        Resolved::Found(id) => Ok(id.to_string()),
        Resolved::NotFound => Err(not_found(prefix, doc)),
        Resolved::Ambiguous(matches) => Err(Error::AmbiguousId {
            id: prefix.to_string(),
            file: doc.to_string(),
            matches: matches.into_iter().map(str::to_string).collect(),
        }),
    }
}

fn not_found(id: &str, doc: &str) -> Error {
    Error::NoFusenWithId {
        id: id.to_string(),
        file: doc.to_string(),
    }
}

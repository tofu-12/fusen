use std::path::Path;
use std::process::ExitCode;

use fusen_core::Error;
use fusen_core::config::Config;
use fusen_core::fusen::anchor::{LineRange, location};
use fusen_core::fusen::ops;
use fusen_core::project::Project;

pub fn run(
    file: &Path,
    message: Option<&str>,
    kind: &str,
    lines: Option<LineRange>,
    quote: Option<&str>,
    author: Option<&str>,
) -> super::Result {
    let project = Project::current()?;
    let doc = project.resolve_file(file)?;
    let config = Config::load_default()?;
    if !config.kinds().iter().any(|k| k.id == kind) {
        return Err(Error::NoSuchKind(kind.to_string()));
    }
    let body = match message {
        Some(m) => super::read_message(m)?,
        None => String::new(),
    };
    let author = match author {
        Some(a) => a.to_string(),
        None => config.user_name(),
    };
    // Take the anchor and the hash from the same read of the document.
    let document = ops::read_document(&project, &doc)?;
    let anchor = lines
        .map(|l| ops::anchor_for_lines(&document.content, &doc, l, quote))
        .transpose()?;
    let fusen = ops::add_fusen(
        &project,
        &doc,
        Some(document.hash),
        &author,
        kind,
        &body,
        anchor,
    )?;
    println!("added {} ({})", fusen.id, location(&doc, fusen.lines()));
    Ok(ExitCode::SUCCESS)
}

use std::path::Path;
use std::process::ExitCode;

use fusen_core::fusen::FusenFile;
use fusen_core::fusen::id::short_ids;
use fusen_core::project::Project;
use fusen_core::prompt::{self, Filter};

/// Shortened IDs are at least this long, and longer where needed to be unique.
const SHORT_ID_LEN: usize = 8;
/// The first line of a fusen's text is cut to this many characters.
const SUMMARY_LEN: usize = 60;

pub fn run(path: &Path, outdated: bool, closed: bool) -> super::Result {
    let project = Project::current()?;
    let target = project.resolve(path)?;
    let docs = prompt::collect(&project, &target, Filter { outdated, closed })?;
    if docs.is_empty() {
        eprintln!("No fusen to list.");
        return Ok(ExitCode::SUCCESS);
    }
    for (i, doc) in docs.iter().enumerate() {
        if i > 0 {
            println!();
        }
        println!("{}", doc.path);

        // IDs are shortened against every fusen on the document, so that they
        // can be passed to `fusen close` and the like.
        let file = FusenFile::read(&project.fusen_path(&doc.path))?;
        let all_ids: Vec<&str> = file
            .iter()
            .flat_map(|f| &f.fusen)
            .map(|f| f.id.as_str())
            .collect();
        let short: Vec<String> = short_ids(&all_ids, SHORT_ID_LEN);
        let short_of = |id: &str| {
            all_ids
                .iter()
                .position(|x| *x == id)
                .map_or(id.to_string(), |i| short[i].clone())
        };

        let rows: Vec<[String; 5]> = doc
            .fusen
            .iter()
            .map(|(fusen, state)| {
                [
                    short_of(&fusen.id),
                    state.as_str().to_string(),
                    fusen.kind.clone(),
                    fusen.lines().map_or("document".to_string(), |l| {
                        if l.start == l.end {
                            l.start.to_string()
                        } else {
                            l.to_string()
                        }
                    }),
                    summary(&fusen.body, fusen.replies.len()),
                ]
            })
            .collect();
        let width = |col: usize| {
            rows.iter()
                .map(|r| r[col].chars().count())
                .max()
                .unwrap_or(0)
        };
        let widths = [width(0), width(1), width(2), width(3)];
        for row in &rows {
            println!(
                "  {:w0$}  {:w1$}  {:w2$}  {:w3$}  {}",
                row[0],
                row[1],
                row[2],
                row[3],
                row[4],
                w0 = widths[0],
                w1 = widths[1],
                w2 = widths[2],
                w3 = widths[3],
            );
        }
    }
    Ok(ExitCode::SUCCESS)
}

/// The first line of the text, cut to `SUMMARY_LEN` characters, with the
/// number of replies.
fn summary(body: &str, replies: usize) -> String {
    let first = body.lines().next().unwrap_or("");
    let mut text: String = first.chars().take(SUMMARY_LEN).collect();
    if first.chars().count() > SUMMARY_LEN || body.lines().nth(1).is_some() {
        text.push('…');
    }
    match replies {
        0 => text,
        1 => format!("{text} (1 reply)"),
        n => format!("{text} ({n} replies)"),
    }
}

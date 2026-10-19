//! Prompt generation for `fusen prompt`.
//!
//! See "Output format" in docs/cli.md.

use std::fs;

use crate::config::Kind;
use crate::error::{Error, Result};
use crate::fusen::anchor::location;
use crate::fusen::hash::doc_hash;
use crate::fusen::{Fusen, FusenFile, State};
use crate::project::{Project, Target};

/// Which fusen to include besides `open` ones (see [`State`]).
#[derive(Debug, Clone, Copy, Default)]
pub struct Filter {
    pub outdated: bool,
    pub closed: bool,
}

impl Filter {
    fn includes(&self, state: State) -> bool {
        match state {
            State::Open => true,
            State::Outdated => self.outdated,
            State::Closed => self.closed,
        }
    }
}

/// How the AI responds to each fusen (`prompt.response` in the settings).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Response {
    /// In its reply in the chat, one section per fusen.
    #[default]
    Chat,
    /// As a reply on the fusen, with `fusen reply`.
    Reply,
}

impl Response {
    /// The response for a value of `prompt.response`: `chat` or `reply`.
    pub fn from_setting(value: &str) -> Self {
        if value == "reply" {
            Response::Reply
        } else {
            Response::Chat
        }
    }
}

/// The fusen of one document selected for a prompt.
#[derive(Debug, Clone)]
pub struct PromptDocument {
    pub path: String,
    /// Selected fusen, in prompt order, with their states.
    pub fusen: Vec<(Fusen, State)>,
}

/// Collects the documents and fusen for a target, in prompt order.
/// Documents with no selected fusen are left out.
pub fn collect(project: &Project, target: &Target, filter: Filter) -> Result<Vec<PromptDocument>> {
    let mut docs = Vec::new();
    for path in project.markdown_files(target) {
        let Some(file) = FusenFile::read(&project.fusen_path(&path))? else {
            continue;
        };
        let doc_path = project.doc_path(&path);
        let hash = doc_hash(&fs::read(&doc_path).map_err(Error::io(&doc_path))?);
        let mut fusen: Vec<(Fusen, State)> = file
            .fusen
            .into_iter()
            .map(|f| {
                let state = f.state(&hash);
                (f, state)
            })
            .filter(|(_, state)| filter.includes(*state))
            .collect();
        if fusen.is_empty() {
            continue;
        }
        // Fusen on the whole document first, then the rest in line order.
        fusen.sort_by_key(|(f, _)| f.lines());
        docs.push(PromptDocument { path, fusen });
    }
    Ok(docs)
}

const INTRO: &str = "These are fusen (review comments) left on documents with Fusen. Address each fusen and update the documents.";

const TAGS: &str = r#"The fusen are structured as follows:
- <document path="...">: The fusen on one document.
- <fusen id="..." kind="..." status="..." scope="..." author="...">: One fusen. author is the person or agent who added it, and is left out if unknown.
  - status="open": The fusen has not been addressed yet.
  - status="outdated": The fusen has not been addressed yet, but the document has changed since the fusen was added. The quoted text may have moved or changed.
  - status="closed": The fusen has already been addressed. Use it as context; you do not need to act on it.
  - scope="selection": The fusen refers to the text in <quote>.
  - scope="document": The fusen refers to the whole document. It has no <quote>.
- <quote location="path:line">: The exact source text the fusen refers to, and where it is.
- <body>: The text of the fusen. A fusen with no text has no <body>; handle its quote according to its kind.
- <reply author="...">: A reply to the fusen, in chronological order."#;

const CHAT_FORMAT: &str = "When you are done, reply in the following format, one section per fusen:

## <id>
**fusen:** <the text of the fusen>
**Response:** <your answer, and what you changed in the document>";

const FUSEN_REPLY: &str = "Reply once to each fusen that is not closed, with the fusen command run from the project root:

fusen reply <path> <id> --author <name> - <<'EOF'
<your answer, and what you changed in the document>
EOF

- <path> is the path of the document, and <id> is the id of the fusen.
- <name> is your model ID, such as claude-opus-5-5. If you do not know it, use the name of the agent harness you are running in, in lowercase with hyphens, such as claude-code or codex.
- Do not close the fusen. The user closes them after reading your replies.";

/// Renders the prompt. Returns `None` if there are no fusen.
pub fn render(
    docs: &[PromptDocument],
    kinds: &[Kind],
    language: &str,
    response: Response,
) -> Option<String> {
    if docs.is_empty() {
        return None;
    }
    let mut out = String::new();
    out.push_str(INTRO);
    out.push_str("\n\n<instructions>\n");
    out.push_str(TAGS);
    out.push_str("\n\nHandle each fusen according to its kind:\n");
    for line in kind_lines(docs, kinds) {
        out.push_str(&format!("- {line}\n"));
    }
    let (replies, format) = match response {
        Response::Chat => ("your reply", CHAT_FORMAT),
        Response::Reply => ("your replies", FUSEN_REPLY),
    };
    out.push_str(&format!(
        "\nWrite {replies} in {language}. When editing documents, keep each document's own language.\n\n"
    ));
    out.push_str(format);
    out.push_str("\n</instructions>\n");

    for doc in docs {
        out.push_str(&format!("\n<document path=\"{}\">\n", doc.path));
        for (i, (fusen, state)) in doc.fusen.iter().enumerate() {
            if i > 0 {
                out.push('\n');
            }
            render_fusen(&mut out, &doc.path, fusen, *state);
        }
        out.push_str("</document>\n");
    }
    Some(out)
}

/// `{kind}: {description}` lines for the kinds used, in settings order, then
/// unknown kinds in order of appearance.
fn kind_lines(docs: &[PromptDocument], kinds: &[Kind]) -> Vec<String> {
    let mut used: Vec<&str> = Vec::new();
    for (fusen, _) in docs.iter().flat_map(|d| &d.fusen) {
        if !used.contains(&fusen.kind.as_str()) {
            used.push(&fusen.kind);
        }
    }
    let known = kinds.iter().filter(|k| used.contains(&k.id.as_str()));
    let unknown = used.iter().filter(|id| !kinds.iter().any(|k| k.id == **id));
    known
        .map(|k| match &k.description {
            Some(d) => format!("{}: {d}", k.id),
            None => k.id.clone(),
        })
        .chain(unknown.map(|id| id.to_string()))
        .collect()
}

fn render_fusen(out: &mut String, path: &str, fusen: &Fusen, state: State) {
    let scope = if fusen.anchor.is_some() {
        "selection"
    } else {
        "document"
    };
    let author = match &fusen.author {
        Some(a) => format!(" author=\"{a}\""),
        None => String::new(),
    };
    out.push_str(&format!(
        "<fusen id=\"{}\" kind=\"{}\" status=\"{}\" scope=\"{scope}\"{author}>\n",
        fusen.id,
        fusen.kind,
        state.as_str()
    ));
    if let Some(anchor) = &fusen.anchor {
        let attr = format!("location=\"{}\"", location(path, Some(anchor.lines)));
        element(out, "quote", &attr, &anchor.quote);
    }
    if !fusen.body.is_empty() {
        element(out, "body", "", &fusen.body);
    }
    for reply in &fusen.replies {
        element(
            out,
            "reply",
            &format!("author=\"{}\"", reply.author),
            &reply.body,
        );
    }
    out.push_str("</fusen>\n");
}

/// Writes an element with its contents as is. Multi-line contents start and
/// end on their own lines.
fn element(out: &mut String, tag: &str, attrs: &str, contents: &str) {
    let open = if attrs.is_empty() {
        format!("<{tag}>")
    } else {
        format!("<{tag} {attrs}>")
    };
    if contents.contains('\n') {
        out.push_str(&format!("{open}\n{contents}\n</{tag}>\n"));
    } else {
        out.push_str(&format!("{open}{contents}</{tag}>\n"));
    }
}

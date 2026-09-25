//! The canonical YAML form of fusen files.
//!
//! serde_norway does not indent sequences inside mappings and does not always
//! use literal block scalars, so the canonical form is written by hand.
//! Scalars that are not written as block scalars are rendered by serde_norway.

use serde_norway::{Mapping, Value};

use super::{Fusen, FusenFile, Reply};

/// Writes a fusen file in canonical form. Sorting is done by the caller.
pub(super) fn write(file: &FusenFile) -> String {
    let mut out = String::new();
    emit_map(&mut out, &file.to_node(), 0, None);
    out
}

enum Node {
    Str(String),
    Scalar(String),
    Map(Vec<(String, Node)>),
    Seq(Vec<Node>),
}

impl FusenFile {
    fn to_node(&self) -> Node {
        let mut m = vec![
            ("version".into(), Node::Scalar(self.version.to_string())),
            ("document".into(), Node::Str(self.document.clone())),
            (
                "fusen".into(),
                Node::Seq(self.fusen.iter().map(Fusen::to_node).collect()),
            ),
        ];
        extend_extra(&mut m, &self.extra);
        Node::Map(m)
    }
}

impl Fusen {
    fn to_node(&self) -> Node {
        let mut m = vec![
            ("id".into(), Node::Str(self.id.clone())),
            ("kind".into(), Node::Str(self.kind.clone())),
            ("status".into(), Node::Str(self.status.as_str().into())),
            ("body".into(), Node::Str(self.body.clone())),
        ];
        if let Some(anchor) = &self.anchor {
            let mut a = vec![
                ("quote".into(), Node::Str(anchor.quote.clone())),
                ("lines".into(), Node::Str(anchor.lines.to_string())),
            ];
            extend_extra(&mut a, &anchor.extra);
            m.push(("anchor".into(), Node::Map(a)));
        }
        m.push(("docHash".into(), Node::Str(self.doc_hash.clone())));
        m.push(("createdAt".into(), Node::Str(self.created_at.clone())));
        if !self.replies.is_empty() {
            let replies = self.replies.iter().map(Reply::to_node).collect();
            m.push(("replies".into(), Node::Seq(replies)));
        }
        extend_extra(&mut m, &self.extra);
        Node::Map(m)
    }
}

impl Reply {
    fn to_node(&self) -> Node {
        let mut m = vec![
            ("id".into(), Node::Str(self.id.clone())),
            ("author".into(), Node::Str(self.author.clone())),
            ("body".into(), Node::Str(self.body.clone())),
            ("createdAt".into(), Node::Str(self.created_at.clone())),
        ];
        extend_extra(&mut m, &self.extra);
        Node::Map(m)
    }
}

fn extend_extra(m: &mut Vec<(String, Node)>, extra: &Mapping) {
    for (k, v) in extra {
        m.push((scalar_of(k), value_node(v)));
    }
}

fn value_node(v: &Value) -> Node {
    match v {
        Value::String(s) => Node::Str(s.clone()),
        Value::Sequence(items) => Node::Seq(items.iter().map(value_node).collect()),
        Value::Mapping(map) => Node::Map(
            map.iter()
                .map(|(k, v)| (scalar_of(k), value_node(v)))
                .collect(),
        ),
        Value::Tagged(t) => value_node(&t.value),
        other => Node::Scalar(scalar_of(other)),
    }
}

fn scalar_of(v: &Value) -> String {
    match v {
        Value::String(s) => plain_or_quoted(s),
        other => serde_norway::to_string(other)
            .map(|s| s.trim_end().to_string())
            .unwrap_or_default(),
    }
}

fn plain_or_quoted(s: &str) -> String {
    serde_norway::to_string(s)
        .map(|s| s.trim_end_matches('\n').to_string())
        .unwrap_or_default()
}

/// The header of a literal block scalar for `s` (such as `|-`), or `None` if
/// `s` cannot be written as one.
fn block_header(s: &str) -> Option<String> {
    if !s.contains('\n')
        || s.chars()
            .any(|c| (c.is_control() && c != '\n' && c != '\t') || c == '\u{feff}')
    {
        return None;
    }
    let first_content = s.split('\n').find(|l| !l.trim().is_empty())?;
    let indicator = if first_content.starts_with(' ') {
        "2"
    } else {
        ""
    };
    let chomping = if !s.ends_with('\n') {
        "-"
    } else if s.ends_with("\n\n") {
        "+"
    } else {
        ""
    };
    Some(format!("|{indicator}{chomping}"))
}

fn emit_scalar_value(out: &mut String, lead: &str, s: &str, indent: usize) {
    match block_header(s) {
        Some(header) => {
            out.push_str(lead);
            out.push_str(&header);
            out.push('\n');
            let content = s.strip_suffix('\n').unwrap_or(s);
            for line in content.split('\n') {
                if !line.is_empty() {
                    out.push_str(&" ".repeat(indent));
                    out.push_str(line);
                }
                out.push('\n');
            }
        }
        None => {
            out.push_str(lead);
            out.push_str(&plain_or_quoted(s));
            out.push('\n');
        }
    }
}

fn emit_map(out: &mut String, entries: &Node, indent: usize, mut first_lead: Option<String>) {
    let Node::Map(entries) = entries else {
        unreachable!("emit_map is called with a map")
    };
    for (key, value) in entries {
        let pad = first_lead.take().unwrap_or_else(|| " ".repeat(indent));
        let key = if key.contains(|c: char| !c.is_ascii_alphanumeric() && c != '_' && c != '-') {
            plain_or_quoted(key)
        } else {
            key.clone()
        };
        let lead = format!("{pad}{key}: ");
        match value {
            Node::Str(s) => emit_scalar_value(out, &lead, s, indent + 2),
            Node::Scalar(s) => {
                out.push_str(&lead);
                out.push_str(s);
                out.push('\n');
            }
            Node::Map(m) if m.is_empty() => out.push_str(&format!("{lead}{{}}\n")),
            Node::Map(_) => {
                out.push_str(&format!("{pad}{key}:\n"));
                emit_map(out, value, indent + 2, None);
            }
            Node::Seq(items) if items.is_empty() => out.push_str(&format!("{lead}[]\n")),
            Node::Seq(items) => {
                out.push_str(&format!("{pad}{key}:\n"));
                for item in items {
                    emit_item(out, item, indent + 2);
                }
            }
        }
    }
}

fn emit_item(out: &mut String, item: &Node, indent: usize) {
    let lead = format!("{}- ", " ".repeat(indent));
    match item {
        Node::Str(s) => emit_scalar_value(out, &lead, s, indent + 2),
        Node::Scalar(s) => out.push_str(&format!("{lead}{s}\n")),
        Node::Map(m) if m.is_empty() => out.push_str(&format!("{lead}{{}}\n")),
        Node::Map(_) => emit_map(out, item, indent + 2, Some(lead)),
        Node::Seq(items) if items.is_empty() => out.push_str(&format!("{lead}[]\n")),
        Node::Seq(items) => {
            out.push_str(&format!("{}-\n", " ".repeat(indent)));
            for item in items {
                emit_item(out, item, indent + 2);
            }
        }
    }
}

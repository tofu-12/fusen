//! Fusen and reply IDs.

/// Whether `id` matches `[A-Za-z0-9_-]{1,64}`.
pub fn is_valid_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Generates a new ID (a ULID).
pub fn new_id() -> String {
    ulid::Ulid::generate().to_string()
}

/// The shortest prefix of each ID that is unique among `ids`, at least
/// `min_len` characters long, like an abbreviated git commit hash.
pub fn short_ids(ids: &[&str], min_len: usize) -> Vec<String> {
    ids.iter()
        .map(|id| {
            let mut len = min_len.min(id.len());
            while len < id.len()
                && ids
                    .iter()
                    .any(|other| other != id && other.starts_with(&id[..len]))
            {
                len += 1;
            }
            id[..len].to_string()
        })
        .collect()
}

/// The result of resolving a possibly shortened ID.
#[derive(Debug, PartialEq, Eq)]
pub enum Resolved<'a> {
    Found(&'a str),
    NotFound,
    Ambiguous(Vec<&'a str>),
}

/// Finds the one ID in `ids` that starts with `prefix`, like a git commit hash.
/// An exact match always wins.
pub fn resolve_prefix<'a, I>(ids: I, prefix: &str) -> Resolved<'a>
where
    I: IntoIterator<Item = &'a str>,
{
    if prefix.is_empty() {
        return Resolved::NotFound;
    }
    let matches: Vec<&str> = ids
        .into_iter()
        .filter(|id| id.starts_with(prefix))
        .collect();
    if let Some(exact) = matches.iter().find(|id| **id == prefix) {
        return Resolved::Found(exact);
    }
    match matches.len() {
        0 => Resolved::NotFound,
        1 => Resolved::Found(matches[0]),
        _ => Resolved::Ambiguous(matches),
    }
}

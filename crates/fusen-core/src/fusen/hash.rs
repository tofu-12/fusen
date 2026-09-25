//! `docHash`: the git blob hash of a document.

use sha1::{Digest, Sha1};

/// Returns the git blob hash of `content`, the same value as `git hash-object`.
pub fn doc_hash(content: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(format!("blob {}\0", content.len()).as_bytes());
    hasher.update(content);
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

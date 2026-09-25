//! The project root, path resolution, and Markdown file discovery.

use std::path::{Component, Path, PathBuf};

use crate::error::{Error, Result};

pub const FUSEN_DIR: &str = ".fusen";
const FUSEN_FILE_SUFFIX: &str = ".fusen.yaml";

/// A project: the directory `fusen` runs in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    root: PathBuf,
}

/// What a path argument points to. Paths are relative to the project root and
/// use `/` as the separator; the root itself is `""`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    Dir(String),
    File(String),
}

impl Project {
    pub fn new(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        let root = root.canonicalize().map_err(Error::io(root))?;
        Ok(Self { root })
    }

    /// The project for the current directory.
    pub fn current() -> Result<Self> {
        let cwd = std::env::current_dir().map_err(Error::io("."))?;
        Self::new(cwd)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Resolves a path argument, relative to the project root, to a Markdown
    /// file or a directory inside the project.
    pub fn resolve(&self, arg: impl AsRef<Path>) -> Result<Target> {
        let arg = arg.as_ref();
        let shown = arg.display().to_string();
        let path = self.root.join(arg);
        let meta = path
            .metadata()
            .map_err(|_| Error::NoSuchPath(shown.clone()))?;
        let canonical = path.canonicalize().map_err(Error::io(&path))?;
        let rel = canonical
            .strip_prefix(&self.root)
            .map_err(|_| Error::OutsideRoot(shown.clone()))?;
        let rel = to_slash(rel);
        if meta.is_dir() {
            Ok(Target::Dir(rel))
        } else if is_markdown(&canonical) {
            Ok(Target::File(rel))
        } else {
            Err(Error::NotMarkdown(shown))
        }
    }

    /// Resolves a path argument that must be a Markdown file.
    pub fn resolve_file(&self, arg: impl AsRef<Path>) -> Result<String> {
        match self.resolve(arg.as_ref())? {
            Target::File(rel) => Ok(rel),
            Target::Dir(_) => Err(Error::NotMarkdownFile(arg.as_ref().display().to_string())),
        }
    }

    /// The Markdown files for a target, sorted by path.
    ///
    /// Files excluded by `.gitignore` (and `.ignore`, the global gitignore),
    /// `.git/`, and `.fusen/` are skipped.
    pub fn markdown_files(&self, target: &Target) -> Vec<String> {
        let dir = match target {
            Target::File(rel) => return vec![rel.clone()],
            Target::Dir(rel) => self.root.join(rel),
        };
        let walker = ignore::WalkBuilder::new(&dir)
            .hidden(false)
            .require_git(false)
            .filter_entry(|e| {
                let name = e.file_name();
                !(e.file_type().is_some_and(|t| t.is_dir())
                    && (name == ".git" || name == FUSEN_DIR))
            })
            .build();
        let mut files: Vec<String> = walker
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_some_and(|t| t.is_file()) && is_markdown(e.path()))
            .filter_map(|e| e.path().strip_prefix(&self.root).ok().map(to_slash))
            .collect();
        files.sort();
        files
    }

    /// The absolute path of a document.
    pub fn doc_path(&self, doc: &str) -> PathBuf {
        self.root.join(doc)
    }

    /// The absolute path of a document's fusen file.
    pub fn fusen_path(&self, doc: &str) -> PathBuf {
        self.root
            .join(FUSEN_DIR)
            .join(format!("{doc}{FUSEN_FILE_SUFFIX}"))
    }

    /// The document a fusen file belongs to, if `path` is a fusen file.
    pub fn doc_of_fusen_path(&self, path: &Path) -> Option<String> {
        let rel = path.strip_prefix(self.root.join(FUSEN_DIR)).ok()?;
        to_slash(rel)
            .strip_suffix(FUSEN_FILE_SUFFIX)
            .map(str::to_string)
    }

    /// The document at `path`, if it is a Markdown file in the project.
    pub fn doc_of_path(&self, path: &Path) -> Option<String> {
        let rel = path.strip_prefix(&self.root).ok()?;
        let first = rel.components().next()?;
        if first == Component::Normal(FUSEN_DIR.as_ref())
            || first == Component::Normal(".git".as_ref())
        {
            return None;
        }
        is_markdown(path).then(|| to_slash(rel))
    }
}

pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("md"))
}

fn to_slash(path: &Path) -> String {
    path.components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

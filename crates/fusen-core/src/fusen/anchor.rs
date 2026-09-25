//! Anchors: line ranges and locations.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// A line range, written as `<start>-<end>` (1-based, inclusive).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

impl LineRange {
    pub fn new(start: u32, end: u32) -> Option<Self> {
        (start >= 1 && start <= end).then_some(Self { start, end })
    }
}

impl fmt::Display for LineRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}-{}", self.start, self.end)
    }
}

impl FromStr for LineRange {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let invalid = || format!("invalid line range: {s}");
        let (start, end) = s.split_once('-').ok_or_else(invalid)?;
        let start = start.parse().map_err(|_| invalid())?;
        let end = end.parse().map_err(|_| invalid())?;
        Self::new(start, end).ok_or_else(invalid)
    }
}

impl Serialize for LineRange {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

impl<'de> Deserialize<'de> for LineRange {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}

/// The location of a fusen: `path`, `path:line`, or `path:start-end`.
pub fn location(document: &str, lines: Option<LineRange>) -> String {
    match lines {
        None => document.to_string(),
        Some(r) if r.start == r.end => format!("{document}:{}", r.start),
        Some(r) => format!("{document}:{r}"),
    }
}

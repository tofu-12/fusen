//! The settings file (`$XDG_CONFIG_HOME/fusen/settings.json`).
//!
//! See docs/config-format/v1.md. The file is kept as a JSON map so that keys
//! Fusen does not know are preserved when it is written back.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use ts_rs::TS;

use crate::error::{Error, Result};

pub const DEFAULT_USER_NAME: &str = "user";
pub const DEFAULT_LANGUAGE: &str = "English";
pub const DEFAULT_COLOR: &str = "#87ceeb";
pub const THEMES: [&str; 2] = ["light", "dark"];

const BUILTIN_KINDS: [(&str, &str, &str); 3] = [
    (
        "comment",
        "Comment",
        "Feedback on the document. Consider it and update the document if appropriate.",
    ),
    (
        "question",
        "Question",
        "A question about the document. Answer it, then clarify the document so the question no longer arises.",
    ),
    (
        "suggestion",
        "Suggestion",
        "A suggested change to the document. Apply it, adapting it to the document if needed.",
    ),
];

const KIND_FIELDS: [&str; 3] = ["label", "description", "color"];

/// A fusen kind, with defaults filled in.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Kind {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub color: String,
}

/// All settings, with defaults filled in.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Settings {
    pub user_name: String,
    pub language: String,
    /// `light` or `dark`.
    pub theme: String,
    pub kinds: Vec<Kind>,
}

/// The settings file. `Config::default()` has every key at its default.
#[derive(Debug, Clone, Default)]
pub struct Config {
    path: PathBuf,
    map: Map<String, Value>,
}

/// The path of the settings file.
pub fn default_path() -> PathBuf {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join(".config"));
    base.join("fusen").join("settings.json")
}

fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
}

pub fn is_valid_kind_id(id: &str) -> bool {
    (1..=32).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
}

pub fn is_valid_color(color: &str) -> bool {
    color.len() == 7 && color.starts_with('#') && color[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

/// A parsed settings key.
enum Key<'a> {
    UserName,
    Language,
    Theme,
    Kinds,
    Kind(&'a str),
    KindField(&'a str, &'a str),
}

impl<'a> Key<'a> {
    fn parse(key: &'a str) -> Result<Self> {
        let parts: Vec<&str> = key.split('.').collect();
        let key = match parts.as_slice() {
            ["user", "name"] => Key::UserName,
            ["prompt", "language"] => Key::Language,
            ["appearance", "theme"] => Key::Theme,
            ["kinds"] => Key::Kinds,
            ["kinds", id] => Key::Kind(id),
            ["kinds", id, field] if KIND_FIELDS.contains(field) => Key::KindField(id, field),
            _ => return Err(Error::UnknownKey(key.to_string())),
        };
        if let Key::Kind(id) | Key::KindField(id, _) = key
            && !is_valid_kind_id(id)
        {
            return Err(Error::InvalidKindId(id.to_string()));
        }
        Ok(key)
    }
}

impl Config {
    /// Loads the settings file. A missing file means all defaults.
    ///
    /// Fixes the kinds (see `normalize_kinds`), and updates the file if that
    /// changes it.
    pub fn load(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        let map = match fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| Error::InvalidSettings {
                path: path.clone(),
                message: e.to_string(),
            })?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Map::new(),
            Err(e) => return Err(Error::io(&path)(e)),
        };
        let mut config = Self { path, map };
        if config.normalize_kinds() {
            // Best effort: a read-only settings file still works in memory.
            let _ = config.save();
        }
        Ok(config)
    }

    /// Adds the built-in kinds if there are none, removes kinds whose ID is
    /// invalid, and replaces invalid colors with the default color. Returns
    /// whether anything changed.
    fn normalize_kinds(&mut self) -> bool {
        let mut changed = false;
        let kinds = self
            .map
            .entry("kinds")
            .or_insert_with(|| Value::Object(Map::new()));
        if !kinds.is_object() {
            *kinds = Value::Object(Map::new());
        }
        let kinds = kinds.as_object_mut().unwrap();
        let before = kinds.len();
        kinds.retain(|id, v| is_valid_kind_id(id) && v.is_object());
        changed |= kinds.len() != before;
        for kind in kinds.values_mut().filter_map(Value::as_object_mut) {
            let invalid = kind
                .get("color")
                .is_some_and(|c| !c.as_str().is_some_and(is_valid_color));
            if invalid {
                kind.insert("color".into(), json!(DEFAULT_COLOR));
                changed = true;
            }
        }
        if kinds.is_empty() {
            *kinds = builtin_kinds();
            changed = true;
        }
        changed
    }

    pub fn load_default() -> Result<Self> {
        Self::load(default_path())
    }

    /// Writes the settings file atomically.
    pub fn save(&mut self) -> Result<()> {
        self.normalize_kinds();
        let dir = self.path.parent().expect("settings path has a parent");
        fs::create_dir_all(dir).map_err(Error::io(dir))?;
        let mut text = serde_json::to_string_pretty(&self.map).expect("JSON map serializes");
        text.push('\n');
        let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(Error::io(dir))?;
        tmp.write_all(text.as_bytes())
            .map_err(Error::io(tmp.path()))?;
        tmp.persist(&self.path)
            .map_err(|e| Error::io(&self.path)(e.error))?;
        Ok(())
    }

    fn string_at(&self, section: &str, key: &str) -> Option<&str> {
        self.map.get(section)?.get(key)?.as_str()
    }

    pub fn user_name(&self) -> String {
        self.string_at("user", "name")
            .unwrap_or(DEFAULT_USER_NAME)
            .to_string()
    }

    pub fn theme(&self) -> String {
        self.string_at("appearance", "theme")
            .filter(|t| THEMES.contains(t))
            .unwrap_or(THEMES[0])
            .to_string()
    }

    pub fn language(&self) -> String {
        self.string_at("prompt", "language")
            .unwrap_or(DEFAULT_LANGUAGE)
            .to_string()
    }

    /// The kinds in use, in order. The built-in kinds if there are none.
    pub fn kinds(&self) -> Vec<Kind> {
        let kinds: Vec<Kind> = self
            .map
            .get("kinds")
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter(|(id, v)| is_valid_kind_id(id) && v.is_object())
            .map(|(id, v)| resolve_kind(id, v))
            .collect();
        if kinds.is_empty() {
            builtin_kinds()
                .iter()
                .map(|(id, v)| resolve_kind(id, v))
                .collect()
        } else {
            kinds
        }
    }

    pub fn settings(&self) -> Settings {
        Settings {
            user_name: self.user_name(),
            language: self.language(),
            theme: self.theme(),
            kinds: self.kinds(),
        }
    }

    /// The value shown by `fusen config [<key>]`, with defaults filled in.
    pub fn get(&self, key: Option<&str>) -> Result<Value> {
        let kinds_json = || {
            let mut m = Map::new();
            for kind in self.kinds() {
                m.insert(kind.id.clone(), kind_json(&kind));
            }
            Value::Object(m)
        };
        let Some(key) = key else {
            return Ok(json!({
                "user": { "name": self.user_name() },
                "prompt": { "language": self.language() },
                "appearance": { "theme": self.theme() },
                "kinds": kinds_json(),
            }));
        };
        let find_kind = |id: &str| {
            self.kinds()
                .into_iter()
                .find(|k| k.id == id)
                .ok_or_else(|| Error::NoSuchKind(id.to_string()))
        };
        Ok(match Key::parse(key)? {
            Key::UserName => json!(self.user_name()),
            Key::Language => json!(self.language()),
            Key::Theme => json!(self.theme()),
            Key::Kinds => kinds_json(),
            Key::Kind(id) => kind_json(&find_kind(id)?),
            Key::KindField(id, field) => kind_json(&find_kind(id)?)
                .get(field)
                .cloned()
                .unwrap_or(Value::Null),
        })
    }

    /// Sets a key, as `fusen config <key> <value>`.
    pub fn set(&mut self, key: &str, value: &str) -> Result<()> {
        match Key::parse(key)? {
            Key::UserName => set_in(&mut self.map, "user", "name", value),
            Key::Language => set_in(&mut self.map, "prompt", "language", value),
            Key::Theme => {
                if !THEMES.contains(&value) {
                    return Err(Error::InvalidTheme(value.to_string()));
                }
                set_in(&mut self.map, "appearance", "theme", value);
            }
            Key::KindField(id, field) => {
                if field == "color" && !is_valid_color(value) {
                    return Err(Error::InvalidColor(value.to_string()));
                }
                let kinds = self.kinds_map_mut();
                let kind = kinds
                    .entry(id.to_string())
                    .or_insert_with(|| Value::Object(Map::new()));
                if !kind.is_object() {
                    *kind = Value::Object(Map::new());
                }
                kind.as_object_mut()
                    .unwrap()
                    .insert(field.to_string(), json!(value));
            }
            Key::Kinds | Key::Kind(_) => return Err(Error::UnknownKey(key.to_string())),
        }
        Ok(())
    }

    /// Removes a key, as `fusen config --unset <key>`.
    pub fn unset(&mut self, key: &str) -> Result<()> {
        match Key::parse(key)? {
            Key::UserName => unset_in(&mut self.map, "user", "name"),
            Key::Language => unset_in(&mut self.map, "prompt", "language"),
            Key::Theme => unset_in(&mut self.map, "appearance", "theme"),
            Key::Kinds => {
                self.map.shift_remove("kinds");
                self.normalize_kinds();
            }
            Key::Kind(id) => {
                self.kinds_map_mut().shift_remove(id);
            }
            Key::KindField(id, field) => {
                if let Some(kind) = self
                    .kinds_map_mut()
                    .get_mut(id)
                    .and_then(Value::as_object_mut)
                {
                    kind.shift_remove(field);
                }
            }
        }
        Ok(())
    }

    /// Replaces all settings, as the settings window does. Keys Fusen does not
    /// know are kept, including those inside kinds that still exist.
    pub fn replace(&mut self, settings: &Settings) -> Result<()> {
        for kind in &settings.kinds {
            if !is_valid_kind_id(&kind.id) {
                return Err(Error::InvalidKindId(kind.id.clone()));
            }
            if !is_valid_color(&kind.color) {
                return Err(Error::InvalidColor(kind.color.clone()));
            }
        }
        set_in(&mut self.map, "user", "name", &settings.user_name);
        set_in(&mut self.map, "prompt", "language", &settings.language);
        if !THEMES.contains(&settings.theme.as_str()) {
            return Err(Error::InvalidTheme(settings.theme.clone()));
        }
        set_in(&mut self.map, "appearance", "theme", &settings.theme);
        let old = self.kinds_map_mut().clone();
        let mut kinds = Map::new();
        for kind in &settings.kinds {
            let mut obj = old
                .get(&kind.id)
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default();
            obj.insert("label".into(), json!(kind.label));
            match &kind.description {
                Some(d) => obj.insert("description".into(), json!(d)),
                None => obj.shift_remove("description"),
            };
            obj.insert("color".into(), json!(kind.color));
            kinds.insert(kind.id.clone(), Value::Object(obj));
        }
        self.map.insert("kinds".into(), Value::Object(kinds));
        Ok(())
    }

    /// The `kinds` object, created from the built-in kinds if it is not set,
    /// so that adding a kind does not drop the built-in ones.
    fn kinds_map_mut(&mut self) -> &mut Map<String, Value> {
        let kinds = self
            .map
            .entry("kinds")
            .or_insert_with(|| Value::Object(builtin_kinds()));
        if !kinds.is_object() {
            *kinds = Value::Object(builtin_kinds());
        }
        kinds.as_object_mut().unwrap()
    }
}

fn builtin_kinds() -> Map<String, Value> {
    BUILTIN_KINDS
        .iter()
        .map(|(id, label, description)| {
            (
                id.to_string(),
                json!({ "label": label, "description": description }),
            )
        })
        .collect()
}

fn resolve_kind(id: &str, v: &Value) -> Kind {
    let field = |name: &str| v.get(name).and_then(Value::as_str).map(str::to_string);
    Kind {
        id: id.to_string(),
        label: field("label").unwrap_or_else(|| default_label(id)),
        description: field("description"),
        color: field("color")
            .filter(|c| is_valid_color(c))
            .unwrap_or_else(|| DEFAULT_COLOR.to_string()),
    }
}

/// The default label of a kind: its ID with the first letter capitalized.
pub fn default_label(id: &str) -> String {
    let mut chars = id.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn kind_json(kind: &Kind) -> Value {
    let mut m = Map::new();
    m.insert("label".into(), json!(kind.label));
    if let Some(d) = &kind.description {
        m.insert("description".into(), json!(d));
    }
    m.insert("color".into(), json!(kind.color));
    Value::Object(m)
}

fn set_in(map: &mut Map<String, Value>, section: &str, key: &str, value: &str) {
    let obj = map
        .entry(section)
        .or_insert_with(|| Value::Object(Map::new()));
    if !obj.is_object() {
        *obj = Value::Object(Map::new());
    }
    obj.as_object_mut()
        .unwrap()
        .insert(key.to_string(), json!(value));
}

fn unset_in(map: &mut Map<String, Value>, section: &str, key: &str) {
    if let Some(obj) = map.get_mut(section).and_then(Value::as_object_mut) {
        obj.shift_remove(key);
        if obj.is_empty() {
            map.shift_remove(section);
        }
    }
}

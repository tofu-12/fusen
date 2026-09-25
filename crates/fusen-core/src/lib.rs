//! Shared logic for the `fusen` command and Fusen.app.

pub mod config;
pub mod error;
pub mod fusen;
pub mod project;
pub mod prompt;

pub use error::{Error, Result};

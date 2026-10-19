pub mod add;
pub mod close;
pub mod config;
pub mod list;
pub mod open;
pub mod prompt;
pub mod reply;
pub mod show;

use std::io::Read;

pub type Result = fusen_core::Result<std::process::ExitCode>;

/// A message argument, or standard input if it is `-`.
pub fn read_message(message: &str) -> fusen_core::Result<String> {
    if message != "-" {
        return Ok(message.to_string());
    }
    let mut buf = String::new();
    std::io::stdin()
        .read_to_string(&mut buf)
        .map_err(fusen_core::Error::io("<stdin>"))?;
    Ok(buf.trim_end_matches(['\n', '\r']).to_string())
}

pub fn print_error(e: &fusen_core::Error) {
    eprintln!("{e}");
    if let Some(hint) = e.hint() {
        eprintln!("hint: {hint}");
    }
}

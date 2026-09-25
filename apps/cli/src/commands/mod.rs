pub mod close;
pub mod config;
pub mod list;
pub mod open;
pub mod prompt;
pub mod reply;
pub mod show;

pub type Result = fusen_core::Result<std::process::ExitCode>;

pub fn print_error(e: &fusen_core::Error) {
    eprintln!("{e}");
    if let Some(hint) = e.hint() {
        eprintln!("hint: {hint}");
    }
}

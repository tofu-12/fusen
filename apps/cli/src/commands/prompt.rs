use std::path::Path;
use std::process::ExitCode;

use fusen_core::Error;
use fusen_core::config::Config;
use fusen_core::project::Project;
use fusen_core::prompt::{self, Filter};

pub fn run(path: &Path, copy: bool, outdated: bool, closed: bool) -> super::Result {
    let project = Project::current()?;
    let target = project.resolve(path)?;
    let config = Config::load_default()?;
    let docs = prompt::collect(&project, &target, Filter { outdated, closed })?;
    let Some(text) = prompt::render(&docs, &config.kinds(), &config.language()) else {
        eprintln!("No fusen to include in the prompt.");
        return Ok(ExitCode::SUCCESS);
    };
    if copy {
        arboard::Clipboard::new()
            .and_then(|mut c| c.set_text(text))
            .map_err(|e| Error::Clipboard(e.to_string()))?;
        eprintln!("Copied the prompt to the clipboard.");
    } else {
        print!("{text}");
    }
    Ok(ExitCode::SUCCESS)
}

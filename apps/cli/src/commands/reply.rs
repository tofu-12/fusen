use std::path::Path;
use std::process::ExitCode;

use fusen_core::config::Config;
use fusen_core::fusen::ops;
use fusen_core::project::Project;

pub fn run(file: &Path, id: &str, message: &str, author: Option<&str>) -> super::Result {
    let project = Project::current()?;
    let doc = project.resolve_file(file)?;
    let message = super::read_message(message)?;
    let author = match author {
        Some(a) => a.to_string(),
        None => Config::load_default()?.user_name(),
    };
    let (id, location) = ops::add_reply(&project, &doc, id, &author, &message)?;
    println!("replied to {id} ({location})");
    Ok(ExitCode::SUCCESS)
}

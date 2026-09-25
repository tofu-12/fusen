use std::io::Read;
use std::path::Path;
use std::process::ExitCode;

use fusen_core::Error;
use fusen_core::config::Config;
use fusen_core::fusen::ops;
use fusen_core::project::Project;

pub fn run(file: &Path, id: &str, message: &str, author: Option<&str>) -> super::Result {
    let project = Project::current()?;
    let doc = project.resolve_file(file)?;
    let message = if message == "-" {
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .map_err(Error::io("<stdin>"))?;
        buf.trim_end_matches(['\n', '\r']).to_string()
    } else {
        message.to_string()
    };
    let author = match author {
        Some(a) => a.to_string(),
        None => Config::load_default()?.user_name(),
    };
    let (id, location) = ops::add_reply(&project, &doc, id, &author, &message)?;
    println!("replied to {id} ({location})");
    Ok(ExitCode::SUCCESS)
}

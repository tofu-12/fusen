use std::path::Path;
use std::process::ExitCode;

use fusen_core::fusen::{Status, ops};
use fusen_core::project::Project;

/// `fusen close`, or `fusen reopen` if `reopen` is set.
pub fn run(file: &Path, ids: &[String], reopen: bool) -> super::Result {
    let project = Project::current()?;
    let doc = project.resolve_file(file)?;
    let (status, verb, state) = if reopen {
        (Status::Open, "reopened", "open")
    } else {
        (Status::Closed, "closed", "closed")
    };
    let mut code = ExitCode::SUCCESS;
    for result in ops::set_status(&project, &doc, ids, status)? {
        match result {
            Ok(c) if c.changed => println!("{verb} {} ({})", c.id, c.location),
            Ok(c) => println!("already {state} {} ({})", c.id, c.location),
            Err(e) => {
                super::print_error(&e);
                code = ExitCode::FAILURE;
            }
        }
    }
    Ok(code)
}

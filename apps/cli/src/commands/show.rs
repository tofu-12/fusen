use std::path::Path;
use std::process::ExitCode;

use fusen_core::fusen::anchor::location;
use fusen_core::fusen::ops;
use fusen_core::project::Project;

pub fn run(file: &Path, id: &str) -> super::Result {
    let project = Project::current()?;
    let doc = project.resolve_file(file)?;
    let (fusen, state) = ops::find_fusen(&project, &doc, id)?;

    println!("fusen {}", fusen.id);
    println!("Kind:     {}", fusen.kind);
    println!("State:    {}", state.as_str());
    println!("Location: {}", location(&doc, fusen.lines()));
    println!("Created:  {}", fusen.created_at);
    if let Some(anchor) = &fusen.anchor {
        println!();
        println!("Quote:");
        print_indented(&anchor.quote);
    }
    if !fusen.body.is_empty() {
        println!();
        println!("Text:");
        print_indented(&fusen.body);
    }
    for reply in &fusen.replies {
        println!();
        println!("Reply from {} at {}:", reply.author, reply.created_at);
        print_indented(&reply.body);
    }
    Ok(ExitCode::SUCCESS)
}

fn print_indented(text: &str) {
    for line in text.lines() {
        if line.is_empty() {
            println!();
        } else {
            println!("    {line}");
        }
    }
}

mod commands;

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};

/// Local Markdown review tool for AI-assisted writing.
#[derive(Parser)]
#[command(
    name = "fusen",
    version,
    args_conflicts_with_subcommands = true,
    arg_required_else_help = true
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Open a Markdown file or directory in the Fusen window
    path: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Command {
    /// Show or change settings
    Config {
        key: Option<String>,
        value: Option<String>,
        /// Remove the setting
        #[arg(long, value_name = "KEY", conflicts_with_all = ["key", "value"])]
        unset: Option<String>,
    },
    /// List fusen
    List {
        path: PathBuf,
        /// Also include outdated fusen: open fusen whose document has changed since they were added
        #[arg(long)]
        outdated: bool,
        /// Also include closed fusen
        #[arg(long)]
        closed: bool,
        /// Include all fusen
        #[arg(long)]
        all: bool,
    },
    /// Show a fusen and its replies
    Show { file: PathBuf, id: String },
    /// Output an AI prompt from fusen
    Prompt {
        path: PathBuf,
        /// Copy the prompt to the clipboard instead of writing it to standard output
        #[arg(short, long)]
        copy: bool,
        /// Also include outdated fusen: open fusen whose document has changed since they were added
        #[arg(long)]
        outdated: bool,
        /// Also include closed fusen
        #[arg(long)]
        closed: bool,
        /// Include all fusen
        #[arg(long)]
        all: bool,
    },
    /// Mark fusen as closed
    Close { file: PathBuf, ids: Vec<String> },
    /// Mark fusen as open again
    Reopen { file: PathBuf, ids: Vec<String> },
    /// Reply to a fusen
    Reply {
        file: PathBuf,
        id: String,
        /// The reply, or "-" to read it from standard input
        message: String,
        /// Name to record as the author of the reply [default: user.name]
        #[arg(long)]
        author: Option<String>,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let result = match (cli.command, cli.path) {
        (Some(Command::Config { key, value, unset }), _) => {
            commands::config::run(key.as_deref(), value.as_deref(), unset.as_deref())
        }
        (
            Some(Command::Prompt {
                path,
                copy,
                outdated,
                closed,
                all,
            }),
            _,
        ) => commands::prompt::run(&path, copy, outdated || all, closed || all),
        (
            Some(Command::List {
                path,
                outdated,
                closed,
                all,
            }),
            _,
        ) => commands::list::run(&path, outdated || all, closed || all),
        (Some(Command::Show { file, id }), _) => commands::show::run(&file, &id),
        (Some(Command::Close { file, ids }), _) => commands::close::run(&file, &ids, false),
        (Some(Command::Reopen { file, ids }), _) => commands::close::run(&file, &ids, true),
        (
            Some(Command::Reply {
                file,
                id,
                message,
                author,
            }),
            _,
        ) => commands::reply::run(&file, &id, &message, author.as_deref()),
        (None, Some(path)) => commands::open::run(&path),
        (None, None) => unreachable!("clap shows help without arguments"),
    };
    match result {
        Ok(code) => code,
        Err(e) => {
            commands::print_error(&e);
            ExitCode::FAILURE
        }
    }
}

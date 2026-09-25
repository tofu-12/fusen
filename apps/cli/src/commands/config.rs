use std::process::ExitCode;

use fusen_core::config::Config;

pub fn run(key: Option<&str>, value: Option<&str>, unset: Option<&str>) -> super::Result {
    let mut config = Config::load_default()?;
    match (key, value, unset) {
        (_, _, Some(key)) => {
            config.unset(key)?;
            config.save()?;
        }
        (Some(key), Some(value), None) => {
            config.set(key, value)?;
            config.save()?;
        }
        (key, None, None) => {
            let value = config.get(key)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&value).expect("JSON serializes")
            );
        }
        (None, Some(_), None) => unreachable!("clap fills key before value"),
    }
    Ok(ExitCode::SUCCESS)
}

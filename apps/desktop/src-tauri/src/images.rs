//! Serves images in the project to the preview through the `fusen-file`
//! protocol. Only image files inside the open project are served.

use std::borrow::Cow;
use std::path::Path;

use percent_encoding::percent_decode_str;
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{Manager, Runtime, UriSchemeContext};

use crate::commands::AppState;

/// The protocol the preview loads images from.
pub const PROTOCOL: &str = "fusen-file";

/// The media type of an image file, or `None` if it is not an image.
pub fn media_type(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => return None,
    })
}

/// Handles `fusen-file://localhost/<path>`, where `<path>` is relative to the
/// project root.
pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Cow<'static, [u8]>> {
    let respond = |status: StatusCode, media_type: &str, body: Vec<u8>| {
        Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, media_type)
            .header(header::CACHE_CONTROL, "no-cache")
            .body(Cow::Owned(body))
            .unwrap()
    };
    let not_found = || respond(StatusCode::NOT_FOUND, "text/plain", Vec::new());

    let rel = percent_decode_str(request.uri().path().trim_start_matches('/')).decode_utf8_lossy();
    let root = {
        let state = ctx.app_handle().state::<AppState>();
        let guard = state.lock().unwrap();
        match guard.as_ref() {
            Some(session) => session.project.root().to_path_buf(),
            None => return not_found(),
        }
    };
    let Ok(path) = root.join(rel.as_ref()).canonicalize() else {
        return not_found();
    };
    let Some(media_type) = media_type(&path).filter(|_| path.starts_with(&root)) else {
        return not_found();
    };
    match std::fs::read(&path) {
        Ok(bytes) => respond(StatusCode::OK, media_type, bytes),
        Err(_) => not_found(),
    }
}

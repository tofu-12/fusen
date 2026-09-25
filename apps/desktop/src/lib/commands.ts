// Typed wrappers for the Tauri commands in src-tauri/src/commands.rs.

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { DocumentState } from "../bindings/DocumentState";
import type { FileEntry } from "../bindings/FileEntry";
import type { Fusen } from "../bindings/Fusen";
import type { NewAnchor } from "../bindings/NewAnchor";
import type { SessionInfo } from "../bindings/SessionInfo";
import type { Settings } from "../bindings/Settings";
import type { Status } from "../bindings/Status";

export const getSession = () => invoke<SessionInfo | null>("get_session");

export const listFiles = () => invoke<FileEntry[]>("list_files");

/** Checks that a link target is a Markdown file in the project. */
export const resolveDocument = (path: string) => invoke<string>("resolve_document", { path });

/** Opens a URL in the default browser. */
export const openExternal = (url: string) =>
  openUrl(url).catch(() => {
    // Running in a browser with the mock backend.
    window.open(url, "_blank");
  });

export const readDocument = (path: string) =>
  invoke<DocumentState>("read_document", { path });

export const addFusen = (args: {
  path: string;
  docHash: string;
  kind: string;
  body: string;
  anchor: NewAnchor | null;
}) => invoke<Fusen>("add_fusen", args);

export const editFusen = (path: string, id: string, kind: string, body: string) =>
  invoke<void>("edit_fusen", { path, id, kind, body });

export const deleteFusen = (path: string, ids: string[]) =>
  invoke<void>("delete_fusen", { path, ids });

export const setStatus = (path: string, ids: string[], status: Status) =>
  invoke<void>("set_status", { path, ids, status });

export const addReply = (path: string, id: string, body: string) =>
  invoke<void>("add_reply", { path, id, body });

export const getSettings = () => invoke<Settings>("get_settings");

export const defaultSettings = () => invoke<Settings>("default_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });

// Events sent from src-tauri (see watcher.rs and lib.rs).
export const onOpenTarget = (f: (info: SessionInfo) => void): Promise<UnlistenFn> =>
  listen<SessionInfo>("open-target", (e) => f(e.payload));

export const onFilesChanged = (f: () => void): Promise<UnlistenFn> =>
  listen("files-changed", () => f());

export const onDocumentChanged = (f: (path: string) => void): Promise<UnlistenFn> =>
  listen<string>("document-changed", (e) => f(e.payload));

export const onShowSettings = (f: () => void): Promise<UnlistenFn> =>
  listen("show-settings", () => f());

export const onImagesChanged = (f: () => void): Promise<UnlistenFn> =>
  listen("images-changed", () => f());

export const onSettingsChanged = (f: () => void): Promise<UnlistenFn> =>
  listen("settings-changed", () => f());

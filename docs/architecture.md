# Architecture

This document describes how Fusen is organized: its components, directory structure, and tech stack.

## Contents

- [1. Components](#1-components)
- [2. Directory structure](#2-directory-structure)
- [3. Tech stack](#3-tech-stack)
  - [3.1 Core and CLI (Rust)](#31-core-and-cli-rust)
  - [3.2 Desktop app (Tauri)](#32-desktop-app-tauri)
  - [3.3 UI (TypeScript)](#33-ui-typescript)
  - [3.4 Development tools](#34-development-tools)

## 1. Components

Fusen consists of two executables: the `fusen` command (CLI) and the desktop app (Fusen.app). Both use a shared library, `fusen-core`.

```mermaid
flowchart TB
    cli["Fusen CLI"] --> core["Fusen Core"]
    app["Fusen App"] --> core
    core --> data["Fusen Data<br/>.fusen/"]
```

| Component | Role |
|---|---|
| `fusen-core` | Reads and writes fusen files ([Fusen Review Format v1](fusen-format/v1.md)) and the settings file ([Fusen Config Format v1](config-format/v1.md)), generates prompts, computes `docHash`, and finds Markdown files. All logic shared by the CLI and the app lives here. |
| `fusen-cli` | The `fusen` command ([command reference](cli.md)). `fusen <path>` launches Fusen.app, passes the path to it, and exits. All other commands run without Fusen.app. |
| Tauri app | The Rust side of Fusen.app. Exposes `fusen-core` to the UI as Tauri commands, and notifies the UI of file changes through events. |
| UI | The screens of Fusen.app ([window reference](gui.md)): the Markdown view, fusen, and settings. |

## 2. Directory structure

```
fusen/
├── Cargo.toml                  # Cargo workspace
├── package.json                # pnpm workspace
├── pnpm-workspace.yaml
├── crates/
│   ├── fusen-core/             # Shared library
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── fusen_file.rs   # Fusen file types, reading and writing
│   │       ├── config.rs       # Settings file types, reading and writing
│   │       ├── project.rs      # Project root, path resolution, Markdown file discovery
│   │       ├── anchor.rs       # Line numbers, outdated detection
│   │       ├── hash.rs         # docHash (git blob hash)
│   │       ├── id.rs           # ULID generation, ID prefix matching
│   │       └── prompt.rs       # Prompt generation
│   └── fusen-cli/              # The fusen command
│       └── src/
│           ├── main.rs
│           └── commands/       # open / prompt / close / reopen / reply / config
├── apps/
│   └── desktop/                # Fusen.app
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── src/                # UI (React + TypeScript)
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── FileTree/        # File list
│       │   │   ├── DocumentView/    # Preview and source views
│       │   │   ├── FusenPanel/      # Fusen list and replies
│       │   │   └── Settings/        # Settings window
│       │   ├── lib/
│       │   │   ├── commands.ts      # Tauri command calls
│       │   │   └── sourceMap.ts     # Maps selections to source line numbers
│       │   └── bindings/            # TypeScript types generated from Rust types
│       └── src-tauri/          # Tauri app (Rust)
│           ├── Cargo.toml
│           ├── tauri.conf.json
│           └── src/
│               ├── main.rs
│               ├── commands.rs      # Tauri commands exposed to the UI
│               └── watcher.rs       # File watching
├── docs/
│   ├── cli.md
│   ├── gui.md
│   ├── fusen-format/
│   ├── config-format/
│   └── architecture.md
└── README.md
```

## 3. Tech stack

### 3.1 Core and CLI (Rust)

| Purpose | Library |
|---|---|
| Language | Rust (stable) |
| Command-line arguments | `clap` |
| YAML (fusen files) | `serde` + `serde_norway` |
| JSON (settings file) | `serde_json` with `preserve_order`, to keep the order of kinds |
| IDs | `ulid` |
| docHash | `sha1` |
| Markdown file discovery | `ignore`, which respects `.gitignore` |
| Clipboard (`--copy`) | `arboard` |
| TypeScript type generation | `ts-rs` |

### 3.2 Desktop app (Tauri)

| Purpose | Library |
|---|---|
| App framework | Tauri v2 |
| Single window | `tauri-plugin-single-instance` |
| File watching | `notify` |

### 3.3 UI (TypeScript)

| Purpose | Library |
|---|---|
| Language | TypeScript |
| UI | React |
| Build | Vite |
| Styling | Tailwind CSS |
| Markdown preview | `react-markdown` + `remark-gfm` |
| Code block highlighting | `rehype-highlight` |
| Mermaid diagrams | `mermaid` |
| Source view | CodeMirror 6 (read-only) |

### 3.4 Development tools

| Purpose | Tool |
|---|---|
| Rust toolchain | rustup |
| JavaScript package manager | pnpm |
| Tauri CLI | `@tauri-apps/cli` (a devDependency of `apps/desktop`) |

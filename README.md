# Fusen

> Named after 付箋 (*fusen*), the Japanese word for the sticky notes you stick on pages while reading. Your AI wrote the docs. Now stick your notes on them.
>
> In Fusen, a **fusen** is a review comment attached to a Markdown document. Like many Japanese words, it has no plural form: one fusen, two fusen.

Local Markdown review tool for AI-assisted writing. Read your docs as rendered documents, stick fusen on any passage, and let AI agents act on your feedback.

## Install

```sh
brew tap <owner>/tap
brew install fusen
```

## Usage

Run `fusen` inside your project:

```sh
cd your-project
fusen .
```

A native macOS window opens with the Markdown files in your project. Select any text to stick a fusen on it, or stick one on the whole document.

When you are done, turn your fusen into a prompt for your AI agent:

```sh
fusen prompt . --copy
```

## Features

- Rendered Markdown view with GitHub Flavored Markdown (tables, task lists, code blocks)
- Fusen on any text selection, or on a whole document
- Fusen kinds (`comment`, `question`, or your own) with descriptions that tell the AI how to handle them
- Open / closed status for each fusen
- Outdated detection: see which fusen were added before the document last changed
- File list of every Markdown file in the project, with open fusen counts (respects `.gitignore`)
- Prompt output for AI agents, filtered by status and freshness, to stdout or the clipboard
- Your Markdown files are never modified — fusen are stored separately in `.fusen/`

## How it works with AI agents

Fusen are saved next to your project in `.fusen/`, one YAML file per document:

```
your-project/
├── .fusen/
│   └── docs/
│       └── spec.md.fusen.yaml
└── docs/
    └── spec.md
```

`fusen prompt` turns them into a prompt designed for AI agent consumption:

```xml
<document path="docs/spec.md">
<fusen id="01K5XQ3M8ZJ4T7R2N9B6W1C0VE" kind="comment" status="open" scope="selection" outdated="false">
<quote location="docs/spec.md:5">authenticated with **OAuth 2.0**</quote>
<body>Mention that PKCE is required.</body>
</fusen>
</document>
```

Paste it into your coding agent. It reads each file at the given location, edits the document, and replies to each fusen by ID.

The file format is open and documented, so other tools and agents can read and write fusen too. See the [Fusen Review Format v1](docs/fusen-format/v1.md).

## Configuration

Settings are stored in `~/.config/fusen/settings.json` (or `$XDG_CONFIG_HOME/fusen/settings.json` if set) and can be changed with `fusen config`:

```sh
# Reply language for the AI
fusen config prompt.language Japanese

# Add your own fusen kind
fusen config kinds.typo.label Typo
fusen config kinds.typo.description "A typo or grammatical error. Fix it."
```

## Documentation

| Document | Description |
|---|---|
| [Command reference](docs/cli.md) | The `fusen` command and its options |
| [Window reference](docs/gui.md) | The Fusen window: file list, document view, fusen, and settings |
| [Fusen Review Format v1](docs/fusen-format/v1.md) | The format of fusen files in `.fusen/` |
| [Fusen Config Format v1](docs/config-format/v1.md) | The format of the settings file |
| [Architecture](docs/architecture.md) | Components, directory structure, and tech stack |

## Tech Stack

Rust + Tauri v2 + React + TypeScript

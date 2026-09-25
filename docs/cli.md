# fusen Command Reference

## Contents

- [1. Usage](#1-usage)
- [2. Commands](#2-commands)
  - [2.1 `fusen <path>`](#21-fusen-path)
  - [2.2 `fusen config [<key>] [<value>]`](#22-fusen-config-key-value)
    - [2.2.1 Keys](#221-keys)
    - [2.2.2 Options](#222-options)
    - [2.2.3 Fusen kinds](#223-fusen-kinds)
  - [2.3 `fusen list <path>`](#23-fusen-list-path)
  - [2.4 `fusen show <file> <id>`](#24-fusen-show-file-id)
  - [2.5 `fusen prompt <path>`](#25-fusen-prompt-path)
    - [2.5.1 Arguments](#251-arguments)
    - [2.5.2 Options](#252-options)
    - [2.5.3 Output format](#253-output-format)
  - [2.6 `fusen {close|reopen} <file> [<id>...]`](#26-fusen-closereopen-file-id)
  - [2.7 `fusen reply <file> <id> <message>`](#27-fusen-reply-file-id-message)
- [3. Errors](#3-errors)

## 1. Usage

`fusen` treats the directory it runs in as the project root. It does not search parent directories, so run it from the project root to work with that project's fusen.
Fusen are stored in `.fusen/` at the project root (see [Fusen Review Format v1](fusen-format/v1.md)). Paths passed as arguments must be inside the project root.
Markdown files are files with the extension `.md`, in any case (`.MD` also counts).

Each fusen is in exactly one of three states:

| State | Meaning |
|---|---|
| `open` | Not yet addressed, and the document has not changed since the fusen was added. |
| `outdated` | Not yet addressed, but the document has changed since the fusen was added. |
| `closed` | Addressed, whether or not the document has changed. |

`open` and `closed` are stored in the fusen file as its `status`. `outdated` is not stored; it is determined by comparing the fusen's `docHash` with the hash of the current document.

Fusen are added and edited in the Fusen window. The `fusen` command shows fusen, closes and reopens them, and adds replies.

```sh
# Show help or version
fusen --help
fusen --version

# Open a project
fusen .
fusen <dir>
fusen <file>

# Show or change settings
fusen config <key>
fusen config <key> <value>
fusen config --unset <key>

# List fusen, or show one
fusen list . [--outdated] [--closed] [--all]
fusen show <file> <id>

# Output an AI prompt from fusen
fusen prompt . [--copy]
fusen prompt <dir> [--copy]
fusen prompt <file> [--copy]

# Close or reopen fusen
fusen close <file> [<id>...]
fusen reopen <file> [<id>...]

# Reply to a fusen
fusen reply <file> <id> <message>
```

## 2. Commands

### 2.1 `fusen <path>`

Opens the Fusen window, with the Markdown files in the project on the left, the document in the center, and its fusen on the right.

```sh
cd ~/proj
fusen .
```

The argument determines which files are listed and which document is opened first.

| Command | Example | Files listed | Document opened first |
|---|---|---|---|
| `fusen <dir>` | `fusen .`<br>`fusen docs/` | Files under the directory | None |
| `fusen <file>` | `fusen docs/spec.md` | Only the file | The file (`.md`) |

`fusen` exits as soon as the window opens, so you can keep working in the terminal.
There is only one window. If it is already open, `fusen` shows the path in it instead of opening a new one. Running `fusen` from a different project root switches the window to that project.

### 2.2 `fusen config [<key>] [<value>]`

Shows or changes settings in the settings file (`~/.config/fusen/settings.json` by default; see [Fusen Config Format v1](config-format/v1.md)). Without `<value>`, it prints the settings under the key as JSON, including default values. For example, `fusen config kinds` prints all kinds.

```sh
fusen config prompt.language Japanese
fusen config kinds.typo.label Typo
```

#### 2.2.1 Keys

| Key | Description | Default |
|---|---|---|
| `user.name` | Your name, recorded as the author of your replies. | `user` |
| `prompt.language` | The language the AI replies in. Used for `{language}` in `fusen prompt`. | `English` |
| `appearance.theme` | Appearance of the Fusen window: `light` or `dark`. | `light` |
| `kinds.<id>.label` | Display name of the fusen kind. | `<id>` with its first letter capitalized (`Typo` for `typo`) |
| `kinds.<id>.description` | Description of the fusen kind. | None |
| `kinds.<id>.color` | Highlight color of the fusen kind in the Fusen window, as `#rrggbb`. Shown at 75% transparency. | `#87ceeb` (light blue) |

The built-in kinds `comment`, `question`, and `suggestion` have their own labels and descriptions (see [Fusen Config Format v1](config-format/v1.md#25-kinds)).

#### 2.2.2 Options

| Option | Description |
|---|---|
| `--unset <key>` | Removes the setting. Keys with a default value return to the default. |

| Example | Result |
|---|---|
| `fusen config --unset prompt.language` | Returns to the default, `English`. |
| `fusen config --unset kinds.typo.label` | Returns to the default, `Typo`. |
| `fusen config --unset kinds.typo` | Removes the kind `typo`. |
| `fusen config --unset kinds` | Returns to the built-in kinds (`comment`, `question`, and `suggestion`). |

#### 2.2.3 Fusen kinds

To add a kind, set any of `label`, `description`, and `color` for a new ID. Keys that are not set use their defaults. If no kinds are left, the built-in kinds are created (see [Fusen Config Format v1](config-format/v1.md#25-kinds)).

```sh
fusen config kinds.typo.label Typo
fusen config kinds.typo.description "A typo or grammatical error. Fix it."
fusen config kinds.typo.color "#ff6b6b"
```

### 2.3 `fusen list <path>`

Lists fusen. It does not open the Fusen window.

```
$ fusen list .
docs/spec.md
  01K5XQD2  open  question  document  Should this document also cover token revocation?
  01K5XQ3M  open  comment   5         Mention that PKCE is required. (2 replies)
  01K5XQ7F  open  question  7-8       How long are refresh tokens valid?…
```

- The argument and options (`--outdated`, `--closed`, and `--all`) are the same as for `fusen prompt` (see [2.5.1](#251-arguments) and [2.5.2](#252-options)). By default, only `open` fusen are listed.
- Each document's path is followed by its fusen, one per line. Documents and fusen are in the same order as in `fusen prompt`.
- Each line shows the ID, state, kind, location, and the first line of the text.
  - IDs are shortened to the shortest prefix, at least 8 characters, that is unique among the fusen on the document. They can be passed as is to `fusen show`, `fusen close`, and `fusen reply`.
  - The location is a line number (`5` or `7-8`), or `document` for a fusen on the whole document.
  - The text is cut to the first 60 characters of its first line, followed by `…` if there is more. The number of replies, if any, follows in parentheses, as in `(2 replies)`.
- If no fusen match, nothing is written and a message is shown instead.

### 2.4 `fusen show <file> <id>`

Shows one fusen in full, including its text and replies.

```
$ fusen show docs/spec.md 01K5XQ3M
fusen 01K5XQ3M8ZJ4T7R2N9B6W1C0VE
Kind:     comment
State:    open
Location: docs/spec.md:5
Created:  2026-09-24T17:03:00+09:00

Quote:
    authenticated with **OAuth 2.0**

Text:
    Mention that PKCE is required.

Reply from claude-code at 2026-09-24T18:15:00+09:00:
    Added "PKCE is required for all clients." after line 5.

Reply from alice at 2026-09-24T18:20:00+09:00:
    Thanks. Please also mention the S256 method.
```

- `<file>` is the Markdown file (`.md`) the fusen is on.
- `<id>` can be shortened to any prefix that matches only one fusen on the document.
- `State` is `open`, `outdated`, or `closed` (see [Usage](#1-usage)).
- For a fusen on the whole document, `Location` is the document path only, and `Quote` is not shown.

### 2.5 `fusen prompt <path>`

Builds an AI prompt from fusen and writes it to standard output. It does not open the Fusen window.

```sh
fusen prompt .
```

By default, the prompt includes only `open` fusen. Options include `outdated` and `closed` fusen as well (see [Usage](#1-usage) for the states).

#### 2.5.1 Arguments

The argument determines which documents are included.

| Command | Documents included |
|---|---|
| `fusen prompt <dir>` | Documents under the directory that have matching fusen |
| `fusen prompt <file>` | The file (`.md`) |

Documents are found the same way as in the file list of the Fusen window; files excluded by `.gitignore` are skipped.
If no fusen match, nothing is written and a message is shown instead.

#### 2.5.2 Options

| Option | Description |
|---|---|
| `-c`, `--copy` | Copies the prompt to the clipboard instead of writing it to standard output. |
| `--outdated` | Also includes `outdated` fusen. |
| `--closed` | Also includes `closed` fusen. |
| `--all` | Includes all fusen. Same as `--outdated --closed`. |

```sh
fusen prompt . --copy
fusen prompt . --all
```

To save the prompt to a file, redirect the output with `>`.

```sh
fusen prompt . > prompt.md
```

#### 2.5.3 Output format

The prompt contains only the fusen, not the text of the documents. The AI that receives it, such as a coding agent, reads the files using the paths and line numbers, and edits them directly.

For the fusen in the [Fusen Review Format v1 example](fusen-format/v1.md#25-full-example), the default prompt looks like this. The third fusen is `closed`, so it is not included. Parts in `{...}` depend on your settings (see below).

```xml
These are fusen (review comments) left on documents with Fusen. Address each fusen and update the documents.

<instructions>
The fusen are structured as follows:
- <document path="...">: The fusen on one document.
- <fusen id="..." kind="..." status="..." scope="...">: One fusen.
  - status="open": The fusen has not been addressed yet.
  - status="outdated": The fusen has not been addressed yet, but the document has changed since the fusen was added. The quoted text may have moved or changed.
  - status="closed": The fusen has already been addressed. Use it as context; you do not need to act on it.
  - scope="selection": The fusen refers to the text in <quote>.
  - scope="document": The fusen refers to the whole document. It has no <quote>.
- <quote location="path:line">: The exact source text the fusen refers to, and where it is.
- <body>: The text of the fusen.
- <reply author="...">: A reply to the fusen, in chronological order.

Handle each fusen according to its kind:
- {kind}: {description}

Write your reply in {language}. When editing documents, keep each document's own language.

When you are done, reply in the following format, one section per fusen:

## <id>
**fusen:** <the text of the fusen>
**Response:** <your answer, and what you changed in the document>
</instructions>

<document path="docs/spec.md">
<fusen id="01K5XQD2F6H9K3N7Q1S5V8X2Z4" kind="question" status="open" scope="document">
<body>Should this document also cover token revocation?</body>
</fusen>

<fusen id="01K5XQ3M8ZJ4T7R2N9B6W1C0VE" kind="comment" status="open" scope="selection">
<quote location="docs/spec.md:5">authenticated with **OAuth 2.0**</quote>
<body>Mention that PKCE is required.</body>
<reply author="claude-code">Added "PKCE is required for all clients." after line 5.</reply>
<reply author="alice">Thanks. Please also mention the S256 method.</reply>
</fusen>

<fusen id="01K5XQ7F1Y0S3H6D9K2M5P8R4T" kind="question" status="open" scope="selection">
<quote location="docs/spec.md:7-8">
Access tokens are stored on the server side.
Refresh tokens are rotated on every use.
</quote>
<body>
How long are refresh tokens valid?
Should mobile and web use different lifetimes?
</body>
</fusen>
</document>
```

When the prompt covers multiple documents, there is one `<document>` per document.

```xml
<document path="README.md">
...
</document>

<document path="docs/spec.md">
...
</document>
```

| Element | Attribute | Description |
|---|---|---|
| First sentence | | The request to the AI. |
| `<instructions>` | | Description of the tags, and instructions for the AI. |
| `<document>` | | One per document, sorted by path. |
| | `path` | Path of the document, relative to the project root. |
| `<fusen>` | | One per fusen. Fusen on the whole document come first, followed by the rest in line order. |
| | `id` | ID of the fusen. |
| | `kind` | Kind of the fusen. |
| | `status` | `open`, `outdated`, or `closed` (see [Usage](#1-usage)). |
| | `scope` | `selection` for a fusen on a range of text, or `document` for a fusen on the whole document. |
| `<quote>` | | The source text the fusen is on. Only fusen with `scope="selection"` have it. |
| | `location` | Where the quote is: `path:line`, or `path:start-end` if it spans multiple lines. |
| `<body>` | | The text of the fusen. |
| `<reply>` | | A reply to the fusen. Replies follow `<body>`, oldest first. |
| | `author` | Name of the person or agent who wrote the reply. |

The contents of `<quote>`, `<body>`, and `<reply>` are written as is, without escaping. Multi-line contents start on the line after the opening tag and end on the line before the closing tag; these two line breaks are not part of the contents.

The parts in `{...}` in `<instructions>` are filled in as follows.

| Part | Value |
|---|---|
| `{kind}: {description}` | One line per kind of fusen in the prompt, using `kinds.<id>.description` (see [2.2](#22-fusen-config-key-value)), in the order of `kinds` in the settings. Kinds without a description are written as `{kind}` only. Kinds used by fusen but not defined in the settings, such as a kind that has since been removed, come last as `{kind}` only, in the order they first appear. |
| `{language}` | The value of `prompt.language` (see [2.2](#22-fusen-config-key-value)). Defaults to `English`. |

### 2.6 `fusen {close|reopen} <file> [<id>...]`

`fusen close` marks fusen on a document as `closed`, and `fusen reopen` marks them as `open` again. If the Fusen window is open, it updates immediately.

```sh
fusen close docs/spec.md                  # Close all fusen on docs/spec.md
fusen close docs/spec.md 01K5XQ3M         # Close only the given fusen
fusen reopen docs/spec.md 01K5XQ3M
```

```
$ fusen close docs/spec.md 01K5XQ3M 01K5XQ7F
closed 01K5XQ3M8ZJ4T7R2N9B6W1C0VE (docs/spec.md:5)
closed 01K5XQ7F1Y0S3H6D9K2M5P8R4T (docs/spec.md:7-8)
```

- `<file>` is the Markdown file (`.md`) the fusen are on.
- Without `<id>`, all fusen on the document are closed or reopened. One or more IDs can be given.
- An ID can be shortened to any prefix that matches only one fusen on the document, like a git commit hash.
- If some IDs cannot be found, the others are still closed or reopened, and an error is shown for each missing ID.

### 2.7 `fusen reply <file> <id> <message>`

Adds a reply to a fusen. If the Fusen window is open, it updates immediately.

```sh
fusen reply docs/spec.md 01K5XQ3M "Added a note about PKCE."
```

```
$ fusen reply docs/spec.md 01K5XQ3M "Added a note about PKCE." --author claude-code
replied to 01K5XQ3M8ZJ4T7R2N9B6W1C0VE (docs/spec.md:5)
```

- `<file>` is the Markdown file (`.md`) the fusen is on.
- `<id>` can be shortened to any prefix that matches only one fusen on the document.
- If `<message>` is `-`, the message is read from standard input. This is useful for multi-line replies.

```sh
fusen reply docs/spec.md 01K5XQ3M - <<'EOF'
Added a note about PKCE.
Also mentioned the S256 method.
EOF
```

| Option | Description |
|---|---|
| `--author <name>` | Name to record as the author of the reply. Defaults to `user.name` (see [2.2](#22-fusen-config-key-value)). |

## 3. Errors

When an error occurs, `fusen` prints a message and exits. The Fusen window does not open. Some messages are followed by a `hint:` line.

| Message | Cause |
|---|---|
| `no such file or directory: <path>` | The path does not exist. Check the spelling and the directory `fusen` is run from. |
| `not a Markdown file or directory: <path>` | `fusen` works only with Markdown files (`.md`) and directories. |
| `not a Markdown file: <path>` | `fusen show`, `fusen close`, `fusen reopen`, or `fusen reply` was given a directory. These commands work only with Markdown files. |
| `path is outside the project root: <path>`<br>`hint: run fusen from a directory that contains this path` | The project root is the directory `fusen` is run from. Files outside it cannot be used. |
| `Fusen.app not found`<br>`hint: install Fusen.app in /Applications, or set FUSEN_APP to its executable` | `fusen <path>` could not find Fusen.app in `/Applications` or `~/Applications`. |
| `unknown key: <key>`<br>`hint: available keys are user.name, prompt.language, appearance.theme, kinds.<id>.label, kinds.<id>.description, kinds.<id>.color` | Only the keys listed in [Keys](#221-keys) can be set. |
| `no such kind: <id>` | `fusen config kinds.<id>` was given a kind that is not defined. |
| `invalid kind id: <id>`<br>`hint: use lowercase letters, digits, "-" and "_" (up to 32 characters)` | Kind IDs can contain only lowercase letters, digits, `-`, and `_`, up to 32 characters. |
| `invalid theme: <value>`<br>`hint: use light or dark` | `appearance.theme` must be `light` or `dark`. |
| `invalid color: <value>`<br>`hint: use the #rrggbb format, for example #87ceeb` | Colors must be `#` followed by six hexadecimal digits. |
| `no fusen with id: <id> in <file>` | No fusen on the document has an ID starting with the given value. |
| `ambiguous id: <id> in <file>`<br>`hint: matches <id>, <id>` | The shortened ID matches more than one fusen on the document. Use a longer prefix. |
| `reply message is empty` | `fusen reply` was given an empty message. |
| `could not copy to the clipboard: <reason>` | `fusen prompt --copy` could not access the clipboard. |
| `invalid fusen file: <path>: <reason>` | A fusen file in `.fusen/` does not follow [Fusen Review Format v1](fusen-format/v1.md), for example after it was edited by hand. Fix or delete the file. |
| `invalid settings file: <path>: <reason>` | The settings file is not valid JSON. |
| `<path>: <reason>` | A file could not be read or written, for example because of its permissions. |

The following messages are not errors. `fusen` prints them and exits successfully.

| Message | When |
|---|---|
| `No fusen to include in the prompt.` | `fusen prompt` found no matching fusen. |
| `No fusen to list.` | `fusen list` found no matching fusen. |
| `Copied the prompt to the clipboard.` | `fusen prompt --copy` copied the prompt. |
| `already closed <id> (<location>)`<br>`already open <id> (<location>)` | `fusen close` or `fusen reopen` was given a fusen that is already in that state. |

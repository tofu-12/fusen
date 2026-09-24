# fusen Command Reference

## Contents

- [1. Usage](#1-usage)
- [2. Commands](#2-commands)
  - [2.1 `fusen config [<key>] [<value>]`](#21-fusen-config-key-value)
    - [2.1.1 Keys](#211-keys)
    - [2.1.2 Options](#212-options)
    - [2.1.3 Fusen kinds](#213-fusen-kinds)
  - [2.2 `fusen <path>`](#22-fusen-path)
  - [2.3 `fusen prompt <path>`](#23-fusen-prompt-path)
    - [2.3.1 Arguments](#231-arguments)
    - [2.3.2 Options](#232-options)
    - [2.3.3 Output format](#233-output-format)
  - [2.4 `fusen {close|reopen} <file> [<id>...]`](#24-fusen-closereopen-file-id)
  - [2.5 `fusen reply <file> <id> <message>`](#25-fusen-reply-file-id-message)
- [3. Errors](#3-errors)

## 1. Usage

`fusen` treats the directory you run it in as the project root. It does not look in parent directories, so always run it from the project root to work with the same project's fusen.
Fusen are stored in `.fusen/` at the project root (see [Fusen Review Format v1](fusen-format/v1.md)). Paths passed as arguments must be inside the project root.

You add and edit fusen in the Fusen window. The `fusen` command only closes or reopens fusen and adds replies to them.

```sh
# Show help or version
fusen --help
fusen --version

# Show or change settings
fusen config <key>
fusen config <key> <value>
fusen config --unset <key>

# Open a project
fusen .
fusen <dir>
fusen <file>

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

### 2.1 `fusen config [<key>] [<value>]`

Shows or changes settings in the settings file (`~/.config/fusen/settings.json` by default; see [Fusen Config Format v1](config-format/v1.md)). Without `<value>`, shows the settings under the key as JSON, including default values (for example, `fusen config kinds` shows all kinds).

```sh
fusen config prompt.language Japanese
fusen config kinds.typo.label Typo
```

#### 2.1.1 Keys

| Key | Description | Default |
|---|---|---|
| `user.name` | Your name, used as the author of replies. | `user` |
| `prompt.language` | The language the AI replies in. Used for `{language}` in `fusen prompt`. | `English` |
| `kinds.<id>.label` | Display name of the fusen kind. | `<id>` |
| `kinds.<id>.description` | Description of the fusen kind. | None |
| `kinds.<id>.color` | Highlight color of the fusen kind in the Fusen window, as `#rrggbb` (for example, `#ffffff` is white). It is shown at 75% transparency. | `#87ceeb` (light blue) |

#### 2.1.2 Options

| Option | Description |
|---|---|
| `--unset <key>` | Remove the setting. Keys with a default value return to the default. |

| Example | Result |
|---|---|
| `fusen config --unset prompt.language` | Returns to the default, `English` |
| `fusen config --unset kinds.typo.label` | Returns to the default, `typo` |
| `fusen config --unset kinds.typo` | Removes the kind `typo` |
| `fusen config --unset kinds` | Returns to the built-in kinds (`comment` and `question`) |

#### 2.1.3 Fusen kinds

To add a kind, set `label` and `description` for a new ID.

```sh
fusen config kinds.typo.label Typo
fusen config kinds.typo.description "A typo or grammatical error. Fix it."
fusen config kinds.typo.color "#ff6b6b"
```

### 2.2 `fusen <path>`

Opens the Fusen window, with the Markdown files in the project on the left, the document in the center, and its fusen on the right.

```sh
cd ~/proj
fusen .
```

The argument determines which files are listed and which document opens first.

| Command | Example | Files listed | Document opened first |
|---|---|---|---|
| `fusen <dir>` | `fusen .`<br>`fusen docs/` | Files under the directory | None |
| `fusen <file>` | `fusen docs/spec.md` | Only the file | The file (`.md`) |

The `fusen` command exits as soon as the window opens, so you can keep working in the terminal.
There is only one window. If it is already open, `fusen` shows the path there instead of opening a new window. Running `fusen` from a different project root switches the window to that project.

### 2.3 `fusen prompt <path>`

Builds an AI prompt from fusen and writes it to standard output. It does not open the Fusen window.

```sh
fusen prompt .
```

By default, the prompt includes only fusen that are `open` and whose document has not changed since they were added. Options let you include outdated or `closed` fusen as well.

#### 2.3.1 Arguments

The argument determines which documents are included.

| Command | Documents included |
|---|---|
| `fusen prompt <dir>` | Documents under the directory that have matching fusen |
| `fusen prompt <file>` | The file (`.md`) |

Documents are found the same way as in the Fusen window's file list (files excluded by `.gitignore` are skipped).
If no fusen match, nothing is written and a message is shown instead.

#### 2.3.2 Options

| Option | Description |
|---|---|
| `-c`, `--copy` | Copy the prompt to the clipboard instead of writing it to standard output |
| `--outdated` | Also include fusen whose document has changed since they were added |
| `--closed` | Also include `closed` fusen |
| `--all` | Include all fusen |

Fusen are filtered by two things: their status and whether their document has changed.

| | Unchanged | Changed (outdated) |
|---|---|---|
| **`open`** | Included by default | `--outdated` |
| **`closed`** | `--closed` | `--outdated --closed` or `--all` |

```sh
fusen prompt . --copy
fusen prompt . --all
```

To save the prompt to a file, redirect the output with `>`.

```sh
fusen prompt . > prompt.md
```

#### 2.3.3 Output format

The prompt contains only the fusen, not the document text. The AI that receives it (such as a coding agent) reads the files using the paths and line numbers, and edits them directly.

For the fusen in the [Fusen Review Format v1 example](fusen-format/v1.md#25-full-example), the default prompt looks like this (the third fusen is `closed`, so it is not included). Parts in `{...}` depend on your settings (see below).

```xml
These are fusen (review comments) left on documents with Fusen. Address each fusen and update the documents.

<instructions>
The fusen are structured as follows:
- <document path="...">: The fusen on one document.
- <fusen id="..." kind="..." status="..." scope="..." outdated="...">: One fusen.
  - status="open": The fusen has not been addressed yet.
  - status="closed": The fusen has already been addressed. Use it as context; you do not need to act on it.
  - scope="selection": The fusen refers to the text in <quote>.
  - scope="document": The fusen refers to the whole document. It has no <quote>.
  - outdated="false": The document has not changed since the fusen was added.
  - outdated="true": The document has changed since the fusen was added. The quoted text may have moved or changed.
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
<fusen id="01K5XQD2F6H9K3N7Q1S5V8X2Z4" kind="question" status="open" scope="document" outdated="false">
<body>Should this document also cover token revocation?</body>
</fusen>

<fusen id="01K5XQ3M8ZJ4T7R2N9B6W1C0VE" kind="comment" status="open" scope="selection" outdated="false">
<quote location="docs/spec.md:5">authenticated with **OAuth 2.0**</quote>
<body>Mention that PKCE is required.</body>
<reply author="claude-code">Added "PKCE is required for all clients." after line 5.</reply>
<reply author="alice">Thanks. Please also mention the S256 method.</reply>
</fusen>

<fusen id="01K5XQ7F1Y0S3H6D9K2M5P8R4T" kind="question" status="open" scope="selection" outdated="false">
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
| `<instructions>` | | Description of the tags and instructions for the AI. |
| `<document>` | | One per document, sorted by path. |
| | `path` | Path of the document, relative to the project root. |
| `<fusen>` | | One per fusen. Fusen on the whole document come first, followed by the rest in line order. |
| | `id` | ID of the fusen. |
| | `kind` | Kind of the fusen. |
| | `status` | `open` or `closed`. |
| | `scope` | `selection` (the fusen is on a range of text) or `document` (the fusen is on the whole document). |
| | `outdated` | `true` if the document has changed since the fusen was added, otherwise `false` (determined by comparing the fusen's `docHash` with the current document's hash). |
| `<quote>` | | The source text the fusen is on. Only fusen with `scope="selection"` have it. |
| | `location` | Where the quote is: `path:line`, or `path:start-end` if it spans multiple lines. |
| `<body>` | | The text of the fusen. |
| `<reply>` | | A reply to the fusen. Replies follow `<body>`, oldest first. |
| | `author` | Name of the person or agent who wrote the reply. |

The contents of `<quote>`, `<body>`, and `<reply>` are written as is, without escaping. Multi-line contents start on the line after the opening tag and end on the line before the closing tag; these two line breaks are not part of the contents.

The parts in `{...}` in `<instructions>` are filled in as follows.

| Part | Value |
|---|---|
| `{kind}: {description}` | One line per kind of fusen in the prompt, using `kinds.<id>.description` (see [2.1](#21-fusen-config-key-value)). Kinds without a description are written as `{kind}` only. |
| `{language}` | The value of `prompt.language` (see [2.1](#21-fusen-config-key-value)). Defaults to `English`. |

### 2.4 `fusen {close|reopen} <file> [<id>...]`

`fusen close` marks fusen on a document as `closed`, and `fusen reopen` marks them as `open` again. If the Fusen window is open, it updates right away.

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
- Without `<id>`, all fusen on the document are closed or reopened. You can also pass one or more IDs.
- An ID can be shortened to any prefix that matches only one fusen on the document, like a git commit hash.
- If some IDs cannot be found, the others are still closed or reopened, and an error is shown for each missing ID.

### 2.5 `fusen reply <file> <id> <message>`

Adds a reply to a fusen. If the Fusen window is open, it updates right away.

```sh
fusen reply docs/spec.md 01K5XQ3M "Added a note about PKCE."
```

```
$ fusen reply docs/spec.md 01K5XQ3M "Added a note about PKCE." --author claude-code
replied to 01K5XQ3M8ZJ4T7R2N9B6W1C0VE (docs/spec.md:5)
```

- `<file>` is the Markdown file (`.md`) the fusen is on.
- `<id>` can be shortened to any prefix that matches only one fusen on the document.
- Pass `-` as `<message>` to read the message from standard input. This is useful for multi-line replies.

```sh
fusen reply docs/spec.md 01K5XQ3M - <<'EOF'
Added a note about PKCE.
Also mentioned the S256 method.
EOF
```

| Option | Description |
|---|---|
| `--author <name>` | Name to record as the author of the reply. Defaults to `user.name` (see [2.1](#21-fusen-config-key-value)). |

## 3. Errors

When an error occurs, `fusen` shows a message and exits. The Fusen window does not open. Some messages are followed by a `hint:` line.

| Message | Cause |
|---|---|
| `no such file or directory: <path>` | The path could not be found. Check the spelling and the directory you are running `fusen` from. |
| `not a Markdown file or directory: <path>` | `fusen` only works with Markdown files (`.md`) and directories. |
| `path is outside the project root: <path>`<br>`hint: run fusen from a directory that contains this path` | The project root is the directory you run `fusen` from. Files outside it cannot be used. |
| `unknown key: <key>`<br>`hint: available keys are user.name, prompt.language, kinds.<id>.label, kinds.<id>.description, kinds.<id>.color` | Only the keys listed in [Keys](#211-keys) can be set. |
| `invalid kind id: <id>`<br>`hint: use lowercase letters, digits, "-" and "_" (up to 32 characters)` | Kind IDs can only contain lowercase letters, digits, `-`, and `_`, up to 32 characters. |
| `invalid color: <value>`<br>`hint: use the #rrggbb format, for example #87ceeb` | Colors must be written as `#` followed by six hexadecimal digits. |
| `no fusen with id: <id> in <file>` | No fusen on the document has an ID starting with the given value. |
| `ambiguous id: <id> in <file>`<br>`hint: matches <id>, <id>` | The shortened ID matches more than one fusen on the document. Use a longer prefix. |
| `reply message is empty` | `fusen reply` was given an empty message. |

The following messages are not errors. `fusen` shows them and exits normally.

| Message | When |
|---|---|
| `No fusen to include in the prompt.` | `fusen prompt` found no matching fusen. |
| `already closed <id> (<location>)`<br>`already open <id> (<location>)` | `fusen close` / `fusen reopen` was given a fusen that is already in that state. |

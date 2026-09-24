# Fusen Window Reference

## Contents

- [1. File list](#1-file-list)
- [2. Document](#2-document)
- [3. Fusen](#3-fusen)
  - [3.1 Adding a fusen](#31-adding-a-fusen)
  - [3.2 Fusen list](#32-fusen-list)
  - [3.3 Editing and deleting](#33-editing-and-deleting)
  - [3.4 Closing and reopening](#34-closing-and-reopening)
  - [3.5 Replies](#35-replies)
  - [3.6 Outdated fusen](#36-outdated-fusen)
- [4. Settings](#4-settings)
- [5. Saving](#5-saving)
- [6. Window](#6-window)

## 1. File list

The left side of the window shows a tree of the Markdown files (`.md`) in the project and the directories that contain them. Click a file to open it.

The file list can be shown or hidden with a button.

| Launched with | Files listed | File list |
|---|---|---|
| `fusen <dir>` | `.md` files under the directory | Shown |
| `fusen <file>` | Only the file | Hidden |

- Files excluded by `.gitignore` (including `.ignore` and the global gitignore), `.git/`, and `.fusen/` are not listed.
- Each file shows the number of its `open` fusen.
- Added, deleted, and renamed files are reflected automatically.

## 2. Document

The center of the window shows the selected file. Fusen only displays documents; it does not edit them.

A button switches between two views.

| View | Description |
|---|---|
| Preview | Renders GitHub Flavored Markdown (tables, task lists, code blocks, and so on). Mermaid code blocks are rendered as diagrams. |
| Source | Shows the Markdown source as is, with line numbers. |

- Ranges with a fusen are highlighted in the color of the fusen's kind (see [4](#4-settings)), like a sticky note on the page, and a fusen marker is shown beside the line. Colors are shown at 75% transparency. Click a highlight or marker to select its fusen.
- You can add fusen in either view. For parts you cannot select in the preview, such as Mermaid diagrams, switch to the source view.
- When the file changes outside Fusen, the view updates automatically.

## 3. Fusen

### 3.1 Adding a fusen

1. Select text in the document, in either the preview or the source view.
2. Choose a kind of fusen (see [4](#4-settings)) from the buttons that appear.
3. Write the text of the fusen and save it.

To add a fusen on the whole document, use "Add fusen to document" at the top of the fusen list.

- A selection can span multiple paragraphs and code blocks.
- A fusen records the source text of the selection and its line numbers (see [Fusen Review Format v1](fusen-format/v1.md#23-anchor)).

### 3.2 Fusen list

The right side of the window lists the fusen on the current document.

- Fusen on the whole document come first, followed by the rest in document order.
- Each fusen shows its kind, text, and replies.
- Click a fusen to scroll the document to it.
- The top of the list switches between `open` and `closed` fusen.

### 3.3 Editing and deleting

You can change the kind and text of a fusen later. Deleting a fusen also deletes its replies.

The selected range (the quote and line numbers) cannot be changed. To change it, add a new fusen.

### 3.4 Closing and reopening

Close a fusen when it has been addressed to mark it `closed`. Reopen a closed fusen to mark it `open` again.

`fusen close` and `fusen reopen` do the same (see the [command reference](cli.md#24-fusen-closereopen-file-id)).

### 3.5 Replies

Reply to a fusen from the input field below it. Replies are listed oldest first.

- Replies use the name from your settings (see [4](#4-settings)).
- Replies from AI agents (`fusen reply`) are shown in the same place.

### 3.6 Outdated fusen

When a document changes after a fusen was added, the fusen becomes outdated.

- The fusen is marked "Outdated".
- Because its position may have moved, it is not highlighted in the document. The fusen shows the quote and line numbers from when it was added.

## 4. Settings

Open the settings window from Settings in the menu (`⌘,`).

| Setting | Description | Default |
|---|---|---|
| Name | Your name, used for replies | `user` |
| Reply language | The language the AI replies in with `fusen prompt` | `English` |
| Fusen kinds | Add, edit, and delete kinds. Each kind has an ID, label, description, and color. | `comment`, `question` |
| Fusen kind color | Highlight color, chosen from the options below | Light blue |

The following colors are available for fusen kinds.

| Color | Value |
|---|---|
| Light blue | `#87ceeb` |
| Yellow | `#ffd166` |
| Green | `#95d5b2` |
| Pink | `#ffadc6` |
| Orange | `#ffb870` |
| Purple | `#c8b6ff` |

If a color that is not one of these options (`#rrggbb`) is set with `fusen config`, it is shown as "Custom" in the settings window.

Settings are saved to the settings file (`~/.config/fusen/settings.json` by default; see [Fusen Config Format v1](config-format/v1.md)), which is shared with `fusen config` (see the [command reference](cli.md#21-fusen-config-key-value)). Changes take effect immediately.

## 5. Saving

Adding or changing fusen and replies is saved automatically. There is no save button.

- Fusen are saved in `.fusen/` at the project root (see [Fusen Review Format v1](fusen-format/v1.md#11-location-and-naming)).
- `.fusen/` is created when the first fusen is added.
- When all fusen on a document are deleted, its fusen file is deleted too.
- Markdown files themselves are never modified.
- When a fusen file changes outside the window (by `fusen close`, `fusen reply`, git, and so on), the view updates automatically.

## 6. Window

Fusen has only one window.

- Running `fusen <path>` while the window is open shows the path in that window instead of opening a new one.
- Running `fusen <path>` from a different project root switches the window to that project.

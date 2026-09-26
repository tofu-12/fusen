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

The left side of the window shows a tree of the Markdown files (`.md`, in any case) in the project and the directories that contain them. Click a file to open it.

A button shows or hides the file list. The Copy prompt button at the bottom of the file list copies the prompt for the open fusen in the listed files to the clipboard, like `fusen prompt --copy` (see the [command reference](cli.md#25-fusen-prompt-path)). The Settings button below it opens the settings (see [4](#4-settings)). The version of Fusen is shown below it.

| Launched with | Files listed | File list |
|---|---|---|
| `fusen <dir>` | `.md` files under the directory | Shown |
| `fusen <file>` | Only the file | Hidden |

- Files excluded by `.gitignore` (including `.ignore` and the global gitignore), `.git/`, and `.fusen/` are not listed.
- Each file shows the number of its `open` fusen and, in yellow, the number of its `outdated` fusen. Counts of zero are not shown.
- Added, deleted, and renamed files are reflected automatically.
- If there are no Markdown files, the file list says "No Markdown files."

## 2. Document

The center of the window shows the selected file. Fusen displays documents; it never edits them.

A button switches between two views.

| View | Description |
|---|---|
| Preview | Renders GitHub Flavored Markdown (tables, task lists, code blocks, and so on). Mermaid code blocks are rendered as diagrams. YAML front matter (between `---` lines at the top of the file) is shown as a table, as on GitHub. Images in the project are shown too. |
| Source | Shows the Markdown source as is, with line numbers. |

- Ranges with a fusen are highlighted in the color of the fusen's kind (see [4](#4-settings)), like a sticky note on the page, and a fusen marker is shown beside the line. Colors are shown at 75% transparency. Click a highlight or marker to select its fusen. The selected fusen is highlighted in a darker color.
- Fusen can be added in either view. For parts that cannot be selected in the preview, such as Mermaid diagrams, switch to the source view.
- When the file changes outside Fusen, the view updates automatically.
- If no file is selected, the center of the window says "Select a file to open it."

Clicking a link in the preview does the following, depending on the target.

| Target | Example | Action |
|---|---|---|
| A heading in the same document | `#2-usage` | Scrolls to the heading. |
| A Markdown file in the project | `cli.md`, `../gui.md#4-settings` | Opens the file, and scrolls to the heading after `#`, if any. Files that are not in the file list are opened too. |
| A URL | `https://example.com` | Opens the URL in the default browser. |

Headings get anchors by the same rules as on GitHub, so links that work on GitHub work in Fusen too. Relative paths are resolved from the directory of the current document, and paths starting with `/` from the project root. Image paths are resolved the same way; images outside the project are not shown, and images that change are reloaded. If the target file does not exist, is outside the project, or is not a Markdown file, an error is shown at the bottom of the window.

## 3. Fusen

### 3.1 Adding a fusen

1. Select text in the document, in either the preview or the source view.
2. Choose a kind of fusen (see [4](#4-settings)) from the buttons that appear.
3. Write the text of the fusen and save it.

To add a fusen on the whole document, click "Add fusen to document" at the top right of the document.

- A selection can span multiple paragraphs and code blocks.
- A fusen records the source text of the selection and its line numbers (see [Fusen Review Format v1](fusen-format/v1.md#23-anchor)).
- While a new fusen is being written or a fusen is being edited, other fusen cannot be added or edited. Save or cancel it first.

### 3.2 Fusen list

The right side of the window lists the fusen on the current document. Each fusen is in exactly one of three states, and each state has its own tab.

| Tab | State |
|---|---|
| Open | Not yet addressed, and the document has not changed since the fusen was added. |
| Outdated | Not yet addressed, but the document has changed since the fusen was added (see [3.6](#36-outdated-fusen)). |
| Closed | Addressed, whether or not the document has changed. |

- Fusen on the whole document come first, followed by the rest in document order.
- Each fusen shows its kind, text, and replies.
- Click a fusen to scroll the document to it.
- The tabs at the top of the list switch between Open, Outdated, and Closed, and show the number of fusen in each.
- Selecting a fusen in the document switches the list to the tab of that fusen.
- If there are no fusen to show, the list says so.

### 3.3 Editing and deleting

The kind and text of a fusen can be changed later with Edit.

Deleting a fusen also deletes its replies. Click Delete, then click Delete again in the confirmation dialog.

In the Outdated and Closed tabs, fusen selected with checkboxes can be handled together. Use "Select all" to select every fusen, use the checkboxes to add or remove individual fusen, then click the button. The Open tab has no checkboxes.

| Tab | Button | Action |
|---|---|---|
| Outdated | Close selected | Closes the selected fusen. |
| Closed | Delete selected | Deletes the selected fusen and their replies, after a confirmation dialog. |

The selected range (the quote and line numbers) cannot be changed. To change it, add a new fusen.

### 3.4 Closing and reopening

Close a fusen once it has been addressed to mark it `closed`. Reopening a `closed` fusen marks it `open` if the document has not changed since the fusen was added, or `outdated` if it has.

`fusen close` and `fusen reopen` do the same (see the [command reference](cli.md#26-fusen-closereopen-file-id)).

### 3.5 Replies

Reply to a fusen from the input field below it. Replies are listed oldest first.

- Replies are recorded with the name in the settings (see [4](#4-settings)).
- Replies from AI agents (`fusen reply`) are shown in the same place.

### 3.6 Outdated fusen

When a document changes after an `open` fusen was added, the fusen becomes `outdated` and moves to the Outdated tab.

- The fusen is marked "Outdated".
- Because its position may have moved, it is not highlighted in the document. The fusen shows the quote and line numbers from when it was added. The same applies to `closed` fusen added before the document last changed.

## 4. Settings

Open the settings with the Settings button at the bottom of the file list, or from Settings in the menu. The settings are shown in the center of the window in place of the document, and the fusen list is hidden.

Changes take effect when you click Save. Each setting has a "Reset to default" button, which sets it back to its default; click Save to apply that too. To return to the document, click Close or choose a file in the file list. If there are unsaved changes, you are asked whether to discard them.

| Setting | Description | Default |
|---|---|---|
| Name | Your name, recorded with your replies. | `user` |
| Reply language | The language the AI replies in with `fusen prompt`. Choose one from the list, or choose Other… and enter it in English. | `English` |
| Appearance | Light or Dark. | Light |
| Fusen kinds | Add, edit, and delete kinds. Each kind has an ID, label, description, and color. The label defaults to the ID with its first letter capitalized. The ID cannot be changed after the kind is added, and the last kind cannot be deleted. | `comment`, `question`, `suggestion` |
| Fusen kind color | Highlight color. Choose one of the options below, or choose any color with Custom. | Light blue |

The following colors are available for fusen kinds.

| Color | Value |
|---|---|
| Light blue | `#87ceeb` |
| Yellow | `#ffd166` |
| Green | `#95d5b2` |
| Pink | `#ffadc6` |
| Orange | `#ffb870` |
| Purple | `#c8b6ff` |

Custom opens a color picker for choosing any color. Colors that are not among the options, including those set with `fusen config`, are shown as Custom.

Settings are saved to the settings file (`~/.config/fusen/settings.json` by default; see [Fusen Config Format v1](config-format/v1.md)), which is shared with `fusen config` (see the [command reference](cli.md#22-fusen-config-key-value)). Changes made with `fusen config` appear in the settings immediately, unless there are unsaved changes.

## 5. Saving

Adding and changing fusen and replies is saved automatically. There is no save button.

- Fusen are saved in `.fusen/` at the project root (see [Fusen Review Format v1](fusen-format/v1.md#11-location-and-naming)).
- `.fusen/` is created when the first fusen is added.
- When all fusen on a document are deleted, its fusen file is deleted too.
- Markdown files are never modified.
- When a fusen file changes outside the window (by `fusen close`, `fusen reply`, git, and so on), the view updates automatically.

## 6. Window

`fusen <path>` opens the path in the main window. `fusen <path> --window <name>` opens it in a window named `<name>` instead, so you can keep several windows open side by side (see [`fusen <path>`](cli.md#21-fusen-path)).

- Running `fusen <path>` while its window is open shows the path in that window instead of opening a new one.
- Running `fusen <path>` from a different project root switches that window to the project. Other windows are not affected.
- Each window works on its own project and updates when the files in it change.
- Closing the main window leaves the other windows open. The next `fusen <path>` opens a new main window. Closing the last window quits Fusen.
- Settings are shared by all windows. Choosing Settings from the menu opens them in the focused window.
- The window title is `<name> — Fusen`, where `<name>` is the name of the project root directory.
- If no project is open, for example when Fusen.app is opened from Finder, the window explains how to open one with `fusen`.
- When an operation fails, for example because a fusen file is invalid, the error is shown at the bottom of the window. Click Dismiss to hide it.

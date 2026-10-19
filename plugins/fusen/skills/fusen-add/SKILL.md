---
name: fusen-add
description: Reviews a Markdown document and leaves fusen (review comments) on the passages worth pointing out, with the fusen CLI. Use when asked to review a document with fusen, or to add fusen to it.
---

# Add fusen to a document

Read a Markdown document and add a fusen (a review comment anchored to lines of the document) to each passage worth pointing out, using the `fusen` command. The user reads the fusen later in the Fusen window.

## Follow the request first

You may be invoked by the user, or by another agent that asked you to review. The request that invoked this skill names the document and may give more instructions, such as:

- what to focus on (for example, only security, or only unclear wording),
- which kinds to use, how many fusen to add at most, or the language to write in,
- the author name to record.

Follow those instructions. They take precedence over the defaults below. If the request does not name a document, ask which one.

## Steps

1. Run `fusen` from the project root, usually the root of the repository. Paths are relative to it.
2. Run `fusen config kinds` to see the kinds of fusen and their descriptions. Choose each fusen's kind from these; other kinds are an error.
3. Run `fusen list <file> --outdated` to see the fusen already on the document. Do not add a fusen that makes the same point as one of them.
4. Read the whole document with line numbers.
5. For each passage worth pointing out, add one fusen (see below).
6. Report what you added: the ID and location printed by each `fusen add`, and one line on each fusen.

Do not edit the document, reply to fusen, or close them, unless the request asks you to.

## Adding a fusen

```sh
fusen add <file> --lines <range> --quote '<text>' --kind <kind> --author <name> - <<'EOF'
<text of the fusen>
EOF
```

- `--lines` is the line or lines the fusen refers to, as `5` or `5-8`. Leave out `--lines` (and `--quote`) for a fusen on the whole document, such as a missing section.
- `--quote` narrows the fusen to part of the lines. Copy the text exactly as it is in the file, including Markdown such as `**` and backticks. Keep it short, but long enough to show what you mean. Leave out `--quote` to quote the whole lines. If the quote is not in the lines, `fusen add` fails; fix the quote and try again.
- Put the quote in single quotes, so that `$`, backticks, and `"` are not changed by the shell. Write a `'` in the quote as `'\''`.
- `--kind` defaults to `comment`.
- The text of the fusen is read from standard input when the message is `-`. Use a here-document with a quoted delimiter (`<<'EOF'`) so the text is passed as is.

## Writing good fusen

- One point per fusen. Say what the problem is and, when you can, how to fix it.
- Anchor each fusen to the smallest passage the point is about.
- Point out what matters: errors, contradictions, unclear or missing explanations, and risks. Skip matters of taste unless the request asks for them.
- Write in the language of the document, unless the request says otherwise.

## Author

Always pass `--author`. Without it, the fusen is recorded as written by the user.

- If the request gives an author name, use it.
- Otherwise, use your model ID, such as `claude-opus-5-5`.
- If you do not know your model ID, use the name of the agent harness you are running in, in lowercase with hyphens: `claude-code`, `codex`, `gemini-cli`, and so on.

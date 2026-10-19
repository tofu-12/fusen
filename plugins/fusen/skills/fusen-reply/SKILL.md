---
name: fusen-reply
description: Reads the open fusen (review comments) on a Markdown document and replies to the ones you have something to say about, with the fusen CLI. Use when asked to review or comment on the fusen of a document.
---

# Reply to the fusen on a document

Read the `open` fusen on a Markdown document, and reply to each one you have something to add to, using the `fusen` command. The user reads the replies later in the Fusen window. A fusen is a review comment anchored to lines of the document.

## Follow the request first

You may be invoked by the user, or by another agent that asked you to review. The request that invoked this skill names the document and may give more instructions, such as:

- what to focus on, or which fusen to look at,
- the language to write in,
- the author name to record.

Follow those instructions. They take precedence over the defaults below. If the request does not name a document, ask which one.

## Steps

1. Run `fusen` from the project root, usually the root of the repository. Paths are relative to it.
2. Run `fusen list <file>` to list the `open` fusen on the document.
3. Run `fusen show <file> <id>` for each fusen to read its quote, its text, and its replies.
4. Read the document, at least around each quote, so that you understand the context.
5. Reply to each fusen you have something to add to (see below). Leave the others alone.
6. Report which fusen you replied to, with one line on each reply, and which you left alone.

Do not edit the document, close fusen, or add fusen, unless the request asks you to.

## Replying

```sh
fusen reply <file> <id> --author <name> - <<'EOF'
<text of the reply>
EOF
```

- `<id>` can be the short ID shown by `fusen list`.
- The reply is read from standard input when the message is `-`. Use a here-document with a quoted delimiter (`<<'EOF'`) so the text is passed as is.

## When to reply

Reply when you can add something, for example:

- an answer to a question,
- agreement with the reason, or a disagreement with the reason,
- a concrete fix, or a problem with the proposed one,
- something the fusen missed, such as the same problem elsewhere in the document.

Do not reply only to say you agree, and do not repeat what an earlier reply already said. Read the replies in order; the last one may already settle the fusen.

## Writing good replies

- Be specific. Refer to lines and quote the document when it helps.
- Keep each reply short and to the point.
- Write in the language of the fusen, unless the request says otherwise.

## Author

Always pass `--author`. Without it, the reply is recorded as written by the user.

- If the request gives an author name, use it.
- Otherwise, use your model ID, such as `claude-opus-5-5`.
- If you do not know your model ID, use the name of the agent harness you are running in, in lowercase with hyphens: `claude-code`, `codex`, `gemini-cli`, and so on.

// An in-memory backend for developing the UI in a browser (`pnpm dev`),
// used only when the page is not running inside Fusen.app.

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

import type { DocumentState } from "../bindings/DocumentState";
import type { FusenState } from "../bindings/FusenState";
import type { Settings } from "../bindings/Settings";

const spec = `# Authentication

## Overview

API requests are authenticated with **OAuth 2.0**.

Access tokens are stored on the server side.
Refresh tokens are rotated on every use.

## Error handling

TBD
`;

const HASH = "1db15a510bae93d7861227fa25fabddf3a40692c";

const readme = `# Sample

Some \`inline code\` and a [link](https://example.com).

See [the overview of the spec](docs/spec.md#overview), [the code](#code), or [a missing file](nope.md).

\`\`\`mermaid
flowchart LR
    a[CLI] --> c[Core]
    b[App] --> c
\`\`\`

## Code

\`\`\`rust
fn main() {
    println!("hello");
}
\`\`\`
`;

const fusen = (f: Partial<FusenState> & Pick<FusenState, "id" | "kind" | "body">): FusenState => ({
  status: "open",
  anchor: null,
  docHash: HASH,
  createdAt: "2026-09-24T17:03:00+09:00",
  replies: [],
  state: f.status === "closed" ? "closed" : "open",
  ...f,
});

const docs: Record<string, DocumentState> = {
  "docs/spec.md": {
    path: "docs/spec.md",
    content: spec,
    hash: HASH,
    fusen: [
      fusen({
        id: "01K5XQ3M8ZJ4T7R2N9B6W1C0VE",
        kind: "comment",
        body: "Mention that PKCE is required.",
        anchor: { quote: "authenticated with **OAuth 2.0**", lines: "5-5" },
        replies: [
          {
            id: "01K5Y2A7C9E1G3J5K7M9P1R3T5",
            author: "claude-code",
            body: 'Added "PKCE is required for all clients." after line 5.',
            createdAt: "2026-09-24T18:15:00+09:00",
          },
        ],
      }),
      fusen({
        id: "01K5XQ7F1Y0S3H6D9K2M5P8R4T",
        kind: "question",
        body: "How long are refresh tokens valid?\nShould mobile and web use different lifetimes?",
        anchor: {
          quote: "Access tokens are stored on the server side.\nRefresh tokens are rotated on every use.",
          lines: "7-8",
        },
      }),
      fusen({ id: "01K5XQB9C4V7X0Z3A6E9G2J5M8", kind: "comment", status: "closed", body: "Error handling needs more detail." }),
      fusen({
        id: "01K5XQ9A2B3C4D5E6F7G8H9J0K",
        kind: "comment",
        body: "Name the token endpoint here.",
        anchor: { quote: "the old wording", lines: "9-9" },
        docHash: "0000000000000000000000000000000000000000",
        state: "outdated",
      }),
      fusen({ id: "01K5XQD2F6H9K3N7Q1S5V8X2Z4", kind: "question", body: "Should this document also cover token revocation?" }),
    ],
  },
  "README.md": { path: "README.md", content: readme, hash: "x", fusen: [] },
};

let settings: Settings = {
  userName: "user",
  language: "English",
  theme: "light",
  kinds: [
    { id: "comment", label: "Comment", description: "Feedback on the document.", color: "#87ceeb" },
    { id: "question", label: "Question", description: "A question about the document.", color: "#ffd166" },
  ],
};

/** Like Fusen: RFC 3339 in local time with the offset. */
function localTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

let counter = 0;
const newId = () => `01MOCK${String(++counter).padStart(20, "0")}`;

type Args = Record<string, unknown>;

export function installMockBackend() {
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = (payload ?? {}) as Args;
    const doc = () => docs[args.path as string];
    const find = () => doc().fusen.find((f) => f.id === args.id)!;
    switch (cmd) {
      case "get_session":
        return { root: "/sample", singleFile: false, scope: "", document: "docs/spec.md" };
      case "list_files":
        return Object.values(docs)
          .map((d) => ({
            path: d.path,
            openCount: d.fusen.filter((f) => f.state === "open").length,
            outdatedCount: d.fusen.filter((f) => f.state === "outdated").length,
          }))
          .sort((a, b) => a.path.localeCompare(b.path));
      case "resolve_document":
        if (!docs[args.path as string]) throw `no such file or directory: ${args.path}`;
        return args.path;
      case "read_document":
        return structuredClone(doc());
      case "add_fusen": {
        const f = fusen({
          id: newId(),
          kind: args.kind as string,
          body: args.body as string,
          anchor: (args.anchor as FusenState["anchor"]) ?? null,
          createdAt: localTimestamp(),
          state: "open",
        });
        doc().fusen.push(f);
        console.log("[mock] add_fusen", JSON.stringify(args));
        return f;
      }
      case "edit_fusen":
        Object.assign(find(), { kind: args.kind, body: args.body });
        return null;
      case "delete_fusen":
        doc().fusen = doc().fusen.filter((f) => !(args.ids as string[]).includes(f.id));
        return null;
      case "set_status":
        for (const f of doc().fusen.filter((f) => (args.ids as string[]).includes(f.id))) {
          f.status = args.status as FusenState["status"];
          f.state = f.status === "closed" ? "closed" : f.docHash === doc().hash ? "open" : "outdated";
        }
        return null;
      case "add_reply":
        find().replies.push({
          id: newId(),
          author: settings.userName,
          body: args.body as string,
          createdAt: localTimestamp(),
        });
        return null;
      case "get_settings":
        return structuredClone(settings);
      case "default_settings":
        return {
          userName: "user",
          language: "English",
          theme: "light",
          kinds: [
            { id: "comment", label: "Comment", description: "Feedback on the document.", color: "#87ceeb" },
            { id: "question", label: "Question", description: "A question about the document.", color: "#87ceeb" },
            { id: "suggestion", label: "Suggestion", description: "A suggested change to the document.", color: "#87ceeb" },
          ],
        };
      case "save_settings":
        settings = structuredClone(args.settings as Settings);
        return null;
      case "plugin:event|listen":
        return 0;
      case "plugin:event|unlisten":
        return null;
      default:
        throw new Error(`mock: unknown command ${cmd}`);
    }
  });
}

import { useEffect, useState } from "react";

import type { DocumentState } from "../../bindings/DocumentState";
import type { Kind } from "../../bindings/Kind";
import type { NewAnchor } from "../../bindings/NewAnchor";
import type { Located } from "../../lib/fusen";
import type { LinkTarget } from "../../lib/links";
import { kindOf, tint } from "../../lib/kinds";
import Preview from "./Preview";
import SourceView from "./SourceView";

/** A selection that can become a fusen, and where to show the kind buttons. */
export type PendingSelection = { anchor: NewAnchor; x: number; y: number };

export type ViewProps = {
  doc: DocumentState;
  kinds: Kind[];
  located: Located[];
  selectedId: string | null;
  scrollRequest: { id: string; nonce: number } | null;
  onSelectFusen: (id: string | null) => void;
  onSelection: (selection: PendingSelection | null) => void;
  /** A heading to scroll to, from a link. */
  anchorRequest: { id: string; nonce: number } | null;
  /** A link to another document or an external URL was clicked. */
  onFollowLink: (target: LinkTarget) => void;
};

type Props = Omit<ViewProps, "doc" | "onSelection"> & {
  doc: DocumentState | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  canAddFusen: boolean;
  /** Starts a fusen on the whole document. */
  onAddDocumentFusen: () => void;
  onAddFusen: (kind: string, anchor: NewAnchor) => void;
};

/** CSS for the highlights of each kind (see the CSS Custom Highlight API). */
function highlightCss(kinds: Kind[], located: Located[]): string {
  const ids = new Set([...kinds.map((k) => k.id), ...located.map((l) => l.kind)]);
  return [...ids]
    .map((id) => {
      const color = kindOf(kinds, id).color;
      return (
        `::highlight(fusen-${id}) { background-color: ${tint(color)}; }\n` +
        `::highlight(fusen-selected-${id}) { background-color: ${tint(color, 0.6)}; }`
      );
    })
    .join("\n");
}

export default function DocumentView(props: Props) {
  const {
    doc,
    kinds,
    located,
    sidebarOpen,
    onToggleSidebar,
    canAddFusen,
    onAddFusen,
    onAddDocumentFusen,
  } = props;
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const [pending, setPending] = useState<PendingSelection | null>(null);

  useEffect(() => setPending(null), [doc?.path, mode]);

  const choose = (kind: string) => {
    if (!pending) return;
    onAddFusen(kind, pending.anchor);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="flex h-full flex-col">
      <style>{highlightCss(kinds, located)}</style>
      <header className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 px-3 py-2">
        <button
          className="rounded px-2 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title={sidebarOpen ? "Hide file list" : "Show file list"}
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? "⟨ Files" : "Files ⟩"}
        </button>
        <span className="flex-1 truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {doc?.path ?? ""}
        </span>
        {doc && (
          <button
            disabled={!canAddFusen}
            title={canAddFusen ? undefined : "Save or cancel the fusen you are writing first"}
            className="shrink-0 whitespace-nowrap rounded border border-neutral-300 px-2 py-0.5 text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            onClick={onAddDocumentFusen}
          >
            Add fusen to document
          </button>
        )}
        {doc && (
          <div className="flex rounded-md border border-neutral-200 dark:border-neutral-800 p-0.5 text-sm">
            {(["preview", "source"] as const).map((m) => (
              <button
                key={m}
                className={`rounded px-2.5 py-0.5 ${
                  mode === m ? "bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
                onClick={() => setMode(m)}
              >
                {m === "preview" ? "Preview" : "Source"}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        {!doc ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            Select a file to open it.
          </div>
        ) : mode === "preview" ? (
          <Preview {...props} doc={doc} onSelection={setPending} />
        ) : (
          <SourceView {...props} doc={doc} onSelection={setPending} />
        )}
      </div>
      {pending && canAddFusen && (
        <div
          className="fixed z-20 flex gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1 shadow-lg"
          style={{ left: pending.x, top: pending.y + 6 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {kinds.map((k) => (
            <button
              key={k.id}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={k.description ?? undefined}
              onClick={() => choose(k.id)}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

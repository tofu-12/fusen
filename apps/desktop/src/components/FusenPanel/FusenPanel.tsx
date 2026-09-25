import { useEffect, useMemo, useRef, useState } from "react";

import type { DocumentState } from "../../bindings/DocumentState";
import type { Kind } from "../../bindings/Kind";
import type { NewAnchor } from "../../bindings/NewAnchor";
import type { State } from "../../bindings/State";
import * as api from "../../lib/commands";
import ConfirmDialog from "../ConfirmDialog";
import { lineLabel, sortFusen } from "../../lib/fusen";
import FusenCard, { KindPicker, Quote } from "./FusenCard";

const TABS: { state: State; label: string }[] = [
  { state: "open", label: "Open" },
  { state: "outdated", label: "Outdated" },
  { state: "closed", label: "Closed" },
];

/** Bulk actions on the checked fusen. The Open tab has none. */
const BULK: Partial<Record<State, { label: string; status?: "closed" }>> = {
  outdated: { label: "Close", status: "closed" },
  closed: { label: "Delete" },
};

const EMPTY: Record<State, string> = {
  open: "No open fusen. Select text in the document to add one.",
  outdated: "No outdated fusen.",
  closed: "No closed fusen.",
};

/** A fusen being written. `anchor` is null for a fusen on the whole document. */
export type Composer = { kind: string; anchor: NewAnchor | null; docHash: string };

type Props = {
  doc: DocumentState;
  kinds: Kind[];
  selectedId: string | null;
  composer: Composer | null;
  onComposerChange: (composer: Composer | null) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
};

export default function FusenPanel({
  doc,
  kinds,
  selectedId,
  composer,
  onComposerChange,
  editingId,
  onEditingChange,
  onSelect,
  onChanged,
  onError,
}: Props) {
  const [tab, setTab] = useState<State>("open");
  const sorted = useMemo(() => sortFusen(doc.fusen), [doc.fusen]);
  const count = (state: State) => doc.fusen.filter((f) => f.state === state).length;
  const shown = sorted.filter((f) => f.state === tab);
  const busy = composer !== null || editingId !== null;
  const bulk = BULK[tab];
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Checked fusen that have left the list (closed, deleted, or another tab)
  // are no longer part of the bulk action.
  const shownIds = shown.map((f) => f.id).join(",");
  useEffect(() => {
    setChecked((c) => new Set([...c].filter((id) => shownIds.split(",").includes(id))));
  }, [shownIds]);

  const allChecked = shown.length > 0 && shown.every((f) => checked.has(f.id));
  const toggle = (id: string, on: boolean) =>
    setChecked((c) => {
      const next = new Set(c);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const runBulk = async () => {
    const ids = [...checked];
    try {
      if (bulk?.status) await api.setStatus(doc.path, ids, bulk.status);
      else await api.deleteFusen(doc.path, ids);
      setChecked(new Set());
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  // Show the tab of a fusen selected in the document.
  useEffect(() => {
    const selected = doc.fusen.find((f) => f.id === selectedId);
    if (selected) setTab(selected.state);
    // Only when the selection changes, so closing a fusen keeps the tab.
  }, [selectedId]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-1">
          {TABS.map(({ state: t, label }) => (
            <button
              key={t}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-sm ${
                tab === t ? "bg-white dark:bg-neutral-900 font-medium shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
              onClick={() => setTab(t)}
            >
              {label} {count(t)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {composer && (
          <NewFusen
            doc={doc}
            kinds={kinds}
            composer={composer}
            onChange={onComposerChange}
            onSaved={(id) => {
              onComposerChange(null);
              setTab("open");
              onChanged();
              onSelect(id);
            }}
            onError={onError}
          />
        )}
        {bulk && shown.length > 0 && (
          <div className="flex items-center gap-2 px-1 text-sm text-neutral-700 dark:text-neutral-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = checked.size > 0 && !allChecked;
                }}
                onChange={() => setChecked(allChecked ? new Set() : new Set(shown.map((f) => f.id)))}
              />
              Select all
            </label>
            <span className="flex-1" />
            <button
              className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              disabled={checked.size === 0}
              onClick={() => (bulk.status ? runBulk() : setConfirmDelete(true))}
            >
              {bulk.label} selected{checked.size > 0 ? ` (${checked.size})` : ""}
            </button>
          </div>
        )}
        {confirmDelete && (
          <ConfirmDialog
            title={`Delete ${checked.size} fusen?`}
            message="Their replies are deleted too. This cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => {
              setConfirmDelete(false);
              runBulk();
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
        {shown.length === 0 && !composer && (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {EMPTY[tab]}
          </p>
        )}
        {shown.map((f) => (
          <FusenCard
            key={f.id}
            path={doc.path}
            fusen={f}
            kinds={kinds}
            selected={f.id === selectedId}
            editing={f.id === editingId}
            canEdit={!busy}
            onEditingChange={(editing) => onEditingChange(editing ? f.id : null)}
            check={
              bulk ? { checked: checked.has(f.id), onChange: (on) => toggle(f.id, on) } : undefined
            }
            onSelect={() => onSelect(f.id)}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </div>
    </div>
  );
}

function NewFusen({
  doc,
  kinds,
  composer,
  onChange,
  onSaved,
  onError,
}: {
  doc: DocumentState;
  kinds: Kind[];
  composer: Composer;
  onChange: (c: Composer | null) => void;
  onSaved: (id: string) => void;
  onError: (e: unknown) => void;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => textarea.current?.focus(), [composer]);

  const save = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const fusen = await api.addFusen({
        path: doc.path,
        docHash: composer.docHash,
        kind: composer.kind,
        body,
        anchor: composer.anchor,
      });
      onSaved(fusen.id);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-sky-300 bg-white dark:bg-neutral-900 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>New fusen · {composer.anchor ? lineLabel(composer.anchor.lines) : "Document"}</span>
      </div>
      <KindPicker kinds={kinds} value={composer.kind} onChange={(kind) => onChange({ ...composer, kind })} />
      {composer.anchor && <Quote text={composer.anchor.quote} />}
      <textarea
        ref={textarea}
        className="mt-2 w-full resize-y rounded border border-neutral-300 dark:border-neutral-700 p-2 text-sm focus:border-sky-500 focus:outline-none"
        rows={4}
        placeholder="Write a fusen…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => onChange(null)}>
          Cancel
        </button>
        <button
          className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
          disabled={!body.trim() || saving}
          onClick={save}
        >
          Save
        </button>
      </div>
    </div>
  );
}

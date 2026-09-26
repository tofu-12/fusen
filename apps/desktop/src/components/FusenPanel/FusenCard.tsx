import { useEffect, useRef, useState } from "react";

import type { FusenState } from "../../bindings/FusenState";
import type { Kind } from "../../bindings/Kind";
import * as api from "../../lib/commands";
import { formatTime, lineLabel } from "../../lib/fusen";
import { kindOf, tint } from "../../lib/kinds";
import ConfirmDialog from "../ConfirmDialog";

export function KindPicker({
  kinds,
  value,
  onChange,
}: {
  kinds: Kind[];
  value: string;
  onChange: (kind: string) => void;
}) {
  const options = kinds.some((k) => k.id === value) ? kinds : [...kinds, kindOf(kinds, value)];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((k) => (
        <button
          key={k.id}
          title={k.description ?? undefined}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
            k.id === value ? "border-neutral-700 dark:border-neutral-300 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          onClick={() => onChange(k.id)}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
          {k.label}
        </button>
      ))}
    </div>
  );
}

export function Quote({ text }: { text: string }) {
  return (
    <blockquote className="mt-2 line-clamp-4 border-l-2 border-neutral-300 dark:border-neutral-700 pl-2 font-mono text-xs whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
      {text}
    </blockquote>
  );
}

type Props = {
  path: string;
  fusen: FusenState;
  kinds: Kind[];
  selected: boolean;
  editing: boolean;
  /** Whether editing can start; false while another fusen is being written. */
  canEdit: boolean;
  onEditingChange: (editing: boolean) => void;
  /** A checkbox for bulk actions, if the list offers them. */
  check?: { checked: boolean; onChange: (checked: boolean) => void };
  onSelect: () => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
};

export default function FusenCard({
  path,
  fusen,
  kinds,
  selected,
  editing,
  canEdit,
  onEditingChange,
  check,
  onSelect,
  onChanged,
  onError,
}: Props) {
  const kind = kindOf(kinds, fusen.kind);
  const [editKind, setEditKind] = useState(fusen.kind);
  const [editBody, setEditBody] = useState(fusen.body);
  const [reply, setReply] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      onChanged();
    } catch (e) {
      onError(e);
    }
  };

  const setEditing = onEditingChange;

  const startEdit = () => {
    setEditKind(fusen.kind);
    setEditBody(fusen.body);
    setEditing(true);
  };

  const saveEdit = () =>
    run(async () => {
      await api.editFusen(path, fusen.id, editKind, editBody);
      setEditing(false);
    });

  const sendReply = () =>
    reply.trim() &&
    run(async () => {
      await api.addReply(path, fusen.id, reply);
      setReply("");
    });

  return (
    <div
      ref={ref}
      className={`rounded-lg border bg-white dark:bg-neutral-900 p-3 shadow-sm ${
        selected ? "border-neutral-500 dark:border-neutral-400 ring-1 ring-neutral-400 dark:ring-neutral-500" : "border-neutral-200 dark:border-neutral-800"
      }`}
      style={{ borderLeft: `4px solid ${kind.color}` }}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {check && (
          <input
            type="checkbox"
            aria-label="Select this fusen"
            checked={check.checked}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => check.onChange(e.target.checked)}
          />
        )}
        <span
          className="rounded-full px-2 py-0.5 font-medium text-neutral-800 dark:text-neutral-200"
          style={{ background: tint(kind.color, 0.5) }}
        >
          {kind.label}
        </span>
        <span>{fusen.anchor ? lineLabel(fusen.anchor.lines) : "Document"}</span>
        {fusen.state === "outdated" && (
          <span
            className="rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-amber-800 dark:text-amber-200"
            title="The document has changed since this fusen was added."
          >
            Outdated
          </span>
        )}
        <span className="flex-1" />
        <span title={fusen.createdAt}>{formatTime(fusen.createdAt)}</span>
      </div>

      {fusen.anchor && <Quote text={fusen.anchor.quote} />}

      {editing ? (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <KindPicker kinds={kinds} value={editKind} onChange={setEditKind} />
          <textarea
            autoFocus
            className="mt-2 w-full resize-y rounded border border-neutral-300 dark:border-neutral-700 p-2 text-sm focus:border-sky-500 focus:outline-none"
            rows={4}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />
          <div className="mt-1 flex justify-end gap-2">
            <button className="rounded px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700" onClick={saveEdit}>
              Save
            </button>
          </div>
        </div>
      ) : (
        fusen.body && (
          <p className="mt-2 text-sm whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">{fusen.body}</p>
        )
      )}

      {fusen.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-2">
          {fusen.replies.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{r.author}</span> ·{" "}
                <span title={r.createdAt}>{formatTime(r.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      {!editing && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="w-full resize-y rounded border border-neutral-200 dark:border-neutral-800 p-1.5 text-sm focus:border-sky-500 focus:outline-none"
            rows={1}
            placeholder="Reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="mt-1 flex items-center gap-1 text-xs">
            {reply.trim() && (
              <button className="rounded bg-sky-600 px-2 py-1 text-white hover:bg-sky-700" onClick={sendReply}>
                Reply
              </button>
            )}
            <span className="flex-1" />
            <button
              className="rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800"
              onClick={startEdit}
              disabled={!canEdit}
              title={canEdit ? undefined : "Save or cancel the fusen you are writing first"}
            >
              Edit
            </button>
            <button
              className="rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
            {confirmDelete && (
              <ConfirmDialog
                title="Delete this fusen?"
                message="Its replies are deleted too. This cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                  setConfirmDelete(false);
                  run(() => api.deleteFusen(path, [fusen.id]));
                }}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
            <button
              className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() =>
                run(() => api.setStatus(path, [fusen.id], fusen.status === "open" ? "closed" : "open"))
              }
            >
              {fusen.status === "open" ? "Close" : "Reopen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

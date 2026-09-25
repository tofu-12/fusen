import { useMemo, useState } from "react";

import type { FileEntry } from "../../bindings/FileEntry";

type Dir = { name: string; path: string; dirs: Dir[]; files: FileEntry[] };

function buildTree(files: FileEntry[]): Dir {
  const root: Dir = { name: "", path: "", dirs: [], files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const path = dir.path ? `${dir.path}/${part}` : part;
      let child = dir.dirs.find((d) => d.name === part);
      if (!child) {
        child = { name: part, path, dirs: [], files: [] };
        dir.dirs.push(child);
      }
      dir = child;
    }
    dir.files.push(file);
  }
  return root;
}

type Props = {
  files: FileEntry[];
  current: string | null;
  onOpen: (path: string) => void;
};

export default function FileTree({ files, current, onOpen }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (files.length === 0) {
    return <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">No Markdown files.</p>;
  }

  const renderDir = (dir: Dir, depth: number) => (
    <>
      {dir.dirs.map((d) => (
        <div key={d.path}>
          <button
            className="flex w-full items-center gap-1 py-1 pr-2 text-left text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => toggle(d.path)}
          >
            <span className="w-3 text-xs text-neutral-400">{collapsed.has(d.path) ? "▸" : "▾"}</span>
            <span className="truncate">{d.name}</span>
          </button>
          {!collapsed.has(d.path) && renderDir(d, depth + 1)}
        </div>
      ))}
      {dir.files.map((f) => (
        <button
          key={f.path}
          title={f.path}
          className={`flex w-full items-center gap-2 py-1 pr-2 text-left text-sm ${
            f.path === current
              ? "bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-100"
              : "text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          style={{ paddingLeft: 8 + depth * 12 + 16 }}
          onClick={() => onOpen(f.path)}
        >
          <span className="flex-1 truncate">{f.path.split("/").pop()}</span>
          {f.openCount > 0 && (
            <span
              className="rounded-full bg-neutral-200 dark:bg-neutral-700 px-1.5 text-xs text-neutral-700 dark:text-neutral-300"
              title="Open fusen"
            >
              {f.openCount}
            </span>
          )}
          {f.outdatedCount > 0 && (
            <span
              className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              title="Outdated fusen"
            >
              {f.outdatedCount}
            </span>
          )}
        </button>
      ))}
    </>
  );

  return <nav className="py-2">{renderDir(tree, 0)}</nav>;
}

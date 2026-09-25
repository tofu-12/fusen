import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentState } from "./bindings/DocumentState";
import type { FileEntry } from "./bindings/FileEntry";
import type { NewAnchor } from "./bindings/NewAnchor";
import type { SessionInfo } from "./bindings/SessionInfo";
import type { Settings } from "./bindings/Settings";
import ConfirmDialog from "./components/ConfirmDialog";
import DocumentView from "./components/DocumentView/DocumentView";
import FileTree from "./components/FileTree/FileTree";
import FusenPanel, { type Composer } from "./components/FusenPanel/FusenPanel";
import SettingsView from "./components/Settings/SettingsView";
import { GearIcon } from "./components/icons";
import * as api from "./lib/commands";
import { locate } from "./lib/fusen";
import type { LinkTarget } from "./lib/links";
import { useApplyTheme } from "./lib/theme";

const NO_KINDS: Settings["kinds"] = [];

export default function MainWindow() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ id: string; nonce: number } | null>(null);
  // A heading to scroll to once the document at `path` is shown.
  const [anchorRequest, setAnchorRequest] = useState<{ path: string; id: string; nonce: number } | null>(
    null,
  );
  const [composer, setComposer] = useState<Composer | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  // What to do after the user agrees to discard unsaved settings.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const report = useCallback((e: unknown) => setError(String(e)), []);

  const loadFiles = useCallback(() => {
    api.listFiles().then(setFiles).catch(report);
  }, [report]);

  const loadDoc = useCallback(
    (path: string | null) => {
      if (!path) {
        setDoc(null);
        return;
      }
      api
        .readDocument(path)
        .then((d) => {
          if (currentPathRef.current === path) setDoc(d);
        })
        .catch((e) => {
          // The document may have been deleted.
          if (currentPathRef.current === path) setDoc(null);
          report(e);
        });
    },
    [report],
  );

  const loadSettings = useCallback(() => {
    api.getSettings().then(setSettings).catch(report);
  }, [report]);

  const applySession = useCallback(
    (info: SessionInfo | null) => {
      const previous = sessionRef.current;
      setSession(info);
      if (!info) return;
      setSidebarOpen(!info.singleFile);
      loadFiles();
      if (info.document) {
        setCurrentPath(info.document);
      } else if (previous?.root !== info.root) {
        setCurrentPath(null);
      }
    },
    [loadFiles],
  );

  useEffect(() => {
    api.getSession().then(applySession).catch(report);
    loadSettings();
    const unlisten = [
      api.onOpenTarget(applySession),
      api.onFilesChanged(loadFiles),
      api.onDocumentChanged((path) => {
        if (path === currentPathRef.current) loadDoc(path);
      }),
      api.onSettingsChanged(loadSettings),
      api.onShowSettings(() => setShowSettings(true)),
    ];
    return () => {
      unlisten.forEach((p) => p.then((f) => f()));
    };
  }, [applySession, loadFiles, loadDoc, loadSettings, report]);

  useEffect(() => {
    setSelectedId(null);
    setComposer(null);
    setEditingId(null);
    setDoc(null);
    loadDoc(currentPath);
  }, [currentPath, loadDoc]);

  useApplyTheme(settings?.theme);

  const kinds = settings?.kinds ?? NO_KINDS;
  const located = useMemo(() => (doc ? locate(doc.content, doc.hash, doc.fusen) : []), [doc]);

  const selectFusen = useCallback((id: string | null, scroll: boolean) => {
    setSelectedId(id);
    if (id && scroll) setScrollRequest({ id, nonce: Date.now() });
  }, []);

  const startFusen = useCallback(
    (kind: string, anchor: NewAnchor | null) => {
      if (!doc) return;
      setComposer({ kind, anchor, docHash: doc.hash });
    },
    [doc],
  );

  // A fusen deleted elsewhere (for example with git) cannot stay in edit mode.
  useEffect(() => {
    if (editingId && doc && !doc.fusen.some((f) => f.id === editingId)) setEditingId(null);
  }, [doc, editingId]);

  // While a fusen is being written or edited, others cannot be added or edited.
  const busy = composer !== null || editingId !== null;

  const refresh = useCallback(() => {
    loadDoc(currentPathRef.current);
    loadFiles();
  }, [loadDoc, loadFiles]);

  /** Follows a link in the preview (headings in the same document are
   * handled by the preview itself). */
  const followLink = (target: LinkTarget) => {
    if (target.kind === "external") {
      api.openExternal(target.url);
      return;
    }
    if (target.kind !== "document") return;
    api
      .resolveDocument(target.path)
      .then((path) => {
        setAnchorRequest(target.id ? { path, id: target.id, nonce: Date.now() } : null);
        setCurrentPath(path);
      })
      .catch((e) => report(`Cannot open the link: ${e}`));
  };

  /** Leaves the settings, asking first if there are unsaved changes. */
  const leaveSettings = (then: () => void) => {
    if (showSettings && settingsDirty) {
      setPendingLeave(() => then);
    } else {
      then();
    }
  };

  const closeSettings = () => leaveSettings(() => setShowSettings(false));

  const openFile = (path: string) =>
    leaveSettings(() => {
      setShowSettings(false);
      setCurrentPath(path);
    });

  const settingsView = settings && (
    <SettingsView
      settings={settings}
      onSaved={setSettings}
      onDirtyChange={setSettingsDirty}
      onClose={closeSettings}
      onError={report}
    />
  );

  const errorBar = error && (
    <div className="flex items-start gap-3 border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-800 dark:text-red-200">
      <span className="flex-1 whitespace-pre-wrap">{error}</span>
      <button className="text-red-600 dark:text-red-400 hover:text-red-900" onClick={() => setError(null)}>
        Dismiss
      </button>
    </div>
  );

  const discardDialog = pendingLeave && (
    <ConfirmDialog
      title="Discard unsaved changes?"
      message="Your changes to the settings have not been saved."
      confirmLabel="Discard"
      onConfirm={() => {
        pendingLeave();
        setPendingLeave(null);
        setSettingsDirty(false);
      }}
      onCancel={() => setPendingLeave(null)}
    />
  );

  if (!session && showSettings && settingsView) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">{settingsView}</div>
        {errorBar}
        {discardDialog}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400">
        <div className="text-center">
          <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300">No project is open</p>
          <p className="mt-2 text-sm">
            Run <code className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5">fusen .</code> in your
            project to open it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FileTree files={files} current={currentPath} onOpen={openFile} />
            </div>
            <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
              <button
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  showSettings
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
                onClick={() => setShowSettings(true)}
              >
                <GearIcon />
                Settings
              </button>
            </div>
          </aside>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          {showSettings && settingsView ? (
            settingsView
          ) : (
            <DocumentView
              doc={doc}
              kinds={kinds}
              located={located}
              selectedId={selectedId}
              scrollRequest={scrollRequest}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((o) => !o)}
              onSelectFusen={(id) => selectFusen(id, false)}
              canAddFusen={!busy}
              onAddFusen={startFusen}
              onAddDocumentFusen={() => startFusen(kinds[0]?.id ?? "comment", null)}
              anchorRequest={anchorRequest && anchorRequest.path === doc?.path ? anchorRequest : null}
              onFollowLink={followLink}
            />
          )}
        </main>
        {doc && !showSettings && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
            <FusenPanel
              doc={doc}
              kinds={kinds}
              selectedId={selectedId}
              composer={composer}
              onComposerChange={setComposer}
              editingId={editingId}
              onEditingChange={setEditingId}
              onSelect={(id) => selectFusen(id, true)}
              onChanged={refresh}
              onError={report}
            />
          </aside>
        )}
      </div>
      {errorBar}
      {discardDialog}
    </div>
  );
}

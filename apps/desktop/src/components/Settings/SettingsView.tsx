import { useEffect, useState, type ReactNode } from "react";

import type { Kind } from "../../bindings/Kind";
import type { Settings } from "../../bindings/Settings";
import * as api from "../../lib/commands";
import { DEFAULT_COLOR, KIND_ID, PALETTE } from "../../lib/kinds";

/** Languages offered for the reply language. Others can be typed in. */
const LANGUAGES = [
  "English",
  "Japanese",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Russian",
  "Vietnamese",
];

const OTHER = "__other__";

/** The default label of a kind: its ID with the first letter capitalized. */
const defaultLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm focus:border-sky-500 focus:outline-none dark:border-neutral-700";

const buttonClass =
  "rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800";

/** Fills in what the settings file expects: a label, and no empty description. */
function normalize(settings: Settings): Settings {
  return {
    ...settings,
    kinds: settings.kinds.map((k) => ({
      ...k,
      label: k.label.trim() || defaultLabel(k.id),
      description: k.description?.trim() ? k.description : null,
    })),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One setting, with a button that returns it to its default. */
function Item({
  label,
  help,
  canReset,
  onReset,
  children,
}: {
  label: string;
  help?: string;
  canReset: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</h2>
        <span className="flex-1" />
        <button
          className="text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-40 disabled:hover:text-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-200"
          disabled={!canReset}
          onClick={onReset}
        >
          Reset to default
        </button>
      </div>
      {help && <p className="text-xs text-neutral-500 dark:text-neutral-400">{help}</p>}
      <div className="mt-1">{children}</div>
    </section>
  );
}

function LanguagePicker({ value, onChange }: { value: string; onChange: (language: string) => void }) {
  const [other, setOther] = useState(!LANGUAGES.includes(value));
  // Reset to default can set a listed language while "Other…" is chosen.
  useEffect(() => {
    if (LANGUAGES.includes(value)) setOther(false);
  }, [value]);
  return (
    <div className="flex gap-2">
      <select
        className={`${inputClass} w-56 flex-none`}
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true);
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {other && (
        <input
          className={inputClass}
          placeholder="Language, in English"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const custom = !PALETTE.some((c) => c.value === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c.value}
          title={c.name}
          className={`h-6 w-6 rounded-full border ${
            c.value === value.toLowerCase()
              ? "border-neutral-800 ring-2 ring-neutral-400 dark:ring-neutral-500"
              : "border-neutral-300 dark:border-neutral-700"
          }`}
          style={{ background: c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
      <label
        className="relative flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400"
        title="Choose any color"
      >
        <span
          className={`h-6 w-6 rounded-full border ${
            custom
              ? "border-neutral-800 ring-2 ring-neutral-400 dark:ring-neutral-500"
              : "border-dashed border-neutral-400 dark:border-neutral-600"
          }`}
          style={custom ? { background: value } : undefined}
        />
        Custom
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
      </label>
    </div>
  );
}

type Props = {
  /** The saved settings. */
  settings: Settings;
  onSaved: (settings: Settings) => void;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  onError: (e: unknown) => void;
};

/** The settings, shown in the center of the window. Changes apply on Save. */
export default function SettingsView({ settings, onSaved, onDirtyChange, onClose, onError }: Props) {
  const [draft, setDraft] = useState(settings);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [newKind, setNewKind] = useState("");
  const [kindError, setKindError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = !same(normalize(draft), settings);

  useEffect(() => {
    api.defaultSettings().then(setDefaults).catch(onError);
  }, [onError]);

  // Take in changes made elsewhere (such as `fusen config`) unless there are
  // unsaved changes here.
  const [base, setBase] = useState(settings);
  if (!same(base, settings)) {
    setBase(settings);
    if (!dirty) setDraft(settings);
  }

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    const next = normalize(draft);
    setSaving(true);
    try {
      await api.saveSettings(next);
      setDraft(next);
      onSaved(next);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const updateKind = (id: string, patch: Partial<Kind>) =>
    setDraft({ ...draft, kinds: draft.kinds.map((k) => (k.id === id ? { ...k, ...patch } : k)) });

  const addKind = () => {
    const id = newKind.trim();
    if (!KIND_ID.test(id)) {
      setKindError('Kind IDs can only contain lowercase letters, digits, "-" and "_" (up to 32 characters).');
      return;
    }
    if (draft.kinds.some((k) => k.id === id)) {
      setKindError(`The kind ${id} already exists.`);
      return;
    }
    setKindError(null);
    setNewKind("");
    setDraft({ ...draft, kinds: [...draft.kinds, { id, label: defaultLabel(id), description: null, color: DEFAULT_COLOR }] });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="flex-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Settings</span>
        {dirty && <span className="text-xs text-neutral-500 dark:text-neutral-400">Unsaved changes</span>}
        <button className={buttonClass} onClick={onClose}>
          Close
        </button>
        <button
          className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600"
          disabled={!dirty || saving}
          onClick={save}
        >
          Save
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-6 p-6">
          <Item
            label="Name"
            help="Used for your replies."
            canReset={!!defaults && draft.userName !== defaults.userName}
            onReset={() => defaults && setDraft({ ...draft, userName: defaults.userName })}
          >
            <input
              className={inputClass}
              value={draft.userName}
              onChange={(e) => setDraft({ ...draft, userName: e.target.value })}
            />
          </Item>

          <Item
            label="Reply language"
            help="The language the AI replies in with fusen prompt."
            canReset={!!defaults && draft.language !== defaults.language}
            onReset={() => defaults && setDraft({ ...draft, language: defaults.language })}
          >
            <LanguagePicker
              value={draft.language}
              onChange={(language) => setDraft({ ...draft, language })}
            />
          </Item>

          <Item
            label="Appearance"
            canReset={!!defaults && draft.theme !== defaults.theme}
            onReset={() => defaults && setDraft({ ...draft, theme: defaults.theme })}
          >
            <div className="inline-flex rounded-md border border-neutral-300 p-0.5 text-sm dark:border-neutral-700">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  className={`rounded px-3 py-0.5 ${
                    draft.theme === t.value
                      ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                  onClick={() => setDraft({ ...draft, theme: t.value })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Item>

          <Item
            label="Fusen kinds"
            help="The description tells the AI how to handle fusen of the kind."
            canReset={!!defaults && !same(normalize(draft).kinds, defaults.kinds)}
            onReset={() => defaults && setDraft({ ...draft, kinds: defaults.kinds })}
          >
            <div className="space-y-3">
              {draft.kinds.map((k) => (
                <div
                  key={k.id}
                  className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-neutral-500 dark:text-neutral-400">{k.id}</code>
                    <span className="flex-1" />
                    <button
                      className="text-xs text-neutral-500 hover:text-red-700 disabled:opacity-40 dark:text-neutral-400"
                      disabled={draft.kinds.length <= 1}
                      title={draft.kinds.length <= 1 ? "At least one kind is needed" : undefined}
                      onClick={() => setDraft({ ...draft, kinds: draft.kinds.filter((x) => x.id !== k.id) })}
                    >
                      Delete
                    </button>
                  </div>
                  <input
                    className={inputClass}
                    placeholder="Label"
                    value={k.label}
                    onChange={(e) => updateKind(k.id, { label: e.target.value })}
                  />
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="Description"
                    value={k.description ?? ""}
                    onChange={(e) => updateKind(k.id, { description: e.target.value })}
                  />
                  <ColorPicker value={k.color} onChange={(color) => updateKind(k.id, { color })} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                placeholder="New kind ID"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
              />
              <button className={buttonClass} onClick={addKind}>
                Add kind
              </button>
            </div>
            {kindError && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{kindError}</p>}
          </Item>
        </div>
      </div>
    </div>
  );
}

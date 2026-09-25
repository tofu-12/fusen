import type { Kind } from "../bindings/Kind";

export const DEFAULT_COLOR = "#87ceeb";

/** Colors offered in the settings window (see docs/gui.md, "Settings"). */
export const PALETTE = [
  { name: "Light blue", value: "#87ceeb" },
  { name: "Yellow", value: "#ffd166" },
  { name: "Green", value: "#95d5b2" },
  { name: "Pink", value: "#ffadc6" },
  { name: "Orange", value: "#ffb870" },
  { name: "Purple", value: "#c8b6ff" },
];

export const KIND_ID = /^[a-z0-9_-]{1,32}$/;

/** A kind by ID. Kinds not in the settings are shown by their ID. */
export function kindOf(kinds: Kind[], id: string): Kind {
  return (
    kinds.find((k) => k.id === id) ?? { id, label: id, description: null, color: DEFAULT_COLOR }
  );
}

/** A `#rrggbb` color with the given opacity. Highlights use 75% transparency. */
export function tint(color: string, alpha = 0.25): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return tint(DEFAULT_COLOR, alpha);
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

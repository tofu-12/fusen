import type { FusenState } from "../bindings/FusenState";
import { locateQuote, type SourceRange } from "./sourceMap";

/** A fusen whose quote was found in the current document. */
export type Located = SourceRange & { id: string; kind: string };

/** Fusen on the whole document first, then the rest in line order. */
export function sortFusen(fusen: FusenState[]): FusenState[] {
  const line = (f: FusenState) => (f.anchor ? parseInt(f.anchor.lines, 10) : 0);
  return [...fusen].sort((a, b) => line(a) - line(b));
}

/** Where to highlight each fusen. Fusen added before the document last
 * changed (outdated, or closed after it changed) are not highlighted. */
export function locate(content: string, hash: string, fusen: FusenState[]): Located[] {
  const located: Located[] = [];
  for (const f of fusen) {
    if (f.docHash !== hash || !f.anchor) continue;
    const range = locateQuote(content, f.anchor.quote, f.anchor.lines);
    if (range) located.push({ ...range, id: f.id, kind: f.kind });
  }
  return located;
}

export function lineLabel(lines: string): string {
  const [start, end] = lines.split("-");
  return start === end ? `Line ${start}` : `Lines ${start}–${end}`;
}

export function formatTime(rfc3339: string): string {
  const date = new Date(rfc3339);
  return isNaN(date.getTime())
    ? rfc3339
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

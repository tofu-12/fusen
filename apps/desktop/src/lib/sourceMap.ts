// Maps between the rendered preview and the Markdown source.
//
// `rehypeSourcePositions` marks rendered elements with their source range
// (`data-s` / `data-e`). The innermost ones (`data-leaf`) wrap text: each text
// node, and each code block. Within a leaf, rendered characters are aligned
// with the source greedily, which skips Markdown syntax such as `\` escapes
// and the `> ` of block quotes.

import type { Element, ElementContent, Root, RootContent } from "hast";

import type { NewAnchor } from "../bindings/NewAnchor";

export type SourceRange = { start: number; end: number };

const NO_TEXT_CHILDREN = new Set(["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"]);

/** Tags whose Markdown syntax surrounds their text, such as `**` or `[...](...)`. */
const INLINE_SYNTAX = new Set(["STRONG", "EM", "DEL", "CODE", "A"]);

/**
 * A rehype plugin that adds source positions. Run it after rehype-highlight.
 */
export function rehypeSourcePositions(source: string) {
  return (tree: Root) => {
    walk(tree, source);
  };
}

function walk(node: Root | Element, source: string) {
  const children = node.children as (RootContent | ElementContent)[];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === "element") {
      const start = child.position?.start.offset;
      const end = child.position?.end.offset;
      if (start != null && end != null) {
        child.properties.dataS = start;
        child.properties.dataE = end;
      }
      if (child.tagName === "pre") {
        markCodeBlock(child, source);
      } else {
        walk(child, source);
      }
    } else if (
      child.type === "text" &&
      node.type === "element" &&
      !NO_TEXT_CHILDREN.has(node.tagName) &&
      child.position?.start.offset != null &&
      child.position.end.offset != null
    ) {
      children[i] = {
        type: "element",
        tagName: "span",
        properties: {
          dataS: child.position.start.offset,
          dataE: child.position.end.offset,
          dataLeaf: "",
        },
        children: [child],
        position: child.position,
      };
    }
  }
}

/** Marks the `code` of a code block as one leaf, starting after the opening fence. */
function markCodeBlock(pre: Element, source: string) {
  const code = pre.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "code",
  );
  const start = pre.position?.start.offset;
  const end = pre.position?.end.offset;
  if (!code || start == null || end == null) return;
  let contentStart = start;
  if (/^ {0,3}(```|~~~)/.test(source.slice(start, start + 6))) {
    const newline = source.indexOf("\n", start);
    contentStart = newline === -1 || newline >= end ? end : newline + 1;
  }
  code.properties.dataS = contentStart;
  code.properties.dataE = end;
  code.properties.dataLeaf = "";
}

// --- Alignment ---

/**
 * For each character of `text`, the index of the matching character in `src`.
 * Characters with no match nearby (such as decoded entities) take the current
 * position without consuming it.
 */
function align(text: string, src: string): number[] {
  const map: number[] = new Array(text.length);
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    const k = src.indexOf(text[i], j);
    if (k === -1 || k - j > 64) {
      map[i] = Math.min(j, src.length);
    } else {
      map[i] = k;
      j = k + 1;
    }
  }
  return map;
}

/** Converts a text offset in a leaf to a source offset. */
function textToSource(map: number[], base: number, t: number, edge: "start" | "end"): number {
  if (map.length === 0) return base;
  if (edge === "start") {
    return t < map.length ? base + map[t] : base + map[map.length - 1] + 1;
  }
  return t > 0 ? base + map[Math.min(t, map.length) - 1] + 1 : base + map[0];
}

// --- Lines ---

function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Builds an anchor from a source range, trimming surrounding whitespace. */
export function anchorFromRange(source: string, range: SourceRange): NewAnchor | null {
  let { start, end } = range;
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;
  if (start >= end) return null;
  const startLine = lineOf(source, start);
  const endLine = startLine + (source.slice(start, end - 1).match(/\n/g)?.length ?? 0);
  return {
    quote: source.slice(start, end).replace(/\r\n/g, "\n"),
    lines: `${startLine}-${endLine}`,
  };
}

/** Finds an anchor's quote in the source, preferring the recorded start line. */
export function locateQuote(source: string, quote: string, lines: string): SourceRange | null {
  const startLine = parseInt(lines.split("-")[0], 10);
  const candidates = [quote, quote.replace(/\n/g, "\r\n")];
  let best: SourceRange | null = null;
  let bestDistance = Infinity;
  for (const q of candidates) {
    let idx = source.indexOf(q);
    while (idx !== -1) {
      const distance = Math.abs(lineOf(source, idx) - startLine);
      if (distance < bestDistance) {
        best = { start: idx, end: idx + q.length };
        bestDistance = distance;
      }
      if (distance === 0) return best;
      idx = source.indexOf(q, idx + 1);
    }
  }
  return best;
}

// --- DOM ---

function dataRange(el: Element | HTMLElement): SourceRange {
  const h = el as HTMLElement;
  return { start: Number(h.dataset.s), end: Number(h.dataset.e) };
}

function leaves(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-leaf]"));
}

/** The number of characters of `el`'s text before the point. */
function textOffsetIn(el: Node, node: Node, offset: number): number {
  const range = el.ownerDocument!.createRange();
  range.selectNodeContents(el);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** The DOM position of the `t`-th character of `el`'s text. */
function domPointAt(el: HTMLElement, t: number): [Node, number] {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (t <= text.length) return [text, t];
    t -= text.length;
    last = text;
  }
  return last ? [last, last.length] : [el, 0];
}

function comparePoint(el: HTMLElement, node: Node, offset: number): number {
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  return range.comparePoint(node, offset);
}

/** Converts a DOM point to a source offset, and returns the leaf it is in. */
function pointToSource(
  root: HTMLElement,
  source: string,
  node: Node,
  offset: number,
  edge: "start" | "end",
): { offset: number; leaf: HTMLElement } | null {
  const all = leaves(root);
  let leaf: HTMLElement | undefined;
  let t = 0;
  if (edge === "start") {
    leaf = all.find((l) => comparePoint(l, node, offset) <= 0);
    if (!leaf) return null;
    t = comparePoint(leaf, node, offset) === 0 ? textOffsetIn(leaf, node, offset) : 0;
  } else {
    leaf = all.findLast((l) => comparePoint(l, node, offset) >= 0);
    if (!leaf) return null;
    t =
      comparePoint(leaf, node, offset) === 0
        ? textOffsetIn(leaf, node, offset)
        : (leaf.textContent ?? "").length;
  }
  // A point at the end of one leaf is the same as the start of the next.
  const index = all.indexOf(leaf);
  if (edge === "start" && t >= (leaf.textContent ?? "").length && index + 1 < all.length) {
    leaf = all[index + 1];
    t = 0;
  } else if (edge === "end" && t === 0 && index > 0) {
    leaf = all[index - 1];
    t = (leaf.textContent ?? "").length;
  }
  const { start, end } = dataRange(leaf);
  const text = leaf.textContent ?? "";
  let result = textToSource(align(text, source.slice(start, end)), start, t, edge);
  // Keep the backslash of an escaped first character.
  if (edge === "start" && result > start && source[result - 1] === "\\") result--;
  return { offset: result, leaf };
}

/** Whether `range` covers all of `el`'s text. */
function covers(range: Range, el: HTMLElement): boolean {
  const length = (el.textContent ?? "").length;
  const startsBefore =
    comparePoint(el, range.startContainer, range.startOffset) < 0 ||
    textOffsetIn(el, range.startContainer, range.startOffset) === 0;
  const endsAfter =
    comparePoint(el, range.endContainer, range.endOffset) > 0 ||
    textOffsetIn(el, range.endContainer, range.endOffset) === length;
  return startsBefore && endsAfter;
}

/**
 * Widens `offset` to include the syntax around inline elements (`**`,
 * backticks, `[...](...)`) that the selection covers completely.
 */
function includeSyntax(
  root: HTMLElement,
  range: Range,
  leaf: HTMLElement,
  offset: number,
  edge: "start" | "end",
): number {
  for (let el = leaf.parentElement; el && el !== root; el = el.parentElement) {
    if (!INLINE_SYNTAX.has(el.tagName) || el.dataset.s == null || !covers(range, el)) break;
    offset = edge === "start" ? Math.min(offset, dataRange(el).start) : Math.max(offset, dataRange(el).end);
  }
  return offset;
}

/** Converts a DOM selection range in the preview to an anchor. */
export function selectionToAnchor(
  root: HTMLElement,
  source: string,
  range: Range,
): NewAnchor | null {
  if (!root.contains(range.commonAncestorContainer)) return null;
  const start = pointToSource(root, source, range.startContainer, range.startOffset, "start");
  const end = pointToSource(root, source, range.endContainer, range.endOffset, "end");
  if (!start || !end) return null;
  const s = includeSyntax(root, range, start.leaf, start.offset, "start");
  const e = includeSyntax(root, range, end.leaf, end.offset, "end");
  if (e <= s) return null;
  return anchorFromRange(source, { start: s, end: e });
}

/** Converts a source range to DOM ranges in the preview, one per leaf. */
export function sourceToDomRanges(root: HTMLElement, source: string, target: SourceRange): Range[] {
  const ranges: Range[] = [];
  for (const leaf of leaves(root)) {
    const { start, end } = dataRange(leaf);
    if (end <= target.start || start >= target.end) continue;
    const text = leaf.textContent ?? "";
    const map = align(text, source.slice(start, end));
    let first = -1;
    let last = -1;
    for (let i = 0; i < map.length; i++) {
      const s = start + map[i];
      if (s >= target.start && s < target.end) {
        if (first === -1) first = i;
        last = i;
      }
    }
    if (first === -1) continue;
    const range = leaf.ownerDocument.createRange();
    range.setStart(...domPointAt(leaf, first));
    range.setEnd(...domPointAt(leaf, last + 1));
    ranges.push(range);
  }
  return ranges;
}

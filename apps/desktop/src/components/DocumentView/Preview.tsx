import type { Element, ElementContent } from "hast";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";

import { kindOf } from "../../lib/kinds";
import { classifyLink } from "../../lib/links";
import { rehypePlugins, remarkPlugins } from "../../lib/markdown";
import { selectionToAnchor, sourceToDomRanges } from "../../lib/sourceMap";
import type { ViewProps } from "./DocumentView";
import Mermaid from "./Mermaid";

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

const components: Components = {
  pre({ node, children, ...props }) {
    const code = node?.children.find(
      (c): c is Element => c.type === "element" && c.tagName === "code",
    );
    const classes = code?.properties.className;
    if (code && Array.isArray(classes) && classes.includes("language-mermaid")) {
      return <Mermaid code={textOf(code).replace(/\n$/, "")} />;
    }
    return <pre {...props}>{children}</pre>;
  },
};

type Marker = { id: string; top: number; left: number; color: string };

/** Registers highlights with the CSS Custom Highlight API, one per kind. */
function applyHighlights(
  ranges: Map<string, Range[]>,
  located: ViewProps["located"],
  selectedId: string | null,
) {
  clearHighlights();
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  const groups = new Map<string, Range[]>();
  for (const l of located) {
    const name = l.id === selectedId ? `fusen-selected-${l.kind}` : `fusen-${l.kind}`;
    groups.set(name, [...(groups.get(name) ?? []), ...(ranges.get(l.id) ?? [])]);
  }
  for (const [name, rs] of groups) {
    const highlight = new Highlight(...rs);
    if (name.startsWith("fusen-selected-")) highlight.priority = 1;
    CSS.highlights.set(name, highlight);
  }
}

function clearHighlights() {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  for (const name of [...CSS.highlights.keys()]) {
    if (name.startsWith("fusen-")) CSS.highlights.delete(name);
  }
}

export default function Preview({
  doc,
  kinds,
  located,
  selectedId,
  scrollRequest,
  onSelectFusen,
  onSelection,
  anchorRequest,
  onFollowLink,
}: ViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rangesRef = useRef(new Map<string, Range[]>());
  const [markers, setMarkers] = useState<Marker[]>([]);

  const content = useMemo(
    () => (
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins(doc.content)}
        components={components}
      >
        {doc.content}
      </Markdown>
    ),
    [doc.content],
  );

  const updateMarkers = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const byLine = new Map<number, number>();
    const next: Marker[] = [];
    for (const l of located) {
      const first = rangesRef.current.get(l.id)?.[0];
      const rect = first?.getClientRects()[0];
      if (!rect) continue;
      const top = Math.round(rect.top - base.top);
      const stacked = byLine.get(top) ?? 0;
      byLine.set(top, stacked + 1);
      next.push({ id: l.id, top, left: stacked * 10, color: kindOf(kinds, l.kind).color });
    }
    setMarkers((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [located, kinds]);

  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const ranges = new Map<string, Range[]>();
    for (const l of located) ranges.set(l.id, sourceToDomRanges(root, doc.content, l));
    rangesRef.current = ranges;
    applyHighlights(ranges, located, selectedId);
    updateMarkers();
    return clearHighlights;
  }, [doc.content, located, kinds, selectedId, updateMarkers]);

  // Mermaid diagrams and window resizes move the text.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => updateMarkers());
    observer.observe(root);
    return () => observer.disconnect();
  }, [updateMarkers]);

  useEffect(() => {
    if (!scrollRequest) return;
    const first = rangesRef.current.get(scrollRequest.id)?.[0];
    const el = first?.startContainer.parentElement;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollRequest]);

  const handleMouseUp = () => {
    requestAnimationFrame(() => {
      const root = contentRef.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        onSelection(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const anchor = selectionToAnchor(root, doc.content, range);
      const rects = range.getClientRects();
      const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
      onSelection(anchor ? { anchor, x: last.left, y: last.bottom } : null);
    });
  };

  const scrollToHeading = (id: string) => {
    const target = id ? contentRef.current?.querySelector(`[id="${CSS.escape(id)}"]`) : null;
    if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
    else scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // A link from another document asked for a heading in this one.
  useEffect(() => {
    if (anchorRequest) scrollToHeading(anchorRequest.id);
    // Run when the request or the rendered document changes.
  }, [anchorRequest, doc.content]);

  const handleClick = (e: React.MouseEvent) => {
    // Links never navigate the window: headings scroll, other documents
    // open in Fusen, and URLs open in the browser.
    const link = (e.target as HTMLElement).closest("a[href]");
    if (link && contentRef.current?.contains(link)) {
      e.preventDefault();
      const target = classifyLink(link.getAttribute("href") ?? "", doc.path);
      if (target.kind === "anchor") scrollToHeading(target.id);
      else onFollowLink(target);
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const caret = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (!caret) return;
    for (const [id, ranges] of rangesRef.current) {
      if (ranges.some((r) => r.isPointInRange(caret.startContainer, caret.startOffset))) {
        onSelectFusen(id);
        return;
      }
    }
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="relative mx-auto max-w-3xl py-8 pr-10 pl-14">
        <div className="absolute top-8 left-4">
          {markers.map((m) => (
            <button
              key={m.id}
              className="fusen-dot absolute"
              style={{
                top: m.top,
                left: m.left,
                background: m.color,
                outline: m.id === selectedId ? "2px solid #404040" : undefined,
              }}
              title="Show fusen"
              onClick={() => onSelectFusen(m.id)}
            />
          ))}
        </div>
        <div
          ref={contentRef}
          className="prose dark:prose-invert prose-neutral max-w-none"
          onMouseUp={handleMouseUp}
          onClick={handleClick}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

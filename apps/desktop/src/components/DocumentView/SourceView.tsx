import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, RangeSet, type Extension } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, gutter, lineNumbers } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useRef } from "react";

import type { Kind } from "../../bindings/Kind";
import type { Located } from "../../lib/fusen";
import { kindOf, tint } from "../../lib/kinds";
import { anchorFromRange } from "../../lib/sourceMap";
import { useIsDark } from "../../lib/theme";
import type { ViewProps } from "./DocumentView";

class Dot extends GutterMarker {
  constructor(
    readonly id: string,
    readonly color: string,
    readonly selected: boolean,
  ) {
    super();
  }

  eq(other: Dot) {
    return other.id === this.id && other.color === this.color && other.selected === this.selected;
  }

  toDOM() {
    const dot = document.createElement("div");
    dot.className = "fusen-dot";
    dot.style.background = this.color;
    if (this.selected) dot.style.outline = "2px solid #404040";
    dot.dataset.fusen = this.id;
    return dot;
  }
}

/** Highlights and gutter markers for the fusen. */
function fusenExtension(
  located: Located[],
  kinds: Kind[],
  selectedId: string | null,
  length: number,
  onSelect: (id: string) => void,
): Extension {
  const visible = located.filter((l) => l.end <= length && l.start < l.end);
  const marks = visible.map((l) => {
    const color = kindOf(kinds, l.kind).color;
    const selected = l.id === selectedId;
    return Decoration.mark({
      attributes: {
        style: `background-color: ${tint(color, selected ? 0.6 : 0.25)}`,
        "data-fusen": l.id,
      },
    }).range(l.start, l.end);
  });
  return [
    EditorView.decorations.of(Decoration.set(marks, true)),
    gutter({
      class: "cm-fusen-gutter",
      markers: (view) =>
        RangeSet.of(
          visible.map((l) =>
            new Dot(l.id, kindOf(kinds, l.kind).color, l.id === selectedId).range(
              view.state.doc.lineAt(l.start).from,
            ),
          ),
          true,
        ),
      domEventHandlers: {
        mousedown(_view, _line, event) {
          const id = (event.target as HTMLElement).dataset?.fusen;
          if (id) onSelect(id);
          return !!id;
        },
      },
    }),
  ];
}

export default function SourceView({
  doc,
  kinds,
  located,
  selectedId,
  scrollRequest,
  onSelectFusen,
  onSelection,
}: ViewProps) {
  const dark = useIsDark();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartment = useRef(new Compartment());
  const handlers = useRef({ onSelectFusen, onSelection, located });
  handlers.current = { onSelectFusen, onSelection, located };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: doc.content,
        extensions: [
          // Split lines on LF only, so offsets match the file.
          EditorState.lineSeparator.of("\n"),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          lineNumbers(),
          markdown(),
          dark ? oneDark : syntaxHighlighting(defaultHighlightStyle),
          compartment.current.of([]),
          EditorView.domEventHandlers({
            mouseup(_event, view) {
              setTimeout(() => {
                const { from, to } = view.state.selection.main;
                const anchor = from === to ? null : anchorFromRange(doc.content, { start: from, end: to });
                const coords = anchor ? view.coordsAtPos(to) : null;
                handlers.current.onSelection(
                  anchor && coords ? { anchor, x: coords.left, y: coords.bottom } : null,
                );
              });
            },
            click(event, view) {
              if (!view.state.selection.main.empty) return;
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos == null) return;
              const hit = handlers.current.located.find((l) => l.start <= pos && pos < l.end);
              if (hit) handlers.current.onSelectFusen(hit.id);
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [doc.content, dark]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: compartment.current.reconfigure(
        fusenExtension(located, kinds, selectedId, view.state.doc.length, (id) =>
          handlers.current.onSelectFusen(id),
        ),
      ),
    });
  }, [doc.content, dark, located, kinds, selectedId]);

  useEffect(() => {
    const view = viewRef.current;
    const target = located.find((l) => l.id === scrollRequest?.id);
    if (!view || !target) return;
    view.dispatch({ effects: EditorView.scrollIntoView(target.start, { y: "center" }) });
    // Only scroll when asked, not when highlights change.
  }, [scrollRequest]);

  return <div ref={hostRef} className="h-full overflow-hidden" />;
}

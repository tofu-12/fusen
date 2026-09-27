// Math in the preview, written as on GitHub: `$...$` and $`...`$ inline,
// `$$...$$` and ```` ```math ```` blocks. KaTeX renders it.
//
// rehype-katex replaces each formula with its output, which has no source
// position. `rehypeMathWrappers` wraps each formula first, so the wrapper
// keeps the position and fusen can be added to the formula as a whole.

import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root as MdastRoot, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";

/** The class of the elements that wrap a rendered formula. */
export const MATH_CLASS = "math";

/**
 * A remark plugin, run after remark-math, for the GitHub syntax. It unwraps
 * $`...`$, and turns `$` pairs that GitHub does not treat as math back into
 * text: a space inside the dollars (`$5 and $10`), or a digit after the
 * closing one.
 */
export function remarkGithubMath() {
  return (tree: MdastRoot, file: { value: unknown }) => {
    const source = String(file.value);
    visit(tree, "inlineMath", (node, index, parent) => {
      const backticks = /^`([\s\S]*)`$/.exec(node.value);
      if (backticks) {
        setInlineValue(node, backticks[1]);
        return;
      }
      const end = node.position?.end.offset;
      const start = node.position?.start.offset;
      if (start == null || end == null || !parent || index == null) return;
      if (/^\s|\s$/.test(node.value) || /\d/.test(source[end] ?? "")) {
        const text: Text = { type: "text", value: source.slice(start, end), position: node.position };
        parent.children[index] = text;
      }
    });
  };
}

/** Sets the formula of an `inlineMath` node, and of the `code` it becomes. */
function setInlineValue(node: { value: string; data?: unknown }, value: string) {
  node.value = value;
  const children = (node.data as { hChildren?: ElementContent[] } | undefined)?.hChildren;
  if (children?.[0]?.type === "text") children[0].value = value;
}

function hasClass(el: Element, name: string): boolean {
  const c = el.properties.className;
  return Array.isArray(c) && c.includes(name);
}

/** A rehype plugin, run before rehype-katex, that wraps each formula. */
export function rehypeMathWrappers() {
  return (tree: HastRoot) => {
    visit(tree, "element", (el: Element, index, parent) => {
      if (!parent || index == null) return;
      const code =
        el.tagName === "pre"
          ? el.children.find((c): c is Element => c.type === "element" && c.tagName === "code")
          : el;
      if (!code || code.tagName !== "code" || !hasClass(code, "language-math")) return;
      const block = el.tagName === "pre";
      const wrapper: Element = {
        type: "element",
        tagName: block ? "div" : "span",
        properties: { className: [MATH_CLASS] },
        children: [el as ElementContent],
        position: el.position,
      };
      parent.children[index] = wrapper;
      return SKIP;
    });
  };
}

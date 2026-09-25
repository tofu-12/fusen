// Shows YAML front matter in the preview as a table, like GitHub: the keys
// are the header row and the values the body row. Nested mappings and
// sequences become nested tables. Cells keep their source positions, so
// fusen can be added to them.

import type { Element, ElementContent } from "hast";
import type { Root, RootContent } from "mdast";
import { isMap, isScalar, isSeq, parseDocument, type Node as YamlNode } from "yaml";

type Point = { line: number; column: number; offset: number };

/**
 * A remark plugin that replaces the `yaml` node of remark-frontmatter.
 * Front matter that is not valid YAML is shown as a code block.
 */
export function remarkFrontMatterTable() {
  return (tree: Root, file: { value: unknown }) => {
    const index = tree.children.findIndex((n) => n.type === "yaml");
    if (index === -1) return;
    const node = tree.children[index];
    if (node.type !== "yaml" || node.position?.start.offset == null) return;
    const source = String(file.value);
    const base = source.indexOf(node.value, node.position.start.offset);
    const doc = parseDocument(node.value);
    const toPoint = pointer(source, base);
    const table =
      doc.errors.length === 0 && isMap(doc.contents)
        ? tableOf(doc.contents, toPoint)
        : codeBlock(node.value, toPoint(0), toPoint(node.value.length));
    table.properties.className = ["front-matter", ...classes(table)];
    tree.children[index] = {
      type: "frontMatter",
      position: node.position,
      data: { hName: table.tagName, hProperties: table.properties, hChildren: table.children },
    } as unknown as RootContent;
  };
}

function classes(el: Element): string[] {
  const c = el.properties.className;
  return Array.isArray(c) ? c.map(String) : [];
}

/** Converts offsets in the front matter to points in the document. */
function pointer(source: string, base: number): (offset: number) => Point {
  return (offset) => {
    const abs = base + offset;
    const before = source.slice(0, abs);
    const line = before.split("\n").length;
    return { line, column: abs - before.lastIndexOf("\n"), offset: abs };
  };
}

function el(tagName: string, children: ElementContent[]): Element {
  return { type: "element", tagName, properties: {}, children };
}

/** A mapping: one header row of keys and one row of values. */
function tableOf(map: YamlNode & { items: { key: unknown; value: unknown }[] }, toPoint: (o: number) => Point): Element {
  const keys = map.items.map((item) => el("th", cell(item.key, toPoint)));
  const values = map.items.map((item) => el("td", cell(item.value, toPoint)));
  return el("table", [el("thead", [el("tr", keys)]), el("tbody", [el("tr", values)])]);
}

/** A sequence: one row of values. */
function rowOf(seq: YamlNode & { items: unknown[] }, toPoint: (o: number) => Point): Element {
  const values = seq.items.map((item) => el("td", cell(item, toPoint)));
  return el("table", [el("tbody", [el("tr", values)])]);
}

function cell(node: unknown, toPoint: (o: number) => Point): ElementContent[] {
  if (isMap(node)) return [tableOf(node, toPoint)];
  if (isSeq(node)) return [rowOf(node, toPoint)];
  if (isScalar(node)) {
    if (node.value == null) return [];
    const value = String(node.value);
    if (!node.range) return [{ type: "text", value }];
    return [
      {
        type: "text",
        value,
        position: { start: toPoint(node.range[0]), end: toPoint(node.range[1]) },
      },
    ];
  }
  return node == null ? [] : [{ type: "text", value: String(node) }];
}

function codeBlock(value: string, start: Point, end: Point): Element {
  const code = el("code", [{ type: "text", value, position: { start, end } }]);
  code.properties.className = ["language-yaml"];
  code.position = { start, end };
  const pre = el("pre", [code]);
  pre.position = { start, end };
  return pre;
}

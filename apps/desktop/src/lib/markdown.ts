import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { Options } from "react-markdown";

import { rehypeSourcePositions } from "./sourceMap";

type PluggableList = NonNullable<Options["rehypePlugins"]>;

export const remarkPlugins: PluggableList = [remarkGfm];

/** Rehype plugins for the preview. Headings get GitHub-style IDs, so that
 * links such as `#2-usage` work. Source positions must run last. */
export function rehypePlugins(source: string): PluggableList {
  return [
    [rehypeHighlight, { plainText: ["mermaid"] }],
    rehypeSlug,
    [rehypeSourcePositions, source],
  ];
}

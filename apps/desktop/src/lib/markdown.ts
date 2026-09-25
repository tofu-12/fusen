import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Options } from "react-markdown";

import { remarkFrontMatterTable } from "./frontMatter";
import { rehypeSourcePositions } from "./sourceMap";

type PluggableList = NonNullable<Options["rehypePlugins"]>;

/** Remark plugins for the preview. YAML front matter is shown as a table. */
export const remarkPlugins: PluggableList = [remarkFrontmatter, remarkFrontMatterTable, remarkGfm];

/** Rehype plugins for the preview. Headings get GitHub-style IDs, so that
 * links such as `#2-usage` work. Source positions must run last. */
export function rehypePlugins(source: string): PluggableList {
  return [
    [rehypeHighlight, { plainText: ["mermaid"] }],
    rehypeSlug,
    [rehypeSourcePositions, source],
  ];
}

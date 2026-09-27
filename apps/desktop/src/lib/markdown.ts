import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Options } from "react-markdown";

import { remarkFrontMatterTable } from "./frontMatter";
import { rehypeMathWrappers, remarkGithubMath } from "./math";
import { rehypeSourcePositions } from "./sourceMap";

type PluggableList = NonNullable<Options["rehypePlugins"]>;

/** Remark plugins for the preview. YAML front matter is shown as a table,
 * and math follows the GitHub syntax. */
export const remarkPlugins: PluggableList = [
  remarkFrontmatter,
  remarkFrontMatterTable,
  remarkGfm,
  remarkMath,
  remarkGithubMath,
];

/** Rehype plugins for the preview. Math is rendered before highlighting, so
 * ```` ```math ```` blocks are not highlighted as code. Headings get
 * GitHub-style IDs, so that links such as `#2-usage` work. Source positions
 * must run last. */
export function rehypePlugins(source: string): PluggableList {
  return [
    rehypeMathWrappers,
    rehypeKatex,
    [rehypeHighlight, { plainText: ["mermaid"] }],
    rehypeSlug,
    [rehypeSourcePositions, source],
  ];
}

// Links in the preview.

/** Where a link in the preview goes. */
export type LinkTarget =
  | { kind: "anchor"; id: string }
  | { kind: "external"; url: string }
  | { kind: "document"; path: string; id: string | null };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Classifies `href` from the document at `currentPath`. Relative paths are
 * resolved against the document's directory; paths starting with `/` are
 * relative to the project root, as on GitHub.
 */
export function classifyLink(href: string, currentPath: string): LinkTarget {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { kind: "external", url: href };
  const hash = href.indexOf("#");
  const path = decode(hash === -1 ? href : href.slice(0, hash));
  const id = hash === -1 ? null : decode(href.slice(hash + 1)) || null;
  if (!path) return { kind: "anchor", id: id ?? "" };

  const base = path.startsWith("/") ? [] : currentPath.split("/").slice(0, -1);
  const parts: string[] = [...base];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(part);
  }
  return { kind: "document", path: parts.join("/"), id };
}

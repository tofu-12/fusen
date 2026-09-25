// Light and dark appearance, from the `appearance.theme` setting.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import githubLight from "highlight.js/styles/github.css?inline";
import githubDark from "highlight.js/styles/github-dark.css?inline";

function apply(theme: string) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  let style = document.getElementById("hljs-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "hljs-theme";
    document.head.appendChild(style);
  }
  style.textContent = dark ? githubDark : githubLight;
  // The native title bar follows too. Not available outside Fusen.app.
  try {
    getCurrentWindow()
      .setTheme(dark ? "dark" : "light")
      .catch(() => {});
  } catch {
    // Running in a browser with the mock backend.
  }
}

/** Applies the theme to this window. */
export function useApplyTheme(theme: string | undefined) {
  useEffect(() => apply(theme ?? "light"), [theme]);
}

/** Whether the window is currently dark. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

import { useEffect, useRef, useState } from "react";

import { useIsDark } from "../../lib/theme";

let counter = 0;

async function render(code: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "strict",
  });
  const { svg } = await mermaid.render(`mermaid-${++counter}`, code);
  return svg;
}

/** A Mermaid code block rendered as a diagram. */
export default function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const dark = useIsDark();

  useEffect(() => {
    let cancelled = false;
    render(code, dark)
      .then((svg) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [code, dark]);

  if (error) {
    return (
      <pre className="text-red-700">
        {error}
        {"\n\n"}
        {code}
      </pre>
    );
  }
  return <div ref={ref} className="not-prose my-4 flex justify-center" />;
}

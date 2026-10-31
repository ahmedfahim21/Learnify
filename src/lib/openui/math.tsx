import "katex/dist/katex.min.css";

import katex from "katex";
import { Fragment, type ReactNode } from "react";

/**
 * Maths in generated text, typeset with KaTeX. The model writes LaTeX between
 * $…$ (inline) or $$…$$ (display); everything else is plain text. KaTeX
 * escapes its input and runs with trust off, so model text can't inject HTML;
 * a formula it can't parse is shown as its source in the alert colour rather
 * than hidden.
 */

const MATH = /\$\$([^$]+)\$\$|\$([^$\n]+)\$|\\\((.+?)\\\)|\\\[(.+?)\\\]/g;

function typeset(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    errorColor: "#b3263e",
    output: "htmlAndMathml",
    trust: false,
    strict: "ignore",
  });
}

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  return (
    <span
      className={display ? "math block overflow-x-auto py-1" : "math"}
      // KaTeX output from escaped input with trust: false.
      dangerouslySetInnerHTML={{ __html: typeset(tex, display) }}
    />
  );
}

export function hasMath(text: string): boolean {
  MATH.lastIndex = 0;
  return MATH.test(text);
}

export function Tex({ text }: { text: string }): ReactNode {
  if (typeof text !== "string" || (!text.includes("$") && !text.includes("\\(") && !text.includes("\\["))) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  MATH.lastIndex = 0;
  for (let m = MATH.exec(text); m; m = MATH.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const display = m[1] !== undefined || m[4] !== undefined;
    parts.push(<MathSpan key={m.index} tex={m[1] ?? m[2] ?? m[3] ?? m[4]} display={display} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}

/** A Formula's expression is maths without the dollar signs, shown on its own line. */
export function TexExpression({ text }: { text: string }): ReactNode {
  if (typeof text !== "string") return text;
  return <MathSpan tex={text.trim().replace(/^\$+|\$+$/g, "")} display />;
}

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω",
  times: "×", cdot: "·", pm: "±", leq: "≤", geq: "≥", neq: "≠", approx: "≈", infty: "∞", to: "→", in: "∈",
  sqrt: "√", frac: "", left: "", right: "", mathbb: "", text: "", mathrm: "",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };

/** The same maths as plain text, for aria-labels and titles. */
export function plainMath(text: string): string {
  return text
    .replace(/\\mathbb\{(\w)\}/g, (_, c: string) => BLACKBOARD[c] ?? c)
    .replace(/\\([A-Za-z]+)/g, (_, n: string) => SYMBOLS[n] ?? n)
    .replace(/[${}]/g, "");
}

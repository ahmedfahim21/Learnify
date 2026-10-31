import { Fragment, type ReactNode } from "react";

/**
 * Inline maths in generated text. The model reaches for LaTeX ($q_1$,
 * $r_{12}^2$, \frac{1}{2}) even when asked not to, and older stored screens
 * have it, so text is rendered through this: the common LaTeX a lecture needs
 * (sub/superscripts, fractions, roots, Greek, relations) becomes real <sub>,
 * <sup> and symbols. Anything it doesn't know is shown as its name, not
 * dropped. No HTML from the model is ever injected.
 */

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", sim: "∼", equiv: "≡", propto: "∝", infty: "∞", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", implies: "⇒", iff: "⇔", Leftrightarrow: "⇔", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆",
  supset: "⊃", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", sum: "∑", prod: "∏", int: "∫",
  oint: "∮", partial: "∂", nabla: "∇", angle: "∠", degree: "°", circ: "°", prime: "′", ldots: "…", cdots: "⋯",
  dots: "…", mathbb: "", mathbf: "", mathrm: "", text: "", operatorname: "", vec: "", hat: "", bar: "",
  lt: "<", gt: ">", perp: "⊥", parallel: "∥", hbar: "ħ", ell: "ℓ", Re: "ℜ", Im: "ℑ", neg: "¬", land: "∧", lor: "∨",
  quad: " ", qquad: "  ", ",": " ", ";": " ", ":": " ", "!": "", " ": " ", "{": "{", "}": "}", "%": "%", "$": "$",
  "\\": " ", left: "", right: "", big: "", Big: "", sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln",
  exp: "exp", lim: "lim", max: "max", min: "min",
};

/** Blackboard letters for \mathbb{R} and friends. */
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };

class Reader {
  i = 0;
  constructor(readonly s: string) {}
  done() {
    return this.i >= this.s.length;
  }
  /** One argument: a {group} or a single character (or a \command). */
  arg(): string {
    while (this.s[this.i] === " ") this.i++;
    if (this.s[this.i] === "{") {
      let depth = 0;
      const start = this.i + 1;
      for (; this.i < this.s.length; this.i++) {
        if (this.s[this.i] === "{") depth++;
        else if (this.s[this.i] === "}" && --depth === 0) break;
      }
      return this.s.slice(start, this.i++);
    }
    if (this.s[this.i] === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(this.s.slice(this.i));
      this.i += m ? m[0].length : 1;
      return m ? m[0] : "";
    }
    return this.s[this.i++] ?? "";
  }
}

/** Wrap a multi-character fraction part so "a+b/c" can't be misread. */
const grouped = (s: string, node: ReactNode) => (s.replace(/\\[A-Za-z]+/g, "x").length > 1 ? <>({node})</> : node);

function parse(src: string): ReactNode[] {
  const r = new Reader(src);
  const out: ReactNode[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push(text);
    text = "";
  };
  while (!r.done()) {
    const c = r.s[r.i];
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(r.s.slice(r.i));
      const name = m ? m[1] : "";
      r.i += m ? m[0].length : 1;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const a = r.arg();
        const b = r.arg();
        flush();
        out.push(
          <span key={out.length} className="whitespace-nowrap">
            {grouped(a, parse(a))}/{grouped(b, parse(b))}
          </span>,
        );
      } else if (name === "sqrt") {
        const a = r.arg();
        flush();
        out.push(
          <span key={out.length} className="whitespace-nowrap">
            √{grouped(a, parse(a))}
          </span>,
        );
      } else if (name === "mathbb") {
        const a = r.arg();
        text += [...a].map((ch) => BLACKBOARD[ch] ?? ch).join("");
      } else if (name in SYMBOLS) {
        text += SYMBOLS[name];
      } else {
        text += name;
      }
    } else if (c === "_" || c === "^") {
      r.i++;
      const a = r.arg();
      flush();
      const Tag = c === "_" ? "sub" : "sup";
      out.push(<Tag key={out.length}>{parse(a)}</Tag>);
    } else if (c === "{" || c === "}") {
      r.i++;
    } else {
      text += c;
      r.i++;
    }
  }
  flush();
  return out;
}

/** Splits text into plain runs and $…$ / \(…\) maths. */
const MATH = /\$\$([^$]+)\$\$|\$([^$\n]+)\$|\\\((.+?)\\\)/g;

export function hasMath(text: string): boolean {
  MATH.lastIndex = 0;
  return MATH.test(text);
}

export function Tex({ text }: { text: string }): ReactNode {
  if (typeof text !== "string" || !text.includes("$") && !text.includes("\\(")) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  MATH.lastIndex = 0;
  for (let m = MATH.exec(text); m; m = MATH.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="math">
        {parse(m[1] ?? m[2] ?? m[3])}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}

/** A Formula's expression is maths without the dollar signs. */
export function TexExpression({ text }: { text: string }): ReactNode {
  if (typeof text !== "string") return text;
  return <span className="math">{parse(text.replace(/^\$+|\$+$/g, ""))}</span>;
}

/** The same maths as plain text, for aria-labels and titles. */
export function plainMath(text: string): string {
  return text
    .replace(/\\mathbb\{(\w)\}/g, (_, c: string) => BLACKBOARD[c] ?? c)
    .replace(/\\([A-Za-z]+)/g, (_, n: string) => SYMBOLS[n] ?? n)
    .replace(/[${}]/g, "");
}

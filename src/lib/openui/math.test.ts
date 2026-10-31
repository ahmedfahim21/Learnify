import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("katex/dist/katex.min.css", () => ({}));

const { plainMath, Tex, TexExpression } = await import("./math");

const html = (text: string) => renderToStaticMarkup(createElement(Tex, { text }));
/** The MathML KaTeX emits alongside the HTML: what a screen reader hears. */
const mathml = (markup: string) => markup.match(/<math[\s\S]*?<\/math>/g) ?? [];

describe("Tex", () => {
  it("leaves text without maths alone", () => {
    expect(html("plain text, no maths")).toBe("plain text, no maths");
  });

  it("typesets the inline maths from the quiz that showed raw LaTeX", () => {
    const out = html("दो point charges $q_1$ और $q_2$");
    expect(out.startsWith("दो point charges ")).toBe(true);
    expect(out).toContain(" और ");
    expect(out).not.toContain("$");
    const maths = mathml(out);
    expect(maths).toHaveLength(2);
    expect(maths[0]).toContain("<msub><mi>q</mi><mn>1</mn></msub>");
    expect(maths[1]).toContain("<msub><mi>q</mi><mn>2</mn></msub>");
  });

  it("typesets sub/superscripts, fractions and roots", () => {
    expect(mathml(html("$r_{12}^2$"))[0]).toContain("<msubsup><mi>r</mi><mn>12</mn><mn>2</mn></msubsup>");
    expect(mathml(html("$\\frac{1}{2}mv^2$"))[0]).toContain("<mfrac><mn>1</mn><mn>2</mn></mfrac>");
    expect(mathml(html("$\\sqrt{2}$"))[0]).toContain("<msqrt><mn>2</mn></msqrt>");
  });

  it("renders $$…$$ as display maths and $…$ inline", () => {
    expect(html("$$E = mc^2$$")).toContain('class="katex-display"');
    expect(html("$E = mc^2$")).not.toContain('class="katex-display"');
  });

  it("accepts \\( \\) delimiters and leaves a lone dollar sign as text", () => {
    const out = html("\\(x^2\\) costs $5");
    expect(mathml(out)).toHaveLength(1);
    expect(out.endsWith(" costs $5")).toBe(true);
  });

  it("shows a formula KaTeX can't parse as its source in the alert colour", () => {
    const out = html("$\\frac{1}{$");
    expect(out).toContain("#b3263e");
    expect(out).toContain("\\frac{1}{");
  });

  it("escapes model text rather than injecting HTML", () => {
    const out = html("$<b>x</b>$ and <script>");
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("<script>");
  });
});

describe("TexExpression and plainMath", () => {
  it("typesets a Formula expression with or without dollars, as display maths", () => {
    const a = renderToStaticMarkup(createElement(TexExpression, { text: "F = k\\frac{q_1 q_2}{r^2}" }));
    expect(a).toContain('class="katex-display"');
    expect(mathml(a)[0]).toContain("<mfrac>");
    const b = renderToStaticMarkup(createElement(TexExpression, { text: "$E = mc^2$" }));
    expect(mathml(b)[0]).toContain("<msup><mi>c</mi><mn>2</mn></msup>");
  });

  it("flattens maths for aria labels", () => {
    expect(plainMath("$r_{12}^2$ and $\\alpha$ in $\\mathbb{R}$")).toBe("r_12^2 and α in ℝ");
  });
});

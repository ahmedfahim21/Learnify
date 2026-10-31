import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainMath, Tex, TexExpression } from "./math";

const html = (text: string) => renderToStaticMarkup(createElement(Tex, { text }));

describe("Tex", () => {
  it("leaves text without maths alone", () => {
    expect(html("plain text, no maths")).toBe("plain text, no maths");
  });

  it("draws subscripts and superscripts from the quiz that showed raw LaTeX", () => {
    expect(html("दो point charges $q_1$ और $q_2$")).toBe(
      'दो point charges <span class="math">q<sub>1</sub></span> और <span class="math">q<sub>2</sub></span>',
    );
    expect(html("$r_{12}^2$")).toBe('<span class="math">r<sub>12</sub><sup>2</sup></span>');
    expect(html("$r_{12}^{1/2}$")).toBe('<span class="math">r<sub>12</sub><sup>1/2</sup></span>');
  });

  it("draws fractions, roots, Greek letters, relations and blackboard sets", () => {
    expect(html("$\\frac{1}{2}mv^2$")).toBe('<span class="math"><span class="whitespace-nowrap">1/2</span>mv<sup>2</sup></span>');
    expect(html("$\\frac{a+b}{c}$")).toBe('<span class="math"><span class="whitespace-nowrap">(a+b)/c</span></span>');
    expect(html("$\\sqrt{2}$")).toBe('<span class="math"><span class="whitespace-nowrap">√2</span></span>');
    expect(html("$\\alpha \\leq \\pi$")).toBe('<span class="math">α ≤ π</span>');
    expect(html("$x \\in \\mathbb{R}$")).toBe('<span class="math">x ∈ ℝ</span>');
  });

  it("shows an unknown command by name instead of dropping it", () => {
    expect(html("$\\weird x$")).toBe('<span class="math">weird x</span>');
  });

  it("accepts \\( \\) delimiters and leaves a lone dollar sign as text", () => {
    expect(html("\\(x^2\\) costs $5")).toBe('<span class="math">x<sup>2</sup></span> costs $5');
  });

  it("escapes model text rather than injecting HTML", () => {
    expect(html("$<b>x</b>$")).toBe('<span class="math">&lt;b&gt;x&lt;/b&gt;</span>');
  });
});

describe("TexExpression and plainMath", () => {
  it("renders a Formula expression with or without dollars", () => {
    expect(renderToStaticMarkup(createElement(TexExpression, { text: "F = k\\frac{q_1 q_2}{r^2}" }))).toBe(
      '<span class="math">F = k<span class="whitespace-nowrap">(q<sub>1</sub> q<sub>2</sub>)/(r<sup>2</sup>)</span></span>',
    );
    expect(renderToStaticMarkup(createElement(TexExpression, { text: "$E = mc^2$" }))).toBe('<span class="math">E = mc<sup>2</sup></span>');
  });

  it("flattens maths for aria labels", () => {
    expect(plainMath("$r_{12}^2$ and $\\alpha$ in $\\mathbb{R}$")).toBe("r_12^2 and α in ℝ");
  });
});

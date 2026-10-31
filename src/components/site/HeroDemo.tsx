"use client";

import { Renderer } from "@openuidev/react-lang";

import { screenLibrary } from "@/lib/openui/screenLibrary";

/**
 * Two questions from a quiz the model wrote in Tamil for NPTEL's "Basic
 * Calculus 1, The Real line - Part 1" (IIT Madras), trimmed of the timestamp
 * phrases in their explanations. Rendered by the same OpenUI library as the
 * lecture page, so visitors can answer them.
 */
const PROGRAM = [
  'root = Screen("The Real line · பயிற்சி", [quiz])',
  'quiz = Quiz("Rational numbers", [q2, q3])',
  'q2 = Mcq("ஒரு rational number-ஐ எப்படி எழுதலாம்?", ["p by q where p is natural and q is integer", "p by q where p is integer and q is natural", "p by q where p and q are both real", "p by q where q can be 0"], 1, "Rational number என்பது p by q, இதில் p is an integer மற்றும் q is a natural number (0 தவிர்த்து).", 104)',
  'q3 = TrueFalse("Set of real numbers R என்பது Q-வின் proper superset ஆகும்.", true, "R-ல் rational numbers மற்றும் irrational numbers இரண்டும் உள்ளன, Q-வில் rational numbers மட்டுமே உள்ளன, எனவே R என்பது Q-வின் proper superset ஆகும்.", 267)',
].join("\n");

export default function HeroDemo() {
  return (
    <div lang="ta-IN">
      <Renderer response={PROGRAM} library={screenLibrary} isStreaming={false} />
    </div>
  );
}

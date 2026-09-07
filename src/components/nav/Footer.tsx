import Link from "next/link";

import { PROBLEMS } from "@/content/systemDesign";
import { QUIZ_BANK } from "@/content/systemDesign/quizzes";
import { WIDGET_NAMES } from "@/lib/a2ui/catalog";
import { SIMULATOR_IDS } from "@/lib/sims/ids";
import { SKILL_TAGS } from "@/content/systemDesign/tags";

const REPO = "https://github.com/ahmedfahim21/Learnify";

/**
 * The footer.
 *
 * Counts come from the same modules the app runs on rather than a hand-kept
 * list, so nothing here can outlive the code behind it — the same rule the
 * landing page follows. A server component: none of this changes per viewer.
 */

const skills = PROBLEMS.flatMap((p) => p.chapters.flatMap((c) => c.concepts));
const questionCount =
  Object.values(QUIZ_BANK).reduce((n, q) => n + q.length, 0) +
  PROBLEMS.flatMap((p) => p.chapters.flatMap((c) => c.blocks)).filter((b) => b.type === "quiz")
    .length;

const FACTS = [
  { value: PROBLEMS.length, label: "concepts" },
  { value: skills.length, label: "skills" },
  { value: questionCount, label: "questions" },
  { value: WIDGET_NAMES.length, label: "widgets" },
  { value: SIMULATOR_IDS.length, label: "simulators" },
  { value: SKILL_TAGS.length, label: "themes" },
];

const SECTIONS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Learn",
    links: [
      { href: "/concepts", label: "All concepts" },
      { href: "/today", label: "Due for review" },
      { href: "/me", label: "Your progress" },
    ],
  },
  {
    title: "Built with",
    links: [
      { href: "https://nextjs.org", label: "Next.js", external: true },
      { href: "https://reactflow.dev", label: "React Flow", external: true },
      { href: "https://zod.dev", label: "Zod", external: true },
      { href: "https://orm.drizzle.team", label: "Drizzle + Neon", external: true },
    ],
  },
  {
    title: "Source",
    links: [
      { href: REPO, label: "Repository", external: true },
      { href: `${REPO}/issues`, label: "Issues", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-(--color-line) bg-(--color-surface)">
      <div className="wrap grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <span className="text-(--color-fg)">
            Learnify<span className="text-(--color-signal)">.sd</span>
          </span>
          <p className="max-w-xs text-sm leading-relaxed text-(--color-mist)">
            A system design tutor with no chat box. The model composes each screen by emitting
            declarative UI, validated against a fixed catalog before the browser renders it.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <nav key={section.title} className="space-y-3">
            <p className="label">{section.title}</p>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-(--color-mist) transition-colors hover:text-(--color-fg)"
                    >
                      {link.label}
                      <span className="ml-1 text-(--color-faint)">↗</span>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-(--color-mist) transition-colors hover:text-(--color-fg)"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="wrap border-t border-(--color-line)">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 py-5">
          {FACTS.map((fact) => (
            <div key={fact.label} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{fact.label}</dt>
              <dd className="flex items-baseline gap-1.5">
                <span className="tabular-nums text-(--color-fg)">{fact.value}</span>
                <span className="label">{fact.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="wrap flex flex-wrap items-center justify-between gap-3 border-t border-(--color-line) py-5">
        <p className="text-sm text-(--color-mist)">
          Every concept is readable without an account and without invoking a model.
        </p>
        {/* No copyright line pretending to be a company. */}
        <p className="label">Written for this site · not reproduced from any book</p>
      </div>
    </footer>
  );
}

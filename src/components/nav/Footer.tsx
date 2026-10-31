import { Logo } from "@/components/site/Logo";

const REPO = "https://github.com/ahmedfahim21/Learnify";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Built with",
    links: [
      { href: "https://www.sarvam.ai", label: "Sarvam AI" },
      { href: "https://www.openui.com", label: "OpenUI" },
      { href: "https://nptel.ac.in", label: "NPTEL" },
    ],
  },
  {
    title: "Source",
    links: [
      { href: REPO, label: "Repository" },
      { href: `${REPO}/issues`, label: "Issues" },
    ],
  },
];

/**
 * The footer. NPTEL lectures are CC BY-NC-SA, so attribution and the licence
 * that derived material (notes, quizzes, study packs) carries live here on
 * every page, not just on the lecture view. Sarvam writes and speaks
 * everything in Indian languages; OpenUI renders the generated study screens.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-(--color-line) bg-(--color-surface)">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-16">
        <div className="max-w-md space-y-4">
          <Logo size={30} />
          <p className="text-sm leading-relaxed text-(--color-mist)">
            Lectures are from{" "}
            <a href="https://nptel.ac.in" target="_blank" rel="noreferrer" className="link">
              NPTEL
            </a>
            , by faculty at the IITs, IISc and over 100 other institutes, shown in YouTube&apos;s player and used under{" "}
            <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" className="link">
              CC BY-NC-SA 4.0
            </a>
            . Study material made here is shared under the same licence.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <p className="label">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-(--color-mist) transition-colors hover:text-(--color-fg)"
                  >
                    {link.label}
                    <span className="ml-1 text-(--color-faint)">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}

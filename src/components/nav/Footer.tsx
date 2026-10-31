const REPO = "https://github.com/ahmedfahim21/Learnify";

/**
 * The footer. NPTEL lectures are CC BY-NC-SA, so attribution and the licence
 * that derived material (translations, study packs) carries live here on every
 * page, not just on the lecture view.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-(--color-line) bg-(--color-surface)">
      <div className="wrap flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md space-y-3">
          <span className="text-(--color-fg)">Learnify</span>
          <p className="text-sm leading-relaxed text-(--color-mist)">
            Lectures are from{" "}
            <a href="https://nptel.ac.in" target="_blank" rel="noreferrer" className="link">
              NPTEL
            </a>
            , by IIT and IISc faculty, shown in YouTube&apos;s player and used under{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              CC BY-NC-SA 4.0
            </a>
            . Translations and study material made here are shared under the same licence.
          </p>
        </div>
        <nav className="space-y-2">
          <p className="label">Source</p>
          <ul className="space-y-2">
            {[
              { href: REPO, label: "Repository" },
              { href: `${REPO}/issues`, label: "Issues" },
            ].map((link) => (
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
      </div>
    </footer>
  );
}

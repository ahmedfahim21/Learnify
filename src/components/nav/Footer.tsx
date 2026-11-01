import { type Brand, BrandLogo, BRANDS } from "@/components/site/Brands";
import { Logo } from "@/components/site/Logo";

const REPO = "https://github.com/ahmedfahim21/Learnify";

const BUILT_WITH: { brand: Brand; what: string }[] = [
  { brand: "sarvam", what: "Indian-language AI" },
  { brand: "openui", what: "Generative UI" },
  { brand: "nptel", what: "Lectures" },
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
        <nav aria-label="Built with" className="space-y-3">
          <p className="label">Built with</p>
          <ul className="space-y-2.5">
            {BUILT_WITH.map(({ brand, what }) => (
              <li key={brand}>
                <a
                  href={BRANDS[brand].href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3"
                >
                  <span className="flex h-9 w-28 items-center rounded-lg border border-(--color-line) bg-white px-2.5 transition-colors group-hover:border-(--color-faint)">
                    <BrandLogo brand={brand} height={brand === "openui" ? 26 : brand === "sarvam" ? 12 : 16} />
                  </span>
                  <span className="text-sm text-(--color-mist) group-hover:text-(--color-fg)">{what}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Source" className="space-y-3">
          <p className="label">Source</p>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-line) bg-white transition-colors group-hover:border-(--color-faint)">
              <BrandLogo brand="github" height={18} mark />
            </span>
            <span className="text-sm text-(--color-mist) group-hover:text-(--color-fg)">GitHub</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}

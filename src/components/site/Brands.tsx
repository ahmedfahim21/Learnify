/**
 * The services Learnify is built on, as their own logos (from each one's
 * site, in /public/brands). Shown where the work they do is visible: how it
 * works, the footer, and under what Sarvam writes and OpenUI draws.
 */

export const BRANDS = {
  sarvam: { name: "Sarvam AI", href: "https://www.sarvam.ai", mark: "/brands/sarvam-mark.svg", wordmark: "/brands/sarvam-wordmark.svg", ratio: 202 / 32 },
  openui: { name: "OpenUI", href: "https://www.openui.com", mark: "/brands/openui-mark.svg", wordmark: "/brands/openui-wordmark.svg", ratio: 594 / 165 },
  nptel: { name: "NPTEL", href: "https://nptel.ac.in", mark: null, wordmark: "/brands/nptel.png", ratio: 248 / 56 },
  youtube: { name: "YouTube", href: "https://www.youtube.com", mark: "/brands/youtube.svg", wordmark: null, ratio: 1 },
} as const;

export type Brand = keyof typeof BRANDS;

/** A brand's logo at a given height: its wordmark when it has one, else its mark. */
export function BrandLogo({ brand, height = 20, mark = false, className }: { brand: Brand; height?: number; mark?: boolean; className?: string }) {
  const b = BRANDS[brand];
  const src = mark ? (b.mark ?? b.wordmark) : (b.wordmark ?? b.mark);
  const square = src === b.mark && brand !== "openui";
  const width = Math.round(square ? height : brand === "openui" && src === b.mark ? height * 1.25 : height * b.ratio);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static logos; next/image adds nothing here
    <img src={src!} alt={b.name} width={width} height={height} className={className} style={{ height, width: "auto" }} />
  );
}

/** "Written by Sarvam AI · rendered with OpenUI": credit under generated material. */
export function PoweredBy({ openui = true }: { openui?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-faint)">
      <span>Written by</span>
      <a href={BRANDS.sarvam.href} target="_blank" rel="noreferrer" className="opacity-80 transition-opacity hover:opacity-100">
        <BrandLogo brand="sarvam" height={12} />
      </a>
      {openui && (
        <>
          <span>· rendered with</span>
          <a href={BRANDS.openui.href} target="_blank" rel="noreferrer" className="opacity-80 transition-opacity hover:opacity-100">
            <BrandLogo brand="openui" height={14} />
          </a>
        </>
      )}
    </p>
  );
}

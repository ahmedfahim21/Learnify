/**
 * The Learnify mark: a play button hanging from a shirorekha, the headline bar
 * Devanagari and Bengali letters hang from. Watch the lecture; learn it in
 * your script. Indigo tile, mint bar, paper triangle.
 *
 * The same geometry is in app/icon.svg, app/apple-icon.svg and the OG card;
 * change them together.
 */

export const MARK = {
  tile: "#2e3f8f",
  bar: "#5fd0a4",
  play: "#f6f9f8",
} as const;

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill={MARK.tile} />
      <rect x="6" y="8" width="20" height="3.2" rx="1.6" fill={MARK.bar} />
      <path d="M11.5 11.2 V24.6 L22.6 17.9 Z" fill={MARK.play} strokeLinejoin="round" stroke={MARK.play} strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.15rem] tracking-tight text-(--color-fg)">
        Learn<span className="text-(--color-signal)">ify</span>
      </span>
    </span>
  );
}

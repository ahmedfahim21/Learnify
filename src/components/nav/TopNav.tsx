"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { signOut, useSession } from "@/lib/authClient";

const LINKS = [
  { href: "/concepts", label: "Concepts" },
  { href: "/today", label: "Today" },
  { href: "/me", label: "Progress" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-(--color-line) bg-(--color-ink)/85 backdrop-blur">
      <div className="wrap flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 16" aria-hidden className="h-4 w-7">
            <line x1="5" y1="8" x2="14" y2="8" stroke="var(--color-faint)" strokeWidth="1.5" />
            <line x1="14" y1="8" x2="23" y2="8" stroke="var(--color-faint)" strokeWidth="1.5" />
            <rect x="1" y="5" width="6" height="6" rx="1" fill="var(--color-ink)" stroke="var(--color-signal)" strokeWidth="1.5" />
            <rect x="11" y="5" width="6" height="6" rx="1" fill="var(--color-ink)" stroke="var(--color-deep)" strokeWidth="1.5" />
            <rect x="21" y="5" width="6" height="6" rx="1" fill="var(--color-ink)" stroke="var(--color-warn)" strokeWidth="1.5" />
          </svg>
          <span className="flex items-baseline gap-2">
            <span className="text-(--color-fg)">Learnify</span>
            <span className="label hidden sm:inline">system design</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-(--color-fg)"
                    : "text-(--color-mist) hover:text-(--color-fg)"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Nothing until the session resolves — a "Sign in" link that flips
              to an avatar a moment later reads as a glitch. */}
          {isPending ? (
            <span className="ml-2 h-7 w-7 animate-pulse rounded-full bg-(--color-raised)" />
          ) : session?.user ? (
            <div className="ml-2 flex items-center gap-2">
              <Link href="/me" title={session.user.email} className="flex items-center gap-2">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- provider avatars are arbitrary remote hosts; configuring next/image domains for them isn't worth it here
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full border border-(--color-line)"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-(--color-line) text-xs text-(--color-mist)">
                    {(session.user.name ?? session.user.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => signOut().then(() => router.refresh())}
                className="px-2 py-1.5 text-sm text-(--color-mist) transition-colors hover:text-(--color-fg)"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/signin"
              className="ml-2 border border-(--color-line) px-3 py-1.5 text-sm text-(--color-mist) transition-colors hover:border-(--color-faint) hover:text-(--color-fg)"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

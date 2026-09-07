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
        <Link href="/" className="group flex items-center gap-2.5">
          {/* The mark is a screen being composed, not an architecture diagram:
              a frame with a filled block, two rules and an outlined block laid
              out inside it. The diagrams are one widget in the catalog — what
              the thing actually does is assemble a layout. */}
          <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px]">
            <rect
              x="0.75"
              y="0.75"
              width="18.5"
              height="18.5"
              rx="2.5"
              fill="var(--color-node)"
              stroke="var(--color-line)"
              strokeWidth="1.5"
            />
            <rect x="4" y="4.5" width="8" height="2.5" rx="1" fill="var(--color-signal)" />
            <rect x="4" y="8.5" width="5" height="1.5" rx="0.75" fill="var(--color-faint)" />
            <rect x="4" y="12.5" width="3.5" height="3.5" rx="1" fill="var(--color-deep)" />
            <rect
              x="10.5"
              y="12.5"
              width="5.5"
              height="3.5"
              rx="1"
              fill="none"
              stroke="var(--color-warn)"
              strokeWidth="1.5"
            />
          </svg>
          <span className="text-(--color-fg)">
            Learnify<span className="text-(--color-signal)">.sd</span>
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

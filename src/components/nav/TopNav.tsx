"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/site/Logo";
import { signOut, useSession } from "@/lib/authClient";

const LINKS: { href: string; label: string }[] = [
  { href: "/courses", label: "Courses" },
  { href: "/today", label: "Today" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isPending } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-(--color-line) bg-(--color-ink)/85 backdrop-blur">
      <div className="wrap flex h-14 items-center justify-between">
        <Link href="/" aria-label="Learnify home" className="flex items-center">
          <Logo size={26} />
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
          ) : user ? (
            <div className="ml-2 flex items-center gap-2">
              <span title={user.email} className="flex items-center gap-2">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- provider avatars are arbitrary remote hosts; configuring next/image domains for them isn't worth it here
                  <img src={user.image} alt="" className="h-7 w-7 rounded-full border border-(--color-line)" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-(--color-line) text-xs text-(--color-mist)">
                    {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => signOut().then(() => router.refresh(), (err) => console.error("sign-out failed:", err))}
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

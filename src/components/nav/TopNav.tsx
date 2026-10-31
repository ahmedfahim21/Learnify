"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/site/Logo";
import { useSession } from "@/lib/authClient";

const LINKS: { href: string; label: string }[] = [
  { href: "/courses", label: "Courses" },
];

export function TopNav() {
  const pathname = usePathname();
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
            <Link
              href="/profile"
              aria-label="Your profile"
              title={user.email}
              aria-current={pathname === "/profile" ? "page" : undefined}
              className="ml-2 rounded-full ring-offset-2 ring-offset-(--color-ink) hover:ring-2 hover:ring-(--color-line) aria-[current=page]:ring-2 aria-[current=page]:ring-(--color-signal)"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider avatars are arbitrary remote hosts; configuring next/image domains for them isn't worth it here
                <img src={user.image} alt="" className="h-8 w-8 rounded-full border border-(--color-line)" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-signal) text-sm text-white">
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
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

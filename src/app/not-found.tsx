import Link from "next/link";

/** The 404, in the site's own design rather than Next's black default. */
export default function NotFound() {
  return (
    <main className="wrap flex min-h-[60vh] flex-col justify-center gap-5 py-16">
      <p className="label shirorekha">Not found</p>
      <h1 className="text-3xl">This page isn&apos;t here.</h1>
      <p className="max-w-md text-(--color-mist)">
        The link may be old, or the lecture may have moved. Every NPTEL course is still a search away.
      </p>
      <div>
        <Link href="/courses" className="inline-flex min-h-11 items-center rounded-(--radius) bg-(--color-signal) px-4 text-white">
          Browse courses
        </Link>
      </div>
    </main>
  );
}

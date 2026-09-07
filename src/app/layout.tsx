import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { THEME_STORAGE_KEY } from "@/components/theme/theme";

// IBM Plex: an engineering typeface for an engineering subject, and the
// clearest break from the design system this one was inspired by. Loaded at
// 400 only, so there is no bold to reach for — hierarchy comes from size,
// tracking and colour.
const plexSans = IBM_Plex_Sans({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Labels, counts, durations, code — anything technical.
const plexMono = IBM_Plex_Mono({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Learnify — System Design, Explained by the Diagram",
    template: "%s · Learnify",
  },
  description:
    "Learn system design through animated architecture diagrams, explorable simulators, and an adaptive AI tutor — not static slides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // suppressHydrationWarning because the boot script below sets data-theme
    // before React hydrates, so the server's markup deliberately differs.
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Resolves the theme before first paint — a stored choice, else the
            system preference — so no one sees a flash of the wrong one. It
            always writes a concrete value, which is what lets CSS and
            Tailwind's `dark:` variant key off the attribute alone. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem(${JSON.stringify(
              THEME_STORAGE_KEY,
            )});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`,
          }}
        />
      </head>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}

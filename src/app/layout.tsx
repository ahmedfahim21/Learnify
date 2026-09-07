import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { Footer } from "@/components/nav/Footer";

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

const SITE_NAME = "Learnify.sd";
const TAGLINE = "A tutor that builds its own interface";
const DESCRIPTION =
  "A system design tutor with no chat box. The model composes each screen by emitting declarative UI, validated against a fixed component catalog before the browser renders it — and graded on the server, not by the model.";

/** Absolute URLs for OG tags need an origin. Set NEXT_PUBLIC_SITE_URL in the
 *  deployed environment; locally the dev origin is the honest answer. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE.toLowerCase()}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Ahmed Fahim", url: "https://github.com/ahmedfahim21" }],
  creator: "Ahmed Fahim",
  keywords: [
    "system design",
    "generative UI",
    "A2UI",
    "agentic tutor",
    "distributed systems",
    "system design interview",
    "spaced repetition",
  ],
  category: "education",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE.toLowerCase()}`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE.toLowerCase()}`,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <TopNav />
        {children}
        <Footer />
      </body>
    </html>
  );
}

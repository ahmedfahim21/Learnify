import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Oriya,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";

import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { Footer } from "@/components/nav/Footer";

// IBM Plex: an engineering typeface for engineering lectures. Loaded at 400
// only, so there is no bold to reach for — hierarchy comes from size, tracking
// and colour.
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

// One Noto face per Indic script, 400 only like Plex. Each is declared with its
// script's unicode-range, so a browser downloads a file only when that script
// is actually on the page; a Tamil student never fetches the Bengali font.
// preload: false is what makes that true: next/font preloads every face by
// default, which downloaded all nine on every page.
// globals.css stacks them after Plex in --font-sans. next/font needs each
// loader assigned to its own module-level const.
const devanagari = Noto_Sans_Devanagari({ weight: "400", subsets: ["devanagari"], variable: "--font-deva", display: "swap", preload: false });
const bengali = Noto_Sans_Bengali({ weight: "400", subsets: ["bengali"], variable: "--font-beng", display: "swap", preload: false });
const tamil = Noto_Sans_Tamil({ weight: "400", subsets: ["tamil"], variable: "--font-taml", display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ weight: "400", subsets: ["telugu"], variable: "--font-telu", display: "swap", preload: false });
const kannada = Noto_Sans_Kannada({ weight: "400", subsets: ["kannada"], variable: "--font-knda", display: "swap", preload: false });
const malayalam = Noto_Sans_Malayalam({ weight: "400", subsets: ["malayalam"], variable: "--font-mlym", display: "swap", preload: false });
const gujarati = Noto_Sans_Gujarati({ weight: "400", subsets: ["gujarati"], variable: "--font-gujr", display: "swap", preload: false });
const gurmukhi = Noto_Sans_Gurmukhi({ weight: "400", subsets: ["gurmukhi"], variable: "--font-guru", display: "swap", preload: false });
const oriya = Noto_Sans_Oriya({ weight: "400", subsets: ["oriya"], variable: "--font-orya", display: "swap", preload: false });
const indic = [devanagari, bengali, tamil, telugu, kannada, malayalam, gujarati, gurmukhi, oriya];

const SITE_NAME = "Learnify";
const TAGLINE = "Watch an NPTEL lecture in English, learn it in your language";
const DESCRIPTION =
  "Pick a free NPTEL lecture from over 100 Indian institutes, the IITs and IISc among them, watch it as it is, then learn it in Tamil, Hindi, Telugu, Kannada and more: notes, quizzes and flashcards written from that lecture, and doubts answered by voice.";

/** Absolute URLs for OG tags need an origin. Set NEXT_PUBLIC_SITE_URL in the
 *  deployed environment; locally the dev origin is the honest answer. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ${TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Ahmed Fahim", url: "https://github.com/ahmedfahim21" }],
  creator: "Ahmed Fahim",
  keywords: [
    "NPTEL",
    "NPTEL lectures",
    "IIT lectures",
    "learn in Tamil",
    "Indian languages",
    "engineering lectures",
    "spaced repetition",
  ],
  category: "education",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${TAGLINE}`,
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
    <html
      lang="en"
      className={[plexSans.variable, plexMono.variable, ...indic.map((f) => f.variable)].join(" ")}
    >
      <body className="flex min-h-dvh flex-col">
        <TopNav />
        <div className="flex-1">{children}</div>
        <Footer />
        {/* Page views only; no cookies. Inert outside Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}

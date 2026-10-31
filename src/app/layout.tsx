import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { Footer } from "@/components/nav/Footer";

// IBM Plex: an engineering typeface for engineering lectures. Loaded at 400
// only, so there is no bold to reach for — hierarchy comes from size, tracking
// and colour. Indic scripts get their own faces with the subtitle work.
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

const SITE_NAME = "Learnify";
const TAGLINE = "Watch an IIT lecture in English, learn it in your language";
const DESCRIPTION =
  "NPTEL lectures with subtitles in Tamil, Telugu, Kannada, Hindi and more, checks that pause the video at the right moment, spoken doubts answered from what the lecturer just said, and study screens that jump back to the timestamp.";

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
    "IIT lectures",
    "Tamil subtitles",
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
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <TopNav />
        {children}
        <Footer />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";

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
    default: "Learnify.sd — a tutor that builds its own interface",
    template: "%s · Learnify.sd",
  },
  description:
    "A system design tutor with no chat box. The model composes each screen by emitting declarative UI, validated against a fixed component catalog before the browser renders it.",
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
      </body>
    </html>
  );
}

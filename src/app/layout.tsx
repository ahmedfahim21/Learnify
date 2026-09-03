import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Mono } from "next/font/google";

import "./globals.css";

// Wordmark, code, technical text: phase labels, counts, durations.
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
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
    <html lang="en" className={spaceMono.variable}>
      <body>{children}</body>
    </html>
  );
}

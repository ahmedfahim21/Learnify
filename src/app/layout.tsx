import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Learnify 2.0",
  description:
    "An agentic tutor that teaches through generative UI — live adaptive sessions streamed as interactive widgets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

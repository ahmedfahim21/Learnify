import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Your profile", robots: { index: false, follow: false } };

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}

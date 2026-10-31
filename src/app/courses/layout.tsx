import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // Keep the site template going for the course pages under this one.
  title: { default: "Courses", template: "%s · Learnify" },
  description: "3,050 NPTEL video courses from over 100 Indian institutes, the IITs and IISc among them, to learn in your own language.",
};

export default function CoursesLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { courseMetadata } from "@/lib/pageMeta";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  return courseMetadata((await params).courseId);
}

export default function CourseLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { lectureMetadata } from "@/lib/pageMeta";

export async function generateMetadata({ params }: { params: Promise<{ lectureId: string }> }): Promise<Metadata> {
  return lectureMetadata((await params).lectureId);
}

export default function LectureLayout({ children }: { children: ReactNode }) {
  return children;
}

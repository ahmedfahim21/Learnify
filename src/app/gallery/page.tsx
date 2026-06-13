import { notFound } from "next/navigation";

import { GalleryClient } from "@/components/gallery/GalleryClient";

/**
 * Dev-only route. In production it 404s; locally it renders the whole widget
 * catalog from fixtures for visual inspection.
 */
export const dynamic = "force-dynamic";

export default function GalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen">
      <GalleryClient />
    </main>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getProblem, PROBLEM_SLUGS } from "@/content/systemDesign";
import { CourseReader } from "@/components/course/CourseReader";

export function generateStaticParams() {
  return PROBLEM_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) return {};
  return {
    title: problem.title,
    description: problem.tagline,
    openGraph: {
      title: `${problem.title} · Learnify.sd`,
      description: problem.tagline,
      type: "article",
    },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();

  // No session read here on purpose: it would opt every course page out of
  // static generation. Progress is a signed-in-only overlay and loads on the
  // client instead, so the page itself stays prerendered for everyone.
  return <CourseReader problem={problem} />;
}

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
  return { title: problem.title, description: problem.tagline };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();

  return <CourseReader problem={problem} />;
}

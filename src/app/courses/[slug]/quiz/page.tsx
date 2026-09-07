import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getProblem, PROBLEM_SLUGS } from "@/content/systemDesign";
import { getQuiz } from "@/content/systemDesign/quizzes";
import { CourseQuiz } from "@/components/course/CourseQuiz";

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
    title: `${problem.title} quiz`,
    description: `Test yourself on ${problem.title} — pre-written questions, no account needed.`,
  };
}

/** Fully static: the questions are authored content, so this prerenders and
 *  needs neither a session nor a model call. */
export default async function CourseQuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();

  const questions = getQuiz(slug);
  if (questions.length === 0) notFound();

  return (
    <main className="wrap-prose space-y-8 py-12">
      <header className="space-y-3">
        <Link href={`/courses/${slug}`} className="label">
          ← {problem.title}
        </Link>
        <h1 className="text-3xl">Quiz</h1>
        <p className="text-(--color-mist)">
          {questions.length} questions across the whole course. Everything here is pre-written —
          no account, and it doesn&apos;t use any of your tutor budget.
        </p>
      </header>

      <CourseQuiz slug={slug} title={problem.title} questions={questions} />
    </main>
  );
}

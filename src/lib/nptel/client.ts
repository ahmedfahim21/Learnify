import { decodeCourseList, decodeCourseOutline, type NptelCourseList, type NptelOutline } from "./decode";

/**
 * Fetches from nptel.ac.in. The host is fixed and course ids are integers, so
 * nothing taken from NPTEL's own payloads ever shapes a URL here.
 */

const BASE = "https://nptel.ac.in";
const TIMEOUT_MS = 20_000;

export class NptelFetchError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`NPTEL fetch failed: ${url} → HTTP ${status}`);
    this.name = "NptelFetchError";
  }
}

async function getJson(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new NptelFetchError(url, res.status);
  return res.json();
}

export async function fetchCourseList(): Promise<NptelCourseList> {
  return decodeCourseList(await getJson("/courses/__data.json"));
}

export async function fetchCourseOutline(courseId: number): Promise<NptelOutline> {
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    throw new Error(`Invalid NPTEL course id: ${courseId}`);
  }
  return decodeCourseOutline(await getJson(`/courses/${courseId}/__data.json`));
}

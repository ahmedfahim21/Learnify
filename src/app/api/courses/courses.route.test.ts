import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Course, Lecture } from "@/db/schema";

/**
 * The course routes are public reads, so the things worth pinning are the
 * response shapes (every field, and that caption references never leave the
 * server), input validation, and whose fault a failure is.
 */
const mocks = vi.hoisted(() => ({ listCourses: vi.fn(), listDisciplines: vi.fn(), listFeatured: vi.fn(), getCourseWithLectures: vi.fn() }));

vi.mock("@/lib/courses/repo", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/courses/repo")>();
  return { ...real, listCourses: mocks.listCourses, listDisciplines: mocks.listDisciplines, listFeatured: mocks.listFeatured, getCourseWithLectures: mocks.getCourseWithLectures };
});

const { GET: listGET } = await import("./route");
const { COURSE_PAGE_SIZE: PAGE_SIZE } = await import("@/lib/courses/repo");
const { GET: courseGET } = await import("./[courseId]/route");
const { NptelFetchError } = await import("@/lib/nptel/client");

const course: Course = {
  id: 106106127,
  title: "Programming, Data Structures and Algorithms using C",
  professor: "Prof. Hema A Murthy",
  institute: "IIT Madras",
  disciplineId: 106,
  disciplineName: "Computer Science and Engineering",
  contentType: "Video",
  humanLangs: ["hi", "ta"],
  outlineFetchedAt: new Date("2026-10-31T00:00:00Z"),
  featuredRank: null,
  syncedAt: new Date("2026-10-31T00:00:00Z"),
};

const lecture: Lecture = {
  id: "0b0e0c7e-5f1a-4f4b-9d55-6d2a4cbb4b11",
  courseId: 106106127,
  position: 0,
  nptelLessonId: 1,
  unitName: "Basic Programming Constructs",
  title: "Introduction to Computers and Programming",
  youtubeId: "DYFhgnaZCRE",
  conceptsCovered: null,
  vttRefs: { English: "1ef5G3pl4xZRWLkULHwOJ9q", Tamil: "1ZXj7zNSBlOzEwNUfRcG2Qg", Odiya: "gs://x/y.vtt" },
  createdAt: new Date("2026-10-31T00:00:00Z"),
};

const expectedCourse = {
  id: 106106127,
  title: "Programming, Data Structures and Algorithms using C",
  professor: "Prof. Hema A Murthy",
  institute: "IIT Madras",
  disciplineId: 106,
  disciplineName: "Computer Science and Engineering",
  humanLangs: ["hi", "ta"],
};

const ctx = (courseId: string) => ({ params: Promise.resolve({ courseId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listDisciplines.mockResolvedValue([{ id: 106, name: "Computer Science and Engineering", courses: 412 }]);
});

describe("GET /api/courses", () => {
  it("returns a page of courses with exactly the public fields", async () => {
    mocks.listCourses.mockResolvedValue({ courses: [course], nextCursor: 106106127 });
    const res = await listGET(new Request("http://x/api/courses?discipline=106&q=%20data%20&cursor=5"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courses: [expectedCourse], nextCursor: 106106127 });
    expect(mocks.listCourses).toHaveBeenCalledWith({ disciplineId: 106, q: "data", cursor: 5, limit: PAGE_SIZE });
    expect(mocks.listDisciplines).not.toHaveBeenCalled();
  });

  it("includes the disciplines with the first page only", async () => {
    mocks.listCourses.mockResolvedValue({ courses: [], nextCursor: null });
    const body = await (await listGET(new Request("http://x/api/courses"))).json();
    expect(body).toEqual({
      courses: [],
      nextCursor: null,
      disciplines: [{ id: 106, name: "Computer Science and Engineering", courses: 412 }],
    });
  });

  it("serves the featured shelf, edge-cached, without paging", async () => {
    mocks.listFeatured.mockResolvedValue([course]);
    const res = await listGET(new Request("http://x/api/courses?featured=1"));
    expect(await res.json()).toEqual({ courses: [expectedCourse] });
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=600/);
    expect(mocks.listCourses).not.toHaveBeenCalled();
  });

  it("treats a blank search as no search", async () => {
    mocks.listCourses.mockResolvedValue({ courses: [], nextCursor: null });
    await listGET(new Request("http://x/api/courses?q=%20%20"));
    expect(mocks.listCourses).toHaveBeenCalledWith({ disciplineId: undefined, q: undefined, cursor: undefined, limit: PAGE_SIZE });
  });

  it.each(["discipline=abc", "cursor=-1", `q=${"x".repeat(101)}`])("rejects %s without querying", async (qs) => {
    const res = await listGET(new Request(`http://x/api/courses?${qs}`));
    expect(res.status).toBe(400);
    expect(mocks.listCourses).not.toHaveBeenCalled();
  });
});

describe("GET /api/courses/[courseId]", () => {
  it("returns the course and its lectures, without caption references", async () => {
    mocks.getCourseWithLectures.mockResolvedValue({ course, lectures: [lecture] });
    const res = await courseGET(new Request("http://x"), ctx("106106127"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      course: expectedCourse,
      lectures: [
        {
          id: "0b0e0c7e-5f1a-4f4b-9d55-6d2a4cbb4b11",
          position: 0,
          nptelLessonId: 1,
          unitName: "Basic Programming Constructs",
          title: "Introduction to Computers and Programming",
          youtubeId: "DYFhgnaZCRE",
          captionLangs: ["en", "ta", "od"],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/1ef5G3pl|gs:\/\//);
    expect(mocks.getCourseWithLectures).toHaveBeenCalledWith(106106127);
  });

  it("404s an id that isn't in the bank", async () => {
    mocks.getCourseWithLectures.mockResolvedValue(null);
    expect((await courseGET(new Request("http://x"), ctx("1"))).status).toBe(404);
  });

  it.each(["abc", "12.5", "-3", "1e5"])("400s a malformed id %s without querying", async (id) => {
    expect((await courseGET(new Request("http://x"), ctx(id))).status).toBe(400);
    expect(mocks.getCourseWithLectures).not.toHaveBeenCalled();
  });

  it("answers 502 with the reason when NPTEL fails", async () => {
    mocks.getCourseWithLectures.mockRejectedValue(new NptelFetchError("https://nptel.ac.in/courses/1/__data.json", 503));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await courseGET(new Request("http://x"), ctx("1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Couldn't load this course from NPTEL right now.",
      detail: "NPTEL fetch failed: https://nptel.ac.in/courses/1/__data.json → HTTP 503",
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("lets our own failures surface as errors", async () => {
    mocks.getCourseWithLectures.mockRejectedValue(new Error("db down"));
    await expect(courseGET(new Request("http://x"), ctx("1"))).rejects.toThrow("db down");
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

/**
 * Supabase serves every `public` table over PostgREST to anyone with the anon
 * key, which ships in the browser. A table without row-level security is
 * therefore readable and writable by the world. This fails the build when a
 * table in schema.ts has no `ENABLE ROW LEVEL SECURITY` in a migration, or a
 * table with a `user_id` column has no foreign key onto auth.users.
 */

const migrationsDir = join(process.cwd(), "drizzle");
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

const configs = Object.values(schema as Record<string, unknown>)
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => getTableConfig(t));
const tables = configs.map((c) => c.name);
const userTables = configs.filter((c) => c.columns.some((col) => col.name === "user_id")).map((c) => c.name);

describe("row-level security", () => {
  it("finds the schema's tables", () => {
    expect(tables.sort()).toEqual(["card_reviews", "courses", "doubts", "generated_screens", "generation_usage", "jobs", "learner_preferences", "lectures", "quiz_attempts", "streaks", "study_packs", "transcripts"]);
    expect(userTables.sort()).toEqual(["card_reviews", "doubts", "generation_usage", "learner_preferences", "quiz_attempts", "streaks"]);
  });

  it.each(tables)("is enabled on %s", (table) => {
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  });

  it.each(userTables)("%s has its user_id foreign key onto auth.users", (table) => {
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" ADD CONSTRAINT [^;]+REFERENCES "auth"."users"`));
  });
});

import { z } from "zod";

import { getBedrock, UTILITY_MODEL } from "../bedrock";

/**
 * Concept-graph generation: decompose a topic into a prerequisite DAG.
 *
 * A topic decomposes into 6–14 concepts and the prerequisite edges between
 * them — the spine the Mastery Engine (#43) hangs off, and the evolution of old
 * Learnify's mindmap. One structured-output model call produces the raw graph;
 * everything the model returns is then validated and repaired server-side
 * (`validateConceptGraph`) so the persisted graph is *always* a clean DAG:
 * slugs deduped, dangling/self edges dropped, and any cycle broken by removing
 * back-edges against a topological order.
 *
 * The model call is reached only at runtime — importing this module never
 * touches Bedrock, so `next build` and lint pass with no env vars set.
 */

const MIN_CONCEPTS = 6;
const MAX_CONCEPTS = 14;

/** One node as the model emits it (pre-validation). */
const rawConceptSchema = z.object({
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  difficulty: z.number(),
});

/** One prerequisite edge as the model emits it (pre-validation). */
const rawEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const rawGraphSchema = z.object({
  concepts: z.array(rawConceptSchema),
  edges: z.array(rawEdgeSchema),
});

export type RawConceptGraph = z.infer<typeof rawGraphSchema>;

/** A validated concept, in topological order. */
export interface ValidatedConcept {
  slug: string;
  name: string;
  summary: string;
  /** Clamped to 1–5. */
  difficulty: number;
  /** Topological rank (0 = no prerequisites). */
  orderIndex: number;
}

/** A validated prerequisite edge, referencing concept slugs. */
export interface ValidatedEdge {
  from: string;
  to: string;
}

export interface ValidatedConceptGraph {
  concepts: ValidatedConcept[];
  edges: ValidatedEdge[];
}

export class ConceptGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConceptGraphError";
  }
}

const TOOL_NAME = "emit_concept_graph";

/** JSON schema for the decomposition tool — the contract with the model. */
const conceptGraphToolSchema = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      description: `Between ${MIN_CONCEPTS} and ${MAX_CONCEPTS} concepts, ordered from foundational to advanced.`,
      items: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description:
              "Stable, lower-kebab-case identifier, unique within the topic (e.g. \"chain-rule\").",
          },
          name: { type: "string", description: "Short human-readable name." },
          summary: {
            type: "string",
            description: "One or two sentences on what this concept covers.",
          },
          difficulty: {
            type: "integer",
            description: "1 (foundational) to 5 (advanced).",
          },
        },
        required: ["slug", "name", "summary", "difficulty"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      description:
        "Prerequisite edges. An edge {from, to} means `from` must be learned before `to`. Reference concepts by slug. Keep it an acyclic graph (no concept is, directly or indirectly, its own prerequisite).",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "Prerequisite concept slug." },
          to: { type: "string", description: "Dependent concept slug." },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts", "edges"],
  additionalProperties: false,
} as const;

function buildPrompt(topicTitle: string): string {
  return [
    `Decompose the topic "${topicTitle}" into its prerequisite concept graph for a learner starting from scratch.`,
    "",
    `Produce ${MIN_CONCEPTS}–${MAX_CONCEPTS} concepts that together give a coherent path through the topic, ordered roughly foundational → advanced.`,
    "Draw a prerequisite edge from A to B when truly understanding B depends on A. Prefer a sparse, meaningful set of edges over connecting everything — and never create a cycle.",
    "Slugs must be lower-kebab-case and unique.",
    "Call the emit_concept_graph tool with the result.",
  ].join("\n");
}

/**
 * Run the decomposition model call and return the validated, DAG-clean graph.
 * Throws {@link ConceptGraphError} if the model produces nothing usable.
 */
export async function generateConceptGraph(
  topicTitle: string,
  opts: { model?: string } = {},
): Promise<ValidatedConceptGraph> {
  const client = getBedrock();
  const model = opts.model ?? UTILITY_MODEL;

  const response = (await client.messages.create({
    model,
    max_tokens: 4096,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Emit the prerequisite concept graph for the requested topic.",
        input_schema: conceptGraphToolSchema as unknown as Record<
          string,
          unknown
        >,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: buildPrompt(topicTitle) }],
  } as Parameters<typeof client.messages.create>[0])) as {
    content: Array<{ type: string; name?: string; input?: unknown }>;
  };

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === TOOL_NAME,
  );

  if (!block) {
    throw new ConceptGraphError("Model did not return a concept graph.");
  }

  const parsed = rawGraphSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new ConceptGraphError(
      `Concept graph failed schema validation: ${parsed.error.message}`,
    );
  }

  return validateConceptGraph(parsed.data);
}

/** Lower-kebab-case a slug; fall back to a positional id if it empties out. */
function normalizeSlug(raw: string, index: number): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `concept-${index + 1}`;
}

function clampDifficulty(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value)));
}

/**
 * Turn a raw model graph into a guaranteed-valid DAG:
 *   1. normalise + dedupe concept slugs (first occurrence wins),
 *   2. drop edges that reference unknown concepts, are self-loops, or duplicate,
 *   3. Kahn topological sort; any edge that would close a cycle is dropped,
 *   4. assign `orderIndex` from the topological order.
 *
 * Throws {@link ConceptGraphError} only when there isn't a single usable concept.
 */
export function validateConceptGraph(
  raw: RawConceptGraph,
): ValidatedConceptGraph {
  // 1. Concepts: normalise slugs, dedupe (first wins).
  const bySlug = new Map<string, ValidatedConcept>();
  raw.concepts.forEach((c, i) => {
    let slug = normalizeSlug(c.slug, i);
    // Guarantee uniqueness even if two names normalise to the same slug.
    if (bySlug.has(slug)) {
      let n = 2;
      while (bySlug.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    bySlug.set(slug, {
      slug,
      name: c.name.trim() || slug,
      summary: c.summary.trim(),
      difficulty: clampDifficulty(c.difficulty),
      orderIndex: 0,
    });
  });

  if (bySlug.size === 0) {
    throw new ConceptGraphError("Concept graph had no usable concepts.");
  }

  // Map the model's original slug spellings to our normalised ones so edges
  // referencing the raw slug still resolve.
  const rawToNorm = new Map<string, string>();
  raw.concepts.forEach((c, i) => {
    const norm = normalizeSlug(c.slug, i);
    if (!rawToNorm.has(c.slug)) rawToNorm.set(c.slug, norm);
  });
  const resolve = (ref: string): string | undefined => {
    if (bySlug.has(ref)) return ref;
    const viaRaw = rawToNorm.get(ref);
    if (viaRaw && bySlug.has(viaRaw)) return viaRaw;
    const normed = normalizeSlug(ref, 0);
    return bySlug.has(normed) ? normed : undefined;
  };

  // 2. Edges: resolve endpoints, drop dangling / self / duplicate edges.
  const seenEdge = new Set<string>();
  const candidateEdges: ValidatedEdge[] = [];
  for (const e of raw.edges) {
    const from = resolve(e.from);
    const to = resolve(e.to);
    if (!from || !to || from === to) continue;
    const key = `${from} ${to}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    candidateEdges.push({ from, to });
  }

  // 3. Kahn topological sort, dropping back-edges that would close a cycle.
  const slugs = [...bySlug.keys()];
  const position = new Map(slugs.map((s, i) => [s, i]));
  const adjacency = new Map<string, ValidatedEdge[]>();
  const indegree = new Map<string, number>(slugs.map((s) => [s, 0]));
  for (const e of candidateEdges) {
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e]);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  // Deterministic queue (by original concept position) so the same input
  // always yields the same ordering and the same dropped edges.
  const ready = slugs.filter((s) => (indegree.get(s) ?? 0) === 0);
  ready.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
  const order: string[] = [];
  while (ready.length > 0) {
    const slug = ready.shift()!;
    order.push(slug);
    const outgoing = (adjacency.get(slug) ?? []).slice().sort((a, b) =>
      (position.get(a.to) ?? 0) - (position.get(b.to) ?? 0),
    );
    for (const e of outgoing) {
      const next = (indegree.get(e.to) ?? 0) - 1;
      indegree.set(e.to, next);
      if (next === 0) {
        // Insert keeping the queue sorted by position.
        const pos = position.get(e.to) ?? 0;
        let idx = ready.findIndex((s) => (position.get(s) ?? 0) > pos);
        if (idx === -1) idx = ready.length;
        ready.splice(idx, 0, e.to);
      }
    }
  }

  // Any concept not in `order` sits on a cycle; append it so every concept is
  // ranked, and we'll keep only edges that respect the final order.
  const rank = new Map<string, number>();
  order.forEach((slug, i) => rank.set(slug, i));
  for (const slug of slugs) {
    if (!rank.has(slug)) rank.set(slug, rank.size);
  }

  // 4. Keep only forward edges under the final rank (drops cycle back-edges).
  const edges = candidateEdges.filter(
    (e) => (rank.get(e.from) ?? 0) < (rank.get(e.to) ?? 0),
  );

  const concepts = slugs
    .map((slug) => ({ ...bySlug.get(slug)!, orderIndex: rank.get(slug) ?? 0 }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return { concepts, edges };
}

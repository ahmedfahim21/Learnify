/**
 * The cross-cutting themes a skill can belong to.
 *
 * Concepts are taught one design problem at a time, but the ideas inside them
 * are not confined to one: the consistent hashing in a distributed cache is
 * the same idea as the partitioning in a key-value store, and a learner who
 * has met it twice should be able to see that. Without something like this a
 * knowledge graph has no edges to draw between concepts and degenerates into
 * one column per problem.
 *
 * A closed vocabulary rather than free text, because these are joined on: a
 * typo would silently produce an orphan hub rather than a link, and the
 * content test would have nothing to catch.
 */
export const SKILL_TAGS = [
  "scoping",
  "estimation",
  "api-design",
  "data-modeling",
  "caching",
  "partitioning",
  "replication",
  "consistency",
  "queueing",
  "fanout",
  "idempotency",
  "indexing",
  "load-balancing",
  "rate-limiting",
  "hotspots",
  "availability",
  "durability",
  "ordering",
  "observability",
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

export const SKILL_TAG_LABELS: Record<SkillTag, string> = {
  scoping: "Scoping",
  estimation: "Estimation",
  "api-design": "API design",
  "data-modeling": "Data modelling",
  caching: "Caching",
  partitioning: "Partitioning",
  replication: "Replication",
  consistency: "Consistency",
  queueing: "Queueing",
  fanout: "Fan-out",
  idempotency: "Idempotency",
  indexing: "Indexing",
  "load-balancing": "Load balancing",
  "rate-limiting": "Rate limiting",
  hotspots: "Hotspots",
  availability: "Availability",
  durability: "Durability",
  ordering: "Ordering",
  observability: "Observability",
};

/**
 * Tag -> accent token, so a hub and its spokes share a colour in the graph.
 * Values are the accent names in globals.css, not raw colours.
 */
export const SKILL_TAG_ACCENT: Record<SkillTag, string> = {
  scoping: "faint",
  estimation: "faint",
  "api-design": "signal",
  "data-modeling": "deep",
  caching: "signal",
  partitioning: "flow",
  replication: "deep",
  consistency: "accent",
  queueing: "flow",
  fanout: "flow",
  idempotency: "accent",
  indexing: "deep",
  "load-balancing": "signal",
  "rate-limiting": "warn",
  hotspots: "warn",
  availability: "alert",
  durability: "deep",
  ordering: "accent",
  observability: "warn",
};

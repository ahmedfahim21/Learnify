import { urlShortener } from "./problems/urlShortener";
import { rateLimiter } from "./problems/rateLimiter";
import { distributedCache } from "./problems/distributedCache";
import { keyValueStore } from "./problems/keyValueStore";
import { uniqueIdGenerator } from "./problems/uniqueIdGenerator";
import { webCrawler } from "./problems/webCrawler";
import { notificationSystem } from "./problems/notificationSystem";
import { newsFeed } from "./problems/newsFeed";
import { chatSystem } from "./problems/chatSystem";
import { searchAutocomplete } from "./problems/searchAutocomplete";
import { videoStreaming } from "./problems/videoStreaming";
import { fileStorage } from "./problems/fileStorage";
import { proximityService } from "./problems/proximityService";
import { distributedMessageQueue } from "./problems/distributedMessageQueue";
import { metricsMonitoring } from "./problems/metricsMonitoring";
import { paymentSystem } from "./problems/paymentSystem";
import type { SystemDesignProblem } from "./types";

/**
 * The full curated course catalog — the canonical system-design interview
 * curriculum, hand-authored and grounded in the concepts that recur across
 * the ByteByteGo / Alex Xu explainer archives (caching, consistent hashing,
 * message queues, rate limiting, object storage, payment systems, ...).
 * Original prose and diagrams throughout; no source content reproduced.
 */
export const PROBLEMS: SystemDesignProblem[] = [
  urlShortener,
  rateLimiter,
  distributedCache,
  keyValueStore,
  uniqueIdGenerator,
  webCrawler,
  notificationSystem,
  newsFeed,
  chatSystem,
  searchAutocomplete,
  videoStreaming,
  fileStorage,
  proximityService,
  distributedMessageQueue,
  metricsMonitoring,
  paymentSystem,
];

export const PROBLEM_SLUGS = PROBLEMS.map((p) => p.slug);

export function getProblem(slug: string): SystemDesignProblem | undefined {
  return PROBLEMS.find((p) => p.slug === slug);
}

/**
 * A course's headline diagram — the high-level design where one is authored,
 * else the first diagram in reading order. Used for card thumbnails, so every
 * course shows its own architecture rather than generic art.
 */
export function getPrimaryDiagram(problem: SystemDesignProblem) {
  const chapters = [
    ...problem.chapters.filter((c) => c.phase === "high-level"),
    ...problem.chapters,
  ];
  for (const chapter of chapters) {
    for (const block of chapter.blocks) {
      if (block.type === "diagram") return block.diagram;
    }
  }
  return undefined;
}

export * from "./types";

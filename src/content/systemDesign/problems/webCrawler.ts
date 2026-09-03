import type { SystemDesignProblem } from "../types";

export const webCrawler: SystemDesignProblem = {
  slug: "web-crawler",
  title: "Web Crawler",
  tagline: "Discover and fetch billions of pages without hammering any one site, and without crawling the same URL twice.",
  difficulty: 3,
  estimatedMinutes: 25,
  tags: ["crawling", "queueing", "distributed-systems", "dedup"],
  functionalRequirements: [
    "Start from a set of seed URLs and follow links to discover new pages.",
    "Fetch and store page content for downstream use (e.g. search indexing).",
    "Never fetch the exact same URL twice.",
    "Respect robots.txt and per-site crawl-rate limits.",
  ],
  nonFunctionalRequirements: [
    "Scale to billions of pages, run continuously (the web changes).",
    "Be extensible — new content types and extraction rules over time.",
    "Be polite — bounded, configurable request rate per host so no site gets hammered.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "What is a crawler actually optimizing for?",
      summary: "Coverage and freshness, under a hard constraint: never overload the sites you're crawling.",
      concepts: [
        { slug: "crawler-scope", name: "Coverage, freshness, politeness", summary: "The three axes a crawler is judged on: how much of the web it covers, how fresh its copy is, and whether it stays a well-behaved citizen of the sites it visits.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A crawler's job sounds simple — follow links, fetch pages — but it's shaped by a tension: crawl aggressively for coverage and freshness, while staying \"polite\" enough that no single site's server gets overwhelmed (or blocks you outright). That politeness constraint, more than raw scale, is what drives most of the interesting design decisions here." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers",
      summary: "Billions of pages, terabytes of content, and a URL frontier too big to fit in memory.",
      concepts: [
        { slug: "crawler-estimation", name: "Estimating crawl scale", summary: "At web scale, both the set of URLs-to-visit and the set of URLs-already-visited outgrow a single machine's memory — both need to become distributed data structures.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Crawling 1 billion pages a month at an average 500 KB each is 500 TB of raw content a month. The URL frontier (URLs discovered but not yet fetched) and the seen-set (URLs already fetched, to avoid re-fetching) both need to track billions of entries — far past what fits in one machine's memory, which is why both become distributed, not local, data structures in the high-level design." },
      ],
    },
    {
      phase: "api",
      title: "The crawl loop's interface",
      summary: "Not a client-facing API — an internal contract between the frontier, fetchers, and extractors.",
      concepts: [
        { slug: "crawler-loop", name: "The fetch-parse-extract loop", summary: "Pop a URL, fetch it, extract new links and content, push the new links back onto the frontier. This loop, run by many workers in parallel, is the entire crawler.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "There's no external API here — the interface is the loop itself: pop a URL from the frontier, fetch the page (respecting robots.txt and rate limits), extract its links and its content, push newly-discovered links back onto the frontier, store the content, mark the URL as seen. Many workers run this loop concurrently against a shared frontier and seen-set." },
      ],
    },
    {
      phase: "data-model",
      title: "The two big sets: frontier and seen",
      summary: "A priority queue of URLs to visit, and a set (typically a Bloom filter) of URLs already visited.",
      concepts: [
        { slug: "crawler-bloom-filter", name: "The Bloom filter for dedup", summary: "Checking 'have I seen this URL?' against billions of entries in an exact set is expensive; a Bloom filter answers 'definitely not, or maybe' in constant time and constant (small) memory, at the cost of a small false-positive rate.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "The seen-set needs to answer one question — has this URL been crawled? — billions of times, fast, without storing every URL string in full. A Bloom filter (a bit array plus several hash functions) does exactly this: it can say \"definitely not seen\" with certainty, or \"possibly seen\" with a small, tunable false-positive rate, using a fraction of the memory an exact hash set would need. The cost of a false positive here is just an occasional missed re-crawl of an already-crawled page — an acceptable trade for the memory savings at this scale." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Seed URLs feed a frontier queue; a fleet of fetcher workers drains it, checking politeness rules per host.",
      concepts: [
        { slug: "crawler-politeness", name: "Per-host politeness via queue partitioning", summary: "Partition the frontier by host, and enforce a minimum delay between two fetches to the same host — this is what keeps the crawler from accidentally DDoSing any one site.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "Web crawler — the fetch loop",
            columns: 5,
            rows: 2,
            nodes: [
              { id: "seeds", label: "Seed URLs", icon: "document", col: 0, row: 0 },
              { id: "frontier", label: "URL frontier", sublabel: "partitioned by host", icon: "queue", col: 1, row: 0, accent: "amber" },
              { id: "fetchers", label: "Fetcher workers", icon: "worker", col: 2, row: 0, accent: "blue" },
              { id: "extractor", label: "Link + content extractor", icon: "function", col: 3, row: 0, accent: "blue" },
              { id: "storage", label: "Content store", icon: "blob-storage", col: 4, row: 0, accent: "purple" },
              { id: "seen", label: "Seen-set (Bloom filter)", icon: "cache", col: 2, row: 1, accent: "cyan" },
            ],
            edges: [
              { id: "e1", from: "seeds", to: "frontier", step: 1 },
              { id: "e2", from: "frontier", to: "fetchers", step: 2, label: "pop, respecting politeness delay" },
              { id: "e3", from: "fetchers", to: "extractor", step: 3 },
              { id: "e4", from: "extractor", to: "storage", step: 4, label: "store page content" },
              { id: "e5", from: "extractor", to: "frontier", step: 5, label: "new links, if unseen", route: "vertical-first" },
              { id: "e6", from: "fetchers", to: "seen", step: 2, label: "check + mark seen" },
            ],
            steps: [
              { index: 1, caption: "Seed URLs prime the frontier queue.", nodeIds: ["seeds", "frontier"], edgeIds: ["e1"] },
              { index: 2, caption: "A fetcher pops a URL, first checking the seen-set and its host's politeness delay.", nodeIds: ["frontier", "fetchers", "seen"], edgeIds: ["e2", "e6"] },
              { index: 3, caption: "It fetches the page and hands it to the extractor.", nodeIds: ["fetchers", "extractor"], edgeIds: ["e3"] },
              { index: 4, caption: "The extractor stores the page content.", nodeIds: ["extractor", "storage"], edgeIds: ["e4"] },
              { index: 5, caption: "Newly discovered links, if not already seen, go back onto the frontier.", nodeIds: ["extractor", "frontier"], edgeIds: ["e5"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: avoiding crawler traps",
      summary: "Some sites generate infinite URLs (calendars, session ids in the URL) — the crawler needs guardrails.",
      concepts: [
        { slug: "crawler-traps", name: "Crawler traps and URL normalization", summary: "Dynamically generated infinite link spaces (an endless 'next month' calendar link) can trap a naive crawler forever. Normalizing URLs (stripping session ids, sorting query params) and capping crawl depth per host limits the damage.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "A calendar page with a \"next month\" link that always points to another valid page can keep a crawler fetching forever, one host, without ever finishing. Two defenses: normalize URLs so equivalent pages (query params in different orders, trailing slashes, session ids) collapse to one seen-set entry, and cap max crawl depth or max pages per host as a hard backstop.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "The frontier queue and the seen-set both need to be distributed once a single host can't hold them.",
      concepts: [
        { slug: "crawler-scaling", name: "Distributing the frontier and seen-set", summary: "Both the frontier and seen-set need to be sharded across machines at web scale — usually by a hash of the host, so all URLs for one host land on the same shard and politeness rate-limiting stays local to that shard.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Sharding the frontier by host (not randomly) keeps all of one site's URLs on the same shard, so the per-host politeness delay can be enforced with purely local state on that shard — no cross-shard coordination needed to answer \"have we hit example.com too recently?\". The Bloom filter seen-set shards the same way it would in any distributed cache design (see the Distributed Cache course), typically by a hash of the normalized URL.",
        },
      ],
    },
  ],
};

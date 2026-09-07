import type { SystemDesignProblem } from "../types";

export const urlShortener: SystemDesignProblem = {
  slug: "url-shortener",
  title: "URL Shortener",
  tagline: "Turn a long URL into a short code, and route billions of redirects with single-digit-millisecond latency.",
  difficulty: 1,
  estimatedMinutes: 25,
  tags: ["caching", "key-value", "id-generation", "read-heavy"],
  functionalRequirements: [
    "Given a long URL, return a short alias (e.g. sho.rt/a1B2c3).",
    "Given a short alias, redirect to the original long URL (HTTP 301/302).",
    "Optionally let a user pick a custom alias.",
    "Optionally expire a link after a configured date.",
  ],
  nonFunctionalRequirements: [
    "Reads vastly outnumber writes — a 100:1 redirect-to-create ratio is typical.",
    "Redirect latency should be single-digit milliseconds at the p99.",
    "Short codes must never collide across the whole system.",
    "The service should stay available even if a single node fails.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "What are we actually building?",
      summary: "Nail down the two operations that matter and the read/write shape before touching any architecture.",
      concepts: [
        {
          slug: "urlshort-scope",
          name: "Scoping a URL shortener",
          summary: "Two operations only: create a short link, and redirect from it. Everything else — custom aliases, expiry, analytics — is a stretch goal layered on top.",
          difficulty: 1,
          tags: ["scoping", "api-design"],
        },
      ],
      blocks: [
        {
          type: "prose",
          heading: "Two operations, wildly different volume",
          body: "A URL shortener has exactly two core operations: **create** a mapping from a long URL to a short code, and **redirect** a short code back to its long URL. In production the redirect path gets called far more often than create — every click on a shared link is a read, but the link itself is created once. That asymmetry (often 100 reads for every 1 write) is the single fact that should drive every architectural choice that follows: this is a read-optimized, cache-friendly system, not a write-optimized one.",
        },
        {
          type: "callout",
          tone: "note",
          body: "Interviewers often add \"custom alias\" and \"link expiry\" as functional requirements specifically to see whether you'll bolt them onto the core design cleanly or let them complicate the hot path (redirects). Keep them out of the read path.",
        },
      ],
    },
    {
      phase: "estimation",
      title: "Back-of-envelope numbers",
      summary: "Traffic shape and storage footprint, worked from a plausible daily volume.",
      concepts: [
        {
          slug: "urlshort-estimation",
          name: "Estimating traffic and storage",
          summary: "From a daily write volume, derive QPS, the short-code keyspace needed, and total storage — the numbers that decide whether you need sharding at all.",
          difficulty: 1,
          tags: ["estimation"],
        },
      ],
      blocks: [
        {
          type: "prose",
          heading: "From daily writes to steady-state QPS",
          body: "Say the service creates 100 million new short links a day, with a 100:1 read:write ratio. That's about 1,160 writes/sec on average and roughly 116,000 reads/sec — real traffic, not evenly spread, so design for a peak a few times the average. Over 10 years at that write rate you'd store roughly 365 billion mappings. If each row (short code, long URL, metadata) is about 500 bytes, that's on the order of 180 TB — too big for one machine's disk, but comfortably shardable by short code.",
        },
        {
          type: "prose",
          heading: "Sizing the keyspace",
          body: "A short code drawn from `[a-zA-Z0-9]` (62 characters) needs to cover 365 billion possible links with room to spare. 7 characters gives 62^7 ≈ 3.5 trillion combinations — about 10x the 10-year volume, which is a comfortable margin against collisions and format changes.",
        },
        {
            type: "simulator",
            simulatorId: "back-of-envelope",
            title: "Run the numbers yourself",
            notice: "The chapter assumes 100M new links/day at 100:1 reads. Change the read:write ratio and watch peak reads move while storage stays put — reads decide your cache, writes decide your disk.",
            params: [{ key: "dau", value: 50000000 }, { key: "writesPerUserPerDay", value: 2 }, { key: "readWriteRatio", value: 100 }, { key: "bytesPerWrite", value: 500 }, { key: "retentionYears", value: 10 }],
          },
        ],
    },
    {
      phase: "api",
      title: "The API surface",
      summary: "Two endpoints, deliberately thin.",
      concepts: [
        {
          slug: "urlshort-api",
          name: "Designing the API",
          summary: "POST to create, GET to redirect. The redirect endpoint is the entire hot path — keep it doing nothing but a cache/DB lookup and a 301.",
          difficulty: 1,
          tags: ["api-design"],
        },
      ],
      blocks: [
        {
          type: "prose",
          body: "`POST /api/v1/shorten` takes `{ longUrl, customAlias?, expiresAt? }` and returns `{ shortUrl }`. `GET /{code}` looks up the code and issues an HTTP redirect to the long URL — no request body, no JSON response, just a `Location` header. That second endpoint is the one that has to be fast at 116,000 requests/sec; everything about the rest of the design exists to keep it fast.",
        },
      ],
    },
    {
      phase: "data-model",
      title: "Data model",
      summary: "One table, indexed on the thing you look up by.",
      concepts: [
        {
          slug: "urlshort-data-model",
          name: "The links table",
          summary: "short_code (primary key) -> long_url, created_at, expires_at. A key-value shape, not a relational one — which is why a NoSQL store fits as well as SQL here.",
          difficulty: 1,
          tags: ["data-modeling", "indexing"],
        },
      ],
      blocks: [
        {
          type: "prose",
          body: "The core table is almost a pure key-value pair: `short_code` (primary key) → `long_url`, plus `created_at` and an optional `expires_at`. There's no join anywhere in the hot path. That's exactly the access pattern a key-value store is built for — see the Key-Value Store course for why that matters when you're choosing Postgres vs. DynamoDB vs. Cassandra for this table.",
        },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Client, load balancer, stateless API service, cache, and the datastore — and where the short code actually comes from.",
      concepts: [
        {
          slug: "urlshort-generation",
          name: "Generating the short code",
          summary: "A counter-based generator (base62-encode an auto-incrementing id) avoids collisions by construction, unlike hashing the URL and truncating.",
          difficulty: 2,
          tags: ["ordering", "partitioning"],
        },
      ],
      blocks: [
        {
          type: "prose",
          heading: "Why not just hash the URL?",
          body: "The tempting first idea — MD5 the long URL and take the first 7 characters — collides constantly at scale (two different URLs, and worse, the same URL requested twice, both need a mapping, and a 7-character hash prefix has real collision probability at billions of rows). The design that avoids collisions **by construction** is a distributed unique ID generator producing a monotonic integer, then base62-encoding that integer into the short code. Two different requests can never get the same integer, so they can never collide.",
        },
        {
          type: "diagram",
          diagram: {
            title: "URL shortener — request paths",
            columns: 5,
            rows: 2,
            nodes: [
              { id: "client", label: "Client", detail: "A browser following a shared link, or an app calling the create endpoint. It has no idea any of the rest of this exists — it just sees a short URL and expects a redirect.", icon: "client", col: 0, row: 0 },              { id: "lb", label: "Load balancer", detail: "Spreads requests across the API fleet. Because the API servers hold no per-request state, any server can answer any request — which is what makes horizontal scaling here trivial.", icon: "load-balancer", col: 1, row: 0, accent: "amber" },              { id: "api", label: "API service", detail: "Stateless request handling: look up a code and redirect, or mint a new one. Keeping it stateless is the reason a server can be added or lost without anyone noticing.", icon: "api", col: 2, row: 0, accent: "blue" },              { id: "cache", label: "Cache", detail: "Holds the hottest short_code -> long_url pairs in memory. Click distributions are heavily skewed, so a modest cache absorbs the large majority of the 116K reads/sec.", sublabel: "code -> URL", icon: "cache", col: 3, row: 0, accent: "cyan" },              { id: "db", label: "Key-value store", detail: "The durable mapping. Sharded by short code so the redirect path — which always has the code in hand — routes straight to the right shard with no lookup service in between.", sublabel: "durable mapping", icon: "nosql", col: 3, row: 1, accent: "purple" },              { id: "idgen", label: "ID generator", detail: "Hands out collision-free monotonic ids, which get base62-encoded into short codes. Only touched on create, never on the redirect hot path.", icon: "worker", col: 2, row: 1, accent: "purple" },            ],
            edges: [
              { id: "e1", from: "client", to: "lb", step: 1, label: "GET or POST" },
              { id: "e2", from: "lb", to: "api", step: 2 },
              { id: "e3", from: "api", to: "cache", step: 3, label: "read-through on redirect" },
              { id: "e4", from: "cache", to: "db", step: 4, label: "miss -> load", route: "vertical-first" },
              { id: "e5", from: "api", to: "idgen", step: 5, label: "on create only" },
              { id: "e6", from: "idgen", to: "db", step: 6, label: "write new mapping" },
            ],
            steps: [
              { index: 1, caption: "A request arrives — either a redirect (GET) or a create (POST).", nodeIds: ["client", "lb"], edgeIds: ["e1"] },
              { index: 2, caption: "The load balancer routes it to a stateless API instance.", nodeIds: ["lb", "api"], edgeIds: ["e2"] },
              { index: 3, caption: "For a redirect, the service checks the cache first — this is the 116K req/s hot path.", nodeIds: ["api", "cache"], edgeIds: ["e3"] },
              { index: 4, caption: "On a cache miss, it falls through to the key-value store and populates the cache.", nodeIds: ["cache", "db"], edgeIds: ["e4"] },
              { index: 5, caption: "For a create, the service asks the ID generator for a fresh, collision-free id.", nodeIds: ["api", "idgen"], edgeIds: ["e5"] },
              { index: 6, caption: "It base62-encodes the id into a short code and writes the new mapping.", nodeIds: ["idgen", "db"], edgeIds: ["e6"] },
            ],
          },
        },
        {
          type: "simulator",
          simulatorId: "cache-hit-ratio",
          notice: "At a 100:1 read:write ratio, even a modest hit ratio removes the vast majority of load from the datastore — drag hit ratio up and watch origin traffic fall.",
          params: [{ key: "hitRatio", value: 0.85 }, { key: "qps", value: 100000 }, { key: "originLatencyMs", value: 15 }],
        },
        {
            type: "quiz",
            question: "Why is hashing the long URL and truncating to 7 characters the wrong way to make short codes?",
            options: [
              { id: "a", label: "Hashing is too slow to run on every create" },
              { id: "b", label: "Two different URLs can produce the same truncated hash, and nothing prevents it" },
              { id: "c", label: "Hashes are not URL-safe characters" },
              { id: "d", label: "It would make the redirect lookup slower" },
            ],
            correctOptionId: "b",
            explanation: "Truncating a hash throws away exactly the bits that made it collision-resistant. At billions of rows, distinct URLs will collide — and you'd have to detect and retry on every write. A counter-based id sidesteps this: two requests can never be handed the same integer, so collisions are impossible **by construction** rather than merely unlikely.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: the cache",
      summary: "Why redirects live or die on cache hit ratio, and how to keep it high.",
      concepts: [
        {
          slug: "urlshort-cache-strategy",
          name: "Cache-aside on the redirect path",
          summary: "Read-through cache-aside: check cache, fall back to the store on a miss, populate the cache. A skewed popularity distribution (a few links get most clicks) makes this very effective.",
          difficulty: 2,
          tags: ["caching"],
        },
      ],
      blocks: [
        {
          type: "prose",
          body: "Short-link click distributions are heavily skewed — a small fraction of links (a viral tweet, a marketing campaign) account for most redirects, so a cache-aside strategy with a reasonably sized LRU cache absorbs the overwhelming majority of read traffic. The cache stores exactly the key-value pairs the datastore stores (`short_code -> long_url`), which is what makes cache-aside so natural here: no query shape to translate, just a faster copy of the same lookup.",
        },
        {
          type: "callout",
          tone: "tradeoff",
          body: "A write-through cache would keep the cache always warm, but it adds latency to every create — and creates are already the rare, non-critical-path operation. Cache-aside, populated lazily on read, is the right trade-off here.",
        },
        {
            type: "diagram",
            diagram: {
              title: "Cache-aside on a redirect",
              columns: 4,
              rows: 2,
              nodes: [
                { id: "req", label: "GET /a1B2c3", detail: "A redirect request. The only thing it carries is the short code — no auth, no body, nothing to parse.", icon: "browser", col: 0, row: 0 },
                { id: "svc", label: "API service", detail: "Owns the cache-aside logic: look in the cache, and only on a miss go to the store and populate.", icon: "api", col: 1, row: 0, accent: "blue" },
                { id: "hit", label: "Cache hit", sublabel: "~1ms", detail: "The overwhelmingly common case. Click distributions are skewed enough that a modest LRU absorbs most traffic.", icon: "cache", col: 2, row: 0, accent: "green", shape: "pill" },
                { id: "miss", label: "Cache miss", sublabel: "~15ms", detail: "Rare, but this is the path that decides your p99. It costs a store read plus a cache write.", icon: "nosql", col: 2, row: 1, accent: "amber", shape: "pill" },
                { id: "redirect", label: "301 Location:", detail: "The response is a header, not a body. Nothing here needs serialization, which is part of why this path is so cheap.", icon: "web", col: 3, row: 0, accent: "green" },
              ],
              edges: [
                { id: "c1", from: "req", to: "svc", step: 1 },
                { id: "c2", from: "svc", to: "hit", step: 2, label: "found" },
                { id: "c3", from: "svc", to: "miss", step: 3, label: "not found", route: "vertical-first" },
                { id: "c4", from: "miss", to: "hit", step: 4, label: "populate cache" },
                { id: "c5", from: "hit", to: "redirect", step: 5 },
              ],
              steps: [
                { index: 1, caption: "A redirect arrives carrying only the short code.", nodeIds: ["req", "svc"], edgeIds: ["c1"] },
                { index: 2, caption: "The service checks the cache first — this is the path most requests take.", nodeIds: ["svc", "hit"], edgeIds: ["c2"] },
                { index: 3, caption: "On a miss it falls through to the durable store, ~15x slower.", nodeIds: ["svc", "miss"], edgeIds: ["c3"] },
                { index: 4, caption: "The loaded mapping is written back into the cache, so the next hit is warm.", nodeIds: ["miss", "hit"], edgeIds: ["c4"] },
                { index: 5, caption: "Either way the response is the same: a 301 with a Location header.", nodeIds: ["hit", "redirect"], edgeIds: ["c5"] },
              ],
            },
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks at 10x",
      summary: "The ID generator and the datastore are the two places that need a real answer before you 10x traffic.",
      concepts: [
        {
          slug: "urlshort-scaling",
          name: "Scaling past a single generator and a single store",
          summary: "A single ID-generator instance and a single database both become bottlenecks; the fix for each is different — range-partitioning ids vs. sharding the store by short code.",
          difficulty: 3,
          tags: ["partitioning", "caching"],
        },
      ],
      blocks: [
        {
          type: "prose",
          heading: "The ID generator can't be a single counter",
          body: "A literal auto-increment counter in one database row is a single point of contention the moment you have more than one API instance. The fix is to give each API instance (or each generator worker) its own pre-allocated range of ids — instance A hands out 1..1,000,000, instance B hands out 1,000,001..2,000,000, and so on — so no coordination is needed per request. This is exactly the kind of unique-ID-generation problem the Unique ID Generator course covers in depth.",
        },
        {
          type: "prose",
          heading: "Sharding the datastore",
          body: "Once the mapping table outgrows one machine, shard by `short_code` (or by a hash of it) so the redirect path — which always has the code in hand — can route directly to the right shard without a lookup service in between. This is the same consistent-hashing idea used to keep a distributed cache balanced; see the Distributed Cache course.",
        },
      ],
    },
  ],
};

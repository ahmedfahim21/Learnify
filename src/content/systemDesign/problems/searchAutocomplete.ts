import type { SystemDesignProblem } from "../types";

export const searchAutocomplete: SystemDesignProblem = {
  slug: "search-autocomplete",
  title: "Search Autocomplete",
  tagline: "Suggest the top completions for a search box on every keystroke, in single-digit milliseconds.",
  difficulty: 3,
  estimatedMinutes: 22,
  tags: ["search", "trie", "caching"],
  functionalRequirements: [
    "Given a prefix, return the top-K most popular completions.",
    "Update suggestion popularity over time as new searches happen.",
    "Suggestions should reflect roughly-recent trends, not stale ones.",
  ],
  nonFunctionalRequirements: [
    "Latency budget of ~100ms end to end, since it fires on every keystroke.",
    "High read QPS — every keystroke of every user is a request.",
    "Query popularity data updates continuously but doesn't need to be real-time-exact.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "The latency budget is the whole design",
      summary: "This fires on every keystroke, so the p99 latency target is far tighter than almost any other system in this course.",
      concepts: [
        { slug: "autocomplete-scope", name: "Autocomplete's latency-first requirement", summary: "A suggestion that arrives after the user has already typed the next character is useless — this design is dominated by the ~100ms round-trip budget, more than by any other requirement.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Autocomplete requests fire on essentially every keystroke, and a suggestion that arrives late is worse than useless — it flickers in after the user has moved on. That ~100ms round-trip budget (network + server processing) is the single hardest constraint in the design, tighter than almost any read latency target elsewhere in this course, and it rules out anything resembling a live database query per keystroke." },
        {
            type: "simulator",
            simulatorId: "latency-numbers",
            title: "What fits in an autocomplete budget?",
            notice: "Drag the budget down to 100ms. A memory read or an SSD seek disappears into it; a single cross-region round trip eats the whole thing — which is why the trie is served from local RAM and never queries a database.",
            params: [{ key: "budgetMs", value: 100 }],
          },
        ],
    },
    {
      phase: "estimation",
      title: "QPS and data size",
      summary: "Every keystroke of every active search session is a request — the multiplier that makes this a high-QPS system even with modest user counts.",
      concepts: [
        { slug: "autocomplete-estimation", name: "Estimating keystroke-driven QPS", summary: "A single search of 5 characters generates up to 5 autocomplete requests, not 1 — multiply typical search volume by average query length to get real request volume.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "If 10,000 searches happen per second and the average query is 8 characters typed before selecting a suggestion, that's up to 80,000 autocomplete requests/sec — an order of magnitude more than the underlying search volume itself, purely because of how the feature fires on every keystroke." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "One endpoint, one parameter — deliberately as thin as the latency budget demands.",
      concepts: [
        { slug: "autocomplete-api", name: "GET /suggestions?prefix=", summary: "A single GET with the current prefix, returning a small ranked list — no request body, no complex parameters, nothing that adds parsing overhead on the hot path.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`GET /suggestions?prefix=syst` returns `{ suggestions: [\"system design\", \"systemd\", \"systematic review\", ...] }` — typically the top 5-10 by popularity. The API surface is intentionally minimal; every millisecond of processing on this path is scrutinized given the latency budget." },
      ],
    },
    {
      phase: "data-model",
      title: "The trie",
      summary: "A trie (prefix tree) is the data structure purpose-built for 'give me everything starting with this prefix' — with each node caching its own top-K.",
      concepts: [
        { slug: "autocomplete-trie", name: "Trie with cached top-K per node", summary: "A trie naturally groups all completions of a prefix under one node. Caching each node's top-K most popular completions (instead of walking the whole subtree per query) turns a lookup into O(prefix length) with no subtree scan.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "A trie stores each character of each known query as a path from the root; every string that starts with a given prefix shares that prefix's path. Rather than, at query time, walking the entire subtree under a prefix's node to find the most popular completions (slow, and gets slower as the dataset grows), each node **precomputes and caches** its own top-K most popular completions when the trie is built. A query then costs exactly the length of the typed prefix to reach the right node, plus a cache read — no subtree traversal on the hot path at all." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design: build offline, serve from a snapshot",
      summary: "The trie is rebuilt periodically from query logs, not updated live on every single search — that decoupling is what keeps reads fast.",
      concepts: [
        { slug: "autocomplete-offline-build", name: "Offline trie building, decoupled from serving", summary: "A batch job aggregates recent query logs into popularity counts and rebuilds the trie (with cached top-K per node) on a schedule — serving nodes just load the latest built trie into memory and answer reads from it.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Rebuilding the trie's popularity counts on every single search would mean every read also does a write — exactly the kind of coupling that would blow the latency budget. Instead, a batch job periodically (every few minutes to every few hours, depending on how fresh trends need to be) aggregates recent query logs into updated popularity counts, rebuilds the trie with fresh cached top-K lists, and pushes the new trie snapshot out to serving nodes, which load it entirely into memory. Every read is then a pure in-memory lookup against a static structure — no lock contention, no write path to coordinate with.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Autocomplete — offline build, in-memory serve",
            columns: 4,
            rows: 2,
            nodes: [
              { id: "logs", label: "Query logs", detail: "Raw search queries. The popularity signal that decides which completions are worth suggesting comes entirely from here.", icon: "document", col: 0, row: 1 },              { id: "aggregator", label: "Batch aggregator", detail: "A batch job counting query frequency over a recent window. Runs on a schedule, deliberately not on the read path.", icon: "worker", col: 1, row: 1, accent: "amber" },              { id: "builder", label: "Trie builder", detail: "Rebuilds the trie and precomputes each node's top-K completions, so a query never walks a subtree at read time.", icon: "function", col: 2, row: 1, accent: "amber" },              { id: "client", label: "Client", detail: "Fires a request on every keystroke — which is why the budget is ~100ms and why nothing here touches a database.", icon: "client", col: 0, row: 0 },              { id: "servingnode", label: "Serving node", detail: "Holds the entire trie in memory and answers from a static snapshot. No locks, no writes, no contention with the build path.", sublabel: "trie in memory", icon: "service", col: 2, row: 0, accent: "blue" },              { id: "snapshot", label: "Trie snapshot store", detail: "The published trie artifact. Serving nodes load it wholesale; swapping snapshots is how new trends ship.", icon: "blob-storage", col: 3, row: 1, accent: "purple" },            ],
            edges: [
              { id: "e1", from: "logs", to: "aggregator", step: 1, label: "periodic batch job" },
              { id: "e2", from: "aggregator", to: "builder", step: 2, label: "popularity counts" },
              { id: "e3", from: "builder", to: "snapshot", step: 3, label: "publish new trie" },
              { id: "e4", from: "snapshot", to: "servingnode", step: 4, label: "load latest snapshot", route: "vertical-first" },
              { id: "e5", from: "client", to: "servingnode", step: 5, label: "GET /suggestions?prefix=" },
            ],
            steps: [
              { index: 1, caption: "A batch job periodically reads recent query logs.", nodeIds: ["logs", "aggregator"], edgeIds: ["e1"] },
              { index: 2, caption: "It aggregates them into updated popularity counts.", nodeIds: ["aggregator", "builder"], edgeIds: ["e2"] },
              { index: 3, caption: "The builder rebuilds the trie, with each node's top-K cached, and publishes a new snapshot.", nodeIds: ["builder", "snapshot"], edgeIds: ["e3"] },
              { index: 4, caption: "Serving nodes periodically load the latest snapshot fully into memory.", nodeIds: ["snapshot", "servingnode"], edgeIds: ["e4"] },
              { index: 5, caption: "Every autocomplete request is then a pure in-memory lookup, with no live database or write path on the hot path.", nodeIds: ["client", "servingnode"], edgeIds: ["e5"] },
            ],
          },
        },
        {
            type: "quiz",
            question: "Why is each trie node's top-K list precomputed at build time instead of computed per query?",
            options: [
              { id: "a", label: "Precomputing makes the trie smaller in memory" },
              { id: "b", label: "Walking the subtree under a prefix per keystroke would blow the ~100ms budget" },
              { id: "c", label: "Because query popularity never changes" },
              { id: "d", label: "To let the database do the sorting" },
            ],
            correctOptionId: "b",
            explanation: "A short prefix like 'a' sits above an enormous subtree, and scanning it on every keystroke gets slower as the dataset grows. Caching top-K on each node turns the query into a walk of the prefix length plus one read — bounded by how much the user typed, not by how much data you have.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: freshness vs. staleness",
      summary: "A trending query needs to surface faster than a full rebuild cycle allows — a small, fast-updating overlay handles that.",
      concepts: [
        { slug: "autocomplete-trending", name: "A fast-path overlay for trending queries", summary: "The batch-rebuilt trie is intentionally not real-time. A separate, much smaller, frequently-updated structure tracking spiking queries (e.g. breaking news) can be checked alongside the trie and merged into results, without needing the whole trie to rebuild in real time.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "If the trie only rebuilds every few hours, a genuinely breaking search trend won't show up in autocomplete until the next rebuild — potentially hours late, which for something like breaking news is a real product gap. A common fix: keep a small, separate, much more frequently updated (even real-time) structure that tracks queries with a sudden spike in volume, and merge its top results in front of the trie's normal suggestions at read time. This keeps the expensive, batch-built trie doing what it's good at (accurate long-run popularity) while a lightweight fast path handles \"what's spiking right now.\"",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "The trie has to fit in memory on every serving node — that's the real ceiling, not query throughput.",
      concepts: [
        { slug: "autocomplete-memory-limit", name: "The trie's memory footprint", summary: "As the set of distinct queries grows, the trie (plus every node's cached top-K) eventually stops fitting on one machine's memory, forcing either sharding the trie by prefix range, or pruning rare queries out of it.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "A trie over hundreds of millions of distinct historical queries, each node carrying a cached top-K list, can outgrow a single machine's RAM. Two standard fixes: prune the trie to only the queries with meaningful search volume (a long tail of one-off typos and rare phrases contributes almost nothing to suggestion quality but costs real memory), or shard the trie by prefix range (all \"a*\" queries on one set of nodes, all \"b*\" on another) the same way any other dataset gets partitioned once it outgrows one machine.",
        },
      ],
    },
  ],
};

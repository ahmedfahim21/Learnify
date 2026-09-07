import type { SystemDesignProblem } from "../types";

export const newsFeed: SystemDesignProblem = {
  slug: "news-feed",
  title: "News Feed",
  tagline: "Show every user a personalized, reverse-chronological-ish feed of their friends' posts — fast, at any follower count.",
  difficulty: 4,
  estimatedMinutes: 30,
  tags: ["fanout", "caching", "feed-generation"],
  functionalRequirements: [
    "Publish a post that becomes visible in followers' feeds.",
    "Load a user's feed, paginated, ranked by recency (or a ranking model).",
    "Handle both ordinary users (hundreds of followers) and celebrities (tens of millions).",
  ],
  nonFunctionalRequirements: [
    "Feed load latency should feel instant — low hundreds of milliseconds at most.",
    "High availability; a feed that's briefly stale is fine, a feed that errors is not.",
    "Publish-side and read-side both need to scale independently — they have very different traffic shapes.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Two very different operations",
      summary: "Publishing a post and reading a feed are asymmetric in every way that matters — volume, latency tolerance, and who's affected.",
      concepts: [
        { slug: "feed-scope", name: "Publish vs. read asymmetry", summary: "A read (loading your feed) has to be fast for every single request. A write (publishing a post) can afford to do more background work, since it happens far less often per user than reads do.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Feed reads happen constantly — every time any user opens the app. Posts are published far less often per user. That asymmetry means the design should push work toward publish time (precompute what it can) so read time stays cheap — the opposite of a system where writes are rare and reads are rarer still." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers, including the celebrity case",
      summary: "The number that breaks the naive design isn't average followers — it's the maximum.",
      concepts: [
        { slug: "feed-estimation", name: "Average vs. worst-case fan-out", summary: "A typical user might have 200 followers; a celebrity account can have 100 million. Any design that fans out a post to every follower's feed at publish time has to survive that outlier, not just the average.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "If the average user has 200 followers and posts twice a day, that's a modest fan-out load. But a celebrity account with 100 million followers publishing one post means 100 million feed insertions from that single write — several orders of magnitude more than the average case. Designing only for the average and hoping the celebrity case just works is the single most common mistake in this problem." },
        {
            type: "simulator",
            simulatorId: "back-of-envelope",
            title: "Feed reads vs. posts",
            notice: "Feeds are extreme on the read side: people open the app far more often than they post. Push the read:write ratio up and watch peak reads dominate — that asymmetry is the whole argument for precomputing feeds at write time.",
            params: [{ key: "dau", value: 100000000 }, { key: "writesPerUserPerDay", value: 2 }, { key: "readWriteRatio", value: 500 }, { key: "bytesPerWrite", value: 1000 }, { key: "retentionYears", value: 3 }],
          },
        ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Publish a post; fetch a page of feed items.",
      concepts: [
        { slug: "feed-api", name: "publishPost / getFeed", summary: "publishPost(userId, content) triggers fan-out; getFeed(userId, cursor) returns a page of precomputed (or partially precomputed) feed items.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`POST /posts { content }` publishes and kicks off fan-out. `GET /feed?cursor=...` returns the next page of feed items for the current user — ideally a near-instant read against something already computed, not a live query joining \"who do I follow\" against \"what did they post.\"" },
      ],
    },
    {
      phase: "data-model",
      title: "Posts table plus a per-user feed cache",
      summary: "The posts themselves live in one place; each user's feed is a separate, precomputed list of pointers into that store.",
      concepts: [
        { slug: "feed-data-model", name: "Posts store + feed cache", summary: "posts(id, author_id, content, created_at) holds the source of truth. feed_cache(user_id) -> ordered list of post_ids is a per-user, precomputed view — the thing getFeed actually reads.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "Posts are stored once, in a normal write-once table keyed by post id. What makes reads fast is a separate structure — a per-user feed cache, essentially a sorted list of post ids — that's populated ahead of time so a feed read is just \"fetch this list, then batch-fetch the posts it points to,\" not a live fan-in query across everyone you follow." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design: push vs. pull fan-out",
      summary: "Push (fan-out-on-write) precomputes every follower's feed at publish time. Pull (fan-out-on-read) computes a feed live at read time. Most real systems use both.",
      concepts: [
        { slug: "feed-fanout-strategy", name: "Fan-out-on-write vs. fan-out-on-read", summary: "Push work to publish time for most users (fast reads, but a write that touches every follower). Fall back to computing at read time for accounts with huge follower counts (avoids a catastrophic celebrity-post fan-out).", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          heading: "Fan-out-on-write (push)",
          body: "When a user posts, immediately insert that post's id into every follower's feed cache. Reads become trivially fast (just read the precomputed list) — but a celebrity's post means millions of cache writes fired from one publish call, which is exactly the worst-case scenario the estimation chapter flagged.",
        },
        {
          type: "prose",
          heading: "Fan-out-on-read (pull), and the hybrid",
          body: "The alternative: don't precompute anything. At read time, fetch the list of people the user follows and merge their recent posts live. This avoids the celebrity fan-out problem entirely, but makes every single feed read more expensive. The design nearly every real feed system converges on is a hybrid: fan-out-on-write for accounts under some follower threshold (fast reads for the common case), and fan-out-on-read merged in at read time for accounts above it (celebrities) — so one viral post from one celebrity never generates a hundred-million-write storm.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Hybrid fan-out",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "normaluser", label: "Regular user posts", detail: "A typical account with a few hundred followers. Fanning their post out at write time is cheap and makes every follower's read instant.", icon: "user", col: 0, row: 0 },              { id: "celebuser", label: "Celebrity posts", detail: "An account with millions of followers. Push fan-out here would mean millions of cache writes from a single post — the case that breaks the naive design.", icon: "user", col: 0, row: 2, accent: "amber" },              { id: "fanoutworker", label: "Fan-out worker", detail: "Does the push fan-out asynchronously. The post is already stored and visible before this finishes, so the author never waits on it.", icon: "worker", col: 1, row: 0, accent: "blue" },              { id: "feedcache", label: "Per-user feed cache", detail: "One precomputed, ordered list of post ids per user. A feed read is a list fetch plus a batch hydrate — no live fan-in query across everyone you follow.", icon: "cache", col: 3, row: 0, accent: "cyan" },              { id: "postsstore", label: "Posts store", detail: "The write-once source of truth for post content, keyed by post id. Both fan-out paths ultimately point back here.", icon: "database", col: 3, row: 2, accent: "purple" },              { id: "readpath", label: "getFeed()", detail: "Merges the precomputed cache with any followed celebrities' recent posts, ranks the result, and returns a page.", icon: "api", col: 4, row: 1, accent: "green" },              { id: "merge", label: "Merge celeb posts live", detail: "The read-time half of the hybrid. Only runs for the handful of high-follower accounts a user follows, so it stays cheap.", icon: "function", col: 2, row: 2, accent: "amber" },            ],
            edges: [
              { id: "e1", from: "normaluser", to: "fanoutworker", step: 1, label: "< follower threshold" },
              { id: "e2", from: "fanoutworker", to: "feedcache", step: 2, label: "push to followers" },
              { id: "e3", from: "celebuser", to: "postsstore", step: 1, label: "above threshold" },
              { id: "e4", from: "feedcache", to: "readpath", step: 3, label: "precomputed items" },
              { id: "e5", from: "postsstore", to: "merge", step: 3 },
              { id: "e6", from: "merge", to: "readpath", step: 4, label: "merged in at read time" },
            ],
            steps: [
              { index: 1, caption: "A regular user's post triggers push fan-out; a celebrity's post is stored but skips fan-out entirely.", nodeIds: ["normaluser", "fanoutworker", "celebuser", "postsstore"], edgeIds: ["e1", "e3"] },
              { index: 2, caption: "The fan-out worker pushes the regular post into every follower's precomputed feed cache.", nodeIds: ["fanoutworker", "feedcache"], edgeIds: ["e2"] },
              { index: 3, caption: "A feed read pulls the precomputed items, and separately checks for followed celebrities' recent posts.", nodeIds: ["feedcache", "readpath", "postsstore", "merge"], edgeIds: ["e4", "e5"] },
              { index: 4, caption: "The two sources are merged into one ranked feed at read time.", nodeIds: ["merge", "readpath"], edgeIds: ["e6"] },
            ],
          },
        },
        {
            type: "quiz",
            question: "Why do real feed systems skip push fan-out for accounts with tens of millions of followers?",
            options: [
              { id: "a", label: "Their posts are less relevant, so they can be delayed" },
              { id: "b", label: "One post would trigger tens of millions of feed-cache writes" },
              { id: "c", label: "Celebrity accounts post too frequently to keep up" },
              { id: "d", label: "Their followers are usually inactive" },
            ],
            correctOptionId: "b",
            explanation: "Push fan-out trades write cost for read speed, and that trade collapses at the extreme: a single celebrity post becomes a write storm across millions of cache entries. Serving those posts at read time instead keeps the write cheap, at the cost of a small merge on each feed load — which is why production systems run both strategies at once.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: ranking beyond recency",
      summary: "A pure reverse-chronological feed is simple but not what most production feeds actually ship — ranking adds a whole other system.",
      concepts: [
        { slug: "feed-ranking", name: "Ranking as a separate concern from fan-out", summary: "Fan-out solves 'get candidate posts to the user fast.' Ranking (recency, engagement prediction, diversity) is a separate scoring pass applied on top, usually re-ordering a candidate set rather than being baked into the fan-out itself.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Once candidate posts are assembled (via fan-out-on-write, fan-out-on-read, or the hybrid), ranking them is a separate step: a lightweight model scores each candidate on predicted engagement, recency, and diversity (not showing 10 posts from the same person in a row), then the top-scored posts are what actually gets returned. Keeping ranking decoupled from fan-out means the ranking model can be iterated on without touching how posts get delivered to a feed cache in the first place.",
        },
        {
            type: "diagram",
            diagram: {
              title: "Ranking sits on top of fan-out, not inside it",
              columns: 4,
              rows: 2,
              nodes: [
                { id: "cands", label: "Candidate posts", detail: "Whatever fan-out produced — precomputed cache entries plus any followed celebrities' recent posts, merged.", icon: "document", col: 0, row: 0, accent: "blue" },
                { id: "features", label: "Feature lookup", detail: "Author affinity, post age, past engagement. Cheap, cached signals — anything expensive here shows up directly in feed load latency.", icon: "cache", col: 1, row: 0, accent: "cyan" },
                { id: "model", label: "Ranking model", detail: "Scores each candidate on predicted engagement. Kept separate from fan-out so it can be retrained and shipped without touching delivery.", icon: "llm", col: 2, row: 0, accent: "purple" },
                { id: "diversity", label: "Diversity pass", detail: "Stops ten posts from the same author landing in a row. A pure score sort produces feeds people hate.", icon: "function", col: 3, row: 0, accent: "amber" },
                { id: "page", label: "Feed page", detail: "The final ordered slice returned to the client, with a cursor for the next page.", icon: "mobile", col: 3, row: 1, accent: "green" },
              ],
              edges: [
                { id: "r1", from: "cands", to: "features", step: 1 },
                { id: "r2", from: "features", to: "model", step: 2 },
                { id: "r3", from: "model", to: "diversity", step: 3, label: "scored" },
                { id: "r4", from: "diversity", to: "page", step: 4, route: "vertical-first" },
              ],
              steps: [
                { index: 1, caption: "Fan-out hands ranking a candidate set — it never decides ordering itself.", nodeIds: ["cands", "features"], edgeIds: ["r1"] },
                { index: 2, caption: "Cheap cached features are gathered for each candidate.", nodeIds: ["features", "model"], edgeIds: ["r2"] },
                { index: 3, caption: "The model scores them by predicted engagement.", nodeIds: ["model", "diversity"], edgeIds: ["r3"] },
                { index: 4, caption: "A diversity pass reorders before the page is returned.", nodeIds: ["diversity", "page"], edgeIds: ["r4"] },
              ],
            },
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Even with the hybrid split, a celebrity with a threshold-adjacent follower count is a moving target as they grow.",
      concepts: [
        { slug: "feed-threshold-tuning", name: "The follower-count threshold isn't static", summary: "An account that crosses the fan-out threshold needs a migration path — its existing per-follower cache entries have to stop being written to going forward, without a flag day that breaks feeds mid-flight.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "An account growing past the fan-out threshold can't just flip a switch — followers who already have that account's old posts cached expect continuity. In practice this is handled gradually: stop new fan-out writes once the threshold is crossed, let existing cached entries age out naturally, and let the read-time merge path pick up the account's new posts going forward. It's a soft transition, not an atomic one.",
        },
        {
            type: "simulator",
            simulatorId: "queue-backpressure",
            title: "Fan-out worker throughput",
            notice: "One celebrity post is a huge burst of arrivals into the fan-out queue. Because feed writes are async, exceeding capacity doesn't fail the post — it delays how long until followers see it. That delay is the real cost of push fan-out.",
            params: [{ key: "arrivalRate", value: 420 }, { key: "serviceRate", value: 120 }, { key: "workers", value: 4 }],
          },
        ],
    },
  ],
};

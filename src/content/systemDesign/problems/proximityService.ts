import type { SystemDesignProblem } from "../types";

export const proximityService: SystemDesignProblem = {
  slug: "proximity-service",
  title: "Proximity Service",
  tagline: "Find every business, driver, or friend within a few kilometers, fast — the engine behind Yelp and Uber's map view.",
  difficulty: 3,
  estimatedMinutes: 22,
  tags: ["geospatial", "indexing"],
  functionalRequirements: [
    "Given a location and a radius, return nearby points of interest.",
    "Support businesses/entities being added, moved, or removed.",
    "Rank results by distance (and optionally other signals like rating).",
  ],
  nonFunctionalRequirements: [
    "Low latency — this backs an interactive map view, so it needs to feel instant as the user pans/zooms.",
    "High read QPS relative to writes — businesses rarely move; users query constantly.",
    "Good load balance even though real-world points of interest cluster heavily (dense cities vs. sparse rural areas).",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Why not just a SQL range query on lat/lng?",
      summary: "Latitude and longitude are two independent columns; a normal B-tree index can only efficiently range-query one dimension at a time.",
      concepts: [
        { slug: "proximity-scope", name: "The two-dimensional indexing problem", summary: "A standard database index sorts by one key. \"Everything within 2km\" is inherently a two-dimensional range query, which is exactly what a regular index isn't built for — this whole course is about the geospatial indexes that solve it.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "\"Find everything within 2km of (lat, lng)\" sounds like it should be a simple range query, but latitude and longitude indexed as two separate B-tree columns can't answer it efficiently — a database would have to scan a wide latitude band and then filter by longitude (or vice versa), touching far more rows than actually lie within the radius. Geospatial indexes exist specifically to make \"nearby\" a genuinely efficient query, and this course's whole story is which one to pick and why." },
      ],
    },
    {
      phase: "estimation",
      title: "Density is wildly uneven",
      summary: "The real design pressure comes from Manhattan having a thousand times the point-of-interest density of rural Montana.",
      concepts: [
        { slug: "proximity-estimation", name: "Uneven geographic density", summary: "A uniform grid over the earth wastes enormous resolution on empty ocean and rural areas, while being too coarse in dense cities — the indexing scheme needs to adapt to real-world density, not assume it's uniform.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "A fixed-size grid (say, 1km x 1km cells) has to be small enough to be useful in dense Manhattan, but that same cell size wastes enormous index space over open ocean and sparse countryside where almost nothing exists. This tension — needing fine resolution where things are dense and coarse resolution where they're sparse — is exactly what a good geospatial index (like a quadtree or geohash) is built to handle adaptively, rather than a naive fixed grid." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "One read-heavy endpoint: search by location and radius.",
      concepts: [
        { slug: "proximity-api", name: "GET /search?lat=&lng=&radius=", summary: "The dominant operation by far is the nearby-search read. Writes (a business's location changing, or a driver's live position updating) are comparatively rare and handled separately.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`GET /search?lat=&lng=&radius=&limit=20` returns nearby entities sorted by distance. For a live use case like ride-hailing, there's also a high-frequency write path — `POST /location { entityId, lat, lng }` — updating a driver's position every few seconds, which the index needs to absorb without degrading read performance." },
      ],
    },
    {
      phase: "data-model",
      title: "Geohash vs. quadtree",
      summary: "Two standard ways to turn 2D coordinates into something a normal 1D index can handle.",
      concepts: [
        { slug: "proximity-geohash", name: "Geohashing: encoding 2D into a sortable string", summary: "A geohash recursively subdivides the map into a grid and encodes a point's cell as a base32 string, where nearby points usually (not always) share a long common prefix — turning 'nearby' into 'shares a string prefix,' which a normal B-tree index handles well.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "A geohash interleaves bits of latitude and longitude into a single string, where each additional character narrows the location to a smaller rectangular cell. Two points near each other usually — though not always, because of edge effects at cell boundaries — share a long common prefix. This turns \"find nearby points\" into \"find rows whose geohash shares this prefix,\" a query a completely ordinary database index (even a plain B-tree) can answer efficiently, without any custom geospatial index type." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Businesses indexed by geohash prefix; a search expands outward from the query point's own geohash cell.",
      concepts: [
        { slug: "proximity-search-algorithm", name: "Prefix search with neighbor-cell expansion", summary: "A search starts with the query point's own geohash cell, and — because the target radius rarely fits exactly one cell, and boundary effects mean nearby points can fall in an adjacent cell — expands to include neighboring cells until enough results are found.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "To search near a point: compute that point's geohash, query the index for entities sharing a long-enough prefix (giving a first batch of candidates), then — because the geohash-boundary effect means some genuinely nearby points can have a completely different prefix if they happen to fall just across a cell edge — also query the immediately neighboring cells, merge and deduplicate the results, compute exact distance for ranking, and return the closest N. This neighbor-expansion step is what makes geohash search correct despite the boundary edge case.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Proximity search via geohash",
            columns: 4,
            rows: 2,
            nodes: [
              { id: "client", label: "Client app", detail: "A map view that re-queries as the user pans and zooms — which is why this is a high-QPS read path, not an occasional lookup.", icon: "mobile", col: 0, row: 0 },              { id: "api", label: "Search API", detail: "Turns a (lat, lng, radius) into a geohash prefix query, then expands to neighbouring cells to cover the boundary case.", icon: "api", col: 1, row: 0, accent: "blue" },              { id: "geoindex", label: "Geohash index", detail: "Entities indexed by geohash prefix. Because nearby points share a string prefix, an ordinary B-tree answers \"what's near here?\" without a specialised index type.", sublabel: "prefix-sorted", icon: "database", col: 2, row: 0, accent: "purple" },              { id: "rank", label: "Distance ranker", detail: "Computes true distance for each candidate — the geohash gets you a cheap candidate set, not an ordering — and returns the closest N.", icon: "function", col: 3, row: 0, accent: "amber" },            ],
            edges: [
              { id: "e1", from: "client", to: "api", step: 1, label: "lat, lng, radius" },
              { id: "e2", from: "api", to: "geoindex", step: 2, label: "query cell + neighbors" },
              { id: "e3", from: "geoindex", to: "rank", step: 3, label: "candidate entities" },
              { id: "e4", from: "rank", to: "client", step: 4, label: "sorted by exact distance", route: "vertical-first" },
            ],
            steps: [
              { index: 1, caption: "The client sends a location and search radius.", nodeIds: ["client", "api"], edgeIds: ["e1"] },
              { index: 2, caption: "The API computes the query point's geohash and queries that cell plus its neighbors.", nodeIds: ["api", "geoindex"], edgeIds: ["e2"] },
              { index: 3, caption: "The index returns candidate entities from those cells.", nodeIds: ["geoindex", "rank"], edgeIds: ["e3"] },
              { index: 4, caption: "Candidates are ranked by exact computed distance and the top results returned.", nodeIds: ["rank", "client"], edgeIds: ["e4"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: high-frequency location updates",
      summary: "A ride-hailing driver's position updates every few seconds — that write rate needs a different strategy than a static business listing.",
      concepts: [
        { slug: "proximity-live-updates", name: "In-memory index for high-churn entities", summary: "Static businesses can live in a disk-backed geospatial index. Constantly-moving entities (drivers, delivery couriers) are better served from an in-memory structure, since re-indexing on disk every few seconds per entity doesn't scale.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "A restaurant's location changes essentially never; a driver's location changes every few seconds. Re-writing a disk-backed index at that frequency, multiplied across every active driver, is far more write load than a static-entity index was designed for. The standard fix is to keep frequently-moving entities in an in-memory geospatial structure (Redis's built-in geospatial commands are a common choice), accepting that this index is rebuilt or evicted more aggressively, in exchange for being cheap to update on every position ping.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Hot cells (dense city centers) get disproportionate query and write load — the same imbalance problem as a hot key in a cache.",
      concepts: [
        { slug: "proximity-hot-cells", name: "Hot cells in dense areas", summary: "A geohash cell covering downtown Manhattan sees vastly more reads and writes than a cell covering rural farmland. If cells are sharded across nodes, this is the same hot-key/hot-partition problem seen in the Distributed Cache course, just spatial instead of key-based.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "If the index is sharded by geohash prefix, a shard covering a dense downtown area can receive far more traffic than a shard covering sparse countryside — the geospatial equivalent of a hot key. The same mitigations apply: finer-grained sharding in dense regions (variable-precision geohashes, giving denser areas more, smaller cells and sparse areas fewer, larger ones), and extra replication for hot shards so their read load spreads across more machines.",
        },
      ],
    },
  ],
};

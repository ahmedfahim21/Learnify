import type { SystemDesignProblem } from "../types";

export const uniqueIdGenerator: SystemDesignProblem = {
  slug: "unique-id-generator",
  title: "Unique ID Generator",
  tagline: "Hand out globally unique, roughly time-ordered ids from many machines at once — no coordination per id.",
  difficulty: 2,
  estimatedMinutes: 18,
  tags: ["id-generation", "distributed-systems"],
  functionalRequirements: [
    "Generate a unique 64-bit id on every call, with no two callers ever colliding.",
    "Ids should be roughly sortable by creation time.",
    "Must work with many generator instances running concurrently, with no shared lock.",
  ],
  nonFunctionalRequirements: [
    "Generation must be fast — this sits on the hot path of every write in whatever system uses it.",
    "No single point of failure or coordination bottleneck.",
    "Ids should fit in 64 bits so they're cheap to index and compare.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Why not just UUID?",
      summary: "A UUID solves uniqueness but gives up ordering — and a database auto-increment solves ordering but doesn't scale past one writer.",
      concepts: [
        { slug: "idgen-scope", name: "The uniqueness-and-order requirement", summary: "The interesting version of this problem needs BOTH global uniqueness AND rough time-ordering — random UUIDs get the first for free but fail the second.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A random 128-bit UUID is trivially globally unique, but it's not sortable by creation time — inserting UUID-keyed rows into a B-tree index causes random-order inserts, which is much slower than appending to the end. A database auto-increment column gives perfect ordering, but only one machine can safely hand out the next value. The interesting design problem is getting both properties — uniqueness across many machines, AND rough chronological order — at once." },
      ],
    },
    {
      phase: "estimation",
      title: "How many ids, how fast",
      summary: "The generation rate that any workable scheme has to sustain.",
      concepts: [
        { slug: "idgen-estimation", name: "Estimating generation rate", summary: "At high write volume, a generator has to produce ids fast enough that it's never the bottleneck relative to the write itself.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A system doing 50,000 writes/sec needs 50,000 ids/sec at minimum, with bursts several times that. A scheme requiring a network round-trip per id (e.g. asking a central service for the next value) adds that round-trip's latency to every single write in the system — which is why the best schemes generate ids **locally**, with zero network calls per id." },
      ],
    },
    {
      phase: "api",
      title: "The interface",
      summary: "One function call, no arguments, no network round-trip.",
      concepts: [
        { slug: "idgen-api", name: "generateId()", summary: "The ideal API is a pure, local function call — everything needed to guarantee uniqueness is already known to the generator instance without asking anyone else.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`generateId(): int64` — no parameters, no network call. Every property that makes an id unique and ordered has to be derivable from information the generating machine already has: the current time, and something that distinguishes this machine from every other machine running the same generator." },
        {
            type: "simulator",
            simulatorId: "latency-numbers",
            title: "Why generateId() can't make a network call",
            notice: "Compare a main-memory reference against a round trip within the same datacenter, then against a cross-region one. Asking a central service for the next id puts one of those on every single write in the system.",
            params: [{ key: "budgetMs", value: 10 }],
          },
        ],
    },
    {
      phase: "data-model",
      title: "The bit layout",
      summary: "This 'data model' is literally how 64 bits get carved up.",
      concepts: [
        { slug: "idgen-bit-layout", name: "Timestamp + machine id + sequence", summary: "Reserve the high bits for a timestamp (giving order), the middle bits for a machine id (giving uniqueness across machines), and the low bits for a per-millisecond sequence counter (giving uniqueness within one machine in one millisecond).", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "The Snowflake-style layout that answers both requirements: 1 unused sign bit, 41 bits of milliseconds since a custom epoch (good for ~69 years), 10 bits of machine/datacenter id (1,024 distinct machines), and 12 bits of per-millisecond sequence number (4,096 ids per machine per millisecond before it has to wait for the next millisecond). Sorting by the raw integer sorts by time first, which is the ordering property a random UUID can't give you." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Every generator instance is independent — no shared state, no coordination, no single point of failure.",
      concepts: [
        { slug: "idgen-independence", name: "No coordination between generators", summary: "Because each machine's id space is carved out by its unique machine id bits, no two generator instances can ever produce the same id — even without ever communicating with each other.", difficulty: 2 },
      ],
      blocks: [
        {
          type: "prose",
          body: "This is what makes the design elegant: uniqueness is structural, not coordinated. Machine 5 and machine 12 can generate ids simultaneously, at the same millisecond, with the same sequence number, and still never collide — because the machine-id bits differ. There's no lock, no central authority, no network call. The only operational requirement is making sure each machine actually gets a distinct machine id (typically assigned at startup from a small coordination service like Zookeeper, or statically from configuration).",
        },
        {
          type: "diagram",
          diagram: {
            title: "Independent Snowflake-style generators",
            columns: 3,
            rows: 3,
            nodes: [
              { id: "svc", label: "Write service", detail: "Any service that needs an id before it can write a row. It calls generateId() as a local function — no network hop, which is the entire point.", icon: "service", col: 0, row: 1 },              { id: "gen1", label: "Generator (machine 5)", detail: "Machine 5's generator. Its machine-id bits are baked into every id it produces, so it can never collide with any other machine.", icon: "worker", col: 1, row: 0, accent: "blue" },              { id: "gen2", label: "Generator (machine 12)", detail: "Machine 12's generator, running at the same instant. It has never spoken to machine 5 and never needs to.", icon: "worker", col: 1, row: 2, accent: "green" },              { id: "id1", label: "id: [ts|5|seq]", detail: "Timestamp in the high bits (so ids sort by time), machine id in the middle, per-millisecond sequence in the low bits.", icon: "generic", col: 2, row: 0, shape: "pill", accent: "blue" },              { id: "id2", label: "id: [ts|12|seq]", detail: "Same timestamp, same sequence number — different machine-id bits. That single difference is what makes collision structurally impossible.", icon: "generic", col: 2, row: 2, shape: "pill", accent: "green" },            ],
            edges: [
              { id: "e1", from: "svc", to: "gen1", step: 1, label: "generateId()" },
              { id: "e2", from: "gen1", to: "id1", step: 2 },
              { id: "e3", from: "svc", to: "gen2", step: 1, label: "same millisecond" },
              { id: "e4", from: "gen2", to: "id2", step: 2 },
            ],
            steps: [
              { index: 1, caption: "Two write-service instances call generateId() in the same millisecond — one against each generator.", nodeIds: ["svc", "gen1", "gen2"], edgeIds: ["e1", "e3"] },
              { index: 2, caption: "Each returns an id built from the same timestamp but a different machine id — no collision is possible, with zero coordination.", nodeIds: ["gen1", "gen2", "id1", "id2"], edgeIds: ["e2", "e4"] },
            ],
          },
        },
        {
            type: "quiz",
            question: "Two Snowflake-style generators produce an id in the same millisecond with the same sequence number. What stops them colliding?",
            options: [
              { id: "a", label: "They coordinate through a shared lock before issuing" },
              { id: "b", label: "Their machine-id bits differ, so the full ids differ" },
              { id: "c", label: "A retry, once the collision is detected" },
              { id: "d", label: "Nothing — collisions are possible but rare" },
            ],
            correctOptionId: "b",
            explanation: "Uniqueness here is structural, not coordinated. The machine-id bits partition the id space so two machines simply cannot mint the same value — which is what lets each generator run as a purely local function call, with no lock and no network hop on the write path.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: clock skew and rollback",
      summary: "The timestamp bits assume the system clock only moves forward — NTP adjustments can violate that.",
      concepts: [
        { slug: "idgen-clock-skew", name: "Handling clock drift", summary: "If a machine's clock is corrected backward (e.g. by NTP), a naive generator could reissue a timestamp — and therefore potentially an id — it already used. The generator has to detect and refuse to generate during a clock rollback.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "The entire scheme assumes `now()` only moves forward. In practice, NTP clock synchronization can occasionally step a system clock backward by milliseconds. A robust generator tracks the last timestamp it used and, if the current time is ever less than that, refuses to generate (or briefly blocks) until real time catches back up — a small, deliberate unavailability window that's far preferable to silently reissuing an id.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "The per-millisecond sequence counter caps throughput per machine — the only real ceiling in this design.",
      concepts: [
        { slug: "idgen-scaling", name: "Scaling past the per-machine ceiling", summary: "4,096 ids/ms/machine (with the 12-bit layout) is the hard ceiling per generator instance. Scaling further means adding more machines — which the design already supports for free.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "With a 12-bit sequence, one machine tops out at 4,096 ids in a single millisecond (about 4 million/sec) before it has to wait for the clock to advance. That's already enormous for most workloads, but if it's ever not enough, the fix is exactly the one this design was built for: add another machine. Unlike a central counter service, there's no coordination cost to scaling out — just assign the new machine an unused machine id.",
        },
      ],
    },
  ],
};

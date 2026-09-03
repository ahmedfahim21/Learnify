import type { SystemDesignProblem } from "../types";

export const fileStorage: SystemDesignProblem = {
  slug: "file-storage",
  title: "File Storage & Sync",
  tagline: "Build the object storage and sync engine behind Dropbox and Google Drive — durable, versioned, and cheap.",
  difficulty: 4,
  estimatedMinutes: 28,
  tags: ["storage", "sync", "durability"],
  functionalRequirements: [
    "Upload and download files of arbitrary size, from multiple devices per user.",
    "Sync a change on one device to every other device the user owns.",
    "Keep version history and support restoring an earlier version.",
  ],
  nonFunctionalRequirements: [
    "Extremely high durability — losing a user's file is close to the worst possible failure.",
    "Bandwidth efficiency — don't re-upload a whole file for a one-line text edit.",
    "Storage cost efficiency at petabyte scale (deduplication, cold storage tiers).",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Storage vs. sync are two different problems",
      summary: "Durably storing bytes and propagating a change across a user's devices are separate concerns that happen to live in the same product.",
      concepts: [
        { slug: "filestore-scope", name: "Storage and sync as separate layers", summary: "The durable object store (what holds the bytes, forever, safely) and the sync protocol (what tells other devices something changed) are logically independent — conflating them makes both harder to reason about.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "It's tempting to think of this as one problem, but it cleanly splits into two: a durable object storage layer (get/put arbitrary bytes, never lose them) that would work fine even for a single-device use case, and a sync layer on top that detects changes and propagates them to every other device the user owns. Keeping these conceptually separate — even if some infrastructure is shared — makes each easier to design and reason about independently." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers",
      summary: "Total bytes stored, at this kind of product, dwarfs almost every other system in this course.",
      concepts: [
        { slug: "filestore-estimation", name: "Estimating storage footprint", summary: "At hundreds of millions of users with even modest average storage per user, total bytes reach exabyte scale — squarely the regime object storage systems like S3 are built for.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "500 million users averaging 2 GB of stored data each is already 1 exabyte (1 million TB) of raw storage, before accounting for version history or replication overhead. At this scale, the storage layer isn't a database with a blob column — it's a purpose-built distributed object store, the same category of system as Amazon S3, designed from the ground up around exactly this scale." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Chunked upload/download, plus a change-feed endpoint that drives sync.",
      concepts: [
        { slug: "filestore-api", name: "Chunked transfer + change feed", summary: "Large files are uploaded and downloaded in chunks (resumable, and the unit deduplication operates on). A separate change-feed endpoint is what devices poll or subscribe to for sync events.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "`PUT /files/{path}` (chunked, resumable — a dropped connection mid-upload of a 2GB file shouldn't mean starting over) and `GET /files/{path}` for the storage layer. `GET /changes?since=cursor` is what a device's sync client polls (or subscribes to via a push channel) to learn what changed elsewhere since it last checked." },
      ],
    },
    {
      phase: "data-model",
      title: "Content-addressed chunks",
      summary: "Files are split into chunks, each stored once and referenced by a hash of its content — the basis of both dedup and efficient sync.",
      concepts: [
        { slug: "filestore-chunking", name: "Content-addressed storage", summary: "Splitting a file into content-hashed chunks means two users with the same file (or one user's file before and after a small edit) share almost all of their chunks — storage is deduplicated automatically, and syncing an edit only needs to transfer the changed chunks.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "Rather than storing each file as one indivisible blob, files are split into content-defined chunks (e.g. ~4MB), and each chunk is stored keyed by a hash of its own content. `files(path, chunk_hashes[])` then just lists which chunks compose a given file version. Two files with identical content — or the same file before and after a small edit — end up sharing almost all their chunk hashes, which gives you deduplication and efficient delta sync essentially for free from one data-modeling decision." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Chunked upload to durable, replicated storage; a metadata service tracks which chunks compose which file version, and a change feed drives other devices.",
      concepts: [
        { slug: "filestore-durability", name: "Durability via replication and erasure coding", summary: "Chunks are replicated across multiple machines, racks, and often data centers — with erasure coding (storing parity chunks that let you reconstruct a lost original) as a storage-cost-efficient alternative to full replication at massive scale.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "File storage & sync",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "deviceA", label: "Device A", detail: "Where the edit happened. It chunks the file locally and only uploads chunks the server says it doesn't already have.", icon: "client", col: 0, row: 0 },              { id: "syncsvc", label: "Sync service", detail: "Coordinates uploads and publishes change events. The seam between the storage layer and the sync layer.", icon: "api", col: 1, row: 0, accent: "blue" },              { id: "chunker", label: "Chunker + dedup", detail: "Splits files into content-hashed chunks. Two identical files — or one file before and after a small edit — share nearly all chunk hashes, giving dedup and delta sync from one decision.", icon: "function", col: 2, row: 0, accent: "amber" },              { id: "metadata", label: "Metadata store", detail: "Maps a file version to its ordered list of chunk hashes. Small, transactional, and the thing version history is built on.", sublabel: "path -> chunk hashes", icon: "database", col: 3, row: 0, accent: "purple" },              { id: "objectstore", label: "Object storage", detail: "Immutable content-addressed chunks, replicated (or erasure-coded) across machines and racks. Losing a user's file is the worst failure this system can have.", sublabel: "replicated chunks", icon: "blob-storage", col: 4, row: 0, accent: "green" },              { id: "changefeed", label: "Change feed", detail: "The stream other devices subscribe to. Turns \"a file changed\" into a push rather than every device polling.", icon: "stream", col: 3, row: 2, accent: "cyan" },              { id: "deviceB", label: "Device B", detail: "Pulls only the chunks it's missing. A one-line edit to a 2GB file transfers one chunk, not 2GB.", icon: "client", col: 0, row: 2 },            ],
            edges: [
              { id: "e1", from: "deviceA", to: "syncsvc", step: 1, label: "upload changed file" },
              { id: "e2", from: "syncsvc", to: "chunker", step: 2 },
              { id: "e3", from: "chunker", to: "objectstore", step: 3, label: "only new chunks" },
              { id: "e4", from: "chunker", to: "metadata", step: 4, label: "update chunk list for this version" },
              { id: "e5", from: "metadata", to: "changefeed", step: 5 },
              { id: "e6", from: "changefeed", to: "deviceB", step: 6, label: "notify: file changed" },
            ],
            steps: [
              { index: 1, caption: "Device A uploads a changed file.", nodeIds: ["deviceA", "syncsvc"], edgeIds: ["e1"] },
              { index: 2, caption: "The sync service hands it to the chunker.", nodeIds: ["syncsvc", "chunker"], edgeIds: ["e2"] },
              { index: 3, caption: "Only chunks not already stored (by content hash) are written to object storage.", nodeIds: ["chunker", "objectstore"], edgeIds: ["e3"] },
              { index: 4, caption: "The metadata store records this file version's full chunk list.", nodeIds: ["chunker", "metadata"], edgeIds: ["e4"] },
              { index: 5, caption: "The change is published to the change feed.", nodeIds: ["metadata", "changefeed"], edgeIds: ["e5"] },
              { index: 6, caption: "Device B, subscribed to the feed, is notified and pulls just the new chunks.", nodeIds: ["changefeed", "deviceB"], edgeIds: ["e6"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: sync conflicts",
      summary: "Two devices editing the same file offline, then reconnecting, is the hard case every sync product has to handle explicitly.",
      concepts: [
        { slug: "filestore-conflict-resolution", name: "Detecting and resolving sync conflicts", summary: "A version vector (per-device edit counters, similar in spirit to a key-value store's vector clock) detects when two edits are genuinely concurrent rather than sequential — genuine conflicts get surfaced to the user as two files, rather than silently discarding one edit.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "If Device A and Device B both edit the same file while offline, then both reconnect, the system needs to detect that these are conflicting edits rather than silently letting whichever sync arrives second overwrite the first (silently losing a user's work). A version vector — tracking, per device, which version each device last knew about — can detect true concurrency the same way a key-value store's vector clock does (see the Key-Value Store course). The practical resolution most products ship: keep both versions as separate files (\"file (Bob's conflicted copy).txt\") rather than trying to auto-merge arbitrary binary content.",
        },
        {
          type: "callout",
          tone: "tradeoff",
          body: "Auto-merging text files (like Git does) is possible but adds real complexity and only works for text. For arbitrary file types, surfacing the conflict to the user as two files is a simpler, safer default — never silently lose data.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Storage cost, not throughput, is usually the binding constraint at this scale — which is why cold-storage tiers exist.",
      concepts: [
        { slug: "filestore-cold-storage", name: "Tiered storage by access frequency", summary: "Most stored files are almost never accessed after the first few days. Moving cold (rarely accessed) chunks to cheaper, higher-latency storage tiers dramatically cuts cost without materially hurting the experience for the tiny fraction of files anyone actually re-opens.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "At exabyte scale, storage cost dominates the economics of the whole system, and access patterns are heavily skewed: most files are uploaded once and rarely, if ever, opened again. Moving chunks that haven't been accessed in, say, 90 days to a cheaper cold-storage tier (higher retrieval latency, much lower cost per GB) can cut overall storage cost dramatically, since it's applied to the vast majority of stored bytes, while barely affecting the small fraction of actively-used files that stay in the hot tier.",
        },
        {
            type: "simulator",
            simulatorId: "cache-hit-ratio",
            title: "Hot tier vs. cold tier",
            notice: "Treat the hot tier as the cache and cold storage as the origin. Because most stored bytes are almost never read again, even a low hit ratio on *requests* still lets the overwhelming majority of *bytes* live in the cheap tier.",
            params: [{ key: "hitRatio", value: 0.92 }, { key: "qps", value: 5000 }, { key: "originLatencyMs", value: 250 }],
          },
        ],
    },
  ],
};

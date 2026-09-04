import type { SystemDesignProblem } from "../types";

export const videoStreaming: SystemDesignProblem = {
  slug: "video-streaming",
  title: "Video Streaming Platform",
  tagline: "Serve smooth video to any device on any connection, worldwide — the design behind YouTube-scale streaming.",
  difficulty: 4,
  estimatedMinutes: 28,
  tags: ["cdn", "encoding", "streaming"],
  functionalRequirements: [
    "Upload a video; it becomes streamable shortly after.",
    "Stream video that adapts quality to the viewer's bandwidth in real time.",
    "Serve viewers worldwide with low startup latency and no buffering under normal conditions.",
  ],
  nonFunctionalRequirements: [
    "Massive read (viewing) volume vastly exceeding write (upload) volume.",
    "Resilience to bandwidth fluctuation mid-playback — quality should adapt, not stall.",
    "Storage and bandwidth costs at this scale are a first-class design constraint, not an afterthought.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Upload once, stream in every quality, everywhere",
      summary: "One uploaded file needs to become many different encoded versions, delivered from servers physically close to each viewer.",
      concepts: [
        { slug: "video-scope", name: "One upload, many playback contexts", summary: "A single uploaded video needs to play smoothly on a phone on 3G and a TV on gigabit fiber, from viewers on every continent — which means transcoding into multiple qualities and serving from geographically distributed edges, not just storing and re-serving the original file.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "The raw uploaded file is almost never what gets streamed. It has to become several different encoded versions (resolutions and bitrates) so playback can adapt to whatever bandwidth a given viewer actually has at a given moment, and it has to be served from locations physically close to viewers worldwide, since video is enormously bandwidth-heavy and a single origin server on one continent would be both slow and prohibitively expensive to serve globally from." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers",
      summary: "Bandwidth, not storage, is usually the dominant cost at this scale.",
      concepts: [
        { slug: "video-estimation", name: "Bandwidth as the dominant cost", summary: "Storage is a one-time cost per video; every single view re-consumes bandwidth. At high view counts, bandwidth cost dwarfs storage cost — which is exactly the case a CDN is built to address.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A single 10-minute video encoded at a modest average of 5 Mbps is roughly 375 MB total across all its bitrate variants. Stored once, that's a one-time cost. But if it's viewed a million times, that's potentially 375 TB of bandwidth served — a thousand times the storage cost. This is the number that makes a CDN (caching content at edge locations close to viewers, rather than serving every view from a central origin) close to mandatory at any real scale." },
        {
            type: "simulator",
            simulatorId: "back-of-envelope",
            title: "Where the cost actually is",
            notice: "Set bytes-per-write high (a video is enormous) and writes-per-user low. Storage is a one-time cost per upload; it's the read side, multiplied by every view, that turns into the bandwidth bill a CDN exists to absorb.",
            params: [{ key: "dau", value: 2000000 }, { key: "writesPerUserPerDay", value: 1 }, { key: "readWriteRatio", value: 200 }, { key: "bytesPerWrite", value: 500000 }, { key: "retentionYears", value: 5 }],
          },
        ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Upload returns immediately; a separate status check reflects the async transcoding pipeline.",
      concepts: [
        { slug: "video-api", name: "Async upload, poll for ready", summary: "Upload can't be synchronous with transcoding — that would mean the uploader waits minutes for a response. The upload call returns immediately with a video id; a status endpoint reflects when transcoding finishes and playback becomes available.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`POST /videos` accepts the raw file (often via a pre-signed direct-to-storage upload, to avoid routing large files through the application server), returns `{ videoId, status: \"processing\" }` immediately, and transcoding happens asynchronously. `GET /videos/{id}` reflects current status and, once ready, returns the manifest URL the player needs to start adaptive playback." },
      ],
    },
    {
      phase: "data-model",
      title: "Videos, renditions, and manifests",
      summary: "One logical video maps to many physical encoded files (renditions), described by a manifest the player reads.",
      concepts: [
        { slug: "video-renditions", name: "Renditions and the playback manifest", summary: "A single video becomes several encoded renditions (e.g. 360p/720p/1080p at different bitrates), each split into small chunks, described by a manifest file that lists every rendition and chunk so the player can switch between them mid-playback.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "`videos(id, title, status, duration)` is the logical record. `renditions(video_id, resolution, bitrate, storage_url)` tracks each encoded variant, itself split into a few seconds of playable chunks (this is what makes adaptive streaming possible — the player can switch renditions between chunks without restarting). A manifest (HLS `.m3u8` or DASH `.mpd`) lists all of this so the player's logic, not the server's, decides which rendition to fetch next based on measured bandwidth." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Upload triggers an async transcoding pipeline; playback is served almost entirely from CDN edge caches, not origin.",
      concepts: [
        { slug: "video-cdn", name: "CDN-first playback serving", summary: "Once transcoded, video chunks are pushed to (or pulled into) CDN edge locations. The overwhelming majority of playback requests are served from an edge cache near the viewer and never reach origin storage at all.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "Video streaming — upload and playback paths",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "uploader", label: "Uploader", detail: "A creator pushing a raw file, often multi-gigabyte. Usually uploads directly to storage via a pre-signed URL rather than through the app server.", icon: "user", col: 0, row: 0 },              { id: "uploadsvc", label: "Upload service", detail: "Accepts the upload and returns immediately with a video id and \"processing\" — it never waits for transcoding.", icon: "api", col: 1, row: 0, accent: "blue" },              { id: "rawstore", label: "Raw storage", detail: "Holds the original file. Kept so renditions can be regenerated if encoding settings change later.", icon: "blob-storage", col: 2, row: 0, accent: "purple" },              { id: "transcoder", label: "Transcoding pipeline", detail: "A horizontally-scaled worker pool producing every bitrate rendition. CPU-bound, and the first thing to fall behind under upload bursts.", icon: "worker", col: 3, row: 0, accent: "amber" },              { id: "renditionstore", label: "Rendition storage", detail: "The encoded chunks and the manifest listing them — what the player actually reads.", icon: "blob-storage", col: 4, row: 0, accent: "purple" },              { id: "cdn", label: "CDN edge", detail: "Edge caches near the viewer. Because bandwidth dwarfs storage at this scale, keeping views off origin is the single biggest cost lever in the design.", icon: "cdn", col: 3, row: 2, accent: "green" },              { id: "viewer", label: "Viewer", detail: "The player decides which rendition to fetch next based on its own measured throughput — adaptive bitrate is a client-side decision.", icon: "mobile", col: 4, row: 2 },            ],
            edges: [
              { id: "e1", from: "uploader", to: "uploadsvc", step: 1 },
              { id: "e2", from: "uploadsvc", to: "rawstore", step: 2 },
              { id: "e3", from: "rawstore", to: "transcoder", step: 3, label: "async job" },
              { id: "e4", from: "transcoder", to: "renditionstore", step: 4, label: "encoded chunks + manifest" },
              { id: "e5", from: "renditionstore", to: "cdn", step: 5, label: "pulled into edge on first request" },
              { id: "e6", from: "viewer", to: "cdn", step: 6, label: "adaptive playback requests" },
            ],
            steps: [
              { index: 1, caption: "A creator uploads a video.", nodeIds: ["uploader", "uploadsvc"], edgeIds: ["e1"] },
              { index: 2, caption: "The raw file lands in origin storage.", nodeIds: ["uploadsvc", "rawstore"], edgeIds: ["e2"] },
              { index: 3, caption: "An async pipeline picks it up for transcoding.", nodeIds: ["rawstore", "transcoder"], edgeIds: ["e3"] },
              { index: 4, caption: "Multiple bitrate renditions and a manifest are produced.", nodeIds: ["transcoder", "renditionstore"], edgeIds: ["e4"] },
              { index: 5, caption: "CDN edges pull rendition chunks in on first request from that region.", nodeIds: ["renditionstore", "cdn"], edgeIds: ["e5"] },
              { index: 6, caption: "Nearly all playback is then served from the nearby edge — origin is rarely touched again.", nodeIds: ["viewer", "cdn"], edgeIds: ["e6"] },
            ],
          },
        },
        {
          type: "simulator",
          simulatorId: "cache-hit-ratio",
          notice: "Treat the CDN edge as the 'cache' and origin storage as the 'origin' — even a modest hit ratio removes the overwhelming majority of bandwidth cost from origin.",
          params: [{ key: "hitRatio", value: 0.95 }, { key: "qps", value: 50000 }, { key: "originLatencyMs", value: 120 }],
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: adaptive bitrate streaming",
      summary: "The player, not the server, decides which quality to fetch next — based on its own measured download speed.",
      concepts: [
        { slug: "video-adaptive-bitrate", name: "Client-driven adaptive bitrate", summary: "The player measures its own recent download throughput and picks the highest rendition it can sustain without buffering, chunk by chunk — the server's only job is to have every rendition available to switch to.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Adaptive bitrate streaming puts the decision entirely on the client: after downloading each few-second chunk, the player measures how long that download took relative to the chunk's playback duration, estimates current bandwidth, and picks the highest-quality rendition it believes it can sustain for the *next* chunk without the buffer running dry. A sudden drop in bandwidth (walking out of WiFi range) shows up as a slower recent chunk download, and the player drops to a lower rendition for the next chunk — no server round-trip or renegotiation needed, since every rendition's chunks are already sitting on the CDN edge.",
        },
        {
            type: "diagram",
            diagram: {
              title: "Adaptive bitrate is a client-side decision",
              columns: 4,
              rows: 3,
              nodes: [
                { id: "p", label: "Player", detail: "Measures how long each chunk took to download relative to its playback duration. That ratio is its bandwidth estimate.", icon: "mobile", col: 0, row: 1, accent: "blue" },
                { id: "manifest", label: "Manifest", detail: "Lists every rendition and every chunk. The player reads it once and then needs no further negotiation to switch quality.", icon: "document", col: 1, row: 1, accent: "cyan" },
                { id: "hi", label: "1080p chunks", detail: "Chosen while measured bandwidth comfortably exceeds this rendition's bitrate.", icon: "blob-storage", col: 3, row: 0, accent: "green" },
                { id: "mid", label: "720p chunks", detail: "The fallback as throughput dips — swapped in between chunks, with no visible interruption.", icon: "blob-storage", col: 3, row: 1, accent: "amber" },
                { id: "low", label: "360p chunks", detail: "Chosen over stalling. A lower-resolution picture beats a spinning buffer every time.", icon: "blob-storage", col: 3, row: 2, accent: "rose" },
                { id: "edge", label: "CDN edge", detail: "Holds every rendition already, which is what lets the switch happen with no round trip back to origin.", icon: "cdn", col: 2, row: 1, accent: "green" },
              ],
              edges: [
                { id: "b1", from: "p", to: "manifest", step: 1, label: "read once" },
                { id: "b2", from: "manifest", to: "edge", step: 2 },
                { id: "b3", from: "edge", to: "hi", step: 3, label: "bandwidth high" },
                { id: "b4", from: "edge", to: "mid", step: 4, label: "bandwidth drops" },
                { id: "b5", from: "edge", to: "low", step: 5, label: "drops further" },
              ],
              steps: [
                { index: 1, caption: "The player reads the manifest once: every rendition, every chunk.", nodeIds: ["p", "manifest"], edgeIds: ["b1"] },
                { index: 2, caption: "It fetches chunks from the nearest CDN edge, which already holds all renditions.", nodeIds: ["manifest", "edge"], edgeIds: ["b2"] },
                { index: 3, caption: "With bandwidth to spare it takes the highest rendition it can sustain.", nodeIds: ["edge", "hi"], edgeIds: ["b3"] },
                { index: 4, caption: "Throughput dips — it steps down for the *next* chunk. No renegotiation, no stall.", nodeIds: ["edge", "mid"], edgeIds: ["b4"] },
                { index: 5, caption: "Falling further, it keeps stepping down. Degrading quality always beats an empty buffer.", nodeIds: ["edge", "low"], edgeIds: ["b5"] },
              ],
            },
          },
          {
            type: "quiz",
            question: "During adaptive bitrate playback, who decides which quality to fetch next?",
            options: [
              { id: "a", label: "The server, based on the viewer's connection type" },
              { id: "b", label: "The CDN edge, based on regional congestion" },
              { id: "c", label: "The player, from its own measured download throughput" },
              { id: "d", label: "It is fixed when playback starts" },
            ],
            correctOptionId: "c",
            explanation: "The player times each chunk's download against its playback duration to estimate bandwidth, then picks the highest rendition it can sustain for the next chunk. Because every rendition already sits on the edge, switching needs no renegotiation — which is what makes the adaptation seamless mid-playback.",
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "The transcoding pipeline, not playback, is usually the first thing to fall behind at scale.",
      concepts: [
        { slug: "video-transcoding-scale", name: "Transcoding is the write-side bottleneck", summary: "Transcoding is CPU-intensive and can take longer than the video's own runtime; at high upload volume it needs its own horizontally-scaled worker pool, decoupled entirely from the playback path.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Transcoding a video into multiple renditions is computationally expensive — a naive single-threaded encode can take longer than the video itself runs. At high upload volume, this needs a horizontally-scaled pool of transcoding workers pulling jobs off a queue (structurally similar to the Distributed Message Queue course's consumer pattern), so a burst of uploads becomes a longer processing queue rather than a bottleneck that blocks new uploads from being accepted.",
        },
      ],
    },
  ],
};

import type { SystemDesignProblem } from "../types";

export const metricsMonitoring: SystemDesignProblem = {
  slug: "metrics-monitoring",
  title: "Metrics Monitoring & Alerting",
  tagline: "Collect millions of time-series data points a second, and page someone within seconds when a threshold breaks.",
  difficulty: 3,
  estimatedMinutes: 24,
  tags: ["observability", "time-series", "alerting"],
  functionalRequirements: [
    "Collect numeric metrics (CPU usage, request latency, error rate) from thousands of hosts continuously.",
    "Query and chart a metric over an arbitrary time range.",
    "Alert (page/notify) when a metric crosses a configured threshold.",
  ],
  nonFunctionalRequirements: [
    "High write throughput — every host, every service, reporting every few seconds.",
    "Alerting latency matters enormously — a 10-minute delay detecting an outage is a real incident, not a minor bug.",
    "Old data can be aggregated/downsampled; recent data needs fine granularity.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Write-heavy, time-ordered, rarely updated",
      summary: "Metrics data has a distinctive shape: enormous write volume, always appending, almost never updating a past value.",
      concepts: [
        { slug: "metrics-scope", name: "The time-series access pattern", summary: "Metrics are written once (a new data point every few seconds) and read as a range (a chart over the last hour). This shape — high write volume, append-only, range-queried — is exactly what a time-series database is optimized for, unlike a general-purpose relational store.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A metric like \"CPU usage on host X\" produces a new, immutable data point every few seconds, forever, and is almost always queried as a range (\"show me the last hour\") rather than a point lookup. That access pattern — extremely high write volume, strictly append-only, always range-queried by time — is different enough from a typical database workload that purpose-built time-series databases exist specifically to optimize for it, with storage layouts built around exactly this shape." },
      ],
    },
    {
      phase: "estimation",
      title: "Write volume at fleet scale",
      summary: "Multiply hosts by metrics-per-host by reporting frequency — the number gets large fast.",
      concepts: [
        { slug: "metrics-estimation", name: "Estimating ingestion volume", summary: "10,000 hosts, 100 metrics each, reported every 10 seconds, is already a million data points every 10 seconds — 100,000 writes/sec sustained, from monitoring alone.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "10,000 hosts, each emitting 100 distinct metrics (CPU, memory, disk, per-endpoint latency, ...) every 10 seconds, is 1,000,000 data points every 10 seconds — 100,000 writes/sec sustained, and that's before any burst from an incident (when metrics often get *more* frequent, exactly when the system is under the most stress)." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "A push or pull collection path, and a separate query API for charts and alert evaluation.",
      concepts: [
        { slug: "metrics-api", name: "Collection API + query API", summary: "Metrics arrive via a lightweight collection endpoint (or are scraped, pull-style, from each host). A separate query API answers range queries for dashboards and for the alerting engine's own periodic checks.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`POST /metrics { host, name, value, timestamp }` (or a batched variant) is the write path — often implemented as a lightweight agent on each host pushing every few seconds, though a \"pull\" model (a central collector scraping each host's `/metrics` endpoint, as Prometheus does) is just as common. `GET /query?metric=&from=&to=&aggregation=` is the read path, used both by dashboards and by the alerting engine evaluating rules." },
      ],
    },
    {
      phase: "data-model",
      title: "The time-series model",
      summary: "Each point is (metric name, tags, timestamp, value) — sharded and stored so a time-range query for one metric is cheap.",
      concepts: [
        { slug: "metrics-data-model", name: "Metric name + tags + timestamp + value", summary: "A data point is identified by its metric name plus a set of key-value tags (host, region, endpoint) — the combination is often called a 'series.' Storage is organized so all points for one series, over a time range, are physically close together.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "A single data point is `(metric=\"cpu_usage\", tags={host: \"web-42\", region: \"us-east\"}, timestamp, value)`. The combination of metric name and tag set defines a \"series\" — and storage is organized (often column-oriented, and always time-partitioned) so that fetching one series over a time range touches a small, contiguous chunk of storage rather than scanning broadly, which is what makes chart queries fast even against a huge overall dataset." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "Agents push metrics through a buffer into a time-series store; a separate alerting engine polls that store on a schedule and fires notifications on threshold breaches.",
      concepts: [
        { slug: "metrics-alerting-engine", name: "The alerting engine as a separate, always-polling consumer", summary: "Alert rules are evaluated by a dedicated engine that periodically queries the time-series store (or subscribes to a stream of incoming points) and compares recent values against configured thresholds — decoupled from both ingestion and the dashboard query path.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "Metrics collection and alerting",
            columns: 5,
            rows: 2,
            nodes: [
              { id: "agent", label: "Host agent", icon: "monitoring", col: 0, row: 0 },
              { id: "buffer", label: "Ingestion buffer", icon: "queue", col: 1, row: 0, accent: "amber" },
              { id: "tsdb", label: "Time-series store", icon: "database", col: 2, row: 0, accent: "purple" },
              { id: "dashboard", label: "Dashboard", icon: "monitoring", col: 3, row: 0, accent: "blue" },
              { id: "alertengine", label: "Alert engine", icon: "worker", col: 2, row: 1, accent: "rose" },
              { id: "notify", label: "Notification system", icon: "notification", col: 4, row: 1, accent: "rose" },
            ],
            edges: [
              { id: "e1", from: "agent", to: "buffer", step: 1, label: "push every ~10s" },
              { id: "e2", from: "buffer", to: "tsdb", step: 2, label: "batched writes" },
              { id: "e3", from: "dashboard", to: "tsdb", step: 3, label: "range query" },
              { id: "e4", from: "alertengine", to: "tsdb", step: 4, label: "periodic rule evaluation" },
              { id: "e5", from: "alertengine", to: "notify", step: 5, label: "threshold breached" },
            ],
            steps: [
              { index: 1, caption: "Agents on each host push metrics every few seconds.", nodeIds: ["agent", "buffer"], edgeIds: ["e1"] },
              { index: 2, caption: "An ingestion buffer batches writes into the time-series store for efficiency.", nodeIds: ["buffer", "tsdb"], edgeIds: ["e2"] },
              { index: 3, caption: "Dashboards query the store directly for charts.", nodeIds: ["dashboard", "tsdb"], edgeIds: ["e3"] },
              { index: 4, caption: "Independently, the alert engine periodically evaluates every configured rule against recent data.", nodeIds: ["alertengine", "tsdb"], edgeIds: ["e4"] },
              { index: 5, caption: "A breached threshold triggers a notification through the fan-out system from the Notification System course.", nodeIds: ["alertengine", "notify"], edgeIds: ["e5"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: downsampling old data",
      summary: "Nobody needs per-second resolution from a year ago — aggregating old data trades precision for a dramatic storage saving.",
      concepts: [
        { slug: "metrics-downsampling", name: "Downsampling by data age", summary: "A background job periodically aggregates older raw data points into coarser summaries (e.g. per-second data older than a week becomes per-minute averages), cutting storage volume for old data by orders of magnitude with minimal loss of practical value.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Keeping every raw per-second data point forever is both expensive and mostly pointless — almost nobody zooms into second-level detail from six months ago. A standard pattern: keep full resolution for a short recent window (say, the last 7 days), then a background job rolls older data up into coarser aggregates (per-minute, then per-hour, then per-day averages/min/max as it ages further), deleting the original fine-grained points once rolled up. This can cut storage for historical data by two or three orders of magnitude while preserving the shape of long-term trends.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "During an actual incident, the metrics system's own load spikes exactly when you need it to be most reliable.",
      concepts: [
        { slug: "metrics-incident-load", name: "The monitoring system's load spikes during incidents", summary: "An outage often causes error rates and retry storms that flood the metrics system with more data (and more alert evaluations firing) right when you most need it to stay up — the monitoring system needs its own headroom and can't assume steady-state load.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "A classic failure mode: an outage causes retry storms across the fleet, which spikes request-count and error-rate metrics, which increases both ingestion volume and the number of alert rules crossing their thresholds simultaneously — right when engineers most need the monitoring system to be fast and reliable. Provisioning the ingestion and alerting paths with real headroom above steady-state load (not just enough for average traffic) is a deliberate, non-optional design decision here, not an afterthought.",
        },
      ],
    },
  ],
};

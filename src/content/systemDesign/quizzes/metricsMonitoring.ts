import type { QuizQuestion } from "../quizTypes";

export const metricsMonitoringQuiz: QuizQuestion[] = [
  {
    id: "mm-1",
    phase: "requirements",
    question: "What makes metrics a distinctive storage workload?",
    options: [
      { id: "a", label: "Enormous append-only write volume, always queried as a time range" },
      { id: "b", label: "Frequent updates to historical values" },
      { id: "c", label: "Complex joins across many entities" },
      { id: "d", label: "Very large individual records" },
    ],
    correctOptionId: "a",
    explanation:
      "Points are written once and never changed, and reads are almost always 'this series over this window'. That shape is different enough from a typical database workload that purpose-built time-series stores exist for it.",
  },
  {
    id: "mm-2",
    phase: "estimation",
    question: "10,000 hosts emitting 100 metrics every 10 seconds is roughly what write rate?",
    options: [
      { id: "a", label: "About 1,000/sec" },
      { id: "b", label: "About 10,000/sec" },
      { id: "c", label: "About 100,000/sec" },
      { id: "d", label: "About 1,000,000/sec" },
    ],
    correctOptionId: "c",
    explanation:
      "A million points every 10 seconds is 100,000 writes/sec sustained — and that's steady state, before an incident makes emission more frequent exactly when the system is already under stress.",
  },
  {
    id: "mm-3",
    phase: "data-model",
    question: "What identifies a single time series?",
    options: [
      { id: "a", label: "The metric name alone" },
      { id: "b", label: "The metric name plus its full set of tag key-values" },
      { id: "c", label: "The host that emitted it" },
      { id: "d", label: "The timestamp of its first point" },
    ],
    correctOptionId: "b",
    explanation:
      "cpu_usage on web-42 in us-east is a different series from cpu_usage on web-43. Storage is organised so one series over a time range sits physically together, which is what makes chart queries cheap against a huge dataset.",
  },
  {
    id: "mm-4",
    phase: "deep-dive",
    question: "Why downsample data older than a week?",
    options: [
      { id: "a", label: "Old data becomes inaccurate over time" },
      { id: "b", label: "Full resolution costs enormous storage for detail nobody queries months later" },
      { id: "c", label: "The alerting engine can't read raw old data" },
      { id: "d", label: "To keep dashboards to a fixed point count" },
    ],
    correctOptionId: "b",
    explanation:
      "Per-second detail matters while debugging something that just happened; six months on you want the shape of a trend. Rolling old points into per-minute then per-hour aggregates cuts historical storage by orders of magnitude.",
  },
  {
    id: "mm-5",
    phase: "bottlenecks",
    question: "Why must the monitoring system be provisioned well above steady-state load?",
    options: [
      { id: "a", label: "Metrics volume grows steadily over time" },
      { id: "b", label: "An incident spikes both ingestion and alert evaluation exactly when you need it most" },
      { id: "c", label: "Dashboards are opened mostly at peak hours" },
      { id: "d", label: "Downsampling jobs are CPU-intensive" },
    ],
    correctOptionId: "b",
    explanation:
      "Outages cause retry storms, which spike error and request metrics, which raise ingestion volume and trip many alert rules at once. Headroom here isn't a nice-to-have — it's what stops the monitoring failing alongside the thing it monitors.",
  },
];

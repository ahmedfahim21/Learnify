import type { SystemDesignProblem } from "../types";

export const notificationSystem: SystemDesignProblem = {
  slug: "notification-system",
  title: "Notification System",
  tagline: "Fan out one event to push, email, and SMS — reliably, without hammering any provider's rate limit.",
  difficulty: 2,
  estimatedMinutes: 22,
  tags: ["messaging", "queueing", "fanout"],
  functionalRequirements: [
    "Send push, SMS, and email notifications, each with its own template.",
    "Support both immediate ('someone liked your post') and scheduled ('your trial ends tomorrow') sends.",
    "Let a user opt out of a notification type without touching the sending code.",
  ],
  nonFunctionalRequirements: [
    "High throughput — a single event can fan out to millions of recipients (e.g. a breaking-news push).",
    "Reliable delivery: a provider hiccup shouldn't silently drop notifications.",
    "Provider-agnostic — swapping the SMS vendor shouldn't touch calling code.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Three channels, one event",
      summary: "The interesting problem isn't sending one notification — it's fanning one event out to three different, unreliable third-party providers.",
      concepts: [
        { slug: "notif-scope", name: "Fan-out to heterogeneous channels", summary: "Push, SMS, and email have different providers, different rate limits, different failure modes, and different latencies — the system has to abstract over all of that behind one internal event.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A single internal event — \"user 42 got a new follower\" — might need to become a push notification (via APNs/FCM), an email (via SendGrid/SES), and an SMS (via Twilio), depending on the user's preferences. Each of those providers has its own API, its own rate limits, its own failure modes and retry semantics. The core design problem is decoupling \"an event happened\" from \"deliver it through three different unreliable third parties.\"" },
      ],
    },
    {
      phase: "estimation",
      title: "Fan-out scale",
      summary: "A single event can become millions of individual sends.",
      concepts: [
        { slug: "notif-estimation", name: "Estimating fan-out volume", summary: "The ratio between events and individual sends is the key number — a breaking-news event to 10 million subscribers is one event and 10 million sends, each independently rate-limited by its provider.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "If a breaking-news push goes to 10 million subscribers, that's 1 event fanning out to 10 million individual send operations. If the push provider caps you at 5,000 sends/sec, that fan-out alone takes over 30 minutes to fully deliver — a number worth surfacing early, since \"instant\" breaking-news pushes at this scale are actually a queued, rate-limited drain, not a synchronous broadcast." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Callers submit an event; they never talk to a provider directly.",
      concepts: [
        { slug: "notif-api", name: "sendNotification(event)", summary: "Internal callers submit an abstract event (type, recipient, payload) and never see providers, templates, or retry logic — all of that lives behind this one call.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`POST /notifications { userId, type, payload }` — the calling service (e.g. the \"someone followed you\" feature) never picks a channel, formats a template, or talks to Twilio directly. It emits one abstract event and the notification system resolves the rest: which channels the user has enabled for this type, which template to render, and which provider to call." },
      ],
    },
    {
      phase: "data-model",
      title: "Preferences and templates",
      summary: "A preferences table (user x notification type x channel -> enabled) and a templates table per channel.",
      concepts: [
        { slug: "notif-data-model", name: "Preferences and delivery log", summary: "A user's opt-in/opt-out state per notification type per channel, plus an append-only delivery log for tracking what was actually sent and whether it succeeded.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`preferences(user_id, notification_type, channel, enabled)` answers \"should we send this?\" before any queue work happens. `deliveries(id, event_id, channel, status, attempts, sent_at)` is an append-only log of every attempted send — the audit trail that answers \"did user 42 actually get this?\" when support asks." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "One event fans out into per-channel queues, each drained by workers that talk to exactly one provider.",
      concepts: [
        { slug: "notif-queue-fanout", name: "Per-channel queues decouple providers", summary: "Fanning the event into separate push/email/SMS queues means a slow or down email provider never blocks push delivery — each channel scales, retries, and fails independently.", difficulty: 2 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "Notification fan-out",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "svc", label: "Feature service", detail: "Any feature that wants to tell a user something. It emits one abstract event and never learns which channels fired.", sublabel: "e.g. \"new follower\"", icon: "service", col: 0, row: 1 },              { id: "api", label: "Notification API", detail: "Resolves preferences (which channels has this user opted into for this event type?) and fans the event into per-channel queues.", icon: "api", col: 1, row: 1, accent: "blue" },              { id: "pushq", label: "Push queue", detail: "Buffers push sends. A queue per channel is what stops a stalled email provider from delaying push notifications.", icon: "queue", col: 2, row: 0, accent: "amber" },              { id: "emailq", label: "Email queue", detail: "Buffers email sends, which are slower and more failure-prone than push — and now can be, without affecting anything else.", icon: "queue", col: 2, row: 1, accent: "amber" },              { id: "smsq", label: "SMS queue", detail: "Buffers SMS sends, typically the most rate-limited and most expensive channel of the three.", icon: "queue", col: 2, row: 2, accent: "amber" },              { id: "pushw", label: "Push worker", detail: "Drains the push queue at whatever rate FCM/APNs allows, retrying with an idempotency key so a crash mid-send never double-notifies.", icon: "worker", col: 3, row: 0 },              { id: "emailw", label: "Email worker", detail: "Renders the email template and calls the provider. Isolated failures here stay isolated.", icon: "worker", col: 3, row: 1 },              { id: "smsw", label: "SMS worker", detail: "Calls the SMS provider under its own outbound rate limit — a token bucket applied to your own traffic, not your users'.", icon: "worker", col: 3, row: 2 },              { id: "fcm", label: "FCM / APNs", detail: "The external push service. Its rate limit is a hard ceiling no amount of worker scaling gets past.", icon: "notification", col: 4, row: 0, accent: "green" },              { id: "ses", label: "SES / SendGrid", detail: "The external email provider. Bounces and complaints flow back here and feed suppression lists.", icon: "email", col: 4, row: 1, accent: "green" },              { id: "twilio", label: "Twilio", detail: "The external SMS gateway. Per-country throughput limits make this the slowest channel to drain in a large fan-out.", icon: "chat", col: 4, row: 2, accent: "green" },            ],
            edges: [
              { id: "e1", from: "svc", to: "api", step: 1, label: "sendNotification(event)" },
              { id: "e2", from: "api", to: "pushq", step: 2 },
              { id: "e3", from: "api", to: "emailq", step: 2 },
              { id: "e4", from: "api", to: "smsq", step: 2 },
              { id: "e5", from: "pushq", to: "pushw", step: 3 },
              { id: "e6", from: "emailq", to: "emailw", step: 3 },
              { id: "e7", from: "smsq", to: "smsw", step: 3 },
              { id: "e8", from: "pushw", to: "fcm", step: 4 },
              { id: "e9", from: "emailw", to: "ses", step: 4 },
              { id: "e10", from: "smsw", to: "twilio", step: 4 },
            ],
            steps: [
              { index: 1, caption: "A feature service emits one abstract notification event.", nodeIds: ["svc", "api"], edgeIds: ["e1"] },
              { index: 2, caption: "The API checks preferences and fans the event out into per-channel queues.", nodeIds: ["api", "pushq", "emailq", "smsq"], edgeIds: ["e2", "e3", "e4"] },
              { index: 3, caption: "Independent worker pools drain each queue at that channel's own pace.", nodeIds: ["pushq", "emailq", "smsq", "pushw", "emailw", "smsw"], edgeIds: ["e5", "e6", "e7"] },
              { index: 4, caption: "Each worker calls its one provider — a stalled SMS provider never blocks push or email.", nodeIds: ["pushw", "emailw", "smsw", "fcm", "ses", "twilio"], edgeIds: ["e8", "e9", "e10"] },
            ],
          },
        },
        {
          type: "simulator",
          simulatorId: "queue-backpressure",
          notice: "A breaking-news fan-out is a burst of arrivals against a rate-limited provider. Push arrival rate up toward the provider's service rate and watch the wait time curve bend.",
          params: [{ key: "arrivalRate", value: 4500 }, { key: "serviceRate", value: 5000 }, { key: "workers", value: 1 }],
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: retries and idempotency",
      summary: "A worker crash mid-send must never mean 'zero notifications' or 'duplicate notifications' — an idempotency key ties both cases together.",
      concepts: [
        { slug: "notif-idempotency", name: "At-least-once delivery with idempotency keys", summary: "Queues typically guarantee at-least-once delivery, which means a retry after a crash could double-send. An idempotency key (derived from the event) lets the provider or the worker deduplicate.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "If a worker crashes after calling the provider but before acknowledging the queue message, the message gets redelivered and the notification could be sent twice. The fix is an idempotency key — a deterministic id derived from the event (e.g. `event_id + channel + recipient`) passed to the provider (many support this natively) or checked against the delivery log before sending, so a retry after a crash is a safe no-op rather than a duplicate.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Provider rate limits are the real ceiling — no amount of internal scaling gets past a fixed external quota.",
      concepts: [
        { slug: "notif-rate-limit-provider", name: "Respecting the provider's own rate limit", summary: "However fast your queue can drain, the provider's rate limit is a hard external ceiling. The worker pool's own concurrency needs to be capped to match it, or the provider starts rejecting or throttling you.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "Scaling up worker count to drain a queue faster only helps up to the provider's own rate limit — beyond that, you're just getting more 429s from Twilio or SES, not sending faster. The worker pool needs its own client-side rate limiter (the Rate Limiter course's token bucket, applied outbound this time) tuned to match the provider's documented limit.",
        },
      ],
    },
  ],
};

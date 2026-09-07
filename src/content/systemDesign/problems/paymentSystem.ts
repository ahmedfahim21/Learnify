import type { SystemDesignProblem } from "../types";

export const paymentSystem: SystemDesignProblem = {
  slug: "payment-system",
  title: "Payment System",
  tagline: "Move money between a buyer, a merchant, and a bank — exactly once, every time, with a full audit trail.",
  difficulty: 5,
  estimatedMinutes: 30,
  tags: ["payments", "consistency", "idempotency"],
  functionalRequirements: [
    "Charge a buyer's payment method and credit a merchant for a purchase.",
    "Handle refunds, tracing back to the original charge.",
    "Reconcile internal records against the payment processor's records.",
  ],
  nonFunctionalRequirements: [
    "Correctness over latency — a slow-but-correct charge beats a fast-but-wrong one, every time.",
    "Exactly-once effect — a network retry must never double-charge a customer.",
    "A complete, immutable audit trail for every state a payment moves through.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "The one property that overrides every other design goal",
      summary: "In most systems in this course, availability and latency are the dominant pressures. Here, correctness dominates everything.",
      concepts: [
        { slug: "payments-scope", name: "Correctness over everything else", summary: "A payment system that's occasionally slow is an inconvenience. A payment system that occasionally double-charges or silently drops a charge is a trust-destroying, possibly legally serious failure — every design decision in this course is weighed against that asymmetry.", difficulty: 1, tags: ["scoping", "consistency"] },
      ],
      blocks: [
        { type: "prose", body: "Almost every other system in this course treats \"eventually consistent, mostly available\" as an acceptable trade-off for speed and scale. A payment system inverts that: a charge that takes an extra 2 seconds is a minor UX issue; a charge that fires twice because of a network retry, or a charge that silently vanishes because of a crashed worker, is a customer-trust and often regulatory problem. Every technique in this course exists to make **exactly-once effect** achievable despite running on the same unreliable networks and machines every other system in this course has to tolerate." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers, and where the real cost lives",
      summary: "Payment volume is usually modest compared to, say, a news feed — the cost here is correctness engineering, not raw throughput.",
      concepts: [
        { slug: "payments-estimation", name: "Payment volume is a correctness problem, not a scale problem", summary: "Even a large payments business processes orders of magnitude fewer transactions per second than a social feed processes reads. The engineering effort goes almost entirely into correctness (idempotency, reconciliation, audit trails), not raw throughput.", difficulty: 1, tags: ["estimation", "consistency"] },
      ],
      blocks: [
        { type: "prose", body: "A large e-commerce platform doing 10 million orders a day is about 115 payments/sec on average — modest by the standards of this course's other read-heavy systems. The design effort here isn't about handling millions of requests per second; it's almost entirely about guaranteeing correctness under failure: every write needs to be idempotent, every state transition needs to be auditable, and every external call (to a bank, to a processor) needs a defined behavior for \"I don't know if that succeeded.\"" },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Every mutating call carries a client-generated idempotency key — the single most important detail in this whole design.",
      concepts: [
        { slug: "payments-idempotency-key", name: "Idempotency keys on every charge", summary: "The client generates a unique key before making a charge request; if the same key is submitted twice (e.g. after a timeout-triggered retry), the server recognizes it and returns the original result instead of charging again.", difficulty: 2, tags: ["idempotency", "api-design"] },
      ],
      blocks: [
        { type: "prose", body: "`POST /charges { amount, paymentMethodId, idempotencyKey }`. That `idempotencyKey` — generated once by the client and reused on any retry of the *same logical charge* — is the mechanism that turns \"my request timed out, did it go through?\" from a dangerous ambiguity into a safe question: the client just resubmits with the same key, and the server, having recorded that key against the original charge's outcome, returns that same outcome instead of creating a second charge." },
        {
            type: "quiz",
            question: "A charge request times out. The client retries with the same idempotency key. What should happen?",
            options: [
              { id: "a", label: "A second charge is created, and one is refunded later" },
              { id: "b", label: "The server returns the original charge's outcome without charging again" },
              { id: "c", label: "The request is rejected as a duplicate" },
              { id: "d", label: "The charge is retried only if the first one definitely failed" },
            ],
            correctOptionId: "b",
            explanation: "That's the whole point of the key: the server recorded it against the original outcome, so the retry replays that result instead of moving money twice. Rejecting the retry outright would be safe but useless — the client still wouldn't know what happened, which is exactly the ambiguity the key resolves.",
          },
        ],
    },
    {
      phase: "data-model",
      title: "The ledger",
      summary: "An append-only, double-entry ledger is the source of truth — every balance is a computed sum, not a stored, mutable field.",
      concepts: [
        { slug: "payments-ledger", name: "Append-only double-entry ledger", summary: "Rather than a mutable 'balance' field that gets incremented and decremented (and can drift or get corrupted), every transaction is recorded as two immutable ledger entries (a debit and a credit) that must always sum to zero — a balance is always the sum of its entries, never a stored, directly-updated number.", difficulty: 4, tags: ["durability", "data-modeling"] },
      ],
      blocks: [
        { type: "prose", body: "`ledger_entries(id, account_id, amount, direction, transaction_id, created_at)`, append-only, never updated or deleted. A single payment writes at least two entries — debit the buyer's account, credit the merchant's account (or an intermediate escrow account) — and any correct transaction's entries always sum to exactly zero. This is standard double-entry bookkeeping, borrowed directly into the data model: an account's balance is never a stored number you increment, it's always a *computed* sum over its entries, which makes corruption structurally much harder (a bug can't silently decouple a stored balance from the transaction history, because there is no separate stored balance)." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "A payment moves through explicit states, recorded at every step, before ever touching the ledger as final.",
      concepts: [
        { slug: "payments-state-machine", name: "The payment state machine", summary: "A payment moves through explicit, persisted states (pending -> processing -> succeeded/failed) rather than being a single atomic operation — this makes every intermediate failure point recoverable and auditable, instead of an ambiguous unknown.", difficulty: 4, tags: ["ordering", "consistency"] },
      ],
      blocks: [
        {
          type: "prose",
          body: "A charge is never one atomic step from the system's point of view — it's a state machine: `pending` (request received, not yet sent to the processor) → `processing` (sent to the external payment processor, awaiting response) → `succeeded` or `failed` (processor responded). Persisting each state transition means that if the service crashes while in `processing` — the genuinely dangerous state, since the external call may or may not have gone through — recovery logic can safely query the processor for that idempotency key's actual status and resolve to the correct final state, rather than guessing or blindly retrying (which could double-charge).",
        },
        {
          type: "diagram",
          diagram: {
            title: "Payment flow with idempotency and ledger write",
            columns: 5,
            rows: 2,
            nodes: [
              { id: "client", label: "Client", detail: "Generates the idempotency key *before* sending, and reuses it on every retry of the same logical charge. That one discipline is what makes retries safe.", icon: "client", col: 0, row: 0 },              { id: "api", label: "Payment API", detail: "Owns the state machine. Every transition is persisted before the next step, so no failure leaves the system unable to say what happened.", icon: "api", col: 1, row: 0, accent: "blue" },              { id: "idemcheck", label: "Idempotency store", detail: "Maps idempotency key -> the original charge's outcome. A retried key returns that stored outcome instead of charging again.", icon: "cache", col: 1, row: 1, accent: "cyan" },              { id: "processor", label: "Payment processor", detail: "The external payment processor. The only component here that can authoritatively answer \"did this charge actually happen?\" after a timeout.", sublabel: "e.g. Stripe", icon: "payment", col: 3, row: 0, accent: "amber" },              { id: "ledger", label: "Ledger", detail: "Append-only double-entry records. A balance is always the sum of its entries, never a stored mutable number — so a bug can't silently decouple the two.", icon: "database", col: 4, row: 1, accent: "purple" },              { id: "statestore", label: "Payment state store", detail: "pending -> processing -> succeeded/failed, persisted at each hop. Crashing in `processing` is recoverable precisely because that state was written down first.", icon: "database", col: 2, row: 0, accent: "purple" },            ],
            edges: [
              { id: "e1", from: "client", to: "api", step: 1, label: "charge + idempotencyKey" },
              { id: "e2", from: "api", to: "idemcheck", step: 2, label: "seen this key before?" },
              { id: "e3", from: "api", to: "statestore", step: 3, label: "record: pending", route: "vertical-first" },
              { id: "e4", from: "api", to: "processor", step: 4, label: "charge request" },
              { id: "e5", from: "processor", to: "api", step: 5, label: "success" },
              { id: "e6", from: "api", to: "ledger", step: 6, label: "debit + credit" },
            ],
            steps: [
              { index: 1, caption: "The client submits a charge with a unique idempotency key.", nodeIds: ["client", "api"], edgeIds: ["e1"] },
              { index: 2, caption: "The API checks whether this key has already been processed.", nodeIds: ["api", "idemcheck"], edgeIds: ["e2"] },
              { index: 3, caption: "A new payment: its state is recorded as pending before any external call.", nodeIds: ["api", "statestore"], edgeIds: ["e3"] },
              { index: 4, caption: "The API calls out to the external payment processor.", nodeIds: ["api", "processor"], edgeIds: ["e4"] },
              { index: 5, caption: "The processor confirms success.", nodeIds: ["processor", "api"], edgeIds: ["e5"] },
              { index: 6, caption: "Only now is the ledger written — the durable, final record of the money movement.", nodeIds: ["api", "ledger"], edgeIds: ["e6"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: the ambiguous timeout",
      summary: "The single hardest case in this whole system: the external processor call times out, and you genuinely don't know if it succeeded.",
      concepts: [
        { slug: "payments-ambiguous-timeout", name: "Resolving an unknown processor response", summary: "A timeout calling the external processor is fundamentally ambiguous — it might have succeeded, might have failed, might still be in flight. The only safe response is to query the processor's own status endpoint for that idempotency key rather than guessing (retry blindly, or assume failure), until it resolves.", difficulty: 5, tags: ["idempotency", "availability"] },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "The single most dangerous moment in this entire design: your call to the external payment processor times out. You do not know if the charge happened. Blindly retrying risks a double charge if it actually succeeded; blindly marking it failed and letting the customer retry risks the same. There is no clever trick that resolves this from your side alone.",
        },
        {
          type: "prose",
          body: "The only correct response is to leave the payment in a `processing`/`unknown` state and query the processor's own status-lookup endpoint for that specific idempotency key — every reputable payment processor provides exactly this, because every payment system built on top of them faces this exact problem. The state machine from the high-level design chapter is what makes this recoverable: the payment simply sits in `processing` until a reconciliation job (running periodically, or triggered on next client retry) resolves it definitively to `succeeded` or `failed`, based on the processor's authoritative answer — never based on a guess.",
        },
        {
            type: "diagram",
            diagram: {
              title: "The ambiguous timeout",
              columns: 4,
              rows: 2,
              nodes: [
                { id: "call", label: "Charge sent", detail: "The request left your system. From this instant until a response arrives, you cannot know whether money moved.", icon: "payment", col: 0, row: 0, accent: "blue" },
                { id: "timeout", label: "Timeout", sublabel: "no response", detail: "The genuinely dangerous state. It might have succeeded, might have failed, might still be in flight — and nothing on your side can distinguish them.", icon: "firewall", col: 1, row: 0, accent: "rose", shape: "hexagon" },
                { id: "wrong1", label: "Retry blindly", detail: "If the original succeeded, you have now charged the customer twice. This is the failure that destroys trust.", icon: "worker", col: 2, row: 1, accent: "rose" },
                { id: "wrong2", label: "Assume failed", detail: "If the original succeeded, you have taken money and recorded nothing — a discrepancy reconciliation will find days later.", icon: "worker", col: 3, row: 1, accent: "rose" },
                { id: "right", label: "Ask the processor", detail: "Query the processor's status endpoint for that idempotency key. It is the only component that can answer authoritatively, which is why every processor offers this.", icon: "api", col: 2, row: 0, accent: "green" },
                { id: "resolve", label: "Resolve state", detail: "Move the payment from `processing` to a definitive succeeded/failed, based on the processor's answer rather than a guess.", icon: "database", col: 3, row: 0, accent: "green" },
              ],
              edges: [
                { id: "a1", from: "call", to: "timeout", step: 1 },
                { id: "a2", from: "timeout", to: "wrong1", step: 2, style: "dashed", label: "double charge", route: "vertical-first" },
                { id: "a3", from: "timeout", to: "wrong2", step: 3, style: "dashed", label: "lost payment", route: "vertical-first" },
                { id: "a4", from: "timeout", to: "right", step: 4, label: "the only safe move" },
                { id: "a5", from: "right", to: "resolve", step: 5 },
              ],
              steps: [
                { index: 1, caption: "The call to the processor times out. You do not know if the charge happened.", nodeIds: ["call", "timeout"], edgeIds: ["a1"] },
                { index: 2, caption: "Retrying blind risks charging the customer twice.", nodeIds: ["timeout", "wrong1"], edgeIds: ["a2"] },
                { index: 3, caption: "Assuming failure risks taking money you never recorded.", nodeIds: ["timeout", "wrong2"], edgeIds: ["a3"] },
                { index: 4, caption: "Instead, ask the one system that knows — the processor, by idempotency key.", nodeIds: ["timeout", "right"], edgeIds: ["a4"] },
                { index: 5, caption: "Resolve the payment on its authoritative answer. The state machine made this recoverable.", nodeIds: ["right", "resolve"], edgeIds: ["a5"] },
              ],
            },
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Reconciliation — comparing your ledger against the processor's own records — is the unglamorous process that catches everything else missed.",
      concepts: [
        { slug: "payments-reconciliation", name: "Reconciliation as a mandatory background process", summary: "Even a correctly-designed system can drift from the processor's records due to bugs, edge cases, or processor-side issues. A periodic reconciliation job comparing your ledger against the processor's transaction records is the final backstop that catches discrepancies before they become customer-facing problems.", difficulty: 4, tags: ["consistency", "observability"] },
      ],
      blocks: [
        {
          type: "prose",
          body: "No matter how carefully the idempotency and state-machine logic is built, real payment systems run periodic reconciliation: fetching the processor's own record of every transaction in a period and diffing it against the internal ledger. A mismatch — a charge the processor shows as succeeded that your ledger never recorded, or vice versa — is a signal something in the pipeline had a bug or an unhandled edge case, and it's far better to catch that in an automated nightly job than to have it surface as a customer support ticket about a missing or duplicate charge weeks later.",
        },
        {
            type: "simulator",
            simulatorId: "token-bucket",
            title: "Rate-limiting your own retries",
            notice: "Retries against a processor need their own outbound limit, or a partial outage turns into a self-inflicted retry storm. Capacity buys tolerance for a burst of genuine failures; refill rate governs the sustained retry rate.",
            params: [{ key: "capacity", value: 15 }, { key: "refillPerSec", value: 8 }, { key: "arrivalPerSec", value: 12 }],
          },
        ],
    },
  ],
};

import type { SystemDesignProblem } from "../types";

export const loadBalancing: SystemDesignProblem = {
  slug: "load-balancing",
  title: "Load Balancing",
  tagline: "Spread traffic across many servers without creating a single point of failure in the thing doing the spreading.",
  difficulty: 2,
  estimatedMinutes: 24,
  tags: ["traffic", "availability", "routing"],
  functionalRequirements: [
    "Distribute incoming requests across a pool of interchangeable servers.",
    "Stop sending traffic to a server that has failed, without human intervention.",
    "Let servers be added or removed while traffic is flowing.",
  ],
  nonFunctionalRequirements: [
    "The balancer must not become the bottleneck it was added to remove.",
    "It must not itself be a single point of failure.",
    "Routing decisions have to be cheap — they run on every single request.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "What a balancer is actually for",
      summary: "Two jobs that are easy to confuse: using capacity you already have, and surviving the loss of some of it.",
      concepts: [
        { slug: "lb-purpose", name: "Distribution vs. availability", summary: "Spreading load and tolerating failure are separate goals that happen to share a mechanism. A balancer that spreads perfectly but keeps routing to a dead server has solved only one of them.", difficulty: 1 },
        { slug: "lb-statelessness", name: "Why the servers must be interchangeable", summary: "Balancing only works if any server can serve any request. The moment a server holds state a request depends on, you are no longer balancing — you are routing, which is a harder problem.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", heading: "Two jobs, one mechanism", body: "A load balancer does two things that are worth separating in your head. The first is **utilisation**: you have ten servers and you would like all ten working rather than one melting while nine idle. The second is **availability**: when one of those ten dies at 3am, traffic should stop going to it without anyone waking up. The same box does both, which is why they get conflated — but a balancer with perfect round-robin distribution that keeps cheerfully forwarding to a dead host has solved the first and completely failed the second." },
        { type: "prose", heading: "The precondition nobody states", body: "All of this rests on the servers being interchangeable. If any server can serve any request, distribution is a free choice. The moment a server holds something a particular request needs — an in-memory session, a WebSocket, a local cache of that user's data — you are no longer balancing load, you are *routing to a specific place*, and that is the substantially harder problem the Chat System concept runs into." },
        { type: "callout", tone: "note", body: "This is why \"make the servers stateless\" appears so early in so many designs. It is not tidiness — it is the precondition that makes horizontal scaling a matter of adding boxes rather than redesigning the system." },
      ],
    },
    {
      phase: "estimation",
      title: "How much does the balancer itself cost?",
      summary: "It runs on every request, so its own overhead is multiplied by everything.",
      concepts: [
        { slug: "lb-overhead", name: "Per-request overhead", summary: "The balancer's decision runs on 100% of traffic, so an expensive routing rule is multiplied by total request volume — which is why the algorithms are all O(1) tricks rather than optimisation problems.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "Whatever the balancer does, it does on every request. At 50,000 requests/sec, a routing decision costing one millisecond would consume fifty seconds of CPU per wall-clock second — you would need fifty cores purely to decide where things go. This is why every algorithm below is an O(1) trick: a counter increment, a hash, a comparison of a few integers. None of them is solving an optimisation problem, because there is no budget to." },
        { type: "simulator", simulatorId: "load-balancer", title: "How evenly does it actually spread?", notice: "Perfectly even distribution is not the default. Raise the request skew and watch the imbalance ratio climb — then add servers and watch random assignment stay lumpy, because evenness comes from the algorithm, not from having more machines.", params: [{ key: "serverCount", value: 6 }, { key: "requestCount", value: 4000 }] },
      ],
    },
    {
      phase: "api",
      title: "Where it sits: L4 versus L7",
      summary: "Balancing on connections is fast and blind; balancing on requests is slower and can read what it is routing.",
      concepts: [
        { slug: "lb-osi-layer", name: "Layer 4 vs. layer 7", summary: "L4 routes TCP connections by IP and port without reading the payload — fast, protocol-agnostic, blind. L7 parses the HTTP request, so it can route on path, header or cookie, at the cost of terminating the connection and doing real parsing work.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", heading: "Layer 4: fast and blind", body: "An L4 balancer works at the TCP level. It sees a connection arriving at an IP and port, picks a backend, and shuttles packets. It never looks inside, which makes it extremely fast and completely protocol-agnostic — it will balance HTTP, gRPC, a database protocol, anything. It also means it cannot make any decision that depends on *what* is being asked." },
        { type: "prose", heading: "Layer 7: slower and informed", body: "An L7 balancer terminates the connection and parses the request. Now it can send `/api/*` to one pool and `/images/*` to another, route by tenant header, or retry an idempotent GET against a different backend when the first one fails. It costs more per request and it must understand the protocol, but almost everything people actually want from a modern balancer — path routing, TLS termination, header-based canaries — needs layer 7." },
        { type: "callout", tone: "tradeoff", body: "The two are frequently stacked rather than chosen between: L4 at the edge to absorb volume and spread it across a fleet of L7 balancers, which then make the content-aware decisions. Each layer does the job it is cheap at." },
      ],
    },
    {
      phase: "data-model",
      title: "What state the balancer keeps",
      summary: "Less than you would think, and that is deliberate.",
      concepts: [
        { slug: "lb-health-state", name: "Health state and connection counts", summary: "The minimum is a list of backends and whether each is currently healthy. Least-connections additionally tracks in-flight requests per backend — the only per-request state most balancers hold.", difficulty: 2 },
        { slug: "lb-health-checks", name: "Active vs. passive health checks", summary: "Active checks poll a health endpoint on a timer. Passive checks infer health from real traffic — consecutive errors or timeouts eject a backend. Active detects a fully dead host; passive catches one that is up but broken.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "A balancer holds strikingly little: the backend list, a health flag per backend, and — only for least-connections — a count of in-flight requests. That minimalism is the point. State in the balancer is state that must be replicated when you run more than one of them, and every field you add is another thing to keep consistent across the pair." },
        { type: "prose", heading: "Knowing a server is dead", body: "**Active** health checking polls each backend on a timer: request `/healthz`, expect a 200 within a timeout, eject after N consecutive failures. It reliably catches a process that has died or a machine that has gone. **Passive** checking watches real traffic instead — if a backend returns errors or times out on several consecutive live requests, eject it. Passive catches the nastier case: a server that answers health checks perfectly while failing every actual request, because the dependency it needs is down and the health endpoint never touches it." },
        { type: "callout", tone: "pitfall", body: "A health endpoint that returns 200 unconditionally is worse than none: it converts a broken server into a *confidently* broken server that the balancer will keep feeding. A useful check exercises the dependencies the real requests need — and no more, or a slow database will eject your entire fleet at once." },
      ],
    },
    {
      phase: "high-level",
      title: "The algorithms",
      summary: "Four choices, each optimal for a different assumption about your requests.",
      concepts: [
        { slug: "lb-algorithms", name: "Round-robin, least-connections, hashing, random", summary: "Round-robin assumes requests cost the same. Least-connections adapts when they don't. Hashing pins a key to a backend for cache locality. Random with two choices gets most of least-connections' benefit with none of its coordination.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "**Round-robin** hands each request to the next backend in order. It is optimal when every request costs about the same, and it degrades badly when they don't — one backend can be grinding through an expensive report while round-robin cheerfully hands it another.\n\n**Least-connections** sends each request to whichever backend currently has the fewest in flight. This adapts automatically to uneven request cost, because an expensive request keeps its connection open and the backend stops being chosen. It is the sane default for anything with variable work per request.\n\n**Hash-based** routing sends the same key — a user id, a cache key — to the same backend every time. You give up evenness to gain locality: that backend's cache stays warm for that key. This is the Distributed Cache concept's ring, applied to traffic instead of data.\n\n**Random with two choices** picks two backends at random and takes the less loaded of the two. It is startlingly effective: it captures most of the benefit of least-connections while needing no global view, which matters when you have many balancers that would otherwise have to share counts." },
        { type: "diagram", diagram: {
          title: "Where balancing happens",
          columns: 5,
          rows: 3,
          nodes: [
            { id: "clients", label: "Clients", detail: "Arriving over the public internet, resolving one DNS name to one or a few addresses.", icon: "client", col: 0, row: 1 },
            { id: "dns", label: "DNS", sublabel: "coarse, cached", detail: "The first and crudest balancing layer: hand different clients different addresses. Cheap and global, but TTLs mean it reacts to a failure in minutes, not seconds.", icon: "dns", col: 1, row: 1, accent: "slate" },
            { id: "l4", label: "L4 balancer", sublabel: "TCP, blind", detail: "Routes connections by IP and port without reading the payload. Fast enough to absorb the whole front door, and protocol-agnostic.", icon: "load-balancer", col: 2, row: 1, accent: "amber" },
            { id: "l7a", label: "L7 balancer", sublabel: "reads the request", detail: "Terminates TLS and parses HTTP, so it can route on path, header or cookie — and retry an idempotent request elsewhere when a backend fails.", icon: "proxy", col: 3, row: 0, accent: "blue" },
            { id: "l7b", label: "L7 balancer", detail: "An identical peer. L7 is where per-request cost lives, so it is scaled horizontally behind the cheaper L4 layer.", icon: "proxy", col: 3, row: 2, accent: "blue" },
            { id: "pool", label: "Server pool", sublabel: "interchangeable", detail: "Stateless by design: any server can serve any request, which is the precondition that makes distribution a free choice.", icon: "service", col: 4, row: 1, accent: "green" },
          ],
          edges: [
            { id: "b1", from: "clients", to: "dns", step: 1, label: "resolve" },
            { id: "b2", from: "dns", to: "l4", step: 2, label: "one of N IPs" },
            { id: "b3", from: "l4", to: "l7a", step: 3 },
            { id: "b4", from: "l4", to: "l7b", step: 3 },
            { id: "b5", from: "l7a", to: "pool", step: 4, label: "by path" },
            { id: "b6", from: "l7b", to: "pool", step: 4 },
          ],
          steps: [
            { index: 1, caption: "A client resolves the service name. DNS is the first, coarsest balancing layer.", nodeIds: ["clients", "dns"], edgeIds: ["b1"] },
            { index: 2, caption: "It gets one of several addresses — spreading clients across entry points before any traffic flows.", nodeIds: ["dns", "l4"], edgeIds: ["b2"] },
            { index: 3, caption: "The L4 layer absorbs raw connection volume and spreads it across L7 balancers.", nodeIds: ["l4", "l7a", "l7b"], edgeIds: ["b3", "b4"] },
            { index: 4, caption: "Only at L7 is the request actually read, and routed on what it contains.", nodeIds: ["l7a", "l7b", "pool"], edgeIds: ["b5", "b6"] },
          ],
        } },
        {
            type: "quiz",
            question: "Your requests vary wildly in cost — most take a millisecond, some take thirty seconds. Which algorithm handles that best, and why?",
            options: [
              { id: "a", label: "Round-robin, because it is perfectly fair by count" },
              { id: "b", label: "Least-connections, because a long request holds its connection and the backend stops being picked" },
              { id: "c", label: "Hash-based, because it keeps each user on one backend" },
              { id: "d", label: "Random, because unpredictability averages out" },
            ],
            correctOptionId: "b",
            explanation: "Round-robin's fairness is measured in requests, not work, so it keeps feeding a backend that is already grinding. Least-connections adapts automatically because an expensive request keeps its connection open — though note it only reacts once the imbalance has begun, which is why genuinely hostile workloads get their own pool instead.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Who balances the balancer?",
      summary: "You have moved the single point of failure rather than removed it.",
      concepts: [
        { slug: "lb-ha", name: "Making the balancer redundant", summary: "One balancer in front of ten servers is one machine whose failure takes down all ten. The fixes — a floating IP with failover, or several balancers behind DNS — each trade failover speed against complexity.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "Put a single load balancer in front of ten servers and you have built a system that survives any one of the ten failing, and dies completely if the eleventh box does. The balancer is now the single point of failure, and it is a more consequential one than any individual server was." },
        { type: "prose", heading: "Two standard answers", body: "**A floating address.** Two balancers, one active, both watching each other by heartbeat. When the standby stops hearing from the active one, it claims the shared IP and traffic follows within seconds. Failover is fast and invisible to clients, but you are paying for a machine that does nothing most of the time — and you must be certain only one can ever hold the address, or you have two boxes both claiming to be the front door.\n\n**Several balancers behind DNS.** Publish multiple addresses for the name and let clients spread across them. Every balancer is doing useful work, and there is no failover mechanism to get wrong. The catch is that DNS is cached: when one dies, some clients keep trying its address until their TTL expires, so a slice of traffic fails for a while." },
        { type: "diagram", diagram: {
          title: "Failover with a floating address",
          columns: 4,
          rows: 3,
          nodes: [
            { id: "vip", label: "Floating IP", sublabel: "what DNS points at", detail: "One address clients know. It is claimed by whichever balancer is currently active, so failover changes nothing the client can see.", icon: "internet", col: 0, row: 1, accent: "purple" },
            { id: "active", label: "Active balancer", detail: "Holds the floating address and carries all traffic. Sends a heartbeat to its peer continuously.", icon: "load-balancer", col: 1, row: 0, accent: "green" },
            { id: "standby", label: "Standby balancer", detail: "Idle but fully configured, listening for the heartbeat. Its only job is to notice silence and claim the address.", icon: "load-balancer", col: 1, row: 2, accent: "slate" },
            { id: "pool", label: "Server pool", detail: "Unchanged throughout. From the servers' point of view a failover is invisible.", icon: "service", col: 3, row: 1, accent: "blue" },
          ],
          edges: [
            { id: "f1", from: "vip", to: "active", step: 1, label: "traffic" },
            { id: "f2", from: "active", to: "standby", step: 2, label: "heartbeat", style: "dashed" },
            { id: "f3", from: "active", to: "pool", step: 1 },
            { id: "f4", from: "standby", to: "vip", step: 3, label: "claims on silence", route: "vertical-first" },
            { id: "f5", from: "standby", to: "pool", step: 4, style: "dashed" },
          ],
          steps: [
            { index: 1, caption: "Normally the active balancer holds the address and carries everything.", nodeIds: ["vip", "active", "pool"], edgeIds: ["f1", "f3"] },
            { index: 2, caption: "It heartbeats to the standby continuously — the standby's only input.", nodeIds: ["active", "standby"], edgeIds: ["f2"] },
            { index: 3, caption: "When the heartbeat stops, the standby claims the floating address.", nodeIds: ["standby", "vip"], edgeIds: ["f4"] },
            { index: 4, caption: "Traffic now lands on the standby. Clients never knew the address moved.", nodeIds: ["standby", "pool"], edgeIds: ["f5"] },
          ],
        } },
        { type: "callout", tone: "pitfall", body: "The failure mode to fear here is split brain: the network between the two balancers breaks while both are alive, each concludes the other is dead, and both claim the address. Heartbeats over more than one path, and a tie-breaker neither can claim alone, are what stop a partition from becoming two front doors." },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Even distribution of requests is not even distribution of work.",
      concepts: [
        { slug: "lb-uneven-work", name: "When even distribution isn't enough", summary: "Balancers spread requests, not cost. One tenant's expensive queries can saturate a backend that is receiving exactly its fair share of traffic — the fix is isolation, not better balancing.", difficulty: 4 },
      ],
      blocks: [
        { type: "prose", body: "The assumption underneath round-robin is that requests are roughly equal. Real traffic is not: one customer runs reports that take thirty seconds while everyone else does millisecond lookups. Spread perfectly evenly by *count*, the backends receiving that customer's requests are pinned while the rest idle. Least-connections helps, because a long request holds its connection and the backend stops being picked — but it only reacts after the damage is underway." },
        { type: "prose", heading: "The real fix is isolation", body: "When one workload can starve another, the answer is usually not a cleverer balancing algorithm — it is refusing to let them share. Give the expensive workload its own pool, so its bad days are contained to customers using it. This is the same instinct as the per-channel queues in the Notification System concept: separate the things whose failure modes you do not want coupled." },
        { type: "callout", tone: "tradeoff", body: "Isolation costs utilisation. Dedicated pools sit idle when their workload is quiet, where a shared pool would have used that capacity. You are buying predictability with efficiency — usually worth it, but it is a real trade rather than a free win." },
      ],
    },
  ],
};

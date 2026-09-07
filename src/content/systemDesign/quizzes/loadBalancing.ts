import type { QuizQuestion } from "../quizTypes";

export const loadBalancingQuiz: QuizQuestion[] = [
  {
    id: "lb-1", phase: "requirements",
    question: "What precondition makes load balancing a free choice rather than a hard routing problem?",
    options: [
      { id: "a", label: "All servers run identical hardware" },
      { id: "b", label: "Servers are interchangeable — any one can serve any request" },
      { id: "c", label: "The balancer runs at layer 7" },
      { id: "d", label: "Requests are idempotent" },
    ],
    correctOptionId: "b",
    explanation: "If any server can serve any request, the balancer is free to pick. The moment a server holds something a request needs — a session, a socket, a warm local cache — you are routing to a specific place instead, which is a much harder problem.",
  },
  {
    id: "lb-2", phase: "estimation",
    question: "Why are load balancing algorithms all O(1) tricks rather than optimisation problems?",
    options: [
      { id: "a", label: "Optimal assignment is mathematically impossible" },
      { id: "b", label: "The decision runs on every request, so its cost multiplies by total traffic" },
      { id: "c", label: "Balancers have no memory to work with" },
      { id: "d", label: "Kernel networking forbids complex logic" },
    ],
    correctOptionId: "b",
    explanation: "At 50,000 requests/sec a 1ms routing decision would burn fifty seconds of CPU per second of wall clock. There is simply no budget for anything beyond a counter increment, a hash, or comparing a couple of integers.",
  },
  {
    id: "lb-3", phase: "api",
    question: "What can a layer 7 balancer do that a layer 4 balancer fundamentally cannot?",
    options: [
      { id: "a", label: "Handle more connections per second" },
      { id: "b", label: "Route based on the request's path, headers or cookies" },
      { id: "c", label: "Detect that a backend has died" },
      { id: "d", label: "Balance non-HTTP protocols" },
    ],
    correctOptionId: "b",
    explanation: "L4 shuttles packets by IP and port without reading them, which is what makes it fast and protocol-agnostic. Any decision that depends on what is being asked requires terminating the connection and parsing the request — that is layer 7, and it is why L4 is the one that handles arbitrary protocols.",
  },
  {
    id: "lb-4", phase: "data-model",
    question: "A server answers /healthz with 200 while failing every real request because its database is unreachable. What catches this?",
    options: [
      { id: "a", label: "Active health checks, run more frequently" },
      { id: "b", label: "Passive health checks, which infer health from real traffic" },
      { id: "c", label: "Least-connections balancing" },
      { id: "d", label: "Nothing — this is undetectable" },
    ],
    correctOptionId: "b",
    explanation: "Active checks only prove the health endpoint works. Passive checking watches actual responses and ejects a backend after consecutive errors or timeouts, which is exactly the case where a server is up but useless.",
  },
  {
    id: "lb-5", phase: "high-level",
    question: "Requests vary a lot in cost — some take 30 seconds, most take a millisecond. Which algorithm adapts best?",
    options: [
      { id: "a", label: "Round-robin" },
      { id: "b", label: "Least-connections" },
      { id: "c", label: "Hash-based routing" },
      { id: "d", label: "Pure random" },
    ],
    correctOptionId: "b",
    explanation: "A long request holds its connection open, so a backend working on one stops being chosen automatically. Round-robin keeps handing work to a saturated backend because it only counts requests, not what they cost.",
  },
  {
    id: "lb-6", phase: "high-level",
    question: "What does hash-based routing buy you, and what does it give up?",
    options: [
      { id: "a", label: "Buys even distribution, gives up failure tolerance" },
      { id: "b", label: "Buys cache locality for a key, gives up evenness" },
      { id: "c", label: "Buys lower latency, gives up protocol support" },
      { id: "d", label: "Buys simpler failover, gives up throughput" },
    ],
    correctOptionId: "b",
    explanation: "Sending the same key to the same backend keeps that backend's cache warm for it. The cost is that hashing does not distribute evenly — it distributes deterministically, which is a different thing, and a hot key lands entirely on one node.",
  },
  {
    id: "lb-7", phase: "deep-dive",
    question: "You put one balancer in front of ten servers. What have you actually changed about failure?",
    options: [
      { id: "a", label: "Removed the single point of failure" },
      { id: "b", label: "Moved it to the balancer, and made it more consequential" },
      { id: "c", label: "Eliminated correlated failure entirely" },
      { id: "d", label: "Nothing — availability is unchanged" },
    ],
    correctOptionId: "b",
    explanation: "The system now survives any of the ten servers dying and dies completely if the eleventh box does. That is why balancers come in pairs with a floating address, or in groups behind DNS.",
  },
  {
    id: "lb-8", phase: "deep-dive",
    question: "Two balancers share a floating IP. The network between them breaks while both are alive. What is the danger?",
    options: [
      { id: "a", label: "Neither claims the address and traffic stops" },
      { id: "b", label: "Both conclude the other is dead and both claim the address" },
      { id: "c", label: "The address is released back to DNS" },
      { id: "d", label: "Backends are ejected as unhealthy" },
    ],
    correctOptionId: "b",
    explanation: "Split brain: each side sees silence and promotes itself, leaving two machines claiming the same front door. Heartbeats over more than one path, plus a tie-breaker neither can win alone, are what stop a partition becoming two front doors.",
  },
  {
    id: "lb-9", phase: "bottlenecks",
    question: "One tenant's expensive queries keep saturating backends that receive exactly their fair share of requests. What is the real fix?",
    options: [
      { id: "a", label: "Switch to a better balancing algorithm" },
      { id: "b", label: "Add more servers to the shared pool" },
      { id: "c", label: "Give that workload its own pool so it cannot starve the rest" },
      { id: "d", label: "Increase health check frequency" },
    ],
    correctOptionId: "c",
    explanation: "Balancers spread requests, not cost, so no algorithm makes an expensive workload cheap. Isolation contains the blast radius — at the price of utilisation, since a dedicated pool idles when its workload is quiet.",
  },
];

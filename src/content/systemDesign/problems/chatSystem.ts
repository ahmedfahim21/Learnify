import type { SystemDesignProblem } from "../types";

export const chatSystem: SystemDesignProblem = {
  slug: "chat-system",
  title: "Chat System",
  tagline: "Deliver messages in real time to millions of concurrently-connected users, and never lose one.",
  difficulty: 4,
  estimatedMinutes: 28,
  tags: ["realtime", "websockets", "messaging"],
  functionalRequirements: [
    "One-to-one and group messaging, delivered in near real time to online recipients.",
    "Messages delivered to offline users as soon as they reconnect.",
    "Online/offline presence and delivery/read receipts.",
  ],
  nonFunctionalRequirements: [
    "Low latency for online delivery — under a second, ideally much less.",
    "No message loss, even across reconnects and server restarts.",
    "Millions of concurrent persistent connections across the whole system.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Why HTTP request/response doesn't fit",
      summary: "A chat server needs to push to the client, not just respond to it — that alone rules out plain request/response.",
      concepts: [
        { slug: "chat-scope", name: "Push, not pull", summary: "A recipient isn't polling for new messages — the server needs to push a message the moment it arrives, which needs a persistent, bidirectional connection rather than request/response HTTP.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "The core requirement that shapes everything else: when Alice sends Bob a message, Bob's client needs to find out *immediately*, without Bob's client having to ask \"anything new?\" every few seconds. That rules out plain HTTP request/response as the delivery mechanism and points straight at a persistent, bidirectional connection — WebSockets being the standard choice." },
      ],
    },
    {
      phase: "estimation",
      title: "Connections and message volume",
      summary: "The number that dominates capacity planning here is concurrent open connections, not requests/sec.",
      concepts: [
        { slug: "chat-estimation", name: "Estimating concurrent connections", summary: "Unlike a stateless API, a chat server has to hold one open connection per online user for as long as they're online — that's a very different capacity model than request throughput.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "If 50 million users are online at peak, that's 50 million simultaneous open connections the system has to hold — not 50 million requests/sec, but 50 million *stateful, long-lived* connections. A single modern server can hold on the order of hundreds of thousands of WebSocket connections, which means the peak load alone needs on the order of a few hundred connection-serving machines, before any message-throughput capacity is even considered." },
      ],
    },
    {
      phase: "api",
      title: "The protocol",
      summary: "A persistent WebSocket carries send/receive/ack frames; a regular REST API handles everything that isn't real-time (history, contacts).",
      concepts: [
        { slug: "chat-protocol", name: "WebSocket for real-time, REST for everything else", summary: "Only the real-time send/receive path needs a persistent connection. Loading chat history, managing contacts, and other non-real-time operations are ordinary stateless REST calls.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "Over the WebSocket: `send { toUserId, content }`, and the server pushes `receive { fromUserId, content, messageId }` to the recipient's connection if they're online. Everything that isn't inherently real-time — loading the last 50 messages of a conversation, listing contacts, updating a display name — stays a plain stateless REST call, because forcing it through the WebSocket buys nothing and complicates the connection-handling code." },
      ],
    },
    {
      phase: "data-model",
      title: "Messages and conversations",
      summary: "Messages are stored append-only, partitioned by conversation, ordered so history loads in one range query.",
      concepts: [
        { slug: "chat-data-model", name: "Conversation-partitioned message log", summary: "messages(conversation_id, message_id, sender_id, content, sent_at), partitioned by conversation_id so that loading one conversation's history is a single-partition range scan, not a scatter-gather across the whole cluster.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "Partitioning the message store by `conversation_id` (rather than, say, by sender) means the single most common query — \"load the last N messages of this conversation\" — hits exactly one partition. `message_id` is chosen to be sortable (a Snowflake-style id from the Unique ID Generator course works well) so messages within a conversation naturally order by send time without a separate timestamp index." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "A connection-management layer tracks which server holds which user's socket; that's the piece a stateless system doesn't need.",
      concepts: [
        { slug: "chat-connection-routing", name: "The connection-to-server mapping", summary: "Because a user's WebSocket is pinned to one specific server, that server needs to be discoverable — a service (backed by something like Redis) maps user_id -> which server currently holds their connection, so any server can route a message to the right one.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Unlike a stateless API where any server can handle any request, a WebSocket connection is pinned to whichever specific server accepted it. When Alice's connection is on server 3 and Bob's is on server 7, and Alice sends Bob a message, server 3 needs to know to forward it to server 7. A shared connection-registry (`user_id -> server_id`, held in something like Redis) makes this lookup fast; a message that can't be delivered live (recipient offline) is written to the durable message store and delivered on next connect.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Chat message delivery",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "alice", label: "Alice", icon: "user", col: 0, row: 0 },
              { id: "server3", label: "Chat server 3", icon: "service", col: 1, row: 0, accent: "blue" },
              { id: "registry", label: "Connection registry", sublabel: "user -> server", icon: "cache", col: 2, row: 1, accent: "cyan" },
              { id: "server7", label: "Chat server 7", icon: "service", col: 3, row: 2, accent: "blue" },
              { id: "bob", label: "Bob", icon: "user", col: 4, row: 2 },
              { id: "msgstore", label: "Message store", icon: "database", col: 2, row: 2, accent: "purple" },
            ],
            edges: [
              { id: "e1", from: "alice", to: "server3", step: 1, label: "send(toBob, \"hi\")" },
              { id: "e2", from: "server3", to: "registry", step: 2, label: "where is Bob?" },
              { id: "e3", from: "server3", to: "msgstore", step: 3, label: "persist first" },
              { id: "e4", from: "registry", to: "server7", step: 4, label: "Bob is on server 7", route: "vertical-first" },
              { id: "e5", from: "server3", to: "server7", step: 4, label: "forward" },
              { id: "e6", from: "server7", to: "bob", step: 5, label: "push over Bob's WebSocket" },
            ],
            steps: [
              { index: 1, caption: "Alice sends a message over her WebSocket to server 3.", nodeIds: ["alice", "server3"], edgeIds: ["e1"] },
              { index: 2, caption: "Server 3 looks up which server holds Bob's connection.", nodeIds: ["server3", "registry"], edgeIds: ["e2"] },
              { index: 3, caption: "The message is durably persisted before anything else — delivery must never depend on a live connection succeeding.", nodeIds: ["server3", "msgstore"], edgeIds: ["e3"] },
              { index: 4, caption: "The registry resolves Bob to server 7, and server 3 forwards the message there.", nodeIds: ["registry", "server7", "server3"], edgeIds: ["e4", "e5"] },
              { index: 5, caption: "Server 7 pushes the message down Bob's open WebSocket.", nodeIds: ["server7", "bob"], edgeIds: ["e6"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: guaranteeing delivery, online or not",
      summary: "Persist before you push — that ordering is what makes offline delivery and crash recovery the same code path.",
      concepts: [
        { slug: "chat-delivery-guarantee", name: "Persist-then-push", summary: "Writing the message durably before attempting live delivery means an offline recipient and a mid-delivery server crash are handled by the exact same recovery mechanism: fetch undelivered messages from the store on reconnect.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "The ordering in the diagram above — persist to the message store before forwarding for live delivery — is deliberate. It means \"the recipient was offline\" and \"the recipient's server crashed mid-delivery\" resolve identically: on reconnect, the client fetches any messages newer than the last one it has, straight from the durable store. There's no separate offline-message queue to keep in sync with the live path — the store is the single source of truth either way.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Group chats fan out like a tiny news feed — the same push-vs-pull tension shows up again.",
      concepts: [
        { slug: "chat-group-fanout", name: "Group message fan-out", summary: "A group message has to reach every member's connection (if online) — for very large groups this becomes the same fan-out problem as the News Feed course, and the same push/pull trade-offs apply.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "A 3-person group chat can just forward a message to the 2 other members directly. A 10,000-member community channel starts to look like the celebrity case in the News Feed course: fanning a single message out to 10,000 live connections (across potentially hundreds of different chat servers) at send time is real load. Large-group and small-group messaging often end up as genuinely different code paths under the hood, even though they look the same to the end user.",
        },
      ],
    },
  ],
};

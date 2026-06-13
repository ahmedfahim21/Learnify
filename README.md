# Learnify 2.0

**An agentic tutor that teaches through generative UI.**

Learnify 1.0 (a 2023 hackathon) generated static AI courses — a loop that's now
a commodity. Learnify 2.0 stops generating *content* and starts generating the
*experience*: an agentic tutor (Claude on AWS Bedrock) that runs live, adaptive
sessions where every screen is streamed as declarative UI and rendered from a
safe client-side widget catalog.

## What it does

- **Generative classroom** — The tutor streams each screen live as declarative
  JSON ([A2UI](https://github.com/google/A2UI)). Explanations, checks,
  flashcards, diagrams, ordering and matching exercises, and code snippets
  render from a vetted widget catalog and adapt in real time to how you answer.
- **Mastery engine** — Every topic decomposes into a prerequisite concept graph.
  Per-concept mastery is tracked with spaced repetition (EMA + SM-2), and a
  daily **Today** dashboard surfaces what's due, what's weak, and your streak —
  turning learning into a habit.
- **Tutor memory** — The tutor remembers *how* you learn across sessions — your
  style, interests, and past misconceptions — so a football fan keeps getting
  football analogies, even on an unrelated topic.
- **Learn from anything** — Attach a PDF, article URL, or YouTube video and the
  tutor teaches grounded in your sources, with citation chips that jump to the
  exact quote, page, or timestamp.
- **Zero-friction demo** — Run a full live session with no login. Sign in to
  persist your mastery graph and memory across devices.

## How it works

A session is an agent loop: Claude emits UI through strict tool calls as A2UI
blocks, the client renders them from a sandboxed widget catalog, and your
interactions (answers, recall ratings, clicks) stream back as the next turn.
Objective answers are graded server-side and feed the mastery engine; attached
sources are passed as citation-enabled context. The renderer only ever
interprets data — it never executes model-authored code.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 ·
`@anthropic-ai/bedrock-sdk` (strict tool-use A2UI emission) · A2UI declarative
UI · Neon Postgres + Drizzle ORM · Supermemory · Vercel

## Getting Started

### Prerequisites

- Node.js 18.18+ (20+ recommended) and npm
- A [Neon](https://neon.tech) Postgres database (required at runtime)
- AWS credentials with Bedrock access to Claude models (required at runtime)

### Setup

1. Clone and install:

   ```shell
   git clone https://github.com/ahmedfahim21/Learnify.git
   cd Learnify
   npm install
   ```

2. Copy the environment template and fill in your keys:

   ```shell
   cp .env.example .env
   ```

   See [`.env.example`](./.env.example) for the full list (AWS Bedrock
   credentials, model IDs, and `DATABASE_URL`).

3. Apply the database migrations to your Neon database:

   ```shell
   npm run db:migrate
   ```

4. Start the dev server and open [http://localhost:3000](http://localhost:3000):

   ```shell
   npm run dev
   ```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:studio` | Open Drizzle Studio |

## Legacy

The 2023 codebase is archived under [`legacy/`](./legacy) with full git history
preserved. Follow the rebuild in
[issue #50](https://github.com/ahmedfahim21/Learnify/issues/50).

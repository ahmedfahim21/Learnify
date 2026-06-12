# Learnify 2.0

**An agentic tutor that teaches through generative UI.**

Learnify 1.0 (2023 hackathon) generated static AI courses. Learnify 2.0 stops
generating content and starts generating the *experience*: an agentic tutor
(Claude on AWS Bedrock) that runs live adaptive sessions where every screen —
explanations, checks, flashcards, diagrams, exercises — is streamed as **A2UI**
declarative JSON and rendered from a safe client-side widget catalog.

> The 2023 codebase is archived under [`legacy/`](./legacy) — git history is
> fully preserved. Track the rebuild in
> [issue #50](https://github.com/ahmedfahim21/Learnify/issues/50).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 ·
`@anthropic-ai/bedrock-sdk` · Neon Postgres + Drizzle ORM · Vercel

## Getting Started

### Prerequisites

- Node.js 18.18+ (20+ recommended)
- npm
- A [Neon](https://neon.tech) Postgres database (optional for builds; required at runtime)
- AWS credentials with Bedrock access (required at runtime)

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

3. Run the database migration against your Neon database:

   ```shell
   npm run db:migrate
   ```

4. Start the dev server:

   ```shell
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (passes with no env vars set) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema (offline) |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:studio` | Open Drizzle Studio |

> A full README rewrite (architecture, demo mode, deployment) lands in Phase 5.

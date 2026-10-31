# Learnify

**Watch an IIT lecture in English, learn it in your language.**

Learnify takes an [NPTEL](https://nptel.ac.in) lecture, keeps the official
video playing in YouTube's embedded player, and builds a learning layer around
it in Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati,
Odia and Punjabi:

- **Subtitles in your language.** English captions are translated with their
  timestamps kept and shown under the video. When NPTEL already has a human
  translation, that's what you see.
- **Checks during the video.** At the right moments the video pauses for a
  short question in your language. If you get it wrong, it replays the part that
  explains it.
- **Ask a doubt by voice.** Pause and ask, for example in Tamil, "why did he
  divide by n here?" The answer is grounded in what the lecturer just said. It
  arrives as a generated explanation card and can be read aloud.
- **Study screens for each lecture.** A concept map, flashcards and a recap.
  Every item links to its timestamp.

Each lecture is processed once per language and cached, so the second student
to open it costs nothing. The build plan and its review are in
[`PLAN.md`](./PLAN.md).

## How it works

| Piece | What does it |
| --- | --- |
| Course bank | NPTEL's own `__data.json` payloads: 3,484 courses, each lesson's YouTube id and caption files (`src/lib/nptel`) |
| Transcript | NPTEL's VTT captions from Google Drive or SWAYAM's bucket, merged into sentence segments (`src/lib/transcripts`) |
| Subtitles | Sarvam `mayura:v1` in `code-mixed` mode, one segment at a time, timestamps never touched (`src/lib/sarvam`) |
| Study material | `sarvam-105b` reads the whole transcript once and returns concepts, checks, flashcards and a recap as strict JSON, then a validator checks every timestamp (`src/lib/study`) |
| Doubt answers | `sarvam-105b-conversations` writes [OpenUI](https://www.openui.com) Lang against Learnify's own component library, validated before it is stored (`src/lib/openui`, `src/lib/doubts`) |
| Voice | Saaras (`codemix`) for spoken doubts, Bulbul to read answers aloud |
| Storage and sign-in | Supabase Postgres via Drizzle, Supabase Auth (Google, GitHub) |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project
- A [Sarvam](https://dashboard.sarvam.ai) API key

### Setup

1. Install, with OpenUI's install-time telemetry turned off:

   ```shell
   git clone https://github.com/ahmedfahim21/Learnify.git
   cd Learnify
   OPENUI_TELEMETRY_DISABLED=1 npm install
   ```

2. Copy the environment template and fill it in. Each variable has a comment
   saying where to find it:

   ```shell
   cp .env.example .env
   ```

3. In the Supabase dashboard:
   - enable Google and/or GitHub under **Authentication > Sign In / Providers**
   - add `http://localhost:3000/auth/callback` under **Authentication > URL Configuration > Redirect URLs**

4. Apply the migrations. They create the tables, link them to `auth.users`, and
   turn on row-level security:

   ```shell
   npm run db:migrate
   ```

5. Start the dev server and open [http://localhost:3000](http://localhost:3000):

   ```shell
   npm run dev
   ```

## Testing

```shell
npm test
```

```shell
npm run typecheck
```

```shell
npm run lint
```

Unit tests cover NPTEL decoding against saved real payloads, caption parsing
against real NPTEL tracks, the Sarvam client with a mocked network,
translation alignment, study-pack validation, the API routes, and a check that
every table has row-level security.

To check model quality on real lectures, run the Sarvam spike. It calls Sarvam,
so it needs `SARVAM_API_KEY`, and writes `spike-output/report.md`:

```shell
OPENUI_TELEMETRY_DISABLED=1 npx tsx --env-file=.env --tsconfig tsconfig.json scripts/spike.ts
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run the unit tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:migrate` | Apply migrations (uses `DIRECT_URL`) |
| `npm run db:studio` | Open Drizzle Studio |

## Licence of the content

Lectures are by IIT and IISc faculty via NPTEL, under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Translations and study material Learnify generates from them are shared under
the same licence.

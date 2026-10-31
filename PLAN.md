<!-- /autoplan restore point: /Users/ahmedfahim/.gstack/projects/ahmedfahim21-Learnify/system-design-pivot-autoplan-restore-20261031-170338.md -->
# Learnify: IIT lectures in your language

> Watch an IIT lecture in English, learn it in your language.

Learnify takes an NPTEL lecture, keeps the official video playing in YouTube's embedded player, and builds a layer of learning around it: subtitles in the student's language, checks that pause the video at the right moment, spoken doubts answered from what the lecturer just said, and study screens (concept map, flashcards, recap) where every item jumps back to its timestamp.

## 0. What we found before planning

These change the plan, so they come first.

1. **NPTEL already publishes structured data.** NPTEL's own website (nptel.ac.in, not Learnify) is built with SvelteKit, and every page on it has a `__data.json` twin. Learnify stays a Next.js app and only reads that JSON:
   - `https://nptel.ac.in/courses/__data.json` returns all **3,484 courses** with `id`, `title`, `professor`, `instituteName`, `disciplineId`, `contentType`, plus 26 disciplines and the institutes.
   - `https://nptel.ac.in/courses/{courseId}/__data.json` returns `courseOutline.units[].lessons[]` with `name`, **`youtube_id`**, and **`vtt_url`**: a map of language → Google Drive file id.
   - The JSON uses SvelteKit's devalue encoding (flat array plus index references). Learnify decodes it with about 20 lines of its own (`src/lib/nptel/decode.ts`) rather than adding a Svelte dependency.
2. **NPTEL ships human-made transcripts, often already translated.** For course 106106127 (Programming, Data Structures and Algorithms using C, IIT Madras), 60 of 61 lessons have English VTT and 60 have Tamil VTT. Hindi, Malayalam and Telugu exist too. `drive.google.com/uc?export=download&id=<id>` returns plain `WEBVTT`. Human captions beat YouTube auto-captions, and a human Tamil track beats any machine translation.
3. **Caption code exists in history.** `src/lib/sources/youtube.ts` in commit `c05a76c` has `parseYouTubeId`, a two-extractor fallback chain (`youtube-caption-extractor`, then `youtube-transcript-plus`), entity decoding and timestamped chunking. It was removed in `3594aef`. We restore the parts we need, without the `catch {}` blocks that swallow errors.
4. **Sarvam's surface** (docs read 2026-10-31):
   - `POST /v1/chat/completions` serves `sarvam-105b` (128K context) and `sarvam-105b-conversations` (32K). It supports `response_format: json_schema` (strict structured output), tools, `stream: true` and `reasoning_effort`. Auth uses the `api-subscription-key` header.
   - `/translate`: `mayura:v1` (11 languages, 1,000 characters, has a `code-mixed` mode) and `sarvam-translate:v1` (22 languages, 2,000 characters, formal only).
   - `/speech-to-text`: `saaras:v3` has a `codemix` mode, meaning Indic words in native script and English terms in Latin script. That fits "why did he divide by n here?". REST is meant for audio under about 30 seconds.
   - `/text-to-speech`: `bulbul:v3` takes up to 2,500 characters and returns base64 WAV. It covers 11 languages (10 Indic plus English).
5. **OpenUI** (`@openuidev/react-lang` 1.0.2, `@openuidev/lang-core` 1.0.2, MIT):
   - Components are declared with `defineComponent({ name, description, props: z.object(...), component })` and grouped with `createLibrary({ root, components, actions })`. `library.prompt()` generates the system prompt, and `<Renderer response library isStreaming onAction onError />` renders the stream.
   - lang-core also exports `parse`, `validate`, `createStreamingParser` and `jsonToOpenUI`, so the server can validate model output before caching it.
   - The Thesys gateway is optional. We call our own model and validate the output ourselves.
   - Zod is already a dependency (`zod ^4.4.3`). lang-core has a `postinstall` telemetry hook. Before installing, find its opt-out env var and document it.

## 1. Scope

### 1a. Archive the system-design product

The system-design course site, its content and its tutor all go. The archive is a git tag, not a folder:

- `git tag archive/system-design <HEAD>`, then push the tag.
- Delete:
  - `src/content/systemDesign/**`, `src/content/site/**`
  - `src/lib/sims/**`, `src/lib/concepts.ts`, `src/lib/progress.ts`, `src/lib/content/**`
  - `src/components/course/**`, `src/components/classroom/**` (diagram, simulators, widgets, A2UI renderer), `src/components/gallery/**`, `src/components/site/**`
  - `src/lib/a2ui/**`, `src/lib/agent/**` (the A2UI tutor loop)
  - `src/app/concepts/**`, `src/app/gallery/**`, `src/app/session/**`, `src/app/api/sessions/**`, `src/app/api/problems/**`, `src/app/api/progress/**`
- Also delete `legacy/` (the v1 Python/Vite app). Git history keeps it.
- The new product starts on a **fresh Supabase project**, so nothing gets dropped. The old Neon database stays untouched as the data archive. `drizzle/` is reset to one baseline migration for the new schema. The old Neon migrations stay in git history under the tag.
- Drop Supermemory (`src/lib/memory/**` and the `supermemory` dependency).
- Rewrite the README and `package.json` description for the new product, with no version numbers or history.

### Kept and repurposed

- Drizzle stays as the ORM. Driver and auth move to Supabase (see 1e).
- `generation_usage` and `src/lib/budget.ts`, which now caps doubts per user per day.
- The SM-2 scheduler (`src/lib/mastery/schedule.ts`), which now schedules flashcard reviews.
- `mastery` and `review_events`, recreated keyed on `flashcard_id` + `lecture_id` in the baseline.

### 1e. Database and auth: Supabase replaces Neon

- **DB driver:** `drizzle-orm/postgres-js` with `postgres` (postgres.js), replacing `drizzle-orm/neon-http` and `@neondatabase/serverless`.
  - The runtime connects through the Supavisor **transaction pooler** (port 6543) with `prepare: false`, since that mode doesn't support prepared statements.
  - `drizzle-kit migrate` uses the **direct** connection (`DIRECT_URL`, port 5432).
  - Real transactions are available now. Job claims still use a single statement because it's simpler, and `db.transaction` is there where several writes have to land together.
- **Auth:** Supabase Auth (Google + GitHub, set up in the Supabase dashboard) through `@supabase/ssr`. It replaces `@neondatabase/auth`.
  - `src/lib/auth.ts` becomes `getUser()` built on `createServerClient` and cookies.
  - `middleware.ts` refreshes the session.
  - `authClient.ts` uses `createBrowserClient` for sign-in and sign-out.
  - The `user_id` foreign keys point at `auth.users(id)`, declared in SQL like the current `0008_neon_auth.sql`. `schemaFilter: ["public"]` stays, so drizzle-kit never touches the `auth` schema.
- **RLS:** Supabase exposes `public` tables over PostgREST to anyone holding the publishable key. Every table gets **RLS enabled with no policies**, so PostgREST is closed and all reads and writes go through our API routes using the server-side Postgres role. `src/db/rls.test.ts` fails if any table in `schema.ts` lacks `ENABLE ROW LEVEL SECURITY` or its `auth.users` foreign key in a migration.
- **Keys:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's newer publishable key, replacing the anon key). The `NEXT_PUBLIC_` prefix is required for the browser client.
- **Archive step as built:** the baseline has only `generation_usage` and `streaks`. `mastery` and `review_events` are created with `lectures` and flashcards (step 2 onward), because their foreign keys need those tables. `engine.ts`, `/today` and `/me` were concept-based and were removed; the pure SM-2 code (`schedule.ts`, `update.ts`) stays for flashcards.
- The secret (service-role) key is **not used**, so it never enters env or the bundle.
- **Users:** existing Neon Auth accounts don't carry over. Everyone signs up again on the new product.
- **Dependencies:** remove `@neondatabase/auth` and `@neondatabase/serverless`. Add `@supabase/supabase-js`, `@supabase/ssr` and `postgres`.
- `streaks`.
- `/today`, which becomes "flashcards due today across your lectures".
- The design system (`globals.css`, the fonts), `TopNav`, `Footer`, `Markdown`.
- `@xyflow/react`, for the concept map.
- `src/lib/bedrock.ts`. It is kept only as an alternative generator for OpenUI screens if `sarvam-105b` fails the eval (see 4f).

### 1b. The new product: four features

1. **Subtitles in your language.** A subtitle bar under the player shows the current segment in the chosen language, with an optional dimmer English line. A transcript tab lists every segment, highlights the current one, and seeks to a segment on tap.
2. **Checks during the video.**
   - At generated checkpoint times, the player pauses and a short MCQ appears in the student's language.
   - A correct answer resumes the video.
   - A wrong answer seeks to `replayFrom`, plays to `replayTo`, then asks the same question again with the options shuffled.
   - A second wrong answer shows the explanation and resumes.
   - Checks fire only when playback crosses the time naturally. Seeking past a check never fires it.
3. **Ask a doubt by voice.**
   - Hold to record (25 s cap). The audio goes through Saaras `codemix` and the transcription appears for confirmation or edit before it is sent.
   - The answer is grounded in the transcript window around the current time. It streams in as an OpenUI explanation card in the student's language, with timestamp chips that seek the video. A "Read aloud" button calls Bulbul.
   - Typed doubts work the same way.
4. **Study screens per lecture**:
   - concept map (React Flow, prerequisite edges)
   - flashcards (SM-2 for signed-in users)
   - recap

   Every item carries `startSec`, and tapping it seeks the player.

### 1c. Course bank: choosing what to show from 3,484 courses

- **Index everything, process nothing up front.** `scripts/nptelSync.ts` pulls the course list (one 886 KB JSON) into `courses`. It is safe to re-run.
- **Lecture outlines are fetched on first visit** to a course page and stored in `lectures`.
- **Lecture processing (transcripts, translation, study pack) runs when the first student opens the lecture in that language.** Later students read it from Postgres.
- **Featured shelf.** `scripts/warmFeatured.ts` pre-processes about 12 courses so the first visit is instant. The list is chosen by rule, not by hand:
  - `contentType = "Video"`
  - at least 90% of lessons have `youtube_id` and an English VTT
  - prefer disciplines "Basic courses-Sem 1 and 2", Computer Science, Mathematics, Electrical and Physics
  - prefer courses with existing human Indic VTTs
  - only the first 3 lectures of each course are warmed
- **The browse page** has discipline filters, search over title, professor and institute, and per-course badges for which languages have human transcripts.

### 1d. Languages

The launch set is English plus the 10 Indic languages supported by both `sarvam-105b` chat and Bulbul: Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Odia and Punjabi. Assamese and the rest are possible for subtitles (`sarvam-translate:v1` covers 22) but not for voice, so they are out of the launch set.

## 2. How it fits together

```
                 nptel.ac.in/__data.json            drive.google.com (VTT)       YouTube captions
                          │                                  │                          │
                 scripts/nptelSync.ts               lib/transcripts/nptelVtt.ts   lib/transcripts/youtube.ts
                          ▼                                  └──────────┬───────────────┘
   courses ◀── lib/nptel/{decode,client}.ts ──▶ lectures               ▼
                                                     lib/transcripts/resolve.ts  (source chain, merge cues → sentences)
                                                               │
                                     transcripts(lectureId, lang, source=nptel|youtube|sarvam)
                                                               │
                 ┌─────────────────────────────────────────────┼────────────────────────────────┐
                 ▼                                             ▼                                ▼
   lib/sarvam/translate.ts (sarvam-105b,          lib/study/generate.ts (sarvam-105b,     lib/doubts/answer.ts
   json_schema, id-aligned batches)               json_schema, whole transcript)          (window ±, OpenUI Lang stream)
                 │                                             │                                │
                 ▼                                             ▼                                ▼
         transcripts(lang)                        study_packs(lectureId, lang)          doubts(userId, lectureId, atSec)
                                                               │                                │
                                                 lib/openui/library.tsx  ◀───────────────────────┘
                                                 (ConceptMap, Flashcard, Checkpoint, Recap,
                                                  ExplanationCard, TimeChip, Steps, Formula)
                                                               │
     app/lecture/[lectureId]/page.tsx ── components/player/YouTubePlayer.tsx (IFrame API: getCurrentTime, seekTo)
                                       ── SubtitleBar, CheckpointOverlay, DoubtSheet, StudyTabs
     Voice: /api/voice/transcribe → Saaras v3 codemix      /api/voice/speak → Bulbul v3
```

### 2a. Data model (Drizzle; camelCase fields mapped to snake_case columns, as the repo already does)

| table | key fields | notes |
|---|---|---|
| `courses` | `id` (NPTEL int, PK), `title`, `professor`, `institute`, `disciplineId`, `contentType`, `humanLangs text[]`, `syncedAt` | from the list sync; `humanLangs` filled after the outline fetch |
| `lectures` | `id` uuid, `courseId`, `unitName`, `position`, `title`, `youtubeId`, `vttIds jsonb` (lang → driveId), `durationSec` | unique `(courseId, position)` |
| `transcripts` | `lectureId`, `lang`, `source` (`nptel`, `youtube` or `sarvam`), `segments jsonb` (`[{i,startSec,endSec,text}]`), `status`, `error`, `model`, `promptVersion` | unique `(lectureId, lang)`; `status` is `pending`, `ready` or `failed` |
| `studyPacks` | `lectureId`, `lang`, `payload jsonb`, `status`, `error`, `model`, `promptVersion` | unique `(lectureId, lang, promptVersion)`; English is canonical, other languages are translations of it |
| `doubts` | `userId`, `lectureId`, `atSec`, `lang`, `question`, `answerOpenui text`, `model`, `createdAt` | per user; also the history list |
| `checkpointAttempts` | `userId`, `lectureId`, `checkpointId`, `correct`, `attempt` | feeds the recap ("you missed 2 checks") |
| `mastery` and `reviewEvents` | re-keyed onto `flashcardId` (stable `lectureId:index`) | SM-2 |

**Concurrency.** The first request inserts a `pending` row and wins on the unique constraint (`ON CONFLICT DO NOTHING RETURNING`). Any other request polls the status (client polls every 2 s while the UI shows a progress skeleton). A pending row older than 5 minutes counts as stale, and the next request takes it over.

### 2b. Transcript pipeline

1. **English source chain:**
   - The NPTEL English VTT (Drive) comes first.
   - If it is missing, use `youtube-caption-extractor`, then `youtube-transcript-plus`, as in the old code.
   - If both fail, the lecture is marked `failed` with a readable reason, and the UI says "No transcript for this lecture yet". There is no manual paste, because paste only made sense for custom sources.
   - Each failure is logged with `lectureId`, source and HTTP status.
2. **Parse the VTT** (our own parser, about 40 lines, tested against real NPTEL files). Then **merge cues into sentence segments**:
   - NPTEL cues break mid-sentence ("…I am Shankar Balachandran from the Computer / Science Engineering Department…").
   - Merge until terminal punctuation or a 30 s cap (real NPTEL cues already run ~16 s).
   - A segment keeps the first cue's `startSec` and the last cue's `endSec`.
   - This makes translation better and keeps subtitle timing honest.
3. **Target language:**
   - If NPTEL has a human VTT for that language, use it (`source = nptel`). The UI labels it "Human translation by NPTEL".
   - Otherwise translate the English segments with **Sarvam `/translate` (`mayura:v1`, `code-mixed`)**, which the spike chose (see section 6):
     - one call per segment, 4 running at once, so about 8 s for 30 segments
     - segments over 1,000 characters are split at word boundaries, never truncated
     - timestamps come from the English segments, so they never pass through a model
   - `sarvam-105b-conversations` batch translation stays behind the same interface (`translator: "sarvam105b"`). It is not the default: it returned English untranslated for some Hindi and Kannada segments.

### 2c. Study pack generation

- **One sarvam-105b call** with the full English transcript, with every segment prefixed `[mm:ss]`. A 1-hour lecture is roughly 15–25K tokens, well inside 128K.
- **Strict `json_schema` output:**
  - `concepts[] {id, title, summary, startSec, endSec, prereqIds[]}` (5–12 of them)
  - `checkpoints[] {id, atSec, conceptId, question, options[4], answerIndex, explanation, replayFrom, replayTo}` (one roughly every 6–10 minutes, placed just after a concept is explained)
  - `flashcards[] {id, front, back, startSec}` (8–20)
  - `recap {summary, keyPoints[] {text, startSec}}`
- **Validation (`lib/study/validate.ts`)**, pure and tested:
  - all times fall inside `[0, durationSec]`
  - `replayFrom < replayTo <= atSec`
  - `prereqIds` refer to existing concepts and have no cycles
  - `answerIndex` is in range
  - each `startSec` lands on a real segment
  - A failure is retried once with the validator's errors fed back. A second failure marks the pack `failed`.
- **Other languages:** a second sarvam-105b call translates only the text fields of the English pack (`json_schema` with the same shape and the same ids). `answerIndex` and the timestamps never pass through the model.

### 2d. Screens with OpenUI

- **One library, `lib/openui/library.tsx`:**
  - Components: `Stack`, `ExplanationCard`, `Steps`, `Formula`, `TimeChip`, `ConceptMap`, `Flashcard`, `FlashcardDeck`, `Checkpoint`, `Recap`, `Callout`.
  - Actions:
    - `seek(sec)` (player `seekTo`)
    - `askFollowUp(text)`
    - `rate(flashcardId, quality)` (calls `/api/flashcards/review`)
    - `answer(checkpointId, index)` (graded on the server through `/api/checkpoints/answer`, so the answer key never reaches the client)
- **Study screens:** the validated `studyPacks.payload` becomes OpenUI Lang through a small typed serializer (or `jsonToOpenUI` if it fits) on the server. The client renders it with `<Renderer>`. No model is involved at render time, so one library covers both static and generated screens.
- **Doubt answers:** sarvam-105b streams OpenUI Lang using `library.prompt({ preamble, additionalRules, examples })`, restricted to the doubt group (`ExplanationCard`, `Steps`, `Formula`, `TimeChip`, `Callout`).
  - The server streams the text through to the client.
  - It runs `parse` and `validate` on the final text before storing it.
  - Any `onError` error code is logged with the doubt id.
  - Invalid output shows the error to the user ("couldn't render this answer, retry") rather than silently falling back.

### 2e. Doubt grounding

- **Context sent to the model:**
  - English segments from `atSec - 180` to `atSec + 20`
  - the same window in the student's language
  - the concept list with times
  - the lecture title
- **Rules:**
  - Answer from the window first, then from general knowledge, marked as such ("Not from this lecture:").
  - Cite at least one `TimeChip` in the window.
  - Answer in the target language with technical terms kept in English.
- **Speech:** Saaras v3 runs with `mode=codemix` and `language_code` set to the student's language. `keyterms` is not supported on v3, so we use v3 for `codemix`. The transcription returns to the client for confirmation before the answer call.
- **Read aloud:** Bulbul v3 with a fixed speaker per language. The input is plain text extracted from the card, capped at 2,500 characters and split if longer. Audio is streamed back as `audio/wav` and not stored.

### 2f. Player

- **`components/player/YouTubePlayer.tsx`:**
  - loads `https://www.youtube.com/iframe_api` once
  - uses `enablejsapi=1`, `cc_load_policy=0` and `rel=0`
  - exposes `{ currentTime, seekTo, play, pause, state }` through a context
  - polls time with `requestAnimationFrame` at about 4 Hz while playing
- **`lib/player/checkpointClock.ts` (pure):** given `prevTime`, `nowTime`, `seeking`, the checkpoints and the set already done, it returns the checkpoint to fire. A natural crossing (`0 < now - prev < 1.5`) fires. A jump never fires.
- **`lib/player/subtitleAt.ts`:** binary search over the segments.

### 2g. API routes (all called by the app; the UI never queries the DB directly)

| route | does |
|---|---|
| `GET /api/courses?discipline&q&cursor` | browse |
| `GET /api/courses/[courseId]` | course plus lectures (fetches and stores the outline on first call) |
| `POST /api/lectures/[id]/prepare?lang` | starts or joins transcript and study-pack generation; returns status |
| `GET /api/lectures/[id]?lang` | transcript segments, study pack as OpenUI Lang, statuses |
| `POST /api/checkpoints/answer` | grades on the server; returns `{correct, replayFrom, replayTo, explanation}` |
| `POST /api/voice/transcribe` | multipart audio (25 s or less) → `{text, lang}` |
| `POST /api/doubts` | streams an OpenUI Lang answer; counts against the budget |
| `POST /api/voice/speak` | text → WAV |
| `POST /api/flashcards/review` | SM-2 update |
| `GET /api/today` | due flashcards |

**Anonymous users** can watch, see subtitles and study screens, and answer checks with no persistence. Doubts need sign-in, since they cost money per call. The cap is `DOUBT_DAILY_LIMIT` (default 20).

### 2h. Sarvam client

`lib/sarvam/client.ts` is a thin `fetch` wrapper, with no SDK dependency. It covers four calls: chat (plus SSE), translate, stt and tts.

- `SARVAM_API_KEY` is read from env on the server only.
- Timeouts: 60 s for chat and 30 s for STT and TTS.
- 429 and 5xx get exponential backoff (3 tries).
- Every error carries the endpoint, status and the body's `error.message`.

## 3. Pages

- `/`: landing. The hero line, a 20-second looping demo (a real lecture with Tamil subtitles and a checkpoint), the featured shelf and a language picker.
- `/courses`: browse with filters and language badges.
- `/courses/[courseId]`: units and lectures, with a ready badge for each language.
- `/lecture/[lectureId]`:
  - desktop: video on the left, with the subtitle bar under it; tabs on the right for Transcript, Concept map, Flashcards and Recap; a doubt button floating over the video
  - mobile: video sticky on top, subtitles, then the tabs below
- `/today`: due flashcards. Each card has a "watch the moment" chip.
- The language choice is stored in a cookie, and in the user profile once signed in. It can be switched in the player header. Switching re-requests `prepare`.

## 4. Build order (each step is a commit; revised after review, risk first)

0. **Spike** (`scripts/spike.ts`, not shipped).
   - Covers 3 lectures (106106127 L1, one maths lecture, one EE lecture) in Tamil, Hindi and Kannada.
   - Produces:
     - translation samples, sarvam-105b vs Mayura `code-mixed`
     - a study pack
     - 30 doubts as OpenUI Lang, with the `validate` pass rate
   - Grade 30 MCQs by hand.
   - Gate: at least 90% of doubts pass `validate`, and at least 27 of 30 MCQ keys are correct. Otherwise `DOUBT_UI_MODEL=bedrock` and/or Mayura.
1. **Archive.**
   - Tag `archive/system-design` and push it. The Neon database is left as it is, as the data archive.
   - Delete the files and `legacy/`. Remove the `/courses` to `/concepts` 301 in `next.config.ts`.
   - Move `Markdown.tsx` to `components/ui/`.
   - Swap Neon for Supabase:
     - driver, auth, middleware and sign-in
     - reset `drizzle/` to a baseline migration with the kept tables, the `auth.users` FKs and RLS enabled on every table
     - `mastery` and `review_events` keyed on `flashcard_id` + `lecture_id`
   - Rename the budget env to `DOUBT_DAILY_LIMIT`.
   - README stub. Typecheck, lint and tests green.
2. `lib/nptel` decoder, client, Zod shape guard and saved fixtures. `courses` and `lectures` tables, the sync script, and `GET /api/courses` and `GET /api/courses/[courseId]`. **Done.** NPTEL states its licence once, site-wide, in its footer ("Creative Commons Attribution-ShareAlike, CC BY - NC - SA"), so there is no per-course licence to store; the site footer carries the attribution.
3. Transcripts: VTT parser, cue merger, Drive fetch with id regex, size cap and the `WEBVTT` check; the YouTube fallback; the resolve chain. **Done.** As built:
   - One YouTube library (`youtube-caption-extractor`), not two: both call the same YouTube endpoint, so a second adds no resilience. It returns NPTEL's own uploaded captions. Whether YouTube blocks it from Vercel is unverified until deployed.
   - `transcripts` rows exist only when complete; build status and errors move to the jobs table in step 5, rather than `status`/`error` columns here.
   - A human NPTEL track is used only if its length is within 10% of the English; otherwise it is likely a different cut and the lecture is machine-translated.
   - Lectures are keyed by outline position, not NPTEL lesson id: Basic Calculus reuses lesson id 1 for an appended "Live Session" unit.
4. Sarvam client (retry, timeout, SSE). Translator interface and id-aligned batches, checkpointed per batch.
5. Staged jobs: a `jobs` row per `(lectureId, lang, stage)` with `heartbeatAt`. `prepare` claims a job and runs it in `after()`, with `maxDuration = 300`. Conditional-`UPDATE` takeover. Then the study pack generation, the validator, and the `/api/lectures/*` routes.
6. OpenUI library and typed serializer (answer key stripped). Player, subtitle bar, checkpoint panel, study tabs. Indic fonts.
7. Doubts: STT (signed in, metered), the answer stream, TTS (by doubt id), the doubt sheet.
8. Browse, landing, today, and warming the featured shelf.

## 6. Spike results (2026-10-31, `scripts/spike.ts`)

Three lectures: PDSA in C (Tamil), Basic Calculus (Hindi), Intro to IoT (Kannada).

| Gate | Result |
|---|---|
| Doubt answers that validate as OpenUI Lang (target 90% or more) | **30/30 (100%)**, about 0.6 s each on `sarvam-105b-conversations` |
| MCQ answer keys correct (target 90% or more) | **7/7**, graded against the transcript. One replay window ended just before the answer, and one check fired 9 minutes after its explanation. Both are now fixed by validator rules. |

What the spike changed:

1. **Model routing.**
   - `sarvam-105b` always reasons. Reasoning is about 95% of its completion tokens, and 2 sentences took 20 s.
   - `reasoning_effort: "none"` is rejected; the API accepts only `low`, `medium` and `high`.
   - `sarvam-105b-conversations` answers in 0.4 s with no reasoning, but caps output at 8,192 tokens.
   - So: **study packs use `sarvam-105b`** (`low`, 64K budget, 300 s timeout, 40–180 s per lecture, one retry when output is truncated). **Doubts use `sarvam-105b-conversations`.**
2. **Subtitles use Mayura `code-mixed`**, as described in 2b. `105b-conversations` returned untranslated English on some Hindi and Kannada segments, even when retried one segment at a time.
3. **Doubt prompt.** It needed positional-only rules, one worked example, and "answer in the target script". Before that, answers came back in English or romanized Tamil. `Paragraph` now accepts an optional second string, because the model writes one every time.
4. **NPTEL caption refs come in two forms:** Drive ids (older courses) and `gs://swayam-node1-production.appspot.com/...` paths (newer courses, served publicly at `storage.googleapis.com`). Both are supported, and only that bucket is allowed.
5. **Dead links are real.** Basic Calculus L1's English VTT returns 404 on Drive. The YouTube fallback in 2b is needed, not optional.
6. **Real NPTEL cues already run about 16 s.** The merge cap is 30 s.
7. **Study pack rules added:**
   - replays must be 10–150 s
   - a check fires within 180 s of its replay
   - `replayTo` snaps to the end of the segment it lands in

## 5. Environment

```
SARVAM_API_KEY=            # required
DATABASE_URL=              # required: Supabase transaction pooler (port 6543)
DIRECT_URL=                # drizzle-kit migrations: direct connection (port 5432)
NEXT_PUBLIC_SUPABASE_URL=  # publishable
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # publishable; service-role key is never used
DOUBT_DAILY_LIMIT=20
DOUBT_UI_MODEL=sarvam      # sarvam | bedrock
AWS_BEARER_TOKEN_BEDROCK= / AWS_REGION= / BEDROCK_MODEL=   # only if DOUBT_UI_MODEL=bedrock
```

---

# Review: Phase 1 (CEO, SELECTIVE EXPANSION)

## 0A. Premise challenge

| # | Premise | Verdict | Evidence |
|---|---|---|---|
| P1 | NPTEL's `__data.json` is a usable course bank | Holds, with a guard. It is an internal endpoint of NPTEL's SvelteKit site, with no contract. | 3,484 courses decoded today; robots.txt `Disallow:` is empty |
| P2 | NPTEL VTTs on Drive can be fetched from a server | Holds, but fragile. Drive throttles and can return an HTML interstitial. Fetch each file once, store it, and require the body to start with `WEBVTT`. | fetched English and Tamil files for 106106127 |
| P3 | We may republish derived material | Holds under **CC BY-NC-SA**: attribution, non-commercial, share-alike. Translations and study packs are derivatives, so they carry the same licence. | course page footer: "Distributed under … CC BY - NC - SA" |
| P4 | sarvam-105b is good enough for translation, MCQs and OpenUI Lang | **Unproven.** Move the spike to the front. | none yet |
| P5 | Students want checks that pause the video | Plausible, unproven. Checks get a Skip button and a per-user off switch, and we measure skips. | none |
| P6 | Subtitles are the headline | **Weak.** NPTEL already has human Indic VTTs for many courses, and YouTube auto-translates. The wedge is grounded checks and voice doubts in code-mixed speech, plus the timestamp-level learning data that comes from them. | 60/60 Tamil VTTs on 106106127 |
| P7 | Archiving means deleting from the tree, tag in git | Holds. The new product runs on a fresh Supabase project, so the old Neon DB itself is the row-level archive and nothing is dropped. | user switched to Supabase at the gate |
| P8 | YouTube caption scrapers are a usable fallback on Vercel | **Weak.** They are routinely blocked from cloud IPs and sit in a ToS grey area. They stay second in the chain, fail loudly, and get measured. | old code `c05a76c` already needed a manual-paste escape hatch |

## 0B. What already exists

| Sub-problem | Existing code | Reuse |
|---|---|---|
| YouTube id parsing and caption fallback | `src/lib/sources/youtube.ts` @ `c05a76c` | restore `parseYouTubeId`, `decodeEntities`, the extractor chain (without the `catch {}`) |
| Auth | `src/lib/auth.ts`, `authClient.ts`, `/signin`, `api/auth/[...path]` | as is |
| Spend cap | `src/lib/budget.ts`, `generation_usage`, `api/budget` | rename the limit env to `DOUBT_DAILY_LIMIT`; add a global `GENERATION_DAILY_LIMIT` for lecture prep |
| Spaced repetition | `src/lib/mastery/schedule.ts`, `engine.ts`, `update.ts` | re-key onto flashcards |
| Today queue | `src/app/today`, `components/today/TodayClient.tsx` | swap concept rows for flashcard rows |
| Graph rendering | `@xyflow/react` (already a dependency) | ConceptMap component |
| Route test pattern | `src/app/api/progress/route.test.ts`, `budget/route.test.ts` | same mocking style for new routes |
| Markdown in prose | `components/classroom/Markdown.tsx` | move to `components/ui/Markdown.tsx` before `classroom/` is deleted |

## 0C. Dream state

```
CURRENT                         THIS PLAN                                  12-MONTH IDEAL
system-design course site  ──▶  NPTEL lecture player with Indic subtitles,  ──▶  "pass your NPTEL course in your language":
A2UI tutor, 16 courses          checks, voice doubts, study screens;            checks and flashcards mapped to weekly assignments
                                on-demand processing, cached per lang            and the exam syllabus; moment-level difficulty heatmaps;
                                                                                 distribution through NPTEL Local Chapters
```

## 0C-bis. Implementation alternatives

| Approach | Effort (human / CC) | Risk | Pros | Cons |
|---|---|---|---|---|
| A. Full plan as written, risky parts last | ~4 wk / ~2 days | high: model quality found out late | complete | sunk cost if sarvam-105b underperforms |
| **B. Same scope, risk-first order** (spike → archive → pipeline → player → doubts → study → browse) | ~4 wk / ~2 days | medium | the same product, with the unknowns settled on day 1 | none of note |
| C. Thin slice: 1 course, 3 languages, checks and doubts only | ~1.5 wk / ~1 day | low | fastest proof | drops two of the four features you asked for |

**Chosen: B** (P1 completeness, P6 action). C is the subagent's recommendation and appears at the gate as a taste choice.

## 0D. Scope decisions (selective expansion)

| Proposal | In blast radius? | Decision |
|---|---|---|
| Sarvam spike on 3 lectures before the archive (translation, pack, doubt, OpenUI validate rate) | yes | **accept** (risk-first) |
| Per-course licence and attribution stored and shown, packs marked CC BY-NC-SA | yes | **accept** (licence requirement) |
| Old Neon DB left untouched as the archive (fresh Supabase project) | yes | **accept** |
| Lecture `prepare` for un-warmed lectures requires sign-in, plus a global daily generation cap | yes | **accept** (cost abuse) |
| Skip button and off switch for checks, `checkpointAttempts.skipped` | yes | **accept** |
| Translator interface with sarvam-105b and Mayura `code-mixed` behind it, A/B in the spike | yes, 1 file | **taste**: default sarvam-105b as you asked |
| Assignment and exam mapping ("pass your NPTEL course") | no: needs onlinecourses.nptel.ac.in data | **defer to TODOS** |
| Moment-difficulty heatmap from check attempts | no | **defer to TODOS** |

## 0E. Temporal interrogation

- **Hour 1:** the spike script runs against 3 lectures and prints translation samples, the pack JSON and doubt OpenUI Lang. Decide on the translator and the doubt-UI model.
- **Hour 2–3:** archive the old product, add the NPTEL decoder and the transcript chain with tests.
- **Hour 4–6:** player, subtitles, checks. First end-to-end lecture in Tamil.
- **Hour 6+:** doubts, voice, study screens, browse, warming. What surprises at hour 6+: Drive throttling during warming (fix: a concurrency of 2 with jitter), YouTube embeds disabled on some NPTEL videos (detect `onError` 101/150 and link out).

## 0F. Mode: SELECTIVE EXPANSION (confirmed)

## CLAUDE SUBAGENT (CEO: strategic independence)

Codex is unavailable (binary not installed), so this phase ran `[subagent-only]`. Findings:

- the subtitles-as-headline framing is wrong (high)
- `__data.json` has no contract (high)
- Drive throttling (high)
- licence unverified (critical; since resolved as BY-NC-SA)
- YouTube scrapers are blocked on cloud IPs (high)
- sarvam-105b quality is untested (high)
- demand for forced pauses is unproven (high)
- dropping tables before the new product exists (critical)
- Mayura dismissed too quickly (high)
- Bedrock fallback keeps a second provider alive (medium)
- scope too wide with risky parts last (high)
- anonymous `prepare` is a cost-abuse risk (high)

```
CEO DUAL VOICES — CONSENSUS TABLE (subagent-only):
  Dimension                             Claude(primary)  Subagent   Consensus
  1. Premises valid?                    mostly           4 weak     CONFIRMED weak: P4, P6, P8
  2. Right problem to solve?            yes              reframe    DISAGREE → taste (exam wedge deferred)
  3. Scope calibration correct?         yes              too wide   DISAGREE → taste (option C)
  4. Alternatives sufficiently explored? no (Mayura)     no         CONFIRMED → A/B in spike
  5. Competitive/market risks covered?  no               no         CONFIRMED → wedge = checks + doubts
  6. 6-month trajectory sound?          with snapshot    no         CONFIRMED → snapshot + risk-first
```

## Sections 1–10 (CEO lens)

1. **Architecture.** On-demand processing with a unique-constraint lock is right for a 3,484-course bank. The coupling risk is the NPTEL decoder. It gets a Zod guard on the decoded shape so a format change fails with "NPTEL data format changed: missing courseOutline.units" instead of rendering empty pages.
2. **Error and rescue.** See the registry below. Gap found: Drive returning an HTML interstitial with status 200. Rescued by the `WEBVTT` prefix check.
3. **Security.**
   - Anonymous `prepare` was a cost hole. Fixed: sign-in plus a global cap.
   - Audio upload: 25 s / 2 MB cap, mime allowlist.
   - The checkpoint answer key stays on the server.
   - Model output is only ever parsed by OpenUI's parser, never executed, so prompt injection inside a transcript can't run code.
   - `SARVAM_API_KEY` lives only on the server.
4. **Data flow edge cases:**
   - a lecture with no `youtube_id` (hidden from the list)
   - a video with embedding disabled (link out to YouTube)
   - a VTT whose timing drifts from the YouTube cut (shown as-is; a per-lecture offset is logged as a TODO)
   - the language switched mid-video (subtitles swap at the current time)
   - two checkpoints within 2 s (merged by the validator)
   - a doubt at t < 180 s (the window is clamped at 0)
5. **Code quality.** One way per thing:
   - OpenUI replaces A2UI entirely
   - a thin `fetch` client for Sarvam, no SDK
   - one VTT parser
6. **Tests.** Covered in Phase 3.
7. **Performance.** Pack generation runs about 30–90 s on first open. The UI shows staged progress ("Fetching transcript → Translating 120/340 → Building study pack") rather than a spinner. Later opens are one indexed read.
8. **Observability.** Every Sarvam call logs `{lectureId, lang, endpoint, ms, status, tokens}`. Failed rows keep `error`. `/api/lectures/[id]` returns statuses so failures are visible in the UI.
9. **Deploy.** There are no destructive migrations: the new schema is a baseline on a fresh Supabase project, and Neon stays read-only as the archive. The Supabase-specific risk is PostgREST exposure, covered by RLS on every table plus a test.
10. **Trajectory.** Reversibility 4/5 (the tag plus the snapshot). Debt: the undocumented NPTEL endpoint and the YouTube scraper.

### Error & Rescue Registry

| Failure | Detected by | Rescue | User sees |
|---|---|---|---|
| NPTEL `__data.json` shape change | Zod guard in `decode.ts` | throw, log the path | "Course data unavailable" plus the error id |
| Drive 429 or HTML interstitial | status / `WEBVTT` prefix | 3 retries with backoff, then the YouTube source | progress continues, or "No transcript yet" |
| YouTube extractor blocked | thrown error | mark `failed`, log | "No transcript for this lecture yet" |
| Translation id mismatch | set compare | split the batch and retry once | if still bad: "Tamil subtitles failed, retry" |
| Pack validation fails twice | `validate.ts` | mark `failed` | Study tabs show the error and a Retry button |
| Sarvam 429/5xx | status | 3× exponential backoff | staged progress pauses |
| Invalid OpenUI Lang in a doubt | `validate` / `onError` | none (no fallback) | "Couldn't render this answer" plus Retry |
| STT on silence or empty audio | empty text | none | "Didn't catch that, try again" |
| Embed disabled (YT error 101/150) | player `onError` | none | "Open on YouTube" link, study screens still work |
| Doubt budget exhausted | `budget.ts` | none | "20 doubts used today, resets 05:30 IST" |

### Failure Modes Registry

| Mode | Likelihood | Impact | Critical gap? |
|---|---|---|---|
| NPTEL endpoint changes | medium | catalog stale, new lectures fail | no (snapshot in DB) |
| sarvam-105b emits bad OpenUI Lang | medium | doubts broken | **yes until the spike**; the switch is `DOUBT_UI_MODEL` |
| MCQ answer key wrong | medium | erodes trust | **yes**: the spike grades 30 MCQs by hand; a "Report this question" action ships |
| Drive throttles warming | high | slow warm | no |
| Licence complaint | low | takedown | no (attribution and NC observed) |

## NOT in scope

- assignment and exam mapping
- difficulty heatmaps
- offline or downloaded video
- languages beyond the 11
- native mobile app
- NPTEL+ / SWAYAM sign-in
- per-lecture caption offset correction

## Dream state delta

This plan delivers the player-centred learning layer. It does not reach the exam-outcome product. The next step after it is mapping checks to weekly assignment topics.

## CEO completion summary

```
  | Mode selected        | SELECTIVE EXPANSION                                   |
  | System Audit         | NPTEL __data.json + Drive VTTs + CC BY-NC-SA found    |
  | Step 0               | risk-first order (B); 5 accepted, 1 taste, 2 deferred  |
  | Section 1  (Arch)    | 1 issue (decoder guard)                               |
  | Section 2  (Errors)  | 10 paths mapped, 1 gap fixed (HTML interstitial)      |
  | Section 3  (Security)| 3 issues, 1 high (anon prepare) fixed                 |
  | Section 4  (Data/UX) | 6 edge cases mapped, 0 unhandled                      |
  | Section 5  (Quality) | 0 issues                                              |
  | Section 6  (Tests)   | → Phase 3                                             |
  | Section 7  (Perf)    | 1 (first-open latency → staged progress)              |
  | Section 8  (Observ)  | 0 gaps after call logging                             |
  | Section 9  (Deploy)  | 1 risk (irreversible drop → snapshot)                 |
  | Section 10 (Future)  | Reversibility 4/5, debt 2                             |
  | Section 11 (Design)  | → Phase 2                                             |
  | Outside voice        | claude subagent only (codex unavailable)              |
  | Lake Score           | 6/7 chose complete option                             |
```

---

# Review: Phase 2 (Design)

**Step 0.** Initial design completeness was **4/10**. There is no DESIGN.md, but `globals.css` is a real system: IBM Plex, weightless hierarchy, a 3px radius, named accents. We reuse it. The plan described pages but not states, placement or Indic typography.

## CLAUDE SUBAGENT (design: independent review)

Ran `[subagent-only]`. Codex unavailable. 4 critical, 10 high, 7 medium. Folded in below.

```
DESIGN LITMUS SCORECARD (subagent-only):
  Dimension                    Primary  Subagent  Consensus
  1. Hierarchy specified?      no       no        CONFIRMED → fixed in Pass 1
  2. States complete?          no       no        CONFIRMED → Pass 2
  3. Journey survives errors?  partly   no        CONFIRMED → Pass 3
  4. Specific, not generic?    no       no        CONFIRMED → Pass 4
  5. Design-system aligned?    yes      partly    CONFIRMED (fonts gap)
  6. Responsive + a11y?        no       no        CONFIRMED → Pass 6
  7. Decisions resolved?       no       no        3 taste items at the gate
```

## Pass 1: Information architecture (3 → 8)

`/lecture/[id]` reading order:

1. The video.
2. The subtitle line in the student's language, with the English line beneath it in `--color-mist`.
3. One controls row:
   - language switch
   - source label ("Human translation · NPTEL" or "Machine translated · Sarvam", mono eyebrow style)
   - `Ask a doubt` (lucide `Mic`)
   - check progress ("2 of 6 checks")
   - a `?` shortcuts button
4. Tabs: Transcript (default), Concept map, Flashcards, Recap.

Placement:

- **Nothing overlays the iframe.** The floating doubt button is removed.
- Checks open in the tab region on desktop and in a bottom sheet on mobile.
- On mobile, the video and the subtitle bar form one sticky block. Doubt and checks open as bottom sheets that pause the video and leave it visible.

## Pass 2: Interaction states (2 → 8)

| Surface | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Lecture (first open) | the video plays at once. English subtitles appear as soon as the English VTT lands, with staged text: "Fetching transcript", "Translating 120/340 lines", "Building checks" | no English transcript: subtitle bar, checks and study tabs are **hidden**, with a single line of why | per stage: message plus Retry | Tamil swaps in at the current time with no layout shift (the bar has a fixed 2-line height) |
| Language switch | the old track stays, with "Preparing Hindi…" inline | n/a | "Hindi failed: Retry", old track kept | n/a |
| Checks | "Checks loading" in the controls row; checks never fire before the pack is ready | lecture with 0 checks: the counter is hidden | pack failed: counter replaced by Retry | n/a |
| Study tabs | a skeleton the size of the final content | n/a | Retry inside the tab, tab still visible | each tab has its own status |
| Doubt | a recording ring with a 25 s countdown and level meter; the answer streams in place | n/a | STT, TTS or network failure keeps the audio: Retry or "Type instead" | invalid OpenUI: "Couldn't render this answer: Retry" |
| Doubt budget | n/a | n/a | button **disabled before recording**: "20 of 20 doubts used today · resets 05:30 IST" | at 5 or fewer left: "4 doubts left today" |
| Signed out | n/a | n/a | the doubt button opens sign-in and returns to the same `?t=` | n/a |
| Mic denied | n/a | n/a | an inline browser-specific hint, the typed field focused, the mic button **hidden** (not dead) | n/a |
| Embed blocked (101/150) | n/a | n/a | "This video can't play here: Open on YouTube"; study tabs still work | n/a |

## Pass 3: Journey and emotional arc (4 → 8)

Following a Tamil first-year student:

1. They land on the hero ("Watch an IIT lecture in English, learn it in your language").
2. They pick தமிழ் once.
3. They open a featured lecture and it plays straight away.
4. The first check comes about 7 minutes in.
5. A wrong answer shows, in neutral `--color-warn` (never alert red): "Let's hear that part again · 05:12–06:40". A mini range bar shows the replay span, with a "Skip replay" option.
6. They ask a doubt with tap to start and tap to stop (not hold, which is unreliable on budget Android).
7. The codemix transcription is shown, editable. Send is primary and nothing is auto-sent.
8. The answer card cites "04:58", and tapping it seeks the video.

A "Turn off checks" option lives in the controls overflow and is saved per user.

## Pass 4: AI-slop risk and specificity (3 → 8)

- **Fonts:** `next/font` Noto Sans Tamil, Devanagari, Bengali, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi and Oriya. Only the active language's font loads, with `display: swap`, mapped through `:lang(ta)` and the others onto `--font-indic`. Today `layout.tsx` loads Plex with `subsets: ["latin"]` only.
- **Subtitle line:**
  - 20–22px on desktop and 18px on mobile, about 1.15× the Latin size
  - `line-height: 1.7`
  - at most 2 lines of about 42 characters
  - `overflow-wrap: anywhere`
  - `lang` attribute set
  - on `--color-surface` under the video, for a fixed contrast of 7:1 or more
- **No weight for emphasis anywhere.** The current segment is marked by colour (`--color-signal` rule) and size.
- **Icons:** lucide only (`Mic`, `Square`, `Volume2`, `RotateCcw`, `Languages`, `Keyboard`). The hand-rolled SVG in TopNav is not extended.

## Pass 5: Design-system alignment (6 → 9)

Reuse the tokens. `Formula` uses KaTeX in Plex Mono for surrounding text. `ConceptMap` reuses React Flow with the existing node and edge palette. One addition: `--font-indic`.

## Pass 6: Responsive and accessibility (2 → 8)

- **Shortcuts** on a focusable player wrapper, since the iframe swallows keys:
  - Space/K play
  - J/L ±10 s
  - C subtitles
  - D doubt
  - T transcript
  - `?` overlay
- **Checks:**
  - focus moves to the question heading, announced with `aria-live="assertive"`
  - options are a radiogroup with 1–4 keys
  - Esc does not dismiss
  - focus returns to the player wrapper on resume
- **Subtitle bar** `aria-live="off"`. Transcript rows use `aria-current`. TimeChips are labelled "Jump to 12 minutes 30 seconds".
- **Touch targets:** 44px minimum.
- **Reduced motion:** extends the existing `prefers-reduced-motion` blocks to auto-scroll (jump instead of smooth), sheets and the recording ring.

## Pass 7: Unresolved design decisions (taste, sent to the gate)

1. A dual-line English subtitle on by default, or off? Recommend **on** for the first lecture, remembered after that.
2. Should check wrong-answer replays auto-seek, or ask first? Recommend **auto-seek with "Skip replay"**.
3. Landing hero: a looping real-lecture clip (a recorded screen capture asset), or a live embed? Recommend **the recorded clip**, because a live embed autoplays badly.

---

# Review: Phase 3 (Eng)

## Step 0: Scope challenge (code read)

The plan touches about 60 new files and deletes about 180. That is in scope by your request.

Complexity hot spots confirmed in code:

- `next.config.ts` 301s `/courses/*` → `/concepts/*`. This would break the new routes. **Fix in step 1.**
- `src/db/index.ts` uses `drizzle-orm/neon-http`. It moves to `postgres-js` on the Supabase pooler with `prepare: false`. Claims stay single-statement because that's simpler, and transactions are available now.
- `budget.ts` reads `GENERATION_DAILY_LIMIT` and burns a unit before work starts.
- The fonts load Latin glyphs only.
- `mastery` and `review_events` have FKs to `concepts` and `sessions`.
- `devalue` is not installed.
- `package-lock.json` is present. The subagent's claim of "no lockfile" is wrong. CI uses `npm ci`.

## CLAUDE SUBAGENT (eng: independent review)

Ran `[subagent-only]`. Codex unavailable. 4 critical, 6 high, 8 medium, and a 2am test list.

```
ENG DUAL VOICES — CONSENSUS TABLE (subagent-only):
  Dimension                    Primary  Subagent  Consensus
  1. Architecture sound?       no(time) no        CONFIRMED → staged jobs + after()
  2. Test coverage sufficient? no       no        CONFIRMED → test diagram below
  3. Performance risks?        partly   no        CONFIRMED → poll backoff, s-maxage, Sarvam semaphore
  4. Security threats covered? partly   no        CONFIRMED → SSRF guards, metered STT/TTS, key stripping
  5. Error paths handled?      mostly   partly    CONFIRMED → refund on upstream failure
  6. Deployment risk?          snapshot yes       CONFIRMED → redirect removal + snapshot
```

## Section 1: Architecture

```
 browser ──GET/POST──▶ app/api/*  (route handlers, maxDuration 300 on prepare)
                        │
         ┌──────────────┼───────────────────────────────┐
         ▼              ▼                               ▼
 lib/jobs/claim.ts   lib/doubts/answer.ts          lib/voice/{stt,tts}.ts
 (ON CONFLICT /      (SSE passthrough, validate     (Saaras / Bulbul)
  conditional UPDATE, before insert)                     │
  heartbeatAt)           │                               │
         │ after()       ▼                               ▼
         ▼          lib/openui/library.tsx        lib/sarvam/client.ts ◀── semaphore(4) ── SARVAM_API_KEY
 lib/jobs/stages.ts ──▶ english → translate(batch checkpoints) → pack → packTranslate
         │                 │              │                │
         ▼                 ▼              ▼                ▼
 lib/nptel/{decode,client} lib/transcripts/{vtt,merge,resolve} lib/study/{generate,validate,serialize}
         │                                       │
         ▼                                       ▼
   Postgres (Supabase, RLS on, no policies): courses, lectures, jobs, transcripts, studyPacks, doubts, checkpointAttempts, mastery, reviewEvents
```

Decisions:

- **Jobs table** `(lectureId, lang, stage)` unique, with `status`, `heartbeatAt`, `progress jsonb`, `error`. Each stage is idempotent, and translation saves its progress every batch.
- **Claim:** `INSERT … ON CONFLICT DO NOTHING RETURNING`. **Takeover:** `UPDATE … WHERE status='running' AND heartbeatAt < now() - interval '90 s' RETURNING`.
- **Run** in `after()` from `next/server`, chaining the next stage on completion. The `prepare` response returns as soon as the claim is made.
- **Sarvam semaphore:** at most 4 calls in flight per instance, plus `GENERATION_DAILY_LIMIT` as a global cap on lecture-prep stages per day.

## Section 2: Code quality

- **One VTT parser** for NPTEL and YouTube. YouTube output is normalised to the same `Segment`.
- **Write a typed serializer, not `jsonToOpenUI`.** The latter is untyped. The option is dropped.
- **Own devalue decoder** (about 20 lines, fixture-tested, with a Zod guard on the result). This avoids a dependency for a small job. If the fixtures expose custom types (Map, Date), switch to `devalue.unflatten`.
- **Flashcard id** = `sha1(front + startSec)`, stable across regenerations.
- **`engine.ts` is a rewrite, not a re-key.** It is scoped as such in step 1.

## Section 3: Test review

Framework: Vitest, node env, `src/**/*.test.ts`, route tests that mock `@/db`. Following the user's rules: route-level tests, every returned field asserted, before/after state, and proof that only the intended fields changed.

```
CODEPATH / FLOW                                   TEST TYPE        EXISTS?  PLAN
nptel/decode: list + outline fixtures             unit             no       add (fixtures saved from today's fetch)
nptel/decode: shape change → throws               unit             no       add
transcripts/vtt: real NPTEL en+ta, empty, HTML    unit             no       add
transcripts/merge: mid-sentence, ?, !, ।, 12s cap,
  overlapping cues, no final punctuation          unit             no       add
transcripts/resolve: nptel → youtube → failed     unit (mock fetch) no      add
drive fetch: bad id regex, >2MB, HTML 200         unit             no       add
sarvam/client: 429 backoff, timeout, error shape,
  SSE frame split across chunks                   unit (mock fetch) no      add
translate/align: missing i, dup i, empty text,
  echo of English, split recursion floor          unit             no       add
study/validate: every rule pass+fail              unit             no       add
study/serialize: no answerIndex in output         unit             no       add
player/checkpointClock: natural cross, seek, 2x,
  jitter, post-replay suppression, hidden tab     unit             no       add
player/subtitleAt: gaps, before first, after last unit             no       add
jobs/claim: first claim, join, stale takeover,
  two concurrent claims → one winner              unit (mock db)   no       add
POST /api/lectures/[id]/prepare                   route            no       add: anon on unwarmed → 401; claim; join
GET  /api/lectures/[id]                           route            no       add: every field, statuses
POST /api/checkpoints/answer                      route            no       add: right/wrong/unknown, exact fields, no key leak
POST /api/doubts                                  route            no       add: 401, budget 429, upstream 5xx → refund + failed row, invalid OpenUI → failed row
POST /api/voice/transcribe                        route            no       add: anon 401, >1MB 413, bad mime 415
POST /api/voice/speak                             route            no       add: other user's doubt → 404
POST /api/flashcards/review                       route            no       add: before/after, only SM-2 fields changed
GET  /api/today                                   route            partial  rewrite of existing Today logic
budget (renamed env)                              unit             yes      update budget.test.ts
LLM evals: spike (OpenUI validate ≥90%, MCQ ≥27/30) eval script     no       scripts/spike.ts, rerun on prompt change
```

Test plan artifact: `~/.gstack/projects/ahmedfahim21-Learnify/ahmedfahim-system-design-pivot-test-plan-20261031.md`

## Section 4: Performance

- **Poller stampede:** back off at 2, 4, 8, then a 10 s cap. `GET` serves `Cache-Control: s-maxage=3600` once `ready` (keyed by lecture and language; nothing user-specific in it).
- **N+1:** the course page loads lectures in a single query. The `humanLangs` badges come from a stored column, not computed per request.
- **Transcript payload:** about 340 segments × about 80 bytes is roughly 30 KB per language. It is fine inline.
- **Player loop:** `setInterval(250)` instead of rAF, so it keeps ticking in hidden tabs.

## Failure modes (eng)

| Mode | Test? | Error handling? | User sees? | Critical gap |
|---|---|---|---|---|
| Function killed mid-translate | claim test | heartbeat takeover resumes from the last batch | progress resumes | no |
| Two stale takeovers race | concurrent-claim test | single `UPDATE` | n/a | no |
| Answer key leaked in serialized pack | serializer test | stripped | n/a | no |
| SSRF via a crafted `vttIds` | drive fetch test | id regex, fixed host | n/a | no |
| Budget burned on upstream 5xx | doubts route test | refund | "Sarvam is unavailable, this didn't count" | no |
| `/courses` 301 cached in browsers | manual | redirect removed | stale for returning visitors | **noted in PR** |

## Worktree parallelization

After step 1, three lanes can run in parallel: (2+3) data, (4) Sarvam client, (6) player UI against fixtures. Steps 5, 7 and 8 depend on them.

## NOT in scope (eng)

- a queue service (Inngest or QStash)
- caching TTS audio
- word-level subtitle timing
- websocket STT

## Eng completion summary

```
  Step 0: 7 code-confirmed hot spots | Arch: 4 critical fixed | Quality: 5 decisions
  Tests: 24 codepaths, 23 gaps → all planned | Perf: 4 fixes | Failure modes: 6, 0 critical open
  Outside voice: claude subagent only
```

Phase 3.5 (DX) **skipped**: the applicability gate found no developer-facing product (no API, CLI or SDK for others). Contributor setup is covered by the README and `.env.example` in step 1.

## Cross-phase themes

- **Untested model quality.** Flagged in CEO and Eng. Settled by spike step 0.
- **Cost exposure.** Flagged in CEO (anonymous prepare) and Eng (STT/TTS unmetered). All model calls need sign-in except warmed content.
- **First-open latency.** Flagged in CEO and Design. Settled by playing at once plus staged progress.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | 0 | DX phase skipped | mechanical | gate | no developer-facing product | run DX on an end-user app |
| 2 | 0 | Codex voices unavailable → subagent-only | mechanical | P6 | binary not installed | block |
| 3 | CEO | Premises P1–P8 | **user-confirmed** | gate | user replied "yes" | — |
| 4 | CEO | Risk-first build order (B) | mechanical | P1+P6 | same scope, unknowns settled day 1 | A (risky last) |
| 5 | CEO | Thin slice (C) | **taste** | P1 | you asked for 4 features | C → at gate |
| 6 | CEO | Spike before archive | mechanical | P6 | gates model choice | build blind |
| 7 | CEO | Licence and attribution stored and shown | mechanical | P1 | BY-NC-SA requires it | — |
| 8 | CEO | Fresh Supabase project, Neon kept as archive | **user-directed** | gate | you chose Supabase over Neon | Neon |
| 9 | CEO | Prepare for unwarmed lectures needs sign-in plus a global cap | mechanical | P1 | cost abuse | anonymous |
| 10 | CEO | Checks skippable and switchable off | mechanical | P1 | demand unproven | forced |
| 11 | CEO | Translator: Mayura code-mixed default (spike: 105b-conversations left English untranslated in hi/kn) | **data-decided** | P1 | spike section 6 | sarvam-105b default |
| 12 | CEO | Exam/assignment mapping | deferred | P3 | needs other NPTEL data | — |
| 13 | CEO | Archive by git tag, delete `legacy/` | **taste** | P5 | "no history" | `archive/` folder |
| 14 | CEO | YouTube scraper kept as second source, fails loudly | **taste** | user direction | you asked to reuse it; blocked on cloud IPs | drop it |
| 15 | Design | Nothing overlays the iframe | mechanical | P5 | YouTube chrome and slides | FAB |
| 16 | Design | Play immediately, staged progress | mechanical | P1 | 90 s skeleton reads as broken | skeleton |
| 17 | Design | Tap-to-record | mechanical | P5 | hold fails on mobile sheets | hold |
| 18 | Design | Noto Indic fonts per `:lang` | mechanical | P1 | Latin-only today | OS fallback |
| 19 | Design | Dual English line on by default | **taste** | P5 | — | off |
| 20 | Design | Auto-seek replay with Skip | **taste** | P5 | — | ask first |
| 21 | Design | Recorded hero clip | **taste** | P5 | — | live embed |
| 22 | Eng | Staged jobs + `after()` + heartbeat | mechanical | P5 | function time limit | one long request |
| 23 | Eng | Single-statement claim/takeover | mechanical | P3 | simplest correct form on the pooler | read-then-write |
| 24 | Eng | Remove `/courses` 301 | mechanical | P1 | blocks new routes | — |
| 25 | Eng | Recreate mastery in the Supabase baseline keyed on hashed flashcard ids | mechanical | P5 | unstable index ids; fresh DB makes re-keying moot | rename columns |
| 26 | Eng | Typed serializer, strip answer key | mechanical | P5 | `jsonToOpenUI` untyped | jsonToOpenUI |
| 27 | Eng | Own devalue decoder with Zod guard | mechanical | P4/user rule | small, no new dependency | add devalue |
| 28 | Eng | STT/TTS signed-in and metered; TTS by doubt id | mechanical | P1 | cost and abuse | open |
| 29 | Eng | Refund the budget on upstream failure | mechanical | P1 | fairness | burn |
| 30 | Eng | Poll backoff + s-maxage + Sarvam semaphore | mechanical | P3 | stampede | fixed 2 s |
| 31 | Eng | Package manager: stay on npm for this PR | **taste** | P3 | repo has package-lock + CI on npm; your default is pnpm | switch now |
| 32 | Eng | KaTeX for `Formula` (new dependency) | **taste** | user rule: ask | maths-heavy lectures | plain text |
| 34 | Eng | RLS enabled on every `public` table, no policies; service-role key never used | mechanical | P1 | Supabase exposes `public` via PostgREST | open tables |
| 33 | Eng | Keep `bedrock.ts` only as `DOUBT_UI_MODEL` switch; delete if spike passes | **taste** | P4 | one provider if possible | keep both permanently |

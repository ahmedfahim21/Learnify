# Learnify

**Pause any NPTEL lecture and ask. Answers in your language.**

Stuck halfway through one of [NPTEL](https://nptel.ac.in)'s 3,050 free courses from the IITs, IISc and over 100 other institutes? Pause, then say or type your doubt in Hindi, Tamil, Bengali or another Indian language. Learnify answers from what the professor said around that moment, then helps you practise it with quizzes and flashcards from the same lecture.

NPTEL translates some courses itself. Learnify adds what it doesn't have: someone to ask, and something to practise with.

![Landing page](docs/screenshots/landing.png)

| Quiz, in Bengali | Notes, in Tamil |
| --- | --- |
| ![A quiz question answered](docs/screenshots/quiz.png) | ![Notes with a flip card](docs/screenshots/notes.png) |
| **Four-tap setup** | **3,050 courses** |
| ![Choosing a language](docs/screenshots/setup.png) | ![Course catalogue](docs/screenshots/courses.png) |

<img src="docs/screenshots/phone.png" alt="The lecture on a phone" width="260" align="right">

## What it does

- **Doubts, by voice or text:** pause, ask in your language, get an answer grounded in that moment of the lecture: key ideas, comparison tables, worked examples, a quick check, and a jump back to where it was explained.
- **Quizzes that play like a game:** five question types, streaks and points. Every answer key is checked against the lecture before it's saved.
- **Flashcards and a concept map**, with spaced review.
- **Interactive notes:** chapters with key ideas, worked examples and flip cards.
- **Nothing is generated until you ask**, and everything generated is saved and shared with the next student.

## How it's built

- **Next.js 15**, TypeScript, Tailwind v4, Supabase (Postgres and Auth) via Drizzle.
- **[Sarvam AI](https://www.sarvam.ai):**
  - `sarvam-105b` answers doubts, writes notes and quizzes, and checks quiz keys;
  - Sarvam-Translate covers Assamese, Nepali, Konkani, Maithili, Dogri, Sanskrit and Bodo;
  - Saaras v4 turns spoken doubts into text, biased toward the lecture's own terms; Bulbul reads answers aloud.
- **[OpenUI](https://www.openui.com):** the model writes OpenUI Lang against Learnify's own components (`src/lib/openui`), validated before it's stored.
- **Lectures:** NPTEL's course data and captions, played in YouTube's embedded player.

## Run it

You need Node 20+, a [Supabase](https://supabase.com) project and a [Sarvam](https://dashboard.sarvam.ai) API key.

```bash
OPENUI_TELEMETRY_DISABLED=1 npm install
```

```bash
cp .env.example .env
```

Fill in `.env` (each variable says where to find it), enable Google sign-in in Supabase, and add `http://localhost:3000/auth/callback` to its redirect URLs. Then:

```bash
npm run db:migrate
```

```bash
npm run dev
```

## Test it

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

The tests cover the API routes, NPTEL decoding, the Sarvam client, translation, generated-screen checks and answer-key fixes, and that every table has row-level security. `GET /api/health` reports which settings a deployment is missing.

## Licence of the content

Lectures are by NPTEL's faculty under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Study material Learnify generates from them is shared under the same licence.

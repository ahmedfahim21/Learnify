# Legacy Learnify (1.0 — 2023 hackathon)

This directory archives the original Learnify 1.0 codebase, kept for
historical reference. It is **no longer maintained or deployed**.

Learnify 2.0 replaces this with a fresh TypeScript full-stack app at the
repository root — an agentic tutor that teaches through generative UI
(A2UI + Claude on AWS Bedrock). See the root [`README.md`](../README.md)
and the [tracker issue](https://github.com/ahmedfahim21/Learnify/issues/50).

## What's here

- **`client/`** — React + Vite single-page app (the 1.0 frontend).
- **`server/`** — Flask API using the deprecated OpenAI SDK and Stable
  Diffusion for course/quiz/article generation.

These two folders were moved here via `git mv`, so the full development
history is preserved in git and can be inspected with
`git log --follow legacy/...`.

## Running the legacy app

The original setup instructions still apply within each subfolder:

```shell
# Frontend
cd legacy/client
npm install
npm run dev

# Backend (set OpenAI / DreamStudio keys in legacy/server/.env)
cd legacy/server
pip install -r requirements.txt
python main.py
```

# Mission log

## Missing free API keys (the fallback chain handles this; add any to `.env` to enable)

| Variable | Free signup |
|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `OLLAMA_URL` | Install Ollama: https://ollama.com/download, then `ollama pull llama3.2:1b`, set `OLLAMA_URL=http://127.0.0.1:11434` |

## Phase 0 (RECON): EXIT passed

- Built: git repo + GitHub, `.gitignore` first, Python venv, FastAPI Mirage service (`/health`, `/analyze`), model loaded once at startup.
- Ran real Mirage (cactus-compute 4.2.6) on 10 CC-licensed COCO photos; raw outputs in `docs/mirage-samples/`; TS types + zod schema written from them (`lib/vision/types.ts`).
- Provider check: `npm run check:providers` → `docs/PROVIDER_CHECK.md`. No keys configured on this PC, so all cloud providers are skipped and the mock engine serves.
- Tests: pytest 4/4 (health, analyze, bad image, empty image); vitest schema tests over all 10 samples.
- Mirage latency on this laptop CPU: 3.2–6.5 s per photo (NFR-01 logged per scan in `scans.latency_ms`).
- Known issues: see `BLOCKERS.md` (latency vs NFR-02; some wrong labels).

## Phase 1 (LAUNCH): EXIT passed

- Upload → `/api/scan` → Mirage → boxes/mask outlines drawn over the photo.
- Boxes checked on all 10 test photos: well placed on 9/10 (labels wrong on 2: cats as "dog", teddy bears as "bread loaf"; see BLOCKERS B2).

## Phase 2 (ORBIT): EXIT passed

- SQLite file DB (`data/anima.db`, WAL), Drizzle schema + migrations, `db:migrate|seed|reset`.
- Souls, object matcher (label + position + size + OCR), change detector (appeared/moved/vanished/near), scan pipeline.
- Tests (temp DB file): same objects recognised across 2 photos; moved mug → `moved` event; next-day grudge (mood drop + "Was ignored for 1 day." memory); near pairs → relationships.

## Phase 3 (CONTACT): EXIT passed

- Adapter over Groq → Gemini → OpenRouter → Ollama → mock; retry once on 429/timeout/error/bad JSON, then fall through; every call logged in `llm_calls`; identical-prompt cache.
- Streaming SSE (`/api/talk`, `/api/reply`): partial JSON is parsed so bubbles fill word by word; final JSON validated with zod.
- Tests: 3 objects hold a 6-line streamed conversation (recorded response); a 429-ing provider falls back after one retry; timeout and invalid JSON fall to mock; SSE parsing; optional live smoke test (skipped: no keys).

## Phase 4 (LIVE): EXIT passed

- Live camera: frame every 1.5 s (configurable), sent only if a 64×48 greyscale diff changed and no request is in flight (stale frames dropped); voice toggle; speech rate limit.
- Test: simulated camera sequence → appear (all greet) → move (the mug complains) → one missed frame (nothing) → vanish (another object gossips by name).

## Phase 5 (SPECTACLE): EXIT passed

- Three.js stage (mask-polygon glow on hover, sparkles), GSAP bubble pop/glide/hop, collision-free layout, Fredoka + Nunito, cartoon design system.
- Playwright screenshots at 1440 px and 390 px (`docs/screenshots/`), no horizontal scroll.

## Phase 6 (MEMORY): EXIT passed

- Moods (ignored → grumpier, seen/talked to → happier) with history graph; Soul Card (traits, mood graph, relationships, memories, text + voice reply); Diary; Settings.
- Tests: an object's context contains the earlier event ("Got moved by the human without asking."); an ignored object greets grumpily.

## Phase 7 (RE-ENTRY)

- Full pass: `npm run verify` green (lint, typecheck, 40 Vitest, 4 pytest, build); Playwright 8/8 in dev and production builds.
- GitHub Actions CI (verify + e2e), README, demo script, final report, Mirage + LLM latency shown in Settings.
- Fresh-clone test (clone → `cp .env.example .env` → `npm run setup` → `npm run verify` → Mirage `/analyze` on a real photo): first run failed (better-sqlite3 compiled from source, no Visual Studio); fixed with `.npmrc` (DECISIONS 21); second run all green.
- EXIT passed. Tag `v1.0-reentry`.

### Known issues

- Mirage ~4 s per frame on this CPU (BLOCKERS B1), so NFR-02 holds only on faster hardware.
- When the browser tab is hidden, browsers pause animation frames, so bubbles freeze mid-glide until the tab is visible again (expected browser behaviour).
- `THREE.Clock` deprecation warning from drei's `Sparkles` (harmless).

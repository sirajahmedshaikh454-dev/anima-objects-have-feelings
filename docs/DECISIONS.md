# Decisions

| # | Decision | Reason |
|---|----------|--------|
| 1 | Project lives at `Desktop/anima-objects-have-feelings` | The original workspace path was too long for Windows to load Pillow's DLLs from the venv. |
| 2 | Test photos are 10 COCO val2017 images (CC-licensed Flickr photos) in `tests/fixtures/photos/` | Free license, realistic indoor/outdoor scenes. |
| 3 | Mirage bbox/mask are treated as 0–1000 normalized `[x1,y1,x2,y2]` | Observed in every sample (max coord = 1000 on 640 px images). |
| 4 | Mirage `id` is a class-group id (e.g. all chairs share id 6); we assign our own per-detection index | Observed in `coco_000000000139`. Relations reference group ids. |
| 5 | Service downsizes input to 640 px max side | Boxes are normalized so it is lossless for us; latency is ~4 s either way on this CPU. |
| 6 | `MIRAGE_FAKE=1` swaps in a fixture-backed model for pytest/CI | CI must not download weights; tests stay deterministic. |
| 7 | Model defaults: Groq `openai/gpt-oss-20b`, Gemini `gemini-flash-latest`, OpenRouter `openrouter/free`, Ollama `llama3.2:1b`; all overridable in `.env` | Checked against official docs on 2026-11-24: `llama-3.1-8b-instant` moved to Enterprise on Groq; Google's `-latest` alias and OpenRouter's free router don't go stale. |
| 8 | One OpenAI-compatible streaming client for all four cloud/local providers | Groq, Gemini (`/v1beta/openai`), OpenRouter and Ollama (`/v1`) all speak it; fewer moving parts. |
| 9 | Souls (name, 3 traits, voice) are generated in code from label/OCR/colour plus a random seed, not by the LLM | Free, instant, deterministic per seed, and saves free-tier quota for dialogue (NFR-08). |
| 10 | Match score = 0.35 + 0.65 × similarity (position, size, OCR word overlap), same label required; ≥ 0.7 same object, 0.45–0.7 asks "Same mug?", below that new object | A label match alone is weak evidence; tuned so a slightly moved mug matches and a far-moved one asks. |
| 11 | "Vanished" needs 2 consecutive missed live frames | One bad detection shouldn't trigger gossip. |
| 12 | Speech rate limit is booked per turn: next turn waits 3 s × lines spoken | FR-07 "1 line every 3 s overall" while still batching several objects into one LLM call (NFR-08). |
| 13 | Speech bubbles are a DOM layer in the same pixel space as the orthographic Three.js scene (not drei `<Html>`) | drei `<Html>` portals (nested React roots) lost content / errored under React 19 here. A DOM layer keeps text crisp and accessible; Three.js still draws the mask glow and sparkles, GSAP still animates the bubbles. |
| 14 | Bubble collision layout uses each bubble's measured DOM size | Estimated sizes still overlapped. |
| 15 | `cacheComponents` turned off; pages that read the DB call `await connection()` | All data is live and local; the scaffold's caching mode added complexity for no gain. |
| 16 | Tailwind `source(none)` + explicit `@source` folders | Auto-detection scanned `data/anima.db-shm`, which SQLite keeps locked, and crashed Turbopack. |
| 17 | GSD skill not used as an interactive workflow; phases tracked via GitHub Issues, tags and `MISSION_LOG.md` | GSD's discuss/plan steps ask the user questions, which conflicts with the full-autonomy directive (10.1). |
| 18 | ui-ux-pro design system used for palette + fonts (Fredoka/Nunito, orange on cream); its "Swiss minimal" style overridden with a cartoon look | The spec asks for playful/cartoon, explicitly not a SaaS dashboard. |
| 19 | E2E tests run with `ANIMA_FAKE_VISION=1` (replays a real recorded Mirage output) and empty LLM keys | Deterministic, no model download in CI, never spends free-tier quota (9.4). |
| 20 | Fixed test (9.7): `extracts partial line text mid-stream` sliced the recording at 160 chars, before line 2's text began | The code was right; the cut point now lands inside line 2. |

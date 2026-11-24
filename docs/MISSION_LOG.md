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

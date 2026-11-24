# Blockers and workarounds

## B1. NFR-02 (first word < 3 s) is not reachable with Mirage on this laptop's CPU

Mirage takes ~4 s per frame here (Cactus quotes ~74 ms on a phone NPU, ~107 ms on its CPU). Tried:
1. Smaller input (640 → 384 → 256 px): 4.6 s → 4.0 s → 4.2 s, no real gain.
2. `sections: ["objects"]` to skip other output: 4.0 s, no gain.
3. `cactus.set_threads(6 | 12)`: 4.3–4.7 s, no gain.

Workaround: the LLM step starts streaming the moment the scan returns (the mock engine's first word arrives in ~40 ms, Groq is typically < 1 s), the UI shows a "looking…" state immediately, and live mode only sends frames when the scene changed. On hardware where Mirage hits its quoted speed, the 3 s target holds.

## B2. Mirage sometimes mislabels objects

On the test set it called two cats "dog" and teddy bears "bread loaf"; boxes were still well placed (9/10 photos). We use labels as-is (they make for funny characters) and FR-06's "Is this the same …?" prompt covers matching doubt.

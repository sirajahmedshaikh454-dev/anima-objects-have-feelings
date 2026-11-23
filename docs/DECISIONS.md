# Decisions

| # | Decision | Reason |
|---|----------|--------|
| 1 | Project lives at `Desktop/anima-objects-have-feelings` | The original workspace path was too long for Windows to load Pillow's DLLs from the venv. |
| 2 | Test photos are 10 COCO val2017 images (CC-licensed Flickr photos) in `tests/fixtures/photos/` | Free license, realistic indoor/outdoor scenes. |
| 3 | Mirage bbox/mask are treated as 0–1000 normalized `[x1,y1,x2,y2]` | Observed in every sample (max coord = 1000 on 640 px images). |
| 4 | Mirage `id` is a class-group id (e.g. all chairs share id 6); we assign our own per-detection index | Observed in `coco_000000000139`. Relations reference group ids. |
| 5 | Service downsizes input to 640 px max side | Boxes are normalized so it is lossless for us; latency is ~4 s either way on this CPU. |
| 6 | `MIRAGE_FAKE=1` swaps in a fixture-backed model for pytest/CI | CI must not download weights; tests stay deterministic. |

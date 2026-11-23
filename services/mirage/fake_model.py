"""Deterministic stand-in for cactus.Mirage, shaped like docs/mirage-samples."""
import json
from pathlib import Path

SAMPLE = Path(__file__).resolve().parents[2] / "docs" / "mirage-samples" / "coco_000000039769.json"


class FakeMirage:
    def describe(self, image):
        return json.loads(SAMPLE.read_text())["raw"]

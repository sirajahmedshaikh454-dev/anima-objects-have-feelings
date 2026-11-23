import io
import os
import sys
from pathlib import Path

os.environ["MIRAGE_FAKE"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
client.__enter__()  # run startup


def png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 120, 40)).save(buf, "PNG")
    return buf.getvalue()


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["model_loaded"] is True


def test_analyze_ok():
    r = client.post("/analyze", files={"image": ("a.png", png(), "image/png")})
    body = r.json()
    assert r.status_code == 200
    assert body["width"] == 64 and body["height"] == 48
    assert isinstance(body["raw"]["objects"], list) and body["latency_ms"] >= 0


def test_bad_image():
    r = client.post("/analyze", files={"image": ("a.png", b"not an image", "image/png")})
    assert r.status_code == 400


def test_empty_image():
    r = client.post("/analyze", files={"image": ("a.png", b"", "image/png")})
    assert r.status_code == 400

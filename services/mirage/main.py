"""Local Mirage vision service. Images never leave this machine."""
from __future__ import annotations

import io
import os
import threading
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_SIDE = int(os.environ.get("MIRAGE_MAX_SIDE", "640"))
MAX_BYTES = 15 * 1024 * 1024

app = FastAPI(title="ANIMA Mirage service")
_state: dict = {"model": None, "error": None, "load_ms": None}
_lock = threading.Lock()


def _load() -> None:
    # Tests inject a fake model via MIRAGE_FAKE=1 so CI never downloads weights.
    t = time.perf_counter()
    try:
        if os.environ.get("MIRAGE_FAKE") == "1":
            from fake_model import FakeMirage
            _state["model"] = FakeMirage()
        else:
            import cactus
            _state["model"] = cactus.Mirage()
        _state["load_ms"] = round((time.perf_counter() - t) * 1000, 1)
    except Exception as exc:  # report through /health instead of crashing
        _state["error"] = str(exc)


@app.on_event("startup")
def startup() -> None:
    _load()


@app.get("/health")
def health() -> dict:
    return {"ok": _state["model"] is not None, "model_loaded": _state["model"] is not None,
            "load_ms": _state["load_ms"], "error": _state["error"]}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)) -> dict:
    model = _state["model"]
    if model is None:
        raise HTTPException(503, f"model not loaded: {_state['error']}")
    data = await image.read()
    if not data:
        raise HTTPException(400, "empty image")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    try:
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGB")
            width, height = im.size
            im.thumbnail((MAX_SIDE, MAX_SIDE))  # Mirage boxes are 0-1000 normalized, so resizing is safe
            t = time.perf_counter()
            with _lock:
                raw = model.describe(im)
            latency = round((time.perf_counter() - t) * 1000, 1)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(400, f"bad image: {exc}") from exc
    return {"width": width, "height": height, "latency_ms": latency, "raw": raw}

// Cross-platform helper for the Python Mirage service: `setup`, `serve` or `test`.
import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "services", "mirage");
const venv = path.join(dir, ".venv");
const py = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python");
const cmd = process.argv[2] ?? "serve";

const run = (bin, args, extraEnv = {}) => {
  const r = spawnSync(bin, args, { cwd: dir, stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (cmd === "setup") {
  if (!existsSync(py)) run(process.platform === "win32" ? "python" : "python3", ["-m", "venv", ".venv"]);
  run(py, ["-m", "pip", "install", "-q", "-U", "pip"]);
  run(py, ["-m", "pip", "install", "-q", "-r", "requirements.txt"]);
  process.exit(0);
}

if (!existsSync(py)) {
  console.error("Mirage venv missing. Run: npm run setup");
  process.exit(1);
}

if (cmd === "test") run(py, ["-m", "pytest", "-q"], { MIRAGE_FAKE: "1" });
else {
  const port = process.env.MIRAGE_PORT ?? "8765";
  const child = spawn(py, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", port], {
    cwd: dir,
    stdio: "inherit",
    env: { HF_HUB_DISABLE_SYMLINKS_WARNING: "1", ...process.env },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

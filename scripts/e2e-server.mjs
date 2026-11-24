// Starts Next.js for Playwright with a throwaway DB, recorded Mirage output and no cloud LLM keys (mock engine only).
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3100";
const root = path.join(import.meta.dirname, "..");
const dataDir = path.join(root, "data", "e2e");
rmSync(dataDir, { recursive: true, force: true });

const env = {
  ...process.env,
  ANIMA_FAKE_VISION: "1",
  ANIMA_DB_PATH: path.join(dataDir, "anima.db"),
  ANIMA_IMAGES_DIR: path.join(dataDir, "images"),
  // Empty values win over .env, so e2e never spends real free-tier quota.
  GROQ_API_KEY: "",
  GEMINI_API_KEY: "",
  OPENROUTER_API_KEY: "",
  OLLAMA_URL: "",
};

const prod = process.env.E2E_PROD === "1"; // CI tests the production build
const args = prod ? ["next", "start", "-p", port, "-H", "127.0.0.1"] : ["next", "dev", "-p", port, "-H", "127.0.0.1"];
const child = spawn("npx", args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));

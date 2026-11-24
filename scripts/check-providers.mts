// npm run check:providers — one tiny real call per configured free provider; writes docs/PROVIDER_CHECK.md.
import { writeFileSync } from "node:fs";
import { providerConfigs } from "../lib/personality/config";
import { runTurn } from "../lib/personality/engine";
import { openAICompatible } from "../lib/personality/providers";
import { visionHealth } from "../lib/vision/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env: every cloud provider is skipped */
}

const ctx = {
  kind: "scene" as const,
  setting: "desk",
  objects: [{ id: 1, name: "Mugsy", label: "mug", traits: ["dramatic", "proud", "sleepy"], mood: 60, ocr: "", lastSeenAgo: "just now", present: true, memories: [], neighbours: [], relationships: [] }],
  events: [{ type: "appeared" as const, objectId: 1 }],
  maxLines: 1,
};

const rows: string[] = [];
for (const c of providerConfigs()) {
  if (!c.enabled) {
    rows.push(`| ${c.name} | ${c.model} | skipped: no ${c.name === "ollama" ? "OLLAMA_URL" : `${c.name.toUpperCase()}_API_KEY`} | [get it free](${c.signup}) |`);
    continue;
  }
  const t0 = performance.now();
  try {
    const r = await runTurn(ctx, {}, { providers: [openAICompatible(c)], timeoutMs: 15_000 });
    rows.push(`| ${c.name} | ${c.model} | OK in ${Math.round(performance.now() - t0)} ms: "${r.lines[0].text}" | |`);
  } catch (e) {
    rows.push(`| ${c.name} | ${c.model} | FAILED: ${(e as Error).message.slice(0, 150).replaceAll("|", "/")} | ${c.signup} |`);
  }
}
const v = await visionHealth();
const report = `# Provider check (${new Date().toISOString()})

| Provider | Model | Result | Link |
|---|---|---|---|
${rows.join("\n")}
| mock | templates | always available (offline) | |

Mirage vision: ${v.ok ? "OK" : "NOT READY"}: ${v.detail}
`;
writeFileSync("docs/PROVIDER_CHECK.md", report);
console.log(report);

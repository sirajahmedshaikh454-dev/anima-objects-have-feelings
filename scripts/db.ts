// npm run db:migrate | db:seed | db:reset
import { rmSync } from "node:fs";
import { DB_PATH, openDb } from "../lib/db";
import { processScan } from "../lib/realtime/pipeline";

const cmd = process.argv[2];

if (cmd === "reset") {
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) rmSync(f, { force: true });
  console.log(`Deleted ${DB_PATH}`);
}

const db = openDb(); // creates the file and applies migrations
console.log(`Migrated ${DB_PATH}`);

if (cmd === "seed") {
  const box = (x: number, y: number, w: number, h: number): [number, number, number, number] => [x, y, x + w, y + h];
  const r = processScan(db, {
    mode: "upload",
    sessionId: "seed",
    analysis: {
      width: 640,
      height: 480,
      latency_ms: 0,
      raw: {
        scene: { setting: "desk" },
        objects: [
          { id: 1, name: "mug", bbox: box(120, 520, 140, 200), score: 0.9 },
          { id: 2, name: "pen", bbox: box(620, 640, 160, 50), score: 0.8 },
          { id: 3, name: "phone", bbox: box(380, 420, 150, 260), score: 0.85 },
        ],
        regions: [],
        text: [],
        relations: [],
        events: [],
        reasoning: "",
      },
    },
  });
  console.log(`Seeded ${r.objects.map((o) => `${o.name} the ${o.label}`).join(", ")}`);
}

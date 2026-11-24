import { z } from "zod";
import type { Db } from "./index";
import { schema as s } from "./index";

export const SettingsSchema = z.object({
  scanIntervalMs: z.number().int().min(500).max(10_000).default(1500),
  voice: z.boolean().default(false),
  chattiness: z.number().int().min(1).max(4).default(2), // max lines per turn
});
export type Settings = z.infer<typeof SettingsSchema>;

export function getSettings(db: Db): Settings {
  const rows = db.select().from(s.settings).all();
  return SettingsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)])));
}

export function saveSettings(db: Db, patch: unknown): Settings {
  const next = SettingsSchema.parse({ ...getSettings(db), ...SettingsSchema.partial().parse(patch) });
  for (const [key, value] of Object.entries(next))
    db.insert(s.settings).values({ key, value: JSON.stringify(value) }).onConflictDoUpdate({ target: s.settings.key, set: { value: JSON.stringify(value) } }).run();
  return next;
}

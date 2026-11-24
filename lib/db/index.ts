import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const DB_PATH = process.env.ANIMA_DB_PATH ?? path.join(process.cwd(), "data", "anima.db");

/** Opens (creating and migrating if needed) a SQLite file DB in WAL mode. */
export function openDb(file = DB_PATH): Db {
  mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema, casing: "snake_case" });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// One connection per server process; survives Next.js dev hot reloads.
const g = globalThis as unknown as { __animaDb?: Db };
export const getDb = () => (g.__animaDb ??= openDb());

export { schema };

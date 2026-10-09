import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DB_URL ?? "file:bot.db",
  authToken: process.env.DB_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    send_to TEXT NOT NULL,
    add_role TEXT NOT NULL
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS authorizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    header_print TEXT NOT NULL,
    authorized_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

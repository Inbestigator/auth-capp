import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DB_URL ?? "file:bot.db",
  authToken: process.env.DB_TOKEN,
});

const upsertGuild = `
  INSERT INTO guild_config (guild_id, send_to)
  VALUES (?, ?)
  ON CONFLICT(guild_id)
  DO UPDATE SET send_to = excluded.send_to
`;

const getGuild = `
  SELECT guild_id, send_to
  FROM guild_config
  WHERE guild_id = ?
`;

export async function setSendTo(guildId: string, sendTo: string) {
  await db.execute({
    sql: upsertGuild,
    args: [guildId, sendTo],
  });
}

export async function getSendTo(guildId: string): Promise<string | null> {
  const result = await db.execute({
    sql: getGuild,
    args: [guildId],
  });

  const row = result.rows[0] as { guild_id: string; send_to: string } | undefined;

  return row?.send_to ?? null;
}

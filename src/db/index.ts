import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DB_URL ?? "file:bot.db",
  authToken: process.env.DB_TOKEN,
});

const upsertGuild = `
  INSERT INTO guild_config (guild_id, send_to, add_role)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id)
  DO UPDATE SET
    send_to = excluded.send_to,
    add_role = excluded.add_role
`;

const getGuild = `
  SELECT send_to, add_role
  FROM guild_config
  WHERE guild_id = ?
`;

const insertAuthorization = `
  INSERT INTO authorizations (guild_id, user_id, header_print)
  VALUES (?, ?, ?)
`;

const countAuthorizations = `
  SELECT COUNT(*) AS count
  FROM authorizations
  WHERE user_id = ?
`;

export async function setGuildInfo(guildId: string, sendTo: string, addRole: string) {
  await db.execute({ sql: upsertGuild, args: [guildId, sendTo, addRole] });
}

export async function getGuildInfo(
  guildId: string,
): Promise<{ send_to: string; add_role: string } | null> {
  const result = await db.execute({ sql: getGuild, args: [guildId] });

  const row = result.rows[0] as { send_to: string; add_role: string } | undefined;

  return row ?? null;
}

export async function addAuthorization(guildId: string, userId: string, headerPrint: string) {
  await db.execute({ sql: insertAuthorization, args: [guildId, userId, headerPrint] });
}

export async function countAuths(userId: string): Promise<number> {
  const result = await db.execute({ sql: countAuthorizations, args: [userId] });
  return Number(result.rows[0]?.count ?? 0);
}

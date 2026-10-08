import { addMemberRole, getCurrentUserMember } from "dressed";
import { handleRequest } from "dressed/server";
import { botEnv } from "dressed/utils";
import * as configCmd from "./bot/config-cmd";
import * as configModal from "./bot/config-modal";
import { getGuildInfo } from "./db";

interface Env {
  ASSETS: { fetch: CallableFunction };
  DISCORD_APP_ID: string;
  DISCORD_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/bot") {
      return handleRequest(
        request,
        { config: configCmd },
        { modals: { config: { ...configModal } } },
        {},
      );
    }

    if (url.pathname === "/api/token") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      }

      let body: { code?: string; guild_id?: string };

      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      if (!body.code) {
        return Response.json({ error: "Missing code" }, { status: 400 });
      }

      if (!body.guild_id) {
        return Response.json({ error: "Missing guild_id" }, { status: 400 });
      }

      const response = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: botEnv.DISCORD_APP_ID,
          client_secret: env.DISCORD_SECRET,
          grant_type: "authorization_code",
          code: body.code,
        }).toString(),
      });

      if (!response.ok) {
        console.error("Discord token exchange failed:", await response.text());

        return Response.json({ error: "Discord authentication failed" }, { status: 401 });
      }

      const token = (await response.json()) as { access_token: string };
      const [guildInfo, member] = await Promise.all([
        getGuildInfo(body.guild_id),
        getCurrentUserMember(body.guild_id, {
          authorization: `Bearer ${token.access_token}`,
        }),
      ]);

      if (guildInfo && !member.roles.includes(guildInfo.add_role)) {
        await addMemberRole(body.guild_id, member.user.id, guildInfo.add_role);
      }

      return Response.json({
        access_token: token.access_token,
        send_to: guildInfo?.send_to,
        auth_does_action: !!guildInfo,
      });
    }

    return env.ASSETS.fetch(request);
  },
};

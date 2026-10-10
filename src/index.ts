import { createHash } from "node:crypto";
import { createChallenge, type Payload, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { addMemberRole, getCurrentUserMember } from "dressed";
import { handleRequest } from "dressed/server";
import { botEnv } from "dressed/utils";
import * as configCmd from "./bot/config-cmd";
import * as configModal from "./bot/config-modal";
import { addAuthorization, countAuths, getGuildInfo } from "./db";

interface Env {
  DISCORD_APP_ID: string;
  DISCORD_SECRET: string;
  ALTCHA_SECRET: string;
}

interface AuthBody {
  code?: string;
  guild_id?: string;
  altcha?: Payload;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/bot") {
      return handleRequest(
        req,
        { config: configCmd },
        { modals: { config: { ...configModal } } },
        {},
      );
    }

    if (url.pathname === "/api/challenge") {
      if (req.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }

      const challenge = await createChallenge({
        algorithm: "PBKDF2/SHA-256",
        cost: 5000,
        counter: randomInt(5000, 10000),
        deriveKey,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        hmacSignatureSecret: env.ALTCHA_SECRET,
      });

      return Response.json(challenge, { headers: { "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/api/auth") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      }

      let body: AuthBody;

      try {
        body = await req.json();
      } catch {
        return Response.json("Invalid JSON", { status: 400 });
      }

      if (!body.code || !body.guild_id || !body.altcha) {
        return Response.json("Invalid body format", { status: 400 });
      }

      try {
        await verifySignature(req);
      } catch (e) {
        return Response.json(typeof e === "string" ? e : "Invalid headers", { status: 401 });
      }

      try {
        const payload = body.altcha;

        if (
          !payload ||
          typeof payload !== "object" ||
          payload === null ||
          !payload.challenge ||
          !payload.solution
        ) {
          return Response.json({ error: "Verification required" }, { status: 400 });
        }

        const verification = await verifySolution({
          challenge: payload.challenge,
          solution: payload.solution,
          deriveKey,
          hmacSignatureSecret: env.ALTCHA_SECRET,
        });

        if (!verification.verified) {
          return Response.json({ error: "Bot verification failed" }, { status: 403 });
        }
      } catch (error) {
        console.error("ALTCHA verification failed:", error);
        return Response.json({ error: "Bot verification unavailable" }, { status: 503 });
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
        return Response.json("Discord authentication failed", { status: 401 });
      }

      const token = (await response.json()) as { access_token: string };

      const [guildInfo, member] = await Promise.all([
        getGuildInfo(body.guild_id),
        getCurrentUserMember(body.guild_id, { authorization: `Bearer ${token.access_token}` }),
      ]);

      const [, , userAuths] =
        guildInfo && member.roles.includes(guildInfo.add_role)
          ? []
          : await Promise.all([
              guildInfo && addMemberRole(body.guild_id, member.user.id, guildInfo.add_role),
              addAuthorization(
                body.guild_id,
                member.user.id,
                generateFingerprint(Object.fromEntries(req.headers)),
              ).catch(() => {}),
              countAuths(member.user.id).catch(() => {}),
            ]);

      return Response.json({
        access_token: token.access_token,
        send_to: guildInfo?.send_to,
        auth_does_action: !!guildInfo,
        num_auths: userAuths,
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function verifySignature(req: Request) {
  const signature = req.headers.get("X-Signature-Ed25519") ?? "";
  const timestamp = req.headers.get("X-Signature-Timestamp") ?? "";
  const payload = req.headers.get("X-Discord-Proxy-Payload") ?? "";

  const payloadBytes = Buffer.from(payload, "base64");
  const payloadString = payloadBytes.toString("utf-8");
  const payloadData = JSON.parse(payloadString);

  if (payloadData.created_at.toString() !== timestamp) {
    throw "Invalid request timestamp";
  }

  if (payloadData.expires_at < Math.floor(Date.now() / 1000)) {
    throw "Expired proxy token";
  }

  const isVerified = await crypto.subtle.verify(
    { name: "Ed25519" },
    await crypto.subtle.importKey(
      "raw",
      Buffer.from(botEnv.DISCORD_PUBLIC_KEY, "hex"),
      "Ed25519",
      false,
      ["verify"],
    ),
    Buffer.from(signature, "hex"),
    payloadBytes,
  );

  if (!isVerified) {
    throw "Invalid request signature";
  }
}

function generateFingerprint(headers: Record<string, string>) {
  const relevant = {
    userAgent: headers["user-agent"] ?? "",
    clientHints: {
      ua: headers["sec-ch-ua"] ?? "",
      platform: headers["sec-ch-ua-platform"] ?? "",
      mobile: headers["sec-ch-ua-mobile"] ?? "",
    },
    language: headers["accept-language"] ?? "",
    encoding: headers["accept-encoding"] ?? "",
    fetch: {
      dest: headers["sec-fetch-dest"] ?? "",
      mode: headers["sec-fetch-mode"] ?? "",
      site: headers["sec-fetch-site"] ?? "",
    },
    privacy: {
      dnt: headers.dnt ?? "",
      gpc: headers["sec-gpc"] ?? "",
    },
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

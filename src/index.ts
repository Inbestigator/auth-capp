import { createHash } from "node:crypto";
import { createChallenge, type Payload, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { addMemberRole, removeMember } from "dressed";
import { handleRequest } from "dressed/server";
import { botEnv, callDiscord } from "dressed/utils";
import * as configBtn from "./bot/btns/config";
import * as createChannelBtn from "./bot/btns/create-channel";
import * as createRoleBtn from "./bot/btns/create-role";
import * as chooseRoleSelect from "./bot/choose-role-select";
import * as configCmd from "./bot/cmds/config";
import * as initCmd from "./bot/cmds/init";
import * as configModal from "./bot/config-modal";
import { addAuthorization, countAuths, getGuildInfo } from "./db";

interface Env {
  DISCORD_APP_ID: string;
  DISCORD_SECRET: string;
  ALTCHA_SECRET: string;
}

interface AuthBody {
  code?: string;
  altcha?: Payload;
  roles?: string[];
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/bot") {
      return handleRequest(
        req,
        { config: configCmd, init: initCmd },
        {
          buttons: {
            config: configBtn,
            [createChannelBtn.pattern]: createChannelBtn,
            "create-role": createRoleBtn,
          },
          modals: { config: { ...configModal } },
          selects: { "choose-role": chooseRoleSelect },
        },
        {},
      );
    }

    let proxyPayload: Awaited<ReturnType<typeof verifySignature>>;

    try {
      proxyPayload = await verifySignature(req);
    } catch (e) {
      return Response.json(typeof e === "string" ? e : "Invalid headers", { status: 401 });
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

      if (!body.code || !body.altcha) {
        return Response.json("Invalid body format", { status: 400 });
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
          await removeMember(proxyPayload.guild_id, proxyPayload.user_id, {
            reason: "Failed ALTCHA challenge",
          }).catch(() => {});
          return Response.json({ error: "Bot verification failed" }, { status: 403 });
        }
      } catch (error) {
        console.error("ALTCHA verification failed:", error);
        return Response.json({ error: "Bot verification unavailable" }, { status: 503 });
      }

      const tokenParams = new URLSearchParams({
        client_id: botEnv.DISCORD_APP_ID,
        client_secret: env.DISCORD_SECRET,
        grant_type: "authorization_code",
        code: body.code,
      }).toString();

      let tokenResponse: Response;

      try {
        tokenResponse = await callDiscord(
          "/oauth2/token",
          { method: "POST" },
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            hooks: { onBeforeFetch: (req) => new Request(req, { body: tokenParams }) },
          },
        );
      } catch {
        await removeMember(proxyPayload.guild_id, proxyPayload.user_id, {
          reason: "Failed OAuth verification",
        }).catch(() => {});
        return Response.json({ error: "Token exchange failed" }, { status: 503 });
      }

      const [guildInfo, prevNumAuths, { access_token }] = await Promise.all([
        getGuildInfo(proxyPayload.guild_id).then(async (info) => {
          const shouldAction = info && !body.roles?.includes(info.add_role);
          await Promise.all([
            shouldAction &&
              addMemberRole(proxyPayload.guild_id, proxyPayload.user_id, info.add_role),
            addAuthorization(
              proxyPayload.guild_id,
              proxyPayload.user_id,
              !!shouldAction,
              generateFingerprint(Object.fromEntries(req.headers)),
            ),
          ]);
          return info;
        }),
        countAuths(proxyPayload.user_id),
        tokenResponse.json() as Promise<{ access_token: string }>,
      ]);

      return Response.json({
        access_token,
        send_to: guildInfo?.send_to,
        auth_does_action: !!guildInfo,
        num_auths: prevNumAuths + 1,
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
  const payloadData = JSON.parse(payloadBytes.toString("utf-8")) as {
    created_at: number;
    expires_at: number;
    guild_id: string;
    user_id: string;
  };

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
    Buffer.from(signature, "base64"),
    payloadBytes,
  );

  if (!isVerified) {
    throw "Invalid request signature";
  }

  return payloadData;
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

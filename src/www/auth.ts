import { DiscordSDK } from "@discord/embedded-app-sdk";
import "altcha";

const discordSdk = new DiscordSDK("1553441490707939419");

const loader = document.getElementById("loader");
const loaderIcon = document.getElementById("loader-icon");
const loaderText = document.getElementById("loader-text");

function showSuccess(text: string) {
  if (!loader || !loaderIcon || !loaderText) return;

  loader.classList.remove("error");
  loader.classList.add("success");

  loaderIcon.innerHTML = `
    <path d="M20 6 9 17l-5-5"/>
  `;

  loaderText.textContent = text;
}

function showError(text = "There was a problem authenticating") {
  if (!loader || !loaderIcon || !loaderText) return;

  loader.classList.remove("success");
  loader.classList.add("error");

  loaderIcon.innerHTML = `
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="M12 8v4"/>
    <path d="M12 16h.01"/>
  `;

  loaderText.textContent = text;
}
const widget = document.querySelector("altcha-widget");

widget?.addEventListener("statechange", async (event) => {
  const { detail } = event as Event & { detail: { state: string; payload: string } };
  if (["error", "unverified", "expired"].includes(detail.state)) {
    showError("Failed CAPTCHA");
    return;
  }
  if (detail.state === "verified") {
    try {
      await discordSdk.ready();
      const { code } = await discordSdk.commands.authorize({
        client_id: discordSdk.clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "guilds.members.read"],
      });
      const guild_id = new URLSearchParams(window.location.search).get("guild_id");
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, guild_id, altcha: JSON.parse(atob(detail.payload)) }),
      });
      if (!response.ok) {
        throw new Error("Failed to exchange Discord authorization code");
      }
      const { access_token, send_to, auth_does_action, num_auths } = (await response.json()) as {
        access_token: string;
        send_to?: string;
        auth_does_action: boolean;
        num_auths?: number;
      };
      await discordSdk.commands.authenticate({ access_token });
      showSuccess(
        auth_does_action
          ? num_auths
            ? `Successfully verified! You've been verified ${num_auths + 1} times now.`
            : "Successfully verified!"
          : "You were verified, but the bot hasn't been configured to do anything yet!",
      );
      if (send_to) {
        discordSdk.commands.openExternalLink({
          url: `https://discord.com/channels/${guild_id}/${send_to}`,
        });
      }
    } catch {
      showError();
    }
  }
});

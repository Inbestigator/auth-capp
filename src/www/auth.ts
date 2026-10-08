import { DiscordSDK } from "@discord/embedded-app-sdk";

const discordSdk = new DiscordSDK("1553441490707939419");

const loader = document.getElementById("loader");
const loaderIcon = document.getElementById("loader-icon");
const loaderText = document.getElementById("loader-text");

function showSuccess(text = "Successfully verified!") {
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

try {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: discordSdk.clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });
  const guild_id = new URLSearchParams(window.location.search).get("guild_id");

  const response = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, guild_id }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Discord authorization code");
  }

  const { access_token, send_to, auth_does_action } = await response.json();

  await discordSdk.commands.authenticate({ access_token });

  showSuccess(
    auth_does_action
      ? undefined
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

const appId = process.env.PUBLIC_DISCORD_APP_ID;
const invite = document.getElementById("invite") as HTMLAnchorElement | null;

if (invite && appId) {
  invite.href = `https://discord.com/oauth2/authorize?client_id=${appId}`;
  invite.target = "_blank";
  invite.rel = "noopener";
}

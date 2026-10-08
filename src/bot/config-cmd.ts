import { type CommandConfig, type CommandInteraction, Label, SelectMenu } from "dressed";
import { getGuildInfo } from "../db";

export const config = {
  description: "Configure the bot",
  default_member_permissions: ["ManageRoles", "ManageGuild", "ModerateMembers"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction) {
  const { guild } = interaction;
  if (!guild) return;
  const { send_to, add_role } = (await getGuildInfo(guild.id)) ?? {};
  return interaction.showModal({
    title: "Configure bot",
    custom_id: "config",
    components: [
      Label(
        "Verified role",
        SelectMenu({
          type: "Role",
          custom_id: "add_role",
          default_values: add_role ? [{ id: add_role, type: "role" as never }] : undefined,
        }),
        "The role to give a user after authorizing.",
      ),
      Label(
        "Redirect target",
        SelectMenu({
          type: "Channel",
          custom_id: "send_to",
          default_values: send_to ? [{ id: send_to, type: "channel" as never }] : undefined,
          required: false,
        }),
        "The channel a user is sent to after authorizing.",
      ),
    ],
  });
}

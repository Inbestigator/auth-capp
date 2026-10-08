import { type CommandConfig, type CommandInteraction, Label, SelectMenu } from "dressed";
import { getSendTo } from "../db";

export const config = {
  description: "Configure the bot",
  //   default_member_permissions: ["ManageRoles", "ManageGuild", "ModerateMembers"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction) {
  const { guild } = interaction;
  if (!guild) return;
  const sendTo = await getSendTo(guild.id);
  return interaction.showModal({
    title: "Configure bot",
    custom_id: "config",
    components: [
      Label(
        "Redirect target",
        SelectMenu({
          type: "Channel",
          custom_id: "redirect",
          default_values: sendTo ? [{ id: sendTo, type: "channel" as never }] : undefined,
        }),
        "The channel a user is sent to after authorizing.",
      ),
    ],
  });
}

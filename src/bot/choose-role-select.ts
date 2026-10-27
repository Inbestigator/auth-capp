import {
  Button,
  type ComponentInteraction,
  Container,
  getRole,
  modifyRole,
  Section,
  TextDisplay,
} from "dressed";
import { setGuildInfo } from "../db";

export default async function (interaction: ComponentInteraction<"RoleSelect">) {
  const {
    guild,
    data: {
      values: [roleId],
    },
  } = interaction;
  if (!guild || !roleId) return;
  try {
    await Promise.all([
      !interaction.history.length && interaction.deferUpdate(),
      getRole(guild.id, guild.id).then((r) =>
        modifyRole(guild.id, guild.id, {
          permissions: (BigInt(r.permissions) & ~(1n << 10n)).toString(),
        }),
      ),
      setGuildInfo(guild.id, "", roleId),
    ]);
    return interaction.editReply({
      components: [
        Container(
          Section(
            ["### Authorization channel", "Setup the channel users should open to verify"],
            Button({ custom_id: `create-channel-${roleId}`, label: "Create channel" }),
          ),
          TextDisplay(
            `-# It will be configured so that @everyone can view it but <@&${roleId}> (the verified role) cannot`,
          ),
        ),
      ],
      allowed_mentions: {},
    });
  } catch {
    return interaction.editReply({
      components: [Container(TextDisplay("There was a problem setting up your role"))],
    });
  }
}

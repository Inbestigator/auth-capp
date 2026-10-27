import {
  Button,
  type ComponentInteraction,
  Container,
  createChannel,
  Section,
  TextDisplay,
} from "dressed";
import { botEnv } from "dressed/utils";

export const pattern = "^create-channel-(?<role>\\d+)$";

export default async function (interaction: ComponentInteraction, args: { role: string }) {
  const { guild } = interaction;
  if (!guild) return;
  const [channelSettled] = await Promise.allSettled([
    createChannel(guild.id, {
      name: "verify-here",
      permission_overwrites: [
        { id: guild.id, type: 0, allow: (1 << 10).toString() },
        { id: args.role, type: 0, deny: (1 << 10).toString() },
      ],
      type: 21,
      application_id: botEnv.DISCORD_APP_ID,
    }),
    interaction.deferUpdate(),
  ]);
  if (channelSettled.status === "rejected") {
    return interaction.editReply({
      components: [Container(TextDisplay("There was a problem creating the channel"))],
    });
  }
  return interaction.editReply({
    components: [
      Container(
        Section(
          [
            "### All done!",
            "You can choose a new role to assign or a channel to redirect to at any time with the `/config` command.",
          ],
          Button({ custom_id: "config", label: "Open config" }),
        ),
        TextDisplay(`-# Users can now go to <#${channelSettled.value.id}> to be verified`),
      ),
    ],
    allowed_mentions: {},
  });
}

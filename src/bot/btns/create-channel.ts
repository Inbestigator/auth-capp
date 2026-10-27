import { type ComponentInteraction, Container, createChannel, TextDisplay } from "dressed";

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
        TextDisplay(
          `## All done!\nYou can choose a new role to assign or a channel to redirect to at any time with the \`/config\` command.\n-# Users can now go to <#${channelSettled.value.id}> to be verified`,
        ),
      ),
    ],
    allowed_mentions: {},
  });
}

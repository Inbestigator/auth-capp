import type { ModalInteraction } from "dressed";
import { setSendTo } from "../db";

export default async function (interaction: ModalInteraction) {
  const redirect = interaction.getField("redirect")?.channelSelect()[0]?.id ?? "";
  await setSendTo(interaction.guild_id!, redirect);
  return interaction.reply({ content: "Successfully updated configuration.", ephemeral: true });
}

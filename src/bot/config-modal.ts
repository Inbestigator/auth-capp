import type { ModalInteraction } from "dressed";
import { setGuildInfo } from "../db";

export default async function (interaction: ModalInteraction) {
  const redirect = interaction.getField("send_to")?.channelSelect()[0]?.id ?? "";
  const addRole = interaction.getField("add_role", true).roleSelect()[0]!.id;
  await setGuildInfo(interaction.guild_id!, redirect, addRole);
  return interaction.reply({ content: "Successfully updated configuration.", ephemeral: true });
}

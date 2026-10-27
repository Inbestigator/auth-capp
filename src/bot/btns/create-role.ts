import { type ComponentInteraction, Container, createRole, TextDisplay } from "dressed";
import completeRoleSelection from "../choose-role-select";

export default async function (interaction: ComponentInteraction) {
  const { guild } = interaction;
  if (!guild) return;
  const [roleSettled] = await Promise.allSettled([
    createRole(guild.id, { name: "Verified with Inlet", permissions: (1 << 10).toString() }),
    interaction.deferUpdate(),
  ]);
  if (roleSettled.status === "rejected") {
    return interaction.editReply({
      components: [Container(TextDisplay("There was a problem creating the role"))],
    });
  }
  return completeRoleSelection({
    ...interaction,
    data: { values: [roleSettled.value.id] },
  } as ComponentInteraction<"RoleSelect">);
}

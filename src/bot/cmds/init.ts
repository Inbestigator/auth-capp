import {
  ActionRow,
  Button,
  type CommandConfig,
  type CommandInteraction,
  Container,
  Section,
  SelectMenu,
  TextDisplay,
} from "dressed";

export const config = {
  description: "Set up the bot",
  default_member_permissions: ["ManageRoles", "ManageGuild", "ModerateMembers"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction) {
  const { guild } = interaction;
  if (!guild) return;
  return interaction.reply({
    components: [
      Container(
        Section(
          ["## Verified Role"],
          Button({ custom_id: "create-role", label: "Create a new one" }),
        ),
        ActionRow(
          SelectMenu({
            type: "Role",
            custom_id: "choose-role",
            placeholder: "Choose an existing role",
          }),
        ),
        TextDisplay(
          `-# Be aware, this step removes the \`VIEW_CHANNEL\` permission from @everyone`,
        ),
      ),
    ],
    flags: ["Ephemeral", "IsComponentsV2"],
    allowed_mentions: {},
  });
}

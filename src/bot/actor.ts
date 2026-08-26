import {
  GuildMember,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { Actor } from "../services/permission.service";

type AnyInteraction =
  | ChatInputCommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

export function actorFrom(interaction: AnyInteraction): Actor | null {
  if (!interaction.guildId || !interaction.guild) return null;
  const member = interaction.member;
  const roleIds =
    member instanceof GuildMember
      ? [...member.roles.cache.keys()]
      : Array.isArray(member?.roles)
        ? member.roles
        : [];
  const isAdministrator =
    member instanceof GuildMember
      ? member.permissions.has(PermissionFlagsBits.Administrator)
      : Boolean(
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
        );
  return {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    isGuildOwner: interaction.guild.ownerId === interaction.user.id,
    isAdministrator,
    roleIds,
  };
}

export async function ephemeralError(
  interaction: AnyInteraction,
  message: string,
) {
  const payload = { content: message, ephemeral: true as const };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }
  await interaction.reply(payload);
}

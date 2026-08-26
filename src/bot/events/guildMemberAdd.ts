import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { getSettings } from "../../services/guild.service";
import { buildWelcomePayload } from "../../modules/welcome/embed";

export async function onGuildMemberAdd(member: GuildMember) {
  try {
    if (member.user.bot) return;
    const settings = await getSettings(member.guild.id);
    if (!settings?.welcomeEnabled || !settings.welcomeChannelId) return;

    const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) return;
    if (!channel.isSendable()) return;

    const me = member.guild.members.me;
    if (me && "permissionsFor" in channel) {
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) return;
      if (settings.welcomeEmbedEnabled !== false && !perms.has(PermissionFlagsBits.EmbedLinks)) {
        return;
      }
    }

    const payload = buildWelcomePayload({
      member,
      template: settings.welcomeMessage,
      embedEnabled: settings.welcomeEmbedEnabled,
    });
    await channel.send(payload);
  } catch (err) {
    console.error("welcome send", member.guild.id, err);
  }
}

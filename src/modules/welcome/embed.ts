import { EmbedBuilder, type GuildMember } from "discord.js";
import { COLOR } from "../../lib/embeds";
import { renderWelcomeMessage } from "./template";

export type WelcomePayloadInput = {
  member: GuildMember;
  template: string | null | undefined;
  embedEnabled: boolean;
};

export function welcomeVars(member: GuildMember) {
  return {
    user: `<@${member.id}>`,
    username: member.user.username,
    server: member.guild.name,
    memberCount: String(member.guild.memberCount),
  };
}

export function buildWelcomePayload(input: WelcomePayloadInput) {
  const vars = welcomeVars(input.member);
  const text = renderWelcomeMessage(input.template, vars);
  if (!input.embedEnabled) {
    return { content: text, embeds: [] as EmbedBuilder[] };
  }
  const joined = memberJoinedUnix(input.member);
  const embed = new EmbedBuilder()
    .setColor(COLOR.blurple)
    .setTitle(`Hoş geldin, ${input.member.user.username}`)
    .setDescription(text)
    .setThumbnail(input.member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Kullanıcı", value: vars.user, inline: true },
      { name: "Sunucu", value: vars.server, inline: true },
      { name: "Üye sayısı", value: vars.memberCount, inline: true },
      { name: "Katılma", value: `<t:${joined}:F>`, inline: false },
    )
    .setTimestamp(new Date());
  return { content: vars.user, embeds: [embed] };
}

function memberJoinedUnix(member: GuildMember): number {
  const ms = member.joinedTimestamp ?? Date.now();
  return Math.floor(ms / 1000);
}

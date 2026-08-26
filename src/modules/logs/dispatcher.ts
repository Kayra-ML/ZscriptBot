import { EmbedBuilder, type Client, type ColorResolvable } from "discord.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ChannelSettingKey } from "../../services/guild.service";

export type DomainEvent = {
  guildId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Prisma.InputJsonValue;
  channelKey?: ChannelSettingKey;
  color?: ColorResolvable;
  title?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
};

export async function writeAudit(event: DomainEvent) {
  await prisma.auditLog.create({
    data: {
      guildId: event.guildId,
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload ?? {},
    },
  });
}

export async function dispatchLog(client: Client, event: DomainEvent) {
  await writeAudit(event);
  if (!event.channelKey) return;
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: event.guildId } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelId = (settings as any)?.[event.channelKey];
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return;
  const embed = new EmbedBuilder()
    .setColor(event.color ?? 0x5865f2)
    .setTitle(event.title ?? event.action)
    .setDescription(event.description ?? null)
    .setTimestamp(new Date());
  if (event.fields?.length) embed.addFields(event.fields);
  await channel.send({ embeds: [embed] });
}

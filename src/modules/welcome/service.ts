import type { GuildSettings } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { DEFAULT_WELCOME_MESSAGE } from "./template";

export async function setWelcomeEnabled(guildId: string, enabled: boolean): Promise<GuildSettings> {
  return prisma.guildSettings.update({
    where: { guildId },
    data: { welcomeEnabled: enabled },
  });
}

export async function setWelcomeChannel(guildId: string, channelId: string): Promise<GuildSettings> {
  return prisma.guildSettings.update({
    where: { guildId },
    data: { welcomeChannelId: channelId },
  });
}

export async function setWelcomeMessage(guildId: string, message: string): Promise<GuildSettings> {
  return prisma.guildSettings.update({
    where: { guildId },
    data: { welcomeMessage: message },
  });
}

export async function resetWelcomeMessage(guildId: string): Promise<GuildSettings> {
  return prisma.guildSettings.update({
    where: { guildId },
    data: { welcomeMessage: DEFAULT_WELCOME_MESSAGE },
  });
}

export function welcomeStatusLines(settings: GuildSettings): string[] {
  const on = settings.welcomeEnabled ? "Aktif" : "Kapali";
  const ch = settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Ayarlanmadi";
  return [`Hos Geldin Sistemi: **${on}**`, `Hos Geldin Kanali: ${ch}`];
}

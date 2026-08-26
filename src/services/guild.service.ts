import type { GuildSettings, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function ensureGuild(guildId: string, name: string) {
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, name },
    update: { name },
  });
  return prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
}

export async function getSettings(guildId: string): Promise<GuildSettings | null> {
  return prisma.guildSettings.findUnique({ where: { guildId } });
}

export async function upsertUser(guildId: string, discordId: string, username: string) {
  return prisma.guildUser.upsert({
    where: { guildId_discordId: { guildId, discordId } },
    create: { guildId, discordId, username },
    update: { username },
  });
}

const CHANNEL_KEYS = [
  "ticketPanelChannelId",
  "ticketCategoryId",
  "customOrderChannelId",
  "ticketLogChannelId",
  "paymentLogChannelId",
  "orderLogChannelId",
  "projectLogChannelId",
  "subscriptionLogChannelId",
  "moderationLogChannelId",
  "securityLogChannelId",
  "botLogChannelId",
  "welcomeChannelId",
  // Per-category ticket Discord categories
  "tktCatScriptPurchase",
  "tktCatSupport",
  "tktCatPayment",
  "tktCatDelivery",
  "tktCatCustomProject",
  "tktCatOther",
  "closedTicketCategoryId",
] as const;

const ROLE_KEYS = [
  "ownerRoleId",
  "adminRoleId",
  "supportRoleId",
  "developerRoleId",
  "customerRoleId",
] as const;

export type ChannelSettingKey = (typeof CHANNEL_KEYS)[number];
export type RoleSettingKey = (typeof ROLE_KEYS)[number];
export type SettingKey = ChannelSettingKey | RoleSettingKey | "ticketPanelMessageId";

export function isChannelSetting(key: string): key is ChannelSettingKey {
  return (CHANNEL_KEYS as readonly string[]).includes(key);
}

export function isRoleSetting(key: string): key is RoleSettingKey {
  return (ROLE_KEYS as readonly string[]).includes(key);
}

export async function updateSettings(
  guildId: string,
  data: Prisma.GuildSettingsUpdateInput,
): Promise<GuildSettings> {
  await ensureGuild(guildId, "unknown");
  return prisma.guildSettings.update({ where: { guildId }, data });
}

export const CHANNEL_SETTING_LABEL: Record<ChannelSettingKey, string> = {
  ticketPanelChannelId: "Ticket paneli",
  ticketCategoryId: "Ticket kategorisi (varsayilan)",
  customOrderChannelId: "Ozel siparis kanali",
  ticketLogChannelId: "Ticket log",
  paymentLogChannelId: "Odeme log",
  orderLogChannelId: "Siparis log",
  projectLogChannelId: "Proje log",
  subscriptionLogChannelId: "Abonelik log",
  moderationLogChannelId: "Moderasyon log",
  securityLogChannelId: "Guvenlik log",
  botLogChannelId: "Bot log",
  welcomeChannelId: "Hos geldin kanali",
  tktCatScriptPurchase: "Ticket kategorisi: Script Satin Alma",
  tktCatSupport: "Ticket kategorisi: Destek",
  tktCatPayment: "Ticket kategorisi: Odeme",
  tktCatDelivery: "Ticket kategorisi: Teslimat",
  tktCatCustomProject: "Ticket kategorisi: Ozel Proje",
  tktCatOther: "Ticket kategorisi: Diger",
  closedTicketCategoryId: "Kapanan Ticketlar Kategorisi",
};

export const ROLE_SETTING_LABEL: Record<RoleSettingKey, string> = {
  ownerRoleId: "Owner rolü",
  adminRoleId: "Admin rolü",
  supportRoleId: "Destek rolü",
  developerRoleId: "Gelistirici rolü",
  customerRoleId: "Musteri rolü",
};

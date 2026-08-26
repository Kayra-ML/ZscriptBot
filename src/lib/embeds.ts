import { EmbedBuilder } from "discord.js";
import type { GuildSettings, Product, Ticket } from "@prisma/client";
import {
  CATEGORY_LABEL,
  TICKET_STATUS_EMOJI,
  TICKET_STATUS_LABEL,
} from "./labels";
import { CHANNEL_SETTING_LABEL, ROLE_SETTING_LABEL } from "../services/guild.service";

export const COLOR = {
  blurple: 0x5865f2,
  green: 0x57f287,
  yellow: 0xfee75c,
  orange: 0xe67e22,
  red: 0xed4245,
  grey: 0x99aab5,
} as const;

export function ticketPanelEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR.blurple)
    .setTitle("Destek ve Satis")
    .setDescription(
      "Ticket olusturmak icin asagidaki butona basin. Satın alma, destek, odeme ve teslimat talepleri buradan acilir.",
    );
}

export function ticketCreatedEmbed(ticket: Ticket, productName?: string | null) {
  return new EmbedBuilder()
    .setColor(COLOR.blurple)
    .setTitle(`${ticket.publicId}`)
    .addFields(
      { name: "Kullanici", value: `<@${ticket.openerId}>`, inline: true },
      { name: "Tur", value: CATEGORY_LABEL[ticket.category], inline: true },
      { name: "Urun", value: productName ?? "—", inline: true },
      { name: "Siparis", value: "—", inline: true },
      { name: "Yetkili", value: ticket.assigneeId ? `<@${ticket.assigneeId}>` : "Atanmadi", inline: true },
      {
        name: "Durum",
        value: `${TICKET_STATUS_EMOJI[ticket.status]} ${TICKET_STATUS_LABEL[ticket.status]}`,
        inline: true,
      },
      { name: "Acilis", value: `<t:${Math.floor(ticket.openedAt.getTime() / 1000)}:F>`, inline: false },
    );
}

export function setupStatusEmbed(settings: GuildSettings) {
  const channels = Object.entries(CHANNEL_SETTING_LABEL)
    .filter(([key]) => key !== "welcomeChannelId")
    .map(([key, label]) => {
      const id = settings[key as keyof GuildSettings];
      const value = typeof id === "string" && id ? `<#${id}>` : "Ayarlanmadi";
      return `**${label}:** ${value}`;
    })
    .join("\n");
  const roles = Object.entries(ROLE_SETTING_LABEL)
    .map(([key, label]) => {
      const id = settings[key as keyof GuildSettings];
      const value = typeof id === "string" && id ? `<@&${id}>` : "Ayarlanmadi";
      return `**${label}:** ${value}`;
    })
    .join("\n");
  return new EmbedBuilder()
    .setColor(COLOR.blurple)
    .setTitle("Kurulum durumu")
    .addFields(
      { name: "Kanallar", value: channels || "—" },
      { name: "Roller", value: roles || "—" },
      {
        name: "Guvenlik",
        value: [
          `Max acik ticket: **${settings.maxOpenTickets}**`,
          `Kategori basi: **${settings.maxOpenPerCategory}**`,
          `Kapanis cooldown: **${settings.ticketCloseCooldownSec}s**`,
        ].join("\n"),
      },
      {
        name: "Hos Geldin",
        value: [
          `Sistem: **${settings.welcomeEnabled ? "Aktif" : "Kapali"}**`,
          `Kanal: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Ayarlanmadi"}`,
        ].join("\n"),
      },
    );
}

export function productListEmbed(products: Product[]) {
  const embed = new EmbedBuilder().setColor(COLOR.blurple).setTitle("Urunler");
  if (products.length === 0) {
    embed.setDescription("Aktif urun yok.");
    return embed;
  }
  embed.setDescription(
    products
      .map((p) => `**${p.name}** — ${p.listPrice.toString()} (v${p.version})`)
      .join("\n"),
  );
  return embed;
}

export function errorEmbed(message: string) {
  return new EmbedBuilder().setColor(COLOR.red).setDescription(message);
}

export function okEmbed(message: string) {
  return new EmbedBuilder().setColor(COLOR.green).setDescription(message);
}

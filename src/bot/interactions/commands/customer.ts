import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { actorFrom, ephemeralError } from "../../actor";
import { encodeCustomId } from "../../../lib/custom-id";
import { COLOR, productListEmbed } from "../../../lib/embeds";
import { ACCESS_LABEL, ORDER_STATUS_LABEL, remainingText, SUB_STATUS_LABEL } from "../../../lib/labels";
import { listUserLicenses } from "../../../modules/licenses/service";
import { listUserOrders } from "../../../modules/orders/service";
import { listActive } from "../../../modules/products/service";
import {
  ACTIVE_LIKE,
  getSubscriptionByPublicId,
  listUserSubscriptions,
} from "../../../modules/subscriptions/service";
import { prisma } from "../../../lib/prisma";

export async function handleUrunler(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const products = await listActive(interaction.guildId);
  await interaction.reply({ embeds: [productListEmbed(products)], ephemeral: false });
}

export async function handleSiparisler(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const orders = await listUserOrders(actor.guildId, actor.userId);
  if (orders.length === 0) {
    await interaction.reply({ content: "Siparisin yok.", ephemeral: true });
    return;
  }
  const lines = orders.map((o) => {
    const lic = o.license ? ` · ${o.license.publicId}` : "";
    return `**${o.publicId}** ${o.product.name} — ${o.amount.toString()} ${o.currency} · ${ORDER_STATUS_LABEL[o.status]} · ${ACCESS_LABEL[o.access]}${lic}`;
  });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR.blurple).setTitle("Siparislerin").setDescription(lines.join("\n").slice(0, 4000))],
    ephemeral: true,
  });
}

export async function handleLisans(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const licenses = await listUserLicenses(actor.guildId, actor.userId);
  if (licenses.length === 0) {
    await interaction.reply({ content: "Lisansin yok.", ephemeral: true });
    return;
  }
  const lines = licenses.map(
    (l) => `**${l.publicId}** ${l.product.name} — \`${l.key}\` · ${l.status}`,
  );
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLOR.blurple).setTitle("Lisanslarin").setDescription(lines.join("\n").slice(0, 4000))],
    ephemeral: true,
  });
}

export async function handleProfil(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const [orders, licenses, subs] = await Promise.all([
    prisma.order.count({ where: { guildId: actor.guildId, userId: actor.userId } }),
    prisma.license.count({ where: { guildId: actor.guildId, userId: actor.userId, status: "ACTIVE" } }),
    prisma.subscription.count({
      where: { guildId: actor.guildId, userId: actor.userId, status: { in: ACTIVE_LIKE } },
    }),
  ]);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR.blurple)
        .setTitle("Profil")
        .setDescription(`<@${actor.userId}>`)
        .addFields(
          { name: "Siparis", value: String(orders), inline: true },
          { name: "Aktif lisans", value: String(licenses), inline: true },
          { name: "Aktif abonelik", value: String(subs), inline: true },
        ),
    ],
    ephemeral: true,
  });
}

function subEmbed(sub: {
  publicId: string;
  status: import("@prisma/client").SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  product: { name: string };
  order?: { durationDays: number | null; access: import("@prisma/client").AccessType } | null;
}) {
  const plan =
    sub.status === "LIFETIME" || !sub.expiresAt
      ? "Sinirsiz"
      : `${sub.order?.durationDays ?? "?"} gun`;
  return new EmbedBuilder()
    .setColor(COLOR.blurple)
    .setTitle(sub.publicId)
    .addFields(
      { name: "Urun", value: sub.product.name, inline: true },
      { name: "Plan", value: plan, inline: true },
      { name: "Durum", value: SUB_STATUS_LABEL[sub.status], inline: true },
      { name: "Baslangic", value: `<t:${Math.floor(sub.startedAt.getTime() / 1000)}:D>`, inline: true },
      {
        name: "Bitis",
        value: sub.expiresAt ? `<t:${Math.floor(sub.expiresAt.getTime() / 1000)}:D>` : "—",
        inline: true,
      },
      { name: "Kalan", value: remainingText(sub.expiresAt), inline: true },
    );
}

export async function handleAbone(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const subs = await listUserSubscriptions(actor.guildId, actor.userId);
  if (subs.length === 0) {
    await interaction.reply({ content: "Aboneligin yok.", ephemeral: true });
    return;
  }
  if (subs.length === 1) {
    await interaction.reply({ embeds: [subEmbed(subs[0]!)], ephemeral: true });
    return;
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(encodeCustomId("sub", "pick"))
    .setPlaceholder("Abonelik sec")
    .addOptions(
      subs.slice(0, 25).map((s) => ({
        label: `${s.publicId} · ${s.product.name}`.slice(0, 100),
        value: s.publicId,
      })),
    );
  await interaction.reply({
    content: "Abonelik sec.",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    ephemeral: true,
  });
}

export async function handleAbonePick(interaction: StringSelectMenuInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await ephemeralError(interaction, "Sadece sunucuda.");
    return;
  }
  const publicId = interaction.values[0];
  if (!publicId) return;
  const sub = await getSubscriptionByPublicId(actor.guildId, publicId);
  if (!sub || sub.userId !== actor.userId) {
    await interaction.update({ content: "Abonelik bulunamadi.", components: [] });
    return;
  }
  await interaction.update({ embeds: [subEmbed(sub)], content: null, components: [] });
}

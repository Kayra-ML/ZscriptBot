import { ProductStatus } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import { actorFrom, ephemeralError } from "../../actor";
import { okEmbed } from "../../../lib/embeds";
import { remainingText, SUB_STATUS_LABEL } from "../../../lib/labels";
import { prisma } from "../../../lib/prisma";
import { cancelOrder } from "../../../modules/orders/service";
import { refundPayment } from "../../../modules/payments/service";
import { createProduct, setProductStatus, deleteProduct } from "../../../modules/products/service";
import { addRoles, assertSafeGrantRole, removeProductRoleIfUnused } from "../../../modules/roles/discord";
import { getSettings } from "../../../services/guild.service";
import { canPerform } from "../../../services/permission.service";
import {
  cancelSubscription,
  extendSubscription,
  freezeSubscription,
  getSubscriptionByPublicId,
  grantSubscription,
} from "../../../modules/subscriptions/service";
import { dispatchLog } from "../../../modules/logs/dispatcher";

async function requireAdmin(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) throw new Error("Sadece sunucuda.");
  const settings = await getSettings(actor.guildId);
  if (!canPerform("product.crud", actor, settings)) throw new Error("Yetkin yok.");
  return { actor, settings };
}

export async function handleUrunEkle(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const name = interaction.options.getString("ad", true);
    const price = interaction.options.getNumber("fiyat", true);
    const stock = interaction.options.getInteger("stok");
    const durationDays = interaction.options.getInteger("gün");
    const description = interaction.options.getString("aciklama") ?? "";
    const version = interaction.options.getString("surum") ?? "1.0";
    const role = interaction.options.getRole("rol");
    if (role) {
      if (!interaction.guild) throw new Error("Sadece sunucuda.");
      const resolved =
        interaction.guild.roles.cache.get(role.id) ??
        (await interaction.guild.roles.fetch(role.id).catch(() => null));
      const botPos = interaction.guild.members.me?.roles.highest.position ?? 0;
      if (!resolved) throw new Error("Rol bulunamadi.");
      assertSafeGrantRole(resolved, botPos);
    }
    const product = await createProduct({
      guildId: actor.guildId,
      name,
      description,
      listPrice: String(price),
      version,
      roleId: role?.id ?? null,
      stock,
      durationDays,
    });
    await dispatchLog(interaction.client, {
      guildId: actor.guildId,
      actorId: actor.userId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      channelKey: "botLogChannelId",
      title: "Urun eklendi",
      fields: [
        { name: "Ad", value: product.name, inline: true },
        { name: "ID", value: product.id, inline: true },
      ],
    });
    await interaction.reply({
      embeds: [okEmbed(`Urun eklendi: **${product.name}** (\`${product.id}\`)`)],
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleUrunDurum(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const id = interaction.options.getString("id", true);
    const durum = interaction.options.getString("durum", true) as ProductStatus;
    const product = await setProductStatus(id, actor.guildId, durum);
    await interaction.reply({
      embeds: [okEmbed(`${product.name} → ${product.status}`)],
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleUrunSil(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const id = interaction.options.getString("id", true);
    const result = await deleteProduct(id, actor.guildId);
    
    if (result.status === "DELETED") {
      await interaction.reply({
        embeds: [okEmbed(`Urun kalici olarak silindi: **${result.product.name}**`)],
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        embeds: [okEmbed(`Urun satisi oldugu icin **ARSIVLENDI**: ${result.product.name}`)],
        ephemeral: true,
      });
    }
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleSohbetTemizle(interaction: ChatInputCommandInteraction) {
  try {
    await requireAdmin(interaction);
    const count = interaction.options.getInteger("adet") ?? 100;
    const channel = interaction.channel;
    
    if (!channel || channel.isDMBased() || !channel.isTextBased()) {
      throw new Error("Bu komut sadece metin kanallarinda kullanilabilir.");
    }

    // Bulk delete only works for messages under 14 days old
    const deleted = await channel.bulkDelete(count, true);
    
    await interaction.reply({
      content: `\`${deleted.size}\` mesaj basariyla silindi (14 gunden eski mesajlar es gecildi).`,
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAboneVer(interaction: ChatInputCommandInteraction) {
  try {
    const { actor, settings } = await requireAdmin(interaction);
    const user = interaction.options.getUser("kullanici", true);
    const productId = interaction.options.getString("urun_id", true);
    const days = interaction.options.getInteger("gun");
    const result = await grantSubscription({
      guildId: actor.guildId,
      userId: user.id,
      productId,
      days,
    });
    if (interaction.guild) {
      await addRoles(interaction.guild, user.id, [settings?.customerRoleId, result.productRoleId]);
    }
    await dispatchLog(interaction.client, {
      guildId: actor.guildId,
      actorId: actor.userId,
      action: "SUBSCRIPTION_GRANTED",
      entityType: "subscription",
      entityId: result.subscription.id,
      channelKey: "subscriptionLogChannelId",
      title: "Abonelik verildi",
      fields: [
        { name: "ID", value: result.subscription.publicId, inline: true },
        { name: "Kullanici", value: `<@${user.id}>`, inline: true },
      ],
    });
    await interaction.reply({
      embeds: [okEmbed(`${result.subscription.publicId} verildi.`)],
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAboneUzat(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const days = interaction.options.getInteger("gun", true);
    const sub = await getSubscriptionByPublicId(actor.guildId, publicId);
    if (!sub) throw new Error("Abonelik bulunamadi.");
    const updated = await extendSubscription(sub.id, actor.guildId, days);
    await interaction.reply({
      embeds: [okEmbed(`${updated.publicId} uzatildi. Kalan: ${remainingText(updated.expiresAt)}`)],
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAboneIptal(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const sub = await getSubscriptionByPublicId(actor.guildId, publicId);
    if (!sub) throw new Error("Abonelik bulunamadi.");
    await cancelSubscription(sub.id, actor.guildId);
    if (interaction.guild) {
      await removeProductRoleIfUnused(interaction.guild, sub.userId, sub.productId, sub.product.roleId);
    }
    await interaction.reply({ embeds: [okEmbed(`${sub.publicId} iptal.`)], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAboneDondur(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const sub = await getSubscriptionByPublicId(actor.guildId, publicId);
    if (!sub) throw new Error("Abonelik bulunamadi.");
    await freezeSubscription(sub.id, actor.guildId);
    await interaction.reply({ embeds: [okEmbed(`${sub.publicId} donduruldu.`)], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAboneBilgi(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const sub = await getSubscriptionByPublicId(actor.guildId, publicId);
    if (!sub) throw new Error("Abonelik bulunamadi.");
    await interaction.reply({
      content: [
        `**${sub.publicId}** <@${sub.userId}>`,
        `Urun: ${sub.product.name}`,
        `Durum: ${SUB_STATUS_LABEL[sub.status]}`,
        `Kalan: ${remainingText(sub.expiresAt)}`,
      ].join("\n"),
      ephemeral: true,
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleSiparisIptal(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const order = await prisma.order.findFirst({ where: { guildId: actor.guildId, publicId } });
    if (!order) throw new Error("Siparis bulunamadi.");
    await cancelOrder(order.id, actor.userId);
    await interaction.reply({ embeds: [okEmbed(`${publicId} iptal.`)], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleSiparisIade(interaction: ChatInputCommandInteraction) {
  try {
    const { actor } = await requireAdmin(interaction);
    const publicId = interaction.options.getString("id", true);
    const order = await prisma.order.findFirst({
      where: { guildId: actor.guildId, publicId },
      include: { product: true },
    });
    if (!order) throw new Error("Siparis bulunamadi.");
    const result = await refundPayment(order.id, actor.userId);
    if (interaction.guild) {
      await removeProductRoleIfUnused(
        interaction.guild,
        result.userId,
        order.productId,
        result.productRoleId,
      );
    }
    await interaction.reply({ embeds: [okEmbed(`${publicId} iade edildi.`)], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

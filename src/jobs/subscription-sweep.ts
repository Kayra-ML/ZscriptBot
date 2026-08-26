import { SubscriptionNotifyKind } from "@prisma/client";
import type { Client } from "discord.js";
import { prisma } from "../lib/prisma";
import { dispatchLog } from "../modules/logs/dispatcher";
import { removeProductRoleIfUnused } from "../modules/roles/discord";

type ExpiredRow = { id: string };

export async function expireDueSubscriptions() {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ExpiredRow[]>`
      SELECT id FROM subscriptions
      WHERE expires_at IS NOT NULL
        AND expires_at < NOW()
        AND status IN ('ACTIVE', 'EXPIRING_SOON')
      FOR UPDATE SKIP LOCKED
      LIMIT 50
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.subscription.updateMany({
      where: { id: { in: ids } },
      data: { status: "EXPIRED" },
    });
    const expired = await tx.subscription.findMany({
      where: { id: { in: ids } },
      select: { orderId: true },
    });
    await tx.license.updateMany({
      where: { orderId: { in: expired.map((s) => s.orderId) }, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
    for (const id of ids) {
      await tx.subscriptionNotification.upsert({
        where: { subscriptionId_kind: { subscriptionId: id, kind: SubscriptionNotifyKind.expired } },
        create: { subscriptionId: id, kind: SubscriptionNotifyKind.expired },
        update: {},
      });
    }
    return tx.subscription.findMany({
      where: { id: { in: ids } },
      include: { product: true },
    });
  });
}

export async function runSubscriptionSweep(client: Client) {
  const subs = await expireDueSubscriptions();
  for (const sub of subs) {
    const guild = await client.guilds.fetch(sub.guildId).catch(() => null);
    if (guild) {
      await removeProductRoleIfUnused(guild, sub.userId, sub.productId, sub.product.roleId);
    }
    await dispatchLog(client, {
      guildId: sub.guildId,
      actorId: client.user?.id ?? "bot",
      action: "SUBSCRIPTION_EXPIRED",
      entityType: "subscription",
      entityId: sub.id,
      channelKey: "subscriptionLogChannelId",
      title: "Abonelik suresi doldu",
      fields: [
        { name: "ID", value: sub.publicId, inline: true },
        { name: "Kullanici", value: `<@${sub.userId}>`, inline: true },
        { name: "Urun", value: sub.product.name, inline: true },
      ],
    });
    const user = await client.users.fetch(sub.userId).catch(() => null);
    await user
      ?.send(`**${sub.product.name}** aboneliginin suresi doldu. (${sub.publicId})`)
      .catch(() => undefined);
  }
}

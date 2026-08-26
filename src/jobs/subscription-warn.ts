import { SubscriptionNotifyKind, SubscriptionStatus } from "@prisma/client";
import type { Client } from "discord.js";
import { prisma } from "../lib/prisma";
import { dispatchLog } from "../modules/logs/dispatcher";

const WINDOWS: { kind: SubscriptionNotifyKind; days: number }[] = [
  { kind: "d7", days: 7 },
  { kind: "d3", days: 3 },
  { kind: "d1", days: 1 },
];

export async function runSubscriptionWarn(client: Client) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      expiresAt: { not: null, lte: horizon, gt: now },
    },
    include: { product: true, notifications: true },
    take: 100,
  });

  for (const sub of subs) {
    if (!sub.expiresAt) continue;
    const remaining = sub.expiresAt.getTime() - now.getTime();
    const remainingDays = remaining / 86_400_000;
    if (remainingDays <= 7 && sub.status === "ACTIVE") {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRING_SOON },
      });
    }
    for (const win of WINDOWS) {
      if (remainingDays > win.days) continue;
      const already = sub.notifications.some((n) => n.kind === win.kind);
      if (already) continue;
      await prisma.subscriptionNotification.create({
        data: { subscriptionId: sub.id, kind: win.kind },
      });
      await dispatchLog(client, {
        guildId: sub.guildId,
        actorId: client.user?.id ?? "bot",
        action: "SUBSCRIPTION_WARN",
        entityType: "subscription",
        entityId: sub.id,
        channelKey: "subscriptionLogChannelId",
        title: `Abonelik uyarisi (${win.days} gun)`,
        fields: [
          { name: "ID", value: sub.publicId, inline: true },
          { name: "Kullanici", value: `<@${sub.userId}>`, inline: true },
          { name: "Urun", value: sub.product.name, inline: true },
        ],
      });
      const user = await client.users.fetch(sub.userId).catch(() => null);
      await user
        ?.send(
          `**${sub.product.name}** aboneliginin bitmesine ${win.days} gun kaldi. (${sub.publicId})`,
        )
        .catch(() => undefined);
    }
  }
}

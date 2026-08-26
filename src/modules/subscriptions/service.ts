import { SubscriptionStatus } from "@prisma/client";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { nextPublicId } from "../../services/id.service";
import { generateLicenseKey } from "../../services/license-key.service";
import { parseGrantDays } from "./grant-days";

export { parseGrantDays };

export async function listUserSubscriptions(guildId: string, userId: string) {
  return prisma.subscription.findMany({
    where: { guildId, userId },
    include: { product: true, order: true },
    orderBy: { startedAt: "desc" },
  });
}

export async function getSubscriptionByPublicId(guildId: string, publicId: string) {
  return prisma.subscription.findFirst({
    where: { guildId, publicId },
    include: { product: true, order: true },
  });
}

export async function grantSubscription(input: {
  guildId: string;
  userId: string;
  productId: string;
  days: number | null;
}) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, guildId: input.guildId },
  });
  if (!product) throw new DomainError("Urun bulunamadi.");
  const { timed, days } = parseGrantDays(input.days);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const orderPublic = await nextPublicId(tx, input.guildId, "order");
    const order = await tx.order.create({
      data: {
        guildId: input.guildId,
        publicId: orderPublic,
        userId: input.userId,
        productId: input.productId,
        amount: product.listPrice,
        currency: "TRY",
        access: timed ? "TIMED" : "LIFETIME",
        durationDays: timed ? days : null,
        status: "PAID",
      },
    });
    const subPublic = await nextPublicId(tx, input.guildId, "subscription");
    const sub = await tx.subscription.create({
      data: {
        guildId: input.guildId,
        publicId: subPublic,
        userId: input.userId,
        productId: input.productId,
        orderId: order.id,
        status: timed ? "ACTIVE" : "LIFETIME",
        startedAt: now,
        expiresAt: timed && days ? new Date(now.getTime() + days * 86_400_000) : null,
      },
    });
    const licPublic = await nextPublicId(tx, input.guildId, "license");
    let key = generateLicenseKey();
    for (let i = 0; i < 5; i++) {
      const clash = await tx.license.findUnique({ where: { key } });
      if (!clash) break;
      key = generateLicenseKey();
    }
    await tx.license.create({
      data: {
        guildId: input.guildId,
        publicId: licPublic,
        key,
        userId: input.userId,
        productId: input.productId,
        orderId: order.id,
      },
    });
    return { subscription: sub, productRoleId: product.roleId };
  });
}

export async function extendSubscription(id: string, guildId: string, days: number) {
  if (days < 1) throw new DomainError("Gun sayisi 1+ olmali.");
  const sub = await prisma.subscription.findFirst({ where: { id, guildId } });
  if (!sub) throw new DomainError("Abonelik bulunamadi.");
  if (sub.status === "LIFETIME") throw new DomainError("Sinirsiz abonelik uzatilamaz.");
  const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
  return prisma.subscription.update({
    where: { id },
    data: {
      expiresAt: new Date(base.getTime() + days * 86_400_000),
      status: "ACTIVE",
      cancelledAt: null,
    },
  });
}

export async function cancelSubscription(id: string, guildId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, guildId } });
  if (!sub) throw new DomainError("Abonelik bulunamadi.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await tx.license.updateMany({
      where: { orderId: sub.orderId, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
    return updated;
  });
}

export async function freezeSubscription(id: string, guildId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, guildId } });
  if (!sub) throw new DomainError("Abonelik bulunamadi.");
  if (sub.status === "LIFETIME") throw new DomainError("Sinirsiz abonelik dondurulamaz.");
  return prisma.subscription.update({
    where: { id },
    data: { status: "FROZEN" },
  });
}

export const ACTIVE_LIKE: SubscriptionStatus[] = ["ACTIVE", "EXPIRING_SOON", "LIFETIME"];

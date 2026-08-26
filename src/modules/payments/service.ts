import { LicenseStatus, PaymentStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { assertNotSensitive } from "../../lib/sensitive";
import { nextPublicId } from "../../services/id.service";
import { generateLicenseKey } from "../../services/license-key.service";

export type ConfirmPayResult = {
  paymentId: string;
  paymentPublicId: string;
  orderPublicId: string;
  licenseKey: string;
  licensePublicId: string;
  subscriptionPublicId: string | null;
  customerRoleId: string | null;
  productRoleId: string | null;
  userId: string;
};

export async function confirmPayment(input: {
  guildId: string;
  ticketId: string;
  actorId: string;
  externalRef?: string;
}): Promise<ConfirmPayResult> {
  const ref = input.externalRef?.trim() || null;
  if (ref) {
    if (ref.length > 200) throw new DomainError("Tx notu en fazla 200 karakter.");
    assertNotSensitive(ref);
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });
    if (!ticket) throw new DomainError("Ticket bulunamadi.");
    if (ticket.guildId !== input.guildId) throw new DomainError("Yetkin yok.");
    if (ticket.status === "CLOSED") throw new DomainError("Kapali ticket'ta odeme onaylanamaz.");
    if (ticket.category !== "SCRIPT_PURCHASE") throw new DomainError("Satis ticket'i degil.");

    const order = await tx.order.findUnique({
      where: { ticketId: input.ticketId },
      include: { payment: true, product: true, license: true, subscription: true },
    });
    if (!order) throw new DomainError("Once fiyat girip siparis olustur.");
    if (order.guildId !== input.guildId) throw new DomainError("Yetkin yok.");
    if (order.payment || order.status !== "PAYMENT_PENDING") {
      throw new DomainError(
        order.status === "CANCELLED"
          ? "Iptal siparis odeme alamaz."
          : "Bu siparis odeme icin uygun degil.",
      );
    }

    const payPublic = await nextPublicId(tx, input.guildId, "payment");
    const payment = await tx.payment.create({
      data: {
        guildId: input.guildId,
        publicId: payPublic,
        orderId: order.id,
        userId: order.userId,
        amount: order.amount,
        currency: order.currency,
        method: "CRYPTO",
        status: "PAID",
        externalRef: ref,
        confirmedBy: input.actorId,
      },
    });

    const licPublic = await nextPublicId(tx, input.guildId, "license");
    let key = generateLicenseKey();
    for (let i = 0; i < 5; i++) {
      const clash = await tx.license.findUnique({ where: { key } });
      if (!clash) break;
      key = generateLicenseKey();
    }
    const license = await tx.license.create({
      data: {
        guildId: input.guildId,
        publicId: licPublic,
        key,
        userId: order.userId,
        productId: order.productId,
        orderId: order.id,
        status: "ACTIVE",
      },
    });

    const now = new Date();
    let subPublic: string | null = null;
    if (order.access === "LIFETIME") {
      subPublic = await nextPublicId(tx, input.guildId, "subscription");
      await tx.subscription.create({
        data: {
          guildId: input.guildId,
          publicId: subPublic,
          userId: order.userId,
          productId: order.productId,
          orderId: order.id,
          status: "LIFETIME",
          startedAt: now,
          expiresAt: null,
        },
      });
    } else {
      const days = order.durationDays ?? 0;
      const expiresAt = new Date(now.getTime() + days * 86_400_000);
      subPublic = await nextPublicId(tx, input.guildId, "subscription");
      await tx.subscription.create({
        data: {
          guildId: input.guildId,
          publicId: subPublic,
          userId: order.userId,
          productId: order.productId,
          orderId: order.id,
          status: "ACTIVE",
          startedAt: now,
          expiresAt,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: input.ticketId,
        type: "PAYMENT_CONFIRMED",
        actorId: input.actorId,
        payload: { paymentId: payment.id, orderId: order.id, licenseId: license.id },
      },
    });

    const settings = await tx.guildSettings.findUnique({ where: { guildId: input.guildId } });
    return {
      paymentId: payment.id,
      paymentPublicId: payment.publicId,
      orderPublicId: order.publicId,
      licenseKey: license.key,
      licensePublicId: license.publicId,
      subscriptionPublicId: subPublic,
      customerRoleId: settings?.customerRoleId ?? null,
      productRoleId: order.product.roleId,
      userId: order.userId,
    };
  }).catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("Bu siparis zaten odendi.");
    }
    throw e;
  });
}

export async function markPaymentLogged(paymentId: string) {
  return prisma.payment.updateMany({
    where: { id: paymentId, loggedToDiscordAt: null },
    data: { loggedToDiscordAt: new Date() },
  });
}

export async function refundPayment(orderId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payment: true, license: true, subscription: true, product: true },
    });
    if (!order?.payment) throw new DomainError("Odeme yok.");
    if (order.payment.status === "REFUNDED") throw new DomainError("Zaten iade edilmis.");
    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: "REFUNDED" },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    if (order.license) {
      await tx.license.update({
        where: { id: order.license.id },
        data: { status: "REVOKED" },
      });
    }
    if (order.subscription) {
      await tx.subscription.update({
        where: { id: order.subscription.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }
    if (order.ticketId) {
      await tx.ticketEvent.create({
        data: {
          ticketId: order.ticketId,
          type: "PAYMENT_REFUNDED",
          actorId,
          payload: { orderId, paymentId: order.payment.id },
        },
      });
    }
    return {
      userId: order.userId,
      productRoleId: order.product.roleId,
      licenseStatus: "REVOKED" as LicenseStatus,
      paymentStatus: "REFUNDED" as PaymentStatus,
      subStatus: "CANCELLED" as SubscriptionStatus,
    };
  });
}

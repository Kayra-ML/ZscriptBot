import { AccessType, OrderStatus, Prisma, type Order } from "@prisma/client";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { nextPublicId } from "../../services/id.service";

export async function createOrderFromPrice(input: {
  guildId: string;
  ticketId: string;
  userId: string;
  productId: string;
  amount: string;
  currency: string;
  access: AccessType;
  durationDays: number | null;
  actorId: string;
  note?: string;
}): Promise<Order> {
  const amount = Number(input.amount.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) throw new DomainError("Tutar 0'dan buyuk olmali.");
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new DomainError("Para birimi 3 harf olmali (or. TRY).");
  if (input.access === "TIMED") {
    if (!input.durationDays || input.durationDays < 1) {
      throw new DomainError("Sureli satis icin gun sayisi gir.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });
    if (!ticket) throw new DomainError("Ticket bulunamadi.");
    if (ticket.guildId !== input.guildId) throw new DomainError("Yetkin yok.");
    if (ticket.status === "CLOSED") throw new DomainError("Kapali ticket'a siparis acilamaz.");
    const existing = await tx.order.findUnique({ where: { ticketId: input.ticketId } });
    if (existing) throw new DomainError("Bu ticket'ta zaten bir siparis var.");

    const publicId = await nextPublicId(tx, input.guildId, "order");
    const order = await tx.order.create({
      data: {
        guildId: input.guildId,
        publicId,
        userId: input.userId,
        productId: input.productId,
        ticketId: input.ticketId,
        amount,
        currency,
        access: input.access,
        durationDays: input.access === "TIMED" ? input.durationDays : null,
        status: "PAYMENT_PENDING",
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: input.ticketId,
        type: "ORDER_CREATED",
        actorId: input.actorId,
        payload: { orderId: order.id, publicId, amount, currency, note: input.note ?? null },
      },
    });
    return order;
  }).catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("Bu ticket'ta zaten bir siparis var.");
    }
    throw e;
  });
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  return prisma.order.update({ where: { id: orderId }, data: { status } });
}

export async function listUserOrders(guildId: string, userId: string) {
  return prisma.order.findMany({
    where: { guildId, userId },
    include: { product: true, payment: true, license: true, subscription: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function cancelOrder(orderId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new DomainError("Siparis bulunamadi.");
    if (order.payment) throw new DomainError("Odemesi olan siparis iptal edilemez; iade kullan.");
    if (order.status !== "PAYMENT_PENDING") {
      throw new DomainError("Yalnizca odeme bekleyen siparis iptal edilir. Iade veya /abone-iptal kullan.");
    }
    const result = await tx.order.updateMany({
      where: { id: orderId, status: "PAYMENT_PENDING" },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) {
      throw new DomainError("Siparis iptal edilemedi.");
    }
    const updated = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.ticketId) {
      await tx.ticketEvent.create({
        data: {
          ticketId: order.ticketId,
          type: "ORDER_CANCELLED",
          actorId,
          payload: { orderId },
        },
      });
    }
    return updated;
  });
}

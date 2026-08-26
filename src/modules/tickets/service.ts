import {
  Prisma,
  TicketCategory,
  TicketStatus,
  type GuildSettings,
  type Ticket,
} from "@prisma/client";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { ticketChannelName } from "../../lib/labels";
import { nextPublicId } from "../../services/id.service";
import { canBypassTicketLimits } from "../../services/permission.service";
import type { Actor } from "../../services/permission.service";

const OPEN_STATUSES: TicketStatus[] = [
  "OPEN",
  "WAITING_STAFF",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
];

export { ticketChannelName as channelName };

export async function assertCanOpenTicket(
  actor: Actor,
  settings: GuildSettings,
  category: TicketCategory,
): Promise<void> {
  if (canBypassTicketLimits(actor, settings)) return;

  const openCount = await prisma.ticket.count({
    where: { guildId: actor.guildId, openerId: actor.userId, status: { in: OPEN_STATUSES } },
  });
  if (openCount >= settings.maxOpenTickets) {
    throw new DomainError(`En fazla ${settings.maxOpenTickets} acik ticketin olabilir.`);
  }

  const sameCat = await prisma.ticket.count({
    where: {
      guildId: actor.guildId,
      openerId: actor.userId,
      category,
      status: { in: OPEN_STATUSES },
    },
  });
  if (sameCat >= settings.maxOpenPerCategory) {
    throw new DomainError("Bu kategoride zaten acik bir ticketin var.");
  }

  if (redis.status === "wait") await redis.connect();
  const cooldownKey = `cd:${actor.guildId}:${actor.userId}:ticket`;
  const cooling = await redis.get(cooldownKey);
  if (cooling) {
    throw new DomainError("Ticket kapanis cooldown'u henuz bitmedi.");
  }
}

export async function createTicketRecord(input: {
  guildId: string;
  channelId: string;
  openerId: string;
  category: TicketCategory;
  productId?: string;
}): Promise<Ticket> {
  return prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId(tx, input.guildId, "ticket");
    const ticket = await tx.ticket.create({
      data: {
        guildId: input.guildId,
        publicId,
        channelId: input.channelId,
        openerId: input.openerId,
        category: input.category,
        productId: input.productId,
        status: "WAITING_STAFF",
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "TICKET_OPENED",
        actorId: input.openerId,
        payload: { category: input.category, productId: input.productId ?? null },
      },
    });
    return ticket;
  });
}

export async function getTicketByChannel(channelId: string) {
  return prisma.ticket.findUnique({
    where: { channelId },
    include: { product: true, orders: { include: { payment: true, license: true } }, participants: true },
  });
}

export async function getTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      product: true,
      orders: { include: { payment: true, license: true, subscription: true, product: true } },
      participants: true,
    },
  });
}

export async function addTicketEvent(
  ticketId: string,
  type: string,
  actorId: string,
  payload: Prisma.InputJsonValue = {},
) {
  await prisma.ticketEvent.create({ data: { ticketId, type, actorId, payload } });
}

async function requireOpenTicket(ticketId: string) {
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new DomainError("Ticket bulunamadi.");
  if (existing.status === "CLOSED") throw new DomainError("Kapali ticket guncellenemez.");
  return existing;
}

export async function setAssignee(ticketId: string, assigneeId: string | null, actorId: string) {
  await requireOpenTicket(ticketId);
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId, status: assigneeId ? "IN_PROGRESS" : "WAITING_STAFF" },
  });
  await addTicketEvent(ticketId, assigneeId ? "TICKET_ASSIGNED" : "TICKET_UNASSIGNED", actorId, {
    assigneeId,
  });
  return ticket;
}

export async function setStatus(ticketId: string, status: TicketStatus, actorId: string) {
  await requireOpenTicket(ticketId);
  const ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { status } });
  await addTicketEvent(ticketId, "TICKET_STATUS", actorId, { status });
  return ticket;
}

export async function addParticipant(ticketId: string, discordId: string, addedBy: string) {
  await prisma.ticketParticipant.upsert({
    where: { ticketId_discordId: { ticketId, discordId } },
    create: { ticketId, discordId, addedBy },
    update: {},
  });
  await addTicketEvent(ticketId, "TICKET_USER_ADDED", addedBy, { discordId });
}

export async function removeParticipant(ticketId: string, discordId: string, actorId: string) {
  await prisma.ticketParticipant.deleteMany({ where: { ticketId, discordId } });
  await addTicketEvent(ticketId, "TICKET_USER_REMOVED", actorId, { discordId });
}

export async function recordMessage(input: {
  ticketId: string;
  discordMessageId: string;
  authorId: string;
  content: string;
  attachments: Prisma.InputJsonValue;
  createdAt: Date;
}) {
  await prisma.ticketMessage.upsert({
    where: { discordMessageId: input.discordMessageId },
    create: input,
    update: { content: input.content, attachments: input.attachments },
  });
}

export async function closeTicket(ticketId: string, actorId: string, cooldownSec: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new DomainError("Ticket bulunamadi.");
    if (existing.status === "CLOSED") throw new DomainError("Ticket zaten kapali.");
    const ticket = await tx.ticket.update({
      where: { id: ticketId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await tx.ticketEvent.create({
      data: { ticketId, type: "TICKET_CLOSED", actorId, payload: {} },
    });
    return ticket;
  }).then(async (ticket) => {
    try {
      if (cooldownSec > 0) {
        if (redis.status === "wait") await redis.connect();
        await redis.set(`cd:${ticket.guildId}:${ticket.openerId}:ticket`, "1", "EX", cooldownSec);
      }
    } catch (err) {
      console.error("ticket cooldown redis", err);
    }
    return ticket;
  });
}

export async function loadTranscript(ticketId: string) {
  return prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
}



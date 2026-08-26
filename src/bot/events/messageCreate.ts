import type { Message } from "discord.js";
import { getTicketByChannel, recordMessage } from "../../modules/tickets/service";
import { upsertUser } from "../../services/guild.service";

export async function onMessageCreate(message: Message) {
  if (!message.guildId || message.author.bot) return;
  const ticket = await getTicketByChannel(message.channelId);
  if (!ticket || ticket.status === "CLOSED") return;
  await upsertUser(message.guildId, message.author.id, message.author.username);
  await recordMessage({
    ticketId: ticket.id,
    discordMessageId: message.id,
    authorId: message.author.id,
    content: message.content,
    attachments: message.attachments.map((a) => ({ name: a.name, url: a.url, size: a.size })),
    createdAt: message.createdAt,
  });
}

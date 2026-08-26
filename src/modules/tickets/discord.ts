import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import { TicketCategory, TicketStatus } from "@prisma/client";
import { actorFrom, ephemeralError } from "../../bot/actor";
import { encodeCustomId } from "../../lib/custom-id";
import { COLOR, okEmbed, ticketCreatedEmbed } from "../../lib/embeds";
import { DomainError } from "../../lib/errors";
import { withLock } from "../../lib/lock";
import { ACCESS_LABEL, CATEGORY_LABEL, ORDER_STATUS_LABEL } from "../../lib/labels";
import { formatTranscript } from "../../lib/transcript";
import { prisma } from "../../lib/prisma";
import { dispatchLog } from "../logs/dispatcher";
import { paymentLogFields } from "../payments/log-fields";
import { confirmPayment, markPaymentLogged } from "../payments/service";
import { createOrderFromPrice } from "../orders/service";
import { listActive } from "../products/service";
import { addRoles } from "../roles/discord";
import { canPerform, isStaff } from "../../services/permission.service";
import { ensureGuild, getSettings } from "../../services/guild.service";
import {
  addParticipant,
  assertCanOpenTicket,
  channelName,
  closeTicket,
  createTicketRecord,
  getTicketById,
  loadTranscript,
  removeParticipant,
  setAssignee,
  setStatus,
} from "./service";

export function ticketCreateButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId("tkt", "open"))
      .setLabel("Ticket Olustur")
      .setStyle(ButtonStyle.Primary),
  );
}

function categorySelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("tkt", "cat"))
      .setPlaceholder("Kategori sec")
      .addOptions(
        (Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((k) => ({
          label: CATEGORY_LABEL[k],
          value: k,
        })),
      ),
  );
}

function staffRows(ticketId: string, isSale: boolean) {
  const a = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "claim", ticketId)).setLabel("Devral").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "xfer", ticketId)).setLabel("Devret").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "asgn", ticketId)).setLabel("Yetkili Ata").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "waitc", ticketId)).setLabel("Musteri Bekleniyor").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "prog", ticketId)).setLabel("Isleme Al").setStyle(ButtonStyle.Secondary),
  );
  const b = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "add", ticketId)).setLabel("Kullanici Ekle").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "rem", ticketId)).setLabel("Kullanici Cikar").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "res", ticketId)).setLabel("Cozuldu").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(encodeCustomId("tkt", "cls", ticketId)).setLabel("Kapat").setStyle(ButtonStyle.Danger),
  );
  const rows = [a, b];
  if (isSale) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(encodeCustomId("tkt", "price", ticketId)).setLabel("Fiyat Gir").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(encodeCustomId("tkt", "pay", ticketId)).setLabel("Odemeyi Onayla").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(encodeCustomId("tkt", "deliv", ticketId)).setLabel("Teslim Et").setStyle(ButtonStyle.Success),
      ),
    );
  }
  return rows;
}

function staffOverwrites(settings: Awaited<ReturnType<typeof getSettings>>) {
  const ids = [
    settings?.supportRoleId,
    settings?.adminRoleId,
    settings?.ownerRoleId,
  ].filter((id): id is string => Boolean(id));
  return ids.map((id) => ({
    id,
    type: OverwriteType.Role,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ],
  }));
}

export async function handleOpenButton(interaction: ButtonInteraction) {
  const actor = actorFrom(interaction);
  if (!actor) {
    await ephemeralError(interaction, "Sadece sunucuda.");
    return;
  }
  await interaction.reply({
    content: "Kategori sec.",
    components: [categorySelect()],
    ephemeral: true,
  });
}

export async function handleCategorySelect(interaction: StringSelectMenuInteraction) {
  const actor = actorFrom(interaction);
  if (!actor || !interaction.guild) {
    await ephemeralError(interaction, "Sadece sunucuda.");
    return;
  }
  const category = interaction.values[0] as TicketCategory;
  if (category === "SCRIPT_PURCHASE") {
    const products = await listActive(actor.guildId);
    if (products.length === 0) {
      await interaction.update({
        content: "Aktif urun yok. Admin once `/ürün-ekle` ile urun eklemeli.",
        components: [],
      });
      return;
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("tkt", "prod"))
      .setPlaceholder("Urun sec")
      .addOptions(
        products.slice(0, 25).map((p) => ({
          label: p.name.slice(0, 100),
          description: `${p.listPrice.toString()} · v${p.version}`.slice(0, 100),
          value: p.id,
        })),
      );
    await interaction.update({
      content: "Satin almak istedigin urunu sec.",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
    return;
  }
  await openTicketChannel(interaction, category, null);
}

export async function handleProductSelect(interaction: StringSelectMenuInteraction) {
  const productId = interaction.values[0];
  if (!productId) return;
  await openTicketChannel(interaction, "SCRIPT_PURCHASE", productId);
}

async function openTicketChannel(
  interaction: StringSelectMenuInteraction,
  category: TicketCategory,
  productId: string | null,
) {
  const actor = actorFrom(interaction);
  if (!actor || !interaction.guild) {
    await ephemeralError(interaction, "Sadece sunucuda.");
    return;
  }
  const settings = await ensureGuild(actor.guildId, interaction.guild.name);

  // Per-category Discord category mapping (cast needed until prisma generate updates types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any;
  const categoryMap: Record<TicketCategory, string | null | undefined> = {
    SCRIPT_PURCHASE: s.tktCatScriptPurchase,
    SUPPORT:         s.tktCatSupport,
    PAYMENT:         s.tktCatPayment,
    DELIVERY:        s.tktCatDelivery,
    CUSTOM_PROJECT:  s.tktCatCustomProject,
    OTHER:           s.tktCatOther,
  };
  const discordCategoryId = categoryMap[category] ?? settings.ticketCategoryId;

  if (!discordCategoryId) {
    await interaction.update({
      content: "Ticket kategorisi ayarli degil. `/kurulum` ile bagla.",
      components: [],
    });
    return;
  }

  await interaction.update({ content: "Ticket aciliyor...", components: [] });

  const me = interaction.guild.members.me;
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: actor.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    ...(me
      ? [
          {
            id: me.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageRoles,
            ],
          },
        ]
      : []),
    ...staffOverwrites(settings),
  ];

  // Determine which role to mention on ticket open
  const mentionRoleId = category === "SUPPORT"
    ? (settings.supportRoleId ?? settings.adminRoleId)
    : settings.adminRoleId;

  try {
    await withLock(`lock:tkt-open:${actor.guildId}:${actor.userId}`, 30, async () => {
      await assertCanOpenTicket(actor, settings, category);
      const placeholder = await interaction.guild!.channels.create({
        name: `tck-pending-${category.toLowerCase()}`.slice(0, 100),
        type: ChannelType.GuildText,
        parent: discordCategoryId,
        permissionOverwrites: overwrites,
      });
      try {
        const ticket = await createTicketRecord({
          guildId: actor.guildId,
          channelId: placeholder.id,
          openerId: actor.userId,
          category,
          productId: productId ?? undefined,
        });
        const name = channelName(ticket.publicId, category);
        await placeholder.setName(name);
        const product = productId
          ? await prisma.product.findUnique({ where: { id: productId } })
          : null;
        // Build mention string: tag role + user
        const mentionContent = mentionRoleId
          ? `<@&${mentionRoleId}> | <@${actor.userId}>`
          : `<@${actor.userId}>`;
        // 1) User-facing welcome message (no staff buttons)
        await placeholder.send({
          content: mentionContent,
          embeds: [ticketCreatedEmbed(ticket, product?.name)],
        });
        // 2) Staff-only control panel (separate message)
        await placeholder.send({
          content: "**🛠️ Yetkili Paneli** — Sadece yetkililer kullanabilir.",
          components: staffRows(ticket.id, category === "SCRIPT_PURCHASE"),
        });
        await dispatchLog(interaction.client, {
          guildId: actor.guildId,
          actorId: actor.userId,
          action: "TICKET_OPENED",
          entityType: "ticket",
          entityId: ticket.id,
          channelKey: "ticketLogChannelId",
          title: "Ticket acildi",
          fields: [
            { name: "ID", value: ticket.publicId, inline: true },
            { name: "Kullanici", value: `<@${actor.userId}>`, inline: true },
            { name: "Tur", value: CATEGORY_LABEL[category], inline: true },
          ],
        });
        await interaction.followUp({
          content: `Ticket acildi: <#${placeholder.id}> (${ticket.publicId})`,
          ephemeral: true,
        });
      } catch (inner) {
        await placeholder.delete().catch(() => undefined);
        throw inner;
      }
    });
  } catch (e) {
    await interaction.followUp({
      content: e instanceof Error ? e.message : "Ticket acilamadi.",
      ephemeral: true,
    });
  }
}

async function requireStaffTicket(
  interaction: ButtonInteraction | ModalSubmitInteraction | UserSelectMenuInteraction,
  ticketId: string,
  opts?: { allowClosed?: boolean },
) {
  const actor = actorFrom(interaction);
  if (!actor || !interaction.guildId) throw new DomainError("Sadece sunucuda.");
  const settings = await getSettings(actor.guildId);
  if (!canPerform("ticket.staff", actor, settings)) throw new DomainError("Yetkin yok.");
  const ticket = await getTicketById(ticketId);
  if (!ticket || ticket.guildId !== actor.guildId) throw new DomainError("Yetkin yok.");
  if (ticket.status === "CLOSED" && !opts?.allowClosed) {
    throw new DomainError("Kapali ticket guncellenemez.");
  }
  return { actor, settings, ticket };
}

export async function handleClaim(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    await setAssignee(ticket.id, actor.userId, actor.userId);
    await interaction.reply({ embeds: [okEmbed(`Devralindi: <@${actor.userId}>`)], ephemeral: true });
    if (interaction.channel && interaction.channel.isSendable()) {
      await interaction.channel.send(`Yetkili <@${actor.userId}> ticket'i devraldi.`);
    }
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleWaitCustomer(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    await setStatus(ticket.id, TicketStatus.WAITING_CUSTOMER, actor.userId);
    await interaction.reply({ embeds: [okEmbed("Musteri yaniti bekleniyor.")], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleProgress(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    await setStatus(ticket.id, TicketStatus.IN_PROGRESS, actor.userId);
    await interaction.reply({ embeds: [okEmbed("Isleme alindi.")], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleResolved(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    await setStatus(ticket.id, TicketStatus.RESOLVED, actor.userId);
    await interaction.reply({ embeds: [okEmbed("Cozuldu olarak isaretlendi.")], ephemeral: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleAssignButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.reply({
    content: "Yetkili sec.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(encodeCustomId("tkt", "asgnu", ticketId))
          .setPlaceholder("Yetkili")
          .setMinValues(1)
          .setMaxValues(1),
      ),
    ],
  });
}

export async function handleTransferButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.reply({
    content: "Devredilecek yetkiliyi sec.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(encodeCustomId("tkt", "xferu", ticketId))
          .setPlaceholder("Yetkili")
          .setMinValues(1)
          .setMaxValues(1),
      ),
    ],
  });
}

export async function handleAddUserButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.reply({
    content: "Eklenecek kullanici.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(encodeCustomId("tkt", "addu", ticketId))
          .setPlaceholder("Kullanici")
          .setMinValues(1)
          .setMaxValues(1),
      ),
    ],
  });
}

export async function handleRemoveUserButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.reply({
    content: "Cikarilacak kullanici.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(encodeCustomId("tkt", "remu", ticketId))
          .setPlaceholder("Kullanici")
          .setMinValues(1)
          .setMaxValues(1),
      ),
    ],
  });
}

export async function handleStaffUserSelect(
  interaction: UserSelectMenuInteraction,
  action: string,
  ticketId: string,
) {
  try {
    const { actor, ticket, settings } = await requireStaffTicket(interaction, ticketId);
    const target = interaction.users.first();
    if (!target) throw new DomainError("Kullanici sec.");
    const channel = interaction.guild?.channels.cache.get(ticket.channelId);
    if (action === "asgnu" || action === "xferu") {
      const member = await interaction.guild?.members.fetch(target.id);
      if (!member) throw new DomainError("Uye bulunamadi.");
      const targetActor = {
        userId: target.id,
        guildId: actor.guildId,
        isGuildOwner: interaction.guild?.ownerId === target.id,
        isAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
        roleIds: [...member.roles.cache.keys()],
      };
      if (!isStaff(targetActor, settings)) throw new DomainError("Hedef support+ olmali.");
      await setAssignee(ticket.id, target.id, actor.userId);
      if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.edit(target.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }
      await interaction.update({ content: `Atandi: <@${target.id}>`, components: [] });
      return;
    }
    if (action === "addu") {
      await addParticipant(ticket.id, target.id, actor.userId);
      if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.edit(target.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }
      await interaction.update({ content: `Eklendi: <@${target.id}>`, components: [] });
      return;
    }
    if (action === "remu") {
      if (target.id === ticket.openerId) throw new DomainError("Acani cikaramazsin.");
      await removeParticipant(ticket.id, target.id, actor.userId);
      if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.delete(target.id);
      }
      await interaction.update({ content: `Cikarildi: <@${target.id}>`, components: [] });
    }
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handlePriceButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { ticket } = await requireStaffTicket(interaction, ticketId);
    if (ticket.category !== "SCRIPT_PURCHASE") throw new DomainError("Satis ticket'i degil.");
    if (!ticket.productId) throw new DomainError("Urun secili degil.");
    const modal = new ModalBuilder()
      .setCustomId(encodeCustomId("tkt", "pricem", ticketId))
      .setTitle("Fiyat gir")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Tutar")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("currency")
            .setLabel("Para birimi")
            .setStyle(TextInputStyle.Short)
            .setValue("TRY")
            .setRequired(true)
            .setMaxLength(3),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("duration")
            .setLabel("Sure (gun) — bos = sinirsiz")
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("note")
            .setLabel("Not")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(200),
        ),
      );
    await interaction.showModal(modal);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handlePriceModal(interaction: ModalSubmitInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    if (!ticket.productId) throw new DomainError("Urun yok.");
    const amount = interaction.fields.getTextInputValue("amount");
    const currency = interaction.fields.getTextInputValue("currency");
    const durationRaw = interaction.fields.getTextInputValue("duration").trim();
    const note = interaction.fields.getTextInputValue("note").trim();
    const durationDays = durationRaw ? Number(durationRaw) : null;
    if (durationRaw && (!Number.isInteger(durationDays) || (durationDays ?? 0) < 1)) {
      throw new DomainError("Sure tam sayi gun olmali.");
    }
    const order = await withLock(`lock:order:${ticketId}`, 15, () =>
      createOrderFromPrice({
        guildId: actor.guildId,
        ticketId: ticket.id,
        userId: ticket.openerId,
        productId: ticket.productId!,
        amount,
        currency,
        access: durationDays ? "TIMED" : "LIFETIME",
        durationDays,
        actorId: actor.userId,
        note: note || undefined,
      }),
    );
    await dispatchLog(interaction.client, {
      guildId: actor.guildId,
      actorId: actor.userId,
      action: "ORDER_CREATED",
      entityType: "order",
      entityId: order.id,
      channelKey: "orderLogChannelId",
      title: "Siparis olusturuldu",
      fields: [
        { name: "Siparis", value: order.publicId, inline: true },
        { name: "Tutar", value: `${order.amount.toString()} ${order.currency}`, inline: true },
        { name: "Erisim", value: ACCESS_LABEL[order.access], inline: true },
        { name: "Ticket", value: ticket.publicId, inline: true },
      ],
    });
    await interaction.reply({
      embeds: [
        okEmbed(
          `${order.publicId} olusturuldu. Durum: ${ORDER_STATUS_LABEL[order.status]}. Cuzdan adresini sohbete yaz (bot kaydetmez).`,
        ),
      ],
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handlePayButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId);
    const modal = new ModalBuilder()
      .setCustomId(encodeCustomId("tkt", "paym", ticketId))
      .setTitle("Odemeyi onayla")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("ref")
            .setLabel("Tx notu (opsiyonel, kart/CVV yasak)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200),
        ),
      );
    await interaction.showModal(modal);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handlePayModal(interaction: ModalSubmitInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    const ref = interaction.fields.getTextInputValue("ref");
    const result = await withLock(`lock:pay:${ticketId}`, 20, () =>
      confirmPayment({
        guildId: actor.guildId,
        ticketId: ticket.id,
        actorId: actor.userId,
        externalRef: ref || undefined,
      }),
    );
    if (interaction.guild) {
      await addRoles(interaction.guild, result.userId, [
        result.customerRoleId,
        result.productRoleId,
      ]);
    }
    await dispatchLog(interaction.client, {
      guildId: actor.guildId,
      actorId: actor.userId,
      action: "PAYMENT_CONFIRMED",
      entityType: "payment",
      entityId: result.paymentId,
      channelKey: "orderLogChannelId",
      title: "Odeme onaylandi",
      fields: [
        { name: "Odeme", value: result.paymentPublicId, inline: true },
        { name: "Siparis", value: result.orderPublicId, inline: true },
        { name: "Lisans", value: result.licensePublicId, inline: true },
        { name: "Yontem", value: "CRYPTO", inline: true },
      ],
    });
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR.green)
          .setTitle("Odeme onaylandi")
          .setDescription(
            `${result.paymentPublicId} · ${result.orderPublicId}\nLisans: \`${result.licenseKey}\`\nRoller verildi. Teslim Et ile siparisi DELIVERED yap.`,
          ),
      ],
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleDeliver(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket } = await requireStaffTicket(interaction, ticketId);
    if (ticket.status === "CLOSED") throw new DomainError("Kapali ticket'ta teslim yapilamaz.");
    const order = ticket.orders[0];
    if (!order) throw new DomainError("Siparis yok.");
    if (order.status !== "PAID" && order.status !== "PREPARING") {
      throw new DomainError("Once odemeyi onayla.");
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "ORDER_DELIVERED",
        actorId: actor.userId,
        payload: { orderId: order.id },
      },
    });
    await dispatchLog(interaction.client, {
      guildId: actor.guildId,
      actorId: actor.userId,
      action: "ORDER_DELIVERED",
      entityType: "order",
      entityId: order.id,
      channelKey: "orderLogChannelId",
      title: "Teslim edildi",
      fields: [
        { name: "Siparis", value: order.publicId, inline: true },
        { name: "Kullanici", value: `<@${order.userId}>`, inline: true },
      ],
    });
    await interaction.reply({ embeds: [okEmbed(`${order.publicId} teslim edildi.`)] });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

export async function handleCloseButton(interaction: ButtonInteraction, ticketId: string) {
  try {
    await requireStaffTicket(interaction, ticketId, { allowClosed: true });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.reply({
    content: "Ticket kapatilsin mi? Kanal silinmez, kilitlenir. Transcript ve loglar yazilir.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeCustomId("tkt", "clsy", ticketId))
          .setLabel("Kapatmayi onayla")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleCloseConfirm(interaction: ButtonInteraction, ticketId: string) {
  try {
    const { actor, ticket, settings } = await requireStaffTicket(interaction, ticketId, {
      allowClosed: true,
    });
    let justClosed = true;
    let closedPublicId = ticket.publicId;
    try {
      const closed = await withLock(`lock:close:${ticketId}`, 30, () =>
        closeTicket(ticket.id, actor.userId, settings?.ticketCloseCooldownSec ?? 600),
      );
      closedPublicId = closed.publicId;
    } catch (e) {
      if (!(e instanceof DomainError) || e.message !== "Ticket zaten kapali.") throw e;
      justClosed = false;
    }

    if (justClosed) {
      const messages = await loadTranscript(ticket.id);
      const text = formatTranscript(messages);
      const summary = text.length > 1800 ? `${text.slice(0, 1800)}\n…` : text || "(mesaj yok)";
      const files: AttachmentBuilder[] = [];
      const buf = Buffer.from(text || "(bos)", "utf8");
      if (buf.byteLength > 0 && buf.byteLength <= 8 * 1024 * 1024) {
        files.push(new AttachmentBuilder(buf, { name: `${ticket.publicId}-transcript.txt` }));
      }
      await dispatchLog(interaction.client, {
        guildId: actor.guildId,
        actorId: actor.userId,
        action: "TICKET_CLOSED",
        entityType: "ticket",
        entityId: ticket.id,
        channelKey: "ticketLogChannelId",
        title: "Ticket kapatildi",
        description: summary.slice(0, 4000),
        fields: [
          { name: "ID", value: ticket.publicId, inline: true },
          { name: "Kullanici", value: `<@${ticket.openerId}>`, inline: true },
        ],
      });
      if (files.length && settings?.ticketLogChannelId) {
        const ch = await interaction.client.channels.fetch(settings.ticketLogChannelId).catch(() => null);
        if (ch && ch.isTextBased() && !ch.isDMBased()) {
          await ch.send({ files }).catch(() => undefined);
        }
      } else if (buf.byteLength > 8 * 1024 * 1024) {
        const ch = settings?.ticketLogChannelId
          ? await interaction.client.channels.fetch(settings.ticketLogChannelId).catch(() => null)
          : null;
        if (ch && ch.isTextBased() && !ch.isDMBased()) {
          await ch.send("Transcript 8MB ustu; tam metin DB'de.").catch(() => undefined);
        }
      }
    }

    const fresh = await prisma.order.findFirst({
      where: { ticketId: ticket.id },
      include: { payment: true, product: true },
    });
    const payment = fresh?.payment;
    if (fresh && payment && !payment.loggedToDiscordAt && settings?.paymentLogChannelId) {
      const payCh = await interaction.client.channels
        .fetch(settings.paymentLogChannelId)
        .catch(() => null);
      if (payCh && payCh.isTextBased() && !payCh.isDMBased()) {
        const embed = new EmbedBuilder()
          .setColor(COLOR.green)
          .setTitle("Odeme kaydi")
          .addFields(
            paymentLogFields({
              paymentPublicId: payment.publicId,
              orderPublicId: fresh.publicId,
              userId: fresh.userId,
              productName: fresh.product.name,
              amount: fresh.amount.toString(),
              currency: fresh.currency,
              confirmedBy: payment.confirmedBy,
              confirmedAt: payment.confirmedAt,
            }),
          )
          .setTimestamp(new Date());
        await payCh.send({ embeds: [embed] });
        await markPaymentLogged(payment.id);
      }
    }

    const channel = interaction.guild?.channels.cache.get(ticket.channelId);

    if (justClosed && channel && "permissionOverwrites" in channel) {
      // Move channel to closed ticket category (if configured), else lock it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const closedCatId = (settings as any)?.closedTicketCategoryId as string | null | undefined;
      if (closedCatId) {
        try {
          // Move to closed category first (lockPermissions:false keeps channel overwrites)
          await (channel as import("discord.js").TextChannel).setParent(closedCatId, {
            lockPermissions: false,
          });
          // Re-apply permissions AFTER move to ensure they stick
          // Deny opener ViewChannel so channel disappears from their sidebar
          await channel.permissionOverwrites.edit(ticket.openerId, {
            ViewChannel: false,
            SendMessages: false,
          }).catch(() => undefined);
          // Deny everyone so no new people can see it
          await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
            ViewChannel: false,
            SendMessages: false,
          }).catch(() => undefined);
        } catch {
          // Fallback: just deny access without moving
          await channel.permissionOverwrites.edit(ticket.openerId, { ViewChannel: false, SendMessages: false }).catch(() => undefined);
          await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { ViewChannel: false, SendMessages: false }).catch(() => undefined);
        }
      } else {
        // No closed category configured — remove opener access and lock
        await channel.permissionOverwrites.edit(ticket.openerId, { ViewChannel: false, SendMessages: false }).catch(() => undefined);
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: false }).catch(() => undefined);
      }
    }


    if (justClosed && channel && channel.isTextBased() && channel.isSendable()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const closedCatId = (settings as any)?.closedTicketCategoryId as string | null | undefined;
      await channel.send({
        embeds: [okEmbed(`${closedPublicId} kapatildi.${closedCatId ? " Kanal arsive tasindi." : " Kanal kilitlendi."}`)],
      });
    }
    await interaction.update({
      content: justClosed ? "Kapatildi." : "Ticket zaten kapali; odeme logu kontrol edildi.",
      components: [],
    });
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
  }
}

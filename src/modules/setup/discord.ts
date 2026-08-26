import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { encodeCustomId } from "../../lib/custom-id";
import { errorEmbed, okEmbed, setupStatusEmbed, ticketPanelEmbed } from "../../lib/embeds";
import { DomainError } from "../../lib/errors";
import { dispatchLog } from "../logs/dispatcher";
import {
  CHANNEL_SETTING_LABEL,
  ROLE_SETTING_LABEL,
  ensureGuild,
  getSettings,
  isChannelSetting,
  isRoleSetting,
  updateSettings,
  type ChannelSettingKey,
  type RoleSettingKey,
} from "../../services/guild.service";
import { canPerform } from "../../services/permission.service";
import { actorFrom, ephemeralError } from "../../bot/actor";
import { ticketCreateButton } from "../tickets/discord";
import { buildWelcomePayload } from "../welcome/embed";
import {
  resetWelcomeMessage,
  setWelcomeEnabled,
  setWelcomeMessage,
} from "../welcome/service";
import { DEFAULT_WELCOME_MESSAGE, welcomeTemplateHint } from "../welcome/template";

const LOG_KEYS: ChannelSettingKey[] = [
  "ticketLogChannelId",
  "paymentLogChannelId",
  "orderLogChannelId",
  "projectLogChannelId",
  "subscriptionLogChannelId",
  "moderationLogChannelId",
  "securityLogChannelId",
  "botLogChannelId",
];

const TICKET_CAT_KEYS: ChannelSettingKey[] = [
  "ticketCategoryId",
  "tktCatSupport",
  "tktCatScriptPurchase",
  "tktCatPayment",
  "tktCatDelivery",
  "tktCatCustomProject",
  "tktCatOther",
  "closedTicketCategoryId",
];

function mainMenu() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("set", "menu"))
      .setPlaceholder("Ayar bolumu sec")
      .addOptions(
        { label: "Ticket Ayarlari", value: "ticket" },
        { label: "Log Ayarlari", value: "logs" },
        { label: "Rol Ayarlari", value: "roles" },
        { label: "Siparis Ayarlari", value: "orders" },
        { label: "Odeme Ayarlari", value: "pay" },
        { label: "Ozel Siparis Ayarlari", value: "custom" },
        { label: "Urun Ayarlari", value: "products" },
        { label: "Guvenlik Ayarlari", value: "security" },
        { label: "Hos Geldin Ayarlari", value: "welcome" },
      ),
  );
}

function channelBindRows(key: ChannelSettingKey, category: boolean) {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(encodeCustomId("set", "ch", key))
    .setPlaceholder(CHANNEL_SETTING_LABEL[key])
    .setMinValues(1)
    .setMaxValues(1)
    .addChannelTypes(category ? ChannelType.GuildCategory : ChannelType.GuildText);
  const rows: ActionRowBuilder<ChannelSelectMenuBuilder | ButtonBuilder>[] = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
  ];
  if (!category) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeCustomId("set", "use", key))
          .setLabel("Bu Kanali Kullan")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(encodeCustomId("set", "ok", key))
          .setLabel("Onayla")
          .setStyle(ButtonStyle.Success),
      ),
    );
  }
  return rows;
}

function roleBindRow(key: RoleSettingKey) {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(encodeCustomId("set", "rl", key))
      .setPlaceholder(ROLE_SETTING_LABEL[key])
      .setMinValues(1)
      .setMaxValues(1),
  );
}

async function requireSetup(interaction: { guildId: string | null; user: { id: string } }) {
  const actor = actorFrom(interaction as never);
  if (!actor) throw new DomainError("Sadece sunucuda kullanilir.");
  const settings = await ensureGuild(actor.guildId, "unknown");
  if (!canPerform("setup.write", actor, settings)) {
    throw new DomainError("Kurulum yalnizca sunucu sahibi veya Administrator.");
  }
  return { actor, settings };
}

export async function handleKurulum(interaction: ChatInputCommandInteraction) {
  const actor = actorFrom(interaction);
  if (!actor || !interaction.guild) {
    await interaction.reply({ content: "Sadece sunucuda.", ephemeral: true });
    return;
  }
  const settings = await ensureGuild(actor.guildId, interaction.guild.name);
  if (!canPerform("setup.write", actor, settings)) {
    await interaction.reply({
      content: "Kurulum yalnizca sunucu sahibi veya Administrator.",
      ephemeral: true,
    });
    return;
  }
  const sub = interaction.options.getSubcommand(false) ?? "panel";
  if (sub === "durum") {
    await interaction.reply({ embeds: [setupStatusEmbed(settings)], ephemeral: true });
    return;
  }
  await interaction.reply({
    content: "Kurulum paneli. Bolum sec.",
    components: [mainMenu()],
    ephemeral: true,
  });
}

export async function handleSetupSelect(interaction: StringSelectMenuInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const section = interaction.values[0];
  if (section === "ticket") {
    const catSelect = new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("set", "tktcat"))
      .setPlaceholder("Hangi ticket kategorisi ayarlansin?")
      .addOptions(TICKET_CAT_KEYS.map((k) => ({ label: CHANNEL_SETTING_LABEL[k], value: k })));
    await interaction.update({
      content: [
        "**Ticket Ayarlari**",
        "1️⃣  Asagidaki listeden hangi ticket kategorisini ayarlamak istedigini sec.",
        "2️⃣  Karsina cikan Discord kategorisi secicisinden sunucundaki kategoriyi sec.",
        "3️⃣  Ticket panelini yayinlamak icin **#ticket-ac** kanalina gidip asagidaki butona bas.",
      ].join("\n"),
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(catSelect),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(encodeCustomId("set", "pub"))
            .setLabel("Paneli bu kanala gonder")
            .setStyle(ButtonStyle.Success),
        ),
        mainMenu(),
      ],
    });
    return;
  }
  if (section === "logs") {
    const select = new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("set", "logk"))
      .setPlaceholder("Log kanali sec")
      .addOptions(LOG_KEYS.map((k) => ({ label: CHANNEL_SETTING_LABEL[k], value: k })));
    await interaction.update({
      content: "Log ayarlari. Kanal turunu sec, sonra bu kanali kullan veya listeden sec.",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
        mainMenu(),
      ],
    });
    return;
  }
  if (section === "roles") {
    const select = new StringSelectMenuBuilder()
      .setCustomId(encodeCustomId("set", "rolk"))
      .setPlaceholder("Hangi rol")
      .addOptions(
        (Object.keys(ROLE_SETTING_LABEL) as RoleSettingKey[]).map((k) => ({
          label: ROLE_SETTING_LABEL[k],
          value: k,
        })),
      );
    await interaction.update({
      content: "Rol ayarlari. Owner rolü kurulumu degistiremez; yalnizca operasyonel hiyerarsi.",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
        mainMenu(),
      ],
    });
    return;
  }
  if (section === "orders") {
    await interaction.update({
      content: "Siparis log kanali.",
      components: [...channelBindRows("orderLogChannelId", false), mainMenu()],
    });
    return;
  }
  if (section === "pay") {
    await interaction.update({
      content:
        "Odeme V1: cuzdan bot'ta tutulmaz. Admin ticket'a kripto adresini elle yazar, fiyati girer, islemi onaylar. Odeme logu ticket kapaninca gider.",
      components: [...channelBindRows("paymentLogChannelId", false), mainMenu()],
    });
    return;
  }
  if (section === "custom") {
    await interaction.update({
      content: "Ozel siparis kanali (V1 kart UI yok; kanal rezerv).",
      components: [...channelBindRows("customOrderChannelId", false), mainMenu()],
    });
    return;
  }
  if (section === "products") {
    await interaction.update({
      content: "Urun CRUD: `/ürün-ekle`, `/ürün-durum`, katalog `/ürünler`.",
      components: [mainMenu()],
    });
    return;
  }
  if (section === "welcome") {
    await showWelcomePanel(interaction);
    return;
  }
  if (section === "security") {
    const settings = await getSettings(interaction.guildId!);
    await interaction.update({
      content: [
        "Guvenlik (varsayilan): max 2 acik ticket, kategori basi 1, kapanis 10 dk cooldown.",
        `Su an: max=${settings?.maxOpenTickets} kat=${settings?.maxOpenPerCategory} cd=${settings?.ticketCloseCooldownSec}s`,
        "Degistirmek icin `/kurulum` icinde asagidaki buton.",
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(encodeCustomId("set", "sec"))
            .setLabel("Limitleri duzenle")
            .setStyle(ButtonStyle.Secondary),
        ),
        mainMenu(),
      ],
    });
  }
}

export async function handleSetupLogKey(interaction: StringSelectMenuInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const key = interaction.values[0];
  if (!isChannelSetting(key)) {
    await interaction.update({ content: "Gecersiz anahtar.", components: [mainMenu()] });
    return;
  }
  await interaction.update({
    content: `${CHANNEL_SETTING_LABEL[key]}: bu kanali kullan veya baska kanal sec.`,
    components: [...channelBindRows(key, false), mainMenu()],
  });
}

export async function handleSetupTicketCatKey(interaction: StringSelectMenuInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const key = interaction.values[0];
  if (!isChannelSetting(key)) {
    await interaction.update({ content: "Gecersiz anahtar.", components: [mainMenu()] });
    return;
  }
  await interaction.update({
    content: `**${CHANNEL_SETTING_LABEL[key]}** icin Discord kategorisini asagidan sec.`,
    components: [...channelBindRows(key, true), mainMenu()],
  });
}


export async function handleSetupUseChannel(interaction: ButtonInteraction, key: string) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  if (!isChannelSetting(key)) {
    await ephemeralError(interaction, "Gecersiz.");
    return;
  }
  const prompt =
    key === "welcomeChannelId"
      ? `Hos geldin mesajlari <#${interaction.channelId}> kanalina gonderilsin mi?`
      : `${CHANNEL_SETTING_LABEL[key]} olarak <#${interaction.channelId}> kullanilsin mi?`;
  await interaction.reply({
    content: prompt,
    ephemeral: true,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeCustomId("set", "ok", key))
          .setLabel("Onayla")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(encodeCustomId("set", "no", key))
          .setLabel("Iptal")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

export async function handleSetupConfirmChannel(interaction: ButtonInteraction, key: string) {
  const ctx = await requireSetup(interaction).catch((e: unknown) => {
    void ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return null;
  });
  if (!ctx) return;
  if (!isChannelSetting(key)) {
    await ephemeralError(interaction, "Gecersiz.");
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previous = (ctx.settings as any)[key];
  const oldLabel = typeof previous === "string" && previous ? `<#${previous}>` : "Ayarlanmadi";
  const updated = await updateSettings(ctx.actor.guildId, { [key]: interaction.channelId });
  await dispatchLog(interaction.client, {
    guildId: ctx.actor.guildId,
    actorId: ctx.actor.userId,
    action: "SETTINGS_UPDATED",
    entityType: "guild_settings",
    entityId: ctx.actor.guildId,
    channelKey: "botLogChannelId",
    title: "Bot ayari degistirildi",
    fields: [
      { name: "Ayar", value: CHANNEL_SETTING_LABEL[key], inline: true },
      { name: "Eski", value: oldLabel, inline: true },
      { name: "Yeni", value: `<#${interaction.channelId}>`, inline: true },
      { name: "Degistiren", value: `<@${ctx.actor.userId}>`, inline: true },
    ],
  });
  await interaction.update({
    content: `${CHANNEL_SETTING_LABEL[key]} → <#${interaction.channelId}>`,
    embeds: [setupStatusEmbed(updated)],
    components: [],
  });
}

export async function handleSetupChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  key: string,
) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  if (!isChannelSetting(key)) {
    await ephemeralError(interaction, "Gecersiz.");
    return;
  }
  const channelId = interaction.values[0];
  if (!channelId) return;
  const current = await getSettings(interaction.guildId!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previous = (current as any)?.[key];
  const oldLabel = typeof previous === "string" && previous ? `<#${previous}>` : "Ayarlanmadi";
  const updated = await updateSettings(interaction.guildId!, { [key]: channelId });
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "SETTINGS_UPDATED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Bot ayari degistirildi",
    fields: [
      { name: "Ayar", value: CHANNEL_SETTING_LABEL[key], inline: true },
      { name: "Eski", value: oldLabel, inline: true },
      { name: "Yeni", value: `<#${channelId}>`, inline: true },
      { name: "Degistiren", value: `<@${interaction.user.id}>`, inline: true },
    ],
  });
  await interaction.update({
    content: `${CHANNEL_SETTING_LABEL[key]} → <#${channelId}>`,
    embeds: [okEmbed("Kaydedildi."), setupStatusEmbed(updated)],
    components: [mainMenu()],
  });
}

export async function handleSetupRoleSelect(interaction: RoleSelectMenuInteraction, key: string) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  if (!isRoleSetting(key)) {
    await ephemeralError(interaction, "Gecersiz.");
    return;
  }
  const roleId = interaction.values[0];
  if (!roleId) return;
  const updated = await updateSettings(interaction.guildId!, { [key]: roleId });
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "SETTINGS_UPDATED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Rol ayari",
    fields: [
      { name: "Alan", value: ROLE_SETTING_LABEL[key], inline: true },
      { name: "Rol", value: `<@&${roleId}>`, inline: true },
    ],
  });
  await interaction.update({
    content: `${ROLE_SETTING_LABEL[key]} → <@&${roleId}>`,
    embeds: [setupStatusEmbed(updated)],
    components: [mainMenu()],
  });
}

export async function handleSetupRoleKey(interaction: StringSelectMenuInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const key = interaction.values[0];
  if (!key || !isRoleSetting(key)) {
    await interaction.update({ content: "Gecersiz anahtar.", components: [mainMenu()] });
    return;
  }
  await interaction.update({
    content: `${ROLE_SETTING_LABEL[key]} sec.`,
    components: [roleBindRow(key), mainMenu()],
  });
}

export async function handlePublishPanel(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  if (!interaction.channel || !interaction.channel.isTextBased() || interaction.channel.isDMBased()) {
    await ephemeralError(interaction, "Metin kanalinda kullan.");
    return;
  }
  const msg = await interaction.channel.send({
    embeds: [ticketPanelEmbed()],
    components: [ticketCreateButton()],
  });
  await updateSettings(interaction.guildId!, {
    ticketPanelChannelId: interaction.channelId,
    ticketPanelMessageId: msg.id,
  });
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "TICKET_PANEL_PUBLISHED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Ticket paneli yayinlandi",
    fields: [{ name: "Kanal", value: `<#${interaction.channelId}>` }],
  });
  await interaction.reply({ embeds: [okEmbed("Panel gonderildi.")], ephemeral: true });
}

export async function handleSecurityButton(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const settings = await getSettings(interaction.guildId!);
  const modal = new ModalBuilder()
    .setCustomId(encodeCustomId("set", "secm"))
    .setTitle("Guvenlik limitleri")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("maxOpen")
          .setLabel("Max acik ticket")
          .setStyle(TextInputStyle.Short)
          .setValue(String(settings?.maxOpenTickets ?? 2)),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("maxCat")
          .setLabel("Kategori basi max")
          .setStyle(TextInputStyle.Short)
          .setValue(String(settings?.maxOpenPerCategory ?? 1)),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("cooldown")
          .setLabel("Kapanis cooldown (saniye)")
          .setStyle(TextInputStyle.Short)
          .setValue(String(settings?.ticketCloseCooldownSec ?? 600)),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleSecurityModal(
  interaction: import("discord.js").ModalSubmitInteraction,
) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const maxOpen = Number(interaction.fields.getTextInputValue("maxOpen"));
  const maxCat = Number(interaction.fields.getTextInputValue("maxCat"));
  const cooldown = Number(interaction.fields.getTextInputValue("cooldown"));
  if (![maxOpen, maxCat, cooldown].every((n) => Number.isInteger(n) && n >= 0)) {
    await interaction.reply({ embeds: [errorEmbed("Tam sayi gir.")], ephemeral: true });
    return;
  }
  const updated = await updateSettings(interaction.guildId!, {
    maxOpenTickets: maxOpen,
    maxOpenPerCategory: maxCat,
    ticketCloseCooldownSec: cooldown,
  });
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "SETTINGS_UPDATED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Guvenlik ayarlari",
    description: `max=${maxOpen} kat=${maxCat} cd=${cooldown}s`,
  });
  await interaction.reply({ embeds: [setupStatusEmbed(updated)], ephemeral: true });
}

function welcomeMenu(enabled: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId("wel", "ch"))
      .setLabel("Hos Geldin Kanali")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("wel", "tog"))
      .setLabel(enabled ? "Sistemi Kapat" : "Sistemi Ac")
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("wel", "edit"))
      .setLabel("Mesaji Duzenle")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("wel", "prev"))
      .setLabel("Onizleme Goster")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(encodeCustomId("wel", "rst"))
      .setLabel("Varsayilana Sifirla")
      .setStyle(ButtonStyle.Secondary),
  );
}

function welcomePanelContent(settings: NonNullable<Awaited<ReturnType<typeof getSettings>>>) {
  const on = settings.welcomeEnabled ? "Aktif" : "Kapali";
  const ch = settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Ayarlanmadi";
  return [
    `Hos Geldin Sistemi: **${on}**`,
    `Hos Geldin Kanali: ${ch}`,
    `Degiskenler: \`${welcomeTemplateHint()}\``,
  ].join("\n");
}

async function showWelcomePanel(
  interaction: StringSelectMenuInteraction | ButtonInteraction | import("discord.js").ModalSubmitInteraction,
) {
  const settings = await getSettings(interaction.guildId!);
  if (!settings) {
    await ephemeralError(interaction, "Ayarlar yok.");
    return;
  }
  const payload = {
    content: welcomePanelContent(settings),
    components: [welcomeMenu(settings.welcomeEnabled), mainMenu()],
  };
  if (interaction.isModalSubmit()) {
    await interaction.reply({ ...payload, ephemeral: true });
    return;
  }
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ ...payload, ephemeral: true });
    return;
  }
  if (interaction.isStringSelectMenu() || (interaction.isButton() && interaction.message.flags.has(MessageFlags.Ephemeral))) {
    await interaction.update(payload);
    return;
  }
  await interaction.reply({ ...payload, ephemeral: true });
}

export async function handleWelcomeChannelButton(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.update({
    content: "Hos geldin kanali: bu kanali kullan veya listeden sec.",
    components: [...channelBindRows("welcomeChannelId", false), mainMenu()],
  });
}

export async function handleWelcomeToggle(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const current = await getSettings(interaction.guildId!);
  const next = !current?.welcomeEnabled;
  const updated = await setWelcomeEnabled(interaction.guildId!, next);
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: next ? "WELCOME_ENABLED" : "WELCOME_DISABLED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Bot ayari degistirildi",
    fields: [
      { name: "Ayar", value: "Hos Geldin Sistemi", inline: true },
      { name: "Eski", value: current?.welcomeEnabled ? "Aktif" : "Kapali", inline: true },
      { name: "Yeni", value: next ? "Aktif" : "Kapali", inline: true },
      { name: "Degistiren", value: `<@${interaction.user.id}>`, inline: true },
    ],
  });
  await interaction.update({
    content: welcomePanelContent(updated),
    components: [welcomeMenu(updated.welcomeEnabled), mainMenu()],
  });
}

export async function handleWelcomeEdit(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const settings = await getSettings(interaction.guildId!);
  const current = settings?.welcomeMessage?.trim() || DEFAULT_WELCOME_MESSAGE;
  const modal = new ModalBuilder()
    .setCustomId(encodeCustomId("wel", "edtm"))
    .setTitle("Hos geldin mesaji")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("msg")
          .setLabel("Mesaj")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(current.slice(0, 1000)),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleWelcomeEditModal(
  interaction: import("discord.js").ModalSubmitInteraction,
) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const msg = interaction.fields.getTextInputValue("msg").trim();
  if (!msg) {
    await interaction.reply({ embeds: [errorEmbed("Mesaj bos olamaz.")], ephemeral: true });
    return;
  }
  const updated = await setWelcomeMessage(interaction.guildId!, msg);
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "WELCOME_MESSAGE_UPDATED",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Bot ayari degistirildi",
    fields: [
      { name: "Ayar", value: "Hos geldin mesaji", inline: true },
      { name: "Degistiren", value: `<@${interaction.user.id}>`, inline: true },
    ],
  });
  await interaction.reply({
    content: welcomePanelContent(updated),
    components: [welcomeMenu(updated.welcomeEnabled), mainMenu()],
    ephemeral: true,
  });
}

export async function handleWelcomePreview(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? interaction.member;
  if (!interaction.guild || !member || !("user" in member) || !("guild" in member)) {
    await ephemeralError(interaction, "Onizleme icin sunucu uyesi gerekli.");
    return;
  }
  const settings = await getSettings(interaction.guildId!);
  const payload = buildWelcomePayload({
    member: member as import("discord.js").GuildMember,
    template: settings?.welcomeMessage,
    embedEnabled: settings?.welcomeEmbedEnabled ?? true,
  });
  await interaction.reply({
    content: payload.content,
    embeds: payload.embeds,
    ephemeral: true,
  });
}

export async function handleWelcomeReset(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  const updated = await resetWelcomeMessage(interaction.guildId!);
  await dispatchLog(interaction.client, {
    guildId: interaction.guildId!,
    actorId: interaction.user.id,
    action: "WELCOME_MESSAGE_RESET",
    entityType: "guild_settings",
    entityId: interaction.guildId!,
    channelKey: "botLogChannelId",
    title: "Bot ayari degistirildi",
    fields: [
      { name: "Ayar", value: "Hos geldin mesaji varsayilan", inline: true },
      { name: "Degistiren", value: `<@${interaction.user.id}>`, inline: true },
    ],
  });
  await interaction.update({
    content: welcomePanelContent(updated),
    components: [welcomeMenu(updated.welcomeEnabled), mainMenu()],
  });
}

export async function handleSetupCancel(interaction: ButtonInteraction) {
  try {
    await requireSetup(interaction);
  } catch (e) {
    await ephemeralError(interaction, e instanceof Error ? e.message : "Hata");
    return;
  }
  await interaction.update({ content: "Iptal edildi.", components: [] });
}

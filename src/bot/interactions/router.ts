import type { Interaction } from "discord.js";
import { decodeCustomId } from "../../lib/custom-id";
import {
  handleAbone,
  handleAbonePick,
  handleLisans,
  handleProfil,
  handleSiparisler,
  handleUrunler,
} from "./commands/customer";
import {
  handleAboneBilgi,
  handleAboneDondur,
  handleAboneIptal,
  handleAboneUzat,
  handleAboneVer,
  handleSiparisIptal,
  handleSiparisIade,
  handleUrunDurum,
  handleUrunEkle,
  handleUrunSil,
  handleSohbetTemizle,
} from "./commands/admin";
import {
  handleSetupChannelSelect,
  handleSetupConfirmChannel,
  handleSetupLogKey,
  handleSetupRoleKey,
  handleSetupRoleSelect,
  handleKurulum,
  handleSetupSelect,
  handleSetupUseChannel,
  handlePublishPanel,
  handleSecurityButton,
  handleSecurityModal,
  handleSetupCancel,
  handleWelcomeChannelButton,
  handleWelcomeEdit,
  handleWelcomeEditModal,
  handleWelcomePreview,
  handleWelcomeReset,
  handleWelcomeToggle,
  handleSetupTicketCatKey,
} from "../../modules/setup/discord";
import {
  handleAddUserButton,
  handleAssignButton,
  handleCategorySelect,
  handleClaim,
  handleCloseButton,
  handleCloseConfirm,
  handleDeliver,
  handleOpenButton,
  handlePayButton,
  handlePayModal,
  handlePriceButton,
  handlePriceModal,
  handleProductSelect,
  handleProgress,
  handleRemoveUserButton,
  handleResolved,
  handleStaffUserSelect,
  handleTransferButton,
  handleWaitCustomer,
} from "../../modules/tickets/discord";
import { rateLimit } from "../../lib/lock";
import { ephemeralError } from "../actor";

export async function routeInteraction(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const ok = await rateLimit(`rl:${interaction.guildId}:${interaction.user.id}:cmd`, 2);
    if (!ok) {
      await interaction.reply({ content: "Yavasla.", ephemeral: true });
      return;
    }
    switch (interaction.commandName) {
      case "kurulum":
        await handleKurulum(interaction);
        return;
      case "ürünler":
        await handleUrunler(interaction);
        return;
      case "siparişler":
        await handleSiparisler(interaction);
        return;
      case "lisans":
        await handleLisans(interaction);
        return;
      case "profil":
        await handleProfil(interaction);
        return;
      case "abone":
        await handleAbone(interaction);
        return;
      case "ürün-ekle":
        await handleUrunEkle(interaction);
        return;
      case "ürün-durum":
        await handleUrunDurum(interaction);
        return;
      case "ürün-sil":
        await handleUrunSil(interaction);
        return;
      case "sohbet-temizle":
        await handleSohbetTemizle(interaction);
        return;
      case "abone-ver":
        await handleAboneVer(interaction);
        return;
      case "abone-uzat":
        await handleAboneUzat(interaction);
        return;
      case "abone-iptal":
        await handleAboneIptal(interaction);
        return;
      case "abone-dondur":
        await handleAboneDondur(interaction);
        return;
      case "abone-bilgi":
        await handleAboneBilgi(interaction);
        return;
      case "sipariş-iptal":
        await handleSiparisIptal(interaction);
        return;
      case "sipariş-iade":
        await handleSiparisIade(interaction);
        return;
      default:
        await interaction.reply({ content: "Bilinmeyen komut.", ephemeral: true });
    }
    return;
  }

  if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
    const parsed = decodeCustomId(interaction.customId);
    if (!parsed) return;
    const { area, action, entityId } = parsed;

    if (area === "set") {
      if (interaction.isStringSelectMenu() && action === "menu") {
        await handleSetupSelect(interaction);
        return;
      }
      if (interaction.isStringSelectMenu() && action === "logk") {
        await handleSetupLogKey(interaction);
        return;
      }
      if (interaction.isStringSelectMenu() && action === "rolk") {
        await handleSetupRoleKey(interaction);
        return;
      }
      if (interaction.isStringSelectMenu() && action === "tktcat") {
        await handleSetupTicketCatKey(interaction);
        return;
      }
      if (interaction.isChannelSelectMenu() && action === "ch" && entityId) {
        await handleSetupChannelSelect(interaction, entityId);
        return;
      }
      if (interaction.isRoleSelectMenu() && action === "rl" && entityId) {
        await handleSetupRoleSelect(interaction, entityId);
        return;
      }
      if (interaction.isButton() && action === "use" && entityId) {
        await handleSetupUseChannel(interaction, entityId);
        return;
      }
      if (interaction.isButton() && action === "ok" && entityId) {
        await handleSetupConfirmChannel(interaction, entityId);
        return;
      }
      if (interaction.isButton() && action === "no") {
        await handleSetupCancel(interaction);
        return;
      }
      if (interaction.isButton() && action === "pub") {
        await handlePublishPanel(interaction);
        return;
      }
      if (interaction.isButton() && action === "sec") {
        await handleSecurityButton(interaction);
        return;
      }
      if (interaction.isModalSubmit() && action === "secm") {
        await handleSecurityModal(interaction);
        return;
      }
    }

    if (area === "wel") {
      if (interaction.isButton() && action === "ch") {
        await handleWelcomeChannelButton(interaction);
        return;
      }
      if (interaction.isButton() && action === "tog") {
        await handleWelcomeToggle(interaction);
        return;
      }
      if (interaction.isButton() && action === "edit") {
        await handleWelcomeEdit(interaction);
        return;
      }
      if (interaction.isButton() && action === "prev") {
        await handleWelcomePreview(interaction);
        return;
      }
      if (interaction.isButton() && action === "rst") {
        await handleWelcomeReset(interaction);
        return;
      }
      if (interaction.isModalSubmit() && action === "edtm") {
        await handleWelcomeEditModal(interaction);
        return;
      }
    }

    if (area === "sub" && interaction.isStringSelectMenu() && action === "pick") {
      await handleAbonePick(interaction);
      return;
    }

    if (area === "tkt") {
      if (interaction.isButton() && action === "open") {
        await handleOpenButton(interaction);
        return;
      }
      if (interaction.isStringSelectMenu() && action === "cat") {
        await handleCategorySelect(interaction);
        return;
      }
      if (interaction.isStringSelectMenu() && action === "prod") {
        await handleProductSelect(interaction);
        return;
      }
      if (!entityId) {
        await ephemeralError(interaction, "Gecersiz bilesen.");
        return;
      }
      if (interaction.isButton()) {
        switch (action) {
          case "claim":
            await handleClaim(interaction, entityId);
            return;
          case "xfer":
            await handleTransferButton(interaction, entityId);
            return;
          case "asgn":
            await handleAssignButton(interaction, entityId);
            return;
          case "waitc":
            await handleWaitCustomer(interaction, entityId);
            return;
          case "prog":
            await handleProgress(interaction, entityId);
            return;
          case "add":
            await handleAddUserButton(interaction, entityId);
            return;
          case "rem":
            await handleRemoveUserButton(interaction, entityId);
            return;
          case "res":
            await handleResolved(interaction, entityId);
            return;
          case "cls":
            await handleCloseButton(interaction, entityId);
            return;
          case "clsy":
            await handleCloseConfirm(interaction, entityId);
            return;
          case "price":
            await handlePriceButton(interaction, entityId);
            return;
          case "pay":
            await handlePayButton(interaction, entityId);
            return;
          case "deliv":
            await handleDeliver(interaction, entityId);
            return;
          default:
            return;
        }
      }
      if (interaction.isUserSelectMenu()) {
        await handleStaffUserSelect(interaction, action, entityId);
        return;
      }
      if (interaction.isModalSubmit() && action === "pricem") {
        await handlePriceModal(interaction, entityId);
        return;
      }
      if (interaction.isModalSubmit() && action === "paym") {
        await handlePayModal(interaction, entityId);
        return;
      }
    }
  }
}

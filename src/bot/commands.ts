import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const ADMIN_ONLY = PermissionFlagsBits.Administrator;

export function commandPayload() {
  return [
    // ── Admin only (gizli) ────────────────────────────────────────────────
    new SlashCommandBuilder()
      .setName("kurulum")
      .setDescription("Sunucu kurulum paneli")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addSubcommand((s) => s.setName("panel").setDescription("Kurulum panelini ac"))
      .addSubcommand((s) => s.setName("durum").setDescription("Ayar durumunu goster"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("ürün-ekle")
      .setDescription("Yeni urun ekle")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("ad").setDescription("Urun adi").setRequired(true))
      .addNumberOption((o) => o.setName("fiyat").setDescription("Liste fiyati").setRequired(true))
      .addStringOption((o) => o.setName("aciklama").setDescription("Aciklama"))
      .addStringOption((o) => o.setName("surum").setDescription("Surum"))
      .addRoleOption((o) => o.setName("rol").setDescription("Urun rolu"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("ürün-durum")
      .setDescription("Urun durumunu degistir")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("Urun UUID").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("durum")
          .setDescription("Durum")
          .setRequired(true)
          .addChoices(
            { name: "Aktif", value: "ACTIVE" },
            { name: "Pasif", value: "PASSIVE" },
            { name: "Arsiv", value: "ARCHIVED" },
          ),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("abone-ver")
      .setDescription("Kullaniciya abonelik ver")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addUserOption((o) => o.setName("kullanici").setDescription("Hedef").setRequired(true))
      .addStringOption((o) => o.setName("urun_id").setDescription("Urun UUID").setRequired(true))
      .addIntegerOption((o) => o.setName("gun").setDescription("Sure (bos = sinirsiz)"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("abone-uzat")
      .setDescription("Abonelik uzat")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("SUB-000001").setRequired(true))
      .addIntegerOption((o) => o.setName("gun").setDescription("Eklenecek gun").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("abone-iptal")
      .setDescription("Abonelik iptal")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("SUB-000001").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("abone-dondur")
      .setDescription("Abonelik dondur")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("SUB-000001").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("abone-bilgi")
      .setDescription("Abonelik bilgisi")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("SUB-000001").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("sipariş-iptal")
      .setDescription("Odemesiz siparisi iptal et")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("ORD-000001").setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("sipariş-iade")
      .setDescription("Odemeyi iade et, lisans/rol iptal")
      .setDefaultMemberPermissions(ADMIN_ONLY)
      .addStringOption((o) => o.setName("id").setDescription("ORD-000001").setRequired(true))
      .toJSON(),

    // ── Kullanıcı komutları (herkes görebilir) ────────────────────────────
    new SlashCommandBuilder().setName("ürünler").setDescription("Aktif urun katalogu").toJSON(),
    new SlashCommandBuilder().setName("siparişler").setDescription("Siparislerin").toJSON(),
    new SlashCommandBuilder().setName("lisans").setDescription("Lisans kodlarin").toJSON(),
    new SlashCommandBuilder().setName("profil").setDescription("Profil ozetin").toJSON(),
    new SlashCommandBuilder().setName("abone").setDescription("Aboneliklerin").toJSON(),
  ];
}

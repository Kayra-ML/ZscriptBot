-- AlterTable
ALTER TABLE "guild_settings" ADD COLUMN "welcome_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "guild_settings" ADD COLUMN "welcome_channel_id" TEXT;
ALTER TABLE "guild_settings" ADD COLUMN "welcome_message" TEXT;
ALTER TABLE "guild_settings" ADD COLUMN "welcome_embed_enabled" BOOLEAN NOT NULL DEFAULT true;

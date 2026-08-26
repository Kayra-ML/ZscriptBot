-- Add per-category ticket Discord category IDs and closed ticket category
ALTER TABLE "guild_settings"
  ADD COLUMN IF NOT EXISTS "tkt_cat_script_purchase" TEXT,
  ADD COLUMN IF NOT EXISTS "tkt_cat_support"         TEXT,
  ADD COLUMN IF NOT EXISTS "tkt_cat_payment"         TEXT,
  ADD COLUMN IF NOT EXISTS "tkt_cat_delivery"        TEXT,
  ADD COLUMN IF NOT EXISTS "tkt_cat_custom_project"  TEXT,
  ADD COLUMN IF NOT EXISTS "tkt_cat_other"           TEXT,
  ADD COLUMN IF NOT EXISTS "closed_ticket_category_id" TEXT;

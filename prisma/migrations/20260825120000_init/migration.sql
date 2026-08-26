-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('SCRIPT_PURCHASE', 'SUPPORT', 'PAYMENT', 'DELIVERY', 'CUSTOM_PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WAITING_STAFF', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('LIFETIME', 'TIMED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CRYPTO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'LIFETIME', 'FROZEN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('APPROVED', 'IN_PROGRESS', 'WAITING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CounterKind" AS ENUM ('ticket', 'order', 'payment', 'project', 'license', 'subscription');

-- CreateEnum
CREATE TYPE "SubscriptionNotifyKind" AS ENUM ('d7', 'd3', 'd1', 'expired');

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "guild_id" TEXT NOT NULL,
    "ticket_panel_channel_id" TEXT,
    "ticket_category_id" TEXT,
    "custom_order_channel_id" TEXT,
    "ticket_log_channel_id" TEXT,
    "payment_log_channel_id" TEXT,
    "order_log_channel_id" TEXT,
    "project_log_channel_id" TEXT,
    "subscription_log_channel_id" TEXT,
    "moderation_log_channel_id" TEXT,
    "security_log_channel_id" TEXT,
    "bot_log_channel_id" TEXT,
    "owner_role_id" TEXT,
    "admin_role_id" TEXT,
    "support_role_id" TEXT,
    "developer_role_id" TEXT,
    "customer_role_id" TEXT,
    "max_open_tickets" INTEGER NOT NULL DEFAULT 2,
    "max_open_per_category" INTEGER NOT NULL DEFAULT 1,
    "ticket_close_cooldown_sec" INTEGER NOT NULL DEFAULT 600,
    "ticket_panel_message_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "list_price" DECIMAL(12,2) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "role_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_counters" (
    "guild_id" TEXT NOT NULL,
    "kind" "CounterKind" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "id_counters_pkey" PRIMARY KEY ("guild_id","kind")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "opener_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING_STAFF',
    "product_id" TEXT,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_participants" (
    "ticket_id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,

    CONSTRAINT "ticket_participants_pkey" PRIMARY KEY ("ticket_id","discord_id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "discord_message_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "access" "AccessType" NOT NULL,
    "duration_days" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "project_id" TEXT,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CRYPTO',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "external_ref" VARCHAR(200),
    "confirmed_by" TEXT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_to_discord_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_notifications" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "kind" "SubscriptionNotifyKind" NOT NULL,

    CONSTRAINT "subscription_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "channel_message_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,
    "developer_id" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'APPROVED',
    "starts_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_guild_id_discord_id_key" ON "users"("guild_id", "discord_id");

-- CreateIndex
CREATE INDEX "products_guild_id_status_idx" ON "products"("guild_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channel_id_key" ON "tickets"("channel_id");

-- CreateIndex
CREATE INDEX "tickets_guild_id_opener_id_status_idx" ON "tickets"("guild_id", "opener_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guild_id_public_id_key" ON "tickets"("guild_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_messages_discord_message_id_key" ON "ticket_messages"("discord_message_id");

-- CreateIndex
CREATE INDEX "ticket_events_ticket_id_created_at_idx" ON "ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_ticket_id_key" ON "orders"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_guild_id_public_id_key" ON "orders"("guild_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_guild_id_public_id_key" ON "payments"("guild_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_key_key" ON "licenses"("key");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_order_id_key" ON "licenses"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_guild_id_public_id_key" ON "licenses"("guild_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_order_id_key" ON "subscriptions"("order_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_expires_at_idx" ON "subscriptions"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_guild_id_public_id_key" ON "subscriptions"("guild_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_notifications_subscription_id_kind_key" ON "subscription_notifications"("subscription_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ticket_id_key" ON "projects"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_guild_id_public_id_key" ON "projects"("guild_id", "public_id");

-- CreateIndex
CREATE INDEX "project_events_project_id_created_at_idx" ON "project_events"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_guild_id_created_at_idx" ON "audit_logs"("guild_id", "created_at");

-- AddForeignKey
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_counters" ADD CONSTRAINT "id_counters_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_participants" ADD CONSTRAINT "ticket_participants_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

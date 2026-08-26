-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

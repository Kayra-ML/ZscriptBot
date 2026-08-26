import {
  AccessType,
  OrderStatus,
  SubscriptionStatus,
  TicketCategory,
  TicketStatus,
} from "@prisma/client";

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  SCRIPT_PURCHASE: "Script Satin Alma",
  SUPPORT: "Destek",
  PAYMENT: "Odeme",
  DELIVERY: "Teslimat",
  CUSTOM_PROJECT: "Ozel Proje",
  OTHER: "Diger",
};

export const CATEGORY_SLUG: Record<TicketCategory, string> = {
  SCRIPT_PURCHASE: "script",
  SUPPORT: "destek",
  PAYMENT: "odeme",
  DELIVERY: "teslimat",
  CUSTOM_PROJECT: "proje",
  OTHER: "diger",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Yetkili Bekleniyor",
  WAITING_STAFF: "Yetkili Bekleniyor",
  IN_PROGRESS: "Islemde",
  WAITING_CUSTOMER: "Musteri Yaniti Bekleniyor",
  RESOLVED: "Cozuldu",
  CLOSED: "Kapatildi",
};

export const TICKET_STATUS_EMOJI: Record<TicketStatus, string> = {
  OPEN: "\u{1F7E1}",
  WAITING_STAFF: "\u{1F7E1}",
  IN_PROGRESS: "\u{1F535}",
  WAITING_CUSTOMER: "\u{1F7E0}",
  RESOLVED: "\u{1F7E2}",
  CLOSED: "\u26AB",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Beklemede",
  PAYMENT_PENDING: "Odeme Bekleniyor",
  PAID: "Odendi",
  PREPARING: "Hazirlaniyor",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "Iptal",
  REFUNDED: "Iade",
};

export const ACCESS_LABEL: Record<AccessType, string> = {
  LIFETIME: "Sinirsiz",
  TIMED: "Sureli",
};

export const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Aktif",
  EXPIRING_SOON: "Suresi Yakin",
  EXPIRED: "Suresi Doldu",
  CANCELLED: "Iptal",
  LIFETIME: "Sinirsiz",
  FROZEN: "Donduruldu",
};

export function ticketChannelName(publicId: string, category: TicketCategory): string {
  const n = publicId.replace("TCK-", "").toLowerCase();
  const slug = CATEGORY_SLUG[category];
  return `${slug}-${n}`.slice(0, 100);
}

export function remainingText(expiresAt: Date | null, now = new Date()): string {
  if (!expiresAt) return "Sinirsiz";
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Suresi doldu";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} gun ${hours} saat`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours} saat ${minutes} dk`;
}

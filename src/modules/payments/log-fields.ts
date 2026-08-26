export type PaymentLogInput = {
  paymentPublicId: string;
  orderPublicId: string;
  userId: string;
  productName: string;
  amount: string;
  currency: string;
  confirmedBy: string;
  confirmedAt: Date;
};

export function paymentLogFields(input: PaymentLogInput) {
  return [
    { name: "Odeme", value: input.paymentPublicId, inline: true },
    { name: "Siparis", value: input.orderPublicId, inline: true },
    { name: "Kullanici", value: `<@${input.userId}>`, inline: true },
    { name: "Urun", value: input.productName, inline: true },
    { name: "Tutar", value: `${input.amount} ${input.currency}`, inline: true },
    { name: "Yontem", value: "CRYPTO", inline: true },
    { name: "Onaylayan", value: `<@${input.confirmedBy}>`, inline: true },
    {
      name: "Tarih",
      value: `<t:${Math.floor(input.confirmedAt.getTime() / 1000)}:F>`,
      inline: true,
    },
  ];
}

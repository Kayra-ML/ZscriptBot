const CARD_RE = /(?:\d[ -]*?){13,19}/;
const CVV_RE = /\b(cvv|cvc|cvc2|cvv2|guvenlik kodu|güvenlik kodu)\b/i;
const CARD_WORD_RE = /\b(kart\s*no|card\s*number|pan|iban\s*:)\b/i;

export function containsSensitive(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return CARD_RE.test(trimmed) || CVV_RE.test(trimmed) || CARD_WORD_RE.test(trimmed);
}

export function assertNotSensitive(text: string): void {
  if (containsSensitive(text)) {
    throw new Error("Kart, CVV veya benzeri hassas veri kabul edilmez.");
  }
}

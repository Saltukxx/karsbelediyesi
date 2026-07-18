/**
 * Soyut gönderim katmanı — ileride WhatsApp Business Cloud API'ye geçiş için.
 */

export type SendAdapter = {
  sendText: (to: string, text: string) => Promise<void>;
};

let adapter: SendAdapter | null = null;
let lastSendAt = 0;
const MIN_GAP_MS = 1500;

export function setSendAdapter(a: SendAdapter) {
  adapter = a;
}

export async function sendText(to: string, text: string) {
  if (!adapter) throw new Error("Send adapter yok");
  const wait = MIN_GAP_MS - (Date.now() - lastSendAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await adapter.sendText(to, text);
  lastSendAt = Date.now();
}

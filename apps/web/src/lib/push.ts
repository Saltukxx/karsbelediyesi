import http2 from "node:http2";
import { prisma } from "@kars/db";
import { apnsTokenUret, type ApnsAnahtar } from "@/lib/domain/apns-token";

/**
 * APNs (token tabanlı) push gönderimi.
 *
 * Yapılandırma eksikse gönderim sessizce atlanır; geliştirme ortamında
 * sertifika olmadan da bildirim akışı çalışmaya devam eder. Push, panel içi
 * `Notification` kaydının yerine geçmez — onun yanında gider.
 */

const APNS_URL = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

/** Apple sağlayıcı token'ı en fazla 60 dk geçerlidir; 50 dk'da yenilenir. */
const TOKEN_OMRU_MS = 50 * 60 * 1000;
const ISTEK_ZAMAN_ASIMI_MS = 8_000;

export interface PushIcerik {
  baslik: string;
  mesaj?: string;
  /** Uygulama içi hedef (deep link) — panel `href` alanıyla aynı */
  href?: string;
  tip?: string;
}

interface ApnsAyar extends ApnsAnahtar {
  bundleId: string;
  ortam: keyof typeof APNS_URL;
}

function ayarOku(): ApnsAyar | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  // Ortam değişkeninde satır sonları \n olarak kaçırılmış olabilir
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !bundleId || !privateKey) return null;
  return {
    keyId,
    teamId,
    bundleId,
    privateKey,
    ortam: process.env.APNS_ENV === "production" ? "production" : "sandbox",
  };
}

let onbellek: { token: string; uretim: number } | null = null;

/** Apple aynı token'ın çok sık üretilmesini reddeder; süresi dolana dek saklanır. */
function saglayiciToken(ayar: ApnsAyar): string {
  const simdi = Date.now();
  if (onbellek && simdi - onbellek.uretim < TOKEN_OMRU_MS) return onbellek.token;

  const token = apnsTokenUret(ayar, simdi);
  onbellek = { token, uretim: simdi };
  return token;
}

interface ApnsSonuc {
  status: number;
  reason: string | null;
}

function istekGonder(
  oturum: http2.ClientHttp2Session,
  ayar: ApnsAyar,
  deviceToken: string,
  govde: Buffer,
  jwt: string,
): Promise<ApnsSonuc> {
  return new Promise((resolve) => {
    const stream = oturum.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": ayar.bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
      "content-length": govde.length,
    });
    stream.setTimeout(ISTEK_ZAMAN_ASIMI_MS, () => {
      stream.close(http2.constants.NGHTTP2_CANCEL);
      resolve({ status: 0, reason: "Zaman aşımı" });
    });

    let status = 0;
    let yanit = "";
    stream.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    stream.on("data", (parca: Buffer) => {
      yanit += parca.toString();
    });
    stream.on("error", (e) => resolve({ status: 0, reason: e.message }));
    stream.on("end", () => {
      let reason: string | null = null;
      if (status !== 200 && yanit) {
        try {
          reason = (JSON.parse(yanit) as { reason?: string }).reason ?? yanit;
        } catch {
          reason = yanit;
        }
      }
      resolve({ status, reason });
    });

    stream.end(govde);
  });
}

/** Apple'ın kalıcı geçersizlik yanıtları — bu token bir daha denenmez */
const OLU_TOKEN_SEBEPLERI = new Set([
  "BadDeviceToken",
  "Unregistered",
  "DeviceTokenNotForTopic",
]);

/**
 * Kullanıcıların kayıtlı cihazlarına push gönderir. Asıl işlemi bozmamak için
 * hiçbir koşulda hata fırlatmaz.
 */
export async function pushGonder(
  userIds: string[],
  icerik: PushIcerik,
  rozet?: number,
): Promise<void> {
  const ayar = ayarOku();
  if (!ayar) return;

  const alicilar = [...new Set(userIds)].filter(Boolean);
  if (alicilar.length === 0) return;

  let oturum: http2.ClientHttp2Session | null = null;
  try {
    const cihazlar = await prisma.deviceToken.findMany({
      where: { userId: { in: alicilar }, aktif: true },
      select: { token: true },
    });
    if (cihazlar.length === 0) return;

    const govde = Buffer.from(
      JSON.stringify({
        aps: {
          alert: { title: icerik.baslik, body: icerik.mesaj },
          sound: "default",
          ...(rozet != null ? { badge: rozet } : {}),
        },
        href: icerik.href,
        tip: icerik.tip,
      }),
    );

    const jwt = saglayiciToken(ayar);
    oturum = http2.connect(APNS_URL[ayar.ortam]);
    oturum.on("error", (e) => console.error("APNs bağlantı hatası:", e.message));

    const sonuclar = await Promise.all(
      cihazlar.map(async (c) => ({
        token: c.token,
        sonuc: await istekGonder(oturum as http2.ClientHttp2Session, ayar, c.token, govde, jwt),
      })),
    );

    const oluTokenlar = sonuclar
      .filter(({ sonuc }) => sonuc.reason && OLU_TOKEN_SEBEPLERI.has(sonuc.reason))
      .map(({ token }) => token);
    if (oluTokenlar.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { token: { in: oluTokenlar } },
        data: { aktif: false },
      });
    }
  } catch (e) {
    console.error("Push gönderilemedi:", { baslik: icerik.baslik, hata: e });
  } finally {
    oturum?.close();
  }
}

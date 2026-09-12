/**
 * APNs HTTP/2 gönderici. Env eksikse no-op + log.
 * Gerekli: APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID
 * Opsiyonel: APNS_TOPIC (varsayılan tr.gov.kars.panel), APNS_PRODUCTION=1
 */
import { createPrivateKey, sign as cryptoSign } from "crypto";
import { readFileSync } from "fs";
import http2 from "http2";
import { prisma } from "@kars/db";

export type ApnsPayload = {
  title: string;
  body?: string;
  href?: string;
  tip?: string;
};

type ApnsConfig = {
  keyPem: string;
  keyId: string;
  teamId: string;
  topic: string;
  production: boolean;
};

let cachedJwt: { token: string; exp: number } | null = null;
let missingLogged = false;

function getConfig(): ApnsConfig | null {
  const keyPath = process.env.APNS_KEY_PATH?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  if (!keyPath || !keyId || !teamId) return null;
  try {
    const keyPem = readFileSync(keyPath, "utf8");
    return {
      keyPem,
      keyId,
      teamId,
      topic: process.env.APNS_TOPIC?.trim() || "tr.gov.kars.panel",
      production:
        process.env.APNS_PRODUCTION === "1" ||
        process.env.APNS_PRODUCTION === "true",
    };
  } catch (e) {
    console.warn("[apns] Anahtar okunamadı:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function apnsConfigured(): boolean {
  return getConfig() !== null;
}

function b64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt(cfg: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) return cachedJwt.token;

  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: now }));
  const unsigned = `${header}.${claims}`;
  const key = createPrivateKey(cfg.keyPem);
  // Apple ES256 bekler: IEEE-P1363 (r||s), DER değil
  const sig = cryptoSign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${unsigned}.${b64url(sig)}`;
  cachedJwt = { token, exp: now + 50 * 60 };
  return token;
}

function sendHttp2(
  host: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (err) => {
      client.close();
      reject(err);
    });
    const req = client.request({
      ":method": "POST",
      ":path": path,
      ...headers,
    });
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("response", (h) => {
      status = Number(h[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      client.close();
      resolve({ status, body: data });
    });
    req.on("error", (err) => {
      client.close();
      reject(err);
    });
    req.end(body);
  });
}

async function pushOne(
  cfg: ApnsConfig,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<void> {
  const host = cfg.production
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const jwt = makeJwt(cfg);
  const body = JSON.stringify({
    aps: {
      alert: {
        title: payload.title,
        body: payload.body ?? "",
      },
      sound: "default",
      badge: 1,
    },
    tip: payload.tip,
    href: payload.href,
  });
  const res = await sendHttp2(
    host,
    `/3/device/${deviceToken}`,
    {
      authorization: `bearer ${jwt}`,
      "apns-topic": cfg.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body,
  );
  if (res.status === 410 || res.status === 400) {
    // Geçersiz / süresi dolmuş token — temizle
    try {
      await prisma.deviceToken.deleteMany({ where: { token: deviceToken } });
    } catch {
      /* ignore */
    }
  } else if (res.status !== 200) {
    console.warn("[apns] gönderim başarısız", res.status, res.body.slice(0, 200));
  }
}

/** SLA / atama gibi önemli bildirimler için cihazlara dene. Env yoksa sessiz no-op. */
export async function apnsGonder(
  userIds: string[],
  payload: ApnsPayload,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) {
    if (!missingLogged) {
      missingLogged = true;
      console.info(
        "[apns] Env eksik (APNS_KEY_PATH / APNS_KEY_ID / APNS_TEAM_ID) — push no-op; poll devam eder.",
      );
    }
    return;
  }
  const benzersiz = [...new Set(userIds)].filter(Boolean);
  if (benzersiz.length === 0) return;

  try {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: benzersiz }, platform: "ios" },
      select: { token: true },
    });
    if (tokens.length === 0) return;
    await Promise.allSettled(
      tokens.map((t) => pushOne(cfg, t.token, payload)),
    );
  } catch (e) {
    console.error("[apns] toplu gönderim hatası:", e);
  }
}

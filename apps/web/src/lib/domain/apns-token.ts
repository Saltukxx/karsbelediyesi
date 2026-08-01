import { createSign } from "node:crypto";

/**
 * APNs sağlayıcı token'ı (JWT, ES256).
 *
 * Apple ham R||S imzası bekler; Node varsayılan olarak DER üretir, bu yüzden
 * `ieee-p1363` kodlaması zorunludur. Yanlış kodlama üretimde sessiz 403
 * `InvalidProviderToken` olarak döner, bu yüzden ayrı ve test edilebilir.
 */

export interface ApnsAnahtar {
  /** Apple Developer'daki key ID (10 karakter) */
  keyId: string;
  /** Takım kimliği (10 karakter) */
  teamId: string;
  /** .p8 dosyasının PEM içeriği */
  privateKey: string;
}

export function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function apnsTokenUret(anahtar: ApnsAnahtar, simdiMs: number): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: anahtar.keyId }));
  const payload = base64url(
    JSON.stringify({ iss: anahtar.teamId, iat: Math.floor(simdiMs / 1000) }),
  );
  const imza = createSign("SHA256")
    .update(`${header}.${payload}`)
    .sign({ key: anahtar.privateKey, dsaEncoding: "ieee-p1363" });

  return `${header}.${payload}.${base64url(imza)}`;
}

import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apnsTokenUret, base64url } from "./apns-token";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function coz(parca: string): unknown {
  return JSON.parse(Buffer.from(parca, "base64url").toString());
}

describe("base64url", () => {
  it("dolgu karakterlerini atar ve URL güvenli alfabe kullanır", () => {
    const kodlu = base64url(Buffer.from([0xfb, 0xff, 0xfe]));
    expect(kodlu).not.toContain("=");
    expect(kodlu).not.toContain("+");
    expect(kodlu).not.toContain("/");
  });
});

describe("apnsTokenUret", () => {
  const anahtar = { keyId: "ABC1234567", teamId: "TEAM123456", privateKey: pem };

  it("Apple'ın beklediği başlık ve gövdeyi üretir", () => {
    const token = apnsTokenUret(anahtar, 1_770_000_000_000);
    const [header, payload] = token.split(".");

    expect(coz(header)).toEqual({ alg: "ES256", kid: "ABC1234567" });
    expect(coz(payload)).toEqual({ iss: "TEAM123456", iat: 1_770_000_000 });
  });

  it("imza DER değil ham R||S (64 bayt) biçiminde", () => {
    const imza = apnsTokenUret(anahtar, Date.now()).split(".")[2];
    expect(Buffer.from(imza, "base64url")).toHaveLength(64);
  });

  it("üretilen imza açık anahtarla doğrulanır", () => {
    const token = apnsTokenUret(anahtar, Date.now());
    const [header, payload, imza] = token.split(".");

    const gecerli = createVerify("SHA256")
      .update(`${header}.${payload}`)
      .verify(
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(imza, "base64url"),
      );
    expect(gecerli).toBe(true);
  });

  it("gövde değiştirilirse imza doğrulanmaz", () => {
    const token = apnsTokenUret(anahtar, Date.now());
    const [header, , imza] = token.split(".");
    const sahte = base64url(JSON.stringify({ iss: "BASKA", iat: 0 }));

    const gecerli = createVerify("SHA256")
      .update(`${header}.${sahte}`)
      .verify(
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(imza, "base64url"),
      );
    expect(gecerli).toBe(false);
  });
});

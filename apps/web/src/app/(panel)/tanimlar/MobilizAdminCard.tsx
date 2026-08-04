"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import type { MobilizSyncStatus } from "@/lib/mobiliz/types";

export function MobilizAdminCard({
  configured,
  status: initial,
}: {
  configured: boolean;
  status: MobilizSyncStatus;
}) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<"test" | "sync" | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function testBag() {
    setBusy("test");
    setTestMsg(null);
    try {
      const res = await fetch("/api/ops/mobiliz-sync?test=1", { method: "POST" });
      const data = (await res.json()) as {
        connected?: boolean;
        vehicleCount?: number;
        error?: string;
      };
      setTestMsg(
        data.connected
          ? `Bağlantı OK — ${data.vehicleCount ?? 0} canlı konum`
          : `Bağlantı yok: ${data.error ?? "bilinmeyen"}`,
      );
    } catch {
      setTestMsg("İstek başarısız");
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    try {
      const res = await fetch("/api/ops/mobiliz-sync", { method: "POST" });
      const data = (await res.json()) as MobilizSyncStatus;
      setStatus(data);
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`${cardCls} space-y-3 p-4 max-w-xl`}>
      <p className="text-sm text-kb-ink">
        Durum:{" "}
        <span className="font-semibold">
          {configured ? "Yapılandırıldı" : "Yapılandırılmadı"}
        </span>
        {!configured && (
          <span className="block text-xs text-kb-muted mt-1">
            Token gelince <code className="text-[11px]">MOBILIZ_TOKEN</code> ve
            isteğe bağlı <code className="text-[11px]">MOBILIZ_BASE_URL</code>{" "}
            ekleyin. Sync plaka eşlemesiyle mevcut araçlara{" "}
            <code className="text-[11px]">TAKIP_CIHAZI</code> konum yazar;
            otomatik araç yaratmaz.
          </span>
        )}
      </p>
      {status.lastSyncAt && (
        <p className="text-xs text-kb-muted">
          Son sync: {new Date(status.lastSyncAt).toLocaleString("tr-TR")}
          {status.lastSyncSuccess
            ? ` · eşleşen ${status.matched}, güncellenen ${status.updated}, atlanan ${status.skipped}`
            : ` · hata: ${status.lastSyncError ?? "?"}`}
        </p>
      )}
      {testMsg && <p className="text-xs text-kb-ink">{testMsg}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSecondary}
          disabled={busy !== null}
          onClick={() => void testBag()}
        >
          {busy === "test" ? "Test…" : "Bağlantıyı test et"}
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy !== null || !configured}
          onClick={() => void syncNow()}
        >
          {busy === "sync" ? "Sync…" : "Şimdi sync et"}
        </button>
      </div>
    </div>
  );
}

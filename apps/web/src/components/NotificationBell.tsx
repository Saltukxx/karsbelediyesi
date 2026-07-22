"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  bildirimOkunduIsaretle,
  tumBildirimleriOkunduSay,
} from "@/lib/actions/notifications";

type BildirimItem = {
  id: string;
  tip: string;
  baslik: string;
  mesaj: string | null;
  href: string | null;
  okundu: boolean;
  createdAt: string;
};

const TIP_RENK: Record<string, string> = {
  ATAMA: "bg-blue-500",
  GOREV: "bg-amber-500",
  ONAY: "bg-emerald-500",
  SLA: "bg-red-500",
  SISTEM: "bg-slate-400",
};

function zamanEtiketi(iso: string): string {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<BildirimItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const yenile = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: BildirimItem[] };
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // ağ hatasında sessiz kal, sonraki poll dener
    }
  }, []);

  // 30 sn poll; sekme gizliyken duraklat (WhatsAppQueueLive kalıbı)
  useEffect(() => {
    void yenile();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void yenile();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void yenile();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [yenile]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function bildirimeTikla(n: BildirimItem) {
    if (!n.okundu) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, okundu: true } : i)),
      );
      setUnread((u) => Math.max(0, u - 1));
      await bildirimOkunduIsaretle(n.id);
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  async function tumunuOkunduSay() {
    setItems((prev) => prev.map((i) => ({ ...i, okundu: true })));
    setUnread(0);
    await tumBildirimleriOkunduSay();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md border border-kb-border p-2 text-kb-navy hover:bg-kb-surface"
        aria-label={`Bildirimler${unread > 0 ? ` (${unread} okunmamış)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.6rem] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-kb-border bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-kb-border px-3 py-2">
            <span className="text-sm font-semibold text-kb-ink">Bildirimler</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void tumunuOkunduSay()}
                className="inline-flex items-center gap-1 text-xs text-kb-navy hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tümünü okundu say
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-kb-muted">
                Bildirim yok
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void bildirimeTikla(n)}
                  className={`flex w-full items-start gap-2 border-b border-kb-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-kb-surface ${
                    n.okundu ? "opacity-60" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      TIP_RENK[n.tip] ?? "bg-slate-400"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-kb-ink">
                      {n.baslik}
                    </span>
                    {n.mesaj && (
                      <span className="block truncate text-xs text-kb-muted">
                        {n.mesaj}
                      </span>
                    )}
                    <span className="block text-[0.65rem] text-kb-muted">
                      {zamanEtiketi(n.createdAt)}
                    </span>
                  </span>
                  {!n.okundu && (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-kb-navy" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startVisibilityPoll } from "@/lib/poll";

type Props = {
  initialCount: number;
};

export function WhatsAppQueueLive({ initialCount }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/ops/whatsapp-queue", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          pendingCount: number;
          fetchedAt: string;
        };
        setLastFetch(data.fetchedAt);
        setCount((prev) => {
          if (data.pendingCount !== prev) {
            router.refresh();
          }
          return data.pendingCount;
        });
      } catch {
        /* ignore transient errors */
      }
    }

    // ~15 sn jitter'lı poll — count'u dependency yapma (yeniden planlama döngüsü)
    return startVisibilityPoll(tick, 15_000);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-kb-muted">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-kb-navy/10 px-2.5 py-1 font-semibold text-kb-navy">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Canlı · {count} bekleyen
      </span>
      {lastFetch && (
        <span>
          Son kontrol:{" "}
          {new Date(lastFetch).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

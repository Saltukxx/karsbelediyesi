"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchHit = {
  type: string;
  label: string;
  sub?: string;
  href: string;
};

const SHORTCUTS: SearchHit[] = [
  { type: "Sayfa", label: "Dashboard", href: "/" },
  { type: "Sayfa", label: "Yeni şikayet", href: "/sikayetler/yeni" },
  { type: "Sayfa", label: "Şikayetler", href: "/sikayetler" },
  { type: "Sayfa", label: "Görevler", href: "/gorevler" },
  { type: "Sayfa", label: "Araçlar", href: "/araclar" },
  { type: "Sayfa", label: "WhatsApp", href: "/whatsapp" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: SearchHit[] };
        setHits(data.results ?? []);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [q, open]);

  const list: SearchHit[] =
    q.trim().length < 2
      ? SHORTCUTS
      : hits.length > 0
        ? hits
        : loading
          ? []
          : [{ type: "Bilgi", label: "Sonuç bulunamadı", href: "#" }];

  const go = useCallback(
    (href: string) => {
      if (!href || href === "#") return;
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] print:hidden">
      <div
        className="absolute inset-0 bg-kb-ink/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative mx-auto mt-[12vh] w-[min(100%-1.5rem,32rem)] overflow-hidden rounded-lg border border-kb-border bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-kb-border px-3">
          <Search className="h-4 w-4 shrink-0 text-kb-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(list[active]?.href ?? "#");
              }
            }}
            placeholder="Şikayet no, plaka, personel, görev…"
            className="w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-kb-muted"
          />
          <kbd className="hidden rounded border border-kb-border px-1.5 py-0.5 text-[0.65rem] text-kb-muted sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {q.trim().length < 2 && (
            <li className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-kb-muted">
              Kısayollar
            </li>
          )}
          {loading && q.trim().length >= 2 && (
            <li className="px-3 py-3 text-sm text-kb-muted">Aranıyor…</li>
          )}
          {list.map((item, i) => (
            <li key={`${item.href}-${item.label}-${i}`}>
              <button
                type="button"
                className={[
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-kb-navy/10 text-kb-navy" : "hover:bg-kb-surface",
                ].join(" ")}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
              >
                <span className="w-16 shrink-0 text-[0.65rem] font-semibold uppercase text-kb-muted">
                  {item.type}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.sub && (
                  <span className="max-w-[40%] truncate text-xs text-kb-muted">{item.sub}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type ChipOption = { id: string; label: string };

/**
 * Tek parametreli hızlı filtre şeridi. Diğer query parametrelerini (arama,
 * sıralama, sayfa boyutu) korur; seçim değişince sayfayı 1'e döndürür.
 */
export function FilterChips({
  param,
  options,
  allLabel = "Tümü",
  label,
}: {
  param: string;
  options: ChipOption[];
  allLabel?: string;
  /** Ekran okuyucular için grup adı */
  label: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get(param) ?? "";

  function href(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5 text-sm">
      {[{ id: "", label: allLabel }, ...options].map((o) => {
        const isActive = active === o.id;
        return (
          <Link
            key={o.id || "_all"}
            href={href(o.id)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-1 transition-colors ${
              isActive
                ? "bg-kb-navy font-semibold text-white"
                : "border border-kb-border bg-white text-kb-muted hover:border-kb-navy/30 hover:text-kb-ink"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

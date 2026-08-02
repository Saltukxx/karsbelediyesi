"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { SORT_PARAM, type SortDir, type SortState } from "@/lib/sort";

/**
 * Sıralanabilir tablo başlığı. Mevcut filtre/sekme parametrelerini korur,
 * sıralama değişince sayfayı 1'e döndürür.
 */
export function SortableTh({
  sortKey,
  current,
  children,
  defaultDir = "asc",
  align = "left",
}: {
  sortKey: string;
  current: SortState;
  children: ReactNode;
  /** Kolona ilk tıklandığında uygulanacak yön (tarihlerde genelde "desc") */
  defaultDir?: SortDir;
  align?: "left" | "right";
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const active = current.key === sortKey;
  const nextDir: SortDir = active
    ? current.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;

  const next = new URLSearchParams(sp.toString());
  next.set(SORT_PARAM, `${sortKey}:${nextDir}`);
  next.delete("page");

  const Icon = active ? (current.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th
      aria-sort={
        active ? (current.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={align === "right" ? "!text-right" : undefined}
    >
      <Link
        href={`${pathname}?${next.toString()}`}
        scroll={false}
        className={`group inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-kb-navy/30 ${
          active ? "text-kb-navy" : "hover:text-kb-ink"
        }`}
        title={`${nextDir === "asc" ? "Artan" : "Azalan"} sırala`}
      >
        {children}
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${
            active ? "text-kb-navy" : "text-kb-muted/40 group-hover:text-kb-muted"
          }`}
          aria-hidden="true"
        />
      </Link>
    </th>
  );
}

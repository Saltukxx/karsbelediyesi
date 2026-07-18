"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type TabItem = { id: string; label: string };

export function Tabs({
  tabs,
  param = "tab",
  defaultTab,
}: {
  tabs: TabItem[];
  param?: string;
  defaultTab: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get(param) || defaultTab;

  return (
    <div className="flex flex-wrap gap-1 border-b border-kb-border">
      {tabs.map((t) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, t.id);
        const href = `${pathname}?${next.toString()}`;
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={href}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border border-b-0 border-kb-border bg-white text-kb-navy"
                : "text-kb-muted hover:text-kb-ink"
            }`}
            scroll={false}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  param = "tab",
  defaultTab,
  children,
}: {
  id: string;
  param?: string;
  defaultTab: string;
  children: ReactNode;
}) {
  const sp = useSearchParams();
  const active = sp.get(param) || defaultTab;
  if (active !== id) return null;
  return <div className="space-y-4 pt-4">{children}</div>;
}

"use client";

import { Menu, Search } from "lucide-react";

export function TopHeader({
  userName,
  roleLabel,
  onMenuOpen,
  onSearchOpen,
}: {
  userName: string;
  roleLabel: string;
  onMenuOpen: () => void;
  onSearchOpen: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-kb-border bg-kb-surface-raised/95 px-4 py-3 backdrop-blur print:hidden lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="rounded-md border border-kb-border p-2 text-kb-navy hover:bg-kb-surface lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate text-sm font-medium text-kb-muted lg:hidden">
          Kars Belediyesi
        </p>
        <button
          type="button"
          onClick={onSearchOpen}
          className="hidden items-center gap-2 rounded-md border border-kb-border bg-white px-3 py-1.5 text-sm text-kb-muted hover:border-kb-navy/40 hover:text-kb-navy sm:inline-flex"
        >
          <Search className="h-4 w-4" />
          <span>Ara…</span>
          <kbd className="ml-2 rounded border border-kb-border px-1.5 py-0.5 text-[0.65rem]">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearchOpen}
          className="rounded-md border border-kb-border p-2 text-kb-navy hover:bg-kb-surface sm:hidden"
          aria-label="Ara"
        >
          <Search className="h-5 w-5" />
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold text-kb-ink">{userName}</div>
          <div className="text-xs text-kb-muted">{roleLabel}</div>
        </div>
      </div>
    </header>
  );
}

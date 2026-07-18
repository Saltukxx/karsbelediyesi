"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileQuickBar } from "@/components/MobileQuickBar";
import { ToastProvider } from "@/components/ToastProvider";
import type { NavItem } from "@/lib/nav";
import type { Rol } from "@kars/shared";

export function AppShell({
  items,
  favorites,
  userName,
  roleLabel,
  role,
  children,
}: {
  items: NavItem[];
  favorites: NavItem[];
  userName: string;
  roleLabel: string;
  role: Rol;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-kb-surface">
        <Sidebar
          items={items}
          favorites={favorites}
          userName={userName}
          roleLabel={roleLabel}
          open={open}
          onClose={() => setOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader
            userName={userName}
            roleLabel={roleLabel}
            onMenuOpen={() => setOpen(true)}
            onSearchOpen={() => setPaletteOpen(true)}
          />
          <main className="flex-1 overflow-x-auto px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
            <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
          </main>
        </div>
        <MobileQuickBar role={role} onSearch={() => setPaletteOpen(true)} />
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      </div>
    </ToastProvider>
  );
}

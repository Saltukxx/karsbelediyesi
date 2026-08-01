"use client";

import { Suspense, useState } from "react";
import { TopNavigation } from "@/components/TopNavigation";
import { MobileModuleMenu } from "@/components/MobileModuleMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileQuickBar } from "@/components/MobileQuickBar";
import { ToastProvider } from "@/components/ToastProvider";
import { landingPathForRole, type NavItem } from "@/lib/nav";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const homePath = landingPathForRole(role);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-kb-surface">
        <TopNavigation
          items={items}
          favorites={favorites}
          userName={userName}
          roleLabel={roleLabel}
          homePath={homePath}
          onSearchOpen={() => setPaletteOpen(true)}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
        <MobileModuleMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          items={items}
          favorites={favorites}
          userName={userName}
          roleLabel={roleLabel}
          homePath={homePath}
        />
        <MobileQuickBar role={role} onSearch={() => setPaletteOpen(true)} />
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      </div>
    </ToastProvider>
  );
}

"use client";

import Link from "next/link";
import { ClipboardList, PhoneCall, Search, Truck } from "lucide-react";
import type { Rol } from "@kars/shared";

type Quick = { href: string; label: string; icon: typeof Search; action?: "search" };

function itemsForRole(role: Rol): Quick[] {
  switch (role) {
    case "CALL_CENTER":
      return [
        { href: "/sikayetler/yeni", label: "Yeni", icon: PhoneCall },
        { href: "/sikayetler", label: "Şikayet", icon: PhoneCall },
        { href: "/whatsapp", label: "WA", icon: ClipboardList },
        { href: "#search", label: "Ara", icon: Search, action: "search" },
      ];
    case "DRIVER":
    case "FIELD_WORKER":
      return [
        { href: "/", label: "İşlerim", icon: ClipboardList },
        { href: "/gorevler", label: "Görev", icon: ClipboardList },
        { href: "/gunluk-calisma", label: "Mesai", icon: Truck },
        { href: "#search", label: "Ara", icon: Search, action: "search" },
      ];
    case "APPROVER":
      return [
        { href: "/sikayetler", label: "Şikayet", icon: PhoneCall },
        { href: "/gorevler", label: "Görev", icon: ClipboardList },
        { href: "/raporlar", label: "Rapor", icon: Truck },
        { href: "#search", label: "Ara", icon: Search, action: "search" },
      ];
    default:
      return [
        { href: "/sikayetler/yeni", label: "Yeni", icon: PhoneCall },
        { href: "/gorevler", label: "Görev", icon: ClipboardList },
        { href: "/araclar", label: "Araç", icon: Truck },
        { href: "#search", label: "Ara", icon: Search, action: "search" },
      ];
  }
}

export function MobileQuickBar({
  role,
  onSearch,
}: {
  role: Rol;
  onSearch: () => void;
}) {
  const items = itemsForRole(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-kb-border bg-kb-surface-raised/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur print:hidden lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.action === "search") {
            return (
              <li key={item.label} className="flex-1">
                <button
                  type="button"
                  onClick={onSearch}
                  className="flex w-full flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium text-kb-muted"
                >
                  <Icon className="h-5 w-5 text-kb-navy" />
                  {item.label}
                </button>
              </li>
            );
          }
          return (
            <li key={item.href + item.label} className="flex-1">
              <Link
                href={item.href}
                className="flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium text-kb-muted"
              >
                <Icon className="h-5 w-5 text-kb-navy" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

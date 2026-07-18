"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { groupedNav, type NavItem } from "@/lib/nav";
import { NAV_ICONS } from "@/lib/nav-icons";
import { cikisYap } from "@/lib/actions/auth";
import { btnGhost } from "@/lib/ui";

function NavLink({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose?: () => void;
}) {
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={[
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.875rem] transition-colors",
        active
          ? "bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_0_#c45c26]"
          : "text-white/75 hover:bg-white/8 hover:text-white",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  items,
  favorites,
  userName,
  roleLabel,
  open,
  onClose,
}: {
  items: NavItem[];
  favorites: NavItem[];
  userName: string;
  roleLabel: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const groups = groupedNav(items);

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-40 bg-kb-ink/40 transition-opacity lg:hidden print:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-kb-navy-deep text-white transition-transform duration-200 print:hidden lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <BrandMark light />
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {favorites.length > 0 && (
            <div className="mb-5">
              <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                <Star className="h-3 w-3" />
                Sık kullanılanlar
              </div>
              <ul className="space-y-0.5">
                {favorites.map((item) => (
                  <li key={`fav-${item.href}`}>
                    <NavLink item={item} pathname={pathname} onClose={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {groups.map(({ group, items: groupItems }) => (
            <div key={group.id} className="mb-5">
              <div className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {groupItems.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} pathname={pathname} onClose={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sticky bottom-0 border-t border-white/10 bg-kb-navy-deep p-4">
          <div className="truncate text-sm font-semibold text-white">{userName}</div>
          <div className="mb-3 text-xs text-white/55">{roleLabel}</div>
          <form action={cikisYap}>
            <button
              type="submit"
              className={`${btnGhost} w-full justify-start !text-white/70 hover:!bg-white/10 hover:!text-white`}
            >
              Çıkış Yap
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

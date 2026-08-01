"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";
import { NAV_ICONS } from "@/lib/nav-icons";
import {
  groupedNav,
  navGroupForPath,
  type NavGroupId,
  type NavItem,
} from "@/lib/nav";
import { cikisYap } from "@/lib/actions/auth";

export function TopNavigation({
  items,
  favorites,
  userName,
  roleLabel,
  homePath,
  onSearchOpen,
  onMobileMenuOpen,
}: {
  items: NavItem[];
  favorites: NavItem[];
  userName: string;
  roleLabel: string;
  homePath: string;
  onSearchOpen: () => void;
  onMobileMenuOpen: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => groupedNav(items), [items]);
  const activeGroup = navGroupForPath(pathname, items);
  const [openGroup, setOpenGroup] = useState<NavGroupId | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const groupButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = groups.find(({ group }) => group.id === openGroup) ?? null;
  const favoriteHrefs = useMemo(
    () => new Set(favorites.map((item) => item.href)),
    [favorites],
  );
  const selectedItems =
    selected?.items.filter((item) => !favoriteHrefs.has(item.href)) ?? [];

  useEffect(() => {
    setOpenGroup(null);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
        setUserMenuOpen(false);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setUserMenuOpen(false);
      }
    }
    function onPopState() {
      setOpenGroup(null);
      setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function onCategoryKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + direction + groups.length) % groups.length;
    groupButtonRefs.current[next]?.focus();
  }

  function openSearch() {
    setOpenGroup(null);
    setUserMenuOpen(false);
    onSearchOpen();
  }

  const initial = userName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "K";

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-50 print:hidden"
      data-testid="top-navigation"
    >
      <div className="hidden h-16 border-b border-kb-border bg-white lg:block">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-6 px-8">
          <Link
            href={homePath}
            className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
            aria-label="Ana sayfa"
          >
            <BrandMark />
          </Link>

          <button
            type="button"
            onClick={openSearch}
            className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-md border border-kb-border bg-kb-surface/60 px-3 py-2 text-left text-sm text-kb-muted transition-colors hover:border-kb-navy/40 hover:bg-white hover:text-kb-navy"
          >
            <Search className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">
              Şikayet no, plaka, personel veya görev ara…
            </span>
            <kbd className="rounded border border-kb-border bg-white px-1.5 py-0.5 text-[0.65rem]">
              ⌘K
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <div
              onClickCapture={() => {
                setOpenGroup(null);
                setUserMenuOpen(false);
              }}
            >
              <NotificationBell />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenGroup(null);
                  setUserMenuOpen((open) => !open);
                }}
                className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-kb-border hover:bg-kb-surface"
                aria-expanded={userMenuOpen}
                aria-controls="desktop-user-menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kb-navy text-sm font-semibold text-white">
                  {initial}
                </span>
                <span className="max-w-44 leading-tight">
                  <span className="block truncate text-sm font-semibold text-kb-ink">
                    {userName}
                  </span>
                  <span className="block truncate text-xs text-kb-muted">
                    {roleLabel}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-kb-muted transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  id="desktop-user-menu"
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-kb-border bg-white shadow-lg"
                >
                  <div className="border-b border-kb-border px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-kb-ink">
                      <UserRound className="h-4 w-4 text-kb-navy" />
                      {userName}
                    </div>
                    <p className="mt-1 text-xs text-kb-muted">{roleLabel}</p>
                  </div>
                  <form action={cikisYap}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-kb-muted hover:bg-kb-surface hover:text-kb-danger"
                    >
                      <LogOut className="h-4 w-4" />
                      Çıkış Yap
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav
        className="hidden h-11 bg-kb-navy-deep text-white lg:block"
        aria-label="Ana navigasyon"
      >
        <div className="mx-auto flex h-full max-w-[1400px] items-stretch px-8">
          {groups.map(({ group }, index) => {
            const open = openGroup === group.id;
            const active = activeGroup === group.id;
            return (
              <button
                key={group.id}
                ref={(node) => {
                  groupButtonRefs.current[index] = node;
                }}
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  setOpenGroup((current) =>
                    current === group.id ? null : group.id,
                  );
                }}
                onKeyDown={(event) => onCategoryKeyDown(event, index)}
                className={`relative flex items-center gap-1.5 px-5 text-sm font-semibold transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 ${
                  open ? "bg-white/12 text-white" : "text-white/75"
                }`}
                aria-expanded={open}
                aria-controls="desktop-mega-menu"
              >
                {group.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
                {active && (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 bg-kb-accent" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {selected && (
        <div
          id="desktop-mega-menu"
          className="absolute inset-x-0 hidden border-b border-kb-border bg-white shadow-[0_18px_36px_rgba(21,42,69,0.16)] lg:block"
        >
          <div className="mx-auto max-w-[1400px] px-8 py-6">
            {favorites.length > 0 && (
              <section className="border-b border-kb-border pb-5">
                <div className="mb-3 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-kb-muted">
                  <Star className="h-3.5 w-3.5 text-kb-accent" />
                  Hızlı Erişim
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {favorites.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className="group flex items-center gap-3 rounded-md border border-kb-border bg-kb-surface/45 px-3 py-2.5 hover:border-kb-navy/30 hover:bg-white"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-kb-navy/10 text-kb-navy">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-kb-ink group-hover:text-kb-navy">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section className={favorites.length > 0 ? "pt-5" : ""}>
              <div className="mb-3">
                <h2 className="font-brand text-lg font-semibold text-kb-navy">
                  {selected.group.label}
                </h2>
                <p className="text-xs text-kb-muted">
                  Bu çalışma alanındaki modüller
                </p>
              </div>
              {selectedItems.length > 0 ? (
                <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
                  {selectedItems.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className={`group flex min-h-20 gap-3 rounded-lg border p-3 transition-colors ${
                          active
                            ? "border-kb-navy/35 bg-kb-navy/5"
                            : "border-transparent hover:border-kb-border hover:bg-kb-surface"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-kb-navy/10 text-kb-navy">
                          <Icon className="h-[1.05rem] w-[1.05rem]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-kb-ink group-hover:text-kb-navy">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-kb-muted">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md bg-kb-surface px-3 py-3 text-sm text-kb-muted">
                  Bu kategorideki modüller Hızlı Erişim bölümünde yer alıyor.
                </p>
              )}
            </section>
          </div>
        </div>
      )}

      <div className="flex h-14 items-center justify-between gap-2 border-b border-kb-border bg-white px-3 lg:hidden">
        <Link
          href={homePath}
          className="min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-kb-navy/30"
          aria-label="Ana sayfa"
        >
          <BrandMark size="sm" />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onMobileMenuOpen}
            className="inline-flex items-center gap-1.5 rounded-md border border-kb-border px-2.5 py-2 text-xs font-semibold text-kb-navy hover:bg-kb-surface"
            aria-label="Modüller menüsünü aç"
          >
            <Menu className="h-4 w-4" />
            Modüller
          </button>
          <button
            type="button"
            onClick={openSearch}
            className="rounded-md border border-kb-border p-2 text-kb-navy hover:bg-kb-surface"
            aria-label="Ara"
          >
            <Search className="h-5 w-5" />
          </button>
          <div onClickCapture={() => setUserMenuOpen(false)}>
            <NotificationBell />
          </div>
        </div>
      </div>
    </header>
  );
}

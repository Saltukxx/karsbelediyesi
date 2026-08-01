"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Star, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { BrandMark } from "@/components/BrandMark";
import { NAV_ICONS } from "@/lib/nav-icons";
import {
  groupedNav,
  navGroupForPath,
  type NavGroupId,
  type NavItem,
} from "@/lib/nav";
import { cikisYap } from "@/lib/actions/auth";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function MobileModuleMenu({
  open,
  onClose,
  items,
  favorites,
  userName,
  roleLabel,
  homePath,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  favorites: NavItem[];
  userName: string;
  roleLabel: string;
  homePath: string;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => groupedNav(items), [items]);
  const activeGroup = navGroupForPath(pathname, items);
  const [expanded, setExpanded] = useState<NavGroupId | null>(activeGroup);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const favoriteHrefs = useMemo(
    () => new Set(favorites.map((item) => item.href)),
    [favorites],
  );

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setExpanded(activeGroup ?? groups[0]?.group.id ?? null);
    window.setTimeout(() => closeRef.current?.focus(), 0);

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((node) => node.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [activeGroup, groups, onClose, open]);

  useEffect(() => {
    if (open) onClose();
    // Yalnız rota değişiminde açık paneli kapat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function onAccordionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-mobile-category]",
    );
    if (!buttons?.length) return;
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-white print:hidden lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-modules-title"
      data-testid="mobile-module-menu"
    >
      <div ref={panelRef} className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-kb-border px-4">
          <Link href={homePath} onClick={onClose} aria-label="Ana sayfa">
            <BrandMark size="sm" />
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-kb-border p-2 text-kb-navy hover:bg-kb-surface"
            aria-label="Modüller menüsünü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-5">
            <h2
              id="mobile-modules-title"
              className="font-brand text-xl font-semibold text-kb-navy"
            >
              Modüller
            </h2>
            <p className="mt-1 text-sm text-kb-muted">
              Çalışma alanınızı seçin.
            </p>
          </div>

          {favorites.length > 0 && (
            <section className="mb-6">
              <div className="mb-2 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-kb-muted">
                <Star className="h-3.5 w-3.5 text-kb-accent" />
                Hızlı Erişim
              </div>
              <div className="grid grid-cols-2 gap-2">
                {favorites.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex min-h-20 flex-col justify-between rounded-lg border border-kb-border bg-kb-surface/55 p-3 hover:border-kb-navy/30 hover:bg-white"
                    >
                      <Icon className="h-5 w-5 text-kb-navy" />
                      <span className="mt-2 text-sm font-semibold leading-tight text-kb-ink">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <div className="space-y-2">
            {groups.map(({ group, items: groupItems }, index) => {
              const isOpen = expanded === group.id;
              const categoryItems = groupItems.filter(
                (item) => !favoriteHrefs.has(item.href),
              );
              return (
                <section
                  key={group.id}
                  className="overflow-hidden rounded-lg border border-kb-border"
                >
                  <button
                    type="button"
                    data-mobile-category
                    onClick={() =>
                      setExpanded((current) =>
                        current === group.id ? null : group.id,
                      )
                    }
                    onKeyDown={(event) => onAccordionKeyDown(event, index)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold ${
                      activeGroup === group.id
                        ? "bg-kb-navy/8 text-kb-navy"
                        : "bg-white text-kb-ink"
                    }`}
                    aria-expanded={isOpen}
                    aria-controls={`mobile-category-${group.id}`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-4 w-4 text-kb-muted transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div
                      id={`mobile-category-${group.id}`}
                      className="border-t border-kb-border bg-kb-surface/45 p-2"
                    >
                      {categoryItems.length > 0 ? (
                        <div className="space-y-1">
                          {categoryItems.map((item) => {
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
                                onClick={onClose}
                                aria-current={active ? "page" : undefined}
                                className={`flex gap-3 rounded-md px-3 py-3 ${
                                  active
                                    ? "bg-white text-kb-navy shadow-sm"
                                    : "text-kb-ink hover:bg-white"
                                }`}
                              >
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-kb-navy" />
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold">
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
                        <p className="px-3 py-2 text-xs text-kb-muted">
                          Bu kategorideki modüller Hızlı Erişim bölümünde.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-kb-border bg-kb-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2">
            <div className="truncate text-sm font-semibold text-kb-ink">
              {userName}
            </div>
            <div className="text-xs text-kb-muted">{roleLabel}</div>
          </div>
          <form action={cikisYap}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-kb-border bg-white px-4 py-2 text-sm font-semibold text-kb-danger hover:bg-kb-danger-bg"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

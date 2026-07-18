import type { ReactNode } from "react";

/** Hover'da görünen satır aksiyonları */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
      {children}
    </div>
  );
}

export function RowActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="rounded border border-kb-border bg-white px-2 py-1 text-xs font-semibold text-kb-navy hover:bg-kb-surface"
    >
      {children}
    </a>
  );
}

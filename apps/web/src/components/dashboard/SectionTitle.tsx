import type { ReactNode } from "react";

/**
 * Bölüm başlığı. Büyük harfli mikro etiket yerine serif ve okunur boyutta;
 * açıklama başlığın yanında soluk kalır.
 */
export function SectionTitle({
  children,
  description,
  action,
}: {
  children: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
        {children}
        {description && (
          <span className="ml-2.5 font-sans text-[0.8rem] font-normal text-kb-muted">
            {description}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

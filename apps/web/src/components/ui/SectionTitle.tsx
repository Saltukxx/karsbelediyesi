import type { ReactNode } from "react";
import { sectionTitleCls } from "@/lib/ui";

/**
 * Bölüm başlığı: serif, okunur boyutta, açıklama yanında soluk kalır.
 * Sağda isteğe bağlı bir aksiyon (bağlantı, buton) taşıyabilir.
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
      <h2 className={sectionTitleCls}>
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

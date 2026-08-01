import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * Boş durum.
 *
 * `compact` varyantı tek satırlık ve sola hizalıdır; grafik kartları gibi
 * yüksekliği rezerve etmenin ölü alan yarattığı yerlerde kullanılır.
 */
export function EmptyState({
  title = "Kayıt bulunamadı",
  description,
  action,
  compact = false,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  icon?: typeof Inbox;
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 py-5 text-sm text-kb-muted">
        <Icon className="h-4 w-4 shrink-0 opacity-60" />
        <span>{title}</span>
        {action}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-kb-surface text-kb-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-brand font-semibold text-kb-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-kb-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

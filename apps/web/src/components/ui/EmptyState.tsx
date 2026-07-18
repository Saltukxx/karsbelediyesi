import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Kayıt bulunamadı",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-kb-surface text-kb-muted">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="font-semibold text-kb-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-kb-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

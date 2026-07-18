import type { ReactNode } from "react";
import { cardCls } from "@/lib/ui";
import { EmptyState } from "./EmptyState";

export function DataTable({
  children,
  minWidth = "800px",
  empty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  framed = true,
}: {
  children: ReactNode;
  minWidth?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** false when already inside a Card */
  framed?: boolean;
}) {
  if (empty) {
    return (
      <div className={framed ? cardCls : ""}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={`${framed ? `${cardCls} overflow-hidden` : "overflow-hidden"}`}>
      <div className="overflow-x-auto">
        <table className="kb-table" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}

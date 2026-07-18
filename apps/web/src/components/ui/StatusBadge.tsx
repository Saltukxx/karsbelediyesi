import { Badge, statusBadgeVariant } from "./Badge";

export function StatusBadge({ label }: { label: string }) {
  return <Badge variant={statusBadgeVariant(label)}>{label}</Badge>;
}

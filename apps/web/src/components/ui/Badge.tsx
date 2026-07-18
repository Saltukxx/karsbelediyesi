import type { ReactNode } from "react";

const variants = {
  default: "bg-kb-surface text-kb-muted border-kb-border",
  navy: "bg-kb-navy/10 text-kb-navy border-kb-navy/20",
  success: "bg-kb-success-bg text-kb-success border-kb-success/20",
  warning: "bg-kb-warning-bg text-kb-warning border-kb-warning/25",
  danger: "bg-kb-danger-bg text-kb-danger border-kb-danger/20",
  info: "bg-kb-info-bg text-kb-info border-kb-info/20",
} as const;

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

/** Map common Turkish status strings to badge variants */
export function statusBadgeVariant(
  status: string,
): keyof typeof variants {
  const s = status.toLocaleUpperCase("tr-TR");
  if (
    s.includes("KRİTİK") ||
    s.includes("KRITIK") ||
    s.includes("YÜKSEK") ||
    s.includes("YUKSEK") ||
    s.includes("ARIZALI") ||
    s.includes("İPTAL") ||
    s.includes("IPTAL")
  ) {
    return "danger";
  }
  if (
    s.includes("DİKKAT") ||
    s.includes("DIKKAT") ||
    s.includes("AZ") ||
    s.includes("DÜŞÜK") ||
    s.includes("DUSUK") ||
    s.includes("ACİL") ||
    s.includes("ACIL") ||
    s.includes("BAKIM") ||
    s.includes("DEVAM") ||
    s.includes("PLAN")
  ) {
    return "warning";
  }
  if (
    s.includes("NORMAL") ||
    s.includes("YETERLİ") ||
    s.includes("YETERLI") ||
    s.includes("AKTİF") ||
    s.includes("AKTIF") ||
    s.includes("TAMAM") ||
    s.includes("KAPAT") ||
    s.includes("MÜSAİT") ||
    s.includes("MUSAIT")
  ) {
    return "success";
  }
  if (s.includes("AÇIK") || s.includes("ACIK")) return "info";
  return "default";
}

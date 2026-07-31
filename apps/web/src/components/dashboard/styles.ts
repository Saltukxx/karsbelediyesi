/**
 * Dashboard'a özel görsel dil.
 *
 * Panel genelindeki `lib/ui.ts` sabitleri değişmeden kalır; burası yalnız
 * dashboard kartlarının kurumsal görünümünü tanımlar.
 */

export type Tone = "navy" | "success" | "warning" | "danger" | "info" | "neutral";

export const dashCardCls =
  "rounded-lg border border-kb-border bg-kb-surface-raised shadow-[0_1px_2px_rgba(21,42,69,0.05)]";

/** Tıklanabilir kartlar için hover geri bildirimi */
export const dashCardInteractiveCls = `${dashCardCls} transition-colors hover:border-kb-navy/30`;

/** Tonlu rozet / ikon çipi — arka plan + metin rengi birlikte */
export const toneChipCls: Record<Tone, string> = {
  navy: "bg-kb-navy/10 text-kb-navy",
  success: "bg-kb-success-bg text-kb-success",
  warning: "bg-kb-warning-bg text-kb-warning",
  danger: "bg-kb-danger-bg text-kb-danger",
  info: "bg-kb-info-bg text-kb-info",
  neutral: "bg-kb-surface text-kb-muted",
};

export const toneTextCls: Record<Tone, string> = {
  navy: "text-kb-navy",
  success: "text-kb-success",
  warning: "text-kb-warning",
  danger: "text-kb-danger",
  info: "text-kb-info",
  neutral: "text-kb-ink",
};

/** Büyük sayılar serif; panelin kurumsal kimliğini taşır. */
export const numeralCls = "font-brand tabular-nums";

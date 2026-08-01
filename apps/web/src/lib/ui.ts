export const inputCls =
  "w-full rounded-md border border-kb-border bg-white px-3 py-2 text-sm text-kb-ink transition-colors placeholder:text-kb-muted/70 focus:outline-none focus:ring-2 focus:ring-kb-navy/30 focus:border-kb-navy";

export const labelCls =
  "block text-[0.8rem] font-medium text-kb-muted mb-1.5";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize = "sm" | "md";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const btnSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm font-medium",
  md: "px-4 py-2 text-sm font-semibold",
};

const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-kb-navy text-white hover:bg-kb-navy-soft",
  secondary: "border border-kb-border bg-white text-kb-ink hover:bg-kb-surface",
  ghost: "text-kb-muted hover:text-kb-ink hover:bg-kb-surface",
  danger: "bg-kb-danger text-white hover:bg-kb-danger/90",
  success: "bg-kb-success text-white hover:bg-kb-success/90",
};

/** Varsayılan boy: primary orta, diğerleri küçük (mevcut btn* sabitleriyle aynı). */
const defaultSize: Record<ButtonVariant, ButtonSize> = {
  primary: "md",
  secondary: "sm",
  ghost: "sm",
  danger: "md",
  success: "md",
};

/** `<Link>` gibi buton olmayan elemanlara buton görünümü vermek için. */
export function buttonCls(
  variant: ButtonVariant = "primary",
  size: ButtonSize = defaultSize[variant],
): string {
  return `${btnBase} ${btnSizes[size]} ${btnVariants[variant]}`;
}

export const btnPrimary = buttonCls("primary");
export const btnSecondary = buttonCls("secondary");
export const btnGhost = buttonCls("ghost");
export const btnDanger = buttonCls("danger");
export const btnSuccess = buttonCls("success");

export const cardCls =
  "rounded-lg border border-kb-border bg-kb-surface-raised shadow-[0_1px_2px_rgba(21,42,69,0.05)]";

/** Tıklanabilir kartlar için hover geri bildirimi */
export const cardInteractiveCls = `${cardCls} transition-colors hover:border-kb-navy/30`;

/** Tek kolon form kartları */
export const formCardCls = `${cardCls} max-w-3xl p-4`;

/**
 * Bölüm başlığı. Büyük harfli mikro etiket yerine serif ve okunur boyutta;
 * panelin kurumsal kimliğini taşıyan Source Serif 4 burada devreye girer.
 */
export const sectionTitleCls =
  "font-brand text-[0.95rem] font-semibold text-kb-ink";

/** Anlam taşıyan renk tonları — rozet, çip ve ikon arka planları için. */
export type Tone =
  | "navy"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

/** Tonlu çip: arka plan + metin rengi birlikte */
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

/** Büyük sayılar serif ve tabular; kartlarda hizalı bir ritim verir. */
export const numeralCls = "font-brand tabular-nums";

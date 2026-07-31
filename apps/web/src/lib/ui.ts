export const inputCls =
  "w-full rounded-md border border-kb-border bg-white px-3 py-2 text-sm text-kb-ink placeholder:text-kb-muted/70 focus:outline-none focus:ring-2 focus:ring-kb-navy/30 focus:border-kb-navy";

export const labelCls =
  "block text-xs font-semibold uppercase tracking-wide text-kb-muted mb-1.5";

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
  "rounded-lg border border-kb-border bg-kb-surface-raised shadow-sm";

/** Tek kolon form kartları */
export const formCardCls = `${cardCls} max-w-3xl p-4`;

export const sectionTitleCls =
  "text-xs font-semibold uppercase tracking-wider text-kb-muted";

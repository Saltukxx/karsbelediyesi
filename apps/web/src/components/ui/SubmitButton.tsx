"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonCls, type ButtonSize, type ButtonVariant } from "@/lib/ui";

type SubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  /** Gönderim sürerken gösterilecek metin */
  pendingLabel?: string;
};

/**
 * Server action ile çalışan formlarda gönderim süresince kendini kilitler.
 * useFormStatus yalnız `<form>` içindeki bir alt bileşende çalıştığı için
 * ayrı dosyada tutulur.
 */
export function SubmitButton({
  variant = "primary",
  size,
  className = "",
  children,
  pendingLabel = "Kaydediliyor…",
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`${buttonCls(variant, size)} ${className}`}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

import type { ButtonHTMLAttributes } from "react";
import { buttonCls, type ButtonSize, type ButtonVariant } from "@/lib/ui";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonCls(variant, size)} ${className}`}
      {...rest}
    />
  );
}

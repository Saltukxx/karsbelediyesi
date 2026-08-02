"use client";

import { useId, type ReactNode } from "react";
import { inputCls, labelCls } from "@/lib/ui";
import { useFieldState } from "./ActionForm";

export type Option = { value: string; label: string };

function tekDeger(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function cokluDeger(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

function Sarmal({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-kb-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-kb-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-kb-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const hataCls = "border-kb-danger focus:border-kb-danger focus:ring-kb-danger/25";

/** Metin/telefon/sayı girdisi — hata sonrası değerini korur. */
export function FormInput({
  name,
  label,
  type = "text",
  required,
  hint,
  placeholder,
  defaultValue,
  className,
  ...rest
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  step?: string;
}) {
  const id = useId();
  const { error, value } = useFieldState(name);

  return (
    <Sarmal
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={tekDeger(value) ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? hataCls : ""}`}
        {...rest}
      />
    </Sarmal>
  );
}

export function FormTextarea({
  name,
  label,
  rows = 3,
  required,
  hint,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  rows?: number;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  className?: string;
}) {
  const id = useId();
  const { error, value } = useFieldState(name);

  return (
    <Sarmal
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={tekDeger(value) ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? hataCls : ""}`}
      />
    </Sarmal>
  );
}

export function FormSelect({
  name,
  label,
  options,
  placeholder,
  required,
  hint,
  defaultValue,
  multiple,
  size,
  className,
}: {
  name: string;
  label: string;
  options: Option[];
  /** Boş değerli ilk seçenek (tek seçimde) */
  placeholder?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string | string[];
  multiple?: boolean;
  size?: number;
  className?: string;
}) {
  const id = useId();
  const { error, value } = useFieldState(name);

  const secili = multiple
    ? (cokluDeger(value) ?? (defaultValue as string[] | undefined) ?? [])
    : (tekDeger(value) ?? (defaultValue as string | undefined) ?? "");

  return (
    <Sarmal
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <select
        id={id}
        name={name}
        required={required}
        multiple={multiple}
        size={size}
        defaultValue={secili}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? hataCls : ""}`}
      >
        {!multiple && placeholder !== undefined && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Sarmal>
  );
}

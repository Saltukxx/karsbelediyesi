"use client";

type ConfirmSubmitProps = {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  message: string;
  children: string;
  className?: string;
  name?: string;
};

export function ConfirmSubmit({
  action,
  id,
  message,
  children,
  className = "text-xs text-red-600 hover:underline",
  name = "id",
}: ConfirmSubmitProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name={name} value={id} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

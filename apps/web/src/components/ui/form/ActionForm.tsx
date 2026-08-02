"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { AlertCircle } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { useToast } from "@/components/ToastProvider";

export type ActionFn = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type FormCtx = {
  state: ActionState;
  pending: boolean;
};

const Ctx = createContext<FormCtx>({ state: null, pending: false });

export function useActionFormState(): FormCtx {
  return useContext(Ctx);
}

/** Bir alanın hata mesajı ve hatadan sonra geri gelen değeri. */
export function useFieldState(name: string) {
  const { state } = useContext(Ctx);
  return {
    error: state?.fieldErrors?.[name],
    value: state?.values?.[name],
  };
}

/**
 * Server action'ı `useActionState` ile çalıştırır: hata durumunda sayfa
 * çökmez, girilen değerler formda kalır ve mesaj alan altında/başında gösterilir.
 * Başarılı sonuç toast olarak duyurulur.
 */
export function ActionForm({
  action,
  children,
  className = "",
  hideAlert = false,
}: {
  action: ActionFn;
  children: ReactNode;
  className?: string;
  /** Uyarı bloğunu kendin yerleştireceksen kapat */
  hideAlert?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null,
  );
  const { push } = useToast();
  const sonBildirilen = useRef<ActionState>(null);

  useEffect(() => {
    if (!state || state === sonBildirilen.current) return;
    sonBildirilen.current = state;
    if (state.ok && state.message) push(state.message, "success");
  }, [state, push]);

  return (
    <Ctx.Provider value={{ state, pending }}>
      {!hideAlert && <FormAlert />}
      <form action={formAction} className={className}>
        {children}
      </form>
    </Ctx.Provider>
  );
}

/** Form geneli hata mesajı — ekran okuyucuya da duyurulur. */
export function FormAlert() {
  const { state } = useActionFormState();
  if (!state || state.ok || !state.message) return null;

  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-2 rounded-md border border-kb-danger/30 bg-kb-danger-bg px-3 py-2.5 text-sm text-kb-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{state.message}</span>
    </div>
  );
}

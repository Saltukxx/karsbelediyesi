"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

function QueryToastBridge({ push }: { push: ToastContextValue["push"] }) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const ok = sp.get("ok");
    const err = sp.get("hata");
    if (!ok && !err) return;
    if (ok) push(ok === "1" ? "İşlem başarılı" : ok, "success");
    if (err) push(err, "error");
    const next = new URLSearchParams(sp.toString());
    next.delete("ok");
    next.delete("hata");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [sp, pathname, router, push]);

  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<{ message?: string; tone?: ToastTone }>).detail;
      if (detail?.message) push(detail.message, detail.tone ?? "info");
    }
    window.addEventListener("kb:toast", onToast);
    return () => window.removeEventListener("kb:toast", onToast);
  }, [push]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      <Suspense fallback={null}>
        <QueryToastBridge push={push} />
      </Suspense>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-[min(100%,20rem)] flex-col gap-2 print:hidden lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-lg",
              t.tone === "success" && "border-kb-success/30 bg-kb-success-bg text-kb-success",
              t.tone === "error" && "border-kb-danger/30 bg-kb-danger-bg text-kb-danger",
              t.tone === "info" && "border-kb-border bg-white text-kb-ink",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              className="shrink-0 opacity-60 hover:opacity-100"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

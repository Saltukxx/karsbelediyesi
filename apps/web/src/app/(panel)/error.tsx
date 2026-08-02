"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { buttonCls, cardCls } from "@/lib/ui";

/**
 * Panel içi hata sınırı. Üst menü ve oturum korunur; kullanıcı sayfayı
 * yeniden deneyebilir veya panele dönebilir.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center py-10">
      <div className={`${cardCls} max-w-lg p-8 text-center`}>
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-kb-danger-bg text-kb-danger">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-brand text-xl font-semibold text-kb-navy">
          Bu sayfa yüklenemedi
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-kb-muted">
          Hata kaydedildi. Yeniden deneyebilir ya da panele dönebilirsiniz.
          Sorun sürerse sistem yöneticinize bu kodu iletin.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-kb-muted">
            Hata kodu: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={reset} className={buttonCls("primary")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tekrar dene
          </button>
          <Link href="/" className={buttonCls("secondary", "md")}>
            Panele dön
          </Link>
        </div>
      </div>
    </div>
  );
}

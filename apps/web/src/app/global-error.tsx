"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html lang="tr">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f6f8",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 32,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, color: "#1e3a5f", marginBottom: 8 }}>
            Beklenmeyen bir hata oluştu
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            Hata kaydedildi. Sorun devam ederse sistem yöneticinize başvurun.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#1e3a5f",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}

import * as Sentry from "@sentry/nextjs";

// İstemci tarafı Sentry — NEXT_PUBLIC_SENTRY_DSN tanımlı değilse devre dışı
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

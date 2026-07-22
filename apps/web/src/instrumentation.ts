import * as Sentry from "@sentry/nextjs";

/**
 * Sunucu tarafı Sentry başlatma. SENTRY_DSN tanımlı değilse tamamen devre
 * dışı kalır (yerel geliştirmede gürültü olmaz).
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@kars/shared", "@kars/db"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "exceljs"],
};

// Sentry sarmalayıcı — DSN tanımlı değilse çalışma zamanında devre dışıdır;
// source map yükleme yalnız SENTRY_AUTH_TOKEN varsa yapılır.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});

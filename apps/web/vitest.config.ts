import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Birim testleri yalnız src altında aranır. e2e/ altındaki Playwright
 * dosyaları `npm run test:e2e` ile çalışır; vitest onları toplamaya
 * çalışırsa Playwright test.describe() hatası verir.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});

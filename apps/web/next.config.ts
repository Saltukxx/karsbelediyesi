import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@kars/shared", "@kars/db"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "exceljs"],
};

export default nextConfig;

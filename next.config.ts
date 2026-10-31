import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // O cliente do SQLite/libSQL usa um módulo nativo: não deve ser empacotado pelo bundler
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

import type { NextConfig } from "next";

const emDesenvolvimento = process.env.NODE_ENV === "development";

// Política de segurança de conteúdo: a página só carrega scripts, estilos, imagens e conexões do
// próprio site, não pode ser embutida em outro site e formulários só enviam para o próprio site.
// (Sem nonce porque o app usa pré-renderização parcial, que é incompatível com nonces.)
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(emDesenvolvimento ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const cabecalhosDeSeguranca = [
  { key: "Content-Security-Policy", value: csp },
  // força HTTPS por 2 anos (só tem efeito quando o site já é servido em HTTPS)
  ...(emDesenvolvimento ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // painel privado: não deve aparecer no Google
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // O cliente do SQLite/libSQL usa um módulo nativo: não deve ser empacotado pelo bundler
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;

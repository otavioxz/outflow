import type { MetadataRoute } from "next";

// Painel privado: pede para nenhum buscador indexar
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

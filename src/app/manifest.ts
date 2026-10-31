import type { MetadataRoute } from "next";

// Manifesto do app: permite instalar o Outflow no celular (PWA) e gerar o APK pelo PWABuilder.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Outflow · Controle de Gastos",
    short_name: "Outflow",
    description: "Seus gastos do WhatsApp, num lugar só.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e0c",
    theme_color: "#0a0e0c",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

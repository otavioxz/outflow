"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavigatorExtra = Navigator & {
  deviceMemory?: number;
  connection?: { effectiveType?: string };
};

/**
 * A cada página aberta, manda para /api/visita os dados do dispositivo que o navegador informa
 * sem pedir permissão. Roda em segundo plano e nunca afeta o uso do site se falhar.
 */
export function RegistroVisita() {
  const caminho = usePathname();
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (ultimo.current === caminho) return; // evita duplicar (ex.: efeito rodando 2x no dev)
    ultimo.current = caminho;
    try {
      const nav = navigator as NavigatorExtra;
      const dados = {
        caminho: location.pathname + location.search,
        referrer: document.referrer || null,
        idiomas: navigator.languages?.join(", ") || navigator.language || null,
        fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
        plataforma: navigator.platform || null,
        tela: `${screen.width}x${screen.height}`,
        janela: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio || null,
        nucleos: navigator.hardwareConcurrency || null,
        memoriaGb: nav.deviceMemory ?? null,
        conexao: nav.connection?.effectiveType ?? null,
        toque: navigator.maxTouchPoints > 0,
        tema: matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro",
      };
      fetch("/api/visita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // silencioso: o log nunca deve atrapalhar o site
    }
  }, [caminho]);

  return null;
}

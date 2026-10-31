"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 3000;

/**
 * Mantém o dashboard em tempo real: consulta /api/versao periodicamente e,
 * quando os dados mudam, re-renderiza a página no servidor sem recarregar (router.refresh).
 * Pausa enquanto a aba está em segundo plano e checa na hora quando você volta.
 */
export function AoVivo() {
  const router = useRouter();
  const versao = useRef<string | null>(null);
  const [estado, setEstado] = useState<"ok" | "offline" | "atualizado">("ok");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ativo = true;

    async function checar() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const resp = await fetch("/api/versao", { cache: "no-store" });
          if (resp.status === 401) {
            router.refresh(); // sessão expirou: o servidor manda para o login
            return;
          }
          const { versao: nova } = (await resp.json()) as { versao: string };
          if (versao.current !== null && nova !== versao.current) {
            router.refresh();
            setEstado("atualizado");
            setTimeout(() => setEstado("ok"), 2500);
          } else {
            setEstado((e) => (e === "offline" ? "ok" : e));
          }
          versao.current = nova;
        } catch {
          setEstado("offline");
        }
      }
      if (ativo) timer = setTimeout(checar, INTERVALO_MS);
    }

    const aoVoltar = () => document.visibilityState === "visible" && checar();
    document.addEventListener("visibilitychange", aoVoltar);
    checar();

    return () => {
      ativo = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router]);

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        estado === "offline" ? "text-muted-foreground" : estado === "atualizado" ? "text-success" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          estado === "offline" ? "bg-muted-foreground" : "bg-success motion-safe:animate-pulse",
        )}
      />
      {estado === "offline" ? "Sem conexão" : estado === "atualizado" ? "Atualizado agora" : "Ao vivo"}
    </span>
  );
}

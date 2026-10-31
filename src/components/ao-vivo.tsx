"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Atividade } from "@/lib/atividades";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 2000;

/** Mostra (ou atualiza) o aviso de uma mensagem do WhatsApp. O mesmo id faz o aviso mudar no lugar. */
function avisar(a: Atividade) {
  const opcoes = { id: `atividade-${a.id}`, description: a.detalhe ?? undefined };
  if (a.status === "processando") return toast.loading(a.titulo, { ...opcoes, duration: 30_000 });
  const duracao = { duration: 7000 };
  if (a.status === "gasto") return toast.success(a.titulo, { ...opcoes, ...duracao });
  if (a.status === "comando") return toast.info(a.titulo, { ...opcoes, ...duracao });
  if (a.status === "sem_gasto") return toast.warning(a.titulo, { ...opcoes, ...duracao });
  return toast.error(a.titulo, { ...opcoes, ...duracao });
}

/**
 * Mantém o dashboard em tempo real: consulta /api/versao periodicamente e,
 * quando os dados mudam, re-renderiza a página no servidor sem recarregar (router.refresh).
 * Pausa enquanto a aba está em segundo plano e checa na hora quando você volta.
 */
export function AoVivo() {
  const router = useRouter();
  const versao = useRef<string | null>(null);
  const vistas = useRef<Map<number, string> | null>(null); // id da atividade -> último status mostrado
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
          const { versao: nova, atividades = [] } = (await resp.json()) as { versao: string; atividades?: Atividade[] };

          // Avisos das mensagens do WhatsApp. Na primeira consulta, as já concluídas não são mostradas
          // (são de antes de abrir a página); só as que ainda estão processando.
          const primeiraVez = vistas.current === null;
          vistas.current ??= new Map();
          for (const a of [...atividades].reverse()) {
            if (vistas.current.get(a.id) === a.status) continue;
            vistas.current.set(a.id, a.status);
            if (!primeiraVez || a.status === "processando") avisar(a);
          }
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

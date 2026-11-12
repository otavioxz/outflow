"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { removerInscricaoPushAction, salvarInscricaoPushAction, testarPushAction } from "@/app/configuracoes/actions";
import { Button } from "@/components/ui/button";

// Notificações push do navegador (e do app Android, que é o site dentro do Chrome).
// O service worker (public/sw.js) é quem mostra a notificação quando ela chega.

type Situacao = "carregando" | "sem_suporte" | "bloqueada" | "desativada" | "ativada";

const temSuporte = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const registrar = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const limpa = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(limpa);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/**
 * Sem interface: em cada página logada, se este aparelho já tem notificações ativas, reenvia a inscrição
 * ao servidor. Assim ela fica presa à sessão atual depois de um novo login e acompanha trocas feitas pelo navegador.
 */
export function SincronizarPush() {
  useEffect(() => {
    if (!temSuporte() || Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem("push-sincronizado")) return;
    } catch {}
    registrar()
      .then((r) => r.pushManager.getSubscription())
      .then(async (inscricao) => {
        if (!inscricao) return;
        const r = await salvarInscricaoPushAction(inscricao.toJSON());
        if (!r.erro) {
          try {
            sessionStorage.setItem("push-sincronizado", "1");
          } catch {}
        }
      })
      .catch(() => {});
  }, []);
  return null;
}

/** Card de Configurações: ativar, testar e desativar as notificações deste aparelho. */
export function FormNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [ocupado, iniciar] = useTransition();

  useEffect(() => {
    if (!temSuporte()) return setSituacao("sem_suporte");
    if (Notification.permission === "denied") return setSituacao("bloqueada");
    registrar()
      .then((r) => r.pushManager.getSubscription())
      .then((inscricao) => setSituacao(inscricao && Notification.permission === "granted" ? "ativada" : "desativada"))
      .catch(() => setSituacao("sem_suporte"));
  }, []);

  const ativar = () =>
    iniciar(async () => {
      // o pedido de permissão precisa vir de um toque do usuário
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setSituacao(permissao === "denied" ? "bloqueada" : "desativada");
        return;
      }
      try {
        const registro = await registrar();
        await navigator.serviceWorker.ready;
        const inscricao =
          (await registro.pushManager.getSubscription()) ??
          (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) }));
        const r = await salvarInscricaoPushAction(inscricao.toJSON());
        if (r.erro) return void toast.error(r.erro);
        setSituacao("ativada");
        toast.success("Notificações ativadas neste aparelho.");
      } catch {
        toast.error("Não consegui ativar as notificações neste navegador.");
      }
    });

  const desativar = () =>
    iniciar(async () => {
      const inscricao = await (await registrar()).pushManager.getSubscription();
      if (inscricao) {
        await removerInscricaoPushAction(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setSituacao("desativada");
      toast.success("Notificações desativadas neste aparelho.");
    });

  const testar = () =>
    iniciar(async () => {
      const r = await testarPushAction();
      if (r.erro) toast.error(r.erro);
    });

  if (situacao === "carregando") return <p className="text-sm text-muted-foreground">Verificando este aparelho…</p>;

  if (situacao === "sem_suporte")
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não recebe notificações. No iPhone, adicione o Outflow à tela de início (Compartilhar → Adicionar à
        Tela de Início) e ative por lá.
      </p>
    );

  if (situacao === "bloqueada")
    return (
      <p className="text-sm text-muted-foreground">
        As notificações estão bloqueadas para o Outflow. Libere nas configurações do navegador ou do app (Notificações →
        Permitir) e volte aqui.
      </p>
    );

  if (situacao === "desativada")
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Desativadas neste aparelho.</p>
        <Button onClick={ativar} disabled={ocupado}>
          <BellRing />
          Ativar notificações
        </Button>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-success">Ativadas neste aparelho.</span> Você é avisado quando um gasto mandado pelo
        WhatsApp é registrado.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={testar} disabled={ocupado}>
          Enviar teste
        </Button>
        <Button variant="ghost" onClick={desativar} disabled={ocupado} className="text-muted-foreground">
          <BellOff />
          Desativar
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { alterarSenha, encerrarOutrasSessoesAction, salvarMetaGuardado, salvarOrcamento, type Estado } from "./actions";

/** Mostra o resultado da ação: erro embaixo do formulário, sucesso como aviso no canto. */
function useAvisos(estado: Estado) {
  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
  }, [estado]);
}

function Erro({ estado }: { estado: Estado }) {
  return estado.erro ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {estado.erro}
    </p>
  ) : null;
}

function BotaoEnviar({ enviando, children, ...props }: React.ComponentProps<typeof Button> & { enviando: boolean }) {
  return (
    <Button type="submit" disabled={enviando} {...props}>
      {enviando && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function FormOrcamento({ valorAtual }: { valorAtual: string }) {
  return (
    <FormValorMensal
      acaoServidor={salvarOrcamento}
      nome="orcamento"
      placeholder="3.000,00"
      valorAtual={valorAtual}
      rotuloSalvar="Salvar orçamento"
      rotuloRemover="Remover orçamento"
    />
  );
}

export function FormMetaGuardado({ valorAtual }: { valorAtual: string }) {
  return (
    <FormValorMensal
      acaoServidor={salvarMetaGuardado}
      nome="meta"
      placeholder="500,00"
      valorAtual={valorAtual}
      rotuloSalvar="Salvar meta"
      rotuloRemover="Remover meta"
    />
  );
}

/** Campo "R$ por mês" com salvar e remover (remover = enviar o campo vazio). */
function FormValorMensal({
  acaoServidor,
  nome,
  placeholder,
  valorAtual,
  rotuloSalvar,
  rotuloRemover,
}: {
  acaoServidor: (estado: Estado, formData: FormData) => Promise<Estado>;
  nome: string;
  placeholder: string;
  valorAtual: string;
  rotuloSalvar: string;
  rotuloRemover: string;
}) {
  const [estado, acao, enviando] = useActionState(acaoServidor, {});
  const campo = useRef<HTMLInputElement>(null);
  useAvisos(estado);

  return (
    <form action={acao} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={nome}>Valor por mês</Label>
        <div className="relative max-w-56">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            ref={campo}
            id={nome}
            name={nome}
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            defaultValue={valorAtual}
            className="pl-9 tabular-nums"
            aria-invalid={Boolean(estado.erro)}
          />
        </div>
      </div>
      <Erro estado={estado} />
      <div className="flex flex-wrap gap-2">
        <BotaoEnviar enviando={enviando}>{rotuloSalvar}</BotaoEnviar>
        {valorAtual && (
          <Button
            type="submit"
            variant="ghost"
            disabled={enviando}
            onClick={() => {
              if (campo.current) campo.current.value = "";
            }}
          >
            {rotuloRemover}
          </Button>
        )}
      </div>
    </form>
  );
}

export function FormSenha() {
  const [estado, acao, enviando] = useActionState(alterarSenha, {});
  const form = useRef<HTMLFormElement>(null);
  useAvisos(estado);
  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="max-w-sm space-y-3">
      <div className="space-y-2">
        <Label htmlFor="atual">Senha atual</Label>
        <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nova">Nova senha</Label>
        <Input id="nova" name="nova" type="password" autoComplete="new-password" minLength={12} required aria-describedby="dica-senha" />
        <p id="dica-senha" className="text-xs text-muted-foreground">
          Pelo menos 12 caracteres.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmacao">Repita a nova senha</Label>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      <Erro estado={estado} />
      <BotaoEnviar enviando={enviando}>Alterar senha</BotaoEnviar>
    </form>
  );
}

export function FormOutrasSessoes({ quantidade }: { quantidade: number }) {
  const [estado, acao, enviando] = useActionState(encerrarOutrasSessoesAction, {});
  useAvisos(estado);

  return (
    <form action={acao} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {quantidade === 0
          ? "Você só está conectado neste dispositivo."
          : `Há ${quantidade} ${quantidade === 1 ? "outro dispositivo conectado" : "outros dispositivos conectados"} à sua conta.`}
      </p>
      <Erro estado={estado} />
      <BotaoEnviar variant="outline" enviando={enviando} disabled={enviando || quantidade === 0}>
        Sair dos outros dispositivos
      </BotaoEnviar>
    </form>
  );
}

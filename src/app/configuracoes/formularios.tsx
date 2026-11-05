"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Camera, Copy, Loader2, MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  alterarSenha,
  cancelarConviteAction,
  desvincularWhatsappAction,
  encerrarOutrasSessoesAction,
  gerarConviteAction,
  removerFotoAction,
  gerarCodigoWhatsappAction,
  salvarFotoAction,
  salvarMetaGuardado,
  salvarOrcamento,
  type Estado,
} from "./actions";

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

/**
 * Vínculo do WhatsApp: mostra o código "vincular 482913" para o usuário mandar ao bot.
 * Quando a mensagem chega, o painel (AoVivo, na página) se atualiza sozinho e mostra o número vinculado.
 */
export function FormWhatsapp({
  telefone,
  codigo,
  validoAte,
  numeroBot,
}: {
  telefone: string | null;
  codigo: string | null;
  validoAte: string | null;
  numeroBot: string | null;
}) {
  const [estadoGerar, gerar, gerando] = useActionState(gerarCodigoWhatsappAction, {});
  const [estadoDesvincular, desvincular, desvinculando] = useActionState(desvincularWhatsappAction, {});
  useAvisos(estadoGerar);
  useAvisos(estadoDesvincular);

  if (codigo) {
    const mensagem = `vincular ${codigo}`;
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Mande esta mensagem para o Outflow no WhatsApp{numeroBot ? <> (<span className="font-medium text-foreground tabular-nums">+{numeroBot}</span>)</> : null}{" "}
          pelo número que você quer usar:
        </p>
        <code className="block rounded-lg bg-muted px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider">{mensagem}</code>
        <div className="flex flex-wrap gap-2">
          {numeroBot && (
            <a
              href={`https://wa.me/${numeroBot}?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants()}
            >
              <MessageCircle />
              Abrir no WhatsApp
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigator.clipboard.writeText(mensagem).then(() => toast.success("Mensagem copiada."))}
          >
            <Copy />
            Copiar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O código vale até {validoAte} e só pode ser usado uma vez. Esta tela se atualiza sozinha quando a mensagem chegar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {telefone ? (
          <>
            Vinculado ao número <span className="font-medium text-foreground tabular-nums">{telefone}</span>. As mensagens desse
            WhatsApp entram na sua conta.
          </>
        ) : (
          "Nenhum WhatsApp vinculado. Gere um código e mande para o bot para começar a registrar gastos por mensagem."
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={gerar}>
          <BotaoEnviar enviando={gerando} variant={telefone ? "outline" : "default"}>
            {telefone ? "Trocar número" : "Gerar código"}
          </BotaoEnviar>
        </form>
        {telefone && (
          <form action={desvincular}>
            <BotaoEnviar enviando={desvinculando} variant="ghost">
              Desvincular
            </BotaoEnviar>
          </form>
        )}
      </div>
    </div>
  );
}

export type ConviteNaTela = { codigo: string; situacao: "pendente" | "usado" | "vencido"; detalhe: string };

/** Painel do admin: gera convites de uso único e mostra quem já usou. */
export function FormConvites({ convites }: { convites: ConviteNaTela[] }) {
  const [estado, gerar, gerando] = useActionState(gerarConviteAction, {});
  useAvisos(estado);

  return (
    <div className="space-y-4">
      <form action={gerar} className="space-y-2">
        <Erro estado={estado} />
        <BotaoEnviar enviando={gerando}>
          <UserPlus />
          Gerar convite
        </BotaoEnviar>
      </form>
      {convites.length > 0 && (
        <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
          {convites.map((c) => (
            <ItemConvite key={c.codigo} convite={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemConvite({ convite }: { convite: ConviteNaTela }) {
  const [estado, cancelar, cancelando] = useActionState(cancelarConviteAction, {});
  useAvisos(estado);
  const link = () => `${window.location.origin}/cadastro?convite=${convite.codigo}`;
  const mensagem = () => `Você foi convidado para o Outflow! Crie sua conta aqui: ${link()}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
      <div className="min-w-0">
        <p className={cn("font-mono font-semibold tracking-wider", convite.situacao !== "pendente" && "text-muted-foreground line-through")}>
          {convite.codigo}
        </p>
        <p className="text-xs text-muted-foreground">{convite.detalhe}</p>
      </div>
      {convite.situacao === "pendente" && (
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(link()).then(() => toast.success("Link do convite copiado."))}
          >
            <Copy />
            Copiar link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagem())}`, "_blank", "noreferrer")}
          >
            <MessageCircle />
            Enviar
          </Button>
          <form action={cancelar}>
            <input type="hidden" name="codigo" value={convite.codigo} />
            <BotaoEnviar enviando={cancelando} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              Cancelar
            </BotaoEnviar>
          </form>
        </div>
      )}
    </li>
  );
}

const LADO_FOTO = 256;

/** Recorta o centro da imagem em quadrado e reduz para 256x256 (WebP), tudo no navegador. */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo); // já respeita a rotação das fotos do celular
  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LADO_FOTO;
  canvas.getContext("2d")!.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  imagem.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
  if (!blob) throw new Error("não foi possível converter a imagem");
  return blob;
}

export function FormFoto({ nome, fotoVersao }: { nome: string; fotoVersao: number | null }) {
  const [estadoSalvar, salvar, salvando] = useActionState(salvarFotoAction, {});
  const [estadoRemover, remover, removendo] = useActionState(removerFotoAction, {});
  const [preparando, iniciarTransicao] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  useAvisos(estadoSalvar);
  useAvisos(estadoRemover);
  const ocupado = salvando || removendo || preparando;

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    iniciarTransicao(async () => {
      try {
        const dados = new FormData();
        dados.set("foto", await prepararFoto(arquivo), "foto.webp");
        iniciarTransicao(() => salvar(dados)); // depois do await, a action precisa de uma transição nova
      } catch {
        toast.error("Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.");
      } finally {
        if (campo.current) campo.current.value = ""; // permite escolher o mesmo arquivo de novo
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar nome={nome} fotoVersao={fotoVersao} className="size-16 text-lg" />
        {ocupado && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input ref={campo} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => escolher(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => campo.current?.click()}>
            <Camera />
            {fotoVersao ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {fotoVersao && (
            <form action={remover}>
              <Button type="submit" variant="ghost" size="sm" disabled={ocupado}>
                Remover
              </Button>
            </form>
          )}
        </div>
        <Erro estado={estadoSalvar} />
      </div>
    </div>
  );
}

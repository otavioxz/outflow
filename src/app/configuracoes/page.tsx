import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { AoVivo } from "@/components/ao-vivo";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { exigirUsuario, tokenAtual } from "@/lib/auth";
import { formatarReais, hojeISO } from "@/lib/categorias";
import { obterMetaGuardadoCentavos, obterOrcamentoCentavos } from "@/lib/configuracoes";
import { totalDoMes } from "@/lib/gastos";
import { totalGuardadoNoMes } from "@/lib/guardados";
import { mascararNumero } from "@/lib/telefone";
import { contarOutrasSessoes } from "@/lib/usuarios";
import { estadoWhatsapp } from "@/lib/vinculo";
import { numeroDoBot } from "@/lib/whatsapp";
import { FormMetaGuardado, FormOrcamento, FormOutrasSessoes, FormSenha, FormWhatsapp } from "./formularios";

export const metadata: Metadata = { title: "Configurações · Outflow" };

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Configuracoes />
    </Suspense>
  );
}

async function Configuracoes() {
  await connection();
  const usuario = await exigirUsuario();
  const token = (await tokenAtual())!;
  const mes = hojeISO().slice(0, 7);
  const [orcamento, gastoNoMes, meta, guardadoNoMes, outrasSessoes, whatsapp, numeroBot] = await Promise.all([
    obterOrcamentoCentavos(usuario.id),
    totalDoMes(usuario.id, mes),
    obterMetaGuardadoCentavos(usuario.id),
    totalGuardadoNoMes(usuario.id, mes),
    contarOutrasSessoes(usuario.id, token),
    estadoWhatsapp(usuario.id),
    numeroDoBot(),
  ]);
  const validoAte = whatsapp.expiraEm
    ? new Date(whatsapp.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : null;

  // "3000,00" -> "3.000,00" para o campo
  const paraCampo = (centavos: number) => (centavos ? (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const pct = orcamento ? Math.round((gastoNoMes / orcamento) * 100) : 0;
  const pctMeta = meta ? Math.round((guardadoNoMes / meta) * 100) : 0;

  return (
    <div className="flex-1">
      <Cabecalho nome={usuario.nome} email={usuario.email} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:pt-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Voltar ao painel
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Configurações</h1>
        </div>

        <Card id="whatsapp" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>WhatsApp</CardTitle>
            <CardDescription>O número de onde você manda gastos, áudios e notas fiscais para o Outflow.</CardDescription>
            {whatsapp.codigo && (
              <CardAction>
                {/* enquanto espera a mensagem chegar, a tela se atualiza sozinha */}
                <AoVivo hoje={hojeISO()} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <FormWhatsapp
              telefone={whatsapp.telefone && mascararNumero(whatsapp.telefone)}
              codigo={whatsapp.codigo}
              validoAte={validoAte}
              numeroBot={numeroBot}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orçamento mensal</CardTitle>
            <CardDescription>
              Quanto você quer gastar por mês. O painel mostra quanto já foi usado e avisa a partir de 80%. Deixe em branco
              para não usar orçamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormOrcamento valorAtual={paraCampo(orcamento)} />
            {orcamento > 0 && (
              <p className="text-sm text-muted-foreground">
                Neste mês: <span className="font-medium text-foreground tabular-nums">{formatarReais(gastoNoMes)}</span> ({pct}% do
                orçamento).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta de guardar por mês</CardTitle>
            <CardDescription>
              Quanto você quer guardar por mês (poupança, reserva...). O valor guardado fica separado dos gastos e não conta no
              orçamento. Deixe em branco para não usar meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormMetaGuardado valorAtual={paraCampo(meta)} />
            {meta > 0 && (
              <p className="text-sm text-muted-foreground">
                Neste mês: <span className="font-medium text-foreground tabular-nums">{formatarReais(guardadoNoMes)}</span> ({pctMeta}% da
                meta).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sua conta</CardTitle>
            <CardDescription>Nome e e-mail são definidos no cadastro do acesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="font-medium">{usuario.nome}</dd>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">{usuario.email}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Ao trocar a senha, os outros dispositivos são desconectados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormSenha />
            <Separator />
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Dispositivos conectados</h3>
              <FormOutrasSessoes quantidade={outrasSessoes} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex-1">
      <div className="h-14 border-b" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-72" />
      </main>
    </div>
  );
}

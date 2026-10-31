import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, Mic, Trash2 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AoVivo } from "@/components/ao-vivo";
import { Cabecalho } from "@/components/cabecalho";
import { GraficoCategorias, GraficoDiario } from "@/components/graficos";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirUsuario } from "@/lib/auth";
import { NOME_PAGAMENTO, formatarReais, hojeISO } from "@/lib/categorias";
import { obterOrcamentoCentavos } from "@/lib/configuracoes";
import { gastosDoMes, totalDoMes } from "@/lib/gastos";
import { cn } from "@/lib/utils";
import { apagarGastoAction } from "./actions";

type Props = { searchParams: Promise<{ mes?: string }> };

export default function Page({ searchParams }: Props) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel searchParams={searchParams} />
    </Suspense>
  );
}

function deslocarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function Painel({ searchParams }: Props) {
  await connection(); // dados do banco e data de hoje: sempre na hora da requisição
  const usuario = await exigirUsuario();
  const { mes: mesParam } = await searchParams;
  const mesAtual = hojeISO().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual;
  const mesAnterior = deslocarMes(mes, -1);
  const proximoMes = deslocarMes(mes, 1);

  const [gastos, totalAnterior, orcamento] = await Promise.all([gastosDoMes(mes), totalDoMes(mesAnterior), obterOrcamentoCentavos()]);

  const total = gastos.reduce((s, g) => s + g.valor_centavos, 0);
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const diasDecorridos = mes === mesAtual ? Number(hojeISO().slice(8, 10)) : diasNoMes;

  const porCategoria = Object.entries(
    gastos.reduce<Record<string, number>>((acc, g) => ({ ...acc, [g.categoria]: (acc[g.categoria] ?? 0) + g.valor_centavos }), {}),
  )
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  const porDia = Array.from({ length: diasNoMes }, (_, i) => ({ dia: i + 1, total: 0 }));
  for (const g of gastos) porDia[Number(g.data.slice(8, 10)) - 1].total += g.valor_centavos;

  const pctOrcamento = orcamento ? Math.round((total / orcamento) * 100) : 0;
  const delta = totalAnterior ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : null;

  const nomeMes = new Date(ano, m - 1, 15).toLocaleDateString("pt-BR", { month: "long" });
  const nomeMesAno = new Date(ano, m - 1, 15).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const nomeMesAnterior = new Date(ano, m - 2, 15).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="flex-1">
      <Cabecalho nome={usuario.nome} email={usuario.email} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/?mes=${mesAnterior}`}
              aria-label="Mês anterior"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronLeft />
            </Link>
            <h1 className="min-w-44 text-center text-xl font-semibold first-letter:uppercase sm:text-2xl">{nomeMesAno}</h1>
            <Link
              href={`/?mes=${proximoMes}`}
              aria-label="Próximo mês"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronRight />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {mes !== mesAtual && (
              <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Voltar para hoje
              </Link>
            )}
            <AoVivo />
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card className="col-span-2">
            <CardHeader>
              <CardDescription>Gasto em {nomeMes}</CardDescription>
              <CardTitle className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{formatarReais(total)}</CardTitle>
            </CardHeader>
            <CardContent>
              {orcamento ? (
                <BarraOrcamento pct={pctOrcamento} orcamento={orcamento} total={total} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href="/configuracoes" className="font-medium text-foreground underline underline-offset-4">Defina um orçamento mensal</Link> para acompanhar quanto ainda pode gastar.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Média por dia</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
                {formatarReais(Math.round(total / Math.max(diasDecorridos, 1)))}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              em {diasDecorridos} {diasDecorridos === 1 ? "dia" : "dias"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription className="first-letter:uppercase">{nomeMesAnterior}</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{formatarReais(totalAnterior)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {delta === null ? (
                <span className="text-muted-foreground">Sem dados para comparar</span>
              ) : (
                <span className={cn("inline-flex items-center gap-1 font-medium", delta > 0 ? "text-destructive" : "text-success")}>
                  {delta > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  {Math.abs(delta)}% {delta > 0 ? "a mais" : "a menos"} em {nomeMes}
                </span>
              )}
            </CardContent>
          </Card>
        </section>

        {gastos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <MessageCircle className="size-6 text-muted-foreground" />
              </span>
              <div>
                <p className="font-medium">Nenhum gasto em {nomeMesAno}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mande algo como “gastei 45 no ifood” para o bot no WhatsApp e ele aparece aqui na hora.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Por categoria</CardTitle>
                  <CardDescription>
                    {porCategoria[0].categoria} é a maior: {Math.round((porCategoria[0].total / total) * 100)}% do mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GraficoCategorias dados={porCategoria} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Dia a dia</CardTitle>
                  <CardDescription>Quanto saiu em cada dia de {nomeMes}</CardDescription>
                </CardHeader>
                <CardContent>
                  <GraficoDiario dados={porDia} />
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Lançamentos</CardTitle>
                <CardDescription>
                  {gastos.length} {gastos.length === 1 ? "lançamento" : "lançamentos"} em {nomeMes}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 pl-4 sm:pl-2">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                      <TableHead className="hidden md:table-cell">Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-10 pr-4 sm:pr-2">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastos.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="pl-4 text-muted-foreground tabular-nums sm:pl-2">
                          {g.data.split("-").reverse().slice(0, 2).join("/")}
                        </TableCell>
                        <TableCell className="max-w-56 whitespace-normal">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            {g.descricao}
                            {g.origem === "audio" && (
                              <Mic className="size-3.5 text-muted-foreground" aria-label="Registrado por áudio" />
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground sm:hidden">{g.categoria}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary">{g.categoria}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{NOME_PAGAMENTO[g.pagamento]}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatarReais(g.valor_centavos)}</TableCell>
                        <TableCell className="pr-4 sm:pr-2">
                          <form action={apagarGastoAction}>
                            <input type="hidden" name="id" value={g.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Apagar ${g.descricao}`}
                            >
                              <Trash2 />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function BarraOrcamento({ pct, orcamento, total }: { pct: number; orcamento: number; total: number }) {
  const cor = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  const restante = orcamento - total;
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Uso do orçamento"
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{pct}%</span> do orçamento de {formatarReais(orcamento)}
        </span>
        <span className={cn(restante < 0 && "font-medium text-destructive")}>
          {restante >= 0 ? `Sobram ${formatarReais(restante)}` : `Passou ${formatarReais(-restante)}`}
        </span>
      </p>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex-1">
      <div className="h-14 border-b" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="col-span-2 h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
      </main>
    </div>
  );
}

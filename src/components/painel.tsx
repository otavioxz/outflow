import { ArrowDownRight, ArrowUpRight, BadgeCheck, ChevronLeft, ChevronRight, CreditCard, MessageCircle, Mic, PiggyBank, ReceiptText, Star, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { apagarGastoAction, apagarGuardadoAction } from "@/app/actions";
import { AoVivo } from "@/components/ao-vivo";
import { ApagarParcela } from "@/components/apagar-parcela";
import { BotaoFavorito } from "@/components/botao-favorito";
import { Cabecalho } from "@/components/cabecalho";
import { GraficoCategorias, GraficoDiario } from "@/components/graficos";
import { ListaLancamentos } from "@/components/lista-lancamentos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirUsuario } from "@/lib/auth";
import { NOME_PAGAMENTO, formatarReais, hojeISO } from "@/lib/categorias";
import { obterMetaGuardadoCentavos, obterOrcamentoCentavos } from "@/lib/configuracoes";
import { listarFavoritos, type Indicador } from "@/lib/favoritos";
import { gastosDoMes, parcelasFuturas, totalDoMes } from "@/lib/gastos";
import { guardadosDoMes, totalGuardadoNoMes } from "@/lib/guardados";
import { mesCurto } from "@/lib/parcelas";
import { estadoWhatsapp } from "@/lib/vinculo";
import { cn } from "@/lib/utils";

// As páginas Favoritos, Gastos e Guardado são a mesma tela com indicadores diferentes: cada
// indicador é um cartão independente (com estrela), e qualquer um pode aparecer em qualquer página.

export type PaginaPainel = "favoritos" | "gastos" | "guardado";

const PAGINAS: Record<PaginaPainel, { titulo: string; icone: typeof Star }> = {
  favoritos: { titulo: "Favoritos", icone: Star },
  gastos: { titulo: "Gastos", icone: Wallet },
  guardado: { titulo: "Guardado", icone: PiggyBank },
};

function deslocarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function carregarDados(usuarioId: number, mes: string) {
  const mesAtual = hojeISO().slice(0, 7);
  const mesAnterior = deslocarMes(mes, -1);

  const [gastos, totalAnterior, orcamento, guardados, guardadoAnterior, metaGuardado, futuras] = await Promise.all([
    gastosDoMes(usuarioId, mes),
    totalDoMes(usuarioId, mesAnterior),
    obterOrcamentoCentavos(usuarioId),
    guardadosDoMes(usuarioId, mes),
    totalGuardadoNoMes(usuarioId, mesAnterior),
    obterMetaGuardadoCentavos(usuarioId),
    parcelasFuturas(usuarioId, mes),
  ]);

  const total = gastos.reduce((s, g) => s + g.valor_centavos, 0);
  const totalGuardado = guardados.reduce((s, g) => s + g.valor_centavos, 0);
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

  return {
    gastos,
    guardados,
    total,
    totalAnterior,
    totalGuardado,
    guardadoAnterior,
    orcamento,
    metaGuardado,
    futuras,
    diasDecorridos,
    porCategoria,
    porDia,
    nomeMes: new Date(ano, m - 1, 15).toLocaleDateString("pt-BR", { month: "long" }),
    nomeMesAno: new Date(ano, m - 1, 15).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    nomeMesAnterior: new Date(ano, m - 2, 15).toLocaleDateString("pt-BR", { month: "long" }),
  };
}

type Dados = Awaited<ReturnType<typeof carregarDados>>;

/** Variação percentual em relação ao mês anterior (null sem base de comparação). */
const variacao = (atual: number, anterior: number) => (anterior ? Math.round(((atual - anterior) / anterior) * 100) : null);

/**
 * Cada indicador: nome (para a estrela e os avisos), espaço que ocupa na grade (2 colunas no
 * celular; no desktop, 12 nas páginas fixas e 4 nos Favoritos, onde a mistura é livre) e o conteúdo. `vazio` diz quando ele some da página Gastos/Guardado
 * (sem lançamentos no mês); na página Favoritos ele continua, com uma mensagem no lugar. `oculto` o tira de todas as páginas.
 */
const INDICADORES: Record<
  Indicador,
  {
    nome: string;
    grade: string;
    gradeFavoritos: string;
    vazio?: (d: Dados) => boolean;
    oculto?: (d: Dados) => boolean;
    conteudo: (d: Dados, estrela: React.ReactNode) => React.ReactNode;
  }
> = {
  "gasto-mes": {
    nome: "Gasto do mês",
    grade: "col-span-2 lg:col-span-6",
    gradeFavoritos: "col-span-2",
    conteudo: (d, estrela) => (
      <Card className="h-full">
        <CardHeader>
          <CardDescription>Gasto em {d.nomeMes}</CardDescription>
          <CardTitle className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{formatarReais(d.total)}</CardTitle>
          <CardAction>{estrela}</CardAction>
        </CardHeader>
        <CardContent>
          {d.orcamento ? (
            <BarraOrcamento orcamento={d.orcamento} total={d.total} />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/configuracoes" className="font-medium text-foreground underline underline-offset-4">Defina um orçamento mensal</Link> para acompanhar quanto ainda pode gastar.
            </p>
          )}
        </CardContent>
      </Card>
    ),
  },

  "gasto-medio-dia": {
    nome: "Gasto médio por dia",
    grade: "lg:col-span-3",
    gradeFavoritos: "",
    conteudo: (d, estrela) => (
      <Card className="h-full">
        <CardHeader>
          <CardDescription>Gasto médio por dia</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
            {formatarReais(Math.round(d.total / Math.max(d.diasDecorridos, 1)))}
          </CardTitle>
          <CardAction>{estrela}</CardAction>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          em {d.diasDecorridos} {d.diasDecorridos === 1 ? "dia" : "dias"}
        </CardContent>
      </Card>
    ),
  },

  "gasto-mes-anterior": {
    nome: "Gasto do mês anterior",
    grade: "lg:col-span-3",
    gradeFavoritos: "",
    conteudo: (d, estrela) => {
      const delta = variacao(d.total, d.totalAnterior);
      return (
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Gasto em {d.nomeMesAnterior}</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{formatarReais(d.totalAnterior)}</CardTitle>
            <CardAction>{estrela}</CardAction>
          </CardHeader>
          <CardContent className="text-sm">
            {delta === null ? (
              <span className="text-muted-foreground">Sem dados para comparar</span>
            ) : (
              <span className={cn("inline-flex items-center gap-1 font-medium", delta > 0 ? "text-destructive" : "text-success")}>
                {delta > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(delta)}% {delta > 0 ? "a mais" : "a menos"} em {d.nomeMes}
              </span>
            )}
          </CardContent>
        </Card>
      );
    },
  },

  "grafico-categorias": {
    nome: "Gastos por categoria",
    grade: "col-span-2 lg:col-span-5",
    gradeFavoritos: "col-span-2",
    vazio: (d) => d.gastos.length === 0,
    conteudo: (d, estrela) => (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Gastos por categoria</CardTitle>
          <CardDescription>
            {d.porCategoria.length
              ? `${d.porCategoria[0].categoria} é a maior: ${Math.round((d.porCategoria[0].total / d.total) * 100)}% do mês`
              : `Nenhum gasto em ${d.nomeMes}`}
          </CardDescription>
          <CardAction>{estrela}</CardAction>
        </CardHeader>
        {d.porCategoria.length > 0 && (
          <CardContent>
            <GraficoCategorias dados={d.porCategoria} />
          </CardContent>
        )}
      </Card>
    ),
  },

  "grafico-diario": {
    nome: "Gastos dia a dia",
    grade: "col-span-2 lg:col-span-7",
    gradeFavoritos: "col-span-2",
    vazio: (d) => d.gastos.length === 0,
    conteudo: (d, estrela) => (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Gastos dia a dia</CardTitle>
          <CardDescription>
            {d.gastos.length ? `Quanto saiu em cada dia de ${d.nomeMes}` : `Nenhum gasto em ${d.nomeMes}`}
          </CardDescription>
          <CardAction>{estrela}</CardAction>
        </CardHeader>
        {d.gastos.length > 0 && (
          <CardContent>
            <GraficoDiario dados={d.porDia} />
          </CardContent>
        )}
      </Card>
    ),
  },

  "lista-gastos": {
    nome: "Gastos lançados",
    grade: "col-span-2 lg:col-span-12",
    gradeFavoritos: "col-span-2 lg:col-span-4",
    conteudo: (d, estrela) =>
      d.gastos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardAction>{estrela}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <MessageCircle className="size-6 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Nenhum gasto em {d.nomeMesAno}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Mande algo como “gastei 45 no ifood” ou a foto de uma nota fiscal para o bot no WhatsApp e ele aparece aqui na hora.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ListaLancamentos
          titulo="Gastos lançados"
          descricao={`${d.gastos.length} ${d.gastos.length === 1 ? "gasto" : "gastos"} em ${d.nomeMes}`}
          acao={estrela}
        >
          <Table containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
              <TableRow>
                <TableHead className="w-16 pl-4 sm:pl-2">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead data-col="pagamento" className="hidden md:table-cell">
                  Pagamento
                </TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10 pr-4 sm:pr-2">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.gastos.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums sm:pl-2">
                    {g.data.split("-").reverse().slice(0, 2).join("/")}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {g.descricao}
                      {g.parcela && (
                        <span
                          className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
                          title={`Compra de ${formatarReais(g.total_compra ?? 0)} em ${g.parcelas}x`}
                        >
                          {g.parcela}/{g.parcelas}
                          <span className="sr-only"> parcelas, compra de {formatarReais(g.total_compra ?? 0)}</span>
                        </span>
                      )}
                      {g.origem === "audio" && <Mic className="size-3.5 text-muted-foreground" aria-label="Registrado por áudio" />}
                      {g.origem === "nota" && (
                        <ReceiptText className="size-3.5 text-muted-foreground" aria-label="Lido da foto de uma nota fiscal" />
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground sm:hidden">{g.categoria}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{g.categoria}</Badge>
                  </TableCell>
                  <TableCell data-col="pagamento" className="hidden text-muted-foreground md:table-cell">
                    {NOME_PAGAMENTO[g.pagamento]}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatarReais(g.valor_centavos)}</TableCell>
                  <TableCell className="pr-4 sm:pr-2">
                    {g.parcela && g.parcelas ? (
                      <ApagarParcela id={g.id} descricao={g.descricao} parcela={g.parcela} parcelas={g.parcelas} />
                    ) : (
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
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListaLancamentos>
      ),
  },

  "parcelas-a-pagar": {
    nome: "Parcelas a pagar",
    grade: "col-span-2 lg:col-span-12",
    gradeFavoritos: "col-span-2",
    // só aparece para quem tem parcela depois do mês mostrado
    oculto: (d) => d.futuras.total === 0,
    conteudo: (d, estrela) => {
      const proximos = d.futuras.porMes.slice(0, 6);
      const resto = d.futuras.porMes.length - proximos.length;
      const ultimo = d.futuras.porMes[d.futuras.porMes.length - 1];
      return (
        <Card className="h-full">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="size-4" />
              Parcelas a pagar depois de {d.nomeMes}
            </CardDescription>
            <CardTitle className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatarReais(d.futuras.total)}</CardTitle>
            <CardAction>{estrela}</CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {d.futuras.compras} {d.futuras.compras === 1 ? "compra parcelada" : "compras parceladas"}, até {mesCurto(ultimo.mes)}
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {proximos.map((m) => (
                <li key={m.mes} className="rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-foreground/5">
                  <span className="block text-xs text-muted-foreground">{mesCurto(m.mes)}</span>
                  <span className="block font-semibold tabular-nums">{formatarReais(m.total)}</span>
                </li>
              ))}
            </ul>
            {resto > 0 && (
              <p className="text-xs text-muted-foreground">
                e mais {resto} {resto === 1 ? "mês" : "meses"}
              </p>
            )}
          </CardContent>
        </Card>
      );
    },
  },

  "guardado-mes": {
    nome: "Guardado no mês",
    grade: "col-span-2 lg:col-span-8",
    gradeFavoritos: "col-span-2",
    conteudo: (d, estrela) => (
      <Card className="h-full bg-success/5 ring-success/25">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium text-success">
            <PiggyBank className="size-4" />
            Guardado em {d.nomeMes}
          </CardDescription>
          <CardTitle className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatarReais(d.totalGuardado)}</CardTitle>
          <CardAction>{estrela}</CardAction>
        </CardHeader>
        <CardContent>
          {d.metaGuardado ? (
            <BarraMeta meta={d.metaGuardado} guardado={d.totalGuardado} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Poupança, fora dos gastos.{" "}
              <Link href="/configuracoes" className="font-medium text-foreground underline underline-offset-4">Defina uma meta</Link> para acompanhar quanto falta guardar.
            </p>
          )}
        </CardContent>
      </Card>
    ),
  },

  "guardado-mes-anterior": {
    nome: "Guardado no mês anterior",
    grade: "col-span-2 lg:col-span-4",
    gradeFavoritos: "",
    conteudo: (d, estrela) => {
      const delta = variacao(d.totalGuardado, d.guardadoAnterior);
      return (
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Guardado em {d.nomeMesAnterior}</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{formatarReais(d.guardadoAnterior)}</CardTitle>
            <CardAction>{estrela}</CardAction>
          </CardHeader>
          <CardContent className="text-sm">
            {delta === null ? (
              <span className="text-muted-foreground">Sem dados para comparar</span>
            ) : (
              // aqui guardar mais é bom: verde quando sobe
              <span className={cn("inline-flex items-center gap-1 font-medium", delta >= 0 ? "text-success" : "text-destructive")}>
                {delta >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(delta)}% {delta >= 0 ? "a mais" : "a menos"} em {d.nomeMes}
              </span>
            )}
          </CardContent>
        </Card>
      );
    },
  },

  "lista-guardados": {
    nome: "Valores guardados",
    grade: "col-span-2 lg:col-span-12",
    gradeFavoritos: "col-span-2 lg:col-span-4",
    conteudo: (d, estrela) =>
      d.guardados.length === 0 ? (
        <Card>
          <CardHeader>
            <CardAction>{estrela}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <PiggyBank className="size-6 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Nada guardado em {d.nomeMesAno}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Mande algo como “guardei 500 na poupança” para o bot no WhatsApp e ele aparece aqui, fora dos gastos.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ListaLancamentos
          titulo="Valores guardados"
          descricao={`${d.guardados.length} ${d.guardados.length === 1 ? "valor guardado" : "valores guardados"} em ${d.nomeMes}, fora dos gastos`}
          acao={estrela}
        >
          <Table containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
              <TableRow>
                <TableHead className="w-16 pl-4 sm:pl-2">Data</TableHead>
                <TableHead>Onde</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10 pr-4 sm:pr-2">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.guardados.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums sm:pl-2">
                    {g.data.split("-").reverse().slice(0, 2).join("/")}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {g.descricao}
                      {g.origem === "audio" && <Mic className="size-3.5 text-muted-foreground" aria-label="Registrado por áudio" />}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-success tabular-nums">{formatarReais(g.valor_centavos)}</TableCell>
                  <TableCell className="pr-4 sm:pr-2">
                    <form action={apagarGuardadoAction}>
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
        </ListaLancamentos>
      ),
  },
};

/** Ordem dos indicadores nas páginas fixas. */
const DA_PAGINA: Record<Exclude<PaginaPainel, "favoritos">, Indicador[]> = {
  gastos: ["gasto-mes", "gasto-medio-dia", "gasto-mes-anterior", "parcelas-a-pagar", "grafico-categorias", "grafico-diario", "lista-gastos"],
  guardado: ["guardado-mes", "guardado-mes-anterior", "lista-guardados"],
};

/** Tela de uma página do painel: cabeçalho, navegação entre meses e os indicadores da página. */
export async function Painel({ pagina, searchParams }: { pagina: PaginaPainel; searchParams: Promise<{ mes?: string }> }) {
  await connection(); // dados do banco e data de hoje: sempre na hora da requisição
  const usuario = await exigirUsuario();
  const { mes: mesParam } = await searchParams;
  const mesAtual = hojeISO().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual;
  const base = `/${pagina}`;

  const [dados, favoritos, whatsapp] = await Promise.all([
    carregarDados(usuario.id, mes),
    listarFavoritos(usuario.id),
    estadoWhatsapp(usuario.id),
  ]);

  const indicadores = (pagina === "favoritos" ? favoritos : DA_PAGINA[pagina].filter((id) => !INDICADORES[id].vazio?.(dados))).filter(
    (id) => !INDICADORES[id].oculto?.(dados),
  );
  const { titulo, icone: Icone } = PAGINAS[pagina];

  return (
    <div className="flex-1">
      <Cabecalho nome={usuario.nome} email={usuario.email} fotoVersao={usuario.fotoVersao} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:pt-8">
        <div className="space-y-3">
          <h1 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icone className={cn("size-4", pagina === "favoritos" && "fill-warning text-warning")} />
            {titulo}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`${base}?mes=${deslocarMes(mes, -1)}`}
                aria-label="Mês anterior"
                className={buttonVariants({ variant: "outline", size: "icon" })}
              >
                <ChevronLeft />
              </Link>
              <h2 className="min-w-44 text-center text-xl font-semibold first-letter:uppercase sm:text-2xl">{dados.nomeMesAno}</h2>
              <Link
                href={`${base}?mes=${deslocarMes(mes, 1)}`}
                aria-label="Próximo mês"
                className={buttonVariants({ variant: "outline", size: "icon" })}
              >
                <ChevronRight />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {mes !== mesAtual && (
                <Link href={base} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Voltar para hoje
                </Link>
              )}
              <AoVivo hoje={hojeISO()} />
            </div>
          </div>
        </div>

        {!whatsapp.telefone && (
          <Alert>
            <MessageCircle />
            <AlertTitle>Vincule seu WhatsApp</AlertTitle>
            <AlertDescription>
              <p>
                Para registrar gastos por mensagem, áudio ou foto da nota, ligue seu número à conta.{" "}
                <Link href="/configuracoes#whatsapp" className="font-medium text-foreground underline underline-offset-4">
                  Vincular agora
                </Link>
              </p>
            </AlertDescription>
          </Alert>
        )}

        {pagina === "favoritos" && favoritos.length === 0 ? (
          <SemFavoritos />
        ) : indicadores.length === 0 ? (
          // só nos Favoritos, quando todos os marcados estão ocultos neste mês (ex.: sem parcelas a pagar)
          <p className="py-12 text-center text-sm text-muted-foreground">Nenhum dos seus favoritos tem dados em {dados.nomeMesAno}.</p>
        ) : (
          // nos favoritos a ordem é a de marcação; "dense" preenche os buracos que cartões de larguras diferentes deixam
          <section
            className={cn("grid grid-cols-2 gap-3 sm:gap-4", pagina === "favoritos" ? "grid-flow-row-dense lg:grid-cols-4" : "lg:grid-cols-12")}
          >
            {indicadores.map((id) => {
              const { nome, grade, gradeFavoritos, conteudo } = INDICADORES[id];
              const estrela = <BotaoFavorito indicador={id} nome={nome} favorito={favoritos.includes(id)} />;
              return (
                <div key={id} className={cn("min-w-0", pagina === "favoritos" ? gradeFavoritos : grade)}>
                  {conteudo(dados, estrela)}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function SemFavoritos() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <Star className="size-6 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">Nenhum favorito ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Toque na estrela de um indicador em Gastos ou Guardado para vê-lo aqui. Com algum favorito, o Outflow já abre nesta página.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/gastos" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Wallet /> Gastos
          </Link>
          <Link href="/guardado" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PiggyBank /> Guardado
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function BarraOrcamento({ orcamento, total }: { orcamento: number; total: number }) {
  const pct = Math.round((total / orcamento) * 100);
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

function BarraMeta({ meta, guardado }: { meta: number; guardado: number }) {
  const pct = Math.round((guardado / meta) * 100);
  const falta = meta - guardado;
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da meta de guardar"
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {/* com a meta batida, o selo fica sempre na mesma linha (o texto encurta se faltar espaço) */}
      <p
        className={cn(
          "flex items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground",
          falta > 0 ? "flex-wrap" : "flex-nowrap",
        )}
      >
        <span className="min-w-0 truncate">
          <span className="font-medium text-foreground">{pct}%</span> da meta de {formatarReais(meta)}
        </span>
        {falta > 0 ? (
          <span>Faltam {formatarReais(falta)}</span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success/25">
            <BadgeCheck className="size-3.5" aria-hidden />
            Meta batida
          </span>
        )}
      </p>
    </div>
  );
}

export function CarregandoPainel() {
  return (
    <div className="flex-1">
      <div className="h-14 border-b" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Skeleton className="col-span-2 h-40" />
          <Skeleton className="col-span-2 h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
      </main>
    </div>
  );
}

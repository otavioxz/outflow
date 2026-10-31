"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const reaisCurto = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact" });

const eixo = { fill: "var(--muted-foreground)", fontSize: 12 };

type DadosTooltip = { active?: boolean; payload?: readonly { value: number; payload: Record<string, unknown> }[] };

function Dica({ active, payload, rotulo }: DadosTooltip & { rotulo: (p: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="font-semibold tabular-nums">{reais(payload[0].value)}</div>
      <div className="text-muted-foreground">{rotulo(payload[0].payload)}</div>
    </div>
  );
}

export function GraficoCategorias({ dados }: { dados: { categoria: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={dados.length * 30 + 28}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={4}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={reaisCurto} tick={eixo} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="categoria" width={92} tick={eixo} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--accent)" }}
          content={(p) => <Dica {...(p as DadosTooltip)} rotulo={(d) => String(d.categoria)} />}
        />
        <Bar dataKey="total" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoDiario({ dados }: { dados: { dia: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={dados} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="dia"
          tick={eixo}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis tickFormatter={reaisCurto} tick={eixo} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          cursor={{ fill: "var(--accent)" }}
          content={(p) => <Dica {...(p as DadosTooltip)} rotulo={(d) => `Dia ${d.dia}`} />}
        />
        <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

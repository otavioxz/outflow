// Compras parceladas: "5000 em 10x" vira 10 gastos de R$ 500,00, um por mês a partir do mês da compra.

/** Parcelamentos aceitos. Acima disso é mais provável um erro de leitura que uma compra real. */
export const MIN_PARCELAS = 2;
export const MAX_PARCELAS = 48;

export type Parcela = { parcela: number; data: string; valor_centavos: number };

/** "2026-01-31" + 1 mês = "2026-02-28": o dia passa para o último do mês quando ele é mais curto. */
export function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Divide uma compra em parcelas mensais, a 1ª na data da compra. Os centavos que não dividem por
 * igual vão para a última parcela (R$ 100,00 em 3x = 33,33 + 33,33 + 33,34): a soma sempre bate.
 */
export function dividirEmParcelas(totalCentavos: number, parcelas: number, data: string): Parcela[] {
  const base = Math.floor(totalCentavos / parcelas);
  return Array.from({ length: parcelas }, (_, i) => ({
    parcela: i + 1,
    data: somarMeses(data, i),
    valor_centavos: i === parcelas - 1 ? totalCentavos - base * (parcelas - 1) : base,
  }));
}

/** "2026-11" -> "nov/2026" */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${new Date(ano, m - 1, 15).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${ano}`;
}

export const CATEGORIAS = [
  "Alimentação",
  "Mercado",
  "Transporte",
  "Moradia",
  "Contas",
  "Saúde",
  "Lazer",
  "Compras",
  "Educação",
  "Assinaturas",
  "Outros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const PAGAMENTOS = ["pix", "credito", "debito", "dinheiro", "boleto", "nao_informado"] as const;

export type Pagamento = (typeof PAGAMENTOS)[number];

export const NOME_PAGAMENTO: Record<Pagamento, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  nao_informado: "—",
};

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte "3.000,50", "R$ 3000", "3000.50" em centavos. null = inválido. */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/r\$|\s/gi, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "3.000" = três mil
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Data de hoje no fuso de Brasília, no formato YYYY-MM-DD. */
export function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

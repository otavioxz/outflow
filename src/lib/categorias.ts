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

/** Data de hoje no fuso de Brasília, no formato YYYY-MM-DD. */
export function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

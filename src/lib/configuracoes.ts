import { prepararDb } from "./db";

// Configurações editáveis pela página /configuracoes, guardadas no banco.

/**
 * Orçamento mensal em centavos (0 = sem orçamento).
 * Usa o valor salvo pelo painel; se nunca foi salvo, cai no ORCAMENTO_MENSAL do .env.
 */
export async function obterOrcamentoCentavos(): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({ sql: `SELECT valor FROM configuracoes WHERE chave = 'orcamento_centavos'`, args: [] });
  if (r.rows[0]) return Number(r.rows[0].valor) || 0;
  return Math.round(Number(process.env.ORCAMENTO_MENSAL) * 100) || 0;
}

export async function definirOrcamentoCentavos(centavos: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('orcamento_centavos', ?, datetime('now'))
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [String(centavos)],
  });
}

/** Meta de quanto guardar por mês, em centavos (0 = sem meta). */
export async function obterMetaGuardadoCentavos(): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({ sql: `SELECT valor FROM configuracoes WHERE chave = 'meta_guardado_centavos'`, args: [] });
  return Number(r.rows[0]?.valor) || 0;
}

export async function definirMetaGuardadoCentavos(centavos: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('meta_guardado_centavos', ?, datetime('now'))
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [String(centavos)],
  });
}

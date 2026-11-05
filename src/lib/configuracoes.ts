import { prepararDb } from "./db";

// Configurações de cada usuário, editáveis pela página /configuracoes e guardadas no banco.

type Chave = "orcamento_centavos" | "meta_guardado_centavos";

async function lerCentavos(usuarioId: number, chave: Chave): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT valor FROM configuracoes_usuario WHERE usuario_id = ? AND chave = ?`,
    args: [usuarioId, chave],
  });
  return Number(r.rows[0]?.valor) || 0;
}

async function gravarCentavos(usuarioId: number, chave: Chave, centavos: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `INSERT INTO configuracoes_usuario (usuario_id, chave, valor, atualizado_em) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(usuario_id, chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [usuarioId, chave, String(centavos)],
  });
}

/** Orçamento mensal em centavos (0 = sem orçamento). */
export const obterOrcamentoCentavos = (usuarioId: number) => lerCentavos(usuarioId, "orcamento_centavos");
export const definirOrcamentoCentavos = (usuarioId: number, centavos: number) =>
  gravarCentavos(usuarioId, "orcamento_centavos", centavos);

/** Meta de quanto guardar por mês, em centavos (0 = sem meta). */
export const obterMetaGuardadoCentavos = (usuarioId: number) => lerCentavos(usuarioId, "meta_guardado_centavos");
export const definirMetaGuardadoCentavos = (usuarioId: number, centavos: number) =>
  gravarCentavos(usuarioId, "meta_guardado_centavos", centavos);

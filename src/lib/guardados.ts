import { prepararDb } from "./db";

// Dinheiro guardado no mês (poupança, reserva...). Tabela separada de "gastos" para nunca
// entrar no total gasto nem no orçamento. Toda consulta filtra por usuario_id.

export type Guardado = {
  id: number;
  valor_centavos: number;
  descricao: string;
  data: string; // YYYY-MM-DD
  origem: "texto" | "audio";
  criado_em: string;
};

export type NovoGuardado = Omit<Guardado, "id" | "criado_em"> & {
  mensagem_original?: string;
  mensagem_id?: string;
};

const COLUNAS = "id, valor_centavos, descricao, data, origem, criado_em";

export async function inserirGuardados(usuarioId: number, guardados: NovoGuardado[]): Promise<void> {
  const db = await prepararDb();
  await db.batch(
    guardados.map((g) => ({
      sql: `INSERT INTO guardados (usuario_id, valor_centavos, descricao, data, origem, mensagem_original, mensagem_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [usuarioId, g.valor_centavos, g.descricao, g.data, g.origem, g.mensagem_original ?? null, g.mensagem_id ?? null],
    })),
    "write",
  );
}

/** Lista o que foi guardado num mês ("YYYY-MM"), do mais recente para o mais antigo. */
export async function guardadosDoMes(usuarioId: number, mes: string): Promise<Guardado[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT ${COLUNAS} FROM guardados WHERE usuario_id = ? AND substr(data, 1, 7) = ? ORDER BY data DESC, id DESC`,
    args: [usuarioId, mes],
  });
  return r.rows.map((row) => ({ ...row }) as unknown as Guardado);
}

export async function totalGuardadoNoMes(usuarioId: number, mes: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM guardados WHERE usuario_id = ? AND substr(data, 1, 7) = ?`,
    args: [usuarioId, mes],
  });
  return Number(r.rows[0].total);
}

/** Apaga um valor guardado do usuário e o retorna (null se não existia ou é de outro usuário). */
export async function apagarGuardado(usuarioId: number, id: number): Promise<Guardado | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM guardados WHERE id = ? AND usuario_id = ? RETURNING ${COLUNAS}`,
    args: [id, usuarioId],
  });
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Guardado) : null;
}

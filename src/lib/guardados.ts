import { prepararDb } from "./db";

// Dinheiro guardado no mês (poupança, reserva...). Tabela separada de "gastos" para nunca
// entrar no total gasto nem no orçamento.

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

export async function inserirGuardados(guardados: NovoGuardado[]): Promise<void> {
  const db = await prepararDb();
  await db.batch(
    guardados.map((g) => ({
      sql: `INSERT INTO guardados (valor_centavos, descricao, data, origem, mensagem_original, mensagem_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [g.valor_centavos, g.descricao, g.data, g.origem, g.mensagem_original ?? null, g.mensagem_id ?? null],
    })),
    "write",
  );
}

/** Lista o que foi guardado num mês ("YYYY-MM"), do mais recente para o mais antigo. */
export async function guardadosDoMes(mes: string): Promise<Guardado[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT ${COLUNAS} FROM guardados WHERE substr(data, 1, 7) = ? ORDER BY data DESC, id DESC`,
    args: [mes],
  });
  return r.rows.map((row) => ({ ...row }) as unknown as Guardado);
}

export async function totalGuardadoNoMes(mes: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM guardados WHERE substr(data, 1, 7) = ?`,
    args: [mes],
  });
  return Number(r.rows[0].total);
}

/** Apaga um valor guardado e o retorna (null se não existia). */
export async function apagarGuardado(id: number): Promise<Guardado | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM guardados WHERE id = ? RETURNING ${COLUNAS}`,
    args: [id],
  });
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Guardado) : null;
}

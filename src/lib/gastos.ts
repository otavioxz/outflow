import { prepararDb } from "./db";
import type { Categoria, Pagamento } from "./categorias";

export type Gasto = {
  id: number;
  valor_centavos: number;
  descricao: string;
  categoria: Categoria;
  pagamento: Pagamento;
  data: string; // YYYY-MM-DD
  origem: "texto" | "audio";
  criado_em: string;
};

export type NovoGasto = Omit<Gasto, "id" | "criado_em"> & {
  mensagem_original?: string;
  mensagem_id?: string;
};

export async function inserirGastos(gastos: NovoGasto[]): Promise<void> {
  const db = await prepararDb();
  await db.batch(
    gastos.map((g) => ({
      sql: `INSERT INTO gastos (valor_centavos, descricao, categoria, pagamento, data, origem, mensagem_original, mensagem_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        g.valor_centavos,
        g.descricao,
        g.categoria,
        g.pagamento,
        g.data,
        g.origem,
        g.mensagem_original ?? null,
        g.mensagem_id ?? null,
      ],
    })),
    "write",
  );
}

/** Lista os gastos de um mês ("YYYY-MM"), do mais recente para o mais antigo. */
export async function gastosDoMes(mes: string): Promise<Gasto[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT id, valor_centavos, descricao, categoria, pagamento, data, origem, criado_em
          FROM gastos WHERE substr(data, 1, 7) = ? ORDER BY data DESC, id DESC`,
    args: [mes],
  });
  return r.rows.map((row) => ({ ...row }) as unknown as Gasto);
}

export async function totalDoMes(mes: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM gastos WHERE substr(data, 1, 7) = ?`,
    args: [mes],
  });
  return Number(r.rows[0].total);
}

export async function totaisPorCategoria(mes: string): Promise<{ categoria: Categoria; total: number }[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT categoria, SUM(valor_centavos) AS total FROM gastos
          WHERE substr(data, 1, 7) = ? GROUP BY categoria ORDER BY total DESC`,
    args: [mes],
  });
  return r.rows.map((row) => ({ categoria: row.categoria as Categoria, total: Number(row.total) }));
}

/** Apaga o último gasto registrado (pela ordem de inserção) e o retorna. */
export async function desfazerUltimo(): Promise<Gasto | null> {
  const db = await prepararDb();
  const r = await db.execute(
    `DELETE FROM gastos WHERE id = (SELECT MAX(id) FROM gastos)
     RETURNING id, valor_centavos, descricao, categoria, pagamento, data, origem, criado_em`,
  );
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Gasto) : null;
}

export async function apagarGasto(id: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `DELETE FROM gastos WHERE id = ?`, args: [id] });
}

/** Marca a mensagem como processada. Retorna false se ela já tinha sido vista antes. */
export async function marcarMensagemProcessada(id: string): Promise<boolean> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `INSERT OR IGNORE INTO mensagens_processadas (id) VALUES (?)`,
    args: [id],
  });
  return r.rowsAffected > 0;
}

/** Uma "impressão digital" barata da tabela: muda sempre que um gasto é inserido ou apagado. */
export async function versaoDosDados(): Promise<string> {
  const db = await prepararDb();
  const r = await db.execute(
    `SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS ultimo, COALESCE(SUM(valor_centavos), 0) AS soma FROM gastos`,
  );
  const { n, ultimo, soma } = r.rows[0];
  return `${n}-${ultimo}-${soma}`;
}

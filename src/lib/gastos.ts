import { prepararDb } from "./db";
import type { Categoria, Pagamento } from "./categorias";
import { apagarGuardado, type Guardado } from "./guardados";

export type Gasto = {
  id: number;
  valor_centavos: number;
  descricao: string;
  categoria: Categoria;
  pagamento: Pagamento;
  data: string; // YYYY-MM-DD
  origem: "texto" | "audio" | "nota";
  criado_em: string;
};

export type NovoGasto = Omit<Gasto, "id" | "criado_em"> & {
  mensagem_original?: string;
  mensagem_id?: string;
  chave_nota?: string;
};

export async function inserirGastos(gastos: NovoGasto[]): Promise<void> {
  const db = await prepararDb();
  await db.batch(
    gastos.map((g) => ({
      sql: `INSERT INTO gastos (valor_centavos, descricao, categoria, pagamento, data, origem, mensagem_original, mensagem_id, chave_nota)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        g.valor_centavos,
        g.descricao,
        g.categoria,
        g.pagamento,
        g.data,
        g.origem,
        g.mensagem_original ?? null,
        g.mensagem_id ?? null,
        g.chave_nota ?? null,
      ],
    })),
    "write",
  );
}

/** Gasto já registrado a partir da nota fiscal com esta chave de acesso (null se a nota é nova). */
export async function gastoDaNota(chave: string): Promise<Gasto | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT id, valor_centavos, descricao, categoria, pagamento, data, origem, criado_em
          FROM gastos WHERE chave_nota = ? LIMIT 1`,
    args: [chave],
  });
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Gasto) : null;
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

/**
 * Apaga o último lançamento registrado (gasto ou valor guardado, pela ordem de inserção) e o retorna.
 * Quando uma mensagem gera os dois, os guardados são inseridos depois: no empate, eles saem primeiro.
 */
export async function desfazerUltimo(): Promise<
  ({ tipo: "gasto" } & Gasto) | ({ tipo: "guardado" } & Guardado) | null
> {
  const db = await prepararDb();
  const ultimo = await db.execute(
    `SELECT tabela, id FROM (
       SELECT 'gastos' AS tabela, id, criado_em FROM gastos
       UNION ALL
       SELECT 'guardados' AS tabela, id, criado_em FROM guardados
     ) ORDER BY criado_em DESC, tabela = 'guardados' DESC, id DESC LIMIT 1`,
  );
  if (!ultimo.rows[0]) return null;
  const { tabela, id } = ultimo.rows[0];
  if (tabela === "guardados") {
    const g = await apagarGuardado(Number(id));
    return g && { tipo: "guardado", ...g };
  }
  const g = await apagarGasto(Number(id));
  return g && { tipo: "gasto", ...g };
}

/** Apaga um gasto e o retorna (null se não existia). */
export async function apagarGasto(id: number): Promise<Gasto | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM gastos WHERE id = ?
          RETURNING id, valor_centavos, descricao, categoria, pagamento, data, origem, criado_em`,
    args: [id],
  });
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Gasto) : null;
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

/** Uma "impressão digital" barata dos lançamentos: muda sempre que um gasto ou valor guardado é inserido ou apagado. */
export async function versaoDosDados(): Promise<string> {
  const db = await prepararDb();
  const r = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM gastos) AS n, (SELECT COALESCE(MAX(id), 0) FROM gastos) AS ultimo,
       (SELECT COALESCE(SUM(valor_centavos), 0) FROM gastos) AS soma,
       (SELECT COUNT(*) FROM guardados) AS ng, (SELECT COALESCE(MAX(id), 0) FROM guardados) AS ultimog,
       (SELECT COALESCE(SUM(valor_centavos), 0) FROM guardados) AS somag`,
  );
  const { n, ultimo, soma, ng, ultimog, somag } = r.rows[0];
  return `${n}-${ultimo}-${soma}|${ng}-${ultimog}-${somag}`;
}

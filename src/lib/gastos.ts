import { prepararDb } from "./db";
import type { Categoria, Pagamento } from "./categorias";
import { apagarGuardado, type Guardado } from "./guardados";

// Toda consulta filtra por usuario_id: um usuário nunca vê nem apaga os lançamentos de outro.

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

const COLUNAS = "id, valor_centavos, descricao, categoria, pagamento, data, origem, criado_em";

export async function inserirGastos(usuarioId: number, gastos: NovoGasto[]): Promise<void> {
  const db = await prepararDb();
  await db.batch(
    gastos.map((g) => ({
      sql: `INSERT INTO gastos (usuario_id, valor_centavos, descricao, categoria, pagamento, data, origem, mensagem_original, mensagem_id, chave_nota)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        usuarioId,
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

/** Gasto já registrado pelo usuário a partir da nota fiscal com esta chave de acesso (null se a nota é nova). */
export async function gastoDaNota(usuarioId: number, chave: string): Promise<Gasto | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT ${COLUNAS} FROM gastos WHERE usuario_id = ? AND chave_nota = ? LIMIT 1`,
    args: [usuarioId, chave],
  });
  return r.rows[0] ? ({ ...r.rows[0] } as unknown as Gasto) : null;
}

/** Lista os gastos de um mês ("YYYY-MM"), do mais recente para o mais antigo. */
export async function gastosDoMes(usuarioId: number, mes: string): Promise<Gasto[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT ${COLUNAS} FROM gastos WHERE usuario_id = ? AND substr(data, 1, 7) = ? ORDER BY data DESC, id DESC`,
    args: [usuarioId, mes],
  });
  return r.rows.map((row) => ({ ...row }) as unknown as Gasto);
}

export async function totalDoMes(usuarioId: number, mes: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM gastos WHERE usuario_id = ? AND substr(data, 1, 7) = ?`,
    args: [usuarioId, mes],
  });
  return Number(r.rows[0].total);
}

export async function totaisPorCategoria(usuarioId: number, mes: string): Promise<{ categoria: Categoria; total: number }[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT categoria, SUM(valor_centavos) AS total FROM gastos
          WHERE usuario_id = ? AND substr(data, 1, 7) = ? GROUP BY categoria ORDER BY total DESC`,
    args: [usuarioId, mes],
  });
  return r.rows.map((row) => ({ categoria: row.categoria as Categoria, total: Number(row.total) }));
}

/**
 * Apaga o último lançamento do usuário (gasto ou valor guardado, pela ordem de inserção) e o retorna.
 * Quando uma mensagem gera os dois, os guardados são inseridos depois: no empate, eles saem primeiro.
 */
export async function desfazerUltimo(
  usuarioId: number,
): Promise<({ tipo: "gasto" } & Gasto) | ({ tipo: "guardado" } & Guardado) | null> {
  const db = await prepararDb();
  const ultimo = await db.execute({
    sql: `SELECT tabela, id FROM (
            SELECT 'gastos' AS tabela, id, criado_em FROM gastos WHERE usuario_id = ?
            UNION ALL
            SELECT 'guardados' AS tabela, id, criado_em FROM guardados WHERE usuario_id = ?
          ) ORDER BY criado_em DESC, tabela = 'guardados' DESC, id DESC LIMIT 1`,
    args: [usuarioId, usuarioId],
  });
  if (!ultimo.rows[0]) return null;
  const { tabela, id } = ultimo.rows[0];
  if (tabela === "guardados") {
    const g = await apagarGuardado(usuarioId, Number(id));
    return g && { tipo: "guardado", ...g };
  }
  const g = await apagarGasto(usuarioId, Number(id));
  return g && { tipo: "gasto", ...g };
}

/** Apaga um gasto do usuário e o retorna (null se não existia ou é de outro usuário). */
export async function apagarGasto(usuarioId: number, id: number): Promise<Gasto | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM gastos WHERE id = ? AND usuario_id = ? RETURNING ${COLUNAS}`,
    args: [id, usuarioId],
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

/**
 * Uma "impressão digital" barata dos dados do usuário: muda sempre que um gasto ou valor guardado
 * é inserido ou apagado, ou quando o WhatsApp é vinculado (o painel então se atualiza sozinho).
 */
export async function versaoDosDados(usuarioId: number): Promise<string> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM gastos WHERE usuario_id = ?1) AS n,
            (SELECT COALESCE(MAX(id), 0) FROM gastos WHERE usuario_id = ?1) AS ultimo,
            (SELECT COALESCE(SUM(valor_centavos), 0) FROM gastos WHERE usuario_id = ?1) AS soma,
            (SELECT COUNT(*) FROM guardados WHERE usuario_id = ?1) AS ng,
            (SELECT COALESCE(MAX(id), 0) FROM guardados WHERE usuario_id = ?1) AS ultimog,
            (SELECT COALESCE(SUM(valor_centavos), 0) FROM guardados WHERE usuario_id = ?1) AS somag,
            (SELECT COALESCE(telefone, '') FROM usuarios WHERE id = ?1) AS telefone`,
    args: [usuarioId],
  });
  const { n, ultimo, soma, ng, ultimog, somag, telefone } = r.rows[0];
  return `${n}-${ultimo}-${soma}|${ng}-${ultimog}-${somag}|${telefone ? "vinculado" : "sem-whatsapp"}`;
}

import { prepararDb } from "./db";

// Andamento das mensagens do WhatsApp, para o painel mostrar "processando…" e depois o resultado.

export type StatusAtividade = "processando" | "gasto" | "comando" | "sem_gasto" | "erro";

export type Atividade = {
  id: number;
  origem: "texto" | "audio" | "outro";
  status: StatusAtividade;
  titulo: string;
  detalhe: string | null;
  atualizada_em: number;
};

/** Registra que uma mensagem chegou e está sendo processada. Retorna o id da atividade. */
export async function iniciarAtividade(mensagemId: string, origem: Atividade["origem"]): Promise<number> {
  const db = await prepararDb();
  const agora = Date.now();
  const titulo = origem === "audio" ? "Áudio recebido, transcrevendo…" : "Mensagem recebida, processando…";
  const r = await db.execute({
    sql: `INSERT INTO atividades (mensagem_id, origem, status, titulo, criada_em, atualizada_em)
          VALUES (?, ?, 'processando', ?, ?, ?)
          ON CONFLICT(mensagem_id) DO UPDATE SET atualizada_em = excluded.atualizada_em
          RETURNING id`,
    args: [mensagemId, origem, titulo, agora, agora],
  });
  // limpeza ocasional: o painel só precisa dos últimos minutos
  if (Math.random() < 0.1) {
    await db.execute({ sql: `DELETE FROM atividades WHERE atualizada_em < ?`, args: [agora - 24 * 60 * 60 * 1000] });
  }
  return Number(r.rows[0].id);
}

export async function concluirAtividade(id: number, status: Exclude<StatusAtividade, "processando">, titulo: string, detalhe?: string) {
  const db = await prepararDb();
  await db.execute({
    sql: `UPDATE atividades SET status = ?, titulo = ?, detalhe = ?, atualizada_em = ? WHERE id = ?`,
    args: [status, titulo.slice(0, 200), detalhe?.slice(0, 500) ?? null, Date.now(), id],
  });
}

/** Atividades alteradas nos últimos `janelaMs` (o painel compara com o que já mostrou). */
export async function atividadesRecentes(janelaMs = 2 * 60 * 1000): Promise<Atividade[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT id, origem, status, titulo, detalhe, atualizada_em FROM atividades
          WHERE atualizada_em > ? ORDER BY id DESC LIMIT 10`,
    args: [Date.now() - janelaMs],
  });
  return r.rows.map((l) => ({
    id: Number(l.id),
    origem: l.origem as Atividade["origem"],
    status: l.status as StatusAtividade,
    titulo: String(l.titulo),
    detalhe: l.detalhe == null ? null : String(l.detalhe),
    atualizada_em: Number(l.atualizada_em),
  }));
}

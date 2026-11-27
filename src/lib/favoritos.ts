import { prepararDb } from "./db";

// Indicadores do painel que podem ganhar estrela. A página Favoritos mostra os marcados, na ordem
// em que foram marcados; com algum favorito, abrir o app leva direto para ela.

export const INDICADORES = [
  "gasto-mes",
  "gasto-medio-dia",
  "gasto-mes-anterior",
  "parcelas-a-pagar",
  "grafico-categorias",
  "grafico-diario",
  "lista-gastos",
  "guardado-mes",
  "guardado-mes-anterior",
  "lista-guardados",
] as const;

export type Indicador = (typeof INDICADORES)[number];

export const ehIndicador = (valor: unknown): valor is Indicador => INDICADORES.includes(valor as Indicador);

/** Favoritos do usuário, do mais antigo para o mais novo (rowid cresce a cada marcação). */
export async function listarFavoritos(usuarioId: number): Promise<Indicador[]> {
  const db = await prepararDb();
  const r = await db.execute({ sql: `SELECT indicador FROM favoritos WHERE usuario_id = ? ORDER BY rowid`, args: [usuarioId] });
  // um indicador que deixou de existir numa versão nova do app some da lista sem quebrar nada
  return r.rows.map((l) => l.indicador).filter(ehIndicador);
}

export async function temFavoritos(usuarioId: number): Promise<boolean> {
  return (await listarFavoritos(usuarioId)).length > 0;
}

/** Marca ou desmarca a estrela de um indicador (repetir a mesma ação não muda nada). */
export async function definirFavorito(usuarioId: number, indicador: Indicador, favorito: boolean): Promise<void> {
  const db = await prepararDb();
  await db.execute(
    favorito
      ? { sql: `INSERT OR IGNORE INTO favoritos (usuario_id, indicador) VALUES (?, ?)`, args: [usuarioId, indicador] }
      : { sql: `DELETE FROM favoritos WHERE usuario_id = ? AND indicador = ?`, args: [usuarioId, indicador] },
  );
}

/** Para onde vai quem abre o app ("/"): Favoritos se a pessoa marcou algum indicador, senão Gastos. */
export async function paginaInicial(usuarioId: number): Promise<"/favoritos" | "/gastos"> {
  return (await temFavoritos(usuarioId)) ? "/favoritos" : "/gastos";
}

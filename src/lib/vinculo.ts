import crypto from "node:crypto";
import { prepararDb } from "./db";
import { normalizarNumero } from "./telefone";
import type { Usuario } from "./usuarios";

// Vínculo entre a conta do site e o WhatsApp do usuário. O bot não consegue mandar mensagens
// (restrição da Meta), então o caminho é o inverso: o painel mostra um código e o usuário o envia
// ao bot ("vincular 482913"). Só quem tem aquele WhatsApp consegue mandar a mensagem, então
// isso também prova que o número é dele.

export const VALIDADE_CODIGO_MS = 30 * 60 * 1000;

/** "vincular 482913" (com ou sem espaços sobrando, maiúsculas ou minúsculas). */
export const PADRAO_VINCULAR = /^\s*vincular\s+(\d{6})\s*$/i;

export type EstadoWhatsapp = { telefone: string | null; codigo: string | null; expiraEm: number | null };

export async function estadoWhatsapp(usuarioId: number): Promise<EstadoWhatsapp> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT telefone, codigo_vinculo, codigo_expira_em FROM usuarios WHERE id = ?`,
    args: [usuarioId],
  });
  const l = r.rows[0];
  const valido = l?.codigo_vinculo != null && Number(l.codigo_expira_em) > Date.now();
  return {
    telefone: l?.telefone == null ? null : String(l.telefone),
    codigo: valido ? String(l.codigo_vinculo) : null,
    expiraEm: valido ? Number(l.codigo_expira_em) : null,
  };
}

/** Gera (ou troca) o código de 6 dígitos do usuário, válido por 30 minutos. */
export async function gerarCodigoVinculo(usuarioId: number): Promise<{ codigo: string; expiraEm: number }> {
  const db = await prepararDb();
  const expiraEm = Date.now() + VALIDADE_CODIGO_MS;
  for (let tentativa = 0; ; tentativa++) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await db.execute({
        sql: `UPDATE usuarios SET codigo_vinculo = ?, codigo_expira_em = ? WHERE id = ?`,
        args: [codigo, expiraEm, usuarioId],
      });
      return { codigo, expiraEm };
    } catch (erro) {
      // código já em uso por outro usuário (índice único): sorteia outro
      if (tentativa >= 5 || !String(erro).includes("UNIQUE")) throw erro;
    }
  }
}

export type ResultadoVinculo =
  | { tipo: "vinculado"; usuario: Usuario }
  | { tipo: "ja_vinculado"; usuario: Usuario }
  | { tipo: "codigo_invalido" };

/** Liga o telefone à conta dona do código. O código é de uso único. */
export async function vincularTelefone(codigo: string, telefone: string): Promise<ResultadoVinculo> {
  const db = await prepararDb();
  const numero = normalizarNumero(telefone);
  const atual = await db.execute({ sql: `SELECT id, email, nome FROM usuarios WHERE telefone = ?`, args: [numero] });
  if (atual.rows[0]) return { tipo: "ja_vinculado", usuario: paraUsuario(atual.rows[0]) };

  try {
    const r = await db.execute({
      sql: `UPDATE usuarios SET telefone = ?, codigo_vinculo = NULL, codigo_expira_em = NULL
            WHERE codigo_vinculo = ? AND codigo_expira_em > ?
            RETURNING id, email, nome`,
      args: [numero, codigo, Date.now()],
    });
    return r.rows[0] ? { tipo: "vinculado", usuario: paraUsuario(r.rows[0]) } : { tipo: "codigo_invalido" };
  } catch (erro) {
    // outra mensagem vinculou o mesmo número ao mesmo tempo (índice único do telefone)
    if (!String(erro).includes("UNIQUE")) throw erro;
    const dono = await db.execute({ sql: `SELECT id, email, nome FROM usuarios WHERE telefone = ?`, args: [numero] });
    return { tipo: "ja_vinculado", usuario: paraUsuario(dono.rows[0]) };
  }
}

export async function desvincularTelefone(usuarioId: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `UPDATE usuarios SET telefone = NULL WHERE id = ?`, args: [usuarioId] });
}

function paraUsuario(l: Record<string, unknown>): Usuario {
  return { id: Number(l.id), email: String(l.email), nome: String(l.nome) };
}

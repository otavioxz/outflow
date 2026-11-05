import crypto from "node:crypto";
import { prepararDb } from "./db";
import { normalizarNumero } from "./telefone";

// Convites de uso único gerados pelo admin no painel. Admin = a conta cujo WhatsApp vinculado está em
// MEU_NUMERO: vincular um número exige mandar o código daquele WhatsApp, então só o dono do celular vira admin.

export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

// Sem letras e números que se confundem (0/O, 1/I/L)
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type Convite = {
  codigo: string;
  criado_em: number;
  expira_em: number;
  usado_em: number | null;
  usado_por_nome: string | null;
};

/** O usuário é admin? (WhatsApp vinculado a um dos números de MEU_NUMERO) */
export async function ehAdmin(usuarioId: number): Promise<boolean> {
  const admins = (process.env.MEU_NUMERO ?? "").split(",").map(normalizarNumero).filter(Boolean);
  if (admins.length === 0) return false;
  const db = await prepararDb();
  const r = await db.execute({ sql: `SELECT telefone FROM usuarios WHERE id = ?`, args: [usuarioId] });
  const telefone = r.rows[0]?.telefone;
  return telefone != null && admins.includes(String(telefone));
}

/** Código no formato "K7QM-3XPA" (8 caracteres, ~40 bits). */
function sortearCodigo(): string {
  const c = Array.from({ length: 8 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Aceita o código digitado com espaço, sem hífen ou em minúsculas. */
export function normalizarCodigoConvite(texto: string): string {
  const c = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export async function gerarConvite(criadoPor: number): Promise<string> {
  const db = await prepararDb();
  const agora = Date.now();
  for (let tentativa = 0; ; tentativa++) {
    const codigo = sortearCodigo();
    try {
      await db.execute({
        sql: `INSERT INTO convites (codigo, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?)`,
        args: [codigo, criadoPor, agora, agora + VALIDADE_CONVITE_MS],
      });
      return codigo;
    } catch (erro) {
      if (tentativa >= 5 || !String(erro).includes("UNIQUE")) throw erro;
    }
  }
}

/** Convites que o admin gerou, do mais recente para o mais antigo. */
export async function listarConvites(criadoPor: number): Promise<Convite[]> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT c.codigo, c.criado_em, c.expira_em, c.usado_em, u.nome AS usado_por_nome
          FROM convites c LEFT JOIN usuarios u ON u.id = c.usado_por
          WHERE c.criado_por = ? ORDER BY c.criado_em DESC LIMIT 20`,
    args: [criadoPor],
  });
  return r.rows.map((l) => ({
    codigo: String(l.codigo),
    criado_em: Number(l.criado_em),
    expira_em: Number(l.expira_em),
    usado_em: l.usado_em == null ? null : Number(l.usado_em),
    usado_por_nome: l.usado_por_nome == null ? null : String(l.usado_por_nome),
  }));
}

/** Cancela um convite ainda não usado. */
export async function cancelarConvite(criadoPor: number, codigo: string): Promise<boolean> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM convites WHERE codigo = ? AND criado_por = ? AND usado_em IS NULL`,
    args: [codigo, criadoPor],
  });
  return r.rowsAffected > 0;
}

/**
 * Reserva o convite para um cadastro (atômico: dois cadastros ao mesmo tempo não usam o mesmo convite).
 * Retorna false se o código não existe, já foi usado ou venceu.
 */
export async function reservarConvite(codigo: string): Promise<boolean> {
  const db = await prepararDb();
  const agora = Date.now();
  const r = await db.execute({
    sql: `UPDATE convites SET usado_em = ? WHERE codigo = ? AND usado_em IS NULL AND expira_em > ?`,
    args: [agora, normalizarCodigoConvite(codigo), agora],
  });
  return r.rowsAffected > 0;
}

/** Depois que a conta foi criada: registra quem usou o convite. */
export async function concluirConvite(codigo: string, usuarioId: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `UPDATE convites SET usado_por = ? WHERE codigo = ?`, args: [usuarioId, normalizarCodigoConvite(codigo)] });
}

/** O cadastro falhou depois de reservar (ex.: e-mail repetido): o convite volta a valer. */
export async function liberarConvite(codigo: string): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `UPDATE convites SET usado_em = NULL WHERE codigo = ? AND usado_por IS NULL`,
    args: [normalizarCodigoConvite(codigo)],
  });
}

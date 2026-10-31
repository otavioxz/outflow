import crypto from "node:crypto";
import { promisify } from "node:util";
import { prepararDb } from "./db";

const scrypt = promisify(crypto.scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

export const DURACAO_SESSAO_DIAS = 30;

export type Usuario = { id: number; email: string; nome: string };

// ---------------------------------------------------------------------------
// Senhas: scrypt com sal aleatório, guardado como "scrypt$<sal>$<hash>" (base64url)

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(senha.normalize("NFKC"), sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function senhaConfere(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, sal, hash] = guardado.split("$");
  if (algoritmo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const calculado = await scrypt(senha.normalize("NFKC"), Buffer.from(sal, "base64url"), esperado.length);
  return crypto.timingSafeEqual(calculado, esperado);
}

// Usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados
const HASH_FALSO = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$" + Buffer.alloc(64).toString("base64url");

/** Retorna o usuário se e-mail e senha conferem. */
export async function autenticar(email: string, senha: string): Promise<Usuario | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT id, email, nome, senha_hash FROM usuarios WHERE email = ?`,
    args: [email.trim()],
  });
  const linha = r.rows[0];
  const ok = await senhaConfere(senha, linha ? String(linha.senha_hash) : HASH_FALSO);
  if (!linha || !ok) return null;
  return { id: Number(linha.id), email: String(linha.email), nome: String(linha.nome) };
}

// ---------------------------------------------------------------------------
// Sessões

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function criarSessao(usuarioId: number): Promise<{ token: string; expiraEm: Date }> {
  const db = await prepararDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000);
  await db.batch(
    [
      { sql: `DELETE FROM sessoes WHERE expira_em < ?`, args: [new Date().toISOString()] },
      {
        sql: `INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)`,
        args: [hashToken(token), usuarioId, expiraEm.toISOString()],
      },
    ],
    "write",
  );
  return { token, expiraEm };
}

export async function usuarioDaSessao(token: string): Promise<Usuario | null> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT u.id, u.email, u.nome FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.token_hash = ? AND s.expira_em > ?`,
    args: [hashToken(token), new Date().toISOString()],
  });
  const l = r.rows[0];
  return l ? { id: Number(l.id), email: String(l.email), nome: String(l.nome) } : null;
}

export async function encerrarSessao(token: string): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `DELETE FROM sessoes WHERE token_hash = ?`, args: [hashToken(token)] });
}

// ---------------------------------------------------------------------------
// Gestão de usuários (usada pelo comando npm run usuario)

export async function existeAlgumUsuario(): Promise<boolean> {
  const db = await prepararDb();
  const r = await db.execute(`SELECT 1 FROM usuarios LIMIT 1`);
  return r.rows.length > 0;
}

export async function listarUsuarios(): Promise<(Usuario & { criado_em: string })[]> {
  const db = await prepararDb();
  const r = await db.execute(`SELECT id, email, nome, criado_em FROM usuarios ORDER BY id`);
  return r.rows.map((l) => ({ id: Number(l.id), email: String(l.email), nome: String(l.nome), criado_em: String(l.criado_em) }));
}

export async function adicionarUsuario(email: string, nome: string, senha: string): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `INSERT INTO usuarios (email, nome, senha_hash) VALUES (?, ?, ?)`,
    args: [email.trim(), nome.trim(), await gerarHashSenha(senha)],
  });
}

/** Troca a senha e derruba todas as sessões abertas do usuário. */
export async function trocarSenha(email: string, senha: string): Promise<boolean> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `UPDATE usuarios SET senha_hash = ? WHERE email = ? RETURNING id`,
    args: [await gerarHashSenha(senha), email.trim()],
  });
  if (!r.rows[0]) return false;
  await db.execute({ sql: `DELETE FROM sessoes WHERE usuario_id = ?`, args: [r.rows[0].id] });
  return true;
}

export async function removerUsuario(email: string): Promise<boolean> {
  const db = await prepararDb();
  const r = await db.execute({ sql: `DELETE FROM usuarios WHERE email = ? RETURNING id`, args: [email.trim()] });
  if (!r.rows[0]) return false;
  await db.execute({ sql: `DELETE FROM sessoes WHERE usuario_id = ?`, args: [r.rows[0].id] });
  return true;
}

// ---------------------------------------------------------------------------
// Sessões de um usuário (página de configurações)

/** Quantas sessões válidas o usuário tem além da atual. */
export async function contarOutrasSessoes(usuarioId: number, tokenAtual: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = ? AND token_hash <> ? AND expira_em > ?`,
    args: [usuarioId, hashToken(tokenAtual), new Date().toISOString()],
  });
  return Number(r.rows[0].n);
}

/** Encerra todas as sessões do usuário, menos a atual. Retorna quantas foram encerradas. */
export async function encerrarOutrasSessoes(usuarioId: number, tokenAtual: string): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?`,
    args: [usuarioId, hashToken(tokenAtual)],
  });
  return r.rowsAffected;
}

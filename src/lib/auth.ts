import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prepararDb } from "./db";
import { COOKIE_SESSAO } from "./requisicao";
import { usuarioDaSessao, type Usuario } from "./usuarios";

/** Usuário logado na requisição atual, ou null. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token || token.length > 100) return null;
  return usuarioDaSessao(token);
}

/** Para páginas e server actions: manda para o login se não houver sessão válida. */
export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// ---------------------------------------------------------------------------
// Limite de tentativas de login, guardado no banco. Dois contadores por tentativa:
//  - por conta+IP: 5 erros em 15 min bloqueiam essa combinação por 15 min;
//  - por IP:       15 erros em 15 min bloqueiam o IP inteiro por 30 min (quem testa vários e-mails).

const JANELA_MS = 15 * 60 * 1000;
const REGRAS = {
  conta: { max: 5, bloqueioMs: 15 * 60 * 1000 },
  ip: { max: 15, bloqueioMs: 30 * 60 * 1000 },
} as const;

export const chavesLogin = (email: string, ip: string) => ({ conta: `conta:${email}|${ip}`, ip: `ip:${ip}` });

/** Minutos restantes de bloqueio (0 = liberado). */
export async function minutosBloqueado(chaves: ReturnType<typeof chavesLogin>): Promise<number> {
  const db = await prepararDb();
  const r = await db.execute({
    sql: `SELECT MAX(bloqueado_ate) AS ate FROM tentativas_login WHERE chave IN (?, ?)`,
    args: [chaves.conta, chaves.ip],
  });
  const restante = Number(r.rows[0]?.ate ?? 0) - Date.now();
  return restante > 0 ? Math.ceil(restante / 60000) : 0;
}

/** Conta um erro de senha. Retorna true se este erro acabou de causar um bloqueio. */
export async function registrarErro(chaves: ReturnType<typeof chavesLogin>): Promise<boolean> {
  const db = await prepararDb();
  const agora = Date.now();
  let bloqueou = false;
  for (const tipo of ["conta", "ip"] as const) {
    const { max, bloqueioMs } = REGRAS[tipo];
    const r = await db.execute({
      sql: `INSERT INTO tentativas_login (chave, erros, primeira_em) VALUES (?, 1, ?)
            ON CONFLICT(chave) DO UPDATE SET
              erros = CASE WHEN primeira_em < ? THEN 1 ELSE erros + 1 END,
              primeira_em = CASE WHEN primeira_em < ? THEN excluded.primeira_em ELSE primeira_em END
            RETURNING erros`,
      args: [chaves[tipo], agora, agora - JANELA_MS, agora - JANELA_MS],
    });
    if (Number(r.rows[0].erros) >= max) {
      await db.execute({
        sql: `UPDATE tentativas_login SET bloqueado_ate = ?, erros = 0, primeira_em = ? WHERE chave = ?`,
        args: [agora + bloqueioMs, agora, chaves[tipo]],
      });
      bloqueou = true;
    }
  }
  // limpeza ocasional de registros antigos
  if (Math.random() < 0.05) {
    await db.execute({
      sql: `DELETE FROM tentativas_login WHERE primeira_em < ? AND bloqueado_ate < ?`,
      args: [agora - JANELA_MS, agora],
    });
  }
  return bloqueou;
}

export async function limparErros(chaves: ReturnType<typeof chavesLogin>): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `DELETE FROM tentativas_login WHERE chave = ?`, args: [chaves.conta] });
}

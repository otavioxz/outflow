import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usuarioDaSessao, type Usuario } from "./usuarios";

export const COOKIE_SESSAO = "sessao";

/** Usuário logado na requisição atual, ou null. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return usuarioDaSessao(token);
}

/** Para páginas e server actions: manda para o login se não houver sessão válida. */
export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// ---------------------------------------------------------------------------
// Limite de tentativas de login: 5 erros seguidos por e-mail+IP bloqueiam por 15 minutos.
// Fica em memória: reinicia junto com o servidor, o que é suficiente para uso pessoal.

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { erros: number; ate: number }>();

export function minutosBloqueado(chave: string): number {
  const t = tentativas.get(chave);
  if (!t || t.erros < MAX_TENTATIVAS) return 0;
  const restante = t.ate - Date.now();
  if (restante <= 0) {
    tentativas.delete(chave);
    return 0;
  }
  return Math.ceil(restante / 60000);
}

export function registrarErro(chave: string): void {
  const t = tentativas.get(chave) ?? { erros: 0, ate: 0 };
  t.erros += 1;
  t.ate = Date.now() + BLOQUEIO_MS;
  tentativas.set(chave, t);
}

export function limparErros(chave: string): void {
  tentativas.delete(chave);
}

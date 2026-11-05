import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, EM_PRODUCAO } from "./requisicao";
import { usuarioDaSessao, type Usuario } from "./usuarios";

/** Usuário logado na requisição atual, ou null. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token || token.length > 100) return null;
  return usuarioDaSessao(token);
}

/** Grava o cookie da sessão no navegador (httpOnly, só HTTPS em produção). */
export async function definirCookieSessao(token: string, expiraEm: Date): Promise<void> {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: EM_PRODUCAO,
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

/** Token da sessão atual (do cookie), ou undefined. */
export async function tokenAtual(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESSAO)?.value;
}

/** Para páginas e server actions: manda para o login se não houver sessão válida. */
export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// Limite de tentativas de login (fica em limite-tentativas.ts para o bot também usar)
export { chavesCadastro, chavesLogin, limparErros, minutosBloqueado, registrarErro } from "./limite-tentativas";

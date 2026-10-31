"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, limparErros, minutosBloqueado, registrarErro } from "@/lib/auth";
import { autenticar, criarSessao, encerrarSessao } from "@/lib/usuarios";

export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Preencha e-mail e senha.", email };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const chave = `${email}|${ip}`;
  const bloqueio = minutosBloqueado(chave);
  if (bloqueio) return { erro: `Muitas tentativas. Tente de novo em ${bloqueio} min.`, email };

  const usuario = await autenticar(email, senha);
  if (!usuario) {
    registrarErro(chave);
    return { erro: "E-mail ou senha incorretos.", email };
  }

  limparErros(chave);
  const { token, expiraEm } = await criarSessao(usuario.id);
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });

  redirect("/");
}

export async function sair(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await encerrarSessao(token);
  jar.delete(COOKIE_SESSAO);
  redirect("/login");
}

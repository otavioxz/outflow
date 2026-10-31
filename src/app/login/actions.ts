"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { chavesLogin, limparErros, minutosBloqueado, registrarErro } from "@/lib/auth";
import { registrarEvento } from "@/lib/log-discord";
import { COOKIE_SESSAO, EM_PRODUCAO, contextoRequisicao } from "@/lib/requisicao";
import { autenticar, criarSessao, encerrarSessao, usuarioDaSessao } from "@/lib/usuarios";

export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const senha = String(formData.get("senha") ?? "").slice(0, 200);
  if (!email || !senha) return { erro: "Preencha e-mail e senha.", email };

  const ctx = await contextoRequisicao();
  const chaves = chavesLogin(email, ctx.ip);

  const bloqueio = await minutosBloqueado(chaves);
  if (bloqueio) {
    after(() =>
      registrarEvento({
        titulo: "Tentativa de login durante bloqueio",
        nivel: "alerta",
        campos: { "E-mail tentado": email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
        agrupar: `bloqueado:${ctx.ip}`,
      }),
    );
    return { erro: `Muitas tentativas. Tente de novo em ${bloqueio} min.`, email };
  }

  const usuario = await autenticar(email, senha);
  if (!usuario) {
    const bloqueou = await registrarErro(chaves);
    after(() =>
      registrarEvento(
        bloqueou
          ? {
              titulo: "Login bloqueado por excesso de tentativas",
              nivel: "perigo",
              campos: { "E-mail tentado": email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
            }
          : {
              titulo: "Falha de login",
              nivel: "alerta",
              campos: { "E-mail tentado": email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
              agrupar: `falha:${ctx.ip}`,
            },
      ),
    );
    return { erro: "E-mail ou senha incorretos.", email };
  }

  await limparErros(chaves);
  const { token, expiraEm } = await criarSessao(usuario.id);
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: EM_PRODUCAO,
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });

  after(() =>
    registrarEvento({
      titulo: "Login realizado",
      nivel: "sucesso",
      campos: { Usuário: `${usuario.nome} <${usuario.email}>`, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
    }),
  );
  redirect("/");
}

export async function sair(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) {
    const usuario = await usuarioDaSessao(token);
    await encerrarSessao(token);
    if (usuario) {
      const ctx = await contextoRequisicao();
      after(() =>
        registrarEvento({
          titulo: "Logout",
          nivel: "info",
          campos: { Usuário: `${usuario.nome} <${usuario.email}>`, IP: ctx.ip },
        }),
      );
    }
  }
  // expira o cookie com os mesmos atributos (o prefixo __Host- exige secure e path=/ também para apagar)
  jar.set(COOKIE_SESSAO, "", { httpOnly: true, secure: EM_PRODUCAO, sameSite: "lax", path: "/", maxAge: 0 });
  redirect("/login");
}

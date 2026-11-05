"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { chavesCadastro, definirCookieSessao, limparErros, minutosBloqueado, registrarErro } from "@/lib/auth";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";
import { adicionarUsuario, criarSessao, emailCadastrado, problemaNaSenha } from "@/lib/usuarios";
import { segredoConfere } from "@/lib/whatsapp";

export type EstadoCadastro = { erro?: string; nome?: string; email?: string; convite?: string };

/** Cadastro só com o código de convite (CODIGO_CONVITE). Sem ele configurado, o cadastro fica fechado. */
export async function cadastrar(_anterior: EstadoCadastro, formData: FormData): Promise<EstadoCadastro> {
  const nome = String(formData.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const senha = String(formData.get("senha") ?? "").slice(0, 200);
  const confirmacao = String(formData.get("confirmacao") ?? "").slice(0, 200);
  const convite = String(formData.get("convite") ?? "").trim().slice(0, 100);
  const valores = { nome, email, convite };

  const conviteEsperado = process.env.CODIGO_CONVITE;
  if (!conviteEsperado) return { ...valores, erro: "O cadastro está fechado no momento." };

  if (!nome || !email || !senha || !convite) return { ...valores, erro: "Preencha todos os campos." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ...valores, erro: "E-mail inválido." };
  const problema = problemaNaSenha(senha);
  if (problema) return { ...valores, erro: problema };
  if (senha !== confirmacao) return { ...valores, erro: "A confirmação não confere com a senha." };

  const ctx = await contextoRequisicao();
  const chaves = chavesCadastro(ctx.ip);
  const bloqueio = await minutosBloqueado(chaves);
  if (bloqueio) return { ...valores, erro: `Muitas tentativas. Tente de novo em ${bloqueio} min.` };

  if (!segredoConfere(convite, conviteEsperado)) {
    await registrarErro(chaves);
    after(() =>
      registrarEvento({
        titulo: "Cadastro com código de convite errado",
        nivel: "alerta",
        campos: { "E-mail": email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
        agrupar: `convite:${ctx.ip}`,
      }),
    );
    return { ...valores, convite: "", erro: "Código de convite inválido." };
  }

  if (await emailCadastrado(email)) return { ...valores, erro: "Já existe uma conta com esse e-mail. Entre pela tela de login." };

  let usuarioId: number;
  try {
    usuarioId = await adicionarUsuario(email, nome, senha);
  } catch (erro) {
    if (String(erro).includes("UNIQUE")) return { ...valores, erro: "Já existe uma conta com esse e-mail. Entre pela tela de login." };
    throw erro;
  }
  await limparErros(chaves);
  const { token, expiraEm } = await criarSessao(usuarioId);
  await definirCookieSessao(token, expiraEm);

  after(() =>
    registrarEvento({
      titulo: "Nova conta criada",
      nivel: "sucesso",
      campos: { Usuário: `${nome} <${email}>`, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
    }),
  );
  // próximo passo: ligar o WhatsApp à conta
  redirect("/configuracoes#whatsapp");
}

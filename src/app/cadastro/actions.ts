"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { chavesCadastro, definirCookieSessao, limparErros, minutosBloqueado, registrarErro } from "@/lib/auth";
import { concluirConvite, liberarConvite, reservarConvite } from "@/lib/convites";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";
import { adicionarUsuario, criarSessao, emailCadastrado, problemaNaSenha } from "@/lib/usuarios";
import { segredoConfere } from "@/lib/whatsapp";

export type EstadoCadastro = { erro?: string; nome?: string; email?: string; convite?: string };

/** Cadastro só com convite: o código fixo CODIGO_CONVITE (opcional) ou um convite de uso único gerado pelo admin. */
export async function cadastrar(_anterior: EstadoCadastro, formData: FormData): Promise<EstadoCadastro> {
  const nome = String(formData.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const senha = String(formData.get("senha") ?? "").slice(0, 200);
  const confirmacao = String(formData.get("confirmacao") ?? "").slice(0, 200);
  const convite = String(formData.get("convite") ?? "").trim().slice(0, 100);
  const valores = { nome, email, convite };

  if (!nome || !email || !senha || !convite) return { ...valores, erro: "Preencha todos os campos." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ...valores, erro: "E-mail inválido." };
  const problema = problemaNaSenha(senha);
  if (problema) return { ...valores, erro: problema };
  if (senha !== confirmacao) return { ...valores, erro: "A confirmação não confere com a senha." };

  const ctx = await contextoRequisicao();
  const chaves = chavesCadastro(ctx.ip);
  const bloqueio = await minutosBloqueado(chaves);
  if (bloqueio) return { ...valores, erro: `Muitas tentativas. Tente de novo em ${bloqueio} min.` };

  // e-mail repetido é checado antes, para não gastar o convite à toa
  if (await emailCadastrado(email)) return { ...valores, erro: "Já existe uma conta com esse e-mail. Entre pela tela de login." };

  // Vale o código fixo da Vercel (CODIGO_CONVITE) ou um convite de uso único gerado no painel do admin
  const valeCodigoFixo = segredoConfere(convite, process.env.CODIGO_CONVITE);
  const conviteDoPainel = !valeCodigoFixo && (await reservarConvite(convite));
  if (!valeCodigoFixo && !conviteDoPainel) {
    await registrarErro(chaves);
    after(() =>
      registrarEvento({
        titulo: "Cadastro com código de convite errado",
        nivel: "alerta",
        campos: { "E-mail": email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
        agrupar: `convite:${ctx.ip}`,
      }),
    );
    return { ...valores, convite: "", erro: "Código de convite inválido, já usado ou vencido." };
  }

  let usuarioId: number;
  try {
    usuarioId = await adicionarUsuario(email, nome, senha);
  } catch (erro) {
    if (conviteDoPainel) await liberarConvite(convite);
    if (String(erro).includes("UNIQUE")) return { ...valores, erro: "Já existe uma conta com esse e-mail. Entre pela tela de login." };
    throw erro;
  }
  if (conviteDoPainel) await concluirConvite(convite, usuarioId);
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

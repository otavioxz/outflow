"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { chavesLogin, definirCookieSessao, exigirUsuario, limparErros, minutosBloqueado, registrarErro, tokenAtual } from "@/lib/auth";
import { formatarReais, lerReais } from "@/lib/categorias";
import {
  definirMetaGuardadoCentavos,
  definirOrcamentoCentavos,
  obterMetaGuardadoCentavos,
  obterOrcamentoCentavos,
} from "@/lib/configuracoes";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";
import { autenticar, criarSessao, encerrarOutrasSessoes, problemaNaSenha, trocarSenha } from "@/lib/usuarios";
import { desvincularTelefone, gerarCodigoVinculo } from "@/lib/vinculo";

export type Estado = { erro?: string; ok?: string };

export async function salvarOrcamento(_: Estado, formData: FormData): Promise<Estado> {
  const usuario = await exigirUsuario();
  const centavos = lerReais(String(formData.get("orcamento") ?? "").slice(0, 30));
  if (centavos === null) return { erro: "Valor inválido. Use algo como 3.000,00." };
  if (centavos > 100_000_000_00) return { erro: "Valor alto demais." };

  const anterior = await obterOrcamentoCentavos(usuario.id);
  await definirOrcamentoCentavos(usuario.id, centavos);
  revalidatePath("/");
  revalidatePath("/configuracoes");

  const descrever = (c: number) => (c ? formatarReais(c) : "sem orçamento");
  after(() =>
    registrarEvento({
      titulo: "Orçamento mensal alterado",
      nivel: "info",
      campos: { Usuário: usuario.email, De: descrever(anterior), Para: descrever(centavos) },
    }),
  );
  return { ok: centavos ? `Orçamento salvo: ${formatarReais(centavos)} por mês.` : "Orçamento removido." };
}

export async function salvarMetaGuardado(_: Estado, formData: FormData): Promise<Estado> {
  const usuario = await exigirUsuario();
  const centavos = lerReais(String(formData.get("meta") ?? "").slice(0, 30));
  if (centavos === null) return { erro: "Valor inválido. Use algo como 500,00." };
  if (centavos > 100_000_000_00) return { erro: "Valor alto demais." };

  const anterior = await obterMetaGuardadoCentavos(usuario.id);
  await definirMetaGuardadoCentavos(usuario.id, centavos);
  revalidatePath("/");
  revalidatePath("/configuracoes");

  const descrever = (c: number) => (c ? formatarReais(c) : "sem meta");
  after(() =>
    registrarEvento({
      titulo: "Meta de guardar por mês alterada",
      nivel: "info",
      campos: { Usuário: usuario.email, De: descrever(anterior), Para: descrever(centavos) },
    }),
  );
  return { ok: centavos ? `Meta salva: guardar ${formatarReais(centavos)} por mês.` : "Meta removida." };
}

export async function alterarSenha(_: Estado, formData: FormData): Promise<Estado> {
  const usuario = await exigirUsuario();
  const atual = String(formData.get("atual") ?? "").slice(0, 200);
  const nova = String(formData.get("nova") ?? "").slice(0, 200);
  const confirmacao = String(formData.get("confirmacao") ?? "").slice(0, 200);

  const ctx = await contextoRequisicao();
  const chaves = chavesLogin(usuario.email.toLowerCase(), ctx.ip);
  const bloqueio = await minutosBloqueado(chaves);
  if (bloqueio) return { erro: `Muitas tentativas. Tente de novo em ${bloqueio} min.` };

  if (!(await autenticar(usuario.email, atual))) {
    await registrarErro(chaves);
    after(() =>
      registrarEvento({
        titulo: "Senha atual errada ao tentar trocar a senha",
        nivel: "alerta",
        campos: { Usuário: usuario.email, IP: ctx.ip, Navegador: ctx.navegador },
      }),
    );
    return { erro: "Senha atual incorreta." };
  }
  const problema = problemaNaSenha(nova);
  if (problema) return { erro: problema };
  if (nova === atual) return { erro: "A nova senha precisa ser diferente da atual." };
  if (nova !== confirmacao) return { erro: "A confirmação não confere com a nova senha." };

  await limparErros(chaves);
  // Trocar a senha encerra todas as sessões; abrimos uma nova para você continuar logado aqui
  await trocarSenha(usuario.email, nova);
  const { token, expiraEm } = await criarSessao(usuario.id);
  await definirCookieSessao(token, expiraEm);

  after(() =>
    registrarEvento({
      titulo: "Senha alterada pelo painel",
      nivel: "alerta",
      campos: { Usuário: usuario.email, IP: ctx.ip, Navegador: ctx.navegador, Local: ctx.local },
    }),
  );
  revalidatePath("/configuracoes");
  return { ok: "Senha alterada. Os outros dispositivos foram desconectados." };
}

export async function encerrarOutrasSessoesAction(_: Estado): Promise<Estado> {
  const usuario = await exigirUsuario();
  const token = await tokenAtual();
  if (!token) return { erro: "Sessão inválida." };

  const encerradas = await encerrarOutrasSessoes(usuario.id, token);
  const ctx = await contextoRequisicao();
  after(() =>
    registrarEvento({
      titulo: "Outras sessões encerradas",
      nivel: "info",
      campos: { Usuário: usuario.email, Encerradas: encerradas, IP: ctx.ip },
    }),
  );
  revalidatePath("/configuracoes");
  return { ok: encerradas ? `${encerradas} sessão(ões) encerrada(s).` : "Nenhuma outra sessão estava aberta." };
}

export async function gerarCodigoWhatsappAction(_: Estado): Promise<Estado> {
  const usuario = await exigirUsuario();
  await gerarCodigoVinculo(usuario.id);
  revalidatePath("/configuracoes");
  return {};
}

export async function desvincularWhatsappAction(_: Estado): Promise<Estado> {
  const usuario = await exigirUsuario();
  await desvincularTelefone(usuario.id);
  const ctx = await contextoRequisicao();
  after(() =>
    registrarEvento({
      titulo: "WhatsApp desvinculado pelo painel",
      nivel: "info",
      campos: { Usuário: usuario.email, IP: ctx.ip },
    }),
  );
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: "WhatsApp desvinculado. As mensagens desse número não serão mais registradas." };
}

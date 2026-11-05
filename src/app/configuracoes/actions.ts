"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { chavesLogin, definirCookieSessao, exigirUsuario, limparErros, minutosBloqueado, registrarErro, tokenAtual } from "@/lib/auth";
import { formatarReais } from "@/lib/categorias";
import {
  definirMetaGuardadoCentavos,
  definirOrcamentoCentavos,
  obterMetaGuardadoCentavos,
  obterOrcamentoCentavos,
} from "@/lib/configuracoes";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";
import { autenticar, criarSessao, encerrarOutrasSessoes, trocarSenha } from "@/lib/usuarios";

export type Estado = { erro?: string; ok?: string };

/** Converte "3.000,50", "R$ 3000", "3000.50" em centavos. null = inválido. */
function lerReais(texto: string): number | null {
  let t = texto.replace(/r\$|\s/gi, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "3.000" = três mil
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export async function salvarOrcamento(_: Estado, formData: FormData): Promise<Estado> {
  const usuario = await exigirUsuario();
  const centavos = lerReais(String(formData.get("orcamento") ?? "").slice(0, 30));
  if (centavos === null) return { erro: "Valor inválido. Use algo como 3.000,00." };
  if (centavos > 100_000_000_00) return { erro: "Valor alto demais." };

  const anterior = await obterOrcamentoCentavos();
  await definirOrcamentoCentavos(centavos);
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

  const anterior = await obterMetaGuardadoCentavos();
  await definirMetaGuardadoCentavos(centavos);
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
  if (nova.length < 12) return { erro: "A nova senha precisa ter pelo menos 12 caracteres." };
  if (/^(.)\1+$/.test(nova) || /^(0?123456789|senha|password|qwerty)/i.test(nova))
    return { erro: "Essa senha é fácil demais de adivinhar." };
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

import type { Instrumentation } from "next";

/** Problemas de configuração que deixam o app inseguro quando publicado. */
function verificarConfiguracao(): { erros: string[]; avisos: string[] } {
  const e = process.env;
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!e.VERIFY_TOKEN || e.VERIFY_TOKEN === "invente-uma-senha-aqui" || e.VERIFY_TOKEN.length < 16)
    erros.push("VERIFY_TOKEN ausente, padrão ou curto demais (use 16+ caracteres aleatórios)");
  if (e.WHATSAPP_TOKEN && !e.APP_SECRET) erros.push("APP_SECRET ausente: o webhook vai recusar tudo");
  if (e.CODIGO_CONVITE && e.CODIGO_CONVITE.length < 8)
    erros.push("CODIGO_CONVITE curto demais: qualquer um poderia adivinhar e criar uma conta (use 8+ caracteres)");
  if (!e.DATABASE_URL || e.DATABASE_URL.startsWith("file:")) {
    if (e.VERCEL) erros.push("DATABASE_URL ausente ou arquivo local: na Vercel o disco é só leitura. Configure o Turso (libsql://...).");
    else avisos.push("DATABASE_URL é um arquivo local: em hospedagens serverless (Vercel) os dados se perdem. Use o Turso.");
  } else if (!e.DATABASE_AUTH_TOKEN) {
    erros.push("DATABASE_AUTH_TOKEN ausente: o Turso vai recusar a conexão");
  }
  if (!e.DISCORD_WEBHOOK_URL) avisos.push("DISCORD_WEBHOOK_URL ausente: logs de acesso só no console");
  if (!e.WHATSAPP_TOKEN) avisos.push("WHATSAPP_TOKEN ausente: o webhook do WhatsApp fica desligado");

  return { erros, avisos };
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const { registrarEvento } = await import("./lib/log-discord");
  const { erros, avisos } = verificarConfiguracao();
  for (const erro of erros) console.error(`[segurança] ${erro}`);
  for (const aviso of avisos) console.warn(`[segurança] ${aviso}`);

  // Na Vercel cada "partida a frio" de uma função conta como início de servidor (várias por dia):
  // lá só avisamos no Discord quando há erro de configuração; avisos ficam só nos logs da Vercel.
  if (process.env.VERCEL && erros.length === 0) return;

  await registrarEvento({
    titulo: erros.length ? "Servidor iniciado com configuração insegura" : "Servidor iniciado",
    nivel: erros.length ? "perigo" : avisos.length ? "alerta" : "sucesso",
    campos: {
      ...(erros.length ? { Problemas: erros.join(" | ") } : {}),
      ...(avisos.length ? { Avisos: avisos.join(" | ") } : {}),
    },
  });
}

// Erros inesperados no servidor também vão para o log (agrupados por rota para não inundar o canal)
export const onRequestError: Instrumentation.onRequestError = async (erro, request, contexto) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarEvento } = await import("./lib/log-discord");
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  await registrarEvento({
    titulo: "Erro no servidor",
    nivel: "perigo",
    campos: {
      Rota: `${request.method} ${request.path}`,
      Tipo: contexto.routeType,
      Erro: mensagem.slice(0, 300),
    },
    agrupar: `erro:${request.path.split("?")[0]}`,
  });
};

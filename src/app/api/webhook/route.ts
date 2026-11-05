import { after } from "next/server";
import { processarMensagem, type Resultado } from "@/lib/bot";
import { concluirAtividade, iniciarAtividade, type StatusAtividade } from "@/lib/atividades";
import { marcarMensagemProcessada } from "@/lib/gastos";
import { mascararTelefone, registrarEvento, type Evento } from "@/lib/log-discord";
import { ipDe } from "@/lib/requisicao";
import {
  assinaturaValida,
  enviarTexto,
  extrairMensagens,
  modoSimulacao,
  remetentePermitido,
  segredoConfere,
  type WebhookPayload,
} from "@/lib/whatsapp";

const TAMANHO_MAXIMO = 512 * 1024; // mensagens da Meta têm poucos KB

// Verificação do webhook: a Meta chama este GET uma vez quando você salva a URL no painel
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && segredoConfere(params.get("hub.verify_token"), process.env.VERIFY_TOKEN)) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// Recebimento das mensagens
export async function POST(request: Request) {
  const ip = ipDe(request.headers);

  if (!modoSimulacao() && (!process.env.WHATSAPP_TOKEN || !process.env.APP_SECRET)) {
    after(() =>
      registrarEvento({
        titulo: "Webhook recebeu mensagem, mas o WhatsApp não está configurado",
        nivel: "alerta",
        campos: { Falta: [!process.env.WHATSAPP_TOKEN && "WHATSAPP_TOKEN", !process.env.APP_SECRET && "APP_SECRET"].filter(Boolean).join(", "), IP: ip },
        agrupar: "webhook-sem-config",
      }),
    );
    return new Response("Serviço não configurado", { status: 503 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO) {
    return new Response("Payload grande demais", { status: 413 });
  }
  const corpo = await request.text();
  if (corpo.length > TAMANHO_MAXIMO) return new Response("Payload grande demais", { status: 413 });

  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"))) {
    after(() =>
      registrarEvento({
        titulo: "Webhook com assinatura inválida (não veio da Meta)",
        nivel: "perigo",
        campos: { IP: ip, Navegador: request.headers.get("user-agent")?.slice(0, 120) },
        agrupar: `assinatura:${ip}`,
      }),
    );
    return new Response("Assinatura inválida", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(corpo) as WebhookPayload;
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const respostas: string[] = [];

  // Eventos de status (entregue/lido) não têm "messages" e são ignorados
  for (const msg of extrairMensagens(payload)) {
    if (typeof msg?.id !== "string" || typeof msg?.from !== "string") continue;

    if (!remetentePermitido(msg.from)) {
      after(() =>
        registrarEvento({
          titulo: "Mensagem de número não autorizado ignorada",
          nivel: "alerta",
          campos: { Número: mascararTelefone(msg.from), Tipo: msg.type },
          agrupar: `numero:${msg.from}`,
        }),
      );
      continue;
    }
    if (!(await marcarMensagemProcessada(msg.id))) continue; // reenvio da Meta

    // O painel aberto mostra "processando…" enquanto transcreve/interpreta
    const origem = msg.type === "audio" ? "audio" : msg.type === "text" ? "texto" : msg.type === "image" || msg.type === "document" ? "nota" : "outro";
    const atividade = await iniciarAtividade(msg.id, origem).catch(
      () => null, // o aviso na tela é um extra: se falhar, o gasto continua sendo registrado
    );

    let resultado: Resultado;
    let falhou = false;
    try {
      resultado = await processarMensagem(msg);
    } catch (erro) {
      falhou = true;
      console.error("Erro ao processar mensagem:", erro);
      const motivo = erro instanceof Error ? erro.message : String(erro);
      after(() =>
        registrarEvento({
          titulo: "Erro ao processar mensagem do WhatsApp",
          nivel: "perigo",
          campos: { De: mascararTelefone(msg.from), Mensagem: msg.text?.body ?? `(${msg.type})`, Erro: motivo.slice(0, 500) },
        }),
      );
      resultado = { tipo: "sem_gasto", origem: "texto", resposta: "😕 Tive um problema para registrar isso. Tente de novo em instantes." };
    }

    if (atividade !== null) {
      const [status, titulo, detalhe] = falhou
        ? (["erro", "Erro ao registrar a mensagem", "Tente de novo em instantes."] as const)
        : resumoParaPainel(resultado);
      await concluirAtividade(atividade, status, titulo, detalhe).catch(() => {});
    }

    // O resultado sempre vai para o Discord; a resposta no WhatsApp só se RESPONDER_NO_WHATSAPP=true
    after(() => registrarEvento(eventoDoResultado(resultado, msg.from)));
    if (process.env.RESPONDER_NO_WHATSAPP === "true") await enviarTexto(msg.from, resultado.resposta);
    respostas.push(resultado.resposta);
  }

  // A Meta ignora o corpo da resposta; no modo simulação devolvemos as respostas para o simulador
  return Response.json(modoSimulacao() ? { respostas } : { ok: true });
}

/** Título e detalhe curtos do aviso que aparece no painel. */
function resumoParaPainel(r: Resultado): [Exclude<StatusAtividade, "processando">, string, string | undefined] {
  const limpar = (s: string) => s.replace(/\*/g, "").trim();
  switch (r.tipo) {
    case "gasto": {
      const linhas = r.resposta.split("\n");
      const gastos = linhas.filter((l) => l.startsWith("✅")).map((l) => limpar(l.replace(/^✅\s*/, "")));
      const guardados = linhas.filter((l) => l.startsWith("🐷 Guardado ")).map((l) => limpar(l.replace(/^🐷\s*/, "")));
      const titulo =
        gastos.length && guardados.length
          ? `${gastos.length + guardados.length} lançamentos registrados`
          : guardados.length
            ? "Valor guardado"
            : r.origem === "nota"
              ? "Nota fiscal registrada"
            : gastos.length > 1
              ? `${gastos.length} gastos registrados`
              : "Gasto registrado";
      return ["gasto", titulo, [...gastos, ...guardados].join("\n")];
    }
    case "comando":
      return ["comando", `Comando recebido: ${r.comando}`, r.comando === "desfazer" ? limpar(r.resposta) : undefined];
    case "sem_gasto":
      return ["sem_gasto", "Não encontrei um gasto na mensagem", r.texto ? `“${r.texto}”` : limpar(r.resposta)];
    case "ignorada":
      return ["sem_gasto", "Mensagem não processada", limpar(r.resposta)];
  }
}

function eventoDoResultado(r: Resultado, de: string): Evento {
  const titulos: Record<Resultado["tipo"], [string, Evento["nivel"]]> = {
    gasto: ["Lançamento registrado pelo WhatsApp", "sucesso"],
    comando: [`Comando do WhatsApp: ${r.comando ?? ""}`, "info"],
    sem_gasto: ["Mensagem sem gasto identificado", "alerta"],
    ignorada: ["Mensagem do WhatsApp não processada", "alerta"],
  };
  const [titulo, nivel] = titulos[r.tipo];
  return {
    titulo,
    nivel,
    campos: {
      De: mascararTelefone(de),
      Origem: r.origem === "audio" ? "áudio" : r.origem === "nota" ? "foto de nota fiscal" : "texto",
      Mensagem: r.texto,
      Resultado: r.resposta.replace(/\*/g, ""),
    },
  };
}

import { processarMensagem } from "@/lib/bot";
import { marcarMensagemProcessada } from "@/lib/gastos";
import {
  assinaturaValida,
  enviarTexto,
  extrairMensagens,
  modoSimulacao,
  remetentePermitido,
  type WebhookPayload,
} from "@/lib/whatsapp";

// Verificação do webhook: a Meta chama este GET uma vez quando você salva a URL no painel
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === process.env.VERIFY_TOKEN) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Recebimento das mensagens
export async function POST(request: Request) {
  const corpo = await request.text();
  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  const payload = JSON.parse(corpo) as WebhookPayload;
  const respostas: string[] = [];

  // Eventos de status (entregue/lido) não têm "messages" e são ignorados
  for (const msg of extrairMensagens(payload)) {
    if (!remetentePermitido(msg.from)) continue;
    if (!(await marcarMensagemProcessada(msg.id))) continue; // reenvio da Meta

    let resposta: string;
    try {
      resposta = await processarMensagem(msg);
    } catch (erro) {
      console.error("Erro ao processar mensagem:", erro);
      resposta = "😕 Tive um problema para registrar isso. Tente de novo em instantes.";
    }
    await enviarTexto(msg.from, resposta);
    respostas.push(resposta);
  }

  // A Meta ignora o corpo da resposta; no modo simulação devolvemos as respostas para o simulador
  return Response.json(modoSimulacao() ? { respostas } : { ok: true });
}

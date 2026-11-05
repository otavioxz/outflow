import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { numeroParaEnvio } from "./telefone";

// Formato (simplificado) do corpo que a Meta envia ao webhook
export type WebhookPayload = {
  object: string;
  entry?: {
    changes?: {
      value?: {
        messages?: MensagemWhatsApp[];
      };
    }[];
  }[];
};

export type MensagemWhatsApp = {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "audio" | string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; caption?: string; filename?: string };
};

const GRAPH = () => `https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v23.0"}`;

/**
 * Sem WHATSAPP_TOKEN o app roda em modo simulação: nada é enviado para a Meta e o webhook devolve
 * as respostas no corpo. Isso só existe fora de produção: online, o webhook exige a Meta de verdade.
 */
export function modoSimulacao(): boolean {
  return !process.env.WHATSAPP_TOKEN && process.env.NODE_ENV !== "production";
}

/** Compara dois segredos em tempo constante (não revela quantos caracteres batem). */
export function segredoConfere(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = crypto.createHash("sha256").update(recebido).digest();
  const b = crypto.createHash("sha256").update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

export function extrairMensagens(payload: WebhookPayload): MensagemWhatsApp[] {
  return (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
}

/** Confere o header X-Hub-Signature-256 para garantir que a requisição veio da Meta. */
export function assinaturaValida(corpo: string, assinatura: string | null): boolean {
  const segredo = process.env.APP_SECRET;
  if (!segredo) return modoSimulacao(); // sem segredo, só aceitamos em modo simulação
  if (!assinatura) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", segredo).update(corpo).digest("hex");
  return assinatura.length === esperado.length && crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado));
}

let numeroBot: Promise<string | null> | undefined;

/** Número do WhatsApp do Outflow (o do PHONE_NUMBER_ID), só dígitos. null se não der para consultar. */
export function numeroDoBot(): Promise<string | null> {
  if (process.env.WHATSAPP_NUMERO_BOT) return Promise.resolve(process.env.WHATSAPP_NUMERO_BOT.replace(/\D/g, ""));
  if (modoSimulacao() || !process.env.PHONE_NUMBER_ID) return Promise.resolve(null);
  numeroBot ??= fetch(`${GRAPH()}/${process.env.PHONE_NUMBER_ID}?fields=display_phone_number`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    signal: AbortSignal.timeout(3000),
  })
    .then(async (r) => (r.ok ? ((await r.json()) as { display_phone_number?: string }).display_phone_number?.replace(/\D/g, "") || null : null))
    .catch(() => null)
    .then((n) => {
      if (!n) numeroBot = undefined; // falhou: tenta de novo na próxima vez
      return n;
    });
  return numeroBot;
}

export async function enviarTexto(para: string, texto: string): Promise<void> {
  if (modoSimulacao()) return;
  para = numeroParaEnvio(para);
  const resp = await fetch(`${GRAPH()}/${process.env.PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  if (!resp.ok) console.error("Erro ao enviar mensagem:", resp.status, await resp.text());
}

export async function baixarMidia(mediaId: string): Promise<Buffer> {
  // No modo simulação, "local:arquivo.ogg" lê um arquivo (áudio, foto) da pasta amostras/ do projeto
  if (modoSimulacao() && mediaId.startsWith("local:")) {
    const pasta = path.resolve("amostras");
    const arquivo = path.resolve(pasta, mediaId.slice("local:".length));
    if (!arquivo.startsWith(pasta + path.sep)) throw new Error("Arquivo simulado precisa estar na pasta amostras/");
    return fs.readFile(arquivo);
  }

  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const info = await fetch(`${GRAPH()}/${mediaId}`, { headers: auth });
  if (!info.ok) throw new Error(`Erro ao consultar mídia (${info.status}): ${await info.text()}`);
  const { url } = (await info.json()) as { url: string };

  const arquivo = await fetch(url, { headers: auth }); // a URL da mídia também exige o token
  if (!arquivo.ok) throw new Error(`Erro ao baixar mídia (${arquivo.status})`);
  return Buffer.from(await arquivo.arrayBuffer());
}

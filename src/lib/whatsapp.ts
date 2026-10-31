import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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
};

const GRAPH = () => `https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v23.0"}`;

/** Sem WHATSAPP_TOKEN o app roda em modo simulação: nada é enviado para a Meta. */
export function modoSimulacao(): boolean {
  return !process.env.WHATSAPP_TOKEN;
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

/** Só aceita mensagens do seu número (compara os 8 últimos dígitos por causa do 9º dígito no Brasil). */
export function remetentePermitido(from: string): boolean {
  const meu = process.env.MEU_NUMERO?.replace(/\D/g, "");
  if (!meu) return true;
  return from.replace(/\D/g, "").slice(-8) === meu.slice(-8);
}

export async function enviarTexto(para: string, texto: string): Promise<void> {
  if (modoSimulacao()) return;
  const resp = await fetch(`${GRAPH()}/${process.env.PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  if (!resp.ok) console.error("Erro ao enviar mensagem:", resp.status, await resp.text());
}

export async function baixarMidia(mediaId: string): Promise<Buffer> {
  // No modo simulação, "local:arquivo.ogg" lê um áudio da pasta amostras/ do projeto
  if (modoSimulacao() && mediaId.startsWith("local:")) {
    const pasta = path.resolve("amostras");
    const arquivo = path.resolve(pasta, mediaId.slice("local:".length));
    if (!arquivo.startsWith(pasta + path.sep)) throw new Error("Áudio simulado precisa estar na pasta amostras/");
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

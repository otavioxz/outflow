import { sendNotification, WebPushError } from "web-push";
import { prepararDb } from "./db";
import { hashToken } from "./usuarios";

// Notificações push (Web Push): o navegador do usuário (ou o app Android, que é uma TWA sobre o Chrome)
// cria uma "inscrição" com o endereço do serviço de push dele; o servidor manda a notificação para
// esse endereço, assinada com as chaves VAPID. Cada inscrição fica presa à sessão de login em que
// foi criada: ao sair da conta (ou ao "sair dos outros dispositivos"), aquele aparelho para de receber.

export type InscricaoPush = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Notificacao = { titulo: string; corpo?: string; url?: string };

// Só os serviços de push dos navegadores: o endereço vem do navegador e o servidor faz um POST nele,
// então não aceitamos qualquer URL (senão daria para usar o servidor para chamar endereços internos)
const SERVICOS_DE_PUSH = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge no Android, Samsung Internet, TWA
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari / iPhone
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge no Windows
];

const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

export function pushConfigurado(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && contatoVapid());
}

/** Chave pública que o navegador usa para se inscrever (pode ir para a página). */
export function chavePublicaPush(): string | null {
  return pushConfigurado() ? process.env.VAPID_PUBLIC_KEY! : null;
}

// Os serviços de push exigem um contato de quem envia (e-mail ou site)
function contatoVapid(): string | null {
  const contato = (process.env.VAPID_CONTATO || process.env.CONTATO_PRIVACIDADE || "").trim();
  if (!contato) return null;
  return /^(mailto:|https:\/\/)/.test(contato) ? contato : `mailto:${contato}`;
}

/** Valida o que veio do navegador (PushSubscription.toJSON()). Devolve null se não servir. */
export function lerInscricao(dados: unknown): InscricaoPush | null {
  if (typeof dados !== "object" || dados === null) return null;
  const { endpoint, keys } = dados as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1024) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || !SERVICOS_DE_PUSH.some((p) => p.test(url.hostname))) return null;

  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || p256dh.length > 200 || !BASE64URL.test(p256dh)) return null;
  if (typeof auth !== "string" || auth.length > 100 || !BASE64URL.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** Salva a inscrição deste aparelho, presa à sessão atual. Se o aparelho já era de outra conta, passa para esta. */
export async function salvarInscricao(usuarioId: number, tokenSessao: string, inscricao: InscricaoPush): Promise<void> {
  const db = await prepararDb();
  await db.execute({
    sql: `INSERT INTO inscricoes_push (endpoint, usuario_id, token_hash, p256dh, auth) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, token_hash = excluded.token_hash,
            p256dh = excluded.p256dh, auth = excluded.auth`,
    args: [inscricao.endpoint, usuarioId, hashToken(tokenSessao), inscricao.keys.p256dh, inscricao.keys.auth],
  });
}

export async function removerInscricao(usuarioId: number, endpoint: string): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `DELETE FROM inscricoes_push WHERE endpoint = ? AND usuario_id = ?`, args: [endpoint, usuarioId] });
}

/** Inscrições do usuário cujas sessões ainda estão valendo (as de sessões encerradas são apagadas). */
export async function inscricoesAtivas(usuarioId: number): Promise<InscricaoPush[]> {
  const db = await prepararDb();
  const agora = new Date().toISOString();
  await db.execute({
    sql: `DELETE FROM inscricoes_push WHERE usuario_id = ?
            AND token_hash NOT IN (SELECT token_hash FROM sessoes WHERE expira_em > ?)`,
    args: [usuarioId, agora],
  });
  const r = await db.execute({
    sql: `SELECT endpoint, p256dh, auth FROM inscricoes_push WHERE usuario_id = ?`,
    args: [usuarioId],
  });
  return r.rows.map((l) => ({ endpoint: String(l.endpoint), keys: { p256dh: String(l.p256dh), auth: String(l.auth) } }));
}

/**
 * Manda a notificação para todos os aparelhos do usuário. Nunca lança erro: a notificação é um extra.
 * Devolve quantos aparelhos receberam.
 */
export async function enviarPush(usuarioId: number, notificacao: Notificacao): Promise<number> {
  if (!pushConfigurado()) return 0;
  try {
    const inscricoes = await inscricoesAtivas(usuarioId);
    const corpo = JSON.stringify({ url: "/", ...notificacao });
    const opcoes = {
      vapidDetails: { subject: contatoVapid()!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
      TTL: 24 * 60 * 60, // celular desligado: entrega quando voltar, até 1 dia depois
      urgency: "high" as const,
    };
    const resultados = await Promise.all(
      inscricoes.map(async (inscricao) => {
        try {
          await sendNotification(inscricao, corpo, opcoes);
          return true;
        } catch (erro) {
          // 404/410: a inscrição não existe mais (app desinstalado, permissão revogada)
          if (erro instanceof WebPushError && (erro.statusCode === 404 || erro.statusCode === 410)) {
            await removerInscricao(usuarioId, inscricao.endpoint).catch(() => {});
          } else {
            console.error("Erro ao enviar push:", erro);
          }
          return false;
        }
      }),
    );
    return resultados.filter(Boolean).length;
  } catch (erro) {
    console.error("Erro ao enviar push:", erro);
    return 0;
  }
}

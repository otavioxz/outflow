// Registro de eventos de segurança: sempre no console do servidor e, se DISCORD_WEBHOOK_URL
// estiver configurado, também num canal do Discord.

type Nivel = "info" | "sucesso" | "alerta" | "perigo";

export type Evento = {
  titulo: string;
  nivel: Nivel;
  /** Texto livre do embed (aceita markdown/links). Só para conteúdo montado pelo próprio servidor. */
  descricao?: string;
  campos?: Record<string, string | number | null | undefined>;
  /** Eventos com a mesma chave são enviados no máximo 1 vez por minuto (ex.: ataques repetidos do mesmo IP). */
  agrupar?: string;
};

const CORES: Record<Nivel, number> = { info: 0x3b82f6, sucesso: 0x02e065, alerta: 0xf59e0b, perigo: 0xef4444 };
const EMOJI: Record<Nivel, string> = { info: "ℹ️", sucesso: "✅", alerta: "⚠️", perigo: "🚨" };

const JANELA_AGRUPAR_MS = 60_000;
const MAX_POR_MINUTO = 20; // o Discord aceita ~30/min por webhook; sobra margem
const ultimosPorChave = new Map<string, number>();
let enviadosNoMinuto: number[] = [];
let suprimidos = 0;

function urlWebhook(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return null;
  // Só aceita webhooks do próprio Discord, para um .env errado não vazar logs para outro lugar
  return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ? url : null;
}

/** Texto vindo de fora (e-mail digitado, navegador...) entra como código: sem formatação nem menções. */
function seguro(valor: unknown, max = 900): string {
  const texto = String(valor ?? "—").replace(/`/g, "'").slice(0, max);
  if (texto.includes("\n")) return "```\n" + texto + "\n```";
  return "`" + (texto || "—") + "`";
}

export async function registrarEvento(evento: Evento): Promise<void> {
  console.log(JSON.stringify({ log: "seguranca", quando: new Date().toISOString(), ...evento }));

  const url = urlWebhook();
  if (!url) return;

  const agora = Date.now();
  if (evento.agrupar) {
    const ultimo = ultimosPorChave.get(evento.agrupar) ?? 0;
    if (agora - ultimo < JANELA_AGRUPAR_MS) {
      suprimidos++;
      return;
    }
    ultimosPorChave.set(evento.agrupar, agora);
    if (ultimosPorChave.size > 1000) ultimosPorChave.clear();
  }
  enviadosNoMinuto = enviadosNoMinuto.filter((t) => agora - t < 60_000);
  if (enviadosNoMinuto.length >= MAX_POR_MINUTO) {
    suprimidos++;
    return;
  }
  enviadosNoMinuto.push(agora);

  const campos = Object.entries(evento.campos ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([nome, v]) => {
      const texto = String(v ?? "");
      return { name: nome.slice(0, 250), value: seguro(v), inline: texto.length < 40 && !texto.includes("\n") };
    });
  if (suprimidos > 0) {
    campos.push({ name: "Eventos agrupados", value: `${suprimidos} evento(s) repetido(s) omitido(s) desde a última mensagem`, inline: false });
    suprimidos = 0;
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        username: "Outflow · Segurança",
        allowed_mentions: { parse: [] }, // nunca deixa um texto do usuário pingar @everyone
        embeds: [
          {
            title: `${EMOJI[evento.nivel]} ${evento.titulo}`.slice(0, 250),
            description: evento.descricao?.slice(0, 2000),
            color: CORES[evento.nivel],
            fields: campos.slice(0, 25), // limite do Discord
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    if (!resp.ok) console.error(`Discord recusou o log (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  } catch (erro) {
    console.error("Falha ao enviar log para o Discord:", erro instanceof Error ? erro.message : erro);
  }
}

/** Esconde o meio de um número de telefone: 5511987654321 -> 55119****4321 */
export function mascararTelefone(numero: string): string {
  const d = numero.replace(/\D/g, "");
  return d.length > 8 ? d.slice(0, 5) + "****" + d.slice(-4) : "****";
}

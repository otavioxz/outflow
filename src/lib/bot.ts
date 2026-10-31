import { NOME_PAGAMENTO, formatarReais, hojeISO } from "./categorias";
import { extrairGastos } from "./extrator";
import { desfazerUltimo, inserirGastos, totaisPorCategoria, totalDoMes } from "./gastos";
import { transcreverAudio, transcricaoConfigurada } from "./transcricao";
import { baixarMidia, type MensagemWhatsApp } from "./whatsapp";

const AJUDA = `👋 Aqui é o *Outflow*, seu controle de gastos. É só me contar o que você gastou:

• "gastei 45 no ifood"
• "mercado 230 no débito e uber 18,50"
• "paguei 120 de luz ontem"
• ou mande um áudio 🎤

Comandos:
• *resumo*: total do mês por categoria
• *desfazer*: apaga o último gasto registrado
• *ajuda*: mostra esta mensagem`;

/** Processa uma mensagem recebida e devolve o texto de resposta. */
export async function processarMensagem(msg: MensagemWhatsApp): Promise<string> {
  let texto: string;
  let origem: "texto" | "audio" = "texto";

  if (msg.type === "text" && msg.text) {
    texto = msg.text.body.trim();
  } else if (msg.type === "audio" && msg.audio) {
    if (!transcricaoConfigurada()) return "🎤 Recebi seu áudio, mas a transcrição ainda não está configurada (TRANSCRICAO_API_KEY).";
    const audio = await baixarMidia(msg.audio.id);
    texto = await transcreverAudio(audio, msg.audio.mime_type?.split(";")[0]);
    origem = "audio";
    if (!texto) return "🎤 Não consegui entender o áudio. Pode repetir?";
  } else {
    return "Por enquanto só entendo texto e áudio. 🙂";
  }

  const comando = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, "").trim();
  if (["oi", "ola", "ajuda", "menu", "help"].includes(comando)) return AJUDA;
  if (["resumo", "saldo", "total"].includes(comando)) return resumoDoMes();
  if (["desfazer", "apagar", "cancelar", "desfaz"].includes(comando)) return desfazer();

  const gastos = await extrairGastos(texto);
  if (gastos.length === 0) {
    const eco = origem === "audio" ? `\n\n🎤 Entendi: "${texto}"` : "";
    return `🤔 Não encontrei nenhum gasto nessa mensagem. Tente algo como "gastei 45 no ifood".${eco}`;
  }

  await inserirGastos(
    gastos.map((g, i) => ({
      valor_centavos: Math.round(g.valor * 100),
      descricao: g.descricao,
      categoria: g.categoria,
      pagamento: g.pagamento,
      data: g.data,
      origem,
      mensagem_original: texto,
      mensagem_id: gastos.length > 1 ? `${msg.id}#${i}` : msg.id,
    })),
  );

  const linhas = gastos.map((g) => {
    const pagamento = g.pagamento !== "nao_informado" ? ` · ${NOME_PAGAMENTO[g.pagamento]}` : "";
    const data = g.data !== hojeISO() ? ` · ${g.data.split("-").reverse().join("/")}` : "";
    return `✅ ${formatarReais(Math.round(g.valor * 100))}: ${g.descricao} (${g.categoria}${pagamento}${data})`;
  });

  const mes = hojeISO().slice(0, 7);
  const total = await totalDoMes(mes);
  linhas.push("", `📊 Total do mês: ${formatarReais(total)}${linhaOrcamento(total)}`);
  if (origem === "audio") linhas.push(`🎤 "${texto}"`);
  return linhas.join("\n");
}

async function resumoDoMes(): Promise<string> {
  const mes = hojeISO().slice(0, 7);
  const [total, porCategoria] = await Promise.all([totalDoMes(mes), totaisPorCategoria(mes)]);
  if (total === 0) return "Nenhum gasto registrado neste mês ainda. 🎉";

  const nomeMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return [
    `📊 *Resumo de ${nomeMes}*`,
    "",
    ...porCategoria.map((c) => `• ${c.categoria}: ${formatarReais(c.total)}`),
    "",
    `*Total: ${formatarReais(total)}*${linhaOrcamento(total)}`,
  ].join("\n");
}

async function desfazer(): Promise<string> {
  const g = await desfazerUltimo();
  if (!g) return "Não há nenhum gasto para desfazer.";
  return `🗑️ Apaguei: ${formatarReais(g.valor_centavos)}, ${g.descricao} (${g.categoria})`;
}

function linhaOrcamento(totalCentavos: number): string {
  const orcamento = Number(process.env.ORCAMENTO_MENSAL);
  if (!orcamento) return "";
  const pct = Math.round((totalCentavos / 100 / orcamento) * 100);
  const alerta = pct >= 100 ? " 🚨" : pct >= 80 ? " ⚠️" : "";
  return `\n💰 ${pct}% do orçamento de ${formatarReais(orcamento * 100)}${alerta}`;
}

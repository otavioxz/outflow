import { NOME_PAGAMENTO, formatarReais, hojeISO } from "./categorias";
import { obterMetaGuardadoCentavos, obterOrcamentoCentavos } from "./configuracoes";
import {
  LimiteDoGroq,
  TAMANHO_MAXIMO_NOTA,
  extrairDeNota,
  extrairLancamentos,
  leituraDeNotaConfigurada,
  type GastoExtraido,
  type Nota,
} from "./extrator";
import { desfazerUltimo, gastoDaNota, inserirGastos, totaisPorCategoria, totalDoMes } from "./gastos";
import { inserirGuardados, totalGuardadoNoMes } from "./guardados";
import { transcreverAudio, transcricaoConfigurada } from "./transcricao";
import { baixarMidia, type MensagemWhatsApp } from "./whatsapp";

const AJUDA = `👋 Aqui é o *Outflow*, seu controle de gastos. É só me contar o que você gastou:

• "gastei 45 no ifood"
• "mercado 230 no débito e uber 18,50"
• "paguei 120 de luz ontem"
• "guardei 500 na poupança" (fica separado dos gastos)
• ou mande um áudio 🎤
• ou uma foto da nota fiscal 🧾

Comandos:
• *resumo*: total do mês por categoria e quanto foi guardado
• *desfazer*: apaga o último lançamento registrado
• *ajuda*: mostra esta mensagem`;

export type Resultado = {
  /** gasto = algo foi registrado (gasto e/ou valor guardado); comando = resumo/ajuda/desfazer; sem_gasto = não entendeu; ignorada = tipo não suportado */
  tipo: "gasto" | "comando" | "sem_gasto" | "ignorada";
  /** O que o bot responderia (vai para o log e, se ativado, para o WhatsApp) */
  resposta: string;
  /** Texto recebido (ou transcrito do áudio) */
  texto?: string;
  origem: "texto" | "audio" | "nota";
  comando?: string;
};

/** Processa uma mensagem recebida e devolve o resultado (o que foi feito e a resposta). */
export async function processarMensagem(msg: MensagemWhatsApp): Promise<Resultado> {
  let texto: string;
  let origem: "texto" | "audio" = "texto";

  if (msg.type === "text" && msg.text) {
    texto = msg.text.body.trim();
  } else if (msg.type === "audio" && msg.audio) {
    if (!transcricaoConfigurada())
      return { tipo: "ignorada", origem: "audio", resposta: "🎤 Recebi um áudio, mas a transcrição ainda não está configurada (TRANSCRICAO_API_KEY)." };
    const audio = await baixarMidia(msg.audio.id);
    texto = await transcreverAudio(audio, msg.audio.mime_type?.split(";")[0]);
    origem = "audio";
    if (!texto) return { tipo: "sem_gasto", origem, resposta: "🎤 Não consegui entender o áudio. Pode repetir?" };
  } else if (msg.type === "image" && msg.image) {
    return registrarNota(msg.id, msg.image.id, msg.image.mime_type, msg.image.caption);
  } else if (msg.type === "document" && msg.document) {
    // Foto mandada "como documento" (sem compressão) também vale; PDF não: o modelo gratuito só lê imagem
    if (msg.document.mime_type?.startsWith("image/"))
      return registrarNota(msg.id, msg.document.id, msg.document.mime_type, msg.document.caption);
    return { tipo: "ignorada", origem: "nota", resposta: "🧾 Por enquanto não leio PDF. Mande uma *foto* da nota fiscal (ou um print do PDF)." };
  } else {
    return { tipo: "ignorada", origem, resposta: `Tipo de mensagem não suportado (${msg.type}). Por enquanto entendo texto, áudio e foto de nota fiscal.` };
  }

  const comando = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, "").trim();
  if (["oi", "ola", "ajuda", "menu", "help"].includes(comando))
    return { tipo: "comando", comando: "ajuda", texto, origem, resposta: AJUDA };
  if (["resumo", "saldo", "total"].includes(comando))
    return { tipo: "comando", comando: "resumo", texto, origem, resposta: await resumoDoMes() };
  if (["desfazer", "apagar", "cancelar", "desfaz"].includes(comando))
    return { tipo: "comando", comando: "desfazer", texto, origem, resposta: await desfazer() };

  const { gastos, guardados } = await extrairLancamentos(texto);
  if (gastos.length === 0 && guardados.length === 0) {
    const eco = origem === "audio" ? `\n\n🎤 Entendi: "${texto}"` : "";
    return { tipo: "sem_gasto", texto, origem, resposta: `🤔 Não encontrei nenhum gasto nessa mensagem. Tente algo como "gastei 45 no ifood".${eco}` };
  }

  const total = gastos.length + guardados.length;
  const idMensagem = (i: number) => (total > 1 ? `${msg.id}#${i}` : msg.id);
  if (gastos.length)
    await inserirGastos(
      gastos.map((g, i) => ({
        valor_centavos: Math.round(g.valor * 100),
        descricao: g.descricao,
        categoria: g.categoria,
        pagamento: g.pagamento,
        data: g.data,
        origem,
        mensagem_original: texto,
        mensagem_id: idMensagem(i),
      })),
    );
  if (guardados.length)
    await inserirGuardados(
      guardados.map((g, i) => ({
        valor_centavos: Math.round(g.valor * 100),
        descricao: g.descricao,
        data: g.data,
        origem,
        mensagem_original: texto,
        mensagem_id: idMensagem(gastos.length + i),
      })),
    );

  const sufixoData = (data: string) => (data !== hojeISO() ? ` · ${data.split("-").reverse().join("/")}` : "");
  const linhas = [
    ...gastos.map(linhaGasto),
    ...guardados.map((g) => `🐷 Guardado ${formatarReais(Math.round(g.valor * 100))}: ${g.descricao}${sufixoData(g.data)}`),
  ];

  const mes = hojeISO().slice(0, 7);
  linhas.push("");
  if (gastos.length) {
    const totalGasto = await totalDoMes(mes);
    linhas.push(`📊 Total do mês: ${formatarReais(totalGasto)}${await linhaOrcamento(totalGasto)}`);
  }
  if (guardados.length) linhas.push(await linhaGuardado(await totalGuardadoNoMes(mes)));
  if (origem === "audio") linhas.push(`🎤 "${texto}"`);
  return { tipo: "gasto", texto, origem, resposta: linhas.join("\n") };
}

/** "✅ R$ 45,00: iFood (Alimentação · Pix · 03/11)" */
function linhaGasto(g: GastoExtraido): string {
  const pagamento = g.pagamento !== "nao_informado" ? ` · ${NOME_PAGAMENTO[g.pagamento]}` : "";
  const data = g.data !== hojeISO() ? ` · ${g.data.split("-").reverse().join("/")}` : "";
  return `✅ ${formatarReais(Math.round(g.valor * 100))}: ${g.descricao} (${g.categoria}${pagamento}${data})`;
}

/** Lê a foto de uma nota fiscal e registra o total como um gasto. */
async function registrarNota(mensagemId: string, midiaId: string, mimeType = "image/jpeg", legenda?: string): Promise<Resultado> {
  const origem = "nota";
  const texto = legenda?.trim() || "(foto de nota fiscal)";
  if (!leituraDeNotaConfigurada())
    return { tipo: "ignorada", origem, texto, resposta: "🧾 Recebi a foto, mas a leitura de notas precisa da chave do Groq (GROQ_API_KEY)." };

  const imagem = await baixarMidia(midiaId);
  if (imagem.length > TAMANHO_MAXIMO_NOTA)
    return { tipo: "ignorada", origem, texto, resposta: "🧾 A foto é grande demais (máx. 4 MB). Mande pelo WhatsApp como foto normal, não como documento." };

  let nota: Nota | null;
  try {
    nota = await extrairDeNota(imagem, mimeType.split(";")[0], legenda?.trim());
  } catch (erro) {
    if (!(erro instanceof LimiteDoGroq)) throw erro;
    const espera = erro.segundos > 90 ? `${Math.ceil(erro.segundos / 60)} minutos` : "1 minuto";
    return { tipo: "ignorada", origem, texto, resposta: `🧾 Muitas notas seguidas: o plano grátis de leitura chegou ao limite. Mande a foto de novo daqui a ${espera}.` };
  }
  if (!nota)
    return { tipo: "sem_gasto", origem, texto, resposta: "🧾 Não consegui ler um valor nessa imagem. Tente uma foto mais nítida, com o *valor total* aparecendo." };

  if (nota.chave) {
    const existente = await gastoDaNota(nota.chave);
    if (existente) {
      const data = existente.data.split("-").reverse().join("/");
      return { tipo: "ignorada", origem, texto, resposta: `🧾 Essa nota já foi registrada: ${formatarReais(existente.valor_centavos)}, ${existente.descricao} (${data}).` };
    }
  }

  const g = nota.gasto;
  await inserirGastos([
    {
      valor_centavos: Math.round(g.valor * 100),
      descricao: g.descricao,
      categoria: g.categoria,
      pagamento: g.pagamento,
      data: g.data,
      origem,
      mensagem_original: legenda?.trim() || undefined,
      mensagem_id: mensagemId,
      chave_nota: nota.chave,
    },
  ]);

  const total = await totalDoMes(hojeISO().slice(0, 7));
  const linhas = ["🧾 Nota lida!", linhaGasto(g), "", `📊 Total do mês: ${formatarReais(total)}${await linhaOrcamento(total)}`];
  return { tipo: "gasto", origem, texto, resposta: linhas.join("\n") };
}

async function resumoDoMes(): Promise<string> {
  const mes = hojeISO().slice(0, 7);
  const [total, porCategoria, guardado] = await Promise.all([totalDoMes(mes), totaisPorCategoria(mes), totalGuardadoNoMes(mes)]);
  if (total === 0 && guardado === 0) return "Nenhum gasto registrado neste mês ainda. 🎉";

  const nomeMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return [
    `📊 *Resumo de ${nomeMes}*`,
    "",
    ...porCategoria.map((c) => `• ${c.categoria}: ${formatarReais(c.total)}`),
    "",
    `*Total: ${formatarReais(total)}*${await linhaOrcamento(total)}`,
    ...(guardado > 0 ? ["", await linhaGuardado(guardado)] : []),
  ].join("\n");
}

async function desfazer(): Promise<string> {
  const g = await desfazerUltimo();
  if (!g) return "Não há nenhum lançamento para desfazer.";
  if (g.tipo === "guardado") return `🗑️ Apaguei o valor guardado: ${formatarReais(g.valor_centavos)}, ${g.descricao}`;
  return `🗑️ Apaguei: ${formatarReais(g.valor_centavos)}, ${g.descricao} (${g.categoria})`;
}

async function linhaGuardado(totalCentavos: number): Promise<string> {
  const meta = await obterMetaGuardadoCentavos();
  const linha = `🐷 Guardado no mês: ${formatarReais(totalCentavos)}`;
  if (!meta) return linha;
  const pct = Math.round((totalCentavos / meta) * 100);
  return `${linha}\n🎯 ${pct}% da meta de ${formatarReais(meta)}${pct >= 100 ? " 🎉" : ""}`;
}

async function linhaOrcamento(totalCentavos: number): Promise<string> {
  const orcamentoCentavos = await obterOrcamentoCentavos();
  if (!orcamentoCentavos) return "";
  const orcamento = orcamentoCentavos / 100;
  const pct = Math.round((totalCentavos / 100 / orcamento) * 100);
  const alerta = pct >= 100 ? " 🚨" : pct >= 80 ? " ⚠️" : "";
  return `\n💰 ${pct}% do orçamento de ${formatarReais(orcamento * 100)}${alerta}`;
}

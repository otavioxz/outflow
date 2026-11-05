import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIAS, PAGAMENTOS, hojeISO, type Categoria } from "./categorias";

const GastoExtraido = z.object({
  valor: z.number().positive(),
  descricao: z.string().min(1),
  categoria: z.enum(CATEGORIAS),
  pagamento: z.enum(PAGAMENTOS),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const GuardadoExtraido = z.object({
  valor: z.number().positive(),
  descricao: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// "guardados" é opcional no parse: se o modelo omitir, vira lista vazia
const Extracao = z.object({ gastos: z.array(GastoExtraido), guardados: z.array(GuardadoExtraido).default([]) });

export type GastoExtraido = z.infer<typeof GastoExtraido>;
export type GuardadoExtraido = z.infer<typeof GuardadoExtraido>;
export type Lancamentos = { gastos: GastoExtraido[]; guardados: GuardadoExtraido[] };

// JSON Schema enviado ao Claude (structured outputs garante que a resposta segue esse formato)
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gastos", "guardados"],
  properties: {
    gastos: {
      type: "array",
      description: "Gastos encontrados na mensagem. Vazio se a mensagem não descreve nenhum gasto.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["valor", "descricao", "categoria", "pagamento", "data"],
        properties: {
          valor: { type: "number", description: "Valor em reais, ex.: 45.9" },
          descricao: { type: "string", description: "Descrição curta, ex.: 'iFood', 'Conta de luz'" },
          categoria: { type: "string", enum: [...CATEGORIAS] },
          pagamento: { type: "string", enum: [...PAGAMENTOS] },
          data: { type: "string", description: "Data do gasto no formato YYYY-MM-DD" },
        },
      },
    },
    guardados: {
      type: "array",
      description: "Dinheiro guardado (poupança, reserva, investimento). Vazio se a mensagem não fala em guardar dinheiro.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["valor", "descricao", "data"],
        properties: {
          valor: { type: "number", description: "Valor em reais, ex.: 500" },
          descricao: { type: "string", description: "Onde foi guardado, ex.: 'Poupança', 'Reserva de emergência'" },
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
        },
      },
    },
  },
} as const;

const SYSTEM = `Você extrai gastos e dinheiro guardado de mensagens curtas de WhatsApp escritas em português do Brasil (texto digitado ou transcrição de áudio).

Regras:
- Cada valor gasto mencionado vira um item em "gastos". Uma mensagem pode ter vários gastos ("mercado 200 e uber 30").
- Valores por extenso ou falados ("quarenta e cinco e noventa", "cinquenta conto") devem virar número (45.9, 50).
- A descrição deve ser curta e útil (o estabelecimento ou o que foi comprado), com a primeira letra maiúscula.
- Escolha a categoria mais adequada. Use "Mercado" para supermercado/feira, "Alimentação" para restaurantes, lanches e delivery, "Contas" para luz, água, internet e telefone, "Moradia" para aluguel e condomínio, e "Assinaturas" para streaming e serviços recorrentes.
- pagamento: use "nao_informado" se a forma de pagamento não for dita. "cartão" sem especificar é "credito".
- data: use a data de hoje, a menos que a mensagem indique outra ("ontem", "sexta", "dia 10").
- Dinheiro guardado NÃO é gasto: "guardei 500 na poupança", "separei 300 pra reserva", "investi 200", "coloquei 100 no cofrinho" vão em "guardados", nunca em "gastos". A descrição é onde foi guardado ("Poupança", "Reserva", "Investimento"); se não for dito, use "Poupança".
- Uma mensagem pode ter as duas coisas ("mercado 200 e guardei 500"): cada valor vai para a sua lista.
- Retiradas da poupança ("tirei 200 da poupança") não são registradas: não entram em nenhuma lista.
- Se a mensagem não descrever um gasto nem dinheiro guardado (ex.: uma saudação ou pergunta), retorne as duas listas vazias.`;

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

let cliente: Anthropic | undefined;

/** Chave do Groq: GROQ_API_KEY, ou a mesma da transcrição quando ela já usa o Groq. */
function chaveGroq(): string | undefined {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (process.env.TRANSCRICAO_URL?.includes("groq.com")) return process.env.TRANSCRICAO_API_KEY;
}

/** Qual extrator está em uso: Claude (se houver chave), senão Groq, senão palavras-chave. */
export function extratorAtivo(): "claude" | "groq" | "simples" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : chaveGroq() ? "groq" : "simples";
}

function cabecalhoData(): string {
  const hoje = hojeISO();
  return `Hoje é ${DIAS_SEMANA[new Date(`${hoje}T12:00:00`).getDay()]}, ${hoje}.`;
}

export async function extrairLancamentos(texto: string): Promise<Lancamentos> {
  const extrator = extratorAtivo();
  if (extrator === "simples") return extrairSemIA(texto);
  if (extrator === "groq") {
    try {
      return await extrairComGroq(texto);
    } catch (erro) {
      // Groq fora do ar ou limite do plano grátis: não perde o gasto, usa o extrator simples
      console.warn("Groq falhou, usando o extrator simples:", erro instanceof Error ? erro.message : erro);
      return extrairSemIA(texto);
    }
  }
  return extrairComClaude(texto);
}

async function extrairComClaude(texto: string): Promise<Lancamentos> {
  cliente ??= new Anthropic();

  const resposta = await cliente.beta.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
    max_tokens: 4000,
    // Se o modelo recusar a mensagem, a API tenta automaticamente outro modelo
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [{ role: "user", content: `${cabecalhoData()}\n\nMensagem: ${texto}` }],
  });

  if (resposta.stop_reason === "refusal") return { gastos: [], guardados: [] };

  const json = resposta.content.find((b) => b.type === "text")?.text;
  if (!json) throw new Error(`Resposta do Claude sem texto (stop_reason: ${resposta.stop_reason})`);
  return Extracao.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Groq (API compatível com a da OpenAI): grátis dentro dos limites do plano.

async function extrairComGroq(texto: string): Promise<Lancamentos> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chaveGroq()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model: process.env.GROQ_MODELO ?? "openai/gpt-oss-120b",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM}

Responda SOMENTE com um JSON neste formato exato:
{"gastos": [{"valor": 45.9, "descricao": "iFood", "categoria": "Alimentação", "pagamento": "credito", "data": "2026-01-31"}], "guardados": [{"valor": 500, "descricao": "Poupança", "data": "2026-01-31"}]}
- categoria: exatamente uma de ${CATEGORIAS.map((c) => `"${c}"`).join(", ")}
- pagamento: exatamente um de ${PAGAMENTOS.map((p) => `"${p}"`).join(", ")}
- Corrija nomes conhecidos escritos errado pela transcrição de áudio (ex.: "Antropik" -> "Anthropic", "ifudi" -> "iFood").`,
        },
        { role: "user", content: `${cabecalhoData()}\n\nMensagem: ${texto}` },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`Groq respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const dados = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const json = dados.choices?.[0]?.message?.content;
  if (!json) throw new Error("Resposta do Groq sem conteúdo");
  return Extracao.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Foto de nota fiscal / cupom: lida por um modelo de visão do Groq. Vira um gasto só, com o total da nota.

/** Imagens maiores que isso são recusadas pelo Groq (limite de imagem em base64). */
export const TAMANHO_MAXIMO_NOTA = 4 * 1024 * 1024;

/** O plano grátis do Groq tem limite de tokens por minuto: cada foto gasta ~4 mil (cabem ~2 notas por minuto). */
export class LimiteDoGroq extends Error {
  constructor(readonly segundos: number) {
    super(`Limite por minuto do Groq atingido (tente em ${segundos}s)`);
  }
}

export function leituraDeNotaConfigurada(): boolean {
  return Boolean(chaveGroq());
}

// O modelo às vezes erra um campo secundário; nesses casos usamos um valor neutro em vez de descartar a nota
const NotaLida = z.object({
  eh_nota: z.boolean(),
  valor: z.number().positive().nullable().catch(null),
  estabelecimento: z.string().catch(""),
  categoria: z.enum(CATEGORIAS).catch("Outros"),
  pagamento: z.enum(PAGAMENTOS).catch("nao_informado"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  chave_acesso: z.string().catch(""),
});

export type Nota = {
  gasto: GastoExtraido;
  /** Chave de acesso da NF-e/NFC-e (44 dígitos), quando legível: evita registrar a mesma nota duas vezes */
  chave?: string;
};

const SYSTEM_NOTA = `Você lê fotos de notas fiscais e cupons fiscais brasileiros (NFC-e, NF-e, cupom de maquininha, recibo) e extrai o gasto.

Responda SOMENTE com um JSON neste formato exato:
{"eh_nota": true, "valor": 108.7, "estabelecimento": "Assaí", "categoria": "Mercado", "pagamento": "debito", "data": "2026-01-31", "chave_acesso": "41261112345678000190650010000123451000123456"}

Regras:
- eh_nota: false se a imagem não for uma nota, cupom ou recibo de compra (nesse caso os outros campos podem ser null ou "").
- valor: o TOTAL pago (VALOR TOTAL / VALOR A PAGAR), em reais, já com descontos. Nunca o valor de um item.
- estabelecimento: nome curto e reconhecível da loja, com a primeira letra maiúscula, sem "LTDA", "S.A." ou CNPJ (ex.: "SUPERMERCADO BOM PRECO LTDA" -> "Supermercado Bom Preço").
- categoria: exatamente uma de ${CATEGORIAS.map((c) => `"${c}"`).join(", ")}. Decida pelo tipo de loja e pelos itens. "Mercado" para supermercado/feira, "Alimentação" para restaurantes e lanchonetes.
- pagamento: exatamente um de ${PAGAMENTOS.map((p) => `"${p}"`).join(", ")}, pela forma de pagamento impressa. "nao_informado" se não aparecer.
- data: a data de emissão no formato YYYY-MM-DD, ou null se não estiver legível.
- chave_acesso: os 44 dígitos da chave de acesso, só números, sem espaços. "" se não houver ou não estiver legível.
- A legenda enviada pelo usuário, se houver, tem prioridade (ex.: "paguei no pix", "era almoço").`;

export async function extrairDeNota(imagem: Buffer, mimeType: string, legenda?: string): Promise<Nota | null> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chaveGroq()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: process.env.GROQ_MODELO_VISAO ?? "qwen/qwen3.8-27b",
      temperature: 0,
      reasoning_effort: "none", // ler uma nota não precisa de raciocínio: fica mais rápido
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_NOTA },
        {
          role: "user",
          content: [
            { type: "text", text: `${cabecalhoData()}${legenda ? `\n\nLegenda do usuário: ${legenda}` : ""}` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imagem.toString("base64")}` } },
          ],
        },
      ],
    }),
  });
  if (resp.status === 429) throw new LimiteDoGroq(Number(resp.headers.get("retry-after")) || 60);
  if (!resp.ok) throw new Error(`Groq (visão) respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const dados = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const json = dados.choices?.[0]?.message?.content;
  if (!json) throw new Error("Resposta do Groq (visão) sem conteúdo");
  const nota = NotaLida.parse(JSON.parse(json));
  if (!nota.eh_nota || !nota.valor) return null;

  const chave = nota.chave_acesso.replace(/\D/g, "");
  return {
    gasto: {
      valor: nota.valor,
      descricao: nota.estabelecimento.trim() || "Nota fiscal",
      categoria: nota.categoria,
      pagamento: nota.pagamento,
      data: nota.data ?? hojeISO(),
    },
    chave: chave.length === 44 ? chave : undefined,
  };
}

// ---------------------------------------------------------------------------
// Modo sem IA: um extrator simples por palavras-chave, para testar sem ANTHROPIC_API_KEY.
// Entende frases como "gastei 45,90 no ifood", "uber 18.50 no pix" ou "guardei 500 na poupança".

const PALAVRAS_CATEGORIA: [Categoria, string[]][] = [
  ["Alimentação", ["ifood", "restaurante", "lanche", "almoço", "almoco", "jantar", "pizza", "padaria", "café", "cafe", "bar", "hamburguer", "rappi"]],
  ["Mercado", ["mercado", "supermercado", "feira", "atacadão", "atacadao", "assai", "assaí", "carrefour", "hortifruti"]],
  ["Transporte", ["uber", "táxi", "taxi", "gasolina", "combustível", "combustivel", "ônibus", "onibus", "metrô", "metro", "estacionamento", "pedágio", "pedagio"]],
  ["Moradia", ["aluguel", "condomínio", "condominio", "iptu"]],
  ["Contas", ["luz", "energia", "água", "agua", "internet", "telefone", "celular", "gás", "gas"]],
  ["Saúde", ["farmácia", "farmacia", "remédio", "remedio", "médico", "medico", "consulta", "dentista", "exame"]],
  ["Lazer", ["cinema", "show", "viagem", "passeio", "ingresso", "jogo"]],
  ["Compras", ["roupa", "tênis", "tenis", "shopping", "amazon", "shopee", "mercado livre", "presente"]],
  ["Educação", ["curso", "livro", "faculdade", "escola", "mensalidade"]],
  ["Assinaturas", ["netflix", "spotify", "prime", "disney", "youtube", "assinatura", "hbo", "max"]],
];

const PALAVRAS_PAGAMENTO: [GastoExtraido["pagamento"], RegExp][] = [
  ["pix", /\bpix\b/],
  ["debito", /\bd[eé]bito\b/],
  ["credito", /\b(cr[eé]dito|cart[aã]o)\b/],
  ["dinheiro", /\b(dinheiro|esp[eé]cie)\b/],
  ["boleto", /\bboleto\b/],
];

const PALAVRAS_IGNORADAS = new Set([
  "gastei", "paguei", "comprei", "foi", "foram", "de", "do", "da", "no", "na", "em", "com", "o", "a", "os", "as",
  "um", "uma", "reais", "real", "r$", "pix", "débito", "debito", "crédito", "credito", "cartão", "cartao",
  "dinheiro", "boleto", "hoje", "ontem", "pelo", "pela", "e",
]);

// Mensagens com estas palavras viram dinheiro guardado em vez de gasto
const PALAVRAS_GUARDADO = ["guardei", "guardar", "poupança", "poupanca", "reserva", "investi", "cofrinho", "economizei"];

// A fronteira \b não funciona com acentos ("água"), então definimos a fronteira de palavra manualmente
function contemPalavra(texto: string, palavra: string): boolean {
  return new RegExp(`(?<![\\p{L}\\d])${palavra}(?![\\p{L}\\d])`, "u").test(texto);
}

function extrairSemIA(texto: string): Lancamentos {
  const nada: Lancamentos = { gastos: [], guardados: [] };
  const minusculo = texto.toLowerCase();
  const numero = minusculo.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?/);
  if (!numero) return nada;

  const valor = Number(numero[1].replace(/\./g, "") + "." + (numero[2] ?? "0"));
  if (!(valor > 0)) return nada;

  let data = hojeISO();
  if (/\bontem\b/.test(minusculo)) {
    const d = new Date(`${data}T12:00:00`);
    d.setDate(d.getDate() - 1);
    data = d.toISOString().slice(0, 10);
  }

  if (PALAVRAS_GUARDADO.some((p) => contemPalavra(minusculo, p))) {
    if (/\b(tirei|retirei|saquei|resgatei)\b/.test(minusculo)) return nada; // retiradas não são registradas
    const descricao = /reserva/.test(minusculo) ? "Reserva" : /investi/.test(minusculo) ? "Investimento" : "Poupança";
    return { gastos: [], guardados: [{ valor, descricao, data }] };
  }

  const categoria =
    PALAVRAS_CATEGORIA.find(([, palavras]) => palavras.some((p) => contemPalavra(minusculo, p)))?.[0] ??
    "Outros";
  const pagamento = PALAVRAS_PAGAMENTO.find(([, re]) => re.test(minusculo))?.[0] ?? "nao_informado";

  const descricao = texto
    .replace(numero[0], " ")
    .replace(/r\$/gi, " ")
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "")) // tira pontuação das pontas (comum em áudio transcrito)
    .filter((p) => p && !PALAVRAS_IGNORADAS.has(p.toLowerCase()))
    .join(" ");

  return {
    gastos: [
      {
        valor,
        descricao: descricao ? descricao[0].toUpperCase() + descricao.slice(1) : categoria,
        categoria,
        pagamento,
        data,
      },
    ],
    guardados: [],
  };
}

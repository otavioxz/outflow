// Simulador do WhatsApp: envia ao webhook local o mesmo JSON que a Meta enviaria.
//
//   npm run simular                         -> modo conversa (digite as mensagens)
//   npm run simular -- "gastei 45 no ifood" -> envia uma mensagem e sai
//   npm run simular -- --audio teste.ogg    -> envia um áudio que está em amostras/
//   npm run simular -- --foto nota.jpg      -> envia a foto de uma nota fiscal que está em amostras/
import "dotenv/config";
import crypto from "node:crypto";
import readline from "node:readline/promises";

const URL_WEBHOOK = process.env.SIMULADOR_URL ?? "http://localhost:3000/api/webhook";
const NUMERO = (process.env.MEU_NUMERO ?? "5511999999999").split(",")[0].replace(/\D/g, "");

function montarPayload(mensagem: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SIMULADO",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: "Simulador" }, wa_id: NUMERO }],
              messages: [
                {
                  id: `wamid.SIM_${crypto.randomUUID()}`,
                  from: NUMERO,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  ...mensagem,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function enviar(mensagem: Record<string, unknown>) {
  const corpo = JSON.stringify(montarPayload(mensagem));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.APP_SECRET) {
    headers["X-Hub-Signature-256"] =
      "sha256=" + crypto.createHmac("sha256", process.env.APP_SECRET).update(corpo).digest("hex");
  }

  const resp = await fetch(URL_WEBHOOK, { method: "POST", headers, body: corpo }).catch(() => null);
  if (!resp) {
    console.error(`❌ Não consegui conectar em ${URL_WEBHOOK}. O servidor está rodando (npm run dev)?`);
    return;
  }
  if (!resp.ok) {
    console.error(`❌ O webhook respondeu ${resp.status}: ${await resp.text()}`);
    return;
  }

  const { respostas } = (await resp.json()) as { respostas?: string[] };
  if (!respostas) {
    console.log(process.env.RESPONDER_NO_WHATSAPP === "true"
      ? "✅ Enviado. A resposta foi para o WhatsApp de verdade e o resultado para o log do Discord."
      : "✅ Enviado. O resultado foi para o log do Discord.");
    return;
  }
  for (const r of respostas) console.log(`\n🤖 ${r.replace(/\n/g, "\n   ")}\n`);
}

const args = process.argv.slice(2);

if (args[0] === "--audio") {
  if (!args[1]) throw new Error("Informe o arquivo: npm run simular -- --audio teste.ogg");
  await enviar({ type: "audio", audio: { id: `local:${args[1]}`, mime_type: "audio/ogg; codecs=opus" } });
} else if (args[0] === "--foto") {
  if (!args[1]) throw new Error("Informe o arquivo: npm run simular -- --foto nota.jpg");
  const legenda = args.slice(2).join(" ") || undefined;
  await enviar({ type: "image", image: { id: `local:${args[1]}`, mime_type: args[1].endsWith(".png") ? "image/png" : "image/jpeg", caption: legenda } });
} else if (args.length > 0) {
  await enviar({ type: "text", text: { body: args.join(" ") } });
} else {
  console.log('💬 Simulador do WhatsApp. Digite uma mensagem ("ajuda", "resumo", "gastei 45 no ifood"...). Ctrl+C para sair.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const texto = (await rl.question("você › ")).trim();
    if (texto) await enviar({ type: "text", text: { body: texto } });
  }
}

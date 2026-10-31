// Assina o app do Outflow na conta do WhatsApp Business, para a Meta passar a entregar as
// mensagens no webhook (sem isso, elas só aparecem no painel de "webhooks de teste").
//
//   node scripts/assinar-webhook.mjs
process.loadEnvFile(".env");

const WABA_ID = process.env.WHATSAPP_WABA_ID ?? "1101406482884705"; // "Identificação da conta de mensagens"
const graph = `https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v25.0"}`;
const headers = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };

const resp = await fetch(`${graph}/${WABA_ID}/subscribed_apps`, { method: "POST", headers });
const json = await resp.json();
console.log(resp.ok ? "✅ App assinado na conta do WhatsApp." : `❌ Erro: ${json.error?.message}`);

const lista = await (await fetch(`${graph}/${WABA_ID}/subscribed_apps`, { headers })).json();
console.log("Apps assinados agora:", (lista.data ?? []).map((a) => a.whatsapp_business_api_data?.name).join(", "));

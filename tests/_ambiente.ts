// Importado primeiro por todo arquivo de teste: cada arquivo roda num processo próprio, com um banco
// SQLite novo numa pasta temporária e sem nenhuma chave de API (o extrator usa as palavras-chave).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "outflow-teste-"));
export const ARQUIVO_DB = path.join(pasta, "teste.db");

for (const chave of [
  "ANTHROPIC_API_KEY",
  "GROQ_API_KEY",
  "TRANSCRICAO_API_KEY",
  "TRANSCRICAO_URL",
  "WHATSAPP_TOKEN",
  "PHONE_NUMBER_ID",
  "MEU_NUMERO",
  "ORCAMENTO_MENSAL",
  "CODIGO_CONVITE",
  "DISCORD_WEBHOOK_URL",
  "DATABASE_AUTH_TOKEN",
])
  delete process.env[chave];
process.env.DATABASE_URL = `file:${ARQUIVO_DB.replace(/\\/g, "/")}`;

process.on("exit", () => {
  try {
    fs.rmSync(pasta, { recursive: true, force: true });
  } catch {
    // no Windows o arquivo ainda está aberto pelo banco ao sair; fica na pasta temporária do sistema
  }
});

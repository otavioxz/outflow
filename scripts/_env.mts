// Carrega as variáveis de ambiente dos scripts de terminal.
//   - sempre: .env (o do seu computador)
//   - com --prod: .env.producao por cima, para mexer no banco do Turso (o que a Vercel usa)
import fs from "node:fs";
import { parseEnv } from "node:util";

export const EM_PRODUCAO = process.argv.includes("--prod");

function carregar(arquivo: string, obrigatorio: boolean) {
  if (!fs.existsSync(arquivo)) {
    if (obrigatorio) {
      console.error(`❌ Arquivo ${arquivo} não encontrado. Crie com DATABASE_URL e DATABASE_AUTH_TOKEN do Turso.`);
      process.exit(1);
    }
    return;
  }
  Object.assign(process.env, parseEnv(fs.readFileSync(arquivo, "utf8")));
}

carregar(".env", false);
if (EM_PRODUCAO) {
  carregar(".env.producao", true);
  console.log(`🌐 Usando o banco de produção: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, "//***@")}\n`);
}

/** Argumentos sem as flags (--prod). */
export const argumentos = process.argv.slice(2).filter((a) => !a.startsWith("--"));

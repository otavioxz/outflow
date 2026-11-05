// Copia os dados do banco local (financas.db) para o banco online do Turso.
// Lê o destino do .env.producao (DATABASE_URL=libsql://... e DATABASE_AUTH_TOKEN=...).
//
//   npm run migrar
//
// Pode rodar mais de uma vez: o que já existe no Turso não é duplicado.
import fs from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@libsql/client";

if (!fs.existsSync(".env.producao")) {
  console.error("❌ Crie o arquivo .env.producao com DATABASE_URL e DATABASE_AUTH_TOKEN do Turso.");
  process.exit(1);
}
const producao = parseEnv(fs.readFileSync(".env.producao", "utf8"));
if (!producao.DATABASE_URL?.startsWith("libsql://") || !producao.DATABASE_AUTH_TOKEN) {
  console.error("❌ O .env.producao precisa de DATABASE_URL=libsql://... e DATABASE_AUTH_TOKEN=...");
  process.exit(1);
}

const local = createClient({ url: "file:financas.db" });

// Cria as tabelas no Turso usando o mesmo código do app
process.env.DATABASE_URL = producao.DATABASE_URL;
process.env.DATABASE_AUTH_TOKEN = producao.DATABASE_AUTH_TOKEN;
const { prepararDb } = await import("../src/lib/db");
const remoto = await prepararDb();

// Sessões e tentativas de login não são copiadas: você só precisa entrar de novo no site.
const TABELAS = ["usuarios", "gastos", "guardados", "configuracoes", "configuracoes_usuario", "mensagens_processadas"];

for (const tabela of TABELAS) {
  const { rows, columns } = await local.execute(`SELECT * FROM ${tabela}`);
  if (rows.length === 0) {
    console.log(`• ${tabela}: vazia`);
    continue;
  }
  const sql = `INSERT OR IGNORE INTO ${tabela} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  const resultado = await remoto.batch(
    rows.map((linha) => ({ sql, args: columns.map((c) => linha[c] ?? null) })),
    "write",
  );
  const novos = resultado.reduce((s, r) => s + r.rowsAffected, 0);
  console.log(`• ${tabela}: ${novos} copiado(s), ${rows.length - novos} já existia(m)`);
}

console.log("\n✅ Migração concluída.");

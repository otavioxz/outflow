import { createClient, type Client } from "@libsql/client";

// Local: arquivo SQLite. Na nuvem: URL do Turso (libsql://...) + DATABASE_AUTH_TOKEN.
const globalDb = globalThis as unknown as { _db?: Client; _dbPronto?: Promise<void> };

export function db(): Client {
  globalDb._db ??= createClient({
    url: process.env.DATABASE_URL ?? "file:financas.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return globalDb._db;
}

/** Cria as tabelas na primeira vez que o app usa o banco. */
export async function prepararDb(): Promise<Client> {
  globalDb._dbPronto ??= db()
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          valor_centavos INTEGER NOT NULL,
          descricao TEXT NOT NULL,
          categoria TEXT NOT NULL,
          pagamento TEXT NOT NULL DEFAULT 'nao_informado',
          data TEXT NOT NULL,
          origem TEXT NOT NULL DEFAULT 'texto',
          mensagem_original TEXT,
          mensagem_id TEXT,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos(data)`,
        // Guarda os IDs de mensagens já processadas: a Meta pode reenviar o mesmo webhook
        `CREATE TABLE IF NOT EXISTS mensagens_processadas (
          id TEXT PRIMARY KEY,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        // Login: quem pode acessar o painel (cadastro só pelo terminal: npm run usuario)
        `CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          nome TEXT NOT NULL,
          senha_hash TEXT NOT NULL,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        // Configurações editáveis pelo painel (ex.: orçamento mensal)
        `CREATE TABLE IF NOT EXISTS configuracoes (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        // Andamento de cada mensagem do WhatsApp (o painel mostra "processando" e o resultado)
        `CREATE TABLE IF NOT EXISTS atividades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mensagem_id TEXT UNIQUE,
          origem TEXT NOT NULL,
          status TEXT NOT NULL,
          titulo TEXT NOT NULL,
          detalhe TEXT,
          criada_em INTEGER NOT NULL,
          atualizada_em INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_atividades_atualizada ON atividades(atualizada_em)`,
        // Limite de tentativas de login (fica no banco para valer mesmo com o servidor reiniciando)
        `CREATE TABLE IF NOT EXISTS tentativas_login (
          chave TEXT PRIMARY KEY,
          erros INTEGER NOT NULL,
          primeira_em INTEGER NOT NULL,
          bloqueado_ate INTEGER NOT NULL DEFAULT 0
        )`,
        // Guardamos só o hash do token da sessão; o token em si fica apenas no cookie do navegador
        `CREATE TABLE IF NOT EXISTS sessoes (
          token_hash TEXT PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          expira_em TEXT NOT NULL,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      ],
      "write",
    )
    .then(() => undefined);
  await globalDb._dbPronto;
  return db();
}

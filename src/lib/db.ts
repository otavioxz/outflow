import { createClient, type Client } from "@libsql/client";
import { normalizarNumero } from "./telefone";

// Local: arquivo SQLite. Na nuvem: URL do Turso (libsql://...) + DATABASE_AUTH_TOKEN.
const globalDb = globalThis as unknown as { _db?: Client; _dbPronto?: Promise<void> };

export function db(): Client {
  globalDb._db ??= createClient({
    url: process.env.DATABASE_URL ?? "file:financas.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return globalDb._db;
}

async function adicionarColuna(tabela: string, coluna: string, tipo: string): Promise<void> {
  const colunas = await db().execute(`PRAGMA table_info(${tabela})`);
  if (!colunas.rows.some((c) => c.name === coluna)) await db().execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
}

/** Colunas adicionadas depois que as tabelas já existiam em produção (CREATE TABLE IF NOT EXISTS não as cria). */
async function migrarColunas(): Promise<void> {
  // Chave de acesso da nota fiscal: evita registrar a mesma nota duas vezes
  await adicionarColuna("gastos", "chave_nota", "TEXT");
  // Multiusuário: cada lançamento tem dono, e o WhatsApp de cada usuário é ligado por um código
  for (const tabela of ["gastos", "guardados", "atividades"]) await adicionarColuna(tabela, "usuario_id", "INTEGER");
  await adicionarColuna("usuarios", "telefone", "TEXT");
  await adicionarColuna("usuarios", "codigo_vinculo", "TEXT");
  await adicionarColuna("usuarios", "codigo_expira_em", "INTEGER");
  // Foto de perfil (WebP de 256x256, ~15 KB) e a versão, que muda a cada troca para o navegador não usar a antiga
  await adicionarColuna("usuarios", "foto", "BLOB");
  await adicionarColuna("usuarios", "foto_versao", "INTEGER");

  await db().batch(
    [
      `DROP INDEX IF EXISTS idx_gastos_chave_nota`, // versão antiga, sem o usuário
      `CREATE INDEX IF NOT EXISTS idx_gastos_usuario_chave_nota ON gastos(usuario_id, chave_nota) WHERE chave_nota IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_gastos_usuario_data ON gastos(usuario_id, data)`,
      `CREATE INDEX IF NOT EXISTS idx_guardados_usuario_data ON guardados(usuario_id, data)`,
      `CREATE INDEX IF NOT EXISTS idx_atividades_usuario ON atividades(usuario_id, atualizada_em)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_telefone ON usuarios(telefone) WHERE telefone IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo_vinculo) WHERE codigo_vinculo IS NOT NULL`,
    ],
    "write",
  );
  await migrarParaMultiusuario();
}

/**
 * Uma vez só: quando o app era de um usuário, nada tinha dono. Tudo o que já existe passa para o
 * primeiro usuário cadastrado, junto com as configurações globais e o número de MEU_NUMERO.
 */
async function migrarParaMultiusuario(): Promise<void> {
  const feita = await db().execute(`SELECT 1 FROM configuracoes WHERE chave = 'migracao_multiusuario'`);
  if (feita.rows.length) return;
  const dono = (await db().execute(`SELECT MIN(id) AS id FROM usuarios`)).rows[0]?.id;
  if (dono == null) {
    // Banco novo, sem dados antigos: nada a migrar
    await db().execute(`INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('migracao_multiusuario', 'sem dados')`);
    return;
  }

  const telefone = normalizarNumero((process.env.MEU_NUMERO ?? "").split(",")[0]) || null;
  const orcamento = Math.round(Number(process.env.ORCAMENTO_MENSAL) * 100) || 0;
  await db().batch(
    [
      { sql: `UPDATE gastos SET usuario_id = ? WHERE usuario_id IS NULL`, args: [dono] },
      { sql: `UPDATE guardados SET usuario_id = ? WHERE usuario_id IS NULL`, args: [dono] },
      `DELETE FROM atividades WHERE usuario_id IS NULL`, // só avisos de poucos minutos: não vale migrar
      {
        sql: `INSERT OR IGNORE INTO configuracoes_usuario (usuario_id, chave, valor)
              SELECT ?, chave, valor FROM configuracoes WHERE chave IN ('orcamento_centavos', 'meta_guardado_centavos')`,
        args: [dono],
      },
      // Orçamento que vinha do .env (ORCAMENTO_MENSAL), se nunca foi salvo pelo painel
      ...(orcamento
        ? [{ sql: `INSERT OR IGNORE INTO configuracoes_usuario (usuario_id, chave, valor) VALUES (?, 'orcamento_centavos', ?)`, args: [dono, String(orcamento)] }]
        : []),
      ...(telefone
        ? [{ sql: `UPDATE usuarios SET telefone = ? WHERE id = ? AND telefone IS NULL`, args: [telefone, dono] }]
        : []),
      `INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('migracao_multiusuario', datetime('now'))`,
    ],
    "write",
  );
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
        // Dinheiro guardado (poupança, reserva...): fica fora dos totais de gastos e do orçamento
        `CREATE TABLE IF NOT EXISTS guardados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          valor_centavos INTEGER NOT NULL,
          descricao TEXT NOT NULL,
          data TEXT NOT NULL,
          origem TEXT NOT NULL DEFAULT 'texto',
          mensagem_original TEXT,
          mensagem_id TEXT,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_guardados_data ON guardados(data)`,
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
        // Configurações de cada usuário, editáveis pelo painel (orçamento mensal, meta de guardar...)
        `CREATE TABLE IF NOT EXISTS configuracoes_usuario (
          usuario_id INTEGER NOT NULL,
          chave TEXT NOT NULL,
          valor TEXT,
          atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (usuario_id, chave)
        )`,
        // Convites de uso único que o admin gera no painel para alguém criar conta
        `CREATE TABLE IF NOT EXISTS convites (
          codigo TEXT PRIMARY KEY,
          criado_por INTEGER NOT NULL,
          criado_em INTEGER NOT NULL,
          expira_em INTEGER NOT NULL,
          usado_em INTEGER,
          usado_por INTEGER
        )`,
        // Configurações do sistema (ex.: controle de migrações). Antes guardava também o orçamento.
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
    .then(migrarColunas);
  await globalDb._dbPronto;
  return db();
}

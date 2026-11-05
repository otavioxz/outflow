import { ARQUIVO_DB } from "./_ambiente";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createClient } from "@libsql/client";

// Regressão da migração para multiusuário: um banco no formato antigo (um usuário só, nada com dono)
// precisa continuar funcionando, com tudo passando para o primeiro usuário.

const mes = "2026-10";

before(async () => {
  process.env.MEU_NUMERO = "5547988860118";
  process.env.ORCAMENTO_MENSAL = "2500";
  const antigo = createClient({ url: `file:${ARQUIVO_DB.replace(/\\/g, "/")}` });
  await antigo.batch(
    [
      `CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL,
        senha_hash TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, valor_centavos INTEGER NOT NULL, descricao TEXT NOT NULL,
        categoria TEXT NOT NULL, pagamento TEXT NOT NULL DEFAULT 'nao_informado', data TEXT NOT NULL, origem TEXT NOT NULL DEFAULT 'texto',
        mensagem_original TEXT, mensagem_id TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE guardados (id INTEGER PRIMARY KEY AUTOINCREMENT, valor_centavos INTEGER NOT NULL, descricao TEXT NOT NULL,
        data TEXT NOT NULL, origem TEXT NOT NULL DEFAULT 'texto', mensagem_original TEXT, mensagem_id TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')))`,
      `CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT NOT NULL DEFAULT (datetime('now')))`,
      `INSERT INTO usuarios (email, nome, senha_hash) VALUES ('dono@teste.com', 'Dono', 'x')`,
      `INSERT INTO gastos (valor_centavos, descricao, categoria, data) VALUES (4500, 'iFood', 'Alimentação', '2026-10-05')`,
      `INSERT INTO gastos (valor_centavos, descricao, categoria, data) VALUES (20000, 'Mercado', 'Mercado', '2026-10-06')`,
      `INSERT INTO guardados (valor_centavos, descricao, data) VALUES (50000, 'Poupança', '2026-10-07')`,
      `INSERT INTO configuracoes (chave, valor) VALUES ('meta_guardado_centavos', '100000')`,
    ],
    "write",
  );
  antigo.close();
});

describe("migração de um banco antigo", () => {
  it("passa os lançamentos e as configurações para o primeiro usuário", async () => {
    const { totalDoMes } = await import("../src/lib/gastos");
    const { totalGuardadoNoMes } = await import("../src/lib/guardados");
    const { obterMetaGuardadoCentavos, obterOrcamentoCentavos } = await import("../src/lib/configuracoes");
    assert.equal(await totalDoMes(1, mes), 24500);
    assert.equal(await totalGuardadoNoMes(1, mes), 50000);
    assert.equal(await obterMetaGuardadoCentavos(1), 100000);
    assert.equal(await obterOrcamentoCentavos(1), 250000); // vinha do ORCAMENTO_MENSAL
  });

  it("o WhatsApp de MEU_NUMERO continua funcionando para o dono", async () => {
    const { usuarioPorTelefone } = await import("../src/lib/usuarios");
    assert.equal((await usuarioPorTelefone("5547988860118"))?.email, "dono@teste.com");
  });

  it("roda uma vez só: desvincular não é desfeito na próxima inicialização", async () => {
    const { desvincularTelefone } = await import("../src/lib/vinculo");
    const { usuarioPorTelefone } = await import("../src/lib/usuarios");
    await desvincularTelefone(1);

    // simula o servidor reiniciando: a preparação do banco roda de novo
    const global = globalThis as unknown as { _dbPronto?: Promise<void> };
    global._dbPronto = undefined;
    const { prepararDb } = await import("../src/lib/db");
    await prepararDb();
    assert.equal(await usuarioPorTelefone("5547988860118"), null);
  });

  it("lançamentos novos depois da migração já nascem com dono", async () => {
    const { adicionarUsuario } = await import("../src/lib/usuarios");
    const { inserirGastos, totalDoMes } = await import("../src/lib/gastos");
    const novo = await adicionarUsuario("novo@teste.com", "Novo", "senha-bem-comprida-123");
    await inserirGastos(novo, [{ valor_centavos: 999, descricao: "Teste", categoria: "Outros", pagamento: "pix", data: "2026-10-10", origem: "texto" }]);
    assert.equal(await totalDoMes(novo, mes), 999);
    assert.equal(await totalDoMes(1, mes), 24500);
  });
});

import "./_ambiente";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { atividadesRecentes, concluirAtividade, iniciarAtividade } from "../src/lib/atividades";
import { processarMensagem } from "../src/lib/bot";
import { hojeISO } from "../src/lib/categorias";
import { definirMetaGuardadoCentavos, definirOrcamentoCentavos, obterMetaGuardadoCentavos, obterOrcamentoCentavos } from "../src/lib/configuracoes";
import { apagarGasto, desfazerUltimo, gastoDaNota, gastosDoMes, inserirGastos, totalDoMes, versaoDosDados } from "../src/lib/gastos";
import { apagarGuardado, guardadosDoMes, totalGuardadoNoMes } from "../src/lib/guardados";
import { removerUsuario } from "../src/lib/usuarios";
import { criarUsuario, texto } from "./_fabrica";

// O teste mais importante do multiusuário: nada que um usuário faça pode aparecer, mudar ou ser
// apagado na conta de outro.

const mes = hojeISO().slice(0, 7);
let ana: number;
let beto: number;

before(async () => {
  ana = await criarUsuario("Ana");
  beto = await criarUsuario("Beto");
  await processarMensagem(texto("gastei 45 no ifood"), ana);
  await processarMensagem(texto("mercado 200"), ana);
  await processarMensagem(texto("guardei 500 na poupança"), ana);
  await processarMensagem(texto("uber 30"), beto);
});

describe("isolamento entre usuários", () => {
  it("cada um vê só os próprios gastos e totais", async () => {
    assert.deepEqual((await gastosDoMes(ana, mes)).map((g) => g.valor_centavos).sort(), [20000, 4500]);
    assert.deepEqual((await gastosDoMes(beto, mes)).map((g) => g.valor_centavos), [3000]);
    assert.equal(await totalDoMes(ana, mes), 24500);
    assert.equal(await totalDoMes(beto, mes), 3000);
  });

  it("dinheiro guardado também é separado", async () => {
    assert.equal(await totalGuardadoNoMes(ana, mes), 50000);
    assert.equal(await totalGuardadoNoMes(beto, mes), 0);
    assert.equal((await guardadosDoMes(beto, mes)).length, 0);
  });

  it("ninguém apaga lançamento de outro, mesmo sabendo o id", async () => {
    const [gastoDaAna] = await gastosDoMes(ana, mes);
    assert.equal(await apagarGasto(beto, gastoDaAna.id), null);
    const [guardadoDaAna] = await guardadosDoMes(ana, mes);
    assert.equal(await apagarGuardado(beto, guardadoDaAna.id), null);
    assert.equal(await totalDoMes(ana, mes), 24500);
    assert.equal(await totalGuardadoNoMes(ana, mes), 50000);
  });

  it("desfazer apaga só o último lançamento de quem pediu", async () => {
    const extra = await criarUsuario("Caio");
    await processarMensagem(texto("cinema 60"), extra);
    await processarMensagem(texto("padaria 12"), ana); // o mais recente de todos é da Ana

    const apagado = await desfazerUltimo(extra);
    assert.equal(apagado?.valor_centavos, 6000);
    assert.equal(await desfazerUltimo(extra), null); // Caio não tem mais nada
    assert.equal(await totalDoMes(ana, mes), 25700); // a padaria da Ana continua lá
    await desfazerUltimo(ana);
  });

  it("resumo pelo WhatsApp mostra só os números de quem pediu", async () => {
    const r = await processarMensagem(texto("resumo"), beto);
    assert.match(r.resposta, /Total: R\$\s30,00/);
    assert.doesNotMatch(r.resposta, /Guardado/);
  });

  it("orçamento e meta são de cada um", async () => {
    await definirOrcamentoCentavos(ana, 300000);
    await definirMetaGuardadoCentavos(ana, 100000);
    assert.equal(await obterOrcamentoCentavos(ana), 300000);
    assert.equal(await obterOrcamentoCentavos(beto), 0);
    assert.equal(await obterMetaGuardadoCentavos(beto), 0);
  });

  it("a mesma nota fiscal pode ser registrada por pessoas diferentes", async () => {
    const chave = "4".repeat(44);
    const nota = { valor_centavos: 10870, descricao: "Mercado", categoria: "Mercado", pagamento: "debito", data: hojeISO(), origem: "nota", chave_nota: chave } as const;
    await inserirGastos(ana, [nota]);
    assert.ok(await gastoDaNota(ana, chave));
    assert.equal(await gastoDaNota(beto, chave), null);
  });

  it("avisos ao vivo do painel não vazam para outro usuário", async () => {
    const id = await iniciarAtividade(ana, "wamid.AVISO", "texto");
    await concluirAtividade(id, "gasto", "Gasto registrado");
    assert.ok((await atividadesRecentes(ana)).some((a) => a.id === id));
    assert.ok(!(await atividadesRecentes(beto)).some((a) => a.id === id));
  });

  it("o painel de um usuário não se atualiza com lançamentos de outro", async () => {
    const antes = await versaoDosDados(beto);
    await processarMensagem(texto("almoço 35"), ana);
    assert.equal(await versaoDosDados(beto), antes);
    await processarMensagem(texto("almoço 35"), beto);
    assert.notEqual(await versaoDosDados(beto), antes);
  });

  it("remover um usuário apaga os dados dele e só os dele", async () => {
    const diego = await criarUsuario("Diego");
    await processarMensagem(texto("farmácia 80"), diego);
    const { prepararDb } = await import("../src/lib/db");
    const db = await prepararDb();
    const email = String((await db.execute({ sql: `SELECT email FROM usuarios WHERE id = ?`, args: [diego] })).rows[0].email);

    assert.equal(await removerUsuario(email), true);
    assert.equal((await gastosDoMes(diego, mes)).length, 0);
    assert.ok((await gastosDoMes(ana, mes)).length > 0);
  });
});

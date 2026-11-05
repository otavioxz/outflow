import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hojeISO } from "../src/lib/categorias";
import { extrairLancamentos, extratorAtivo } from "../src/lib/extrator";

// Sem chaves de API, os testes usam o extrator por palavras-chave: rápido, grátis e determinístico.

describe("extrator sem IA", () => {
  it("está ativo quando não há chave de API", () => {
    assert.equal(extratorAtivo(), "simples");
  });

  it("extrai valor, categoria e pagamento", async () => {
    const { gastos, guardados } = await extrairLancamentos("gastei 45,90 no ifood no pix");
    assert.equal(guardados.length, 0);
    assert.equal(gastos.length, 1);
    assert.equal(gastos[0].valor, 45.9);
    assert.equal(gastos[0].categoria, "Alimentação");
    assert.equal(gastos[0].pagamento, "pix");
    assert.equal(gastos[0].data, hojeISO());
  });

  it("entende milhar com ponto e acentos nas categorias", async () => {
    const { gastos } = await extrairLancamentos("aluguel 1.500");
    assert.equal(gastos[0].valor, 1500);
    assert.equal(gastos[0].categoria, "Moradia");
    const conta = await extrairLancamentos("paguei 120 de água");
    assert.equal(conta.gastos[0].categoria, "Contas");
  });

  it("usa a data de ontem quando a mensagem diz", async () => {
    const { gastos } = await extrairLancamentos("uber 18,50 ontem");
    const ontem = new Date(`${hojeISO()}T12:00:00`);
    ontem.setDate(ontem.getDate() - 1);
    assert.equal(gastos[0].data, ontem.toISOString().slice(0, 10));
  });

  it("separa dinheiro guardado dos gastos", async () => {
    const { gastos, guardados } = await extrairLancamentos("guardei 500 na poupança");
    assert.equal(gastos.length, 0);
    assert.deepEqual(guardados.map((g) => [g.valor, g.descricao]), [[500, "Poupança"]]);
    const reserva = await extrairLancamentos("separei 300 pra reserva");
    assert.equal(reserva.guardados[0].descricao, "Reserva");
  });

  it("não registra retirada da poupança", async () => {
    const r = await extrairLancamentos("tirei 200 da poupança");
    assert.equal(r.gastos.length + r.guardados.length, 0);
  });

  it("não inventa gasto em mensagem sem valor", async () => {
    const r = await extrairLancamentos("bom dia, tudo bem?");
    assert.equal(r.gastos.length + r.guardados.length, 0);
  });
});

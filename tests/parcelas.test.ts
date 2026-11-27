import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processarMensagem } from "../src/lib/bot";
import { hojeISO } from "../src/lib/categorias";
import { extrairLancamentos } from "../src/lib/extrator";
import { apagarParcelamento, gastosDoMes, parcelasFuturas, totalDoMes } from "../src/lib/gastos";
import { dividirEmParcelas, somarMeses } from "../src/lib/parcelas";
import { criarUsuario, texto } from "./_fabrica";

const mesDe = (data: string, meses: number) => somarMeses(data, meses).slice(0, 7);

describe("divisão em parcelas", () => {
  it("a soma das parcelas é sempre o total, com a sobra na última", () => {
    const p = dividirEmParcelas(10000, 3, "2026-11-10");
    assert.deepEqual(
      p.map((x) => x.valor_centavos),
      [3333, 3333, 3334],
    );
    assert.deepEqual(
      p.map((x) => x.parcela),
      [1, 2, 3],
    );
    assert.equal(
      dividirEmParcelas(500000, 10, "2026-11-10").reduce((s, x) => s + x.valor_centavos, 0),
      500000,
    );
  });

  it("uma parcela por mês, no mesmo dia (ou no último dia dos meses mais curtos)", () => {
    assert.deepEqual(
      dividirEmParcelas(4000, 4, "2026-11-30").map((x) => x.data),
      ["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"],
    );
    assert.equal(somarMeses("2027-12-31", 2), "2028-02-29"); // ano bissexto
  });
});

describe("extrator sem IA: parcelamento", () => {
  it('"5000 em 10x": o valor é o total', async () => {
    const { gastos } = await extrairLancamentos("5000 reais parcelado em 10x no cartão de credito");
    assert.equal(gastos.length, 1);
    assert.equal(gastos[0].valor, 5000);
    assert.equal(gastos[0].parcelas, 10);
    assert.equal(gastos[0].valor_e_da_parcela, false);
    assert.equal(gastos[0].pagamento, "credito");
  });

  it('"10x de 50,00": o valor é o de cada parcela', async () => {
    const { gastos } = await extrairLancamentos("parcelado 10x de 50,00 no cartao");
    assert.equal(gastos[0].valor, 50);
    assert.equal(gastos[0].parcelas, 10);
    assert.equal(gastos[0].valor_e_da_parcela, true);
  });

  it("parcelado sem forma de pagamento vira crédito; à vista continua igual", async () => {
    const [parcelado] = (await extrairLancamentos("tv 3000 em 12 vezes")).gastos;
    assert.equal(parcelado.parcelas, 12);
    assert.equal(parcelado.pagamento, "credito");
    assert.equal(parcelado.descricao, "Tv");

    const [aVista] = (await extrairLancamentos("gastei 45 no ifood")).gastos;
    assert.equal(aVista.parcelas, 1);
    assert.equal(aVista.pagamento, "nao_informado");
  });
});

describe("bot: compra parcelada", () => {
  it("lança uma parcela em cada mês e responde com o resumo", async () => {
    const ana = await criarUsuario("Ana");
    const hoje = hojeISO();
    const r = await processarMensagem(texto("notebook 5000 em 10x"), ana);
    assert.equal(r.tipo, "gasto");
    assert.match(r.resposta, /10x de R\$\s?500,00, total R\$\s?5\.000,00/);

    const [esteMes] = await gastosDoMes(ana, hoje.slice(0, 7));
    assert.equal(esteMes.valor_centavos, 50000);
    assert.equal(esteMes.parcela, 1);
    assert.equal(esteMes.parcelas, 10);
    assert.equal(esteMes.total_compra, 500000);
    assert.equal(await totalDoMes(ana, hoje.slice(0, 7)), 50000); // só a parcela do mês conta

    const [ultima] = await gastosDoMes(ana, mesDe(hoje, 9));
    assert.equal(ultima.parcela, 10);
    assert.equal(await totalDoMes(ana, mesDe(hoje, 10)), 0);

    const futuras = await parcelasFuturas(ana, hoje.slice(0, 7));
    assert.equal(futuras.total, 450000);
    assert.equal(futuras.compras, 1);
    assert.equal(futuras.porMes.length, 9);
  });

  it('"10x de 50" registra R$ 500,00 no total', async () => {
    const ana = await criarUsuario("Ana");
    await processarMensagem(texto("parcelado 10x de 50,00 no cartao"), ana);
    const [g] = await gastosDoMes(ana, hojeISO().slice(0, 7));
    assert.equal(g.valor_centavos, 5000);
    assert.equal(g.total_compra, 50000);
  });

  it("desfazer apaga a compra parcelada inteira", async () => {
    const ana = await criarUsuario("Ana");
    await processarMensagem(texto("tv 3000 em 3x"), ana);
    const r = await processarMensagem(texto("desfazer"), ana);
    assert.match(r.resposta, /compra parcelada.*3x.*3\.000,00/);
    assert.equal((await parcelasFuturas(ana, hojeISO().slice(0, 7))).total, 0);
    assert.equal(await totalDoMes(ana, hojeISO().slice(0, 7)), 0);
  });

  it("recusa parcelamento acima do limite sem registrar nada", async () => {
    const ana = await criarUsuario("Ana");
    const r = await processarMensagem(texto("carro 90000 em 60x"), ana);
    assert.equal(r.tipo, "sem_gasto");
    assert.equal(await totalDoMes(ana, hojeISO().slice(0, 7)), 0);
  });

  it("um usuário não apaga o parcelamento de outro", async () => {
    const ana = await criarUsuario("Ana");
    const beto = await criarUsuario("Beto");
    await processarMensagem(texto("geladeira 2400 em 4x"), ana);
    const [g] = await gastosDoMes(ana, hojeISO().slice(0, 7));
    assert.deepEqual(await apagarParcelamento(beto, g.parcelamento_id!), []);
    assert.equal((await parcelasFuturas(ana, hojeISO().slice(0, 7))).total, 180000);
  });
});

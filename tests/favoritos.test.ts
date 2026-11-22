import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { definirFavorito, ehIndicador, listarFavoritos, paginaInicial } from "../src/lib/favoritos";
import { listarUsuarios, removerUsuario } from "../src/lib/usuarios";
import { criarUsuario } from "./_fabrica";

describe("favoritos", () => {
  it("sem favoritos o app abre em Gastos; com algum, em Favoritos", async () => {
    const ana = await criarUsuario("Ana");
    assert.equal(await paginaInicial(ana), "/gastos");
    await definirFavorito(ana, "guardado-mes", true);
    assert.equal(await paginaInicial(ana), "/favoritos");
    await definirFavorito(ana, "guardado-mes", false);
    assert.equal(await paginaInicial(ana), "/gastos");
  });

  it("mantém a ordem em que foram marcados, e remarcar vai para o fim", async () => {
    const ana = await criarUsuario("Ana");
    await definirFavorito(ana, "lista-gastos", true);
    await definirFavorito(ana, "gasto-mes", true);
    await definirFavorito(ana, "grafico-diario", true);
    await definirFavorito(ana, "gasto-mes", true); // repetido: não muda nada
    assert.deepEqual(await listarFavoritos(ana), ["lista-gastos", "gasto-mes", "grafico-diario"]);

    await definirFavorito(ana, "lista-gastos", false);
    await definirFavorito(ana, "lista-gastos", true);
    assert.deepEqual(await listarFavoritos(ana), ["gasto-mes", "grafico-diario", "lista-gastos"]);
  });

  it("os favoritos de um usuário não aparecem para outro e somem com a conta", async () => {
    const ana = await criarUsuario("Ana");
    const beto = await criarUsuario("Beto");
    await definirFavorito(ana, "gasto-mes", true);
    assert.deepEqual(await listarFavoritos(beto), []);

    const email = (await listarUsuarios()).find((u) => u.id === ana)!.email;
    await removerUsuario(email);
    assert.deepEqual(await listarFavoritos(ana), []);
  });

  it("só aceita indicadores conhecidos", () => {
    assert.ok(ehIndicador("lista-guardados"));
    assert.ok(!ehIndicador("qualquer-coisa"));
    assert.ok(!ehIndicador(undefined));
  });
});

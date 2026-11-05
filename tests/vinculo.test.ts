import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepararDb } from "../src/lib/db";
import { processarVinculo } from "../src/lib/bot";
import { atividadesRecentes } from "../src/lib/atividades";
import { usuarioPorTelefone } from "../src/lib/usuarios";
import { desvincularTelefone, estadoWhatsapp, gerarCodigoVinculo, vincularTelefone } from "../src/lib/vinculo";
import { criarUsuario } from "./_fabrica";

describe("vínculo do WhatsApp", () => {
  it("liga o número à conta dona do código", async () => {
    const ana = await criarUsuario("Ana");
    const { codigo } = await gerarCodigoVinculo(ana);
    assert.match(codigo, /^\d{6}$/);
    assert.equal((await estadoWhatsapp(ana)).codigo, codigo);

    const r = await vincularTelefone(codigo, "5547988880001");
    assert.equal(r.tipo, "vinculado");
    assert.equal((await usuarioPorTelefone("5547988880001"))?.id, ana);
    // a Meta às vezes entrega o mesmo celular sem o 9º dígito
    assert.equal((await usuarioPorTelefone("554788880001"))?.id, ana);

    const estado = await estadoWhatsapp(ana);
    assert.equal(estado.telefone, "554788880001");
    assert.equal(estado.codigo, null); // o código some depois de usado
  });

  it("o código é de uso único", async () => {
    const beto = await criarUsuario("Beto");
    const { codigo } = await gerarCodigoVinculo(beto);
    assert.equal((await vincularTelefone(codigo, "5511900000002")).tipo, "vinculado");
    assert.equal((await vincularTelefone(codigo, "5511900000003")).tipo, "codigo_invalido");
    assert.equal(await usuarioPorTelefone("5511900000003"), null);
  });

  it("código vencido não vale", async () => {
    const caio = await criarUsuario("Caio");
    const { codigo } = await gerarCodigoVinculo(caio);
    const db = await prepararDb();
    await db.execute({ sql: `UPDATE usuarios SET codigo_expira_em = ? WHERE id = ?`, args: [Date.now() - 1, caio] });
    assert.equal((await vincularTelefone(codigo, "5511900000004")).tipo, "codigo_invalido");
    assert.equal((await estadoWhatsapp(caio)).codigo, null);
  });

  it("um número não pode ser tomado por outra conta", async () => {
    const dono = await criarUsuario("Dono");
    const intruso = await criarUsuario("Intruso");
    await vincularTelefone((await gerarCodigoVinculo(dono)).codigo, "5511900000005");

    const r = await vincularTelefone((await gerarCodigoVinculo(intruso)).codigo, "5511900000005");
    assert.equal(r.tipo, "ja_vinculado");
    assert.equal((await usuarioPorTelefone("5511900000005"))?.id, dono);
    assert.equal((await estadoWhatsapp(intruso)).telefone, null);
  });

  it("trocar de número: o código novo liga o outro número à mesma conta", async () => {
    const eva = await criarUsuario("Eva");
    await vincularTelefone((await gerarCodigoVinculo(eva)).codigo, "5511900000006");
    await vincularTelefone((await gerarCodigoVinculo(eva)).codigo, "5511900000007");
    assert.equal(await usuarioPorTelefone("5511900000006"), null);
    assert.equal((await usuarioPorTelefone("5511900000007"))?.id, eva);
  });

  it("desvincular faz o número deixar de ser aceito", async () => {
    const fabi = await criarUsuario("Fabi");
    await vincularTelefone((await gerarCodigoVinculo(fabi)).codigo, "5511900000008");
    await desvincularTelefone(fabi);
    assert.equal(await usuarioPorTelefone("5511900000008"), null);
  });

  it("pela mensagem do WhatsApp: vincula e avisa no painel de quem gerou o código", async () => {
    const gil = await criarUsuario("Gil Souza");
    const { codigo } = await gerarCodigoVinculo(gil);
    const r = await processarVinculo(codigo, "5511900000009", "wamid.VINCULO_1");
    assert.equal(r.usuarioId, gil);
    assert.match(r.resposta, /Gil!/);
    assert.ok((await atividadesRecentes(gil)).some((a) => a.titulo === "WhatsApp vinculado"));
  });

  it("bloqueia quem tenta adivinhar códigos", async () => {
    const numero = "5511900000010";
    for (let i = 0; i < 5; i++) {
      const r = await processarVinculo("000000", numero, `wamid.CHUTE_${i}`);
      assert.match(r.resposta, /inválido/);
    }
    // a partir daqui nem um código certo é aceito por um tempo
    const hel = await criarUsuario("Hel");
    const r = await processarVinculo((await gerarCodigoVinculo(hel)).codigo, numero, "wamid.CHUTE_CERTO");
    assert.match(r.resposta, /Muitas tentativas/);
    assert.equal(await usuarioPorTelefone(numero), null);
  });
});

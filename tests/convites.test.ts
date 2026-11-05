import "./_ambiente";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { prepararDb } from "../src/lib/db";
import {
  cancelarConvite,
  concluirConvite,
  ehAdmin,
  gerarConvite,
  liberarConvite,
  listarConvites,
  normalizarCodigoConvite,
  reservarConvite,
} from "../src/lib/convites";
import { gerarCodigoVinculo, vincularTelefone } from "../src/lib/vinculo";
import { criarUsuario } from "./_fabrica";

let admin: number;
let comum: number;

before(async () => {
  process.env.MEU_NUMERO = "5547988860118";
  admin = await criarUsuario("Admin");
  comum = await criarUsuario("Comum");
  // a Meta entrega sem o 9º dígito: o admin tem que ser reconhecido mesmo assim
  await vincularTelefone((await gerarCodigoVinculo(admin)).codigo, "554788860118");
  await vincularTelefone((await gerarCodigoVinculo(comum)).codigo, "5511900000001");
});

describe("administrador", () => {
  it("é quem tem o WhatsApp de MEU_NUMERO vinculado", async () => {
    assert.equal(await ehAdmin(admin), true);
    assert.equal(await ehAdmin(comum), false);
  });

  it("sem MEU_NUMERO ninguém é admin", async () => {
    const antes = process.env.MEU_NUMERO;
    delete process.env.MEU_NUMERO;
    assert.equal(await ehAdmin(admin), false);
    process.env.MEU_NUMERO = antes;
  });

  it("conta sem WhatsApp vinculado não é admin", async () => {
    assert.equal(await ehAdmin(await criarUsuario("SemZap")), false);
  });
});

describe("convites", () => {
  it("têm um formato fácil de ler e digitar", async () => {
    const codigo = await gerarConvite(admin);
    assert.match(codigo, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(normalizarCodigoConvite(codigo.toLowerCase().replace("-", " ")), codigo);
  });

  it("valem uma vez só", async () => {
    const codigo = await gerarConvite(admin);
    assert.equal(await reservarConvite(codigo), true);
    assert.equal(await reservarConvite(codigo), false);
  });

  it("voltam a valer se o cadastro falhar no meio", async () => {
    const codigo = await gerarConvite(admin);
    await reservarConvite(codigo);
    await liberarConvite(codigo);
    assert.equal(await reservarConvite(codigo), true);
  });

  it("registram quem usou", async () => {
    const codigo = await gerarConvite(admin);
    await reservarConvite(codigo);
    const nova = await criarUsuario("Nova");
    await concluirConvite(codigo, nova);
    await liberarConvite(codigo); // depois de concluído, não pode mais ser liberado
    const item = (await listarConvites(admin)).find((c) => c.codigo === codigo);
    assert.equal(item?.usado_por_nome, "Nova");
    assert.equal(await reservarConvite(codigo), false);
  });

  it("vencidos não valem", async () => {
    const codigo = await gerarConvite(admin);
    const db = await prepararDb();
    await db.execute({ sql: `UPDATE convites SET expira_em = ? WHERE codigo = ?`, args: [Date.now() - 1, codigo] });
    assert.equal(await reservarConvite(codigo), false);
  });

  it("código inventado não vale", async () => {
    assert.equal(await reservarConvite("AAAA-BBBB"), false);
    assert.equal(await reservarConvite(""), false);
  });

  it("só quem criou cancela, e só se ainda não foi usado", async () => {
    const codigo = await gerarConvite(admin);
    assert.equal(await cancelarConvite(comum, codigo), false);
    assert.equal(await cancelarConvite(admin, codigo), true);
    assert.equal(await reservarConvite(codigo), false);

    const usado = await gerarConvite(admin);
    await reservarConvite(usado);
    assert.equal(await cancelarConvite(admin, usado), false);
  });
});

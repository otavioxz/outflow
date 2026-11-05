import "./_ambiente";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { formatarReais, lerReais } from "../src/lib/categorias";
import { mascararNumero, normalizarNumero, numeroParaEnvio } from "../src/lib/telefone";
import { problemaNaSenha } from "../src/lib/usuarios";
import { PADRAO_VINCULAR } from "../src/lib/vinculo";
import { assinaturaValida, segredoConfere } from "../src/lib/whatsapp";

describe("valores em reais", () => {
  it("lê os formatos que as pessoas digitam no painel", () => {
    assert.equal(lerReais("3.000,50"), 300050);
    assert.equal(lerReais("R$ 3000"), 300000);
    assert.equal(lerReais("3000.50"), 300050);
    assert.equal(lerReais("3.000"), 300000); // ponto de milhar, não decimal
    assert.equal(lerReais("45,9"), 4590);
    assert.equal(lerReais(""), 0); // vazio = remover
  });

  it("recusa o que não é valor", () => {
    assert.equal(lerReais("abc"), null);
    assert.equal(lerReais("-50"), null);
    assert.equal(lerReais("10,999"), null);
  });

  it("formata em reais", () => {
    assert.equal(formatarReais(4590).replace(/\s/g, " "), "R$ 45,90");
  });
});

describe("telefones", () => {
  it("trata o celular com e sem o 9º dígito como o mesmo número", () => {
    assert.equal(normalizarNumero("5547988860118"), "554788860118");
    assert.equal(normalizarNumero("554788860118"), "554788860118");
    assert.equal(normalizarNumero("+55 (47) 98886-0118"), "554788860118");
  });

  it("não mexe em números de outros países", () => {
    assert.equal(normalizarNumero("351912345678"), "351912345678");
    assert.equal(numeroParaEnvio("351912345678"), "351912345678");
  });

  it("recoloca o 9 antes de enviar para celular brasileiro", () => {
    assert.equal(numeroParaEnvio("554788860118"), "5547988860118");
    assert.equal(numeroParaEnvio("554733330000"), "554733330000"); // fixo: começa com 3, fica igual
  });

  it("mascara o número para exibir", () => {
    assert.equal(mascararNumero("554788860118"), "+55 47 9****-0118");
  });
});

describe("senhas", () => {
  it("exige 12+ caracteres e recusa senhas óbvias", () => {
    assert.match(problemaNaSenha("curta") ?? "", /12 caracteres/);
    assert.ok(problemaNaSenha("aaaaaaaaaaaaaa"));
    assert.ok(problemaNaSenha("123456789012345"));
    assert.equal(problemaNaSenha("uma senha bem razoável"), null);
  });
});

describe("comando vincular", () => {
  it("reconhece o código de 6 dígitos", () => {
    assert.equal("vincular 482913".match(PADRAO_VINCULAR)?.[1], "482913");
    assert.equal("  Vincular 000123 ".match(PADRAO_VINCULAR)?.[1], "000123");
  });

  it("não confunde com gastos nem aceita códigos de outro tamanho", () => {
    assert.equal(PADRAO_VINCULAR.test("vincular 12345"), false);
    assert.equal(PADRAO_VINCULAR.test("gastei 482913 no vincular"), false);
  });
});

describe("segredos", () => {
  it("compara segredos sem aceitar vazio", () => {
    assert.equal(segredoConfere("convite-123", "convite-123"), true);
    assert.equal(segredoConfere("convite-124", "convite-123"), false);
    assert.equal(segredoConfere("", "convite-123"), false);
    assert.equal(segredoConfere("x", undefined), false);
  });

  it("só aceita webhook com a assinatura da Meta", () => {
    process.env.APP_SECRET = "segredo-do-app";
    const corpo = JSON.stringify({ object: "whatsapp_business_account" });
    const assinatura = "sha256=" + crypto.createHmac("sha256", "segredo-do-app").update(corpo).digest("hex");
    assert.equal(assinaturaValida(corpo, assinatura), true);
    assert.equal(assinaturaValida(corpo + " ", assinatura), false);
    assert.equal(assinaturaValida(corpo, null), false);
    delete process.env.APP_SECRET;
  });
});

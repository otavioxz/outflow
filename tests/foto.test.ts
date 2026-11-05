import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerFoto, problemaNaFoto, removerFoto, salvarFoto, TAMANHO_MAXIMO_FOTO, tipoDaImagem } from "../src/lib/foto";
import { criarSessao, usuarioDaSessao } from "../src/lib/usuarios";
import { criarUsuario } from "./_fabrica";

// Cabeçalhos mínimos de cada formato (o resto do arquivo não importa para a validação)
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 "), 1, 2, 3]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = new Uint8Array([0x89, ...Buffer.from("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

describe("foto de perfil", () => {
  it("reconhece a imagem pelo conteúdo, não pelo nome", () => {
    assert.equal(tipoDaImagem(webp), "image/webp");
    assert.equal(tipoDaImagem(jpeg), "image/jpeg");
    assert.equal(tipoDaImagem(png), "image/png");
    assert.equal(tipoDaImagem(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  });

  it("recusa arquivo vazio, grande demais ou que não é imagem", () => {
    assert.ok(problemaNaFoto(new Uint8Array()));
    assert.ok(problemaNaFoto(new Uint8Array(TAMANHO_MAXIMO_FOTO + 1).fill(0xff)));
    assert.ok(problemaNaFoto(new TextEncoder().encode("%PDF-1.7")));
    assert.equal(problemaNaFoto(webp), null);
  });

  it("salva, aparece na sessão com versão nova e pode ser removida", async () => {
    const id = await criarUsuario("Foto");
    const { token } = await criarSessao(id);
    assert.equal((await usuarioDaSessao(token))?.fotoVersao, null);

    await salvarFoto(id, webp);
    const versao = (await usuarioDaSessao(token))?.fotoVersao;
    assert.ok(versao);
    const lida = await lerFoto(id);
    assert.equal(lida?.tipo, "image/webp");
    assert.deepEqual([...(lida?.bytes ?? [])], [...webp]);

    await removerFoto(id);
    assert.equal(await lerFoto(id), null);
    assert.equal((await usuarioDaSessao(token))?.fotoVersao, null);
  });

  it("a foto de um usuário não aparece para outro", async () => {
    const a = await criarUsuario("ComFoto");
    const b = await criarUsuario("SemFoto");
    await salvarFoto(a, jpeg);
    assert.equal(await lerFoto(b), null);
  });
});

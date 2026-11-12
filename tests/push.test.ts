import "./_ambiente";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enviarPush, inscricoesAtivas, lerInscricao, removerInscricao, salvarInscricao } from "../src/lib/push";
import { criarSessao, encerrarSessao } from "../src/lib/usuarios";
import { criarUsuario } from "./_fabrica";

let contador = 0;
function inscricao(host = "fcm.googleapis.com") {
  contador++;
  return { endpoint: `https://${host}/fcm/send/aparelho-${contador}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
}

describe("inscrição de push vinda do navegador", () => {
  it("aceita os serviços de push dos navegadores", () => {
    for (const host of ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "wns2-par02p.notify.windows.com"]) {
      assert.ok(lerInscricao(inscricao(host)), host);
    }
  });

  it("recusa endereços que não são de serviço de push", () => {
    const base = inscricao();
    const recusados = [
      "http://fcm.googleapis.com/fcm/send/x", // sem https
      "https://fcm.googleapis.com:8443/fcm/send/x", // porta diferente
      "https://localhost/push",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.exemplo.com/x",
      "https://exemplo.com/fcm.googleapis.com",
      "não é url",
    ];
    for (const endpoint of recusados) assert.equal(lerInscricao({ ...base, endpoint }), null, endpoint);
  });

  it("recusa chaves ausentes ou fora do formato", () => {
    const base = inscricao();
    assert.equal(lerInscricao(null), null);
    assert.equal(lerInscricao({ endpoint: base.endpoint }), null);
    assert.equal(lerInscricao({ ...base, keys: { p256dh: "com espaço", auth: base.keys.auth } }), null);
    assert.equal(lerInscricao({ ...base, keys: { p256dh: base.keys.p256dh, auth: "x".repeat(500) } }), null);
  });
});

describe("aparelhos que recebem push", () => {
  it("cada usuário só vê os próprios aparelhos", async () => {
    const ana = await criarUsuario("Ana");
    const beto = await criarUsuario("Beto");
    const { token: tokenAna } = await criarSessao(ana);
    const { token: tokenBeto } = await criarSessao(beto);
    const daAna = inscricao();
    await salvarInscricao(ana, tokenAna, daAna);
    await salvarInscricao(beto, tokenBeto, inscricao());

    assert.deepEqual((await inscricoesAtivas(ana)).map((i) => i.endpoint), [daAna.endpoint]);
    assert.equal((await inscricoesAtivas(beto)).length, 1);

    // um usuário não consegue apagar o aparelho do outro
    await removerInscricao(beto, daAna.endpoint);
    assert.equal((await inscricoesAtivas(ana)).length, 1);
  });

  it("sair da conta para de mandar push para aquele aparelho", async () => {
    const caio = await criarUsuario("Caio");
    const { token: celular } = await criarSessao(caio);
    const { token: computador } = await criarSessao(caio);
    await salvarInscricao(caio, celular, inscricao());
    await salvarInscricao(caio, computador, inscricao());
    assert.equal((await inscricoesAtivas(caio)).length, 2);

    await encerrarSessao(celular);
    assert.equal((await inscricoesAtivas(caio)).length, 1);
  });

  it("o mesmo aparelho logado em outra conta passa para a nova conta", async () => {
    const dani = await criarUsuario("Dani");
    const edu = await criarUsuario("Edu");
    const aparelho = inscricao();
    await salvarInscricao(dani, (await criarSessao(dani)).token, aparelho);
    await salvarInscricao(edu, (await criarSessao(edu)).token, aparelho);

    assert.equal((await inscricoesAtivas(dani)).length, 0);
    assert.deepEqual((await inscricoesAtivas(edu)).map((i) => i.endpoint), [aparelho.endpoint]);
  });

  it("sem as chaves VAPID, não envia nada nem dá erro", async () => {
    const fabi = await criarUsuario("Fabi");
    await salvarInscricao(fabi, (await criarSessao(fabi)).token, inscricao());
    assert.equal(await enviarPush(fabi, { titulo: "Teste" }), 0);
  });
});

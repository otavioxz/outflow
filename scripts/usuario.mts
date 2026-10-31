// Gerencia quem pode entrar no painel.
//
//   npm run usuario -- adicionar voce@email.com "Seu Nome"
//   npm run usuario -- senha voce@email.com
//   npm run usuario -- remover voce@email.com
//   npm run usuario -- listar
//
// Acrescente --prod para mexer nos usuários do banco online (Turso), lendo o .env.producao:
//   npm run usuario -- adicionar voce@email.com "Seu Nome" --prod
import { argumentos } from "./_env.mjs";
import readline from "node:readline";
import os from "node:os";
import { registrarEvento } from "../src/lib/log-discord";
import { adicionarUsuario, listarUsuarios, removerUsuario, trocarSenha } from "../src/lib/usuarios";

const MIN_SENHA = 12;
const origem = `terminal (${os.userInfo().username}@${os.hostname()})`;

/** Pergunta a senha sem mostrar o que é digitado. */
function perguntarSenha(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const original = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    let mudo = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (!mudo) original.call(rl, s);
    };
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(resposta);
    });
    mudo = true;
  });
}

async function pedirSenhaNova(): Promise<string> {
  const senha = await perguntarSenha(`Senha (mínimo ${MIN_SENHA} caracteres): `);
  if (senha.length < MIN_SENHA) throw new Error(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
  if (/^(.)\1+$/.test(senha) || /^(0?123456789|senha|password|qwerty)/i.test(senha)) {
    throw new Error("Essa senha é fácil demais de adivinhar.");
  }
  const confirmacao = await perguntarSenha("Repita a senha: ");
  if (senha !== confirmacao) throw new Error("As senhas não conferem.");
  return senha;
}

const [comando, email, ...resto] = argumentos;

try {
  switch (comando) {
    case "adicionar": {
      if (!email?.includes("@")) throw new Error('Uso: npm run usuario -- adicionar email@exemplo.com "Nome"');
      const nome = resto.join(" ") || email.split("@")[0];
      await adicionarUsuario(email.toLowerCase(), nome, await pedirSenhaNova());
      console.log(`✅ ${nome} <${email}> pode entrar no painel.`);
      await registrarEvento({
        titulo: "Acesso concedido a novo usuário",
        nivel: "alerta",
        campos: { Usuário: `${nome} <${email}>`, Origem: origem },
      });
      break;
    }
    case "senha": {
      if (!email) throw new Error("Uso: npm run usuario -- senha email@exemplo.com");
      if (!(await trocarSenha(email, await pedirSenhaNova()))) throw new Error(`Usuário ${email} não encontrado.`);
      console.log("✅ Senha trocada. As sessões abertas desse usuário foram encerradas.");
      await registrarEvento({ titulo: "Senha trocada", nivel: "info", campos: { Usuário: email, Origem: origem } });
      break;
    }
    case "remover": {
      if (!email) throw new Error("Uso: npm run usuario -- remover email@exemplo.com");
      if (!(await removerUsuario(email))) throw new Error(`Usuário ${email} não encontrado.`);
      console.log(`🗑️ ${email} não tem mais acesso.`);
      await registrarEvento({ titulo: "Acesso removido", nivel: "alerta", campos: { Usuário: email, Origem: origem } });
      break;
    }
    case "listar": {
      const usuarios = await listarUsuarios();
      if (usuarios.length === 0) console.log('Ninguém cadastrado ainda. Use: npm run usuario -- adicionar email "Nome"');
      for (const u of usuarios) console.log(`• ${u.nome} <${u.email}> (desde ${u.criado_em.slice(0, 10)})`);
      break;
    }
    default:
      console.log(`Comandos:
  npm run usuario -- adicionar email@exemplo.com "Nome"   dá acesso a alguém
  npm run usuario -- senha email@exemplo.com              troca a senha
  npm run usuario -- remover email@exemplo.com            tira o acesso
  npm run usuario -- listar                               mostra quem tem acesso`);
  }
} catch (erro) {
  const msg = erro instanceof Error ? erro.message : String(erro);
  console.error(`❌ ${msg.includes("UNIQUE") ? `O e-mail ${email} já está cadastrado.` : msg}`);
  process.exitCode = 1;
}

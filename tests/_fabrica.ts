// Atalhos para montar cenários nos testes.
import type { MensagemWhatsApp } from "../src/lib/whatsapp";
import { adicionarUsuario } from "../src/lib/usuarios";

let contador = 0;

export async function criarUsuario(nome: string): Promise<number> {
  contador++;
  return adicionarUsuario(`${nome.toLowerCase()}${contador}@teste.com`, nome, "senha-bem-comprida-123");
}

export function texto(body: string, from = "5511999990000"): MensagemWhatsApp {
  contador++;
  return { id: `wamid.TESTE_${contador}`, from, timestamp: "0", type: "text", text: { body } };
}

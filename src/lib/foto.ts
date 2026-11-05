import { prepararDb } from "./db";

// Foto de perfil guardada no próprio banco. O navegador já recorta e reduz para 256x256 antes de
// enviar (~15 KB); aqui só conferimos que é mesmo uma imagem pequena antes de salvar.

export const TAMANHO_MAXIMO_FOTO = 300 * 1024;

/** Tipo da imagem pelos primeiros bytes (não confiamos no nome nem no tipo que o navegador informa). */
export function tipoDaImagem(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  const ascii = (inicio: number, fim: number) => String.fromCharCode(...bytes.subarray(inicio, fim));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  return null;
}

/** Motivo pelo qual o arquivo não serve como foto (null = ok). */
export function problemaNaFoto(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "Nenhuma imagem enviada.";
  if (bytes.length > TAMANHO_MAXIMO_FOTO) return "A imagem é grande demais.";
  if (!tipoDaImagem(bytes)) return "O arquivo não é uma imagem (use JPG, PNG ou WebP).";
  return null;
}

/** Salva a foto e retorna a nova versão (usada na URL para o navegador não mostrar a antiga). */
export async function salvarFoto(usuarioId: number, bytes: Uint8Array): Promise<number> {
  const db = await prepararDb();
  const versao = Date.now();
  await db.execute({ sql: `UPDATE usuarios SET foto = ?, foto_versao = ? WHERE id = ?`, args: [bytes, versao, usuarioId] });
  return versao;
}

export async function removerFoto(usuarioId: number): Promise<void> {
  const db = await prepararDb();
  await db.execute({ sql: `UPDATE usuarios SET foto = NULL, foto_versao = NULL WHERE id = ?`, args: [usuarioId] });
}

export async function lerFoto(usuarioId: number): Promise<{ bytes: Uint8Array<ArrayBuffer>; tipo: string } | null> {
  const db = await prepararDb();
  const r = await db.execute({ sql: `SELECT foto FROM usuarios WHERE id = ?`, args: [usuarioId] });
  const foto = r.rows[0]?.foto;
  if (!(foto instanceof ArrayBuffer)) return null;
  const bytes = new Uint8Array(foto);
  const tipo = tipoDaImagem(bytes);
  return tipo ? { bytes, tipo } : null;
}

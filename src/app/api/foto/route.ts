import { usuarioAtual } from "@/lib/auth";
import { lerFoto } from "@/lib/foto";

// Foto de perfil de quem está logado. A URL leva a versão (?v=...), que muda a cada troca:
// por isso o navegador pode guardar a imagem em cache sem nunca mostrar uma foto antiga.
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) return new Response(null, { status: 401 });
  const foto = await lerFoto(usuario.id);
  if (!foto) return new Response(null, { status: 404 });
  return new Response(foto.bytes, {
    headers: {
      "Content-Type": foto.tipo,
      // "private": só o navegador do próprio usuário guarda; nenhum cache compartilhado
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

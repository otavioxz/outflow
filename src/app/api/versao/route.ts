import { atividadesRecentes } from "@/lib/atividades";
import { usuarioAtual } from "@/lib/auth";
import { versaoDosDados } from "@/lib/gastos";

// O dashboard consulta esta rota a cada poucos segundos: "versao" diz se os dados mudaram
// (para atualizar a tela) e "atividades" traz o andamento das mensagens do WhatsApp (avisos na tela).
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) return Response.json({ erro: "Não autenticado" }, { status: 401 });
  const [versao, atividades] = await Promise.all([versaoDosDados(usuario.id), atividadesRecentes(usuario.id)]);
  return Response.json({ versao, atividades }, { headers: { "Cache-Control": "no-store" } });
}

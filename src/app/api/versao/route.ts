import { atividadesRecentes } from "@/lib/atividades";
import { usuarioAtual } from "@/lib/auth";
import { versaoDosDados } from "@/lib/gastos";

// O dashboard consulta esta rota a cada poucos segundos: "versao" diz se os dados mudaram
// (para atualizar a tela) e "atividades" traz o andamento das mensagens do WhatsApp (avisos na tela).
export async function GET() {
  if (!(await usuarioAtual())) return Response.json({ erro: "Não autenticado" }, { status: 401 });
  const [versao, atividades] = await Promise.all([versaoDosDados(), atividadesRecentes()]);
  return Response.json({ versao, atividades }, { headers: { "Cache-Control": "no-store" } });
}

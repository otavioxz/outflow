import { usuarioAtual } from "@/lib/auth";
import { versaoDosDados } from "@/lib/gastos";

// O dashboard consulta esta rota a cada poucos segundos para saber se precisa se atualizar
export async function GET() {
  if (!(await usuarioAtual())) return Response.json({ erro: "Não autenticado" }, { status: 401 });
  return Response.json({ versao: await versaoDosDados() }, { headers: { "Cache-Control": "no-store" } });
}

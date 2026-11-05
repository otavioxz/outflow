import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/lib/requisicao";

// Checagem otimista: sem cookie de sessão, nem chega a renderizar a página.
// A validação de verdade (sessão existe e não expirou) acontece no servidor, em exigirUsuario().
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE_SESSAO)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ erro: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Tudo exige login, menos as telas de login e de cadastro, a política de privacidade, a exclusão de dados, o webhook do WhatsApp (protegido pela assinatura da Meta),
  // o registro de visitas (que também precisa registrar quem abre a tela de login)
  // e os arquivos estáticos (qualquer caminho com extensão: logo, ícones, robots.txt...)
  matcher: ["/((?!login|cadastro|privacidade|exclusao-de-dados|api/webhook|api/visita|_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};

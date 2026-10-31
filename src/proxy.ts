import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: sem cookie de sessão, nem chega a renderizar a página.
// A validação de verdade (sessão existe e não expirou) acontece no servidor, em exigirUsuario().
export function proxy(request: NextRequest) {
  if (request.cookies.has("sessao")) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ erro: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Tudo exige login, menos a tela de login, o webhook do WhatsApp (protegido pela assinatura da Meta)
  // e os arquivos estáticos (qualquer caminho com extensão: logo, ícones...)
  matcher: ["/((?!login|api/webhook|_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};

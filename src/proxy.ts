import { NextResponse, type NextRequest } from "next/server";
import { paginaInicial } from "@/lib/favoritos";
import { COOKIE_SESSAO } from "@/lib/requisicao";
import { usuarioDaSessao } from "@/lib/usuarios";

// Checagem otimista: sem cookie de sessão, nem chega a renderizar a página.
// A validação de verdade (sessão existe e não expirou) acontece no servidor, em exigirUsuario().
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  if (token) {
    // Abrir o app ("/") leva direto para Favoritos (se houver algum) ou Gastos, num redirecionamento
    // HTTP: sem mostrar outra tela antes. Sessão inválida segue para a página "/", que manda ao login.
    if (request.nextUrl.pathname === "/" && token.length <= 100) {
      const usuario = await usuarioDaSessao(token);
      if (usuario) {
        const destino = request.nextUrl.clone();
        destino.pathname = await paginaInicial(usuario.id);
        return NextResponse.redirect(destino);
      }
    }
    return NextResponse.next();
  }

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

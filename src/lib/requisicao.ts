import { headers } from "next/headers";

export const EM_PRODUCAO = process.env.NODE_ENV === "production";

/**
 * Nome do cookie de sessão. Em produção usa o prefixo __Host-, que obriga o navegador a só aceitar
 * o cookie via HTTPS, no domínio exato do site e sem poder ser sobrescrito por subdomínios.
 */
export const COOKIE_SESSAO = EM_PRODUCAO ? "__Host-sessao" : "sessao";

/**
 * IP de quem fez a requisição. Atrás da hospedagem (Vercel, Railway, Render...) o IP real vem nos
 * cabeçalhos do proxy: x-real-ip quando existe; senão o último item do x-forwarded-for, que é o que
 * o proxy da hospedagem adicionou (os primeiros podem ter sido inventados pelo próprio cliente).
 */
export function ipDe(h: Headers): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const encaminhado = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return encaminhado?.at(-1) ?? "local";
}

/** IP, navegador e local aproximado (quando a hospedagem informa) da requisição atual. */
export async function contextoRequisicao() {
  const h = await headers();
  const cidade = h.get("x-vercel-ip-city");
  const pais = h.get("x-vercel-ip-country");
  return {
    ip: ipDe(h),
    navegador: resumirNavegador(h.get("user-agent") ?? ""),
    local: cidade || pais ? [cidade && decodeURIComponent(cidade), pais].filter(Boolean).join(", ") : undefined,
  };
}

function resumirNavegador(ua: string): string {
  if (!ua) return "desconhecido";
  const nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  const so = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return nav || so ? `${nav ?? "?"} · ${so ?? "?"}` : ua.slice(0, 80);
}

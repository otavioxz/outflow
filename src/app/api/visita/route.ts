import { after } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { registrarEvento } from "@/lib/log-discord";
import { ipDe } from "@/lib/requisicao";

// Recebe o "beacon" que o navegador manda a cada página aberta (componente RegistroVisita)
// e registra no Discord um log completo do acesso: rede (IP e localização aproximada pela
// hospedagem), quem está logado e os dados do dispositivo informados pelo navegador.
// A rota é pública (a tela de login também é registrada), então tudo que vem do cliente é
// tratado como texto não confiável: limitado em tamanho e exibido sem formatação.

const TAMANHO_MAXIMO = 4 * 1024;

const texto = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e6 ? v : undefined);

export async function POST(request: Request) {
  const corpo = await request.text();
  if (corpo.length > TAMANHO_MAXIMO) return new Response(null, { status: 413 });

  let c: Record<string, unknown> = {};
  try {
    const dados = JSON.parse(corpo);
    if (dados && typeof dados === "object") c = dados;
  } catch {
    return new Response(null, { status: 400 });
  }

  const h = request.headers;
  const ip = ipDe(h);
  const caminho = texto(c.caminho, 300) ?? "/";
  const usuario = await usuarioAtual();

  // Localização aproximada pelo IP: a Vercel envia esses cabeçalhos (outras hospedagens não)
  const geo = {
    cidade: h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : undefined,
    regiao: h.get("x-vercel-ip-country-region") ?? undefined,
    pais: h.get("x-vercel-ip-country") ?? undefined,
    cep: h.get("x-vercel-ip-postal-code") ?? undefined,
    fuso: h.get("x-vercel-ip-timezone") ?? undefined,
    lat: Number(h.get("x-vercel-ip-latitude")),
    lon: Number(h.get("x-vercel-ip-longitude")),
  };
  const local = [geo.cidade, geo.regiao, geo.pais].filter(Boolean).join(", ") || undefined;
  const temMapa = Number.isFinite(geo.lat) && Number.isFinite(geo.lon) && (geo.lat !== 0 || geo.lon !== 0);

  const ua = h.get("user-agent") ?? "";
  const pareceBot = /bot|crawl|spider|slurp|preview|curl|wget|python|headless/i.test(ua);
  const memoria = numero(c.memoriaGb);
  const ratio = numero(c.pixelRatio);

  after(() =>
    registrarEvento({
      titulo: pareceBot ? "Acesso de robô/script à página" : "Novo acesso à página",
      nivel: usuario ? "info" : "alerta",
      descricao: temMapa ? `[Ver localização aproximada no mapa](https://www.google.com/maps?q=${geo.lat},${geo.lon})` : undefined,
      campos: {
        Página: caminho,
        Usuário: usuario ? `${usuario.nome} <${usuario.email}>` : "não logado",
        IP: ip,
        "Localização (pelo IP)": local ?? "indisponível",
        "CEP aprox.": geo.cep,
        "Fuso (IP)": geo.fuso,
        "Fuso (navegador)": texto(c.fuso, 60),
        "Veio de": texto(c.referrer, 300) ?? "direto",
        Idiomas: texto(c.idiomas, 100),
        Plataforma: texto(c.plataforma, 60),
        "Tela": texto(c.tela, 20),
        "Janela": texto(c.janela, 20),
        "Pixel ratio": ratio !== undefined ? String(ratio) : undefined,
        "Núcleos de CPU": numero(c.nucleos),
        "Memória aprox.": memoria !== undefined ? `${memoria} GB` : undefined,
        Conexão: texto(c.conexao, 20),
        "Toque": typeof c.toque === "boolean" ? (c.toque ? "sim" : "não") : undefined,
        "Tema do sistema": texto(c.tema, 10),
        "User-Agent": ua.slice(0, 600) || "desconhecido",
      },
      // a mesma página aberta várias vezes pelo mesmo IP vira 1 log por minuto
      agrupar: `visita:${ip}:${caminho}`,
    }),
  );

  return new Response(null, { status: 204 });
}

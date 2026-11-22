"use client";

import { PiggyBank, Star, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const SECOES = [
  { titulo: "Favoritos", itens: [{ href: "/favoritos", nome: "Favoritos", detalhe: "O que você marcou com estrela", icone: Star }] },
  {
    titulo: "Indicadores",
    itens: [
      { href: "/gastos", nome: "Gastos", detalhe: "Quanto saiu, gráficos e lançamentos", icone: Wallet },
      { href: "/guardado", nome: "Guardado", detalhe: "Poupança e meta do mês", icone: PiggyBank },
    ],
  },
];

// O painel abre abaixo do cabeçalho (h-14 + borda), para o botão ☰/✕ continuar à vista.
const ABAIXO_DO_CABECALHO = "top-[calc(3.5rem+1px)]";

// false no servidor e na hidratação, true depois: o portal só existe no navegador
const useNoNavegador = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Botão de três riscos (vira um ✕ ao abrir) e o menu lateral com as páginas do painel. */
export function MenuLateral() {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const mes = useSearchParams().get("mes");
  const noNavegador = useNoNavegador();
  const id = useId();

  // Fecha ao trocar de página (inclusive pela logo, fora do menu)
  const [caminho, setCaminho] = useState(pathname);
  if (caminho !== pathname) {
    setCaminho(pathname);
    setAberto(false);
  }

  // Aberto: Esc fecha e a página de trás não rola
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="group/menu relative grid size-9 place-items-center rounded-lg transition-colors hover:bg-muted active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span aria-hidden className="relative block h-3.5 w-[18px]">
          <span
            className={cn(
              "absolute left-0 top-0 h-0.5 w-full rounded-full bg-foreground transition-transform duration-300 ease-out",
              aberto && "translate-y-[6px] rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-[6px] h-0.5 w-full origin-left rounded-full bg-foreground transition-[transform,opacity] duration-300 ease-out",
              aberto ? "scale-x-0 opacity-0" : "group-hover/menu:scale-x-75",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-3 h-0.5 w-full rounded-full bg-foreground transition-transform duration-300 ease-out",
              aberto && "-translate-y-[6px] -rotate-45",
            )}
          />
        </span>
      </button>

      {/* No body: o desfoque do cabeçalho prenderia um elemento "fixed" dentro dele */}
      {noNavegador &&
        createPortal(
          <>
            <div
              aria-hidden
              onClick={() => setAberto(false)}
              className={cn(
                "fixed inset-x-0 bottom-0 z-40 bg-black/40 transition-opacity duration-300",
                ABAIXO_DO_CABECALHO,
                aberto ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            />
            <nav
              id={id}
              aria-label="Páginas do painel"
              inert={!aberto}
              className={cn(
                "fixed bottom-0 left-0 z-40 w-72 max-w-[85vw] overflow-y-auto border-r bg-background p-3 shadow-xl transition-transform duration-300 ease-out",
                ABAIXO_DO_CABECALHO,
                aberto ? "translate-x-0" : "-translate-x-full",
              )}
            >
              {SECOES.map((secao) => (
                <div key={secao.titulo} className="mb-4">
                  <p className="px-3 pt-2 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{secao.titulo}</p>
                  <ul className="space-y-1">
                    {secao.itens.map(({ href, nome, detalhe, icone: Icone }) => {
                      const ativo = pathname === href;
                      return (
                        <li key={href}>
                          <Link
                            href={mes ? `${href}?mes=${encodeURIComponent(mes)}` : href}
                            onClick={() => setAberto(false)}
                            aria-current={ativo ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted",
                              ativo && "bg-muted",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-foreground/10",
                                ativo ? "bg-primary text-primary-foreground ring-0" : "bg-card text-muted-foreground",
                              )}
                            >
                              <Icone className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium">{nome}</span>
                              <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </>,
          document.body,
        )}
    </>
  );
}

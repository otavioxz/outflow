"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * No desktop, limita a altura ao espaço que sobra na tela até o rodapé, para a
 * rolagem acontecer aqui dentro e não na página. No celular não limita nada.
 */
export function AreaRolavel({
  children,
  className,
  alturaMinima = 140, // cabeçalho + ~2 linhas
}: {
  children: React.ReactNode;
  className?: string;
  alturaMinima?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // há mais itens abaixo? mostra um esmaecido no pé da lista
  const [temMais, setTemMais] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const ajustar = () => {
      if (!desktop.matches) {
        el.style.maxHeight = "";
        conferirFim();
        return;
      }
      const topo = el.getBoundingClientRect().top + window.scrollY;
      // o que vem depois da lista: resto do cartão + rodapé do site
      const cartao = el.closest<HTMLElement>("[data-slot=card]");
      const rodape = document.querySelector<HTMLElement>("body > footer");
      const depois =
        (cartao ? cartao.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom : 0) + (rodape?.offsetHeight ?? 0);
      const livre = Math.floor(window.innerHeight - topo - depois);
      el.style.maxHeight = `${Math.max(livre, alturaMinima)}px`;
      conferirFim();
    };
    const conferirFim = () => setTemMais(el.scrollTop + el.clientHeight < el.scrollHeight - 2);

    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(document.body);
    window.addEventListener("resize", ajustar);
    el.addEventListener("scroll", conferirFim, { passive: true });
    desktop.addEventListener("change", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
      el.removeEventListener("scroll", conferirFim);
      desktop.removeEventListener("change", ajustar);
    };
  }, [alturaMinima]);

  return (
    // overscroll-contain só no desktop: no celular a lista não rola por dentro, e com ele o
    // navegador engolia o gesto de arrastar sobre a tabela em vez de rolar a página
    <div ref={ref} className={cn("rolagem-fina overflow-y-auto lg:overscroll-contain", className)}>
      {children}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none sticky bottom-0 -mt-12 h-12 bg-linear-to-t from-card to-transparent transition-opacity duration-300",
          temMais ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

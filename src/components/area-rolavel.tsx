"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * No desktop, limita a altura ao espaço que sobra na tela até o rodapé, para a
 * rolagem acontecer aqui dentro e não na página. No celular não limita nada.
 */
export function AreaRolavel({
  children,
  className,
  alturaMinima = 180, // cabeçalho + ~3 linhas
}: {
  children: React.ReactNode;
  className?: string;
  alturaMinima?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const ajustar = () => {
      if (!desktop.matches) {
        el.style.maxHeight = "";
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
    };

    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(document.body);
    window.addEventListener("resize", ajustar);
    desktop.addEventListener("change", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
      desktop.removeEventListener("change", ajustar);
    };
  }, [alturaMinima]);

  return (
    <div ref={ref} className={cn("overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}

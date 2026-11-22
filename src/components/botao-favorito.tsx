"use client";

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { definirFavoritoAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estrela no canto do indicador: muda na hora e salva no servidor em seguida. */
export function BotaoFavorito({ indicador, nome, favorito }: { indicador: string; nome: string; favorito: boolean }) {
  const [marcado, setMarcado] = useOptimistic(favorito);
  const [, iniciar] = useTransition();

  function alternar() {
    const novo = !marcado;
    iniciar(async () => {
      setMarcado(novo);
      try {
        await definirFavoritoAction(indicador, novo);
        toast.success(novo ? `${nome} nos favoritos` : `${nome} saiu dos favoritos`, { duration: 2500 });
      } catch {
        toast.error("Não deu para salvar o favorito. Tente de novo.");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={alternar}
      aria-pressed={marcado}
      aria-label={marcado ? `Tirar ${nome} dos favoritos` : `Adicionar ${nome} aos favoritos`}
      title={marcado ? "Tirar dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "transition-transform hover:scale-110 active:scale-90",
        marcado ? "text-warning hover:text-warning" : "text-muted-foreground",
      )}
    >
      <Star className={cn("transition-[fill,transform] duration-300", marcado && "scale-110 fill-current")} />
    </Button>
  );
}

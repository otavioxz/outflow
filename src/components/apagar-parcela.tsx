"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { apagarGastoAction } from "@/app/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Lixeira de uma parcela: pergunta se apaga a compra parcelada inteira (o comum) ou só esta parcela. */
export function ApagarParcela({ id, descricao, parcela, parcelas }: { id: number; descricao: string; parcela: number; parcelas: number }) {
  const [apagando, iniciar] = useTransition();

  function apagar(escopo: "compra" | "parcela") {
    const dados = new FormData();
    dados.set("id", String(id));
    dados.set("escopo", escopo);
    iniciar(() => apagarGastoAction(dados));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={apagando}
        aria-label={`Apagar ${descricao} (parcela ${parcela} de ${parcelas})`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-destructive")}
      >
        <Trash2 />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {descricao} · parcela {parcela}/{parcelas}
          </DropdownMenuLabel>
          <DropdownMenuItem variant="destructive" onClick={() => apagar("compra")}>
            Apagar a compra inteira ({parcelas} parcelas)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => apagar("parcela")}>Apagar só esta parcela</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { AreaRolavel } from "@/components/area-rolavel";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Cartão "Lançamentos": no painel a lista rola por dentro; o botão de expandir
 * abre a mesma lista em tela cheia, com animação.
 */
export function ListaLancamentos({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  const [cheia, setCheia] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descricao}</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCheia(true)}
              aria-label="Ver lançamentos em tela cheia"
              title="Tela cheia"
              className="transition-transform hover:scale-105 active:scale-95"
            >
              <Maximize2 />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {/* a rolagem fica aqui dentro (com o cabeçalho fixo), não na página */}
          <AreaRolavel>{children}</AreaRolavel>
        </CardContent>
      </Card>

      <Dialog open={cheia} onOpenChange={setCheia}>
        <DialogContent
          showCloseButton={false}
          classNameFundo="bg-black/60 supports-backdrop-filter:backdrop-blur-none duration-200"
          className="top-2 left-2 flex h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-none translate-x-0 translate-y-0 origin-bottom flex-col gap-0 bg-card p-0 duration-200 ease-out will-change-[transform,opacity] backface-hidden sm:top-6 sm:left-6 sm:h-[calc(100svh-3rem)] sm:w-[calc(100vw-3rem)] sm:max-w-none data-open:slide-in-from-bottom-6 data-open:zoom-in-95 data-closed:slide-out-to-bottom-6 data-closed:zoom-out-95"
        >
          <div className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
              <DialogDescription>{descricao}</DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Sair da tela cheia"
                  title="Sair da tela cheia"
                  className="transition-transform hover:scale-105 active:scale-95"
                />
              }
            >
              <Minimize2 />
            </DialogClose>
          </div>
          <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-4 sm:px-6 [&_[data-col=pagamento]]:table-cell max-sm:[&_:is(td,th):not(:first-child,:last-child)]:px-1">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

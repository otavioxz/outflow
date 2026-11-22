import type { Metadata } from "next";
import { Suspense } from "react";
import { CarregandoPainel, Painel } from "@/components/painel";

export const metadata: Metadata = { title: "Favoritos · Outflow" };

export default function FavoritosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<CarregandoPainel />}>
      <Painel pagina="favoritos" searchParams={searchParams} />
    </Suspense>
  );
}

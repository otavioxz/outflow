import type { Metadata } from "next";
import { Suspense } from "react";
import { CarregandoPainel, Painel } from "@/components/painel";

export const metadata: Metadata = { title: "Gastos · Outflow" };

export default function GastosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<CarregandoPainel />}>
      <Painel pagina="gastos" searchParams={searchParams} />
    </Suspense>
  );
}

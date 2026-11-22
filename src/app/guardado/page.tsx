import type { Metadata } from "next";
import { Suspense } from "react";
import { CarregandoPainel, Painel } from "@/components/painel";

export const metadata: Metadata = { title: "Guardado · Outflow" };

export default function GuardadoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<CarregandoPainel />}>
      <Painel pagina="guardado" searchParams={searchParams} />
    </Suspense>
  );
}

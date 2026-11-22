import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CarregandoPainel } from "@/components/painel";
import { exigirUsuario } from "@/lib/auth";
import { paginaInicial } from "@/lib/favoritos";

// Normalmente o proxy já redireciona "/" antes de chegar aqui (src/proxy.ts); esta página é a reserva.
export default function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<CarregandoPainel />}>
      <Inicio searchParams={searchParams} />
    </Suspense>
  );
}

async function Inicio({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<never> {
  await connection();
  const usuario = await exigirUsuario();
  const { mes } = await searchParams;
  const destino = await paginaInicial(usuario.id);
  redirect(mes ? `${destino}?mes=${encodeURIComponent(mes)}` : destino);
}

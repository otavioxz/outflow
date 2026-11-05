import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoCompleta } from "@/components/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usuarioAtual } from "@/lib/auth";
import { FormCadastro } from "./form";

export const metadata: Metadata = { title: "Criar conta · Outflow" };

type Props = { searchParams: Promise<{ convite?: string }> };

export default function CadastroPage({ searchParams }: Props) {
  return (
    <main className="grid flex-1 place-items-center px-4 py-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="sr-only">Outflow</h1>
          <LogoCompleta />
          <p className="text-sm text-muted-foreground">Seus gastos, em um lugar só!</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Por enquanto o Outflow é só para convidados: você vai precisar do código de convite.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <Conteudo searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function Conteudo({ searchParams }: Props) {
  await connection();
  if (await usuarioAtual()) redirect("/");
  // o link do convite (/cadastro?convite=K7QM-3XPA) já vem com o código preenchido
  const { convite } = await searchParams;
  return <FormCadastro convite={typeof convite === "string" ? convite.slice(0, 20) : undefined} />;
}

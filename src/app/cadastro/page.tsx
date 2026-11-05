import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoCompleta } from "@/components/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usuarioAtual } from "@/lib/auth";
import { FormCadastro } from "./form";

export const metadata: Metadata = { title: "Criar conta · Outflow" };

export default function CadastroPage() {
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
              <Conteudo />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function Conteudo() {
  await connection();
  if (await usuarioAtual()) redirect("/");
  if (!process.env.CODIGO_CONVITE)
    return (
      <p className="text-sm text-muted-foreground">
        O cadastro está fechado no momento.{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Voltar para o login
        </Link>
      </p>
    );
  return <FormCadastro />;
}

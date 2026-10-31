import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoCompleta } from "@/components/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usuarioAtual } from "@/lib/auth";
import { existeAlgumUsuario } from "@/lib/usuarios";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar · Outflow" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="sr-only">Outflow</h1>
          <LogoCompleta />
          <p className="text-sm text-muted-foreground">Seus gastos do WhatsApp, num lugar só</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Acesso restrito a quem foi convidado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-52" />}>
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
  return <FormLogin semUsuarios={!(await existeAlgumUsuario())} />;
}

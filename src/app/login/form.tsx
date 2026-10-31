"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ semUsuarios }: { semUsuarios: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4">
      {semUsuarios && (
        <Alert>
          <Terminal />
          <AlertTitle>Ninguém cadastrado ainda</AlertTitle>
          <AlertDescription>
            <p>Crie seu acesso rodando no terminal, na pasta do projeto:</p>
            <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs text-foreground">
              npm run usuario -- adicionar seu@email.com &quot;Seu Nome&quot;
            </code>
          </AlertDescription>
        </Alert>
      )}

      {estado.erro && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={estado.email}
          aria-invalid={Boolean(estado.erro)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(estado.erro)}
        />
      </div>
      <Button type="submit" className="h-10 w-full" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" />}
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

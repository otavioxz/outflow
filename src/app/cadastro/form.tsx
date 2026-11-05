"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cadastrar, type EstadoCadastro } from "./actions";

export function FormCadastro({ convite }: { convite?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(cadastrar, {});

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" autoComplete="name" maxLength={80} required defaultValue={estado.nome} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={estado.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={12} required aria-describedby="dica-senha" />
        <p id="dica-senha" className="text-xs text-muted-foreground">
          Pelo menos 12 caracteres.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmacao">Repita a senha</Label>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="convite">Código de convite</Label>
        <Input id="convite" name="convite" autoComplete="off" required defaultValue={estado.convite ?? convite} />
      </div>

      <Button type="submit" className="h-10 w-full" disabled={enviando}>
        {enviando ? <Loader2 className="animate-spin" /> : <UserPlus />}
        {enviando ? "Criando conta…" : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

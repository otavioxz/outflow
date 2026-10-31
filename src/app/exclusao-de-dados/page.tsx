import type { Metadata } from "next";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca";

export const metadata: Metadata = { title: "Exclusão de dados · Outflow" };

// Página pública com as instruções de exclusão de dados (exigida pela Meta em um link próprio).
export default function ExclusaoDeDados() {
  const contato = process.env.CONTATO_PRIVACIDADE;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-10 flex justify-center">
        <LogoCompleta />
      </div>

      <article className="space-y-6 text-[15px] leading-relaxed">
        <header>
          <h1 className="text-2xl font-bold">Como excluir seus dados</h1>
          <p className="mt-1 text-muted-foreground">
            Você pode apagar seus dados do Outflow a qualquer momento, de qualquer uma destas formas:
          </p>
        </header>

        <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Último gasto:</strong> envie <strong className="text-foreground">desfazer</strong>{" "}
            ao bot no WhatsApp.
          </li>
          <li>
            <strong className="text-foreground">Qualquer gasto:</strong> entre no painel e use o ícone de lixeira ao lado do
            lançamento.
          </li>
          <li>
            <strong className="text-foreground">Todos os seus dados</strong> (gastos, conta de acesso e número de telefone):
            peça ao administrador
            {contato ? (
              <>
                {" "}pelo e-mail{" "}
                <a className="font-medium text-foreground underline" href={`mailto:${contato}?subject=Exclusão de dados - Outflow`}>
                  {contato}
                </a>
              </>
            ) : null}
            . A exclusão é concluída em até 15 dias e você recebe a confirmação por e-mail.
          </li>
        </ol>

        <footer className="flex gap-4 border-t pt-6 text-sm">
          <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>
          <Link href="/login" className="text-primary underline">Voltar ao Outflow</Link>
        </footer>
      </article>
    </main>
  );
}

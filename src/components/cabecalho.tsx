import Link from "next/link";
import { Marca } from "@/components/marca";
import { MenuUsuario } from "@/components/menu-usuario";

/** Barra superior das páginas logadas: marca (volta ao painel) e menu da conta. */
export function Cabecalho({ nome, email }: { nome: string; email: string }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Ir para o painel">
          <Marca />
        </Link>
        <MenuUsuario nome={nome} email={email} />
      </div>
    </header>
  );
}

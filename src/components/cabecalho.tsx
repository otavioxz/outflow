import Link from "next/link";
import { Marca } from "@/components/marca";
import { MenuLateral } from "@/components/menu-lateral";
import { MenuUsuario } from "@/components/menu-usuario";
import { SincronizarPush } from "@/components/notificacoes-push";

/** Barra superior das páginas logadas: menu das páginas, marca no centro (volta ao início) e menu da conta. */
export function Cabecalho({ nome, email, fotoVersao }: { nome: string; email: string; fotoVersao: number | null }) {
  return (
    // z-30: acima do cabeçalho fixo das tabelas (z-10), abaixo de menus e janelas (z-50)
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      {/* largura toda: menu e conta nos cantos da tela. Colunas laterais iguais (1fr): a marca fica
          no centro mesmo com o nome do usuário à direita */}
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <div className="justify-self-start">
          <MenuLateral />
        </div>
        <Link href="/" aria-label="Ir para o início">
          <Marca />
        </Link>
        <div className="justify-self-end">
          <MenuUsuario nome={nome} email={email} fotoVersao={fotoVersao} />
        </div>
      </div>
      <SincronizarPush />
    </header>
  );
}

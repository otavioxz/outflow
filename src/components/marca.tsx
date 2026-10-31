import Image from "next/image";
import { cn } from "@/lib/utils";

// O "O" e o "Out" da logo são prateados: por isso ela sempre aparece sobre o fundo escuro da marca,
// tanto no modo claro quanto no escuro.
const FUNDO_MARCA = "bg-[#0a0e0c]";

/** Emblema em ladrilho escuro + nome "Outflow" (cabeçalho). */
export function Marca({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className={cn("grid size-9 place-items-center rounded-lg", FUNDO_MARCA)}>
        <Image src="/logo-emblema.png" alt="" width={579} height={458} className="h-auto w-7" priority />
      </span>
      <span className="text-lg font-bold tracking-tight italic">
        Out<span className="text-primary">flow</span>
      </span>
    </span>
  );
}

/** Logo completa (emblema + palavra) sobre o painel escuro (tela de login). */
export function LogoCompleta({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-2xl px-8 py-6", FUNDO_MARCA, className)}>
      <Image src="/logo.png" alt="Outflow" width={819} height={631} className="h-auto w-40" priority />
    </div>
  );
}

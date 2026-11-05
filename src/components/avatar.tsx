import { cn } from "@/lib/utils";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Foto de perfil do usuário logado ou, sem foto, as iniciais do nome num círculo. */
export function Avatar({ nome, fotoVersao, className }: { nome: string; fotoVersao: number | null; className?: string }) {
  if (fotoVersao)
    return (
      // <img> comum: a foto é privada (exige login), então não passa pelo otimizador de imagens do Next
      <img src={`/api/foto?v=${fotoVersao}`} alt="" className={cn("size-7 shrink-0 rounded-full object-cover", className)} />
    );
  return (
    <span
      aria-hidden
      className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground", className)}
    >
      {iniciais(nome)}
    </span>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { formatarReais } from "@/lib/categorias";
import { definirFavorito, ehIndicador } from "@/lib/favoritos";
import { apagarGasto } from "@/lib/gastos";
import { apagarGuardado } from "@/lib/guardados";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";

export async function apagarGastoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const apagado = await apagarGasto(usuario.id, id);
  if (apagado) {
    const ctx = await contextoRequisicao();
    after(() =>
      registrarEvento({
        titulo: "Gasto apagado pelo painel",
        nivel: "info",
        campos: {
          Usuário: usuario.email,
          Gasto: `${apagado.descricao} · ${formatarReais(apagado.valor_centavos)} · ${apagado.data}`,
          IP: ctx.ip,
        },
      }),
    );
  }
  revalidatePath("/", "layout"); // todas as páginas do painel
}

export async function apagarGuardadoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const apagado = await apagarGuardado(usuario.id, id);
  if (apagado) {
    const ctx = await contextoRequisicao();
    after(() =>
      registrarEvento({
        titulo: "Valor guardado apagado pelo painel",
        nivel: "info",
        campos: {
          Usuário: usuario.email,
          Guardado: `${apagado.descricao} · ${formatarReais(apagado.valor_centavos)} · ${apagado.data}`,
          IP: ctx.ip,
        },
      }),
    );
  }
  revalidatePath("/", "layout"); // todas as páginas do painel
}

/** Estrela de um indicador do painel: marca ou desmarca o favorito. */
export async function definirFavoritoAction(indicador: string, favorito: boolean) {
  const usuario = await exigirUsuario();
  if (!ehIndicador(indicador)) return;
  await definirFavorito(usuario.id, indicador, favorito === true);
  revalidatePath("/", "layout");
}

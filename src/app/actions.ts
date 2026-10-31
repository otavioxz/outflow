"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { formatarReais } from "@/lib/categorias";
import { apagarGasto } from "@/lib/gastos";
import { registrarEvento } from "@/lib/log-discord";
import { contextoRequisicao } from "@/lib/requisicao";

export async function apagarGastoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const apagado = await apagarGasto(id);
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
  revalidatePath("/");
}

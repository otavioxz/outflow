"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { apagarGasto } from "@/lib/gastos";

export async function apagarGastoAction(formData: FormData) {
  await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await apagarGasto(id);
  revalidatePath("/");
}

// Números de telefone no formato que a Meta usa (DDI + DDD + número, só dígitos).

/**
 * Forma canônica de um número, usada para guardar e comparar: a Meta às vezes entrega celulares
 * brasileiros sem o 9º dígito (5511988887777 vira 551188887777), então o removemos sempre.
 */
export function normalizarNumero(numero: string): string {
  const d = numero.replace(/\D/g, "");
  return d.length === 13 && d.startsWith("55") && d[4] === "9" ? d.slice(0, 4) + d.slice(5) : d;
}

/**
 * A Meta entrega celulares brasileiros sem o 9º dígito (554788887777), mas responder para esse formato
 * falha com "131030 Recipient phone number not in allowed list". Recoloca o 9 antes de enviar.
 */
export function numeroParaEnvio(numero: string): string {
  const d = numero.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("55") && /[6-9]/.test(d[4]) ? d.slice(0, 4) + "9" + d.slice(4) : d;
}

/** "+55 47 9****-0118": para mostrar no painel e nos logs sem expor o número inteiro. */
export function mascararNumero(numero: string): string {
  const d = numeroParaEnvio(numero);
  if (d.length < 8) return "***";
  return d.startsWith("55") && d.length >= 12
    ? `+55 ${d.slice(2, 4)} ${d[4]}****-${d.slice(-4)}`
    : `+${d.slice(0, 2)} ****${d.slice(-4)}`;
}

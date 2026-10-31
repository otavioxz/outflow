// Transcrição de áudio usando qualquer API compatível com o endpoint /audio/transcriptions
// da OpenAI: a própria OpenAI (whisper-1) ou a Groq (whisper-large-v3-turbo, com plano gratuito).

export function transcricaoConfigurada(): boolean {
  return Boolean(process.env.TRANSCRICAO_API_KEY);
}

export async function transcreverAudio(audio: Buffer, mimeType = "audio/ogg"): Promise<string> {
  const baseUrl = process.env.TRANSCRICAO_URL ?? "https://api.openai.com/v1";
  const modelo = process.env.TRANSCRICAO_MODELO ?? "whisper-1";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), "audio.ogg");
  form.append("model", modelo);
  form.append("language", "pt");

  const resp = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TRANSCRICAO_API_KEY}` },
    body: form,
  });
  if (!resp.ok) throw new Error(`Falha na transcrição (${resp.status}): ${await resp.text()}`);

  const { text } = (await resp.json()) as { text: string };
  return text.trim();
}

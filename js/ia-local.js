// ia-local.js — IA embutida do Chrome (Gemini Nano, Prompt API "LanguageModel"): roda no aparelho, offline e sem cota.
// Só é usada quando o modelo já está "available" (não dispara download). Qualquer falha → o app usa o Gemini.

const LM = () => globalThis.LanguageModel;

/** Converte o esquema do Gemini (OpenAPI: type 'NUMBER', nullable) para JSON Schema (responseConstraint). */
export function paraJsonSchema(e) {
  if (!e || typeof e !== 'object') return e;
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'type') out.type = String(v).toLowerCase();
    else if (k === 'nullable') continue;
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, paraJsonSchema(s)]));
    else if (k === 'items') out.items = paraJsonSchema(v);
    else out[k] = v;
  }
  if (e.nullable && out.type) out.type = [out.type, 'null'];
  return out;
}

/** true se a IA do Chrome está pronta para uso (com imagem, se pedido). */
export async function localDisponivel(comImagem = false) {
  const lm = LM();
  if (!lm?.availability) return false;
  try {
    const op = comImagem ? { expectedInputs: [{ type: 'text' }, { type: 'image' }] } : { expectedInputs: [{ type: 'text' }] };
    return (await lm.availability(op)) === 'available';
  } catch { return false; }
}

/**
 * partes: [{ text } | { blob }] → objeto JSON conforme `esquema` (formato Gemini).
 * Lança erro se a resposta não for JSON válido (quem chama recorre ao Gemini).
 */
export async function promptLocal(partes, esquema) {
  const comImagem = partes.some((p) => p.blob);
  const sessao = await LM().create({ expectedInputs: comImagem ? [{ type: 'text' }, { type: 'image' }] : [{ type: 'text' }] });
  try {
    const content = partes.map((p) => (p.blob ? { type: 'image', value: p.blob } : { type: 'text', value: p.text }));
    const txt = await sessao.prompt([{ role: 'user', content }], { responseConstraint: paraJsonSchema(esquema) });
    return JSON.parse(txt);
  } finally { try { sessao.destroy(); } catch {} }
}

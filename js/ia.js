// ia.js — estimativa de calorias por foto do prato via API do Gemini (camada gratuita, chave do Artur).
// A chave fica só no localStorage deste aparelho (não vai para o backup). Sem faturamento ativado
// no projeto do Google AI Studio, a API só usa a cota gratuita: passou do limite, ela recusa (429), não cobra.

const CHAVE_LS = 'geminiChave', MODELO_LS = 'geminiModelo';
// Ordem de tentativa: o primeiro que existir para a chave é lembrado (modelos mudam de nome com o tempo).
export const MODELOS = ['gemini-3-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const URL_API = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { return ''; } };
export const lerChave = () => ls(CHAVE_LS);
/** Limpa o que veio colado (espaços, quebras de linha, aspas). */
export const limparChave = (c) => String(c || '').replace(/[\s"'`]/g, '');
/** Checagem leve: chaves do Google podem ter letras, números, _ - e ponto (formato novo "AQ.…"). Quem valida de fato é a API. */
export const chaveValida = (c) => /^[\w.-]{20,}$/.test(limparChave(c));
export const salvarChave = (c) => ls(CHAVE_LS, limparChave(c));

const PROMPT = `Você é um nutricionista brasileiro. Na foto há uma refeição. Identifique cada alimento visível,
estime o peso em gramas (pela proporção do prato, talheres e porções caseiras brasileiras) e calcule kcal,
proteína, carboidrato, gordura e fibra (g) desse peso, usando de preferência valores da Tabela TACO.
Considere óleo/gordura de preparo quando aparente. Nomes curtos em português (ex.: "Arroz branco cozido").
Se não houver comida na foto, devolva itens vazio e explique em "observacao". Responda só o JSON.`;

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    itens: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      nome: { type: 'STRING' }, gramas: { type: 'NUMBER' }, kcal: { type: 'NUMBER' },
      prot: { type: 'NUMBER' }, carb: { type: 'NUMBER' }, gord: { type: 'NUMBER' }, fibra: { type: 'NUMBER' },
    }, required: ['nome', 'gramas', 'kcal', 'prot', 'carb', 'gord'] } },
    observacao: { type: 'STRING' },
  },
  required: ['itens'],
};

// ---------- Pura (testável) ----------

/** Valida e limpa a resposta do modelo: números finitos ≥ 0, limites de sanidade, nome obrigatório. */
export function normalizarEstimativa(obj) {
  const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null; };
  const itens = (Array.isArray(obj?.itens) ? obj.itens : []).map((i) => ({
    nome: String(i?.nome || '').trim().slice(0, 50),
    g: num(i?.gramas, 5000),
    kcal: num(i?.kcal, 10000),
    prot: num(i?.prot, 1000) ?? 0,
    carb: num(i?.carb, 1000) ?? 0,
    gord: num(i?.gord, 1000) ?? 0,
    fibra: num(i?.fibra, 200),
  })).filter((i) => i.nome && i.kcal != null);
  return { itens, obs: String(obj?.observacao || '').trim().slice(0, 300) };
}

/** Mensagem clara em português para os erros da API. */
export function mensagemErro(status, msgApi = '') {
  if (status === 429) return 'Cota gratuita do Gemini esgotada por agora (limite por minuto ou por dia). Tente mais tarde — nada é cobrado.';
  if (status === 400 && /api key|API_KEY/i.test(msgApi)) return 'Chave do Gemini inválida. Confira em Ajustes › Estimativa por foto.';
  if (status === 401 || status === 403) return 'Chave do Gemini sem permissão. Gere uma nova em aistudio.google.com/apikey.';
  if (status >= 500) return 'O Gemini está instável agora. Tente de novo em instantes.';
  return `Erro do Gemini (${status}). ${msgApi}`.trim();
}

// ---------- Chamada ----------

const blobBase64 = (b) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = erro; r.readAsDataURL(b); });

/** Envia a foto (JPEG já comprimido) e devolve { itens, obs, modelo }. `dica` = texto opcional do usuário. */
export async function estimarFoto(blob, dica = '') {
  const chave = lerChave();
  if (!chave) throw new Error('Cadastre sua chave do Gemini primeiro.');
  if (!navigator.onLine) throw new Error('Sem internet: a estimativa por foto precisa de conexão.');
  const corpo = JSON.stringify({
    contents: [{ parts: [
      { inline_data: { mime_type: blob.type || 'image/jpeg', data: await blobBase64(blob) } },
      { text: PROMPT + (dica ? `\nInformação do usuário sobre o prato: ${dica}` : '') },
    ] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.2 },
  });
  const lembrado = ls(MODELO_LS);
  const ordem = lembrado ? [lembrado, ...MODELOS.filter((m) => m !== lembrado)] : MODELOS;
  for (const modelo of ordem) {
    let r;
    try {
      r = await fetch(URL_API(modelo), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: corpo });
    } catch { throw new Error('Não foi possível falar com o Gemini (rede).'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404) continue;                       // modelo não existe para esta chave: tenta o próximo
    if (!r.ok) throw new Error(mensagemErro(r.status, j?.error?.message));
    ls(MODELO_LS, modelo);
    const txt = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    let obj;
    try { obj = JSON.parse(txt); } catch { throw new Error('O Gemini não devolveu uma estimativa legível. Tente outra foto.'); }
    return { ...normalizarEstimativa(obj), modelo };
  }
  ls(MODELO_LS, null);
  throw new Error('Nenhum modelo Gemini disponível para esta chave.');
}

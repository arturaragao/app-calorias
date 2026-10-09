// ia.js — IA via API do Gemini (camada gratuita, chave do Artur): estimar prato por foto ou por texto e ler rótulo.
// A chave fica só no localStorage deste aparelho (não vai para o backup). Sem faturamento ativado
// no projeto do Google AI Studio, a API só usa a cota gratuita: passou do limite, ela recusa (429), não cobra.
// A IA só IDENTIFICA e PESA; quando há correspondência na TACO, os nutrientes vêm da tabela (ver views/foto-ia.js).
// Ordem dos motores: IA embutida do Chrome (Gemini Nano, offline, sem cota) → API do Gemini (com limite diário do app).

import { localDisponivel, promptLocal } from './ia-local.js';
import { restantesHoje, registrarUso, limiteDiario } from './ia-cota.js';

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

// ---------- Prompts e esquemas ----------

const REGRAS_ITENS = `Para cada alimento: "nome" curto em português; "nome_taco" no estilo da Tabela TACO
(ex.: "Arroz, tipo 1, cozido", "Feijão, carioca, cozido", "Frango, peito, sem pele, grelhado", "Ovo, de galinha, inteiro, frito",
"Pão, trigo, francês", "Café, infusão 10%", "Leite, de vaca, integral"); "gramas" (peso estimado da porção consumida, em g ou ml);
e kcal, prot, carb, gord, fibra (g) desse peso, de preferência pela TACO. Separe preparações compostas nos ingredientes principais
quando fizer sentido (ex.: "café com leite" = café + leite). Considere óleo/gordura de preparo quando aparente.`;

const PROMPT_FOTO = `Você é um nutricionista brasileiro. Na foto há uma refeição. Identifique cada alimento visível e estime o peso
pela proporção do prato, talheres e porções caseiras brasileiras. ${REGRAS_ITENS}
Se não houver comida na foto, devolva itens vazio e explique em "observacao". Responda só o JSON.`;

const PROMPT_TEXTO = `Você é um nutricionista brasileiro. O usuário descreveu o que comeu. Separe cada alimento e estime o peso
pelas quantidades ditas ou, se não houver, por porções caseiras brasileiras usuais (ex.: 1 pão francês ≈ 50 g, 1 ovo ≈ 50 g,
1 xícara de café com leite ≈ 200 ml, 1 colher de sopa de arroz ≈ 25 g). ${REGRAS_ITENS}
Se o texto não descrever comida, devolva itens vazio e explique em "observacao". Responda só o JSON.`;

const PROMPT_ROTULO = `Leia a TABELA NUTRICIONAL do rótulo na foto (padrão brasileiro ANVISA). Devolva o nome do produto e a marca
(se visíveis), a porção em gramas (ou ml) e sua descrição caseira (ex.: "1 scoop", "2 fatias"), e os valores da coluna da PORÇÃO
(base: "porcao"). Só se a tabela não tiver coluna da porção, use a de 100 g (base: "100g"). Valor energético em kcal; sódio em mg.
Se um valor não aparecer, omita o campo. Não invente valores. Se não houver tabela nutricional legível, explique em "observacao".`;

const PROMPT_CARDAPIO = `Você é um nutricionista brasileiro. Na foto há um CARDÁPIO (de restaurante ou de dieta) ou uma lista de pratos.
Liste cada prato/alimento que a pessoa provavelmente vai comer e estime o peso de UMA porção usual servida no Brasil.
Separe pratos compostos nos ingredientes principais (ex.: "PF de frango" = arroz + feijão + frango grelhado + salada). ${REGRAS_ITENS}
Se não houver cardápio legível, devolva itens vazio e explique em "observacao". Responda só o JSON.`;

const PROMPT_RECEITA = `Você é um nutricionista brasileiro. Na foto há uma RECEITA (lista de ingredientes com quantidades).
Liste cada ingrediente com a quantidade da receita convertida em gramas (ou ml), usando medidas caseiras brasileiras quando a
receita usar xícaras/colheres. Ignore água e sal. Em "observacao" informe quantas porções a receita rende, se estiver escrito. ${REGRAS_ITENS}
Se não houver receita legível, devolva itens vazio e explique em "observacao". Responda só o JSON.`;

const PROMPT_COACH = `Você é um nutricionista esportivo brasileiro, direto e gentil. Abaixo estão SÓ números agregados da semana de um
usuário de um app de dieta (médias diárias, metas, aderência, peso e etiquetas). Escreva em português do Brasil:
"observacoes": exatamente 3 observações curtas (até 25 palavras cada), baseadas nos números (cite-os), sem diagnóstico médico;
"acao": 1 ação prática e específica para a próxima semana (até 30 palavras).
Não invente dados que não estão abaixo. Se houver poucos dias registrados, diga isso em uma das observações.`;

const N = { type: 'NUMBER' }, S = { type: 'STRING' };
const ESQUEMA_ITENS = {
  type: 'OBJECT',
  properties: {
    itens: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      nome: S, nome_taco: S, gramas: N, kcal: N, prot: N, carb: N, gord: N, fibra: N,
    }, required: ['nome', 'gramas', 'kcal', 'prot', 'carb', 'gord'] } },
    observacao: S,
  },
  required: ['itens'],
};
const ESQUEMA_COACH = {
  type: 'OBJECT',
  properties: { observacoes: { type: 'ARRAY', items: S }, acao: S },
  required: ['observacoes', 'acao'],
};
const ESQUEMA_ROTULO = {
  type: 'OBJECT',
  properties: { nome: S, marca: S, porcao_g: N, porcao_desc: S, base: { type: 'STRING', enum: ['100g', 'porcao'] },
    kcal: N, prot: N, carb: N, gord: N, fibra: N, sodio_mg: N, observacao: S },
};

// ---------- Puras (testáveis) ----------

const num = (v, max) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null; };

/** Valida e limpa a resposta do modelo: números finitos ≥ 0, limites de sanidade, nome obrigatório. */
export function normalizarEstimativa(obj) {
  const itens = (Array.isArray(obj?.itens) ? obj.itens : []).map((i) => ({
    nome: String(i?.nome || '').trim().slice(0, 50),
    nomeTaco: String(i?.nome_taco || '').trim().slice(0, 80),
    g: num(i?.gramas, 5000),
    kcal: num(i?.kcal, 10000),
    prot: num(i?.prot, 1000) ?? 0,
    carb: num(i?.carb, 1000) ?? 0,
    gord: num(i?.gord, 1000) ?? 0,
    fibra: num(i?.fibra, 200),
  })).filter((i) => i.nome && i.kcal != null);
  return { itens, obs: String(obj?.observacao || '').trim().slice(0, 300) };
}

/**
 * Rótulo → alimento para pré-preencher "Meus alimentos" (valores por 100 g, como o formulário espera).
 * Se a tabela só tinha a porção, converte por 100 g. Devolve null se não há kcal nem porção utilizável.
 */
export function rotuloParaAlimento(o) {
  const porcaoG = num(o?.porcao_g, 5000);
  const porPorcao = o?.base === 'porcao';
  const fator = porPorcao ? (porcaoG ? 100 / porcaoG : null) : 1;
  if (fator == null) return null;
  const v = (k, max) => { const x = num(o?.[k], max); return x == null ? null : Math.round(x * fator * 100) / 100; };
  const kcal = v('kcal', 10000);
  if (kcal == null) return null;
  const nome = String(o?.nome || '').trim(), marca = String(o?.marca || '').trim();
  const food = {
    nome: (nome ? (marca && !nome.toLowerCase().includes(marca.toLowerCase()) ? `${nome} — ${marca}` : nome) : marca || 'Produto do rótulo').slice(0, 80),
    fonte: 'rótulo (lido por IA)', origem: 'rotulo',
    kcal, prot: v('prot', 1000), carb: v('carb', 1000), gord: v('gord', 1000), fibra: v('fibra', 200), sodio_mg: v('sodio_mg', 100000),
    porcoes: porcaoG ? [{ nome: String(o?.porcao_desc || '').trim().slice(0, 30) || 'porção', g: porcaoG }] : [],
  };
  food.falta = ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg'].filter((k) => food[k] == null);
  return food;
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

/** Motor disponível agora: 'local' (IA do Chrome), 'gemini' (chave cadastrada) ou null (esconder a função). */
export async function motorIA({ comImagem = false } = {}) {
  if (await localDisponivel(comImagem)) return 'local';
  return lerChave() ? 'gemini' : null;
}

/** Texto curto sobre o motor e a cota, para mostrar nas telas de IA. */
export async function rotuloCota({ comImagem = false } = {}) {
  const m = await motorIA({ comImagem });
  if (m === 'local') return 'IA do Chrome neste aparelho (offline, sem limite).';
  if (m === 'gemini') return `Gemini: ${restantesHoje()} de ${limiteDiario()} chamadas restantes hoje.`;
  return '';
}

/** Chamada genérica: partes [{ text } | { blob }] + esquema → objeto JSON. IA do Chrome primeiro; senão Gemini. */
async function chamar(partes, esquema) {
  if (await localDisponivel(partes.some((p) => p.blob))) {
    try { return await promptLocal(partes, esquema); } catch (e) { console.warn('IA do Chrome falhou; usando o Gemini', e); }
  }
  return chamarGemini(await Promise.all(partes.map(async (p) => (p.blob ? imagem(p.blob) : { text: p.text }))), esquema);
}

/** API do Gemini: tenta os modelos em ordem (404 = próximo). Respeita o limite diário do app. */
async function chamarGemini(partes, esquema) {
  const chave = lerChave();
  if (!chave) throw new Error('Cadastre sua chave do Gemini primeiro (Ajustes › IA).');
  if (!navigator.onLine) throw new Error('Sem internet: a IA precisa de conexão.');
  if (restantesHoje() <= 0) throw new Error(`Limite diário do app atingido (${limiteDiario()} chamadas). Zera à meia-noite; dá para ajustar em Ajustes › IA.`);
  const corpo = JSON.stringify({
    contents: [{ parts: partes }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, temperature: 0.2 },
  });
  const lembrado = ls(MODELO_LS);
  const ordem = lembrado ? [lembrado, ...MODELOS.filter((m) => m !== lembrado)] : MODELOS;
  for (const modelo of ordem) {
    let r;
    try {
      r = await fetch(URL_API(modelo), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: corpo });
    } catch { throw new Error('Não foi possível falar com o Gemini (rede).'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404) continue;
    if (!r.ok) throw new Error(mensagemErro(r.status, j?.error?.message));
    registrarUso();
    ls(MODELO_LS, modelo);
    const txt = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    try { return JSON.parse(txt); } catch { throw new Error('O Gemini não devolveu uma resposta legível. Tente de novo.'); }
  }
  ls(MODELO_LS, null);
  throw new Error('Nenhum modelo Gemini disponível para esta chave.');
}

const imagem = async (blob) => ({ inline_data: { mime_type: blob.type || 'image/jpeg', data: await blobBase64(blob) } });

/** Foto do prato (JPEG já comprimido) → { itens, obs }. `dica` = texto opcional do usuário. */
export async function estimarFoto(blob, dica = '') {
  const o = await chamar([{ blob }, { text: PROMPT_FOTO + (dica ? `\nInformação do usuário sobre o prato: ${dica}` : '') }], ESQUEMA_ITENS);
  return normalizarEstimativa(o);
}

/** Texto livre ("2 ovos mexidos e 1 pão francês") → { itens, obs }. */
export async function estimarTexto(texto) {
  const o = await chamar([{ text: `${PROMPT_TEXTO}\n\nO que o usuário comeu: ${texto}` }], ESQUEMA_ITENS);
  return normalizarEstimativa(o);
}

/** Foto do rótulo → { food (pré-preenchimento por 100 g) | null, obs }. */
export async function lerRotulo(blob) {
  const o = await chamar([{ blob }, { text: PROMPT_ROTULO }], ESQUEMA_ROTULO);
  return { food: rotuloParaAlimento(o), obs: String(o?.observacao || '').trim() };
}

/** Foto de cardápio (porção usual de cada prato) ou receita (quantidades da receita) → { itens, obs }. */
export async function estimarCardapio(blob, tipo = 'cardapio') {
  const o = await chamar([{ blob }, { text: tipo === 'receita' ? PROMPT_RECEITA : PROMPT_CARDAPIO }], ESQUEMA_ITENS);
  return normalizarEstimativa(o);
}

/** Coach semanal: números agregados (objeto) → { observacoes: [≤ 3], acao } ou null. */
export async function coachSemanal(numeros) {
  const o = await chamar([{ text: `${PROMPT_COACH}\n\nDados da semana (JSON):\n${JSON.stringify(numeros)}` }], ESQUEMA_COACH);
  return normalizarCoach(o);
}

/** Limpa a resposta do coach: até 3 observações não vazias e uma ação; null se inutilizável. */
export function normalizarCoach(o) {
  const obs = (Array.isArray(o?.observacoes) ? o.observacoes : []).map((t) => String(t || '').trim().slice(0, 300)).filter(Boolean).slice(0, 3);
  const acao = String(o?.acao || '').trim().slice(0, 300);
  return obs.length && acao ? { observacoes: obs, acao } : null;
}

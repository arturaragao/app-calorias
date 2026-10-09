// off.js — Open Food Facts (API pública, gratuita, sem chave). Online e opcional.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/  — limites: leitura de produto
// ~100 req/min, busca ~10 req/min. O app só consulta por ação do usuário (1 requisição por leitura/busca).
// O navegador não permite definir User-Agent; o app se identifica pelo parâmetro app_name.

// Servidores em ordem de tentativa. O world.* passou a responder 503 na busca por texto (search.pl)
// e o novo search.openfoodfacts.org não libera CORS para outros sites; o br.* responde com CORS liberado.
const SERVIDORES = ['https://br.openfoodfacts.org', 'https://world.openfoodfacts.org', 'https://world.openfoodfacts.net'];
const APP = 'app_name=AppCaloriasPessoal&app_version=1';
const CAMPOS = 'code,product_name,product_name_pt,generic_name_pt,brands,quantity,serving_size,serving_quantity,nutriments';

// ---------- Puras ----------

/** Só dígitos; aceita EAN-8, UPC-A (12), EAN-13 e EAN-14. */
export function limparCodigo(txt) {
  const c = String(txt || '').replace(/\D/g, '');
  return [8, 12, 13, 14].includes(c.length) ? c : '';
}

/** Dígito verificador GTIN (EAN-8/UPC-A/EAN-13/GTIN-14, módulo 10, pesos 3 e 1 a partir da direita). */
export function digitoOk(c) {
  if (!/^\d{8}$|^\d{12,14}$/.test(c || '')) return false;
  const d = [...c].map(Number), dv = d.pop();
  const soma = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}

/** Variantes equivalentes (UPC-A de 12 dígitos = EAN-13 com 0 à esquerda). */
export function variantesCodigo(c) {
  const v = new Set([c]);
  if (c.length === 12) v.add('0' + c);
  if (c.length === 13 && c.startsWith('0')) v.add(c.slice(1));
  return [...v];
}

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Produto OFF -> alimento por 100 g (formato do app).
 * - kcal: energy-kcal_100g; se ausente, energy_100g (kJ) ÷ 4,184.
 * - sódio: sodium_100g está em gramas → × 1000 mg; se ausente, sal ÷ 2,5
 *   (sal = sódio × 2,5, Regulamento UE 1169/2011, anexo I).
 * Valor ausente = null (marcado), nunca inventado.
 */
export function produtoParaAlimento(p, codigo) {
  const n = p?.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null && (n.energy_unit || 'kJ') === 'kJ') kcal = num(n.energy_100g) / 4.184;
  let sodio = num(n.sodium_100g);
  sodio = sodio != null ? sodio * 1000 : num(n.salt_100g) != null ? (num(n.salt_100g) / 2.5) * 1000 : null;
  const nome = (p.product_name_pt || p.product_name || p.generic_name_pt || '').trim();
  const marca = (p.brands || '').split(',')[0].trim();
  const food = {
    nome: nome ? (marca && !nome.toLowerCase().includes(marca.toLowerCase()) ? `${nome} — ${marca}` : nome) : (marca || `Produto ${codigo}`),
    fonte: 'Open Food Facts', origem: 'off', codigo: codigo || p.code || '',
    kcal, prot: num(n.proteins_100g), carb: num(n.carbohydrates_100g), gord: num(n.fat_100g),
    fibra: num(n.fiber_100g), sodio_mg: sodio,
  };
  const g = num(p.serving_quantity);
  food.porcoes = g > 0 ? [{ nome: p.serving_size ? `porção (${p.serving_size})` : 'porção', g }] : [];
  food.falta = ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg'].filter((k) => food[k] == null);
  return food;
}

// ---------- Rede ----------

async function obter(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Open Food Facts respondeu ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/** Tenta cada servidor até um responder (404 = "não existe", não tenta os outros). */
async function comFallback(caminho, ms) {
  let ultimoErro;
  for (const s of SERVIDORES) {
    try { return await obter(s + caminho, ms); } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro;
}

/** Busca por código. Retorna alimento, null (não encontrado) ou lança erro (offline/bloqueado). */
export async function buscarCodigo(codigo) {
  const j = await comFallback(`/api/v2/product/${codigo}.json?fields=${CAMPOS}&${APP}`, 9000);
  if (!j || j.status === 0 || !j.product) return null;
  return produtoParaAlimento(j.product, codigo);
}

/** Busca por nome (até 30 resultados; o servidor br.* prioriza produtos vendidos no Brasil). */
export async function buscarNome(termo) {
  const q = encodeURIComponent(termo.trim());
  const j = await comFallback(`/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=30&fields=${CAMPOS}&${APP}`, 12000);
  return (j?.products || []).filter((p) => p.nutriments && (p.product_name || p.product_name_pt))
    .map((p) => produtoParaAlimento(p, p.code));
}

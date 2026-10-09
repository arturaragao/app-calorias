// inteligencia.js — sugestões locais, sem IA e sem rede (lógica pura, testada em tests/run.js).
// Nada aqui inventa nutrientes: tudo vem dos alimentos (TACO/Meus alimentos) e do histórico do próprio usuário.

const MACROS = ['kcal', 'prot', 'carb', 'gord'];

// ---------- Candidatos: o que o usuário costuma comer ----------

const mediana = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Alimentos frequentes (diários dados) + favoritos, com a quantidade típica do usuário.
 * `porId(id)` resolve o alimento atual (por 100 g). Alimentos sem kcal na fonte ficam de fora.
 * `refId`: conta só os itens dessa refeição. Devolve [{ food, gTipico, vezes }] por frequência.
 */
export function candidatosFrequentes(diarios, porId, { favoritos = [], ultimaQtd = {}, max = 30, refId = null } = {}) {
  const cont = new Map();
  for (const d of diarios) {
    for (const it of refId ? d.refeicoes?.[refId] || [] : Object.values(d.refeicoes || {}).flat()) {
      if (!it.foodId || !(it.g > 0) || it.planejado) continue;
      const c = cont.get(it.foodId) || { vezes: 0, gs: [] };
      c.vezes++; c.gs.push(it.g);
      cont.set(it.foodId, c);
    }
  }
  for (const id of favoritos) if (!cont.has(id)) cont.set(id, { vezes: 0, gs: [] });
  const out = [];
  for (const [id, c] of cont) {
    const food = porId(id);
    if (!food || food.kcal == null) continue;
    const g = c.gs.length ? mediana(c.gs) : ultimaQtd[id]?.g || food.porcoes?.[0]?.g || 100;
    out.push({ food, gTipico: g, vezes: c.vezes + (favoritos.includes(id) ? 2 : 0) });
  }
  return out.sort((a, b) => b.vezes - a.vezes).slice(0, max);
}

// ---------- "O que comer agora": combinações que se aproximam do restante do dia ----------

/** Nutrientes (kcal, P, C, G) de `g` gramas de um alimento por 100 g (ausente = 0). */
const nutr = (food, g) => Object.fromEntries(MACROS.map((k) => [k, ((food[k] || 0) * g) / 100]));

/**
 * Erro relativo ponderado entre o total e o restante. Passar das kcal pesa mais que ficar abaixo.
 * Pesos: kcal 1, proteína 1, carboidrato e gordura 0,5 (heurística do app, não é recomendação clínica).
 */
export function erroCombinacao(tot, alvo) {
  const pesos = { kcal: 1, prot: 1, carb: 0.5, gord: 0.5 };
  let e = 0;
  for (const k of MACROS) {
    const escala = Math.max(alvo[k], k === 'kcal' ? 100 : 10);
    let d = (tot[k] - alvo[k]) / escala;
    if (k === 'kcal' && d > 0) d *= 1.5;
    e += pesos[k] * d * d;
  }
  return e;
}

const somarN = (a, b) => Object.fromEntries(MACROS.map((k) => [k, a[k] + b[k]]));
const ZERO = { kcal: 0, prot: 0, carb: 0, gord: 0 };

/** Melhor gramagem de um candidato somado a `base`, entre 0,5× e 2× a porção típica, em passos de 5 g. */
function melhorGramas(c, base, alvo) {
  const min = Math.max(5, Math.round((c.gTipico * 0.5) / 5) * 5), max = Math.max(min, Math.round((c.gTipico * 2) / 5) * 5);
  let melhor = null;
  for (let g = min; g <= max; g += 5) {
    const e = erroCombinacao(somarN(base, nutr(c.food, g)), alvo);
    if (!melhor || e < melhor.e) melhor = { g, e };
  }
  return melhor;
}

/**
 * Até `n` combinações (1 a `maxItens` alimentos) de candidatos cujo total se aproxima do restante.
 * Gulosa: cada candidato serve de "semente"; os próximos itens entram enquanto reduzem o erro.
 * restante = { kcal, prot, carb, gord } (negativos viram 0). Devolve [{ itens:[{food,g,n}], tot, erro }].
 */
export function sugerirCombinacoes(restante, candidatos, { n = 3, maxItens = 3 } = {}) {
  const alvo = Object.fromEntries(MACROS.map((k) => [k, Math.max(0, restante[k] || 0)]));
  if (alvo.kcal < 50 || !candidatos.length) return [];
  const combos = [];
  for (const semente of candidatos) {
    const m0 = melhorGramas(semente, ZERO, alvo);
    let itens = [{ c: semente, g: m0.g }], tot = nutr(semente.food, m0.g), erro = m0.e;
    while (itens.length < maxItens) {
      let melhor = null;
      for (const c of candidatos) {
        if (itens.some((i) => i.c === c)) continue;
        const m = melhorGramas(c, tot, alvo);
        if (m.e < erro - 1e-9 && (!melhor || m.e < melhor.m.e)) melhor = { c, m };
      }
      if (!melhor) break;
      itens.push({ c: melhor.c, g: melhor.m.g });
      tot = somarN(tot, nutr(melhor.c.food, melhor.m.g)); erro = melhor.m.e;
    }
    combos.push({ itens, tot, erro });
  }
  // as melhores sem repetir o conjunto de alimentos; 1ª passada também evita repetir o alimento principal
  combos.sort((a, b) => a.erro - b.erro);
  const out = [], chaves = new Set(), principais = new Set();
  for (const variar of [true, false]) {
    for (const cb of combos) {
      if (out.length >= n) break;
      const chave = cb.itens.map((i) => i.c.food.id).sort().join('|');
      const principal = cb.itens.reduce((a, b) => (nutr(b.c.food, b.g).kcal > nutr(a.c.food, a.g).kcal ? b : a)).c.food.id;
      if (chaves.has(chave) || (variar && principais.has(principal))) continue;
      chaves.add(chave); principais.add(principal);
      out.push({ itens: cb.itens.map((i) => ({ food: i.c.food, g: i.g, n: nutr(i.c.food, i.g) })), tot: cb.tot, erro: cb.erro });
    }
  }
  return out.sort((a, b) => a.erro - b.erro);
}

/**
 * Parte do restante para a próxima refeição: parcela dela (dist, fração 0–1 por refeição) dividida pela soma das
 * parcelas das refeições ainda vazias a partir dela (inclusive). Ex.: lanche 10% + jantar 25% + ceia 5% vazias → lanche = 25% do restante.
 * `ordem` = ids das refeições na ordem do dia; `vazias` = Set de ids sem itens.
 */
export function fracaoProximaRefeicao(refAtual, ordem, vazias, dist) {
  const i = ordem.indexOf(refAtual);
  if (i < 0) return 1;
  const seguintes = ordem.slice(i).filter((id) => id === refAtual || vazias.has(id));
  const soma = seguintes.reduce((a, id) => a + (dist[id] || 0), 0);
  return soma > 0 ? Math.min(1, (dist[refAtual] || 0) / soma) : 1;
}

// ---------- "Seu café de sempre" ----------

/**
 * Itens habituais de uma refeição: alimentos presentes em ≥ `frac` dos dias (mín. `minDias` dias com a refeição
 * lançada). Devolve os itens da ocorrência mais recente (snapshot, para copiar), na ordem em que aparecem.
 */
export function refeicaoDeSempre(diarios, refId, { minDias = 3, frac = 0.4 } = {}) {
  const dias = diarios.filter((d) => (d.refeicoes?.[refId] || []).length).sort((a, b) => (a.data < b.data ? -1 : 1));
  if (dias.length < minDias) return [];
  const cont = new Map(), ultimo = new Map();
  for (const d of dias) {
    const vistos = new Set();
    for (const it of d.refeicoes[refId]) {
      if (!it.foodId || it.planejado || vistos.has(it.foodId)) continue;
      vistos.add(it.foodId);
      cont.set(it.foodId, (cont.get(it.foodId) || 0) + 1);
      ultimo.set(it.foodId, it);
    }
  }
  const habituais = [...cont].filter(([, v]) => v >= Math.max(2, dias.length * frac)).map(([id]) => id);
  return habituais.map((id) => ultimo.get(id));
}

// ---------- Lançamento suspeito ----------

/** Percentil p (0–1) de uma lista. */
export function percentil(v, p) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}

/**
 * Mensagem de confirmação se o lançamento parece engano de digitação; null se parece normal.
 * ctx: { kcalItensUsuario: [kcal dos itens já lançados], gUsual: gramas usuais deste alimento }.
 * Limiares práticos do app (registrados em DECISOES.md), não valores nutricionais.
 */
export function avaliarSuspeito(food, g, ctx = {}) {
  const kcal = ((food.kcal || 0) * g) / 100;
  const nome = food.nome || 'este alimento';
  if ((food.gord || 0) >= 80 && g > 60) return `${Math.round(g)} g de ${nome} (gordura quase pura) somam ${Math.round(kcal)} kcal. Confere?`;
  if (kcal > 2000) return `${Math.round(kcal)} kcal em um único item. Confere a quantidade?`;
  if (g > 1500) return `${Math.round(g)} g é bastante para um item. Confere?`;
  if (ctx.gUsual > 0 && g > 100 && g > ctx.gUsual * 4) return `Você costuma lançar ${Math.round(ctx.gUsual)} g de ${nome}; agora são ${Math.round(g)} g. Confere?`;
  const l = ctx.kcalItensUsuario || [];
  if (l.length >= 20) {
    const p95 = percentil(l, 0.95);
    if (kcal > 400 && kcal > p95 * 2.5) return `${Math.round(kcal)} kcal está bem acima dos seus itens habituais (até ~${Math.round(p95)} kcal). Confere?`;
  }
  return null;
}

// ---------- Ranqueamento da busca pelo uso (Pacote 12) ----------

/**
 * Bônus 0–0,9 por alimento para a busca: frequência (log, satura em ~20 usos) × 0,45 + recência (1 hoje → 0 em 60 dias) × 0,25
 * + fração das vezes em que foi lançado na refeição do horário × 0,2. Itens planejados não contam.
 */
export function pesosBusca(diarios, { refId = null, hoje } = {}) {
  const st = new Map();
  for (const d of diarios) {
    for (const [r, itens] of Object.entries(d.refeicoes || {})) {
      for (const it of itens) {
        if (!it.foodId || it.planejado) continue;
        const s = st.get(it.foodId) || { n: 0, nRef: 0, ultima: '' };
        s.n++; if (r === refId) s.nRef++; if (d.data > s.ultima) s.ultima = d.data;
        st.set(it.foodId, s);
      }
    }
  }
  const dia = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 86400000;
  const out = new Map();
  for (const [id, s] of st) {
    const freq = Math.min(1, Math.log1p(s.n) / Math.log1p(20));
    const rec = hoje ? Math.max(0, 1 - (dia(hoje) - dia(s.ultima)) / 60) : 0;
    out.set(id, 0.45 * freq + 0.25 * rec + 0.2 * (s.nRef / s.n));
  }
  return out;
}

// ---------- Saúde do alimento (heurística do app) e sugestões nutritivas ----------
// Nota 0–1 a partir de dados da própria tabela: grupo da TACO, proteína e fibra por 100 kcal, sódio por 100 kcal,
// e sinais no nome (fritura, embutido, integral). Doces, refrigerantes, salgadinhos e álcool são "guloseimas".
// Não é recomendação clínica; serve para ordenar sugestões.

const BASE_GRUPO = {
  'Verduras, hortaliças e derivados': 0.9, 'Frutas e derivados': 0.8, 'Leguminosas e derivados': 0.85, 'Pescados e frutos do mar': 0.8,
  'Ovos e derivados': 0.75, 'Nozes e sementes': 0.7, 'Leite e derivados': 0.65, 'Carnes e derivados': 0.6, 'Cereais e derivados': 0.55,
  'Gorduras e óleos': 0.35, 'Bebidas (alcoólicas e não alcoólicas)': 0.4, 'Miscelâneas': 0.4, 'Alimentos preparados': 0.4,
  'Outros alimentos industrializados': 0.25, 'Produtos açucarados': 0.1,
};
const GULOSEIMA = /\b(chocolate|bombom|brigadeiro|recheado|wafer|bolo|sorvete|pudim|(?<!batata )doce|goiabada|marmelada|pe de moleque|pacoca|refrigerante|achocolatado|chantilly|condensado|chips|salgadinho|pizza|coxinha|pastel|quindim|mousse|torta|sonho|rosquinha|maria mole|cocada|bala|gelatina|cerveja|vinho|cachaca|aguardente|batida|caipirinha|mel|melado|acucar|geleia)\b/;
const EMBUTIDO = /\b(linguica|salsicha|mortadela|presunto|salame|bacon|toucinho|apresuntado|hamburguer|nuggets)\b/;
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');

export function saudeAlimento(food) {
  const nome = sem(food.nome), grupo = food.grupo || '';
  const guloseima = grupo === 'Produtos açucarados' || GULOSEIMA.test(nome);
  let s = BASE_GRUPO[grupo] ?? 0.5;
  const kcal = food.kcal || 0;
  if (kcal > 0) {
    s += Math.min(0.15, ((food.prot || 0) / kcal) * 100 * 0.015);          // 10 g de proteína/100 kcal = +0,15
    s += Math.min(0.1, ((food.fibra || 0) / kcal) * 100 * 0.025);          // 4 g de fibra/100 kcal = +0,1
    if (((food.sodio_mg || 0) / kcal) * 100 > 300) s -= 0.15;
    if (((food.gord || 0) * 9) / kcal > 0.6 && !/Nozes|Gorduras/.test(grupo)) s -= 0.1;
  }
  if (/\b(frito|frita|fritos|fritas|milanesa)\b/.test(nome)) s -= 0.15;
  if (EMBUTIDO.test(nome)) s -= 0.25;
  if (/\bintegral\b/.test(nome)) s += 0.05;
  s = Math.max(0, Math.min(1, s));
  return { nota: guloseima ? Math.min(s, 0.25) : s, guloseima };
}

/** Básicos nutritivos da TACO por tipo de refeição (nomes exatos da tabela), além do que o usuário já come. */
export const BASICOS = {
  leve: ['Banana, prata, crua', 'Mamão, Papaia, cru', 'Maçã, Fuji, com casca, crua', 'Laranja, pêra, crua', 'Morango, cru', 'Iogurte, natural',
    'Ovo, de galinha, inteiro, cozido/10minutos', 'Aveia, flocos, crua', 'Pão, trigo, forma, integral', 'Queijo, minas, frescal', 'Castanha-do-Brasil, crua',
    'Amendoim, grão, cru', 'Cuscuz, de milho, cozido com sal'],
  prato: ['Arroz, integral, cozido', 'Arroz, tipo 1, cozido', 'Feijão, carioca, cozido', 'Feijão, preto, cozido', 'Lentilha, cozida',
    'Frango, peito, sem pele, grelhado', 'Carne, bovina, patinho, sem gordura, grelhado', 'Salmão, sem pele, fresco, grelhado', 'Sardinha, assada',
    'Ovo, de galinha, inteiro, cozido/10minutos', 'Brócolis, cozido', 'Cenoura, crua', 'Alface, crespa, crua', 'Tomate, com semente, cru',
    'Batata, doce, cozida', 'Abóbora, cabotian, cozida', 'Mandioca, cozida', 'Couve, manteiga, refogada'],
};
export const tipoRefeicao = (refId) => (['almoco', 'jantar'].includes(refId) ? 'prato' : 'leve');

const saudeCombo = (c) => {
  const k = c.itens.reduce((s, i) => s + i.n.kcal, 0) || 1;
  return c.itens.reduce((s, i) => s + saudeAlimento(i.food).nota * i.n.kcal, 0) / k;
};

/**
 * Sugestões priorizando o que faz bem: as `n` melhores só com alimentos não guloseima, ranqueadas por
 * erro + 0,6 × (1 − nota de saúde média pelas kcal); depois, no máximo UM "agrado" (combinação com guloseima)
 * se o usuário costuma comer alguma (vem em `candidatos` com `habitual`). Cada combinação ganha { tipo, saude }.
 */
export function sugerirSaudaveis(alvo, candidatos, { n = 3, agrado = true } = {}) {
  const bons = candidatos.filter((c) => !saudeAlimento(c.food).guloseima && saudeAlimento(c.food).nota >= 0.45);
  const ranq = (l) => l.map((c) => ({ ...c, saude: saudeCombo(c) })).sort((a, b) => (a.erro + 0.6 * (1 - a.saude)) - (b.erro + 0.6 * (1 - b.saude)));
  const saudaveis = ranq(sugerirCombinacoes(alvo, bons, { n: n + 3 })).slice(0, n).map((c) => ({ ...c, tipo: 'saudavel' }));
  const doces = candidatos.filter((c) => c.habitual && saudeAlimento(c.food).guloseima);
  if (!agrado || !doces.length || alvo.kcal < 150) return saudaveis;
  const comDoce = sugerirCombinacoes(alvo, [...doces, ...bons], { n: 8 }).filter((c) => c.itens.some((i) => saudeAlimento(i.food).guloseima));
  const ag = ranq(comDoce)[0];
  return ag ? [...saudaveis.slice(0, Math.max(1, n - 1)), { ...ag, tipo: 'agrado' }] : saudaveis;
}

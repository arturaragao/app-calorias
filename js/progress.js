// progress.js — cálculos da tela Progresso (funções puras, testadas).
// dias: [{ data, tot: {kcal, prot, carb, gord, …}, meta: {kcal, prot, carb, gord} }] — só dias com algum item.

import { dataDeChave, diaSemana, somarDias } from './utils.js';

/** Média móvel por calendário: média dos pontos dos últimos `n` dias (inclui o dia). pontos ordenados. */
export function mediaMovelDias(pontos, n = 7) {
  return pontos.map((p) => {
    const ini = somarDias(p.data, -(n - 1));
    const jan = pontos.filter((q) => q.data >= ini && q.data <= p.data);
    return jan.reduce((s, q) => s + q.y, 0) / jan.length;
  });
}

/** Segunda-feira da semana da data. */
export const inicioSemana = (chave) => somarDias(chave, -diaSemana(chave));

/** Médias semanais de kcal (só dias registrados) e meta média da semana. */
export function semanas(dias) {
  const g = new Map();
  for (const d of dias) {
    const s = inicioSemana(d.data);
    if (!g.has(s)) g.set(s, []);
    g.get(s).push(d);
  }
  return [...g.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([inicio, ds]) => ({
    inicio, n: ds.length,
    kcal: ds.reduce((s, d) => s + d.tot.kcal, 0) / ds.length,
    meta: ds.reduce((s, d) => s + d.meta.kcal, 0) / ds.length,
  }));
}

/** Aderência: % dos dias registrados com kcal dentro de ±tol da meta do dia. */
export function aderencia(dias, tol = 0.1) {
  if (!dias.length) return { pct: null, dentro: 0, total: 0, acima: 0, abaixo: 0 };
  let dentro = 0, acima = 0, abaixo = 0;
  for (const d of dias) {
    const r = d.tot.kcal / d.meta.kcal;
    if (r > 1 + tol) acima++; else if (r < 1 - tol) abaixo++; else dentro++;
  }
  return { pct: (dentro / dias.length) * 100, dentro, total: dias.length, acima, abaixo };
}

/** Médias diárias de consumo e de meta (P, C, G, kcal) e % das kcal de cada macro. */
export function mediasMacros(dias) {
  const ks = ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg'];
  const m = Object.fromEntries(ks.map((k) => [k, 0]));
  const mm = { kcal: 0, prot: 0, carb: 0, gord: 0 };
  for (const d of dias) {
    for (const k of ks) m[k] += d.tot[k] || 0;
    for (const k of Object.keys(mm)) mm[k] += d.meta[k] || 0;
  }
  const n = dias.length || 1;
  for (const k of ks) m[k] /= n;
  for (const k of Object.keys(mm)) mm[k] /= n;
  const kcalMacros = m.prot * 4 + m.carb * 4 + m.gord * 9;
  const pct = kcalMacros ? { prot: (m.prot * 400) / kcalMacros, carb: (m.carb * 400) / kcalMacros, gord: (m.gord * 900) / kcalMacros } : { prot: 0, carb: 0, gord: 0 };
  return { consumo: m, meta: mm, pct, n: dias.length };
}

/** Filtra por período (últimos n dias até `hoje`, inclusive). n = null → tudo. */
export function noPeriodo(itens, n, hoje) {
  if (!n) return itens;
  const ini = somarDias(hoje, -(n - 1));
  return itens.filter((x) => x.data >= ini && x.data <= hoje);
}

/**
 * Sequência de dias seguidos com registro, terminando hoje (ou ontem, se hoje ainda está vazio,
 * para não "quebrar" a sequência de manhã). datas: Set de 'AAAA-MM-DD'.
 */
export function sequencia(datas, hoje) {
  let d = datas.has(hoje) ? hoje : somarDias(hoje, -1);
  let n = 0;
  while (datas.has(d)) { n++; d = somarDias(d, -1); }
  return n;
}

export const diasEntre = (a, b) => Math.round((dataDeChave(b) - dataDeChave(a)) / 86400000);

// ---------- Tendência de peso (média móvel exponencial) ----------
// Método do "The Hacker's Diet" (J. Walker, 1991): tendência_t = tendência_{t-1} + 0,1 × (peso_t − tendência_{t-1}),
// calculada dia a dia; dias sem pesagem usam interpolação linear entre pesagens vizinhas.

/** pesos: [{data, kg}] ordenados. Devolve [{data, y, real}] para cada dia do 1º ao último registro. */
export function tendenciaPeso(pesos, alfa = 0.1) {
  if (!pesos.length) return [];
  const out = [];
  let t = pesos[0].kg;
  for (let i = 0; i < pesos.length; i++) {
    const a = pesos[i], b = pesos[i + 1];
    const n = b ? diasEntre(a.data, b.data) : 1;
    for (let k = 0; k < n; k++) {
      const kg = b ? a.kg + ((b.kg - a.kg) * k) / n : a.kg;
      if (out.length) t += alfa * (kg - t);
      out.push({ data: somarDias(a.data, k), y: t, real: k === 0 });
    }
  }
  return out;
}

/** Inclinação (por dia) da regressão linear de pontos [{data, y}]. */
export function inclinacao(pontos) {
  if (pontos.length < 2) return null;
  const x0 = pontos[0].data;
  const xs = pontos.map((p) => diasEntre(x0, p.data)), ys = pontos.map((p) => p.y);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? num / den : null;
}

/** Ritmo da tendência em kg/semana nos últimos `janela` dias (até `hoje`). null se < 7 dias de dados. */
export function ritmoSemanal(tend, hoje, janela = 28) {
  const t = noPeriodo(tend, janela, hoje);
  if (t.length < 7) return null;
  return inclinacao(t) * 7;
}

// ---------- Gasto real (TDEE adaptativo) ----------
// Balanço energético: gasto = consumo médio − Δreservas/dia. 1 kg de variação de peso ≈ 7700 kcal
// (Wishnofsky M., Am J Clin Nutr 1958;6:542-6: ~3500 kcal/lb). Usa a variação da TENDÊNCIA (não o peso cru)
// e só os dias com registro para o consumo (dias sem registro não entram na média).
export const KCAL_POR_KG = 7700;
export const TDEE_MIN_DIAS = 14;

/**
 * dias: [{data, tot:{kcal}}] (só dias com registro); tend: tendência diária.
 * Retorna null se faltam dados, ou { tdee, mediaKcal, deltaKg, periodo, registrados, cobertura, confianca }.
 */
export function tdeeAdaptativo(dias, tend, hoje, janela = 28) {
  const t = noPeriodo(tend, janela, hoje);
  if (t.length < TDEE_MIN_DIAS) return null;
  const ini = t[0].data, fim = t.at(-1).data;
  const ds = dias.filter((d) => d.data >= ini && d.data <= fim);
  const periodo = diasEntre(ini, fim) + 1;
  if (ds.length < Math.max(10, periodo * 0.5)) return null;
  const mediaKcal = ds.reduce((s, d) => s + d.tot.kcal, 0) / ds.length;
  const deltaKg = t.at(-1).y - t[0].y;
  const tdee = mediaKcal - (deltaKg * KCAL_POR_KG) / periodo;
  const cobertura = ds.length / periodo;
  const confianca = cobertura >= 0.85 && periodo >= 21 ? 'alta' : cobertura >= 0.7 ? 'média' : 'baixa';
  return { tdee, mediaKcal, deltaKg, periodo, registrados: ds.length, cobertura, confianca, ini, fim };
}

/** Meta sugerida a partir do gasto real: gasto + ajuste do objetivo (arredondada a 10), respeitando o piso. */
export function metaSugerida(tdee, ajuste, piso) {
  return Math.max(piso, Math.round((tdee + ajuste) / 10) * 10);
}

// ---------- Peso-alvo e projeção ----------

/** Data estimada para atingir `alvo` no ritmo atual (kg/semana). null se o ritmo vai na direção errada ou é lento demais. */
export function projecao(atual, alvo, ritmoKgSem, hoje, maxSemanas = 104) {
  const falta = alvo - atual;
  if (Math.abs(falta) < 0.05) return { atingido: true };
  if (!ritmoKgSem || Math.sign(ritmoKgSem) !== Math.sign(falta) || Math.abs(ritmoKgSem) < 0.02) return null;
  const semanas = falta / ritmoKgSem;
  if (semanas > maxSemanas) return null;
  return { atingido: false, semanas, data: somarDias(hoje, Math.round(semanas * 7)) };
}

/** Fração do caminho percorrido de `inicio` até `alvo` (0–1). */
export function fracaoAlvo(inicio, atual, alvo) {
  if (inicio === alvo) return 1;
  return Math.max(0, Math.min(1, (inicio - atual) / (inicio - alvo)));
}

// ---------- Comparação entre períodos ----------

/** Médias do período de n dias até `hoje` e do período anterior de mesmo tamanho: { kcal:[atual, anterior], prot:[…] }. */
export function compararPeriodos(dias, n, hoje) {
  const atual = noPeriodo(dias, n, hoje), ant = noPeriodo(dias, n, somarDias(hoje, -n));
  const med = (l, k) => (l.length ? l.reduce((s, d) => s + d.tot[k], 0) / l.length : null);
  return { kcal: [med(atual, 'kcal'), med(ant, 'kcal')], prot: [med(atual, 'prot'), med(ant, 'prot')], n: [atual.length, ant.length] };
}

// ---------- Relatório semanal ----------

/** Resumo da semana que começa em `inicio` (segunda). tend: tendência diária do peso. */
export function relatorioSemana(dias, tend, inicio, tol = 0.1) {
  const fim = somarDias(inicio, 6);
  const ds = dias.filter((d) => d.data >= inicio && d.data <= fim);
  const tw = tend.filter((p) => p.data >= somarDias(inicio, -1) && p.data <= fim);
  const dif = (d) => d.tot.kcal - d.meta.kcal;
  const ordenados = [...ds].sort((a, b) => Math.abs(dif(a)) - Math.abs(dif(b)));
  return {
    inicio, fim, registrados: ds.length, aderencia: aderencia(ds, tol), medias: mediasMacros(ds),
    deltaPeso: tw.length >= 2 ? tw.at(-1).y - tw[0].y : null,
    pesoFim: tw.length ? tw.at(-1).y : null,
    melhor: ordenados[0] || null, pior: ordenados.length > 1 ? ordenados.at(-1) : null,
  };
}

// ---------- Calendário de aderência ----------

/** Situação de um dia: 'meta' (±tol), 'acima', 'abaixo' ou null (sem registro). */
export function situacaoDia(d, tol = 0.1) {
  if (!d || !d.meta.kcal) return null;
  const r = d.tot.kcal / d.meta.kcal;
  return r > 1 + tol ? 'acima' : r < 1 - tol ? 'abaixo' : 'meta';
}

/** Grade do mês (semanas começando na segunda). Células fora do mês = null. mes: 1–12. */
export function gradeMes(ano, mes) {
  const pad = (n) => String(n).padStart(2, '0');
  const primeiro = `${ano}-${pad(mes)}-01`;
  const nDias = new Date(ano, mes, 0).getDate();
  const celulas = Array(diaSemana(primeiro)).fill(null);
  for (let i = 1; i <= nDias; i++) celulas.push(`${ano}-${pad(mes)}-${pad(i)}`);
  while (celulas.length % 7) celulas.push(null);
  return celulas;
}

// ---------- De onde vêm as calorias ----------

const nomeBase = (nome) => (nome || '').replace(/\s*\(≈.*\)$/, '');

/**
 * diarios: objetos do diário ({data, nomes, refeicoes:{refId:[itens]}}).
 * Devolve médias diárias: { porRefeicao: [{id, nome, kcal, pct}], topKcal, topProt: [{nome, kcal, prot, vezes, pct}], dias }.
 * Itens agrupados por alimento (ou pelo nome, na adição rápida, sem o "(≈ g)").
 */
export function origemCalorias(diarios, nomesRef = {}) {
  const porRef = new Map(), porAlim = new Map();
  let total = 0;
  for (const d of diarios) {
    for (const [refId, itens] of Object.entries(d.refeicoes)) {
      for (const it of itens) {
        const k = it.n.kcal || 0;
        total += k;
        const r = porRef.get(refId) || { id: refId, nome: nomesRef[refId] || d.nomes?.[refId] || refId, kcal: 0 };
        r.kcal += k; porRef.set(refId, r);
        const chave = it.foodId || 'rap:' + nomeBase(it.nome).toLowerCase();
        const a = porAlim.get(chave) || { nome: nomeBase(it.nome), kcal: 0, prot: 0, vezes: 0 };
        a.kcal += k; a.prot += it.n.prot || 0; a.vezes++;
        porAlim.set(chave, a);
      }
    }
  }
  const n = diarios.length || 1;
  const porRefeicao = [...porRef.values()].map((r) => ({ ...r, pct: total ? (r.kcal / total) * 100 : 0, kcal: r.kcal / n }))
    .sort((a, b) => b.kcal - a.kcal);
  const alims = [...porAlim.values()].map((a) => ({ ...a, pct: total ? (a.kcal * 100) / total : 0, kcal: a.kcal / n, prot: a.prot / n }));
  return {
    porRefeicao, dias: diarios.length,
    topKcal: [...alims].sort((a, b) => b.kcal - a.kcal).slice(0, 10),
    topProt: [...alims].sort((a, b) => b.prot - a.prot).slice(0, 10),
  };
}

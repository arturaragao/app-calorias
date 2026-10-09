// nutricao.js — qualidade do dia (heurística do app) e lacunas de micronutrientes → alimentos da TACO ricos neles.

import { MICROS, refMicro, somarMicros } from './micros.js';

/**
 * Pontuação 0–100 declarada como HEURÍSTICA do app (inspirada nas pontuações do Cronometer e na avaliação do Lifesum):
 * proteína × meta (30%), fibra × meta (25%), sódio dentro do limite (20%) e cobertura média dos micronutrientes com
 * referência DRI (25%, só se ≥ 50% das kcal tiverem dados de micronutrientes; senão os pesos são redistribuídos).
 * Faixas: < 40 baixa · 40–69 média · 70–84 boa · ≥ 85 ótima. Não é diagnóstico nem julgamento.
 */
export function qualidadeDia(tot, meta, itens, { sexo = 'M', idade = 30 } = {}) {
  if (!tot || !(tot.kcal > 0)) return null;
  const lim = (x) => Math.max(0, Math.min(1, x));
  const partes = [
    ['Proteína', 0.3, meta.prot > 0 ? lim(tot.prot / meta.prot) : null],
    ['Fibra', 0.25, meta.fibra > 0 ? lim(tot.fibra / meta.fibra) : null],
    ['Sódio', 0.2, meta.sodio > 0 ? (tot.sodio_mg <= meta.sodio ? 1 : lim(1 - (tot.sodio_mg - meta.sodio) / meta.sodio)) : null],
  ];
  const { tot: mic, cobertura } = somarMicros(itens);
  if (cobertura >= 0.5) {
    const fr = MICROS.filter((m) => refMicro(m, sexo, idade)).map((m) => lim(mic[m[0]] / refMicro(m, sexo, idade)));
    partes.push(['Micronutrientes', 0.25, fr.reduce((s, x) => s + x, 0) / fr.length]);
  }
  const validas = partes.filter((p) => p[2] != null);
  const peso = validas.reduce((s, p) => s + p[1], 0);
  if (!peso) return null;
  const nota = Math.round((validas.reduce((s, p) => s + p[1] * p[2], 0) / peso) * 100);
  const faixa = nota >= 85 ? 'ótima' : nota >= 70 ? 'boa' : nota >= 40 ? 'média' : 'baixa';
  return { nota, faixa, partes: validas.map(([nome, , v]) => ({ nome, pct: Math.round(v * 100) })), comMicros: cobertura >= 0.5 };
}

/** Micronutriente mais abaixo da referência na média do período ({ campo, nome, un, media, ref, frac } ou null). */
export function maiorLacuna(itens, nDias, { sexo = 'M', idade = 30 } = {}) {
  const { tot, cobertura } = somarMicros(itens);
  if (!cobertura || !nDias) return null;
  return MICROS.filter((m) => refMicro(m, sexo, idade))
    .map((m) => ({ campo: m[0], nome: m[1], un: m[2], media: tot[m[0]] / nDias, ref: refMicro(m, sexo, idade) }))
    .map((x) => ({ ...x, frac: x.media / x.ref, cobertura }))
    .sort((a, b) => a.frac - b.frac)[0];
}

/**
 * Alimentos mais ricos no nutriente por 100 kcal (densidade), com valores da própria tabela.
 * Os que o usuário já come vêm em `seus`; o resto em `outros`. Ignora alimentos com < 5 kcal/100 g e sem o dado.
 */
export function alimentosRicos(campo, foods, preferidos = new Set(), n = 3) {
  // cru só para o que se come cru (frutas, verduras, castanhas); um por "tipo" (2 primeiras palavras) para variar
  const cruOk = (f) => !/\bcrua?s?\b/i.test(f.nome) || /fruta|verdura|hortali|oleaginos|nozes|sementes/i.test(f.grupo || '');
  const tipo = (f) => f.nome.toLowerCase().split(',').slice(0, 2).join(',');
  const dens = foods.filter((f) => f.mic?.[campo] > 0 && f.kcal >= 5 && cruOk(f))
    .map((f) => ({ f, por100kcal: (f.mic[campo] / f.kcal) * 100, por100g: f.mic[campo] }))
    .sort((a, b) => b.por100kcal - a.por100kcal);
  const variar = (l) => { const vistos = new Set(); return l.filter((x) => !vistos.has(tipo(x.f)) && vistos.add(tipo(x.f))).slice(0, n); };
  return { seus: variar(dens.filter((x) => preferidos.has(x.f.id))), outros: variar(dens.filter((x) => !preferidos.has(x.f.id))) };
}

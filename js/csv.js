// csv.js — importação de alimentos por CSV (funções puras, testadas).
// Colunas (por 100 g): nome; kcal; proteina; carboidrato; gordura; fibra; sodio; porcoes; fonte
// porcoes opcional no formato "fatia=25|unidade=50". Aceita ; ou , como separador e vírgula decimal.

import { lerNumero, normalizar } from './utils.js';

export const MODELO_CSV =
  'nome;kcal;proteina;carboidrato;gordura;fibra;sodio;porcoes;fonte\n' +
  'Whey protein (exemplo);400;80;8;6;0;300;scoop=30;rótulo\n' +
  'Pão integral da padaria (exemplo);250;10;45;3,5;6;450;fatia=30;rótulo\n';

const COLUNAS = {
  nome: ['nome', 'alimento', 'descricao'],
  kcal: ['kcal', 'energia', 'calorias'],
  prot: ['proteina', 'proteinas', 'prot'],
  carb: ['carboidrato', 'carboidratos', 'carb'],
  gord: ['gordura', 'gorduras', 'lipideos', 'gord'],
  fibra: ['fibra', 'fibras'],
  sodio_mg: ['sodio', 'sodio mg'],
  porcoes: ['porcoes', 'porcao'],
  fonte: ['fonte', 'origem'],
};
const ORDEM = ['nome', 'kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg', 'porcoes', 'fonte'];

/** Divide uma linha respeitando aspas. */
function dividir(linha, sep) {
  const r = []; let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
    else if (c === sep && !aspas) { r.push(atual); atual = ''; }
    else atual += c;
  }
  r.push(atual);
  return r.map((s) => s.trim());
}

export function lerPorcoes(txt) {
  if (!txt) return [];
  return txt.split('|').map((p) => {
    const [nome, g] = p.split('=');
    return { nome: (nome || '').trim(), g: lerNumero(g) };
  }).filter((p) => p.nome && p.g > 0);
}

/**
 * Retorna { linhas: [{ n, food, erros: [], avisos: [] }] }.
 * `existentes`: Set de nomes normalizados já cadastrados (marca duplicata).
 */
export function analisarCSV(texto, existentes = new Set()) {
  const brutas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!brutas.length) return { linhas: [] };
  const sep = (brutas[0].match(/;/g) || []).length >= (brutas[0].match(/,/g) || []).length ? ';' : ',';
  let cab = dividir(brutas[0], sep).map(normalizar);
  let idx = {};
  const temCab = cab.some((h) => COLUNAS.nome.includes(h)) && cab.some((h) => COLUNAS.kcal.includes(h));
  if (temCab) {
    for (const [campo, nomes] of Object.entries(COLUNAS)) {
      const j = cab.findIndex((h) => nomes.includes(h));
      if (j >= 0) idx[campo] = j;
    }
  } else ORDEM.forEach((c, j) => (idx[c] = j));
  const vistos = new Set();
  const linhas = brutas.slice(temCab ? 1 : 0).map((l, i) => {
    const cel = dividir(l, sep);
    const pega = (c) => (idx[c] != null ? cel[idx[c]] ?? '' : '');
    const erros = [], avisos = [];
    const food = { nome: pega('nome'), fonte: pega('fonte') || 'CSV', origem: 'csv', porcoes: lerPorcoes(pega('porcoes')) };
    if (!food.nome) erros.push('sem nome');
    for (const c of ['kcal', 'prot', 'carb', 'gord', 'fibra', 'sodio_mg']) {
      const bruto = pega(c);
      const v = bruto === '' ? null : lerNumero(bruto);
      if (v != null && Number.isNaN(v)) erros.push(`${c} inválido`);
      else if (v != null && v < 0) erros.push(`${c} negativo`);
      food[c] = v == null || Number.isNaN(v) ? null : v;
    }
    if (food.kcal == null && !erros.length) erros.push('sem kcal');
    if (food.kcal > 900) avisos.push('kcal acima de 900 por 100 g');
    const chave = normalizar(food.nome);
    if (existentes.has(chave)) avisos.push('já existe com esse nome');
    if (vistos.has(chave)) avisos.push('repetido no arquivo');
    vistos.add(chave);
    const falta = ['fibra', 'sodio_mg'].filter((k) => food[k] == null);
    if (falta.length) food.falta = falta;
    return { n: i + 1, food, erros, avisos, duplicata: avisos.some((a) => a.startsWith('já') || a.startsWith('repetido')) };
  });
  return { linhas, separador: sep, comCabecalho: temCab };
}

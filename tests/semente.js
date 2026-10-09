// tests/semente.js — dados simulados (só desenvolvimento): perfil, metas, 6 semanas de diário, pesos e água.
// Uso no navegador (app já aberto): const m = await import('./tests/semente.js'); await m.semear(); location.reload();
// Nunca é carregado pelo app nem listado no service worker.

import { db } from '../js/db.js';
import { metasIniciais } from '../js/goals.js';
import { criarItem } from '../js/diary.js';
import { chaveData } from '../js/utils.js';

// [id TACO, gramas] por refeição; variações escolhidas por (dia % n)
const CARDAPIO = {
  cafe: [[['taco-53', 50], ['taco-488', 100], ['taco-471', 150]], [['taco-7', 40], ['taco-448', 170], ['taco-182', 90]], [['taco-53', 50], ['taco-461', 30], ['taco-226', 150]]],
  almoco: [[['taco-3', 150], ['taco-561', 140], ['taco-410', 140], ['taco-78', 30]], [['taco-3', 130], ['taco-561', 120], ['taco-377', 130], ['taco-157', 60]]],
  lanche: [[['taco-222', 130]], [['taco-448', 170], ['taco-7', 20]], [['taco-182', 90]]],
  jantar: [[['taco-88', 200], ['taco-410', 150]], [['taco-40', 90], ['taco-377', 120]], [['taco-3', 120], ['taco-488', 100]]],
};

const somaDias = (chave, n) => { const d = new Date(chave + 'T12:00'); d.setDate(d.getDate() + n); return chaveData(d); };

/** Grava os dados simulados (substitui perfil/metas e os dias gerados). `hojeVazio` deixa só o almoço de hoje. */
export async function semear({ dias = 42, hojeSoAlmoco = true } = {}) {
  const foods = await (await fetch(new URL('../foods.json', import.meta.url))).json();
  const lista = Array.isArray(foods) ? foods : foods.foods;
  const porId = new Map(lista.map((f) => [f.id, f]));
  const hoje = chaveData();
  const inicio = somaDias(hoje, -dias);
  const perfil = { sexo: 'M', idade: 30, altura: 180, peso: 84, atividade: 'moderado', objetivo: 'perder', ritmo: 0.5 };
  await db.put('kv', 'perfil', perfil);
  await db.put('kv', 'metas', metasIniciais(perfil, inicio));
  const config = (await db.get('kv', 'config')) || {};
  await db.put('kv', 'config', { ...config, tourVisto: true, alvo: { peso: 78, inicio: { data: inicio, kg: 84 } } });
  try { localStorage.setItem('dicasVistas', JSON.stringify(['heroi', 'mais', 'apagar', 'painel', 'trocar-dia'])); } catch {}   // capturas sem balões

  for (let i = dias; i >= 0; i--) {
    const data = somaDias(hoje, -i);
    if (i > 0 && i % 9 === 4) continue;                                    // alguns dias sem registro
    const refeicoes = {};
    for (const [ref, ops] of Object.entries(CARDAPIO)) {
      if (i === 0 && hojeSoAlmoco && ref !== 'almoco') continue;
      const op = ops[(i + ref.length) % ops.length];
      const fds = [0, 6].includes(new Date(data + 'T12:00').getDay()) ? 1.25 : 1;   // fim de semana come mais
      refeicoes[ref] = op.map(([id, g]) => criarItem(porId.get(id), Math.round(g * fds)));
    }
    const dia = { data, nomes: {}, refeicoes };
    if (i % 7 === 2) dia.tags = ['treino'];
    await db.put('diary', data, dia);
    if (i % 2 === 0) await db.put('weights', data, [{ ts: Date.parse(data + 'T07:30'), kg: Math.round((84 - (dias - i) * 0.07 + Math.sin(i) * 0.4) * 10) / 10 }]);
    await db.put('water', data, { itens: [{ ts: Date.parse(data + 'T10:00'), ml: 250 * (4 + (i % 4)) }] });
  }
  return { dias, inicio };
}

// views/dados.js — histórico já calculado (dias com consumo, metas do dia, tendência do peso), compartilhado pelo
// check-in do Diário, pelos blocos de inteligência do Progresso e pelo planejador. Cache de 30 s em memória.

import { db } from '../db.js';
import { estado } from '../state.js';
import { totalDia, ehTreino, temConsumo } from '../diary.js';
import { metaDoDia } from '../goals.js';
import { tendenciaPeso } from '../progress.js';
import { lerPesos } from './reg-peso.js';

let cache = null;
export const invalidarHistorico = () => { cache = null; };

export async function dadosHistorico() {
  if (cache && Date.now() - cache.ts < 30000) return cache;
  const pesos = await lerPesos();
  const pesoEm = (data) => {
    let kg = estado.perfil?.peso || 0;
    for (const p of pesos) { if (p.data <= data) kg = p.kg; else break; }
    return kg;
  };
  const todos = (await db.getAll('diary')).map(([, d]) => d);
  const dias = todos.filter(temConsumo).map((d) => ({
    data: d.data, tot: totalDia(d), meta: metaDoDia(estado.metas, d.data, pesoEm(d.data), { treino: ehTreino(d) }), refeicoes: d.refeicoes, tags: d.tags || [],
  })).sort((a, b) => (a.data < b.data ? -1 : 1));
  cache = { ts: Date.now(), pesos, pesoEm, tend: tendenciaPeso(pesos), todos, dias };
  return cache;
}

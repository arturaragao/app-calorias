// jejum.js — jejum intermitente derivado dos horários dos lançamentos (sem notificações, sem registro à parte).
// Só contam itens com horário (`ts`) lançados no próprio dia e não planejados; itens antigos sem horário ficam fora.

const chave = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Horários (ts) de comida por dia: Map data → [ts ordenados]. */
export function refeicoesComHorario(diarios) {
  const m = new Map();
  for (const d of diarios) {
    const ts = Object.values(d.refeicoes || {}).flat().filter((i) => i.ts && !i.planejado && chave(i.ts) === d.data).map((i) => i.ts).sort((a, b) => a - b);
    if (ts.length) m.set(d.data, ts);
  }
  return m;
}

/** Jejum em curso: desde o último item com horário até agora. null se não há nenhum. */
export function jejumAtual(diarios, agora = Date.now()) {
  let ultimo = null;
  for (const ts of refeicoesComHorario(diarios).values()) { const u = ts.at(-1); if (u <= agora && (!ultimo || u > ultimo)) ultimo = u; }
  return ultimo ? { desde: ultimo, horas: (agora - ultimo) / 3600000 } : null;
}

/** Jejuns noturnos: do último item de um dia ao primeiro do dia seguinte (os dois com horário). Mais recentes primeiro. */
export function historicoJejum(diarios, n = 7) {
  const m = refeicoesComHorario(diarios), datas = [...m.keys()].sort();
  const out = [];
  for (let i = 1; i < datas.length; i++) {
    const ant = new Date(datas[i - 1] + 'T12:00'), atual = new Date(datas[i] + 'T12:00');
    if ((atual - ant) / 86400000 !== 1) continue;                         // só noites entre dias seguidos
    out.push({ data: datas[i], inicio: m.get(datas[i - 1]).at(-1), fim: m.get(datas[i])[0], horas: (m.get(datas[i])[0] - m.get(datas[i - 1]).at(-1)) / 3600000 });
  }
  return out.reverse().slice(0, n);
}

/** "13 h 20 min" */
export const fmtDuracao = (h) => { const t = Math.max(0, Math.round(h * 60)); return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} min`; };

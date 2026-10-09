// padroes.js — cartões de padrão (sem IA): fatos do próprio histórico, cada um com o número que o sustenta.
// Heurísticas do app (limiares práticos, ver DECISOES.md); o usuário pode esconder um tipo ("não mostrar este tipo").

const PROT_REF = 0.4;   // g/kg por refeição (Schoenfeld & Aragon, JISSN 2018;15:10), mesmo alvo do diário

const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);
const diaSem = (k) => (new Date(k + 'T12:00').getDay() + 6) % 7;   // 0 = segunda
const naMeta = (d) => d.meta.kcal > 0 && Math.abs(d.tot.kcal / d.meta.kcal - 1) <= 0.1;

/**
 * dias: [{ data, tot, meta, refeicoes, tags }] (só dias com consumo, últimos 28 dias); peso em kg; nomesTags: id → rótulo.
 * Devolve cartões [{ tipo, titulo, texto, forca }] ordenados pela força (0–1).
 */
export function detectarPadroes(dias, { peso = 0, nomesTags = {} } = {}) {
  const out = [];
  // 1) fins de semana × dias úteis
  const fds = dias.filter((d) => diaSem(d.data) >= 5).map((d) => d.tot.kcal), uteis = dias.filter((d) => diaSem(d.data) < 5).map((d) => d.tot.kcal);
  if (fds.length >= 3 && uteis.length >= 6) {
    const dif = media(fds) - media(uteis);
    if (Math.abs(dif) >= 200) out.push({ tipo: 'fds', forca: Math.min(1, Math.abs(dif) / 600),
      titulo: `Fins de semana ${dif > 0 ? '+' : '−'}${Math.round(Math.abs(dif))} kcal`,
      texto: `Média de ${Math.round(media(fds))} kcal no sábado/domingo contra ${Math.round(media(uteis))} kcal nos dias úteis (${fds.length} e ${uteis.length} dias).` });
  }
  // 2) proteína do café da manhã abaixo de 0,4 g/kg
  if (peso > 0) {
    const alvo = PROT_REF * peso;
    const ult7 = dias.slice(-7).filter((d) => (d.refeicoes?.cafe || []).some((i) => !i.planejado));
    const baixos = ult7.filter((d) => d.refeicoes.cafe.filter((i) => !i.planejado).reduce((s, i) => s + (i.n?.prot || 0), 0) < alvo);
    if (ult7.length >= 5 && baixos.length >= 5) out.push({ tipo: 'prot-cafe', forca: baixos.length / 7,
      titulo: 'Café da manhã com pouca proteína',
      texto: `Abaixo de ${Math.round(alvo)} g (0,4 g/kg) em ${baixos.length} de ${ult7.length} cafés registrados nos últimos 7 dias.` });
  }
  // 3) sódio acima da meta nos dias com uma etiqueta
  const tags = new Set(dias.flatMap((d) => d.tags || []));
  for (const t of tags) {
    const com = dias.filter((d) => d.tags?.includes(t)), sem = dias.filter((d) => !d.tags?.includes(t));
    if (com.length < 3 || sem.length < 5) continue;
    const acima = (l) => l.filter((d) => d.meta.sodio > 0 && d.tot.sodio_mg > d.meta.sodio).length / l.length;
    const a = acima(com), b = acima(sem);
    if (a >= 0.7 && a - b >= 0.3) out.push({ tipo: 'sodio-tag', forca: a - b,
      titulo: `Sódio alto nos dias de “${nomesTags[t] || t}”`,
      texto: `Acima da meta em ${Math.round(a * com.length)} de ${com.length} dias com a etiqueta (${Math.round(b * 100)}% nos outros dias).` });
  }
  // 4) aderência × café lançado antes das 9 h
  const horaCafe = (d) => {
    const ts = (d.refeicoes?.cafe || []).map((i) => i.ts).filter(Boolean).sort()[0];
    if (!ts) return null;
    const h = new Date(ts);
    const k = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    return k === d.data ? h.getHours() + h.getMinutes() / 60 : null;
  };
  const cedo = dias.filter((d) => { const h = horaCafe(d); return h != null && h < 9; });
  const outros = dias.filter((d) => { const h = horaCafe(d); return h == null || h >= 9; });
  if (cedo.length >= 4 && outros.length >= 4) {
    const a = cedo.filter(naMeta).length / cedo.length, b = outros.filter(naMeta).length / outros.length;
    if (a - b >= 0.2) out.push({ tipo: 'cafe-cedo', forca: a - b,
      titulo: 'Mais aderência quando lança o café cedo',
      texto: `Na meta em ${Math.round(a * 100)}% dos dias com o café lançado antes das 9 h, contra ${Math.round(b * 100)}% nos outros (${cedo.length} e ${outros.length} dias).` });
  }
  return out.sort((x, y) => y.forca - x.forca);
}

/** No máximo `n` cartões, sem os tipos escondidos pelo usuário. */
export const cartoesDaSemana = (padroes, ocultos = [], n = 2) => padroes.filter((p) => !ocultos.includes(p.tipo)).slice(0, n);

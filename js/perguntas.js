// perguntas.js — "Pergunte ao app": pergunta → consulta estruturada → resposta calculada NO APARELHO.
// O interpretador local resolve as perguntas comuns; a IA (se houver) só converte o texto em consulta (nenhum dado do
// diário sai do aparelho). Consulta = { dias, ini, fim, nutriente, refeicao (id|null), agregacao: 'media'|'total'|'max'|'min' }.

import { normalizar } from './utils.js';

export const NUTRIENTES_PERG = {
  kcal: { nome: 'calorias', un: 'kcal', termos: ['caloria', 'calorias', 'kcal', 'energia'] },
  prot: { nome: 'proteína', un: 'g', termos: ['proteina', 'proteinas', 'prot'] },
  carb: { nome: 'carboidrato', un: 'g', termos: ['carboidrato', 'carboidratos', 'carbo', 'carbos', 'carb'] },
  gord: { nome: 'gordura', un: 'g', termos: ['gordura', 'gorduras', 'lipidio', 'lipidios'] },
  fibra: { nome: 'fibra', un: 'g', termos: ['fibra', 'fibras'] },
  sodio_mg: { nome: 'sódio', un: 'mg', termos: ['sodio', 'sal'] },
};
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, trinta: 30 };

const dt = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const segunda = (k) => dt(k, -((new Date(k + 'T12:00').getDay() + 6) % 7));

/** Período citado na pergunta → { ini, fim, rotulo }. Padrão: últimos 7 dias. */
export function periodoDe(q, hoje) {
  const n = (s) => (/^\d+$/.test(s) ? Number(s) : NUM[s]);
  let m;
  if (/\bhoje\b/.test(q)) return { ini: hoje, fim: hoje, rotulo: 'hoje' };
  if (/\bontem\b/.test(q)) return { ini: dt(hoje, -1), fim: dt(hoje, -1), rotulo: 'ontem' };
  if (/semana passada/.test(q)) { const s = segunda(hoje); return { ini: dt(s, -7), fim: dt(s, -1), rotulo: 'na semana passada' }; }
  if (/(esta|essa|nesta|nessa) semana/.test(q)) return { ini: segunda(hoje), fim: hoje, rotulo: 'nesta semana' };
  if (/(este|esse|neste|nesse) mes/.test(q)) return { ini: hoje.slice(0, 8) + '01', fim: hoje, rotulo: 'neste mês' };
  if ((m = q.match(/ultim[oa]s? (\w+) (dia|dias|semana|semanas|mes|meses)\b/))) {
    const k = n(m[1]) || 1, por = m[2].startsWith('dia') ? 1 : m[2].startsWith('semana') ? 7 : 30;
    return { ini: dt(hoje, -(k * por) + 1), fim: hoje, rotulo: `nos últimos ${k * por} dias` };
  }
  if (/\b(do|no) mes\b/.test(q)) return { ini: dt(hoje, -29), fim: hoje, rotulo: 'nos últimos 30 dias' };
  if ((m = q.match(/ultim[oa] (semana|mes)\b/))) { const d = m[1] === 'semana' ? 7 : 30; return { ini: dt(hoje, -d + 1), fim: hoje, rotulo: `nos últimos ${d} dias` }; }
  return { ini: dt(hoje, -6), fim: hoje, rotulo: 'nos últimos 7 dias' };
}

/** Interpretador local. refs: [{id, nome}] das refeições. null se não achar o nutriente. */
export function interpretarPergunta(texto, hoje, refs = []) {
  const q = normalizar(texto);
  const palavras = q.split(' ');
  const nutriente = Object.entries(NUTRIENTES_PERG).find(([, v]) => v.termos.some((t) => palavras.includes(t)))?.[0];
  if (!nutriente) return null;
  const refeicao = refs.find((r) => q.includes(normalizar(r.nome)) || (r.id === 'cafe' && /\bcafe\b/.test(q)))?.id || null;
  const agregacao = /\b(maior|maximo|mais alto|pico)\b/.test(q) ? 'max' : /\b(menor|minimo|mais baixo)\b/.test(q) ? 'min'
    : /\b(total|ao todo|somando|soma|somado)\b/.test(q) ? 'total' : 'media';
  return { ...periodoDe(q, hoje), nutriente, refeicao, agregacao };
}

/** Valida a consulta devolvida pela IA (nada de campo inventado). */
export function normalizarConsulta(o, hoje, refs = []) {
  const nutriente = NUTRIENTES_PERG[o?.nutriente] ? o.nutriente : null;
  if (!nutriente) return null;
  const dias = Math.max(1, Math.min(366, Math.round(Number(o?.dias) || 7)));
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(o?.fim || '') && o.fim <= hoje ? o.fim : hoje;
  const refeicao = refs.some((r) => r.id === o?.refeicao) ? o.refeicao : null;
  const agregacao = ['media', 'total', 'max', 'min'].includes(o?.agregacao) ? o.agregacao : 'media';
  return { ini: dt(fim, -dias + 1), fim, rotulo: dias === 1 ? (fim === hoje ? 'hoje' : 'no dia') : `em ${dias} dias`, nutriente, refeicao, agregacao };
}

/** Executa no aparelho. diarios: dias do banco. Planejados não contam. Devolve { valor, total, media, dias, max, min } ou null. */
export function executarConsulta(c, diarios) {
  const porDia = diarios.filter((d) => d.data >= c.ini && d.data <= c.fim).map((d) => {
    const listas = c.refeicao ? [d.refeicoes?.[c.refeicao] || []] : Object.values(d.refeicoes || {});
    const itens = listas.flat().filter((i) => !i.planejado);
    return { data: d.data, n: itens.length, v: itens.reduce((s, i) => s + (i.n?.[c.nutriente] || 0), 0) };
  }).filter((x) => x.n > 0);
  if (!porDia.length) return null;
  const total = porDia.reduce((s, x) => s + x.v, 0);
  const max = porDia.reduce((a, x) => (x.v > a.v ? x : a)), min = porDia.reduce((a, x) => (x.v < a.v ? x : a));
  const media = total / porDia.length;
  const valor = { media, total, max: max.v, min: min.v }[c.agregacao];
  return { valor, total, media, dias: porDia.length, max, min };
}

/** Frase de resposta (números arredondados para exibir). */
export function respostaTexto(c, r, nomeRef = '') {
  const N = NUTRIENTES_PERG[c.nutriente];
  const f = (v) => `${Math.round(v).toLocaleString('pt-BR')} ${N.un}`;
  if (!r) return `Não há registros ${c.rotulo}${nomeRef ? ` no ${nomeRef.toLowerCase()}` : ''}.`;
  const onde = nomeRef ? ` no ${nomeRef.toLowerCase()}` : '';
  const dm = (k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
  if (c.agregacao === 'max') return `O maior foi ${f(r.max.v)} de ${N.nome}${onde}, em ${dm(r.max.data)} (${c.rotulo}).`;
  if (c.agregacao === 'min') return `O menor foi ${f(r.min.v)} de ${N.nome}${onde}, em ${dm(r.min.data)} (${c.rotulo}).`;
  if (r.dias === 1) return `${f(r.total)} de ${N.nome}${onde} ${c.rotulo}.`;
  return c.agregacao === 'total'
    ? `${f(r.total)} de ${N.nome}${onde} ${c.rotulo} (média de ${f(r.media)} por dia em ${r.dias} dias com registro).`
    : `Média de ${f(r.media)} de ${N.nome}${onde} por dia ${c.rotulo} (${r.dias} dias com registro; total ${f(r.total)}).`;
}

/** Perguntas prontas (sem IA). */
export const PERGUNTAS_PRONTAS = [
  'Média de proteína nos últimos 7 dias',
  'Quanto de proteína comi no jantar nas últimas 2 semanas?',
  'Total de calorias nesta semana',
  'Média de fibra nos últimos 30 dias',
  'Maior sódio do mês',
  'Média de carboidrato no café nos últimos 14 dias',
];

// views/detalhe-dia.js — "Detalhes" do dia (toque no resumo) e painel de cada refeição (toque no título).
// Gráficos em SVG próprio; cada macro tem sempre a mesma cor (var(--prot/--carb/--gord), editáveis em Ajustes).

import { estado, salvarConfig } from '../state.js';
import { totalDia, totalRefeicao, refeicoesDoDia, camposFaltando, distribuicaoRefeicoes } from '../diary.js';
import { carregarBase } from '../foods.js';
import { tabelaMicros } from './micros-ui.js';
import { abrirFolha, esc, iconeRef, aviso } from '../ui.js';
import { fmtKcal, fmtG, fmtMg, fmtNum, lerNumero } from '../utils.js';

export const MACROS = [
  { k: 'prot', nome: 'Proteína', cor: 'var(--prot)', kcalG: 4 },
  { k: 'carb', nome: 'Carboidrato', cor: 'var(--carb)', kcalG: 4 },
  { k: 'gord', nome: 'Gordura', cor: 'var(--gord)', kcalG: 9 },
];
const EXTRAS = [
  { k: 'fibra', nome: 'Fibra', cor: 'var(--acento)', meta: 'fibra', f: fmtG, un: 'g' },
  { k: 'sodio_mg', nome: 'Sódio', cor: 'var(--txt2)', meta: 'sodio', f: fmtMg, un: 'mg' },
];
const todos = () => [...MACROS.map((m) => ({ ...m, meta: m.k, f: fmtG, un: 'g' })), ...EXTRAS];
const pct = (v, m) => (m > 0 ? Math.round((v / m) * 100) : null);

// ---------- Peças gráficas ----------

/** Rosca SVG: segs = [{v, cor}]; centro = html sobreposto. */
export function rosca(segs, { tam = 132, esp = 16, centro = '', fundo = 'var(--anel-fundo)' } = {}) {
  const r = (tam - esp) / 2, C = 2 * Math.PI * r, tot = segs.reduce((s, x) => s + Math.max(0, x.v), 0);
  let ac = 0;
  const arcos = tot > 0 ? segs.filter((s) => s.v > 0).map((s) => {
    const len = (s.v / tot) * C, gap = segs.filter((x) => x.v > 0).length > 1 ? Math.min(3, len / 3) : 0;
    const el = `<circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="${s.cor}" stroke-width="${esp}"
      stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-ac}"/>`;
    ac += len;
    return el;
  }).join('') : '';
  return `<div class="rosca" style="width:${tam}px;height:${tam}px"><svg viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
    <circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="${fundo}" stroke-width="${esp}"/>${arcos}</svg>
    <div class="centro">${centro}</div></div>`;
}

/** Barra horizontal empilhada: segs = [{v, cor, rot}]; total pode ser uma meta maior que a soma. */
const pilha = (segs, total) => {
  const t = total || segs.reduce((s, x) => s + x.v, 0) || 1;
  return `<div class="pilha">${segs.filter((s) => s.v > 0).map((s) =>
    `<i style="width:${Math.min(100, (s.v / t) * 100)}%;background:${s.cor}" title="${esc(s.rot || '')}"></i>`).join('')}</div>`;
};

const barraMeta = (v, m, cor) => {
  const p = m > 0 ? Math.min(100, (v / m) * 100) : 0;
  return `<div class="trilho-m"><i style="width:${p}%;background:${cor}"></i>${m > 0 && v > m ? '<b class="passou"></b>' : ''}</div>`;
};

const kcalMacros = (t) => MACROS.map((m) => ({ v: (t[m.k] || 0) * m.kcalG, cor: m.cor, rot: m.nome }));

// ---------- Detalhes do dia ----------

export async function detalheDia(dia, meta, { rotulo, alvoProt }) {
  const base = await carregarBase().catch(() => null);
  const refs = refeicoesDoDia(dia, estado.config.refeicoes).filter((r) => (dia.refeicoes[r.id] || []).length);
  const tot = totalDia(dia), restante = meta.kcal - tot.kcal;
  const falta = camposFaltando(Object.values(dia.refeicoes).flat());
  const km = kcalMacros(tot), kmTot = km.reduce((s, x) => s + x.v, 0);
  const metaKm = MACROS.map((m) => (meta[m.k] || 0) * m.kcalG), metaKmTot = metaKm.reduce((s, v) => s + v, 0);

  const corpo = () => `
    <div class="det-eq num">
      <div><b>${fmtKcal(meta.kcal)} <small>kcal</small></b><span>Meta</span></div>
      <div><b>${fmtKcal(tot.kcal)} <small>kcal</small></b><span>Consumido</span></div>
      <div class="${restante < 0 ? 'acima' : ''}"><b>${restante < 0 ? '+' : ''}${fmtKcal(Math.abs(restante))} <small>kcal</small></b><span>${restante < 0 ? 'Acima' : 'Restante'}</span></div>
    </div>
    <div class="det-topo">
      ${rosca(km, { centro: `<b class="num">${fmtNum(pct(tot.kcal, meta.kcal) ?? 0)}%</b><span>da meta</span>` })}
      <ul class="det-leg">${MACROS.map((m, i) => `<li><i style="background:${m.cor}"></i><span>${m.nome}</span>
        <b class="num">${kmTot ? Math.round((km[i].v / kmTot) * 100) : 0}%</b>
        <small class="num">meta ${metaKmTot ? Math.round((metaKm[i] / metaKmTot) * 100) : 0}%</small></li>`).join('')}
        <li class="mudo" style="font-size:.74rem">% das calorias vindas de cada macro</li></ul>
    </div>
    <p class="secao">Nutrientes · toque para ver a origem</p>
    <div class="det-nutri">${todos().map((n) => {
      const v = tot[n.k] || 0, m = meta[n.meta] || 0;
      return `<button type="button" class="det-n" data-nutri="${n.k}">
        <span class="rot"><i style="background:${n.cor}"></i>${n.nome}<span class="num"><b>${n.f(v)}</b> / ${n.f(m)} ${n.un}</span>
        <em class="num ${m && v > m ? 'acima' : ''}">${pct(v, m) ?? '—'}${m ? '%' : ''}</em></span>${barraMeta(v, m, n.cor)}</button>`;
    }).join('')}</div>
    ${refs.length ? `<p class="secao">Calorias por refeição</p><div class="card-in">${refs.map((r) => {
      const t = totalRefeicao(dia, r.id);
      return `<button type="button" class="det-ref" data-ref-painel="${r.id}"><span class="rot"><span>${esc(r.nome)}</span>
        <span class="num"><b>${fmtKcal(t.kcal)}</b> kcal · ${pct(t.kcal, tot.kcal) ?? 0}%</span></span>${pilha(kcalMacros(t), tot.kcal)}</button>`;
    }).join('')}
      <div class="legenda-m">${MACROS.map((m) => `<span><i style="background:${m.cor}"></i>${m.nome}</span>`).join('')}</div></div>` : ''}
    ${falta.length ? `<p class="nota alerta">Alguns itens não têm todos os nutrientes na fonte (${falta.map((k) => ({ fibra: 'fibra', sodio_mg: 'sódio', kcal: 'kcal', prot: 'proteína', carb: 'carboidrato', gord: 'gordura' }[k])).join(', ')}); os totais podem estar subestimados.</p>` : ''}
    ${tabelaMicros(Object.values(dia.refeicoes).flat(), 1, base)}
    ${alvoProt ? `<p class="mudo">Proteína por refeição: alvo ≈ ${alvoProt} g (0,4 g/kg; Schoenfeld & Aragon, 2018), em 4 ou mais refeições.</p>` : ''}
    ${meta.treinoExtra ? `<p class="nota">🏋️ Dia de treino: meta +${fmtKcal(meta.treinoExtra)} kcal (em carboidratos).</p>` : ''}
    ${dia.nota ? `<p class="nota">📝 ${esc(dia.nota)}</p>` : ''}
    ${meta.macroModo !== 'pct' && Math.abs(meta.diferenca) >= 1 ? `<p class="nota">Meta calórica derivada dos macros (${fmtKcal(meta.kcal)} kcal); a planejada era ${fmtKcal(meta.kcalPlanejada)} kcal.</p>` : ''}`;

  const abrir = () => {
    const p = abrirFolha(`Detalhes — ${rotulo}`, `<div class="det">${corpo()}</div>`, { foco: false });
    p.onclick = (e) => {
      const n = e.target.closest('[data-nutri]');
      if (n) return origemNutriente(n.dataset.nutri);
      const r = e.target.closest('[data-ref-painel]');
      if (r) return painelRefeicao(dia, meta, r.dataset.refPainel, { voltar: abrir });
    };
  };

  /** Painel de um nutriente: por refeição (rosca + barras) e os alimentos que mais contribuíram. */
  function origemNutriente(k) {
    const n = todos().find((x) => x.k === k);
    const total = tot[k] || 0, m = meta[n.meta] || 0;
    const porRef = refs.map((r) => ({ r, v: totalRefeicao(dia, r.id)[k] || 0 })).filter((x) => x.v > 0);
    const tons = [100, 78, 58, 42, 30, 22];
    const corRef = (i) => `color-mix(in srgb, ${n.cor} ${tons[i % tons.length]}%, var(--sup))`;
    const itens = refs.flatMap((r) => (dia.refeicoes[r.id] || []).map((it) => ({ nome: it.nome, ref: r.nome, v: it.n[k] || 0 })))
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const maior = itens[0]?.v || 1;
    const p = abrirFolha(`${n.nome} — origem`, `<div class="det">
      <button type="button" class="btn peq suave" data-voltar>‹ Detalhes do dia</button>
      <div class="det-topo" style="margin-top:12px">
        ${rosca(porRef.map((x, i) => ({ v: x.v, cor: corRef(i) })), { centro: `<b class="num">${n.f(total)}</b><span>${n.un}${m ? ` · ${pct(total, m)}%` : ''}</span>` })}
        <ul class="det-leg">${porRef.map((x, i) => `<li><i style="background:${corRef(i)}"></i><span>${esc(x.r.nome)}</span>
          <b class="num">${n.f(x.v)} ${n.un}</b><small class="num">${total ? Math.round((x.v / total) * 100) : 0}%</small></li>`).join('') || '<li class="mudo">Nada registrado.</li>'}</ul>
      </div>
      ${m ? `<div class="det-n" style="cursor:default"><span class="rot"><i style="background:${n.cor}"></i>Meta do dia<span class="num"><b>${n.f(total)}</b> / ${n.f(m)} ${n.un}</span>
        <em class="num">${m > total ? `faltam ${n.f(m - total)} ${n.un}` : `+${n.f(total - m)} ${n.un}`}</em></span>${barraMeta(total, m, n.cor)}</div>` : ''}
      <p class="secao">Alimentos que mais contribuíram</p>
      <ul class="det-alim">${itens.slice(0, 15).map((x) => `<li><span class="nm">${esc(x.nome)}<small>${esc(x.ref)}</small></span>
        <span class="num"><b>${n.f(x.v)}</b> ${n.un}</span><i style="width:${(x.v / maior) * 100}%;background:${n.cor}"></i></li>`).join('')
        || '<li class="mudo">Nenhum alimento com esse nutriente hoje.</li>'}</ul></div>`, { foco: false });
    p.onclick = (e) => { if (e.target.closest('[data-voltar]')) abrir(); };
  }

  abrir();
}

// ---------- Painel da refeição ----------

/** Macros da refeição × parcela sugerida da meta do dia (parcela editável por refeição). */
export function painelRefeicao(dia, meta, refId, { voltar, aoMudar } = {}) {
  const refsCfg = refeicoesDoDia(dia, estado.config.refeicoes);
  const ref = refsCfg.find((r) => r.id === refId);
  const dist = distribuicaoRefeicoes(refsCfg, estado.config.distRef || {});
  const fr = dist[refId] || 0;
  const t = totalRefeicao(dia, refId), itens = dia.refeicoes[refId] || [];
  const alvo = { kcal: meta.kcal * fr, prot: meta.prot * fr, carb: meta.carb * fr, gord: meta.gord * fr };
  const linhas = [{ k: 'kcal', nome: 'Calorias', cor: 'var(--acento)', f: fmtKcal, un: 'kcal' }, ...MACROS.map((m) => ({ ...m, f: fmtG, un: 'g' }))];
  const maxKcal = Math.max(1, ...itens.map((it) => it.n.kcal));
  const p = abrirFolha(ref?.nome || 'Refeição', `<div class="det">
    ${voltar ? '<button type="button" class="btn peq suave" data-voltar>‹ Detalhes do dia</button>' : ''}
    <div class="det-topo" style="margin-top:${voltar ? 12 : 0}px">
      ${rosca(kcalMacros(t), { centro: `<span class="ref-ico" aria-hidden="true">${iconeRef(refId)}</span><b class="num">${fmtKcal(t.kcal)}</b><span>de ${fmtKcal(alvo.kcal)} kcal</span>` })}
      <div class="det-leg"><p class="mudo" style="margin:0 0 6px">Sugestão para esta refeição: <b>${Math.round(fr * 100)}%</b> da meta do dia.</p>
        <form id="f-dist" class="linha" style="gap:6px"><input type="text" inputmode="decimal" name="pct" value="${Math.round(fr * 100)}" aria-label="Parcela do dia em %" style="min-height:40px;text-align:center">
          <span class="mudo" style="flex:0">%</span><button class="btn peq suave">Salvar</button></form></div>
    </div>
    <p class="secao">Consumido × sugerido</p>
    <div class="det-nutri">${linhas.map((n) => {
      const v = t[n.k] || 0, m = alvo[n.k] || 0;
      return `<div class="det-n" style="cursor:default"><span class="rot"><i style="background:${n.cor}"></i>${n.nome}
        <span class="num"><b>${n.f(v)}</b> / ${n.f(m)} ${n.un}</span><em class="num ${m && v > m * 1.1 ? 'acima' : ''}">${pct(v, m) ?? '—'}${m ? '%' : ''}</em></span>${barraMeta(v, m, n.cor)}</div>`;
    }).join('')}</div>
    ${itens.length ? `<p class="secao">Itens</p><ul class="det-alim">${itens.map((it) => `<li><span class="nm">${esc(it.nome)}
      <small class="num">P ${fmtG(it.n.prot)} · C ${fmtG(it.n.carb)} · G ${fmtG(it.n.gord)} g</small></span>
      <span class="num"><b>${fmtKcal(it.n.kcal)}</b> kcal</span>${pilha(kcalMacros(it.n), maxKcal)}</li>`).join('')}</ul>` : '<p class="mudo">Nada lançado nesta refeição.</p>'}
    <p class="mudo" style="font-size:.76rem">Parcelas de referência (editáveis): café 25%, almoço 35%, lanche 10%, jantar 25%, ceia 5%. As demais refeições dividem o restante.</p></div>`, { foco: false });
  p.onclick = (e) => { if (e.target.closest('[data-voltar]')) voltar(); };
  p.querySelector('#f-dist').onsubmit = async (e) => {
    e.preventDefault();
    const v = lerNumero(e.target.pct.value);
    if (isNaN(v) || v < 0 || v > 100) return aviso('Informe um valor entre 0 e 100.');
    // esta refeição fica com v%; as outras dividem (100 − v)% mantendo a proporção entre si
    const outros = refsCfg.filter((r) => r.id !== refId), somaOut = outros.reduce((s, r) => s + dist[r.id], 0);
    estado.config.distRef = Object.fromEntries([[refId, v], ...outros.map((r) =>
      [r.id, Math.round((somaOut ? (dist[r.id] / somaOut) * (100 - v) : (100 - v) / outros.length) * 10) / 10])]);
    await salvarConfig();
    aviso('Parcela salva; as outras refeições dividem o restante.');
    painelRefeicao(dia, meta, refId, { voltar, aoMudar });
    aoMudar?.();
  };
}

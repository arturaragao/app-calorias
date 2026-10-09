// views/restaurante.js — "Comer fora": foto do cardápio → a IA lista os pratos (estimativa por porção) →
// o app escolhe, no aparelho, o que melhor cabe no que falta no dia. O lançamento fica marcado como estimativa.

import { estado, lerDia, gravarDia, pesoAtual } from '../state.js';
import { totalDia, ehTreino, criarItemRapido, adicionarItem, distribuicaoRefeicoes } from '../diary.js';
import { metaDoDia } from '../goals.js';
import { erroCombinacao, fracaoProximaRefeicao } from '../inteligencia.js';
import { estimarRestaurante, motorIA, rotuloCota } from '../ia.js';
import { comprimir } from '../photos.js';
import { abrirFolha, fecharFolha, aviso, esc, ic, ICONES, $, $$, vibrar } from '../ui.js';
import { fmtKcal, fmtMacro, fmtNum } from '../utils.js';
import { refeicaoPeloHorario } from './sugestao.js';
import { entregarImagem } from './foto-ia.js';

export async function folhaRestaurante({ data = estado.dataAtual, refId = refeicaoPeloHorario(), aoLancar, arquivo = null } = {}) {
  if (!(await motorIA({ comImagem: true }))) {
    const { folhaFotoIA } = await import('./foto-ia.js');
    return folhaFotoIA({ data, refId, aoLancar });            // abre o pedido da chave do Gemini
  }
  const p = abrirFolha('Restaurante', `
    <p class="mudo" style="margin-top:-4px">Fotografe o cardápio: o app sugere o prato que melhor cabe no que falta hoje. Valores são estimativas da IA.</p>
    <div class="grade2"><label class="btn prim">${ICONES.camera} Fotografar<input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn">Da galeria<input type="file" accept="image/*" hidden></label></div>
    <p class="mudo ia-cota" id="cota"></p>`, { foco: false });
  rotuloCota({ comImagem: true }).then((t) => { if ($('#cota', p)) $('#cota', p).textContent = t; }).catch(() => {});
  $$('input[type=file]', p).forEach((inp) => {
    inp.onchange = async () => {
      const arq = inp.files[0];
      if (!arq) return;
      let blob;
      try { blob = await comprimir(arq); } catch { return aviso('Não consegui ler essa imagem.'); }
      p.innerHTML = p.innerHTML.split('</h2>')[0] + '</h2><p class="mudo" role="status">Lendo o cardápio…</p>';
      try {
        const r = await estimarRestaurante(blob);
        await escolher(p, r, { data, refId, aoLancar });
      } catch (e) {
        p.insertAdjacentHTML('beforeend', `<p class="erro">${esc(e.message)}</p>`);
      }
    };
  });
  if (arquivo) entregarImagem(p, arquivo);
}

/** Ranqueia os pratos pelo que falta na refeição (parcela do restante do dia) e oferece lançar. */
async function escolher(p, { itens, obs }, { data, refId, aoLancar }) {
  const dia = await lerDia(data), refs = estado.config.refeicoes;
  const meta = metaDoDia(estado.metas, data, await pesoAtual(), { treino: ehTreino(dia) });
  const tot = totalDia(dia);
  const vazias = new Set(refs.filter((r) => !(dia.refeicoes[r.id] || []).filter((i) => !i.planejado).length).map((r) => r.id));
  const fr = fracaoProximaRefeicao(refId, refs.map((r) => r.id), vazias, distribuicaoRefeicoes(refs, estado.config.distRef));
  const alvo = Object.fromEntries(['kcal', 'prot', 'carb', 'gord'].map((k) => [k, Math.max(0, (meta[k] - tot[k]) * fr)]));
  const ord = itens.map((it) => ({ it, e: erroCombinacao({ kcal: it.kcal, prot: it.prot, carb: it.carb, gord: it.gord }, alvo) })).sort((a, b) => a.e - b.e);
  const nomeRef = refs.find((r) => r.id === refId)?.nome || '';
  p.innerHTML = p.innerHTML.split('</h2>')[0] + `</h2>
    <p class="mudo" style="margin-top:-4px">Para o ${esc(nomeRef.toLowerCase())}: alvo ≈ <b class="num">${fmtKcal(alvo.kcal)} kcal</b> · P ${fmtMacro(alvo.prot)} g (parte do que falta hoje).</p>
    ${obs ? `<p class="nota">${esc(obs)}</p>` : ''}
    ${ord.length ? ord.map((x, i) => `<div class="rest-prato${i === 0 ? ' melhor' : ''}">
      ${i === 0 ? `<span class="chip">${ic('target', 'p')} melhor para o que falta</span>` : ''}
      <div class="fr-lin"><b>${esc(x.it.nome)}</b><span class="num">${fmtKcal(x.it.kcal)} kcal</span></div>
      <p class="mudo num" style="margin:2px 0 6px">≈ ${fmtNum(Math.round(x.it.g || 0))} g · P ${fmtMacro(x.it.prot)} · C ${fmtMacro(x.it.carb)} · G ${fmtMacro(x.it.gord)}</p>
      <button type="button" class="btn ${i === 0 ? 'prim' : ''} bloco peq" data-lancar-prato="${i}">Lançar no ${esc(nomeRef.toLowerCase())}</button></div>`).join('')
      : '<p class="erro">Nenhum prato reconhecido. Tente outra foto.</p>'}`;
  p.onclick = async (e) => {
    const b = e.target.closest('[data-lancar-prato]');
    if (!b) return;
    const it = ord[Number(b.dataset.lancarPrato)].it;
    const antes = await lerDia(data);
    const item = { ...criarItemRapido({ nome: `${it.nome} (restaurante, ≈${fmtNum(Math.round(it.g || 0))} g)`, kcal: it.kcal, prot: it.prot, carb: it.carb, gord: it.gord, fibra: it.fibra, sodio_mg: null }),
      fonte: 'Restaurante (estimativa IA)', estimativa: true };
    await gravarDia(adicionarItem(antes, refId, nomeRef, item));
    vibrar(15);
    fecharFolha();
    await aoLancar?.();
    aviso(`${it.nome} → ${nomeRef} (estimativa)`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
  };
}

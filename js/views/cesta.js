// views/cesta.js — cesta: vários alimentos marcados na busca/Recentes, lançados de uma vez numa única folha.

import { estado, lerDia, gravarDia } from '../state.js';
import { porcoesDe } from '../foods.js';
import { criarItem, adicionarItem, nutrientesPorGramas } from '../diary.js';
import { catalogo, registrarRecente } from '../custom.js';
import { abrirFolha, fecharFolha, aviso, esc, $, $$, vibrar, ic } from '../ui.js';
import { chaveData, fmtKcal, fmtNum, fmtG, lerNumero } from '../utils.js';

/** foods: alimentos marcados. Cada um começa na última quantidade usada ou na 1ª porção conhecida. */
export async function folhaCesta(foods, { refId = estado.refeicaoAlvo, data = estado.dataAtual, aoLancar } = {}) {
  const cat = await catalogo();
  const refs = estado.config.refeicoes;
  const linhas = foods.map((f) => {
    const ps = [...porcoesDe(f, cat.porcoes, estado.config.porcoesUsuario), { nome: 'grama', g: 1 }];
    const u = estado.config.ultimaQtd[f.id];
    let i = u?.porcao && !u.porcao.ml ? ps.findIndex((p) => p.nome === u.porcao.nome) : -1;
    let qtd = i >= 0 ? u.porcao.qtd : 1;
    if (i < 0 && u) { i = ps.length - 1; qtd = Math.round(u.g); }        // última vez em gramas/mL → gramas
    if (i < 0) i = 0;
    return { f, ps, i, qtd };
  });
  const p = abrirFolha(`Lançar ${foods.length} alimentos`, `<form id="fc" novalidate>
    <div id="c-itens">${linhas.map((l, k) => `<div class="cesta-item" data-k="${k}">
      <div class="fr-lin"><span class="fr-nome">${esc(l.f.nome)}</span><b class="num" data-kcal></b></div>
      <div class="cesta-qtd"><input type="text" inputmode="decimal" name="q${k}" value="${fmtNum(l.qtd)}" aria-label="Quantidade de ${esc(l.f.nome)}">
        <select name="p${k}" aria-label="Medida de ${esc(l.f.nome)}">${l.ps.map((po, j) =>
          `<option value="${j}" ${j === l.i ? 'selected' : ''}>${po.nome === 'grama' ? 'gramas' : `× ${esc(po.nome)} (${fmtNum(po.g)} g)`}</option>`).join('')}</select></div></div>`).join('')}</div>
    <label class="campo"><span>Refeição</span><select name="ref">${refs.map((r) =>
      `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <p class="fr-total num" id="c-tot"></p><p class="erro" id="erro"></p>
    <button class="btn prim bloco">${ic('check')} Lançar todos</button></form>`, { foco: false });
  const ler = (k) => {
    const l = linhas[k], po = l.ps[Number($(`[name=p${k}]`, p).value)], q = lerNumero($(`[name=q${k}]`, p).value);
    return { g: po.g * q, porcao: po.nome === 'grama' ? null : { nome: po.nome, g: po.g, qtd: q } };
  };
  const atualizar = () => {
    let tot = 0;
    $$('[data-k]', p).forEach((el) => {
      const k = Number(el.dataset.k), { g } = ler(k);
      const kcal = g > 0 ? nutrientesPorGramas(linhas[k].f, g).n.kcal : 0;
      tot += kcal;
      el.querySelector('[data-kcal]').textContent = g > 0 ? `${fmtKcal(kcal)} kcal · ${fmtG(g)} g` : '—';
    });
    $('#c-tot', p).innerHTML = `Total: <b>${fmtKcal(tot)} kcal</b>`;
  };
  p.addEventListener('input', atualizar);
  p.addEventListener('change', atualizar);
  $('#fc', p).onsubmit = async (e) => {
    e.preventDefault();
    const qs = linhas.map((_, k) => ler(k));
    if (qs.some((q) => !(q.g > 0) || q.g > 5000)) { $('#erro', p).textContent = 'Confira as quantidades (maiores que zero e até 5000 g).'; return; }
    const r = e.target.ref.value, nomeRef = refs.find((x) => x.id === r)?.nome;
    const antes = await lerDia(data);
    let d = antes;
    linhas.forEach((l, k) => {
      const it = criarItem(l.f, qs[k].g, qs[k].porcao);
      if (data > chaveData()) it.planejado = true;
      d = adicionarItem(d, r, nomeRef, it);
      estado.config.ultimaQtd[l.f.id] = { g: qs[k].g, porcao: qs[k].porcao };
      registrarRecente(l.f.id);   // grava a config (com a última quantidade)
    });
    await gravarDia(d);
    vibrar(15);
    fecharFolha();
    await aoLancar?.();
    aviso(`${linhas.length} item(ns) → ${nomeRef}`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
  };
  atualizar();
}

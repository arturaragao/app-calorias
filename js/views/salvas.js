// views/salvas.js — refeições salvas ("meu café de sempre"): salvar a refeição atual e lançar tudo com um toque.
// Guardadas em estado.config.refeicoesSalvas (entram no backup).

import { estado, salvarConfig, lerDia, gravarDia } from '../state.js';
import { criarRefeicaoSalva, lancarSalva, somar } from '../diary.js';
import { abrirFolha, fecharFolha, aviso, esc, $, vibrar } from '../ui.js';
import { fmtKcal, fmtMacro } from '../utils.js';

const lista = () => (estado.config.refeicoesSalvas ||= []);

/** Salva os itens de uma refeição do dia como refeição salva (pede o nome). */
export function folhaSalvarRefeicao(itens, nomeSugerido) {
  if (!itens?.length) return aviso('Essa refeição está vazia.');
  const t = somar(itens);
  const p = abrirFolha('Salvar refeição', `<form id="fs" novalidate>
    <p class="mudo" style="margin-top:0">${itens.length} item(ns) · ${fmtKcal(t.kcal)} kcal · P ${fmtMacro(t.prot)} g. Depois é só lançar tudo com um toque.</p>
    <label class="campo"><span>Nome</span><input type="text" name="nome" maxlength="40" value="${esc(nomeSugerido)}" placeholder="ex.: Café de sempre"></label>
    <p class="erro" id="erro"></p><button class="btn prim bloco">Salvar</button></form>`);
  $('#fs', p).onsubmit = async (e) => {
    e.preventDefault();
    const nome = e.target.nome.value.trim();
    if (!nome) { $('#erro', p).textContent = 'Dê um nome.'; return; }
    lista().push(criarRefeicaoSalva(nome, itens));
    await salvarConfig();
    fecharFolha();
    aviso(`“${nome}” salva. Lance em ⋯ › Refeições salvas ou na tela Adicionar.`);
  };
}

/** Lista as refeições salvas para lançar na refeição `refId` do dia `data`. */
export function folhaSalvas({ data = estado.dataAtual, refId = estado.refeicaoAlvo, aoLancar } = {}) {
  const desenhar = () => {
    const l = lista();
    const refs = estado.config.refeicoes;
    const p = abrirFolha('Refeições salvas', l.length ? `
      <label class="campo"><span>Lançar em</span><select name="ref">${refs.map((r) => `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
      <ul class="lista">${l.map((s) => {
        const t = somar(s.itens);
        return `<li><button data-lancar="${s.id}"><span><span class="nome">${esc(s.nome)}</span>
          <span class="mudo">${s.itens.map((i) => esc(i.nome)).join(', ').slice(0, 90)}</span></span>
          <span class="num" style="white-space:nowrap"><b>${fmtKcal(t.kcal)}</b> <span class="mudo">kcal</span></span></button>
          <button class="ico" data-apagar="${s.id}" aria-label="Apagar ${esc(s.nome)}"><svg viewBox="0 0 24 24"><path d="M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13"/></svg></button></li>`;
      }).join('')}</ul>`
      : '<p class="mudo">Nenhuma refeição salva ainda. No diário, toque em ⋯ de uma refeição já lançada › “Salvar como refeição salva”.</p>');
    p.onclick = async (e) => {
      const ap = e.target.closest('[data-apagar]');
      if (ap) {
        const i = l.findIndex((s) => s.id === ap.dataset.apagar);
        const [rem] = l.splice(i, 1);
        await salvarConfig();
        desenhar();
        return aviso(`“${rem.nome}” apagada`, { acao: async () => { l.splice(i, 0, rem); await salvarConfig(); } });
      }
      const b = e.target.closest('[data-lancar]');
      if (!b) return;
      const s = l.find((x) => x.id === b.dataset.lancar);
      const r = $('[name=ref]', p).value, nomeRef = refs.find((x) => x.id === r)?.nome;
      const antes = await lerDia(data);
      await gravarDia(lancarSalva(antes, r, nomeRef, s));
      vibrar(12);
      fecharFolha();
      await aoLancar?.();
      aviso(`✓ ${s.nome} → ${nomeRef}`, { acao: async () => { await gravarDia(antes); aoLancar?.(); } });
    };
  };
  desenhar();
}

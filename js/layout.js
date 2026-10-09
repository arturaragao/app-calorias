// layout.js — ordem e visibilidade dos blocos de cada tela (editáveis pelo usuário).
// Cada bloco na tela tem data-bloco="id". A ordem vale entre irmãos do mesmo contêiner,
// então abas e botões de atalho (Adicionar, Registros) também podem ser reordenados.
// Esconder não remove a funcionalidade: o bloco volta a qualquer momento em "Organizar".

import { estado, salvarConfig } from './state.js';
import { abrirFolha, esc, aviso } from './ui.js';

export const BLOCOS = {
  diario: [
    ['semana', 'Faixa da semana'], ['resumo', 'Resumo do dia (anel e macros)'], ['etiquetas', 'Treino e nota do dia'],
    ['agua', 'Água'], ['refeicoes', 'Refeições'], ['copiar', 'Copiar o dia anterior'],
  ],
  adicionar: [
    ['aba-recentes', 'Aba Recentes'], ['aba-favoritos', 'Aba Favoritos'], ['aba-meus', 'Aba Meus'], ['aba-receitas', 'Aba Receitas'],
    ['foto', 'Atalho Foto do prato'], ['texto', 'Atalho Descrever'], ['salvas', 'Atalho Refeições salvas'],
    ['rotulo', 'Atalho Ler rótulo'], ['novo', 'Atalho Novo alimento'], ['receita', 'Atalho Nova receita'],
  ],
  registros: [['peso', 'Peso'], ['agua', 'Água'], ['medidas', 'Medidas'], ['dobras', 'Dobras'], ['fotos', 'Fotos']],
  progresso: [
    ['kpis', 'Indicadores'], ['peso', 'Peso'], ['gasto', 'Gasto real estimado'], ['semanas', 'Calorias por semana'],
    ['calendario', 'Calendário de aderência'], ['relatorio', 'Relatório semanal'], ['macros', 'Médias diárias × meta'],
    ['origem', 'De onde vêm as calorias'], ['composicao', 'Composição corporal'], ['circ', 'Circunferências'],
    ['pdf', 'Relatório em PDF'],
  ],
};
export const NOME_TELA = { diario: 'Diário', adicionar: 'Adicionar', registros: 'Registros', progresso: 'Progresso' };

/** Ordem atual (ids conhecidos; blocos novos de versões futuras entram na posição padrão). */
export function ordemDe(tela) {
  const padrao = BLOCOS[tela].map(([id]) => id);
  const salva = (estado.config.layout?.[tela]?.ordem || []).filter((id) => padrao.includes(id));
  padrao.forEach((id, i) => { if (!salva.includes(id)) salva.splice(Math.min(i, salva.length), 0, id); });
  return salva;
}
export const ocultos = (tela) => new Set(estado.config.layout?.[tela]?.ocultos || []);
export const visivel = (tela, id) => !ocultos(tela).has(id);

/** Reordena e esconde os [data-bloco] dentro de `raiz`, por contêiner. */
export function aplicarLayout(raiz, tela) {
  const ordem = ordemDe(tela), esc = ocultos(tela);
  const pos = new Map(ordem.map((id, i) => [id, i]));
  const pais = new Set([...raiz.querySelectorAll('[data-bloco]')].map((el) => el.parentElement));
  for (const pai of pais) {
    // os blocos trocam de "vaga" entre si; o que não é bloco (avisos etc.) fica onde está
    const els = [...pai.children].filter((el) => el.dataset.bloco);
    const vagas = els.map((el) => { const m = document.createComment(''); el.replaceWith(m); return m; });
    els.sort((a, b) => (pos.get(a.dataset.bloco) ?? 99) - (pos.get(b.dataset.bloco) ?? 99))
      .forEach((el, i) => { el.hidden = esc.has(el.dataset.bloco); vagas[i].replaceWith(el); });
  }
}

/** Botão discreto no fim da tela. */
export const botaoOrganizar = (tela) =>
  `<button class="btn bloco organizar" data-organizar="${tela}">⇅ Organizar ${esc(NOME_TELA[tela])}</button>`;

/** Folha com a lista arrastável (segurar e arrastar, ou pela alça) e chave de mostrar/esconder. */
export function folhaOrganizar(tela, aoSalvar) {
  const nomes = Object.fromEntries(BLOCOS[tela]);
  let ordem = ordemDe(tela);
  const esc2 = ocultos(tela);
  const p = abrirFolha(`Organizar ${NOME_TELA[tela]}`, `
    <p class="mudo" style="margin-top:-6px">Segure e arraste para mudar a ordem. Desligue o que não usa no dia a dia: fica escondido, não apagado.</p>
    <ul class="org-lista" id="org"></ul>
    <div class="linha" style="margin-top:12px"><button type="button" class="btn" data-restaurar>Padrão</button>
      <button type="button" class="btn prim" data-salvar>Salvar</button></div>`, { foco: false });
  const ul = p.querySelector('#org');
  const desenhar = () => {
    ul.innerHTML = ordem.map((id) => `<li data-id="${id}" class="${esc2.has(id) ? 'oculto' : ''}">
      <span class="alca" aria-hidden="true">⋮⋮</span><span class="nome">${esc(nomes[id])}</span>
      <button type="button" class="ico" data-mover="-1" aria-label="Subir ${esc(nomes[id])}">▲</button>
      <button type="button" class="ico" data-mover="1" aria-label="Descer ${esc(nomes[id])}">▼</button>
      <label class="chave"><input type="checkbox" ${esc2.has(id) ? '' : 'checked'} aria-label="Mostrar ${esc(nomes[id])}"><i></i></label></li>`).join('');
  };
  desenhar();
  p.addEventListener('change', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    if (e.target.checked) esc2.delete(li.dataset.id); else esc2.add(li.dataset.id);
    li.classList.toggle('oculto', !e.target.checked);
  });
  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mover) {
      const i = ordem.indexOf(b.closest('li').dataset.id), j = i + Number(b.dataset.mover);
      if (j < 0 || j >= ordem.length) return;
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      desenhar();
    }
    if ('restaurar' in b.dataset) { ordem = BLOCOS[tela].map(([id]) => id); esc2.clear(); desenhar(); }
    if ('salvar' in b.dataset) {
      if (BLOCOS[tela].every(([id]) => esc2.has(id))) return aviso('Deixe ao menos um item visível.');
      estado.config.layout = { ...(estado.config.layout || {}), [tela]: { ordem, ocultos: [...esc2] } };
      salvarConfig();
      p.closest('.folha').querySelector('[data-fechar]').click();
      aviso('Tela organizada');
      aoSalvar?.();
    }
  });
  ligarArraste(ul, () => { ordem = [...ul.children].map((li) => li.dataset.id); });
}

/** Arrastar itens de uma lista: imediato pela alça; segurando 250 ms em qualquer ponto da linha. */
function ligarArraste(ul, aoSoltar) {
  let li = null, timer = null, y0 = 0, x0 = 0, ativo = false, alturas = 0;
  const comecar = () => {
    ativo = true;
    li.classList.add('movendo');
    alturas = li.getBoundingClientRect().height;
    navigator.vibrate?.(12);
  };
  ul.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, label')) return;
    li = e.target.closest('li');
    if (!li) return;
    y0 = e.clientY; x0 = e.clientX; ativo = false;
    if (e.target.closest('.alca')) { e.preventDefault(); comecar(); } else timer = setTimeout(comecar, 250);
  });
  ul.addEventListener('pointermove', (e) => {
    if (!li) return;
    if (!ativo) {
      if (Math.abs(e.clientY - y0) + Math.abs(e.clientX - x0) > 8) { clearTimeout(timer); li = null; }
      return;
    }
    e.preventDefault();
    const dy = e.clientY - y0;
    li.style.transform = `translateY(${dy}px)`;
    // troca com o vizinho quando passa da metade dele
    const viz = dy > 0 ? li.nextElementSibling : li.previousElementSibling;
    if (viz && Math.abs(dy) > alturas / 2 + 2) {
      if (dy > 0) viz.after(li); else viz.before(li);
      y0 += dy > 0 ? alturas : -alturas;
      li.style.transform = `translateY(${e.clientY - y0}px)`;
    }
  });
  const fim = () => {
    clearTimeout(timer);
    if (li && ativo) { li.classList.remove('movendo'); li.style.transform = ''; aoSoltar(); }
    li = null; ativo = false;
  };
  ul.addEventListener('pointerup', fim);
  ul.addEventListener('pointercancel', fim);
  ul.addEventListener('contextmenu', (e) => e.preventDefault());
  // depois de "pegar" o item, o dedo arrasta o item e não rola a folha
  ul.addEventListener('touchmove', (e) => { if (ativo && e.cancelable) e.preventDefault(); }, { passive: false });
}

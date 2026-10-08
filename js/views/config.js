// views/config.js — configurações: perfil, metas, tema, refeições e sobre.

import { estado, salvarConfig } from '../state.js';
import { topo, esc, $, $$, seg, aviso, ICONES, abrirFolha, fecharFolha } from '../ui.js';
import { aplicarTema } from '../app.js';
import { uid } from '../utils.js';

export async function render(tela) {
  topo('<h1>Configurações</h1>');
  tela.innerHTML = `
    <div class="card">
      <a class="btn bloco" href="#perfil" style="margin-bottom:8px">Perfil (sexo, idade, altura, peso, atividade)</a>
      <a class="btn bloco" href="#metas">Metas (calorias, macros, fibra, sódio)</a>
    </div>
    <div class="card">
      <a class="btn bloco" href="#adicionar?aba=meus" style="margin-bottom:8px">Meus alimentos</a>
      <a class="btn bloco" href="#adicionar?aba=receitas" style="margin-bottom:8px">Receitas</a>
      <a class="btn bloco" href="#importar">Importar alimentos (CSV)</a>
    </div>
    <div class="card"><h2 style="margin-bottom:8px">Tema</h2>
      ${seg('tema', [['sistema', 'Sistema'], ['escuro', 'Escuro'], ['claro', 'Claro']], estado.config.tema)}</div>
    <div class="card"><div class="card-tit"><h2>Refeições</h2><button class="btn peq" data-nova>+ Nova</button></div>
      <ul class="lista" id="refs"></ul>
      <p class="mudo">Renomear, reordenar ou remover. Itens já lançados em dias anteriores são mantidos.</p></div>
    <div class="card"><h2 style="margin-bottom:6px">Sobre</h2>
      <p class="mudo">Base de alimentos: <b>Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada</b>,
      NEPA/UNICAMP, Campinas, 2011. Valores por 100 g de parte comestível. “Tr” (traço) conta como 0; valores ausentes na tabela
      ficam em branco e marcados como “dados parciais”.</p>
      <p class="mudo">Porções caseiras são aproximadas e editáveis. TMB por Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-7).
      Os dados ficam só neste aparelho.</p></div>`;
  desenharRefs(tela);

  tela.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.closest('[data-seg=tema]')) {
      estado.config.tema = b.dataset.v; await salvarConfig(); aplicarTema(b.dataset.v);
      $$('[data-seg=tema] button', tela).forEach((x) => x.setAttribute('aria-pressed', x === b));
      return;
    }
    const refs = estado.config.refeicoes;
    if ('nova' in b.dataset) return editarNome('Nova refeição', '', (nome) => { refs.push({ id: uid(), nome }); });
    const li = b.closest('[data-i]');
    if (!li) return;
    const i = Number(li.dataset.i);
    if ('cima' in b.dataset && i > 0) [refs[i - 1], refs[i]] = [refs[i], refs[i - 1]];
    else if ('baixo' in b.dataset && i < refs.length - 1) [refs[i + 1], refs[i]] = [refs[i], refs[i + 1]];
    else if ('remover' in b.dataset) {
      if (refs.length <= 1) return aviso('Mantenha ao menos uma refeição.');
      const [rem] = refs.splice(i, 1);
      aviso(`${rem.nome} removida`, { acao: async () => { refs.splice(i, 0, rem); await salvarConfig(); desenharRefs(tela); } });
    } else if ('renomear' in b.dataset) return editarNome('Renomear refeição', refs[i].nome, (nome) => { refs[i].nome = nome; });
    await salvarConfig();
    desenharRefs(tela);
  };

  function editarNome(titulo, valor, aplicar) {
    const p = abrirFolha(titulo, `<form id="fn"><label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(valor)}" maxlength="40"></label>
      <p class="erro" id="erro"></p><button class="btn prim bloco">Salvar</button></form>`);
    $('#fn', p).onsubmit = async (e) => {
      e.preventDefault();
      const nome = e.target.nome.value.trim();
      if (!nome) { $('#erro', p).textContent = 'Informe um nome.'; return; }
      aplicar(nome); await salvarConfig(); desenharRefs(tela);
      fecharFolha();
    };
  }
}

function desenharRefs(tela) {
  const refs = estado.config.refeicoes;
  $('#refs', tela).innerHTML = refs.map((r, i) => `<li data-i="${i}" class="linha" style="gap:0">
    <button data-renomear style="flex:1">${esc(r.nome)}</button>
    <button class="ico" data-cima aria-label="Subir ${esc(r.nome)}" ${i === 0 ? 'disabled' : ''}>${ICONES.cima}</button>
    <button class="ico" data-baixo aria-label="Descer ${esc(r.nome)}" ${i === refs.length - 1 ? 'disabled' : ''}>${ICONES.baixo}</button>
    <button class="ico" data-remover aria-label="Remover ${esc(r.nome)}">${ICONES.lixo}</button></li>`).join('');
}

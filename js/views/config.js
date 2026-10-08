// views/config.js — configurações: perfil, metas, tema, refeições e sobre.

import { estado, salvarConfig } from '../state.js';
import { topo, esc, $, $$, seg, aviso, ICONES, abrirFolha, fecharFolha } from '../ui.js';
import { aplicarTema } from '../app.js';
import { uid, chaveData, fmtNum } from '../utils.js';
import { exportar, importar, validarBackup, apagarTudo } from '../backup.js';
import { kvGet } from '../db.js';
import { VERSAO_APP } from '../versao.js';

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
    <div class="card" id="backup"><h2 style="margin-bottom:6px">Backup</h2>
      <p class="mudo" id="bk-info" style="margin-top:0"></p>
      <label class="linha" style="margin-bottom:8px"><input type="checkbox" id="bk-fotos" style="flex:0;width:22px;height:22px"><span>Incluir fotos (arquivo maior)</span></label>
      <div class="grade2"><button class="btn prim" data-exportar>Exportar backup</button>
        <label class="btn">Importar backup<input type="file" accept=".json,application/json" id="bk-arq" hidden></label></div>
      <p class="mudo">Guarde o arquivo fora do celular (Drive, e-mail para você). Importar substitui os dados atuais.</p>
    </div>
    <div class="card"><h2 style="margin-bottom:6px">Armazenamento</h2><p class="mudo" id="arm" style="margin-top:0">…</p>
      <button class="btn perigo bloco" data-apagar-tudo>Apagar todos os dados</button></div>
    <div class="card"><h2 style="margin-bottom:6px">Sobre</h2>
      <p class="mudo">Base de alimentos: <b>Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada</b>,
      NEPA/UNICAMP, Campinas, 2011. Valores por 100 g de parte comestível. “Tr” (traço) conta como 0; valores ausentes na tabela
      ficam em branco e marcados como “dados parciais”.</p>
      <p class="mudo">Porções caseiras são aproximadas e editáveis. TMB por Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-7).
      Os dados ficam só neste aparelho.</p></div>`;
  desenharRefs(tela);
  infoBackup(tela);

  $('#bk-arq', tela).onchange = async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    let obj;
    try { obj = JSON.parse(await arq.text()); } catch { return aviso('Arquivo não é um JSON válido.'); }
    const v = validarBackup(obj);
    if (!v.ok) return aviso(v.erro, { ms: 8000 });
    const c = v.contagem;
    const resumo = `Backup de ${obj.exportadoEm ? new Date(obj.exportadoEm).toLocaleString('pt-BR') : '?'}:\n` +
      `${c.diary || 0} dia(s) de diário, ${c.customFoods || 0} alimento(s), ${c.recipes || 0} receita(s), ${c.weights || 0} dia(s) de peso, ` +
      `${c.skinfolds || 0} avaliação(ões) de dobras${obj.comFotos ? `, ${c.photos || 0} refeição(ões) com foto` : ' (sem fotos: as fotos atuais serão mantidas)'}.\n\n` +
      'Isso SUBSTITUI os dados atuais deste aparelho. Continuar?';
    if (!confirm(resumo)) return;
    try {
      await importar(obj);
      sessionStorage.setItem('importado', '1');
      location.hash = '#diario';
      location.reload();
    } catch (err) { console.error(err); aviso('Falha ao importar: ' + err.message, { ms: 8000 }); }
  };

  tela.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('exportar' in b.dataset) {
      b.disabled = true;
      try {
        const blob = await exportar($('#bk-fotos', tela).checked);
        const nome = `backup-calorias-${chaveData()}.json`;
        const arq = new File([blob], nome, { type: 'application/json' });
        if (navigator.canShare?.({ files: [arq] }) && confirm('Compartilhar o backup (Drive, e-mail…)? Cancelar = só baixar.')) {
          await navigator.share({ files: [arq], title: nome }).catch(() => {});
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = nome; a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }
        aviso(`Backup gerado (${Math.round(blob.size / 1024)} KB)`);
        infoBackup(tela);
      } catch (err) { console.error(err); aviso('Falha ao exportar: ' + err.message); }
      b.disabled = false;
      return;
    }
    if ('apagarTudo' in b.dataset) {
      if (!confirm('Apagar TODOS os dados deste aparelho (diário, metas, alimentos, registros, fotos)?')) return;
      if (!confirm('Tem certeza? Isso não pode ser desfeito. Recomendo exportar um backup antes.')) return;
      await apagarTudo();
      location.hash = '';
      location.reload();
      return;
    }
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

async function infoBackup(tela) {
  const meta = (await kvGet('meta', {})) || {};
  $('#bk-info', tela).textContent = meta.ultimoBackup
    ? `Último backup: ${new Date(meta.ultimoBackup).toLocaleDateString('pt-BR')}.` : 'Nenhum backup feito ainda.';
  try {
    const persist = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    $('#arm', tela).textContent = `Usando ${est ? fmtNum(Math.round((est.usage / 1048576) * 10) / 10) + ' MB' : '?'} · ` +
      `${persist ? 'armazenamento persistente (o navegador não apaga sozinho)' : 'armazenamento não persistente: faça backups'} · versão ${VERSAO_APP}.`;
  } catch { $('#arm', tela).textContent = `Versão ${VERSAO_APP}.`; }
}

function desenharRefs(tela) {
  const refs = estado.config.refeicoes;
  $('#refs', tela).innerHTML = refs.map((r, i) => `<li data-i="${i}" class="linha" style="gap:0">
    <button data-renomear style="flex:1">${esc(r.nome)}</button>
    <button class="ico" data-cima aria-label="Subir ${esc(r.nome)}" ${i === 0 ? 'disabled' : ''}>${ICONES.cima}</button>
    <button class="ico" data-baixo aria-label="Descer ${esc(r.nome)}" ${i === refs.length - 1 ? 'disabled' : ''}>${ICONES.baixo}</button>
    <button class="ico" data-remover aria-label="Remover ${esc(r.nome)}">${ICONES.lixo}</button></li>`).join('');
}

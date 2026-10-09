// views/config.js — configurações: perfil, metas, tema, refeições e sobre.

import { estado, salvarConfig } from '../state.js';
import { topo, esc, $, $$, seg, aviso, ICONES, abrirFolha, fecharFolha, entregarArquivo } from '../ui.js';
import { csvItens, csvTotais } from '../exportar.js';
import { db } from '../db.js';
import { metaDoDia } from '../goals.js';
import { ehTreino } from '../diary.js';
import { aplicarTema } from '../app.js';
import { uid, chaveData, fmtNum, fmtKcal } from '../utils.js';
import { exportar, apagarTudo } from '../backup.js';
import { cartaoDrive, ligarCartaoDrive, confirmarEImportar } from './drive-ui.js';
import { lerChave, salvarChave, chaveValida } from '../ia.js';
import { kvGet } from '../db.js';
import { VERSAO_APP } from '../versao.js';
import { CORES_PADRAO, NOMES_CORES, PALETAS, aplicarCores } from '../cores.js';
import { NOME_TELA } from '../layout.js';

const cores = () => estado.config.cores || {};
async function salvarCores(c) {
  estado.config.cores = c;
  aplicarCores(c);
  aplicarTema(estado.config.tema);       // barra de status acompanha o novo fundo
  await salvarConfig();
}

export async function render(tela) {
  topo('<h1 class="esq">Ajustes</h1>');
  const p = estado.perfil;
  const item = (href, ico, tit, sub) => `<a href="${href}"><span class="ref-ico" aria-hidden="true">${ico}</span><span>${tit}<small>${sub}</small></span></a>`;
  const I = {
    perfil: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/></svg>',
    metas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
    meus: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z M9 10h6 M9 14h6 M9 18h3"/></svg>',
    rec: '<svg viewBox="0 0 24 24"><path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z M8 8c0-2 2-2 2-4 M13 8c0-2 2-2 2-4"/></svg>',
    csv: '<svg viewBox="0 0 24 24"><path d="M12 4v11 M7.5 10.5L12 15l4.5-4.5 M5 19h14"/></svg>',
  };
  tela.innerHTML = `
    <div class="card config-lista" style="padding:4px 16px">
      ${item('#perfil', I.perfil, 'Perfil', `${p.sexo === 'F' ? 'Mulher' : 'Homem'} · ${fmtNum(p.peso)} kg · ${fmtNum(p.altura)} cm`)}
      ${item('#metas', I.metas, 'Metas', `${fmtKcal(estado.metas.base.kcal)} kcal · ${estado.metas.modo === 'semana' ? 'por dia da semana' : 'todos os dias iguais'}`)}
    </div>
    <p class="secao">Alimentos</p>
    <div class="card config-lista" style="padding:4px 16px">
      ${item('#adicionar?aba=meus', I.meus, 'Meus alimentos', 'Rótulos, suplementos e produtos lidos')}
      ${item('#adicionar?aba=receitas', I.rec, 'Receitas', 'Preparos por porção ou por grama')}
      ${item('#importar', I.csv, 'Importar CSV', 'Vários alimentos de uma vez')}
    </div>
    <p class="secao">Aparência</p>
    <div class="card">${seg('tema', [['sistema', 'Sistema'], ['escuro', 'Escuro'], ['claro', 'Claro']], estado.config.tema)}
      <h2 style="margin:4px 0 8px">Cor principal</h2>
      <div class="paletas">${PALETAS.map(([n, c]) => `<button type="button" data-paleta="${c}" aria-label="${n}" title="${n}"
        aria-pressed="${(cores().acento || CORES_PADRAO.acento).toLowerCase() === c}" style="--c:${c}"></button>`).join('')}</div>
      <h2 style="margin:14px 0 4px">Cores</h2>
      <p class="mudo" style="margin:0 0 6px">Cada macronutriente aparece sempre na mesma cor (diário, detalhes, gráficos). No tema escuro o app clareia o tom automaticamente.</p>
      <div class="cores-lista">${Object.entries(NOMES_CORES).map(([k, n]) => `<label class="cor-linha"><span><i style="background:var(--${k === 'acento' ? 'acento' : k})"></i>${n}</span>
        <input type="color" data-cor="${k}" value="${cores()[k] || CORES_PADRAO[k]}" aria-label="Cor de ${n}"></label>`).join('')}</div>
      <button class="btn peq suave" data-cores-padrao style="margin-top:10px">Restaurar cores padrão</button></div>
    <p class="secao">Organizar telas</p>
    <div class="card config-lista" style="padding:4px 16px">
      ${Object.entries(NOME_TELA).map(([id, n]) => `<a role="button" tabindex="0" data-organizar="${id}"><span class="ref-ico" aria-hidden="true">⇅</span><span>${n}<small>Ordem dos blocos e o que aparece</small></span></a>`).join('')}
    </div>
    <p class="secao">Diário</p>
    <div class="card"><div class="card-tit"><h2>Refeições</h2><button class="btn peq suave" data-nova>+ Nova</button></div>
      <ul class="lista" id="refs"></ul>
      <p class="mudo">Renomear, reordenar ou remover. Itens já lançados em dias anteriores são mantidos.</p></div>
    <p class="secao">Dados</p>
    ${cartaoDrive()}
    <div class="card" id="backup"><h2 style="margin-bottom:6px">Backup em arquivo</h2>
      <p class="mudo" id="bk-info" style="margin-top:0"></p>
      <label class="linha" style="margin-bottom:8px"><input type="checkbox" id="bk-fotos" style="flex:0;width:22px;height:22px"><span>Incluir fotos (arquivo maior)</span></label>
      <div class="grade2"><button class="btn prim" data-exportar>Exportar backup</button>
        <label class="btn">Importar backup<input type="file" accept=".json,application/json" id="bk-arq" hidden></label></div>
      <p class="mudo">Guarde o arquivo fora do celular (Drive, e-mail para você). Importar substitui os dados atuais.</p>
    </div>
    <div class="card" id="ia"><h2 style="margin-bottom:6px">IA (Gemini): foto, texto e rótulo</h2>
      <p class="mudo" style="margin-top:0">Usa a cota gratuita da API do Gemini com a sua chave. Crie em
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> e <b>não ative faturamento</b>
        no projeto: assim, passou do limite, ela só recusa — nunca cobra. A chave fica só neste aparelho.</p>
      <form id="f-ia" class="linha"><input type="password" name="chave" placeholder="${lerChave() ? 'Chave salva ✓ (cole outra para trocar)' : 'Cole a chave (AIza…)'}" autocomplete="off" style="flex:1">
        <button class="btn prim">Salvar</button></form>
      ${lerChave() ? '<button class="btn peq suave" data-ia-remover style="margin-top:8px">Remover chave</button>' : ''}</div>
    <div class="card"><h2 style="margin-bottom:6px">Exportar diário (planilha)</h2>
      <p class="mudo" style="margin-top:0">Arquivo CSV que abre no Excel ou no Planilhas Google (separador “;”, vírgula decimal).</p>
      <div class="grade2"><button class="btn" data-csv="itens">Item por item</button><button class="btn" data-csv="totais">Totais por dia</button></div></div>
    <div class="card"><h2 style="margin-bottom:6px">Armazenamento</h2><p class="mudo" id="arm" style="margin-top:0">…</p>
      <button class="btn perigo bloco" data-apagar-tudo>Apagar todos os dados</button></div>
    <div class="card"><h2 style="margin-bottom:6px">Sobre</h2>
      <p class="mudo">Base de alimentos: <b>Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada</b>,
      NEPA/UNICAMP, Campinas, 2011. Valores por 100 g de parte comestível. “Tr” (traço) conta como 0; valores ausentes na tabela
      ficam em branco e marcados como “dados parciais”.</p>
      <p class="mudo">Produtos industrializados: <b>Open Food Facts</b> (openfoodfacts.org), base colaborativa sob licença
      Open Database License (ODbL). Confira sempre com o rótulo.</p>
      <p class="mudo">Porções caseiras são aproximadas e editáveis. TMB por Mifflin-St Jeor (Am J Clin Nutr 1990;51:241-7).
      Os dados ficam só neste aparelho (e no seu Google Drive, se conectar). Na estimativa por foto, a imagem vai ao Gemini (Google);
      na cota gratuita o Google pode usá-la para melhorar seus produtos.</p></div>`;
  desenharRefs(tela);
  infoBackup(tela);

  $('#bk-arq', tela).onchange = async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    let obj;
    try { obj = JSON.parse(await arq.text()); } catch { return aviso('Arquivo não é um JSON válido.'); }
    await confirmarEImportar(obj);
  };
  ligarCartaoDrive(tela, () => infoBackup(tela));
  $('#f-ia', tela).onsubmit = (e) => {
    e.preventDefault();
    const c = e.target.chave.value.trim();
    if (!chaveValida(c)) return aviso('Isso não parece uma chave do Gemini: copie de novo em aistudio.google.com/apikey.');
    salvarChave(c); aviso('Chave do Gemini salva'); render(tela);
  };

  // cores: prévia ao arrastar o seletor, salva ao confirmar
  tela.oninput = (e) => {
    if (e.target.dataset.cor) aplicarCores({ ...cores(), [e.target.dataset.cor]: e.target.value });
  };
  tela.onchange = (e) => {
    if (e.target.dataset.cor) salvarCores({ ...cores(), [e.target.dataset.cor]: e.target.value });
  };

  tela.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('#drive')) return;
    if (b.dataset.paleta) {
      await salvarCores({ ...cores(), acento: b.dataset.paleta });
      $$('[data-paleta]', tela).forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('[data-cor=acento]', tela).value = b.dataset.paleta;
      return;
    }
    if ('coresPadrao' in b.dataset) { await salvarCores({}); aviso('Cores padrão restauradas'); return render(tela); }
    if (b.dataset.csv) {
      const diarios = (await db.getAll('diary')).map(([, d]) => d).filter((d) => Object.values(d.refeicoes).some((l) => l.length));
      if (!diarios.length) return aviso('Ainda não há dias registrados.');
      const nomes = Object.fromEntries(estado.config.refeicoes.map((r) => [r.id, r.nome]));
      const txt = b.dataset.csv === 'itens' ? csvItens(diarios, nomes)
        : csvTotais(diarios, (d) => metaDoDia(estado.metas, d.data, estado.perfil.peso, { treino: ehTreino(d) }));
      await entregarArquivo(new Blob([txt], { type: 'text/csv' }), `diario-${b.dataset.csv}-${chaveData()}.csv`, 'Diário (CSV)');
      return;
    }
    if ('iaRemover' in b.dataset) { salvarChave(''); aviso('Chave removida'); return render(tela); }
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

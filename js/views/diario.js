// views/diario.js — tela inicial: navegação por dia, anel de calorias, macros e refeições.

import { estado, lerDia, gravarDia, pesoAtual, datasComRegistro } from '../state.js';
import { ic } from '../icones.js';
import { db } from '../db.js';
import { totalAgua, AGUA_PADRAO } from './reg-agua.js';
import { aplicarLayout, botaoOrganizar } from '../layout.js';
import { metaDoDia } from '../goals.js';
import { totalDia, totalRefeicao, refeicoesDoDia, removerItem, alterarQuantidade, substituirItem,
  criarItemRapido, adicionarItem, copiarPara, criarItem, lancarSalva, ETIQUETAS, ehTreino, alvoProteinaRefeicao, linhaDoTempo, confirmarPlanejado } from '../diary.js';
import { avisoKcalMacros, registrarRecente } from '../custom.js';
import { diasSemBackup } from '../backup.js';
import { contagemDoDia } from '../photos.js';
import { topo, esc, ICONES, iconeRef, $, aviso, abrirFolha, fecharFolha, vibrar, esqueleto, talvezDica } from '../ui.js';
import { situacaoDia } from '../progress.js';
import { microsMaisDistantes } from '../micros.js';
import { qualidadeDia } from '../nutricao.js';
import { estadoVazio } from '../vazio.js';
import { chaveData, somarDias, fmtData, fmtKcal, fmtG, fmtNum, lerNumero, DIAS_SEMANA, DIAS_CURTOS, diaSemana, idadeEm } from '../utils.js';
import { pendenteToque } from '../drive.js';
import { folhaOQueComer, diariosRecentes, contextoSuspeito, primeiraSugestao, lancarCombo, refeicaoPeloHorario } from './sugestao.js';
import { refeicaoDeSempre, avaliarSuspeito } from '../inteligencia.js';

// Carregados só quando usados (abrir o Diário fica mais leve: orçamento de JS inicial do Pacote 16)
const sob = (mod, nome) => async (...a) => (await import(mod))[nome](...a);
const detalheDia = sob('./detalhe-dia.js', 'detalheDia'), painelRefeicao = sob('./detalhe-dia.js', 'painelRefeicao');
const abrirScanner = sob('./scanner.js', 'abrirScanner'), folhaQuantidade = sob('./quantidade.js', 'folhaQuantidade');
const folhaFotos = sob('./fotos.js', 'folhaFotos'), enviarAgora = sob('./drive-ui.js', 'enviarAgora');
const folhaFotoIA = sob('./foto-ia.js', 'folhaFotoIA'), folhaCardapioIA = sob('./foto-ia.js', 'folhaCardapioIA');
const folhaSalvarRefeicao = sob('./salvas.js', 'folhaSalvarRefeicao'), folhaSalvas = sob('./salvas.js', 'folhaSalvas');
const talvezTour = () => { if (!estado.config.tourVisto) import('./tour.js').then((m) => m.talvezTour()); };
const diasDesdeUltima = () => import('./reg-dobras.js').then((m) => m.diasDesdeUltima());
const idadePerfil = (p) => (p.nascimento ? idadeEm(p.nascimento) : p.idade);

let tela, dia, meta, fotosCont = {}, ignorarClique = false, alvoProtRef = 0, chips = {}, agoraRestante = null, anelAntes = null;
let idsAntes = null, novos = new Set();

const fmtMicro = (v) => fmtNum(v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

export async function render(t) {
  tela = t;
  // ações por endereço (folha do "+", atalhos e rotinas do Android): #diario?acao=rapida | acao=agua[&ml=500]
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const acao = q.get('acao');
  if (acao) { history.replaceState(null, '', '#diario'); estado.dataAtual = chaveData(); }
  await desenhar();
  if (acao === 'rapida') folhaRapida(null, refeicaoPeloHorario());
  else if (acao === 'agua') await adicionarAgua(lerNumero(q.get('ml') || '') || null);
  else talvezTour();
}

/** Soma água no dia aberto (copo padrão ou `ml`), com desfazer. */
async function adicionarAgua(ml = null) {
  const ag = { ...AGUA_PADRAO, ...(estado.config.agua || {}) };
  const v = ml > 0 && ml <= 5000 ? ml : ag.copoMl;
  const r = (await db.get('water', estado.dataAtual)) || { itens: [] };
  r.itens.push({ ts: Date.now(), ml: v });
  await db.put('water', estado.dataAtual, r);
  vibrar(10);
  await desenhar();
  aviso(`+${fmtNum(v)} ml de água`, { acao: async () => { r.itens.pop(); await db.put('water', estado.dataAtual, r); desenhar(); } });
}

function rotuloData(chave) {
  const hoje = chaveData();
  if (chave === hoje) return 'Hoje';
  if (chave === somarDias(hoje, -1)) return 'Ontem';
  if (chave === somarDias(hoje, 1)) return 'Amanhã';
  return `${DIAS_SEMANA[diaSemana(chave)].slice(0, 3)}, ${fmtData(chave)}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function desenharTopo() {
  const c = estado.dataAtual, hoje = chaveData();
  const [y, m, d] = c.split('-').map(Number);
  topo(`<button class="ico" data-dia="-7" aria-label="Semana anterior">${ICONES.voltar}</button>
    <button class="data-btn" aria-label="Escolher data no calendário">${esc(rotuloData(c))}<small>${d} de ${MESES[m - 1]}${y !== new Date().getFullYear() ? ' de ' + y : ''}</small>
      <input type="date" value="${c}" aria-label="Calendário" tabindex="-1"></button>
    ${c !== hoje ? '<button class="btn peq suave" data-hoje>Hoje</button>' : ''}
    <button class="ico" data-dia="7" aria-label="Próxima semana">${ICONES.avancar}</button>`);
  const tp = $('#topo');
  tp.onclick = (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.dia) mudarDia(somarDias(estado.dataAtual, Number(b.dataset.dia)));
    else if (b && 'hoje' in b.dataset) mudarDia(chaveData());
    else if (b?.classList.contains('data-btn')) { try { b.querySelector('input').showPicker(); } catch {} }
  };
  tp.querySelector('input[type=date]').onchange = (e) => e.target.value && mudarDia(e.target.value);
}

const SIT_ROTULO = { meta: 'na meta', acima: 'acima da meta', abaixo: 'abaixo da meta' };

/** Situação de cada dia passado da semana (cor do ponto, como o calendário do Progresso); hoje fica neutro. */
async function situacoesSemana(ini, ativos, peso) {
  const hoje = chaveData(), out = {};
  await Promise.all(Array.from({ length: 7 }, async (_, i) => {
    const c = somarDias(ini, i);
    if (!ativos.has(c) || c >= hoje) return;
    const d = c === estado.dataAtual ? dia : await lerDia(c);
    out[c] = situacaoDia({ tot: totalDia(d), meta: metaDoDia(estado.metas, c, peso, { treino: ehTreino(d) }) });
  }));
  return out;
}

/** Faixa da semana (seg–dom) do dia aberto; o ponto indica registro e, nos dias passados, a aderência. */
function faixaSemana(ativos, sits) {
  const ini = somarDias(estado.dataAtual, -diaSemana(estado.dataAtual)), hoje = chaveData();
  return `<nav class="semana" data-bloco="semana" aria-label="Dias da semana">${Array.from({ length: 7 }, (_, i) => {
    const c = somarDias(ini, i), s = sits[c];
    return `<button data-ir="${c}" aria-pressed="${c === estado.dataAtual}" class="${ativos.has(c) ? 'tem' : ''} ${s || ''} ${c === hoje ? 'hoje' : ''}"
      aria-label="${DIAS_SEMANA[i]}, ${fmtData(c)}${s ? ', ' + SIT_ROTULO[s] : ativos.has(c) ? ', com registro' : ''}">
      <span class="d">${DIAS_CURTOS[i]}</span><span class="n">${Number(c.slice(8))}</span><span class="ponto"></span></button>`;
  }).join('')}</nav>`;
}

// ---------- Cartão-herói (páginas: calorias · macros · fibra, sódio e micros) ----------

const PAGINAS = ['Calorias', 'Macronutrientes', 'Fibra, sódio e micronutrientes'];
const lerPagina = () => { try { return Math.min(2, Math.max(0, Number(localStorage.getItem('heroiPag')) || 0)); } catch { return 0; } };

function barra(cls, nome, v, m, un = 'g', f = fmtG) {
  const pct = m > 0 ? Math.min((v / m) * 100, 100) : 0;
  return `<div class="barra ${cls} ${v > m * 1.0001 ? 'passou' : ''}"><div class="rot"><span>${nome}</span>
    <span class="num"><b>${f(v)}</b> / ${f(m)} ${un}</span></div><div class="trilho"><div class="enche" style="width:${pct}%"></div></div></div>`;
}

/** Anel de um macro com o consumido no centro e "faltam X g" embaixo. */
function anelMacro(cls, nome, v, m, tam) {
  const r = tam / 2 - 6, C = 2 * Math.PI * r, frac = m > 0 ? Math.min(v / m, 1) : 0, falta = m - v;
  return `<div class="mac ${cls}${falta < 0 ? ' passou' : ''}">
    <div class="mac-anel" style="width:${tam}px;height:${tam}px"><svg viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
      <circle class="fundo" cx="${tam / 2}" cy="${tam / 2}" r="${r}"/>
      <circle class="valor" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}" style="--c:${C}"/></svg>
      <div class="centro"><b class="num">${fmtG(v)}</b><span class="num">/ ${fmtG(m)} g</span></div></div>
    <span class="mac-nome">${nome}</span>
    <span class="mac-falta num">${falta >= 0 ? `faltam <b>${fmtG(falta)} g</b>` : `<b>+${fmtG(-falta)} g</b> acima`}</span></div>`;
}

function cartaoHeroi({ tot, restante, frac, C }) {
  const p = estado.perfil || {};
  const micros = microsMaisDistantes(Object.values(dia.refeicoes).flat(), p.sexo, idadePerfil(p) || 30, 3);
  const pag1 = `<div class="resumo">
      <div class="anel ${restante < 0 ? 'excesso' : ''}">
        <svg viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento-forte)"/></linearGradient></defs>
          <circle class="fundo" cx="75" cy="75" r="64"/>
          <circle class="valor" cx="75" cy="75" r="64" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (anelAntes?.frac ?? frac))}"/></svg>
        <div class="centro"><span class="grande num" data-anel-num>${fmtKcal(Math.abs(anelAntes?.restante ?? restante))}</span>
          <span class="mudo">${restante < 0 ? 'kcal acima' : 'restantes'}</span></div>
      </div>
      <div>${barra('prot', 'Proteína', tot.prot, meta.prot)}${barra('carb', 'Carboidrato', tot.carb, meta.carb)}${barra('gord', 'Gordura', tot.gord, meta.gord)}</div>
    </div>
    <div class="equacao num"><div><b>${fmtKcal(meta.kcal)} <small>kcal</small></b><span>Meta</span></div>
      <div><b>${fmtKcal(tot.kcal)} <small>kcal</small></b><span>Consumido</span></div>
      <div><b style="${restante < 0 ? 'color:var(--alerta)' : ''}">${restante < 0 ? '+' + fmtKcal(-restante) : fmtKcal(restante)} <small>kcal</small></b><span>${restante < 0 ? 'Acima' : 'Restante'}</span></div></div>`;
  const pag2 = `<div class="macros-grandes">${anelMacro('prot', 'Proteína', tot.prot, meta.prot, 112)}
      <div class="macros-dir">${anelMacro('carb', 'Carboidrato', tot.carb, meta.carb, 76)}${anelMacro('gord', 'Gordura', tot.gord, meta.gord, 76)}</div></div>`;
  const q = qualidadeDia(tot, meta, Object.values(dia.refeicoes).flat().filter((i) => !i.planejado), { sexo: p.sexo, idade: idadePerfil(p) || 30 });
  const pag3 = `${q ? `<div class="q-linha"><span>Qualidade do dia <span class="mudo">(heurística)</span></span><b class="q-${q.faixa.replace('ó', 'o').replace('é', 'e')}">${q.faixa} · ${q.nota}</b></div>` : ''}${barra('fibra', 'Fibra', tot.fibra, meta.fibra)}${barra('sodio', 'Sódio (limite)', tot.sodio_mg, meta.sodio, 'mg', fmtKcal)}
    ${micros.length ? `<p class="secao" style="margin:12px 0 6px">Mais longe da referência hoje</p>
      ${micros.map((m) => barra('micro', m.nome, m.val, m.ref, m.un, (x) => fmtMicro(x))).join('')}
      ${micros[0].cobertura < 0.8 ? '<p class="mudo" style="margin:4px 0 0;font-size:var(--fs-12)">Parcial: há itens sem micronutrientes (adição rápida, rótulo).</p>' : ''}`
      : '<p class="mudo" style="margin:12px 0 0">Micronutrientes aparecem quando houver alimentos da TACO/TBCA no dia.</p>'}`;
  const pg = lerPagina();
  return `<section class="card heroi" data-bloco="resumo" aria-roledescription="carrossel" aria-label="Resumo do dia">
    <div class="heroi-pags">${[pag1, pag2, pag3].map((h, i) => `<div class="heroi-pag" data-detalhe data-pag="${i}" role="button" tabindex="0"
      aria-label="${PAGINAS[i]}. Toque para ver os detalhes do dia.">${h}</div>`).join('')}</div>
    <div class="heroi-pontos" role="tablist">${PAGINAS.map((n, i) => `<button type="button" role="tab" data-ir-pag="${i}" aria-label="${n}" aria-selected="${i === pg}"></button>`).join('')}</div>
  </section>`;
}

/** Posiciona o carrossel na última página vista e lembra a página ao deslizar. */
function ligarHeroi() {
  const box = tela.querySelector('.heroi-pags');
  if (!box) return;
  // a altura acompanha a página visível (as páginas têm alturas diferentes)
  const ajustarAltura = (i) => { const p = box.children[i]; if (p) box.style.height = p.offsetHeight + 'px'; };
  box.scrollLeft = lerPagina() * box.clientWidth;
  ajustarAltura(lerPagina());
  let t = null;
  box.onscroll = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const i = Math.round(box.scrollLeft / box.clientWidth);
      ajustarAltura(i);
      tela.querySelectorAll('[data-ir-pag]').forEach((b) => b.setAttribute('aria-selected', Number(b.dataset.irPag) === i));
      try { localStorage.setItem('heroiPag', String(i)); } catch {}
    }, 90);
  };
}

async function mudarDia(chave) {
  estado.dataAtual = chave;
  await desenhar();
}

async function desenhar() {
  desenharTopo();
  dia = await lerDia(estado.dataAtual);
  const peso = await pesoAtual();
  meta = metaDoDia(estado.metas, estado.dataAtual, peso, { treino: ehTreino(dia) });
  alvoProtRef = alvoProteinaRefeicao(peso);
  fotosCont = await contagemDoDia(estado.dataAtual).catch(() => ({}));
  const tot = totalDia(dia);
  const restante = meta.kcal - tot.kcal;
  const frac = meta.kcal > 0 ? Math.min(tot.kcal / meta.kcal, 1) : 0;
  const C = 2 * Math.PI * 64;
  const refs = refeicoesDoDia(dia, estado.config.refeicoes);
  const diaSemItens = !Object.values(dia.refeicoes).some((l) => l.length);
  // o anel anima a partir do valor anterior só no mesmo dia (trocar de dia redesenha direto)
  if (anelAntes && anelAntes.data !== estado.dataAtual) anelAntes = null;
  const ehHoje = estado.dataAtual === chaveData();
  const [dias, bk, ativos, agua] = await Promise.all([
    estado.config.dobras?.lembrete !== false ? diasDesdeUltima().catch(() => null) : null,
    diasSemBackup().catch(() => ({ dias: 0 })),
    datasComRegistro(),
    db.get('water', estado.dataAtual),
  ]);
  const ag = { ...AGUA_PADRAO, ...(estado.config.agua || {}) }, mlAgua = totalAgua(agua);
  // chips de 1 toque nas refeições vazias: "Repetir de ontem" e "Seu … de sempre"
  chips = {};
  const vazias = refs.filter((r) => !(dia.refeicoes[r.id] || []).length);
  if (vazias.length) {
    const [ontem, recentes] = await Promise.all([lerDia(somarDias(estado.dataAtual, -1)), diariosRecentes(30).catch(() => [])]);
    const anteriores = recentes.filter((d) => d.data < estado.dataAtual);
    for (const r of vazias) {
      const deOntem = ontem.refeicoes[r.id] || [];
      const sempre = refeicaoDeSempre(anteriores, r.id);
      const igual = sempre.length && sempre.length === deOntem.length && sempre.every((it) => deOntem.some((o) => o.foodId === it.foodId));
      chips[r.id] = { ontem: deOntem.length, sempre: igual ? [] : sempre };
    }
  }
  const restMacros = { kcal: restante, prot: meta.prot - tot.prot, carb: meta.carb - tot.carb, gord: meta.gord - tot.gord };
  agoraRestante = restMacros;
  const sits = await situacoesSemana(somarDias(estado.dataAtual, -diaSemana(estado.dataAtual)), ativos, peso);
  // itens novos desde o último desenho do mesmo dia entram deslizando
  const idsAgora = new Set(Object.values(dia.refeicoes).flat().map((i) => i.id));
  novos = idsAntes?.data === estado.dataAtual ? new Set([...idsAgora].filter((id) => !idsAntes.ids.has(id))) : new Set();
  idsAntes = { data: estado.dataAtual, ids: idsAgora };
  tela.innerHTML = `
    ${faixaSemana(ativos, sits)}
    ${ehHoje && pendenteToque() ? '<button class="nota" data-drive>' + ic('cloud-upload', 'p') + ' Backup diário no Google Drive pendente — tocar para enviar.</button>' : ''}
    ${bk.dias > 30 && ehHoje ? `<a class="nota" href="#config">${ic('save', 'p')} ${bk.nunca ? `Você usa o app há ${bk.dias} dias sem backup` : `Último backup há ${bk.dias} dias`} — tocar para exportar.</a>` : ''}
    ${dias > 30 && ehHoje ? `<a class="nota" href="#registros?aba=dobras">${ic('ruler', 'p')} Última avaliação de dobras há ${dias} dias — tocar para registrar.</a>` : ''}
    ${cartaoHeroi({ tot, restante, frac, C })}
    ${ehHoje && restante >= 50 ? `<section class="card agora-card" data-bloco="agora" aria-live="polite">${esqueleto(['', ''])}</section>` : ''}
    ${faixaEtiquetas()}
    ${ehHoje ? '<section class="card checkin-card" data-bloco="checkin" hidden></section>' : ''}
    <section class="card agua-card" data-bloco="agua" aria-label="Água">
      <div class="gota">${ICONES.gota}</div>
      <div class="info"><b class="num">${fmtNum(mlAgua)} <span class="mudo">/ ${fmtNum(ag.metaMl)} ml</span></b>
        <div class="trilho"><div class="enche" style="width:${Math.min(100, (mlAgua / ag.metaMl) * 100)}%"></div></div></div>
      <button class="btn peq suave" data-agua aria-label="Adicionar 1 copo de ${ag.copoMl} ml">+ ${fmtNum(ag.copoMl)} ml</button>
    </section>
    ${ehHoje && estado.config.jejum?.ativo ? '<section class="card jejum-card" data-bloco="jejum" aria-live="polite"></section>' : ''}
    ${diaSemItens ? estadoVazio('prato', ehHoje ? 'Nada lançado hoje ainda' : 'Nada lançado neste dia', 'Toque no + de uma refeição (ou segure o + central) para lançar; deslize para os lados para trocar o dia.') : ''}
    <div data-bloco="refeicoes">
      ${diaSemItens ? '' : `<div class="seg seg-modo" role="group" aria-label="Modo de visualização">
        <button type="button" data-modo="ref" aria-pressed="${modoVista() === 'ref'}">${ic('utensils', 'p')} Por refeição</button>
        <button type="button" data-modo="tempo" aria-pressed="${modoVista() === 'tempo'}">${ic('clock', 'p')} Linha do tempo</button></div>`}
      ${modoVista() === 'tempo' && !diaSemItens ? linhaDoTempoHtml(refs) : blocoRefeicoes(refs)}</div>
    ${diaSemItens ? `<button class="btn bloco suave" data-bloco="copiar" data-copiar-dia>${ICONES.copiar} Copiar o dia anterior</button>` : ""}
    <a class="btn bloco suave" data-bloco="plano" href="#plano">${ic('calendar-days')} Planejar a semana</a>
    ${botaoOrganizar('diario')}`;
  aplicarLayout(tela, 'diario');
  ligarHeroi();
  animarAnel(anelAntes, { restante, frac, C });
  anelAntes = { restante, frac, data: estado.dataAtual };
  tela.onclick = clique;
  tela.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-detalhe], [data-painel-ref]')) e.target.click(); };
  ligarDeslizar();
  if (ehHoje && restante >= 50) desenharAgora(restMacros);
  if (ehHoje && estado.config.jejum?.ativo) desenharJejum();
  if (ehHoje) import('./checkin-ui.js').then((m) => m.cartaoCheckin(tela.querySelector('.checkin-card'), desenhar)).catch(() => {});
  if (estado.config.tourVisto) setTimeout(() => (location.hash.slice(1) || 'diario').startsWith('diario') && talvezDica([
    { chave: 'heroi', el: tela.querySelector('.heroi-pontos'), texto: 'Deslize o resumo para ver macros, fibra, sódio e micronutrientes.' },
    { chave: 'mais', el: document.querySelector('.nav a.fab'), texto: 'Segure o + (ou arraste para cima) para código, foto, voz, água e peso.' },
    { chave: 'apagar', el: tela.querySelector('.item'), texto: 'Deslize um item para a esquerda para apagar.' },
    { chave: 'painel', el: tela.querySelector('[data-painel-ref]'), texto: 'Toque no nome da refeição para ver o painel dela.' },
    { chave: 'trocar-dia', el: tela.querySelector('.semana'), texto: 'Deslize para os lados (fora dos itens) para trocar o dia.' },
  ]), 700);
}

// ---------- Jejum intermitente (opcional, Ajustes › Atalhos, rotinas e jejum) ----------

let relogioJejum = null;
async function desenharJejum() {
  const el = tela.querySelector('.jejum-card');
  if (!el) return;
  const { jejumAtual, historicoJejum, fmtDuracao } = await import('../jejum.js');
  const diarios = await diariosRecentes(10);
  const meta = estado.config.jejum?.meta || 16;
  const hist = historicoJejum(diarios, 7);
  const pintar = () => {
    if (!el.isConnected) { clearInterval(relogioJejum); return; }
    const j = jejumAtual(diarios);
    if (!j) { el.innerHTML = `<h2>${ic('hourglass')} Jejum</h2><p class="mudo" style="margin:4px 0 0">Começa a contar a partir do próximo lançamento (os itens novos guardam o horário).</p>`; return; }
    const frac = Math.min(1, j.horas / meta), fim = new Date(j.desde + meta * 3600000);
    el.innerHTML = `<div class="card-tit"><h2>${ic('hourglass')} Jejum</h2><span class="mudo num">meta ${meta} h</span></div>
      <p class="jejum-tempo num"><b>${fmtDuracao(j.horas)}</b> <span class="mudo">${j.horas >= meta ? 'meta cumprida' : `até ${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`}</span></p>
      <div class="trilho-m"><i style="width:${frac * 100}%;background:var(--acento)"></i></div>
      ${hist.length ? `<p class="mudo num jejum-hist">Últimas noites: ${hist.map((h) => `<span class="${h.horas >= meta ? 'ok' : ''}">${Math.round(h.horas * 10) / 10} h</span>`).join(' · ')}
        (${hist.filter((h) => h.horas >= meta).length} de ${hist.length} na meta)</p>` : ''}`;
  };
  pintar();
  clearInterval(relogioJejum);
  relogioJejum = setInterval(pintar, 60000);
}

// ---------- "O que comer agora": primeira sugestão já visível ----------

let comboAgora = null;
async function desenharAgora(restMacros) {
  const el = tela.querySelector('.agora-card');
  const s = await primeiraSugestao(dia, restMacros).catch(() => null);
  if (!el?.isConnected) return;
  comboAgora = s;
  const cab = `<div class="card-tit"><h2>${ic('utensils')} O que comer agora</h2><span class="mudo num">faltam ${fmtKcal(restMacros.kcal)} kcal</span></div>`;
  if (!s) { el.innerHTML = `${cab}<button class="btn bloco suave" data-agora>Ver sugestões</button>`; return; }
  const c = s.combo;
  // nome curto do alimento (até a 1ª vírgula) para caber em 1–2 linhas
  const curto = (n) => n.split(',')[0];
  el.innerHTML = `${cab}
    <p class="agora-itens">${c.itens.map((it) => `${esc(curto(it.food.nome))} <b class="num">${fmtG(it.g)} g</b>`).join(' · ')}
      <br><span class="num mudo">${esc(s.nomeRef)}: ${fmtKcal(c.tot.kcal)} kcal · P ${fmtG(c.tot.prot)} · C ${fmtG(c.tot.carb)} · G ${fmtG(c.tot.gord)} g</span></p>
    <div class="linha"><button class="btn prim" data-agora-lancar>Lançar no ${esc(s.nomeRef.toLowerCase())}</button><button class="btn texto" data-agora>Ver mais</button></div>`;
}

// ---------- Refeições: por refeição (compactas) ou linha do tempo ----------

const modoVista = () => { try { return localStorage.getItem('diarioModo') === 'tempo' ? 'tempo' : 'ref'; } catch { return 'ref'; } };
const recolhidas = () => { try { return new Set(JSON.parse(localStorage.getItem('refsRecolhidas') || '[]')); } catch { return new Set(); } };

/** Refeições com itens viram cartões; vazias seguidas se juntam num cartão de linhas. */
function blocoRefeicoes(refs) {
  const partes = [];
  let vaz = [];
  const fecharVazias = () => { if (vaz.length) partes.push(`<section class="card refs-vazias">${vaz.join('')}</section>`); vaz = []; };
  for (const r of refs) {
    if ((dia.refeicoes[r.id] || []).length) { fecharVazias(); partes.push(cartaoRefeicao(r)); }
    else vaz.push(linhaVazia(r));
  }
  fecharVazias();
  return partes.join('');
}

function linhaVazia(r) {
  const c = chips[r.id], dois = c && c.ontem && c.sempre.length;   // dois chips não cabem na linha: vão para baixo do nome
  return `<div class="ref-vazia${dois ? ' duas' : ''}" data-ref="${r.id}">
    <button type="button" class="rv-nome" data-menu aria-label="${esc(r.nome)}: mais opções"><span class="ref-ico" aria-hidden="true">${iconeRef(r.id)}</span><span>${esc(r.nome)}</span></button>
    <div class="rv-chips">${chipsRefeicao(r)}</div>
    <button type="button" class="ico rv-add" data-add aria-label="Adicionar em ${esc(r.nome)}">${ic('plus')}</button></div>`;
}

function linhaItem(it, refId, extra = '') {
  return `<li class="item-wrap${novos.has(it.id) ? ' novo' : ''}${it.planejado ? ' planejado' : ''}" data-ref="${refId}"><div class="fundo-apagar" aria-hidden="true">Apagar</div>
    <div class="item" data-item="${it.id}">${extra}
    <div class="info" data-editar><div class="nome">${esc(it.nome)}</div>
      <div class="mudo num">${it.planejado ? 'Planejado · ' : ''}${it.rapido ? `Adição rápida · P ${fmtG(it.n.prot)} C ${fmtG(it.n.carb)} G ${fmtG(it.n.gord)}`
        : `${rotuloQtdItem(it)}${it.falta?.length ? ' · dados parciais' : ''}`}</div></div>
    <span class="kcal num">${fmtKcal(it.n.kcal)}</span>
    ${it.planejado ? `<button class="ico confirmar" data-confirmar aria-label="Comi: confirmar ${esc(it.nome)}">${ic('circle-check', 'g')}</button>`
      : `<button class="ico" data-apagar aria-label="Apagar ${esc(it.nome)}">${ICONES.lixo}</button>`}</div></li>`;
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Itens por horário de lançamento (itens antigos ou copiados ficam no horário padrão da refeição). */
function linhaDoTempoHtml(refs) {
  const nomes = Object.fromEntries(refs.map((r) => [r.id, r.nome]));
  let antes = '';
  return `<section class="card tempo"><ul class="itens">${linhaDoTempo(dia, refs).map(({ refId, item, min }) => {
    const chave = refId + hhmm(min), cab = chave !== antes;
    antes = chave;
    return (cab ? `<li class="tempo-h"><span class="num">${hhmm(min)}</span><span class="ref-ico" aria-hidden="true">${iconeRef(refId)}</span>${esc(nomes[refId] || '')}</li>` : '')
      + linhaItem(item, refId);
  }).join('')}</ul></section>`;
}

/** Deslizar item para a esquerda apaga (com desfazer); deslizar fora dos itens troca o dia. */
function ligarDeslizar() {
  let alvo = null, x0 = 0, y0 = 0, dx = 0, horizontal = null, trocaDia = false;
  tela.style.touchAction = 'pan-y';                     // gesto horizontal fica com o app; rolagem vertical normal
  tela.onpointerdown = (e) => {
    if (e.pointerType === 'mouse') return;
    const li = e.target.closest('.item');
    if (!li && e.target.closest('input, select, textarea, .semana, .heroi-pags, .rv-chips, .seg')) return;
    alvo = li || tela; trocaDia = !li; x0 = e.clientX; y0 = e.clientY; dx = 0; horizontal = null;
  };
  tela.onpointermove = (e) => {
    if (!alvo) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (horizontal == null && Math.abs(mx) + Math.abs(my) > 8) horizontal = Math.abs(mx) > Math.abs(my) * 1.3;
    if (!horizontal) return;
    if (trocaDia) { dx = mx; tela.style.transform = `translateX(${mx * 0.25}px)`; return; }
    dx = Math.min(0, mx);
    alvo.classList.add('arrastando');
    alvo.style.transform = `translateX(${dx}px)`;
  };
  const soltar = () => {
    if (!alvo) return;
    if (trocaDia) {
      alvo = null; tela.style.transform = '';
      if (horizontal && Math.abs(dx) > 70) {
        ignorarClique = true; setTimeout(() => { ignorarClique = false; }, 400);
        vibrar(8);
        const passo = dx < 0 ? 1 : -1;
        tela.classList.remove('dia-esq', 'dia-dir'); void tela.offsetWidth;
        tela.classList.add(passo > 0 ? 'dia-esq' : 'dia-dir');
        mudarDia(somarDias(estado.dataAtual, passo));
      }
      return;
    }
    const li = alvo; alvo = null;
    li.classList.remove('arrastando');
    if (horizontal && dx < -8) {                        // o "click" que segue o arraste não abre a edição
      ignorarClique = true;
      setTimeout(() => { ignorarClique = false; }, 400);
    }
    if (dx < -110) {
      li.style.transform = 'translateX(-100%)';
      vibrar(15);
      const refId = li.closest('[data-ref]').dataset.ref;
      setTimeout(() => apagar(refId, li.dataset.item), 160);
    } else li.style.transform = '';
  };
  tela.onpointerup = soltar;
  tela.onpointercancel = soltar;
}

/** Refeição com itens: cabeçalho (nome, kcal que recolhe/expande, +, ⋯), mini-barra P/C/G e itens. */
function cartaoRefeicao(r) {
  const itens = dia.refeicoes[r.id] || [];
  const t = totalRefeicao(dia, r.id);
  const nf = fotosCont[r.id] || 0;
  const rec = recolhidas().has(r.id);
  const kM = { p: t.prot * 4, c: t.carb * 4, g: t.gord * 9 }, kS = kM.p + kM.c + kM.g || 1;
  const protOk = alvoProtRef && t.prot >= alvoProtRef;
  return `<section class="card ref${rec ? ' recolhida' : ''}" data-ref="${r.id}">
    <div class="ref-tit"><h2 data-painel-ref role="button" tabindex="0" aria-label="Painel de ${esc(r.nome)}"><span class="ref-ico" aria-hidden="true">${iconeRef(r.id)}</span><span>${esc(r.nome)}</span></h2>
      <button type="button" class="ref-kcal num" data-recolher aria-expanded="${!rec}" aria-label="${fmtKcal(t.kcal)} kcal. ${rec ? 'Mostrar' : 'Esconder'} itens">
        <b>${fmtKcal(t.kcal)}</b><span class="mudo">kcal</span>${ic('chevron-down', 'p')}</button>
      <button type="button" class="ico" data-add aria-label="Adicionar em ${esc(r.nome)}">${ic('plus')}</button>
      <button type="button" class="ico" data-menu aria-label="Mais opções de ${esc(r.nome)}">${ICONES.pontos}</button></div>
    <div class="ref-mini">
      <div class="pilha" aria-hidden="true"><i style="width:${(kM.p / kS) * 100}%;background:var(--prot)"></i><i style="width:${(kM.c / kS) * 100}%;background:var(--carb)"></i><i style="width:${(kM.g / kS) * 100}%;background:var(--gord)"></i></div>
      <span class="num mudo"><span class="${protOk ? 'prot-ok' : ''}" title="Alvo por refeição: ${alvoProtRef} g (0,4 g/kg)">P ${fmtG(t.prot)}${protOk ? ic('check', 'p') : ''}</span> · C ${fmtG(t.carb)} · G ${fmtG(t.gord)} g</span>
      ${nf ? `<button type="button" class="chip-tog" data-fotos aria-label="${nf} foto(s) da refeição">${ic('camera', 'p')} ${nf}</button>` : ''}</div>
    <div class="ref-corpo"><div class="ref-corpo-in"><ul class="itens">${itens.map((it) => linhaItem(it, r.id)).join('')}</ul></div></div>
  </section>`;
}

/** Anima o número do anel e o arco do valor anterior até o atual (sem animação se o sistema pede menos movimento). */
function animarAnel(antes, { restante, frac, C }) {
  const num = tela.querySelector('[data-anel-num]'), arco = tela.querySelector('.anel .valor');
  if (!num || !arco) return;
  const fim = () => { num.textContent = fmtKcal(Math.abs(restante)); arco.setAttribute('stroke-dashoffset', C * (1 - frac)); };
  if (!antes || document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches
    || (antes.restante === restante && antes.frac === frac)) return fim();
  setTimeout(() => { if (num.isConnected) fim(); }, 650);   // garante o valor final mesmo se a animação for interrompida
  arco.style.transition = 'stroke-dashoffset .5s ease-out';
  requestAnimationFrame(() => arco.setAttribute('stroke-dashoffset', C * (1 - frac)));
  const t0 = performance.now(), de = antes.restante, dur = 500;
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3;
    num.textContent = fmtKcal(Math.abs(de + (restante - de) * e));
    if (k < 1 && num.isConnected) requestAnimationFrame(passo); else fim();
  };
  requestAnimationFrame(passo);
}

/** Chips de 1 toque (só em refeição vazia). */
function chipsRefeicao(r) {
  const c = chips[r.id];
  if (!c || (!c.ontem && !c.sempre.length)) return '';
  return `${c.ontem ? `<button type="button" class="chip-tog" data-chip-ontem aria-label="Repetir ${esc(r.nome.toLowerCase())} de ontem (${c.ontem} itens)">${ic('rotate-ccw', 'p')} Ontem</button>` : ''}${
    c.sempre.length ? `<button type="button" class="chip-tog" data-chip-sempre aria-label="Seu ${esc(r.nome.toLowerCase())} de sempre (${c.sempre.length} itens)">${ic('star', 'p')} De sempre</button>` : ''}`;
}

/** "38 g", "200 mL" ou "2 × fatia · 50 g" (gramas sem casas decimais só na exibição). */
function rotuloQtdItem(it) {
  if (it.porcao?.ml) return `${fmtG(it.porcao.qtd)} mL`;
  return `${it.porcao && it.porcao.nome !== 'grama' ? `${fmtNum(it.porcao.qtd)} × ${esc(it.porcao.nome)} · ` : ''}${fmtG(it.g)} g`;
}

async function clique(e) {
  if (ignorarClique) { ignorarClique = false; return; }
  const ir = e.target.closest('[data-ir]');
  if (ir) return mudarDia(ir.dataset.ir);
  if (e.target.closest('[data-agua]')) return adicionarAgua();
  const pg = e.target.closest('[data-ir-pag]');
  if (pg) { const box = tela.querySelector('.heroi-pags'); return box.scrollTo({ left: Number(pg.dataset.irPag) * box.clientWidth, behavior: 'smooth' }); }
  const modo = e.target.closest('[data-modo]');
  if (modo) { try { localStorage.setItem('diarioModo', modo.dataset.modo); } catch {} return desenhar(); }
  const rec = e.target.closest('[data-recolher]');
  if (rec) {
    const sec = rec.closest('[data-ref]'), s = recolhidas(), fechar = !sec.classList.contains('recolhida');
    sec.classList.toggle('recolhida', fechar);
    rec.setAttribute('aria-expanded', !fechar);
    if (fechar) s.add(sec.dataset.ref); else s.delete(sec.dataset.ref);
    try { localStorage.setItem('refsRecolhidas', JSON.stringify([...s])); } catch {}
    return;
  }
  if (e.target.closest('[data-agora-lancar]') && comboAgora) return lancarCombo(estado.dataAtual, comboAgora.refId, comboAgora.combo, desenhar);
  if (e.target.closest('[data-detalhe]')) return abrirDetalhe();
  if (e.target.closest('[data-treino]')) return alternarTreino();
  if (e.target.closest('[data-nota]')) return folhaNota();
  const dr = e.target.closest('[data-drive]');
  if (dr) { dr.disabled = true; try { await enviarAgora(); dr.remove(); } catch (err) { aviso(err.message, { ms: 8000 }); dr.disabled = false; } return; }
  if (e.target.closest('[data-copiar-dia]')) return copiarDeOntem(null);
  if (e.target.closest('[data-agora]')) return folhaOQueComer({ dia, restante: agoraRestante, aoLancar: desenhar });
  const sec = e.target.closest('[data-ref]');
  if (!sec) return;
  const refId = sec.dataset.ref;
  const nomeRef = refeicoesDoDia(dia, estado.config.refeicoes).find((r) => r.id === refId)?.nome;
  if (e.target.closest('[data-add]')) {
    estado.refeicaoAlvo = refId;
    estado.refeicaoDoDiario = true;
    location.hash = '#adicionar';
    return;
  }
  if (e.target.closest('[data-chip-ontem]')) { vibrar(10); return copiarDeOntem(refId); }
  if (e.target.closest('[data-chip-sempre]')) {
    const itens = chips[refId]?.sempre || [];
    const antes = dia;
    await gravarDia(lancarSalva(dia, refId, nomeRef, { itens }));
    vibrar(10);
    await desenhar();
    return aviso(`${itens.length} item(ns) → ${nomeRef}`, { acao: async () => { await gravarDia(antes); desenhar(); } });
  }
  if (e.target.closest('[data-painel-ref]')) return painelRefeicao(dia, meta, refId, { aoMudar: desenhar });
  if (e.target.closest('[data-fotos]')) return folhaFotos(estado.dataAtual, refId, nomeRef, desenhar);
  if (e.target.closest('[data-scan]')) return lerCodigoPara(refId);
  if (e.target.closest('[data-menu]')) return menuRefeicao(refId, nomeRef);
  const li = e.target.closest('[data-item]');
  if (!li) return;
  const item = dia.refeicoes[refId].find((i) => i.id === li.dataset.item);
  if (e.target.closest('[data-apagar]')) return apagar(refId, item.id);
  if (e.target.closest('[data-confirmar]')) {
    const antes = dia;
    await gravarDia(confirmarPlanejado(dia, refId, item.id));
    vibrar(12);
    await desenhar();
    return aviso(`${item.nome}: comido`, { acao: async () => { await gravarDia(antes); desenhar(); } });
  }
  if (e.target.closest('[data-editar]') && item.rapido) return folhaRapida(item, refId);
  if (e.target.closest('[data-editar]')) {
    folhaQuantidade({ ...item.por100, id: item.foodId, nome: item.nome, fonte: item.fonte }, {
      titulo: 'Editar item', g: item.g, porcao: item.porcao, refId, botao: 'Salvar', semAcoes: true,
      descontar: item.planejado ? null : item.n, planejado: !!item.planejado,
      aoApagar: () => apagar(refId, item.id),
      aoConfirmar: async ({ g, porcao, refId: novaRef, planejado }) => {
        const novo = alterarQuantidade(item, g, porcao);
        if (planejado) novo.planejado = true; else delete novo.planejado;
        let d = dia;
        if (novaRef !== refId) {
          d = removerItem(d, refId, item.id).dia;
          (d.refeicoes[novaRef] ||= []).push(novo);
          d.nomes[novaRef] = estado.config.refeicoes.find((r) => r.id === novaRef)?.nome;
        } else d = substituirItem(d, refId, novo);
        await gravarDia(d);
        desenhar();
      },
    });
  }
}

/** Código de barras → quantidade → lança na refeição. */
function lerCodigoPara(refId) {
  return abrirScanner({
    aoAlimento: (food) => folhaQuantidade(food, {
      refId,
      aoConfirmar: async ({ g, porcao, refId: r, planejado }) => {
        const ref = estado.config.refeicoes.find((x) => x.id === r);
        const antes = dia;
        const novo = criarItem(food, g, porcao);
        if (planejado) novo.planejado = true;
        await gravarDia(adicionarItem(dia, r, ref.nome, novo));
        registrarRecente(food.id);
        await desenhar();
        aviso(`${food.nome} → ${ref.nome}`, { acao: async () => { await gravarDia(antes); desenhar(); } });
      },
    }),
  });
}

/** Menu ⋯ da refeição (também o toque no nome de uma refeição vazia). */
function menuRefeicao(refId, nomeRef) {
  const tem = (dia.refeicoes[refId] || []).length;
  const p = abrirFolha(nomeRef, `<div class="menu-lista">
    <button class="btn" data-op="painel">${ic('chart-pie')} Painel da refeição</button>
    <button class="btn" data-op="rapida">${ICONES.raio} Adição rápida (kcal e macros)</button>
    <button class="btn" data-op="scan">${ICONES.codigo} Ler código de barras</button>
    <button class="btn" data-op="ia">${ICONES.camera} Estimar por foto (IA)</button>
    <button class="btn" data-op="texto">${ic('mic')} Falar ou escrever o que comeu</button>
    <button class="btn" data-op="cardapio">${ic('clipboard-list')} Foto de cardápio (IA)</button>
    <button class="btn" data-op="salvas">${ic('star')} Lançar refeição salva</button>
    ${tem ? '<button class="btn" data-op="salvar">' + ic('save') + ' Salvar como refeição salva</button>' : ''}
    <button class="btn" data-op="copiar">${ICONES.copiar} Copiar ${esc(nomeRef)} de ontem</button>
    ${tem ? `<button class="btn" data-op="copiar-dias">${ic('calendar-range')} Copiar ${esc(nomeRef)} para outros dias</button>` : ''}
    ${Object.values(dia.refeicoes).some((l) => l.length) ? `<button class="btn" data-op="copiar-dia">${ic('calendar-range')} Copiar o dia inteiro para outros dias</button>` : ''}
    <button class="btn" data-op="fotos">${ICONES.camera} Foto da refeição ${fotosCont[refId] ? `(${fotosCont[refId]})` : ''}</button></div>`);
  const depois = (f) => { fecharFolha(); setTimeout(f, 350); };
  p.onclick = (ev) => {
    const op = ev.target.closest('[data-op]')?.dataset.op;
    if (op === 'painel') depois(() => painelRefeicao(dia, meta, refId, { aoMudar: desenhar }));
    if (op === 'rapida') folhaRapida(null, refId);
    if (op === 'ia') depois(() => folhaFotoIA({ data: estado.dataAtual, refId, aoLancar: desenhar }));
    if (op === 'texto') depois(() => import('./frase-ui.js').then((m) => m.folhaFrase({ data: estado.dataAtual, refId, aoLancar: desenhar })));
    if (op === 'cardapio') depois(() => folhaCardapioIA({ data: estado.dataAtual, refId, aoLancar: desenhar }));
    if (op === 'salvas') depois(() => folhaSalvas({ data: estado.dataAtual, refId, aoLancar: desenhar }));
    if (op === 'salvar') depois(() => folhaSalvarRefeicao(dia.refeicoes[refId], nomeRef));
    if (op === 'copiar') { fecharFolha(); copiarDeOntem(refId); }
    if (op === 'copiar-dias' || op === 'copiar-dia') depois(() => import('./copiar-dias.js').then((m) =>
      m.folhaCopiarDias(dia, { refId: op === 'copiar-dias' ? refId : null, nomeRef, aoTerminar: desenhar })));
    if (op === 'fotos') folhaFotos(estado.dataAtual, refId, nomeRef, desenhar);
    if (op === 'scan') depois(() => lerCodigoPara(refId));
  };
}

/** Copia de ontem: a refeição `refId` ou o dia inteiro (null). Acrescenta, não substitui. */
async function copiarDeOntem(refId) {
  const ontem = await lerDia(somarDias(estado.dataAtual, -1));
  const antes = dia;
  const { dia: d, n } = copiarPara(dia, ontem, refId);
  if (!n) return aviso(refId ? 'Essa refeição estava vazia no dia anterior.' : 'O dia anterior está vazio.');
  await gravarDia(d);
  await desenhar();
  aviso(`${n} item(ns) copiado(s)`, { acao: async () => { await gravarDia(antes); desenhar(); } });
}

/** Adição rápida (novo ou editar item rápido existente). */
function folhaRapida(item, refId) {
  const n = item?.n || {};
  const campos = [['kcal', 'Calorias (kcal)*'], ['prot', 'Proteína (g)'], ['carb', 'Carboidrato (g)'], ['gord', 'Gordura (g)'], ['fibra', 'Fibra (g)'], ['sodio_mg', 'Sódio (mg)']];
  const val = (k) => (item ? (k === 'fibra' || k === 'sodio_mg') && item.falta?.includes(k) ? '' : fmtNum(Math.round(n[k] * 10) / 10) : '');
  const p = abrirFolha(item ? 'Editar adição rápida' : 'Adição rápida', `<form id="fq" novalidate>
    <label class="campo"><span>Descrição (opcional)</span><input type="text" name="nome" maxlength="60" value="${esc(item?.rapido && item.nome !== 'Adição rápida' ? item.nome : '')}" placeholder="ex.: almoço no restaurante (estimado)"></label>
    <div class="grade2">${campos.map(([k, r]) => `<label class="campo"><span>${r}</span><input type="text" inputmode="decimal" name="${k}" value="${val(k)}"></label>`).join('')}</div>
    <label class="campo"><span>Refeição</span><select name="ref">${estado.config.refeicoes.map((r) => `<option value="${r.id}" ${r.id === refId ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}</select></label>
    <p class="nota alerta" id="av" hidden></p><p class="erro" id="erro"></p>
    <button class="btn prim bloco">${item ? 'Salvar' : 'Adicionar'}</button></form>`);
  const f = $('#fq', p);
  let confirmado = false;
  f.oninput = () => { confirmado = false; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = {};
    for (const [k] of campos) { const t = f[k].value.trim(); v[k] = t === '' ? null : lerNumero(t); }
    const erro = v.kcal == null || Number.isNaN(v.kcal) ? 'Informe as calorias.'
      : Object.values(v).some((x) => Number.isNaN(x)) ? 'Há um número inválido.'
      : Object.values(v).some((x) => x != null && x < 0) ? 'Valores não podem ser negativos.'
      : v.kcal > 10000 ? 'Mais de 10000 kcal num item parece engano.' : '';
    $('#erro', p).textContent = erro;
    if (erro) return;
    // kcal muito acima do padrão do usuário também pede confirmação (avaliarSuspeito com 100 g = valor digitado)
    const av = avisoKcalMacros({ kcal: v.kcal, prot: v.prot ?? 0, carb: v.carb ?? 0, gord: v.gord ?? 0 })
      || avaliarSuspeito({ nome: 'adição rápida', kcal: v.kcal }, 100, await contextoSuspeito(null).catch(() => ({})));
    if (av && (v.prot != null || v.carb != null || v.gord != null) && !confirmado) {
      $('#av', p).textContent = av + ' Toque de novo para confirmar.'; $('#av', p).hidden = false; confirmado = true; return;
    }
    const novo = { ...criarItemRapido({ nome: f.nome.value.trim(), ...v }), ...(item ? { id: item.id } : {}) };
    const novaRef = f.ref.value;
    let d = item ? removerItem(dia, refId, item.id).dia : dia;
    d = adicionarItem(d, novaRef, estado.config.refeicoes.find((r) => r.id === novaRef).nome, novo);
    await gravarDia(d);
    fecharFolha();
    desenhar();
  };
}

async function apagar(refId, itemId) {
  const antes = dia;
  const { dia: d, removido } = removerItem(dia, refId, itemId);
  await gravarDia(d);
  await desenhar();
  aviso(`${removido.nome} apagado`, { acao: async () => { await gravarDia(antes); desenhar(); } });
}

function abrirDetalhe() {
  return detalheDia(dia, meta, { rotulo: rotuloData(estado.dataAtual), alvoProt: alvoProtRef });
}

// ---------- Etiquetas e nota do dia ----------

function faixaEtiquetas() {
  const tags = dia.tags || [];
  const extra = Number(estado.metas.treinoExtra) || 0;
  const outros = tags.filter((t) => t !== 'treino').map((t) => ETIQUETAS.find(([id]) => id === t)?.[1] || t);
  return `<div class="etiquetas-dia" data-bloco="etiquetas">
    <button class="chip-tog" data-treino aria-pressed="${tags.includes('treino')}">${ic('dumbbell', 'p')} Treino${extra && tags.includes('treino') ? ` +${fmtKcal(extra)} kcal` : ''}</button>
    ${outros.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}
    <button class="chip-tog" data-nota aria-label="Nota e etiquetas do dia">${dia.nota ? ic('notebook-pen', 'p') + ' ' + esc(dia.nota.slice(0, 28)) + (dia.nota.length > 28 ? '…' : '') : ic('notebook-pen', 'p') + ' Nota'}</button></div>`;
}

async function alternarTreino() {
  const d = structuredClone(dia);
  d.tags = d.tags || [];
  if (d.tags.includes('treino')) d.tags = d.tags.filter((t) => t !== 'treino'); else d.tags.push('treino');
  await gravarDia(d);
  vibrar(10);
  await desenhar();
  const extra = Number(estado.metas.treinoExtra) || 0;
  if (ehTreino(d) && !extra) aviso('Dia marcado como treino. Para a meta subir nesses dias, defina o extra em Metas.', { ms: 6000, acao: () => { location.hash = '#metas'; }, rotulo: 'Metas' });
}

function folhaNota() {
  const tags = new Set(dia.tags || []);
  const p = abrirFolha('Nota do dia', `<form id="fn" novalidate>
    <div class="etiquetas-dia">${ETIQUETAS.map(([id, r, i]) => `<button type="button" class="chip-tog" data-tag="${id}" aria-pressed="${tags.has(id)}">${ic(i, 'p')} ${r}</button>`).join('')}</div>
    <label class="campo"><span>Nota (opcional)</span><textarea name="nota" rows="3" maxlength="300" placeholder="ex.: treino de perna; jantar fora">${esc(dia.nota || '')}</textarea></label>
    <p class="mudo">Etiquetas e notas aparecem no calendário e no relatório semanal do Progresso, para explicar dias fora da curva.</p>
    <button class="btn prim bloco">Salvar</button></form>`);
  p.onclick = (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    if (on) tags.add(b.dataset.tag); else tags.delete(b.dataset.tag);
  };
  $('#fn', p).onsubmit = async (e) => {
    e.preventDefault();
    const d = structuredClone(dia);
    d.tags = ETIQUETAS.map(([id]) => id).filter((id) => tags.has(id));
    d.nota = e.target.nota.value.trim();
    if (!d.tags.length) delete d.tags;
    if (!d.nota) delete d.nota;
    await gravarDia(d);
    fecharFolha();
    desenhar();
  };
}

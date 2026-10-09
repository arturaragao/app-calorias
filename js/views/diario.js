// views/diario.js — tela inicial: navegação por dia, anel de calorias, macros e refeições.

import { estado, lerDia, gravarDia, pesoAtual, datasComRegistro } from '../state.js';
import { db } from '../db.js';
import { totalAgua, AGUA_PADRAO } from './reg-agua.js';
import { detalheDia, painelRefeicao } from './detalhe-dia.js';
import { aplicarLayout, botaoOrganizar } from '../layout.js';
import { metaDoDia } from '../goals.js';
import { totalDia, totalRefeicao, refeicoesDoDia, removerItem, alterarQuantidade, substituirItem,
  criarItemRapido, adicionarItem, copiarPara, criarItem, lancarSalva, ETIQUETAS, ehTreino, alvoProteinaRefeicao } from '../diary.js';
import { avisoKcalMacros, registrarRecente } from '../custom.js';
import { abrirScanner } from './scanner.js';
import { diasDesdeUltima } from './reg-dobras.js';
import { diasSemBackup } from '../backup.js';
import { contagemDoDia } from '../photos.js';
import { topo, esc, ICONES, iconeRef, $, aviso, abrirFolha, fecharFolha, vibrar } from '../ui.js';
import { estadoVazio } from '../vazio.js';
import { talvezTour } from './tour.js';
import { chaveData, somarDias, fmtData, fmtKcal, fmtG, fmtNum, lerNumero, DIAS_SEMANA, DIAS_CURTOS, diaSemana } from '../utils.js';
import { folhaQuantidade } from './quantidade.js';
import { folhaFotos } from './fotos.js';
import { folhaFotoIA, folhaTextoIA, folhaCardapioIA } from './foto-ia.js';
import { folhaSalvarRefeicao, folhaSalvas } from './salvas.js';
import { pendenteToque } from '../drive.js';
import { folhaOQueComer, diariosRecentes, contextoSuspeito } from './sugestao.js';
import { refeicaoDeSempre, avaliarSuspeito } from '../inteligencia.js';
import { enviarAgora } from './drive-ui.js';

let tela, dia, meta, fotosCont = {}, ignorarClique = false, alvoProtRef = 0, chips = {}, agoraRestante = null, anelAntes = null;

export async function render(t) {
  tela = t;
  await desenhar();
  talvezTour();
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

/** Faixa da semana (seg–dom) do dia aberto; o ponto indica dia com registro. */
function faixaSemana(ativos) {
  const ini = somarDias(estado.dataAtual, -diaSemana(estado.dataAtual)), hoje = chaveData();
  return `<nav class="semana" data-bloco="semana" aria-label="Dias da semana">${Array.from({ length: 7 }, (_, i) => {
    const c = somarDias(ini, i);
    return `<button data-ir="${c}" aria-pressed="${c === estado.dataAtual}" class="${ativos.has(c) ? 'tem' : ''} ${c === hoje ? 'hoje' : ''}"
      aria-label="${DIAS_SEMANA[i]}, ${fmtData(c)}${ativos.has(c) ? ', com registro' : ''}">
      <span class="d">${DIAS_CURTOS[i]}</span><span class="n">${Number(c.slice(8))}</span><span class="ponto"></span></button>`;
  }).join('')}</nav>`;
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
  const barra = (cls, nome, v, m, un = 'g', f = fmtG) => {
    const pct = m > 0 ? Math.min((v / m) * 100, 100) : 0;
    return `<div class="barra ${cls} ${v > m * 1.0001 ? 'passou' : ''}"><div class="rot"><span>${nome}</span>
      <span class="num"><b>${f(v)}</b> / ${f(m)} ${un}</span></div><div class="trilho"><div class="enche" style="width:${pct}%"></div></div></div>`;
  };
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
  tela.innerHTML = `
    ${faixaSemana(ativos)}
    ${ehHoje && pendenteToque() ? '<button class="nota" data-drive>☁️ Backup diário no Google Drive pendente — tocar para enviar.</button>' : ''}
    ${bk.dias > 30 && ehHoje ? `<a class="nota" href="#config">💾 ${bk.nunca ? `Você usa o app há ${bk.dias} dias sem backup` : `Último backup há ${bk.dias} dias`} — tocar para exportar.</a>` : ''}
    ${dias > 30 && ehHoje ? `<a class="nota" href="#registros?aba=dobras">📏 Última avaliação de dobras há ${dias} dias — tocar para registrar.</a>` : ''}
    <section class="card" data-bloco="resumo" data-detalhe tabindex="0" role="button" aria-label="Resumo do dia. Toque para ver os detalhes.">
      <div class="resumo">
        <div class="anel ${restante < 0 ? 'excesso' : ''}">
          <svg viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento-forte)"/></linearGradient></defs>
            <circle class="fundo" cx="75" cy="75" r="64"/>
            <circle class="valor" cx="75" cy="75" r="64" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (anelAntes?.frac ?? frac))}"/></svg>
          <div class="centro"><span class="grande num" data-anel-num>${fmtKcal(Math.abs(anelAntes?.restante ?? restante))}</span>
            <span class="mudo">${restante < 0 ? 'kcal acima' : 'restantes'}</span></div>
        </div>
        <div>
          ${barra('prot', 'Proteína', tot.prot, meta.prot)}
          ${barra('carb', 'Carboidrato', tot.carb, meta.carb)}
          ${barra('gord', 'Gordura', tot.gord, meta.gord)}
        </div>
      </div>
      <div class="equacao num"><div><b>${fmtKcal(meta.kcal)} <small>kcal</small></b><span>Meta</span></div>
        <div><b>${fmtKcal(tot.kcal)} <small>kcal</small></b><span>Consumido</span></div>
        <div><b style="${restante < 0 ? 'color:var(--alerta)' : ''}">${restante < 0 ? '+' + fmtKcal(-restante) : fmtKcal(restante)} <small>kcal</small></b><span>${restante < 0 ? 'Acima' : 'Restante'}</span></div></div>
    </section>
    ${ehHoje && restante >= 50 ? `<button class="btn bloco suave" data-bloco="agora" data-agora>🍽 O que comer agora <span class="mudo num">· faltam ${fmtKcal(restante)} kcal</span></button>` : ''}
    ${faixaEtiquetas()}
    <section class="card agua-card" data-bloco="agua" aria-label="Água">
      <div class="gota">${ICONES.gota}</div>
      <div class="info"><b class="num">${fmtNum(mlAgua)} <span class="mudo">/ ${fmtNum(ag.metaMl)} ml</span></b>
        <div class="trilho"><div class="enche" style="width:${Math.min(100, (mlAgua / ag.metaMl) * 100)}%"></div></div></div>
      <button class="btn peq suave" data-agua aria-label="Adicionar 1 copo de ${ag.copoMl} ml">+ ${fmtNum(ag.copoMl)} ml</button>
    </section>
    ${diaSemItens ? estadoVazio('prato', ehHoje ? 'Nada lançado hoje ainda' : 'Nada lançado neste dia', 'Toque em “+ Adicionar alimento” numa refeição ou deslize para os lados para trocar o dia.') : ''}
    <div data-bloco="refeicoes">${refs.map((r) => cartaoRefeicao(r)).join('')}</div>
    <button class="btn bloco suave" data-bloco="copiar" data-copiar-dia>${ICONES.copiar} Copiar o dia anterior</button>
    <p class="mudo" style="text-align:center;margin-top:14px">Toque no nome da refeição para ver o painel dela. Deslize um item para a esquerda para apagar; deslize fora dos itens para trocar o dia.</p>
    ${botaoOrganizar('diario')}`;
  aplicarLayout(tela, 'diario');
  animarAnel(anelAntes, { restante, frac, C });
  anelAntes = { restante, frac, data: estado.dataAtual };
  tela.onclick = clique;
  tela.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-detalhe], [data-painel-ref]')) e.target.click(); };
  ligarDeslizar();
}

/** Deslizar item para a esquerda apaga (com desfazer); deslizar fora dos itens troca o dia. */
function ligarDeslizar() {
  let alvo = null, x0 = 0, y0 = 0, dx = 0, horizontal = null, trocaDia = false;
  tela.style.touchAction = 'pan-y';                     // gesto horizontal fica com o app; rolagem vertical normal
  tela.onpointerdown = (e) => {
    if (e.pointerType === 'mouse') return;
    const li = e.target.closest('.item');
    if (!li && e.target.closest('input, select, textarea, .semana')) return;
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

function cartaoRefeicao(r) {
  const itens = dia.refeicoes[r.id] || [];
  const t = totalRefeicao(dia, r.id);
  const nf = fotosCont[r.id] || 0;
  return `<section class="card" data-ref="${r.id}">
    <div class="ref-tit"><h2 data-painel-ref role="button" tabindex="0" aria-label="Painel de ${esc(r.nome)}"><span class="ref-ico" aria-hidden="true">${iconeRef(r.id)}</span><span>${esc(r.nome)}</span></h2>
      <span class="linha" style="flex:0;gap:0">
      ${nf ? `<button class="btn peq suave" data-fotos aria-label="${nf} foto(s) da refeição">${ICONES.camera}${nf}</button>` : ''}
      <span class="num" style="white-space:nowrap;margin:0 2px 0 8px"><b>${fmtKcal(t.kcal)}</b> <span class="mudo">kcal</span></span>
      <button class="ico" data-menu aria-label="Mais opções de ${esc(r.nome)}">${ICONES.pontos}</button></span></div>
    ${itens.length ? `<div class="ref-tot num"><span class="m-p ${alvoProtRef && t.prot >= alvoProtRef ? 'prot-ok' : ''}" title="Alvo por refeição: ${alvoProtRef} g (0,4 g/kg)">P ${fmtG(t.prot)} g${alvoProtRef && t.prot >= alvoProtRef ? ' ✓' : ''}</span><span class="m-c">C ${fmtG(t.carb)} g</span><span class="m-g">G ${fmtG(t.gord)} g</span></div>` : ''}
    ${itens.length ? `<ul class="itens">${itens.map((it) => `<li class="item-wrap"><div class="fundo-apagar" aria-hidden="true">Apagar</div>
      <div class="item" data-item="${it.id}">
      <div class="info" data-editar><div class="nome">${esc(it.nome)}</div>
        <div class="mudo num">${it.rapido ? `Adição rápida · P ${fmtG(it.n.prot)} C ${fmtG(it.n.carb)} G ${fmtG(it.n.gord)}`
          : `${rotuloQtdItem(it)}${it.falta?.length ? ' · dados parciais' : ''}`}</div></div>
      <span class="kcal num">${fmtKcal(it.n.kcal)}</span>
      <button class="ico" data-apagar aria-label="Apagar ${esc(it.nome)}">${ICONES.lixo}</button></div></li>`).join('')}</ul>` : ''}
    ${chipsRefeicao(r)}
    <div class="add-linha"><button class="add-alim" data-add>+ Adicionar alimento</button>
      <button class="ico" data-scan aria-label="Ler código de barras para ${esc(r.nome)}">${ICONES.codigo}</button></div>
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
  return `<div class="chips-ref">${c.ontem ? `<button class="chip-tog" data-chip-ontem>↺ Repetir de ontem (${c.ontem})</button>` : ''}${
    c.sempre.length ? `<button class="chip-tog" data-chip-sempre>⭐ Seu ${esc(r.nome.toLowerCase())} de sempre (${c.sempre.length})</button>` : ''}</div>`;
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
  if (e.target.closest('[data-agua]')) {
    const ag = { ...AGUA_PADRAO, ...(estado.config.agua || {}) };
    const r = (await db.get('water', estado.dataAtual)) || { itens: [] };
    r.itens.push({ ts: Date.now(), ml: ag.copoMl });
    await db.put('water', estado.dataAtual, r);
    vibrar(10);
    await desenhar();
    return aviso(`+${fmtNum(ag.copoMl)} ml de água`, { acao: async () => { r.itens.pop(); await db.put('water', estado.dataAtual, r); desenhar(); } });
  }
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
  if (e.target.closest('[data-scan]')) {
    return abrirScanner({
      aoAlimento: (food) => folhaQuantidade(food, {
        refId,
        aoConfirmar: async ({ g, porcao, refId: r }) => {
          const ref = estado.config.refeicoes.find((x) => x.id === r);
          const antes = dia;
          await gravarDia(adicionarItem(dia, r, ref.nome, criarItem(food, g, porcao)));
          registrarRecente(food.id);
          await desenhar();
          aviso(`${food.nome} → ${ref.nome}`, { acao: async () => { await gravarDia(antes); desenhar(); } });
        },
      }),
    });
  }
  if (e.target.closest('[data-menu]')) {
    const p = abrirFolha(nomeRef, `<div class="menu-lista">
      <button class="btn" data-op="rapida">${ICONES.raio} Adição rápida (kcal e macros)</button>
      <button class="btn" data-op="ia">${ICONES.camera} Estimar por foto (IA)</button>
      <button class="btn" data-op="texto">✍️ Descrever o que comeu (IA)</button>
      <button class="btn" data-op="cardapio">📋 Foto de cardápio (IA)</button>
      <button class="btn" data-op="salvas">⭐ Lançar refeição salva</button>
      ${(dia.refeicoes[refId] || []).length ? '<button class="btn" data-op="salvar">💾 Salvar como refeição salva</button>' : ''}
      <button class="btn" data-op="copiar">${ICONES.copiar} Copiar ${esc(nomeRef)} de ontem</button>
      <button class="btn" data-op="fotos">${ICONES.camera} Foto da refeição ${fotosCont[refId] ? `(${fotosCont[refId]})` : ''}</button>
      <button class="btn" data-op="scan">${ICONES.codigo} Ler código de barras</button></div>`);
    p.onclick = (ev) => {
      const op = ev.target.closest('[data-op]')?.dataset.op;
      if (op === 'rapida') folhaRapida(null, refId);
      if (op === 'ia') { fecharFolha(); setTimeout(() => folhaFotoIA({ data: estado.dataAtual, refId, aoLancar: desenhar }), 350); }
      if (op === 'texto') { fecharFolha(); setTimeout(() => folhaTextoIA({ data: estado.dataAtual, refId, aoLancar: desenhar }), 350); }
      if (op === 'cardapio') { fecharFolha(); setTimeout(() => folhaCardapioIA({ data: estado.dataAtual, refId, aoLancar: desenhar }), 350); }
      if (op === 'salvas') { fecharFolha(); setTimeout(() => folhaSalvas({ data: estado.dataAtual, refId, aoLancar: desenhar }), 350); }
      if (op === 'salvar') { fecharFolha(); setTimeout(() => folhaSalvarRefeicao(dia.refeicoes[refId], nomeRef), 350); }
      if (op === 'copiar') { fecharFolha(); copiarDeOntem(refId); }
      if (op === 'fotos') folhaFotos(estado.dataAtual, refId, nomeRef, desenhar);
      if (op === 'scan') { fecharFolha(); sec.querySelector('[data-scan]').click(); }
    };
    return;
  }
  const li = e.target.closest('[data-item]');
  if (!li) return;
  const item = dia.refeicoes[refId].find((i) => i.id === li.dataset.item);
  if (e.target.closest('[data-apagar]')) return apagar(refId, item.id);
  if (e.target.closest('[data-editar]') && item.rapido) return folhaRapida(item, refId);
  if (e.target.closest('[data-editar]')) {
    folhaQuantidade({ ...item.por100, id: item.foodId, nome: item.nome, fonte: item.fonte }, {
      titulo: 'Editar item', g: item.g, porcao: item.porcao, refId, botao: 'Salvar', semAcoes: true,
      aoApagar: () => apagar(refId, item.id),
      aoConfirmar: async ({ g, porcao, refId: novaRef }) => {
        const novo = alterarQuantidade(item, g, porcao);
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
    <button class="chip-tog" data-treino aria-pressed="${tags.includes('treino')}">🏋️ Treino${extra && tags.includes('treino') ? ` +${fmtKcal(extra)} kcal` : ''}</button>
    ${outros.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}
    <button class="chip-tog" data-nota aria-label="Nota e etiquetas do dia">${dia.nota ? '📝 ' + esc(dia.nota.slice(0, 28)) + (dia.nota.length > 28 ? '…' : '') : '📝 Nota'}</button></div>`;
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
    <div class="etiquetas-dia">${ETIQUETAS.map(([id, r]) => `<button type="button" class="chip-tog" data-tag="${id}" aria-pressed="${tags.has(id)}">${r}</button>`).join('')}</div>
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

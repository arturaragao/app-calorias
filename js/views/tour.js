// views/tour.js — tour de 3 telas no primeiro uso: Organizar, Detalhes do dia e painel da refeição.
// Aparece uma vez (config.tourVisto); dá para rever em Ajustes › Sobre.

import { estado, salvarConfig } from '../state.js';
import { abrirFolha, fecharFolha, $ } from '../ui.js';

const PASSOS = [
  {
    titulo: 'Deixe as telas do seu jeito',
    texto: 'No fim de cada tela há <b>⇅ Organizar</b>: segure e arraste para mudar a ordem dos blocos e desligue o que não usa no dia a dia (fica escondido, não apagado).',
    figura: `<div class="tour-fig"><div class="tour-lin"><span>⠿</span> Resumo do dia <i class="tour-tog on"></i></div>
      <div class="tour-lin arrastando"><span>⠿</span> Água <i class="tour-tog on"></i></div>
      <div class="tour-lin"><span>⠿</span> Copiar o dia anterior <i class="tour-tog"></i></div></div>`,
  },
  {
    titulo: 'Detalhes do dia',
    texto: 'Toque no <b>anel de calorias</b> para ver meta, consumido e restante, a divisão dos macros, fibra, sódio, micronutrientes e de qual refeição e alimento veio cada nutriente.',
    figura: `<div class="tour-fig tour-anel"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="46" fill="none" stroke="var(--anel-fundo)" stroke-width="12"/>
      <circle cx="60" cy="60" r="46" fill="none" stroke="var(--acento)" stroke-width="12" stroke-linecap="round" stroke-dasharray="289" stroke-dashoffset="100" transform="rotate(-90 60 60)"/>
      <text x="60" y="66" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">1.240</text></svg><span class="tour-dedo">👆</span></div>`,
  },
  {
    titulo: 'Painel da refeição',
    texto: 'Toque no <b>nome de uma refeição</b> (ex.: Almoço) para ver os macros dela, quanto foi consumido × sugerido para essa refeição e cada item com sua barra.',
    figura: `<div class="tour-fig"><div class="tour-ref"><b>🍽 Almoço</b><span class="tour-dedo">👆</span><span class="num">640 kcal</span></div>
      <div class="tour-barras"><i style="background:var(--prot);width:34%"></i><i style="background:var(--carb);width:44%"></i><i style="background:var(--gord);width:22%"></i></div></div>`,
  },
];

/** Mostra o tour na primeira vez (chamado pelo Diário). */
export function talvezTour() {
  if (!estado.perfil || estado.config.tourVisto) return;
  setTimeout(() => { if ($('#folha').hidden && location.hash.replace('#', '').split('?')[0] in { '': 1, diario: 1 }) abrirTour(); }, 700);
}

export function abrirTour() {
  let i = 0;
  const concluir = () => { estado.config.tourVisto = true; salvarConfig(); };
  const p = abrirFolha('Bem-vindo(a) ao app', '<div id="tour"></div>', { foco: false, fechar: concluir });
  const desenhar = () => {
    const s = PASSOS[i], ultimo = i === PASSOS.length - 1;
    $('#tour', p).innerHTML = `${s.figura}
      <h3 style="margin:14px 0 6px">${s.titulo}</h3><p class="mudo" style="margin:0">${s.texto}</p>
      <div class="tour-pontos" aria-label="Passo ${i + 1} de ${PASSOS.length}">${PASSOS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="linha"><button type="button" class="btn" data-tour="pular">${ultimo ? 'Voltar' : 'Pular'}</button>
        <button type="button" class="btn prim" data-tour="prox">${ultimo ? 'Começar' : 'Próximo'}</button></div>`;
  };
  desenhar();
  p.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tour]');
    if (!b) return;
    const ultimo = i === PASSOS.length - 1;
    if (b.dataset.tour === 'prox') { if (ultimo) return fecharFolha(); i++; return desenhar(); }
    if (ultimo) { i--; return desenhar(); }
    fecharFolha();
  });
  // deslizar para os lados também troca o passo
  let x0 = null;
  p.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  p.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) < 50) return;
    i = Math.max(0, Math.min(PASSOS.length - 1, i + (dx < 0 ? 1 : -1)));
    desenhar();
  });
}

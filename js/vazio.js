// vazio.js — estados vazios com ilustração leve (SVG inline nas cores do tema, sem arquivos extras).

const T = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';

const DESENHOS = {
  // prato com garfo e faca
  prato: `<circle cx="60" cy="48" r="30" fill="var(--sup2)" stroke="currentColor" stroke-width="3"/>
    <circle cx="60" cy="48" r="19" ${T} opacity=".55"/>
    <path d="M18 22v14a5 5 0 0 0 10 0V22M23 22v52" ${T}/><path d="M97 22c-6 4-8 14-8 22h8v30" ${T}/>`,
  // estrela (favoritos)
  estrela: `<path d="M60 14l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3z" fill="var(--sup2)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`,
  // caderno (receitas / meus alimentos)
  caderno: `<rect x="34" y="12" width="52" height="68" rx="6" fill="var(--sup2)" stroke="currentColor" stroke-width="3"/>
    <path d="M46 30h28M46 42h28M46 54h18" ${T} opacity=".6"/><path d="M34 22h-6M34 36h-6M34 50h-6M34 64h-6" ${T}/>`,
  // relógio (recentes)
  relogio: `<circle cx="60" cy="46" r="32" fill="var(--sup2)" stroke="currentColor" stroke-width="3"/><path d="M60 28v18l12 8" ${T}/>`,
  // gráfico (progresso)
  grafico: `<rect x="22" y="14" width="76" height="62" rx="8" fill="var(--sup2)" stroke="currentColor" stroke-width="3"/>
    <path d="M32 62l16-16 12 10 22-24" ${T}/><circle cx="82" cy="32" r="3.5" fill="currentColor"/>`,
  // balança (peso)
  balanca: `<rect x="24" y="22" width="72" height="56" rx="12" fill="var(--sup2)" stroke="currentColor" stroke-width="3"/>
    <path d="M44 40a16 16 0 0 1 32 0z" ${T}/><path d="M60 40l6-8" ${T}/>`,
};

/** HTML do estado vazio. tipo: prato | estrela | caderno | relogio | grafico | balanca. */
export function estadoVazio(tipo, titulo, texto = '') {
  return `<div class="vazio" role="note"><svg viewBox="0 0 120 90" aria-hidden="true">${DESENHOS[tipo] || DESENHOS.prato}</svg>
    <b>${titulo}</b>${texto ? `<p>${texto}</p>` : ''}</div>`;
}

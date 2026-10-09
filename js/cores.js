// cores.js — cores editáveis (cor principal do app e uma cor fixa por macronutriente).
// A cor principal gera toda a paleta (fundos, bordas, textos) nos temas claro e escuro via color-mix.
// Só o que o usuário mudou é sobrescrito; o resto segue o css/app.css.

export const CORES_PADRAO = { acento: '#2b7a4d', prot: '#4f8a63', carb: '#e3c868', gord: '#e8955a', agua: '#2f7fa6' };
export const NOMES_CORES = { acento: 'Cor principal', prot: 'Proteína', carb: 'Carboidrato', gord: 'Gordura', agua: 'Água' };
export const PALETAS = [
  ['Verde', '#2b7a4d'], ['Petróleo', '#21707d'], ['Azul', '#2f5f9e'], ['Grafite', '#4a5560'],
  ['Vinho', '#8a3b4a'], ['Terracota', '#a65a3a'], ['Roxo', '#5b4a8a'],
];

const mix = (c, pct, com) => `color-mix(in srgb, ${c} ${pct}%, ${com})`;

/** CSS das cores personalizadas (string vazia = tudo padrão). Pura: testável em Node. */
export function cssCores(c = {}) {
  const claro = [], escuro = [];
  const a = c.acento && c.acento.toLowerCase() !== CORES_PADRAO.acento ? c.acento : null;
  if (a) {
    claro.push(`--acento:${a}`, `--acento-forte:${mix(a, 80, '#000')}`, `--acento-suave:${mix(a, 16, '#fff')}`, '--acento-txt:#fff',
      `--bg:${mix(a, 5, '#f6f7f6')}`, `--sup2:${mix(a, 9, '#fff')}`, `--sup3:${mix(a, 4, '#fff')}`, `--borda:${mix(a, 14, '#e4e6e5')}`,
      `--anel-fundo:${mix(a, 12, '#eceeed')}`, `--txt:${mix(a, 14, '#121614')}`, `--txt2:${mix(a, 22, '#5a625e')}`);
    escuro.push(`--acento:${mix(a, 60, '#fff')}`, `--acento-forte:${mix(a, 78, '#fff')}`, `--acento-suave:${mix(a, 28, '#0a0d0b')}`, '--acento-txt:#08100c',
      `--bg:${mix(a, 7, '#070908')}`, `--sup:${mix(a, 9, '#101311')}`, `--sup2:${mix(a, 13, '#151916')}`, `--sup3:${mix(a, 8, '#0c0f0d')}`,
      `--borda:${mix(a, 18, '#1c211e')}`, `--anel-fundo:${mix(a, 20, '#161a17')}`, `--txt:${mix(a, 8, '#e9ecea')}`, `--txt2:${mix(a, 25, '#a2aaa5')}`);
  }
  for (const k of ['prot', 'carb', 'gord', 'agua']) {
    if (!c[k] || c[k].toLowerCase() === CORES_PADRAO[k]) continue;
    claro.push(`--${k}:${c[k]}`);
    escuro.push(`--${k}:${mix(c[k], 72, '#fff')}`);
  }
  if (!claro.length) return '';
  const e = escuro.join(';');
  return `:root{${claro.join(';')}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-tema="claro"]){${e}}}` +
    `:root[data-tema="escuro"]{${e}}`;
}

/** Aplica no documento e guarda o CSS para o index.html pintar certo já na abertura. */
export function aplicarCores(c) {
  const css = cssCores(c);
  let st = document.getElementById('cores-usuario');
  if (!st) { st = document.createElement('style'); st.id = 'cores-usuario'; document.head.appendChild(st); }
  st.textContent = css;
  try { if (css) localStorage.setItem('coresCss', css); else localStorage.removeItem('coresCss'); } catch {}
}

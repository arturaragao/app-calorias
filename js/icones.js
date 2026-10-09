// icones.js — ícones de interface: sprite SVG único (icons/sprite.svg, gerado de Lucide, licença ISC).
// Sem DOM: pode ser importado pelos testes em Node. Gerar o sprite: node scripts/gerar_sprite.mjs

export const SPRITE = 'icons/sprite.svg';

/** <svg> de um ícone do sprite. cls: 'p' (16 px, junto ao texto), 'g' (24 px), 'cheio' (preenchido). */
export const ic = (nome, cls = '') =>
  `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="${SPRITE}#${nome}"/></svg>`;

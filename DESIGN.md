# DESIGN.md — Sistema de design 2.0 (Pacote 10)

Referência de todas as telas. Inspiração: Material 3 Expressive (sem copiar o Google). Tokens em `css/app.css` (bloco `:root`), helpers em `js/ui.js` e `js/icones.js`.

## Tokens

| Grupo | Tokens | Uso |
|-|-|-|
| Tipografia | `--fs-12` .75rem · `--fs-13` · `--fs-14` · `--fs-16` 1rem · `--fs-20` · `--fs-28` · `--fs-40`; pesos `--fw-r` 400 · `--fw-m` 500 · `--fw-sb` 600 · `--fw-b` 700 | Números sempre `tabular-nums` (`.num`, `b`, campos numéricos). Títulos de folha 20/600; legendas 12–13. |
| Escala do texto | `--escala-fonte` (0,85–1,3; padrão 1) | `html { font-size: 100% × escala }`. Ajustes › Aparência › Tamanho do texto; guardado em `localStorage.escalaFonte`, aplicado antes de pintar. |
| Espaço | `--e1` 4 · `--e2` 8 · `--e3` 12 · `--e4` 16 · `--e5` 20 · `--e6` 24 · `--e8` 32 (px) | Grade de 4 px. Margem lateral da tela 16. |
| Raios | `--r-xs` 8 · `--r-s` 12 · `--r-m` 18 · `--r-l` 28 · `--r-pilula` 999 | Botões/campos/chips 12; cartões 18; folha/diálogo 28; segmentado e pílulas 999. `--raio`/`--raio-p` = aliases antigos. |
| Elevação | `--elev-1` cartão · `--elev-2` flutuante · `--elev-3` folha, aviso, diálogo | No escuro a elevação vem mais da superfície que da sombra. `--sombra`/`--sombra-alta` = aliases. |
| Movimento | `--dur-c` 120 ms (estado) · `--dur-m` 200 ms (troca) · `--dur-l` 320 ms (entrada); `--curva` padrão · `--curva-enfase` (entradas) · `--curva-saida` | Tudo desliga com "reduzir movimento" do sistema. |
| Camada de estado | `--camada-hover` 8% · `--camada-press` 12% · `--camada-foco` 12% | Cor do conteúdo (`currentColor`) por cima do contêiner, via `background-image`. Desabilitado = texto 40% + contêiner 8%, nunca `opacity`. |
| Cores | `--bg --sup --sup2 --sup3 --borda --txt --txt2 --acento --acento-forte --acento-suave --acento-txt --alerta --perigo --prot --carb --gord --agua`; aviso: `--aviso-bg --aviso-txt --aviso-acao --aviso-borda` | Contraste AA conferido por teste (pares de tokens) e por auditoria no navegador. Cor dos macros só em preenchimentos. |
| Fonte | `--fonte`: Roboto do sistema | Decisão em DECISOES.md (2026-10-09). |

## Componentes

| Componente | Classe / helper | Notas |
|-|-|-|
| Botão preenchido | `.btn.prim` | Ação principal (1 por tela/folha). Altura 48 (`.peq` 40). |
| Botão tonal | `.btn.suave` | Ações secundárias frequentes. |
| Botão contorno | `.btn` | Padrão. |
| Botão texto | `.btn.texto` | Ações de diálogo, links de ação. `.perigo` = vermelho. |
| Botão de ícone | `.ico` | 48×48, sempre com `aria-label`. |
| Chip de filtro / ação | `.chip-tog` (`aria-pressed` no filtro) | Ícone `ic(nome,'p')` + texto; raio 12. `.chip` = rótulo estático. |
| Controle segmentado | `ui.seg(nome, opcoes, atual)` → `.seg` | Pílula; item ativo com `--elev-2`. |
| Cartão | `.card`, `.card-tit` | Raio 18, padding 16, `--elev-1`. |
| Linha de lista | `ui.linhaLista({icone, titulo, sub, fim, href})` → `.ll` (`.duas` para 2 linhas) | 56/64 px; com `href` mostra a seta. Ajustes usa `.config-lista`. |
| Folha inferior | `ui.abrirFolha(titulo, html)` | Raio 28, alça, "voltar" do Android fecha. |
| Diálogo | `await ui.confirmar(texto, {titulo, ok, cancelar, perigo})` | `<dialog>` nativo; substitui `window.confirm` em todo o app. |
| Aviso (toast) | `ui.aviso(msg, {acao, rotulo})` | Acima da barra **e** acima do "+" central; superfície invertida no claro, `--aviso-bg` com borda e sombra alta no escuro. |
| Estado vazio | `estadoVazio(ilustracao, titulo, texto)` (`js/vazio.js`) | Ilustração SVG decorativa + título + 1 frase. |
| Esqueleto | `ui.esqueleto(['alto','medio',''])` | Mostrado se a tela demora > 150 ms para montar. |
| Campo numérico com stepper | `ui.campoPasso(...)` + `ui.ligarPassos` | `−`/`+` de 48 px. |
| Chave liga/desliga | `.linha-chave` + `.chave` | Linha inteira clicável. |
| Carrossel de páginas | `.heroi` > `.heroi-pags` > `.heroi-pag` + `.heroi-pontos` | scroll-snap; ponto ativo vira pílula; altura acompanha a página. |
| Anel de macro | `anelMacro()` (diario.js) → `.mac` | Consumido no centro, "faltam X g" embaixo; proteína maior. |
| Dica única (coachmark) | `ui.talvezDica([{ chave, el, texto }])` | Balão com seta apontando o elemento; uma vez por aparelho. |
| Grade de ações | `.acoes-grade` > `.acao` (`views/acoes.js`) | Ícone 56 px tonal + rótulo; 4 por linha. |
| Teclado numérico | `.qtd-visor` + `.qtd-atalhos` + `.teclado` (quantidade.js) | Campo `inputmode="none"` (sem teclado do sistema), teclas de 48 px, 1ª tecla substitui o valor. |
| Prévia do impacto | `.previa` (`.acima` quando passa da meta) | "Depois disto: faltam X kcal · Y g de proteína". |
| Item interpretado | `.fr-item` (`.incerto`, `.nao`) + `.fr-chips` | Dúvida em âmbar com chips; não reconhecido tracejado. |
| Barra de seleção | `.cesta-barra` | Fixa acima do "+", com Cancelar e Lançar N. |
| Item planejado | `.item-wrap.planejado` + `.ico.confirmar` | Listrado e em itálico até o ✓. |
| Dia do planejador | `.plano-dia` > `.pd-cab` + `.pd-barra` + `.pd-ref` | Barra azul/verde/âmbar como a aderência; planejados em itálico. |
| Item de compra | `.compra` (checkbox + nome + quantidade) | Marcado = riscado. |
| Prato sugerido | `.rest-prato` (`.melhor`) | O melhor ganha borda e o botão preenchido. |

## Ícones

- **Sprite único** `icons/sprite.svg`, gerado por `node scripts/gerar_sprite.mjs` a partir do **Lucide** (`lucide-static`, licença ISC — creditado em Ajustes › Sobre). Só entram os ícones usados (`ic('nome')` em `js/` ou `sprite.svg#nome` no `index.html`, + lista `EXTRA` do script).
- Uso: `ic('nome')` (20 px), `ic('nome','g')` (24 px), `ic('nome','p')` (junto ao texto), `'cheio'` (preenchido, ex.: favorito). Traço 1,75. Sempre `aria-hidden`; o botão leva o `aria-label`.
- **Emoji só em conteúdo digitado pelo usuário.** O teste "Interface sem emoji" falha se aparecer emoji ou símbolo de ícone em `js/` ou `index.html` (lista permitida vazia).
- Gráficos (`chart.js`, anel, roscas) e ilustrações (`vazio.js`, `tour.js`) continuam como SVG próprio.

| Antes (emoji/símbolo) | Ícone Lucide | Onde |
|-|-|-|
| 🏋️ treino | `dumbbell` | etiqueta, metas, detalhes |
| 🍕 🎉 🤒 ✈️ 😴 🏥 | `pizza` `party-popper` `thermometer` `plane` `bed` `hospital` | etiquetas do dia |
| 📝 nota | `notebook-pen` | diário, detalhes, relatório semanal |
| ⭐ / ★ / ☆ | `star` (`cheio` quando favorito) | salvas, favoritos, "de sempre" |
| ✍️ descrever | `pencil-line` | Adicionar, menu da refeição |
| 📋 cardápio | `clipboard-list` | Adicionar, menu da refeição |
| 🏷️ rótulo | `tag` | Adicionar |
| 🎤 / ■ ditar | `mic` / `square` | Descrever o que comeu |
| ☁️ Drive | `cloud-upload` | aviso de backup |
| 💾 backup/salvar | `save` | aviso, salvar refeição |
| 📏 dobras | `ruler` | lembrete |
| 🍽 o que comer | `utensils` | Diário, tour |
| ↺ repetir | `rotate-ccw` | chip "Repetir de ontem" |
| ⇅ organizar | `arrow-up-down` | fim das telas, Ajustes, tour |
| ▲ ▼ | `chevron-up` `chevron-down` | Organizar |
| ⚠ / ⚠️ | `triangle-alert` | avisos |
| ✅ / ✓ | `circle-check` / `check` | relatório, proteína por refeição, importação |
| ✕ / ✗ | `x` | remover, erro de importação |
| 📷 | `camera` | fotos |
| 🌐 | `globe` | busca no Open Food Facts |
| 📄 | `file-text` | PDF |
| 🎯 | `target` | peso-alvo, Metas |
| 🧭 coach | `sparkles` | Coach da semana |
| 🔦 | `flashlight` | leitor de código |
| 👆 | `pointer` | tour |
| 🎉 👍 (fim de frase) | — removidos | Progresso, sugestões |
| barra inferior (SVG próprio) | `notebook-text` `scale` `plus` `chart-line` `settings` | navegação |
| refeições (SVG próprio) | `coffee` `utensils` `apple` `soup` `moon-star` `utensils-crossed` | Diário |

## Regras de uso

1. Uma ação preenchida por tela/folha; o resto tonal, contorno ou texto.
2. Toques ≥ 48 px (ícones), ≥ 40 px (chips e botões pequenos).
3. Texto de ajuda permanente é sinal de interface confusa: prefira rótulo melhor, estado vazio ou dica única.
4. Nada de cor viva/neon; cor dos macros só em barras, pontos e roscas.
5. Novos componentes entram aqui antes de entrar nas telas.

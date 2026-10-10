# PROGRESSO

**Etapa atual:** roteiro 2.0 concluído (Pacotes 10–16, v19–v27). Pendente só o backup no Drive (ID OAuth do Artur).

**TBCA completa (v28, 2026-10-10)**
- `dados/tbca_completa.jsonl` (5.668 alimentos, JSON por linha, enviado pelo Artur) lido por `importar_alimentos.py`: macros, sódio e os mesmos micronutrientes da TACO; ids `tbca-<código>`.
- Base: 6.186 itens. 79 nomes repetidos: 52 da TACO trocados pela TBCA **mantendo o id `taco-N`** (campo `tbca` = código), 27 repetidos dentro da TBCA.
- Busca: TBCA uma faixa abaixo da TACO (PESO_TBCA), lista de ingredientes entre parênteses fora do índice, tolerância a erro na TBCA só com a 1ª letra certa. Busca ≤ 12 ms, índice 14 ms, Diário 621 ms (CPU 4×).
- "Mais ricos" sugere só TACO (+ o que já come); pares cru/cozido preferem a TACO. Interpretador: "ovos mexidos" → ovo mexido (TBCA), "brigadeiro" agora reconhecido.
- Testes: 167 aprovados; fluxos OK.

**Roteiro 2.0 (ROTEIRO-2.md; dois por vez, parar ao fim de cada um):**
- [x] Pacote 10 — Sistema de design 2.0 (v19)
- [x] Pacote 11 — Diário redesenhado (v20)
- [x] Pacote 12 — Registro ultrarrápido sem gastar tokens (v21)
- [x] Pacote 13 — Planejamento, receitas e lista de compras (v24)
- [x] Pacote 14 — Inteligência prática (v23)
- [x] Pacote 15 — Atalhos e extras do Android (v26)
- [x] Pacote 16 — Qualidade de produto profissional (v27)

**Pacote 16 (v27, 2026-10-09)**
- Onboarding 2.0 (views/boas-vindas.js): uma pergunta por tela com barra de progresso e explicação de cada cálculo (Mifflin-St Jeor, fator de atividade, 7700 kcal/kg); tela final com meta, TMB/TDEE/ajuste, macros iniciais e gráfico de projeção até o peso-alvo (que vira o alvo do Progresso). "Restaurar backup" na 1ª tela. O formulário antigo ficou para editar o perfil.
- Acessibilidade: auditoria (scripts/auditar_a11y.mjs) em 7 telas + 5 folhas — 426 controles, 0 sem nome para o TalkBack, 0 alvos < 44 px (compactos com área de toque ampliada a 48 px, estilo Material 3); escala de fonte (P10) e reduzir movimento mantidos.
- Desempenho (scripts/medir_desempenho.mjs): Diário pronto em ~450 ms com CPU 4× mais lenta; JS inicial 92 KB gzip (orçamento 120; antes 132) com carregamento sob demanda no Diário; busca ≤ 1,5 ms/consulta e índice 0,5 ms (Web Worker desnecessário: limite do roteiro era 50 ms); imagens com decoding="async"/lazy e miniaturas na grade de fotos corporais.
- Testes de fluxo (scripts/fluxos.mjs, Edge via playwright-core): onboarding → lançar → editar → apagar/desfazer → exportar backup → restaurar → restaurar cópia automática: 7/7. Testes visuais: scripts/capturas.mjs + comparar_capturas.mjs agora lista % de pixels alterados e mudança de altura por tela/tema.
- Integridade: cópia automática local por dia (js/instantaneos.js, banco IndexedDB separado, últimas 7, sem fotos, não conta como backup); Ajustes › Cópias automáticas lista e restaura com confirmação.
- Sobre/licenças: TACO, Open Food Facts (ODbL), Lucide (ISC), fonte do sistema.
- Testes: 165 aprovados. Contraste AA: 84 telas, 0 reprovações.

**Limitações (fim do roteiro 2.0)**
- Sem Health Connect/balança (fora de escopo por decisão do Artur); backup no Drive aguarda o ID OAuth.
- Interpretador e busca dependem de nomes da TACO: pratos prontos (pizza, lasanha, salgados) quase não existem na tabela — viram "não reconhecido" (Buscar/IA) ou Meus alimentos/rótulo.
- Fator cru/cozido e nota de saúde são aproximações declaradas; check-in e padrões precisam de 2–4 semanas de registros e pesagens.
- Compartilhar para o app, atalhos e NFC dependem do WebAPK renovado (até ~1 dia) e do Android; "Falar" usa o serviço de voz do Google (internet). Correção do "Falar" (v22) não foi reproduzida em emulador: aguarda confirmação no S23+.
- Restaurante, receita por link e foto do prato precisam de IA (Chrome Nano ou Gemini na cota gratuita).

**3 próximas ideias**
1. Lembrete opcional e local (sem servidor) de pesagem/registro via Periodic Background Sync ou notificação agendada, desligado por padrão.
2. Base de pratos brasileiros prontos (PF, feijoada, lasanha, coxinha) montada como receitas-padrão a partir de ingredientes TACO, marcadas como estimativa — aumentaria o acerto do interpretador e da busca.
3. Exportar para o nutricionista um relatório semanal automático (PDF/imagem) com check-ins, padrões e qualidade do dia, compartilhado com 1 toque.

**Pacote 15 (v26, 2026-10-09)**
- Atalhos do ícone revistos: Falar (novo), Foto do prato, Código, Peso; depois Água +250 mL e Adicionar (o Android mostra ~4; extras podem não aparecer). Ícones novos (microfone e gota) no gerador.
- Endereços para Modos e Rotinas da Samsung / atalhos: Ajustes › Atalhos, rotinas e jejum lista e copia #adicionar?falar=1, #diario?acao=agua&ml=250|500, peso, foto, código, adição rápida, restaurante, planejar e lista de compras.
- Etiqueta NFC (experimental, só aparece com Web NFC): grava na etiqueta o endereço escolhido (ex.: Água +500 mL).
- Jejum intermitente (opcional, desligado por padrão): bloco no Diário com o tempo desde o último lançamento com horário, meta (12–20 h), hora em que a meta fecha e as últimas 7 noites; sem notificações (js/jejum.js).
- Drive: segue pendente do ID OAuth (passo a passo no README). Fora de escopo por decisão do Artur: balança Bluetooth e dados de saúde.
- Testes: 162 aprovados. Conferido no Edge: cartão de atalhos, água por endereço (+500 mL com desfazer) e bloco de jejum; sem erros.

**Ajuste v25 (pedido do Artur): "O que comer agora" saudável**
- Nota de saúde por alimento (inteligencia.saudeAlimento, heurística declarada): grupo da TACO + proteína e fibra por 100 kcal − sódio alto, gordura dominante, fritura e embutidos; doces, refrigerantes, salgadinhos e álcool = guloseima.
- Candidatos = o que você come na refeição + básicos nutritivos da TACO por tipo de refeição (leve: frutas, iogurte, ovos, aveia, pão integral, queijo minas, castanhas; prato: arroz, feijão, lentilha, frango, patinho, salmão, sardinha, verduras e legumes).
- Sugestões: as primeiras só com alimentos não guloseima, ranqueadas por ajuste aos macros + nota de saúde; no máximo 1 "um agrado" e só se você costuma comer doce. Cartão do Diário mostra a mais nutritiva; o planejador ("Montar a semana") usa a mesma regra, sem agrados.

**Pacote 13 (v24, 2026-10-09)**
- Planejar semana (#plano; Diário › "Planejar a semana" e "+" › Planejar/Lista de compras): grade seg→dom × refeições, totais planejado+comido × meta do dia (dia da semana e treino), "+" por refeição com refeições salvas, receitas ou busca (entra como planejado), toque abre o dia no Diário, limpar planejados com desfazer.
- Montar a semana sem IA (js/planejamento.js › montarSemana): só refeições vazias, a partir de hoje/amanhã; refeição salva que cabe no alvo (±25%) primeiro, senão combinações dos alimentos habituais (otimizador do inteligencia.js) batendo kcal e proteína da parcela da refeição; variedade = no máximo N repetições por refeição.
- Lista de compras: soma o planejado da semana (a partir de hoje), receitas viram ingredientes proporcionais, pronto → cru pelo par cru/cozido da TACO (≈), agrupada pelos grupos da TACO, marcar comprados (guardado) e compartilhar/copiar como texto (WhatsApp).
- Receitas 2.0: importar de texto colado (interpretador local; prefere o ingrediente cru e marca "confira" no ambíguo; lê nome e "rende N porções") ou de link (Gemini com a ferramenta de URL; sem chave pede o texto); peso pronto estimado pelo par cru/cozido com botão "Usar"; Escalar (×0,5/1,5/2/3) e Duplicar; foto da receita.
- Comer fora (views/restaurante.js; "+" › Restaurante e imagem compartilhada): foto do cardápio → IA lista pratos inteiros (estimativa) → o app ranqueia no aparelho pelo que falta para a refeição e lança como Adição rápida marcada "Restaurante (estimativa IA)".
- Testes: 158 aprovados. Contraste: 84 telas, 0 reprovações. Conferido no Edge (Playwright, Gemini simulado): montar semana (14 refeições), lista de compras, restaurante e importação de receita; sem erros no console.

**Pacote 14 (v23, 2026-10-09)**
- Check-in semanal (js/checkin.js + views/checkin-ui.js): a partir de segunda, com dados suficientes, o Diário mostra gasto estimado, tendência e ritmo real × planejado e a meta proposta; Aceitar / Ajustar (stepper) / Manter, com desfazer; histórico em Progresso › Check-ins semanais. Texto local (só números, sem julgar aderência).
- Padrões (js/padroes.js): fins de semana × dias úteis, proteína do café < 0,4 g/kg, sódio por etiqueta, aderência × café antes das 9 h; até 2 por vez, cada um com o número e "Não mostrar este tipo".
- Lacuna de micronutrientes (js/nutricao.js): o mais abaixo da DRI no período → alimentos da TACO mais ricos por 100 kcal (os que você já come primeiro; sem cru exceto frutas/verduras; variados); toque busca o alimento.
- Qualidade do dia (heurística declarada): proteína, fibra, sódio e cobertura de micronutrientes × metas → nota 0–100 e faixa (baixa/média/boa/ótima) nos Detalhes do dia e na página 3 do resumo.
- Pergunte ao app (js/perguntas.js): interpretador local de perguntas ("proteína no jantar nas últimas 2 semanas", "maior sódio do mês"); sem entender e com IA disponível, a IA só converte a pergunta em consulta JSON; a conta roda no aparelho. Perguntas prontas em chips.
- Foto do prato 2.0: até 3 fotos/ângulos, referência de escala (prato de 26 cm / talher), confiança por item e ingredientes ocultos prováveis (óleo, molho, açúcar) como sugestões desmarcadas.
- Código não encontrado → foto do rótulo automaticamente (salva com o código; opção de digitar).
- Testes: 154 aprovados. Contraste: 84 telas, 0 reprovações. Conferido no Edge (Playwright) com 6 semanas simuladas: check-in (aceitar e desfazer), padrões, pergunta, lacuna e qualidade; sem erros no console.

**Pacote 12 (v21, 2026-10-09)**
- Interpretador local (js/frase.js, sem IA): números por extenso ("duzentos e cinquenta", "um e meio", "meia", "um quarto"), frações (½, 1/2, 1,5), g/kg/mL/litro, medidas caseiras (colher, xícara, concha, escumadeira, fatia, unidade, prato, lata…), separadores "e", vírgula, "+", "mais" e "com" (exceto quando o alimento tem "com" no nome, ex.: tapioca com manteiga). Gramas só de porções conhecidas, g/mL ditos ou da última quantidade; medida desconhecida → item "incerto" com as porções em chips. Teste com 46 frases reais.
- Folha "Falar ou escrever" (views/frase-ui.js): interpreta enquanto digita/fala (ditado), chips "Qual destes?" (a escolha fica lembrada), ± por item, trecho não reconhecido → Buscar ou Estimar com IA (só aí a IA entra). Entradas: Adicionar › Falar ou escrever, "+" › Falar (#adicionar?falar=1), menu ⋯ da refeição, busca com cara de frase ("Lançar como frase"), texto compartilhado.
- Busca: sinônimos regionais (porcoes.json › sinonimos: aipim/macaxeira, bergamota/mexerica, jerimum, cacetinho, mussarela, coca…), plural, erro de 1–2 letras (2ª passada), palavra inteira e 1ª palavra valem mais, ranqueamento por frequência + recência + horário (inteligencia.pesosBusca, 60 dias) e escolha anterior para a mesma busca (cru × cozido lembrado, config.escolhas). Resultado em 2 linhas: porção usual · kcal · P/C/G.
- Quantidade: teclado numérico próprio (o do Android não abre; teclado físico também funciona), atalhos ½ · 1 · 1½ · 2 porções, visor grande e prévia "Depois disto: faltam X kcal · Y g de proteína".
- Cesta: "Vários de uma vez" ou segurar um resultado → marcar vários → uma folha com quantidade de cada → Lançar todos.
- Planejados: chave "Planejado" na quantidade (ligada em datas futuras); aparência listrada, não somam nem marcam o dia; botão ✓ "comi" confirma com o horário. Copiar refeição ou dia inteiro para um intervalo de datas (dias da semana escolhidos, como planejado), com desfazer de todos os dias.
- Compartilhar para o app (Web Share Target, verificado na documentação do Chrome): manifest › share_target POST → sw.js guarda no cache "compartilhado" → #compartilhado pergunta: foto do prato, print de pedido, cardápio, rótulo ou receita (imagem) ou abre a frase (texto). Plano B: "Colar imagem copiada" nas folhas de foto, rótulo e cardápio.
- Testes: 149 aprovados. Contraste: 84 telas, 0 reprovações. Conferido no Edge (Playwright): busca com erro, frase, teclado e prévia, cesta, compartilhar texto/imagem via service worker, cópia para 5 dias e confirmação de planejado; sem erros no console.

**Pacote 11 (v20, 2026-10-09)**
- Cartão-herói em 3 páginas (deslizar, pontos, última lembrada; altura acompanha a página): Calorias (anel atual) · Macros em anéis (proteína grande, "faltam X g") · Fibra, sódio e os 3 micronutrientes mais longe da referência. Toque abre Detalhes do dia.
- Refeições compactas: cabeçalho com nome, kcal (toque recolhe/expande, lembrado), "+" e ⋯; mini-barra P/C/G; refeições vazias seguidas viram linhas de um cartão (ícone, nome, chips "Ontem"/"De sempre", "+"). Código de barras saiu das refeições (fica no ⋯, no "+" e na busca). Toque no nome de refeição vazia abre o ⋯ (com "Painel da refeição").
- Linha do tempo (alternável, lembrado): itens por horário; itens novos guardam `ts`; antigos/copiados usam o horário padrão da refeição.
- "+" central: toque = buscar; segurar 450 ms ou arrastar para cima = folha Buscar · Código · Foto · Falar · Adição rápida · Água · Peso (endereços #diario?acao=rapida|agua[&ml=N], #adicionar?falar=1).
- Faixa da semana com ponto verde/âmbar/azul pela aderência (dias passados). "O que comer agora" vira cartão com a 1ª sugestão e Lançar; "Ver mais" abre a folha.
- Texto de ajuda do rodapé removido; dicas únicas em balão (ui.talvezDica). Animações: item novo entra deslizando, refeição recolhe, anéis dos macros enchem (reduzir movimento respeitado).
- "Copiar o dia anterior" só aparece com o dia vazio (continua por refeição no ⋯ e no chip "Ontem").
- Dia com 1 refeição: ~1.400 px (≈ 1,65 tela de 844 px; antes ≈ 2,1). Recorrente: "+" da refeição → "+" do alimento em Recentes = 2 toques.
- Testes: 140 aprovados. Contraste: 84 telas, 0 reprovações. Conferido no Edge (Playwright): páginas, linha do tempo, recolher, folha do "+" e Água; sem erros no console.

**Pacote 10 (v19, 2026-10-09)**
- DESIGN.md: tokens (tipografia 12–40 rem, grade 4 px, raios 8/12/18/28/pílula, elevação 1–3, movimento 120/200/320 ms + curvas, camada de estado 8/12%) e componentes; tabela emoji → ícone.
- Ícones: sprite único icons/sprite.svg (58 ícones Lucide, ISC, 12,8 KB) gerado por scripts/gerar_sprite.mjs só com os usados; helper ic() em js/icones.js; barra inferior, refeições, Ajustes e todas as telas migradas. Zero emoji de interface (teste falha se aparecer; etiquetas do dia agora têm ícone).
- Componentes: botões preenchido/tonal/contorno/texto com camada de estado (desabilitado sem opacidade), chips com ícone, segmentado em pílula, linha de lista (ui.linhaLista), diálogo próprio (ui.confirmar substitui os 16 window.confirm), aviso reposicionado acima do "+" e escuro no tema escuro, esqueleto ao abrir tela lenta (> 150 ms), chave liga/desliga, fileira de atalhos com degradê indicando rolagem.
- Ajustes › Aparência: tamanho do texto 85%–130% (variável raiz, aplicado antes de pintar). Sobre cita Lucide.
- Ferramentas (só desenvolvimento, devDependencies): scripts/capturas.mjs (5 telas × 2 temas, 390 px, dados de tests/semente.js), scripts/comparar_capturas.mjs, scripts/auditar_contraste.mjs (84 telas: 2 temas × 7 paletas × 6 telas, 0 reprovações), scripts/servidor.mjs.
- Testes: 137 aprovados. Conferido no navegador: ícones, aviso, diálogo (Playwright), sem erros no console.

**Roteiro aprovado pelo Artur (fazer TODOS, um pacote por vez):**
- [x] Pacote 1 — Progresso profissional (v10)
- [x] Pacote 2 — Registrar mais rápido (v11): refeições salvas, sugestões pelo horário, dia de treino × descanso, notas/etiquetas do dia, proteína por refeição
- [x] Pacote 3 — IA (v11): foto ligada à TACO (IA só identifica e pesa), foto do rótulo → Meus alimentos, lançar por texto livre
- [x] Pacote 4 (v12) — Relatório PDF para nutricionista, exportar diário CSV, micronutrientes da TACO, fotos de progresso corporal (antes/depois), polimento visual
- [x] Pacote 5 (v13) — telas organizáveis, cores editáveis, Detalhes do dia novo, painel da refeição, mL, ícone novo
- [x] Pacote 6 (v14) — correções e robustez
- [x] Pacote 7 (v15) — inteligência sem custo (o que comer agora, chips de 1 toque, lançamento suspeito, ditado por voz)
- [x] Pacote 8 (v16) — IA gratuita (coach semanal, foto de cardápio/receita, Gemini Nano, limite diário visível)
- [x] Pacote 9 (v17) — acabamento (contraste AA, deslizar dias, anel animado, estados vazios, vibração, tour); Drive aguarda o ID OAuth
- [ ] Backup no Google Drive: ADIADO pelo Artur; passo a passo no README (falta o ID do cliente OAuth)

**Ícone (v18, 2026-10-09)** — a pedido do Artur, volta ao anel clássico (antigo) refinado (opção A entre 4): arco verde ~74% mais grosso, ponto claro na ponta, fundo verde quase preto; maskable com o anel em tamanho cheio dentro da zona segura; atalhos com o mesmo fundo. Gerado por scripts/gerar_icones.mjs.

**Pacote 9 (v17, 2026-10-09)**
- Contraste WCAG AA: auditoria automática no navegador (todo texto visível × fundo efetivo) em Diário, Adicionar, Registros, Progresso, Ajustes, Metas e nas folhas (Detalhes, painel, quantidade, O que comer agora, Organizar), temas claro/escuro e as 7 paletas. Corrigido: dias "abaixo" do calendário no claro (--agua-forte, 3,9 → ≥ 4,5) e "Apagar" ao deslizar no escuro (texto var(--bg), 2,4 → 8). Teste novo confere os pares de tokens dos dois temas.
- Diário: deslizar fora dos itens troca o dia (← amanhã / → ontem, com animação); número e arco do anel animam do valor anterior (só no mesmo dia; sem animação se a página está oculta ou o sistema pede menos movimento); estado vazio ilustrado no dia sem itens.
- Estados vazios com ilustração SVG (js/vazio.js): Adicionar (Recentes/Favoritos/Meus/Receitas), Progresso sem dados, Peso sem registros.
- Vibração leve central (ui.vibrar): avisos com "Desfazer", trocar de dia, chips, lançamentos; desligável em Ajustes › Toque e ajuda.
- Tour de 3 telas no primeiro uso (views/tour.js: Organizar, Detalhes do dia, painel da refeição; deslizar ou Próximo); "Rever o tour do app" em Ajustes.
- Testes: 132 aprovados. Conferido no navegador (375 px): tour, troca de dia por gesto, anel, estados vazios, Ajustes; sem erros.

**Pacote 8 (v16, 2026-10-09)**
- Motores de IA (js/ia.js): IA embutida do Chrome (Prompt API/Gemini Nano, js/ia-local.js) primeiro, se já estiver "available" (offline, sem cota; falhou → Gemini); senão Gemini com a chave; senão a função some (coach e atalho de cardápio) ou pede a chave (foto/texto/rótulo, como antes).
- Limite diário do app (js/ia-cota.js): padrão 20 chamadas ao Gemini por dia (editável em Ajustes › IA, 1–500), contado só em respostas OK; "Gemini: N de L chamadas restantes hoje" no topo das folhas de IA, no coach e em Ajustes. Esgotado → mensagem clara, nada trava.
- Coach da semana (js/coach.js + bloco "coach" no Progresso, segue a semana do relatório): só números agregados (médias × metas, g/kg, aderência, tendência/variação de peso, objetivo/ritmo, semana anterior, contagem de etiquetas; nada de alimentos, notas ou nome) → 3 observações + 1 ação; resposta guardada no kv "coach" (12 semanas), uma chamada por semana, só depois do domingo.
- Foto de cardápio/receita (folhaCardapioIA; atalho "📋 Cardápio/receita" no Adicionar e no menu ⋯ da refeição): cardápio → revisão igual à foto do prato (TACO/IA, gramas editáveis) → lança; receita → cria receita com os ingredientes ligados à TACO/Meus alimentos (porções lidas de "rende N porções") e abre o editor.
- Testes: 130 aprovados. Conferido no navegador (375 px) com Gemini simulado: coach (payload só agregado, cota contada), receita por foto, limite esgotado; sem erros no console.

**Pacote 7 (v15, 2026-10-09)**
- "🍽 O que comer agora" (bloco novo do Diário, só hoje e com ≥ 50 kcal restantes): alvo = parte do restante para a próxima refeição vazia (parcela distRef entre as vazias) ou "Restante do dia"; 3 combinações (gulosa, 1–3 alimentos, porções entre 0,5× e 2× a sua quantidade típica, passo 5 g) com os alimentos frequentes da refeição (30 dias) + favoritos; botão Lançar com desfazer. Lógica pura em js/inteligencia.js; folha em views/sugestao.js.
- Chips de 1 toque nas refeições vazias: "↺ Repetir de ontem (N)" e "⭐ Seu … de sempre (N)" (alimentos em ≥ 40% dos dias com a refeição, mín. 3 dias; some se for igual a ontem).
- Lançamento suspeito: folha de quantidade e Adição rápida pedem 2º toque ("Lançar mesmo assim") para gordura quase pura > 60 g, > 2000 kcal, > 1500 g, > 4× seus gramas usuais ou kcal > 2,5× o seu p95 (≥ 20 itens).
- Ditado: botão 🎤 Ditar no "Descrever o que comeu" (Web Speech API, pt-BR; precisa de internet no Chrome).
- Testes: 125 aprovados. Conferido no navegador (375 px), sem erros no console.

**Pacote 6 (v14, 2026-10-09)**
- navegar() zera onclick/oninput/onchange/onkeydown/onsubmit/onpointer* de #tela antes de cada tela (handler da tela anterior não vaza mais para Registros etc.).
- Alimento sem kcal na fonte (leite integral taco-458 e desnatado UHT taco-457): "⚠ sem dados na TACO" na busca; na quantidade, aviso + "Criar pelo rótulo" (só o nome é aproveitado). Nada inventado.
- Densidade mL→g: campo `densidade` do alimento ou porcoes.json › densidades (leite 1,03; azeite/óleo 0,92; mel 1,42; FAO/INFOODS v2.0); senão 1 g/mL. Quantidade mostra "200 mL (206 g)".
- progresso.js: uma leitura só do diário. Lógica pura do layout em js/layout-ordem.js; ehLiquido/densidadeDe em foods.js.
- Testes: 119 aprovados. Conferido no navegador (375 px), sem erros no console.

**Pacote 5 (v13, 2026-10-09)**
- Telas organizáveis (js/layout.js): Diário, Adicionar (abas e atalhos), Registros (abas) e Progresso têm blocos `data-bloco`; "⇅ Organizar" no fim de cada tela e em Ajustes › Organizar telas: segurar e arrastar (ou ▲▼) e chave para esconder sem apagar. PDF do Progresso agora é o último bloco por padrão.
- Cores (js/cores.js): cor principal (7 paletas + seletor livre) gera toda a paleta clara/escura; uma cor fixa por macro (padrão: proteína verde-escuro, carboidrato amarelo-claro, gordura laranja, tons pastel) e água; aplicadas antes de pintar (localStorage `coresCss`).
- Detalhes do dia (views/detalhe-dia.js): Meta/Consumido/Restante com "kcal", rosca de % das calorias por macro × meta, cartões por nutriente (toque → origem por refeição + alimentos que mais contribuíram), calorias por refeição em barras empilhadas, micronutrientes.
- Painel da refeição (toque no nome da refeição): rosca de macros, consumido × sugerido para a refeição (parcela do dia editável) e itens com barra de macros.
- Quantidade: modo mL (1 mL ≈ 1 g; bebidas abrem em mL), número selecionado ao focar qualquer campo numérico (digitar substitui).
- Diário: gramas e macros sem casas decimais na exibição; água sem "🔥 dias seguidos".
- Ícone: anel em 3 segmentos (cores dos macros) + folha (substituído na v18 pelo anel clássico); gerador portado para Node (scripts/gerar_icones.mjs; o .py foi removido).
- Testes: 113 aprovados. Conferido no navegador (375 px): Diário, Detalhes, origem da proteína, painel da refeição, organizar (arrastar e esconder), paleta azul; sem erros no console.

**Pacote 4 + ajustes (v12)**
- Relatório PDF (views/relatorio-pdf.js): página de impressão A4 com perfil, metas, médias × meta, aderência, peso/tendência/gráfico, gasto real, dobras, circunferências, top alimentos, micronutrientes e anotações; botão no Progresso; "Salvar como PDF" do Chrome.
- CSV do diário (js/exportar.js): itens e totais por dia, em Ajustes.
- Micronutrientes da TACO: importador lê colesterol, Ca, Mg (pág. a) e P, Fe, K, Zn, vit. A (RAE ou retinol), B1, B2, B6, niacina, vit. C (pág. b) → food.mic (585 alimentos); snapshot no item; tabela no detalhe do dia e média no Progresso, com DRI (js/micros.js).
- Fotos de progresso corporal: aba Registros › Fotos (frente/lado/costas), antes × depois com controle deslizante.
- Polimento: transição entre telas.
- Leitor de código: 1920×1080, foco contínuo + toque para focar, zoom inicial 2× com controle, alterna quadro inteiro e faixa central ampliada, aceita EAN/UPC na 1ª leitura se o dígito verificador confere, formato ITF.
- Rótulo: formulário mostra os valores pela porção da tabela (ex.: 28 g); prompt pede a coluna da porção.
- Quantidade: botões −10/−1/+1/+10 g e "porção" de 1 grama sempre disponível (passo de 1).
- Testes: 110 aprovados.

**Pacotes 2 e 3 (v11)**
- Refeições salvas (views/salvas.js, config.refeicoesSalvas); sugestões "Você costuma comer no …" no Adicionar (últimos 30 dias, frequência ≥ 2); dia de treino (etiqueta 'treino' + metas.treinoExtra em carboidratos, no histórico); nota e etiquetas do dia (calendário com ponto, relatório semanal); proteína por refeição (✓ no diário ≥ 0,4 g/kg; seção no Progresso).
- IA: nome no estilo TACO → correspondência na base (foods.correspondencias); TACO vira item normal, sem correspondência vira Adição rápida; peso editável na revisão; "Descrever o que comeu" (texto/voz do teclado); "Ler rótulo" → Meus alimentos (por porção convertido a 100 g).
- Testes: 106 aprovados. Testado no navegador com Gemini simulado.

**Pacote 1 (v10)**
- Progresso: 6 indicadores com comparação com o período anterior; peso com tendência (EMA 0,1, Hacker's Diet), ritmo real × planejado, peso-alvo com barra e projeção de data; gasto real (TDEE adaptativo, 28 dias, confiança) com meta sugerida e botão "Aplicar" (com desfazer); calendário mensal de aderência (toque abre o dia); relatório semanal navegável + imagem para compartilhar (relatorio-img.js); médias × meta em barras + g/kg de proteína; de onde vêm as calorias (por refeição, top 10 kcal/proteína); composição corporal (massa magra × gorda empilhadas + resumo); circunferências com diferença no período.
- Gráficos: arrastar o dedo mostra valores (cursor), linha do alvo, gráfico empilhado.
- Atalho do ícone "Foto do prato" (#adicionar?foto=1, icons/atalho-foto.png).
- Testes: 99 aprovados. Testado no navegador com 6 semanas de dados simulados.

**Melhorias (2026-10-08, v8)**
- Backup no Google Drive (js/drive.js, views/drive-ui.js): GIS token client, escopo drive.file, arquivo único sobrescrito; envio automático com token válido (ao abrir/sair) e aviso "☁️ tocar para enviar" no Diário após 20 h com novidades; restaurar em Ajustes e na tela de boas-vindas. **Depende do Artur:** criar o ID do cliente OAuth (README) e mandar para fixar em `CLIENT_ID_PADRAO`.
- Estimativa por foto (js/ia.js, views/foto-ia.js): Gemini (cota gratuita, chave do Artur no localStorage), JSON com esquema, revisão editável, lança cada alimento como Adição rápida (fonte "Foto (IA)"), guarda a foto na refeição, desfazer. Entradas: menu ⋯ da refeição e botão "Por foto" no Adicionar.
- Testes: 90 aprovados. Fluxo da foto testado com resposta simulada; Drive real ainda não testado (falta o ID do cliente).

**Etapa 6 (acabamento)**
- Visual novo: tokens refinados (claro/escuro), cartões, barra inferior com botão central "+", pílula no item ativo, folhas com animação e alça, toasts, campos com foco destacado, títulos à esquerda.
- Diário: faixa da semana com ponto nos dias registrados, anel em gradiente, linha Meta − Consumido = Restante, cartão de água com "+ copo", 🔥 dias seguidos, ícones por refeição, deslizar item para apagar (com desfazer).
- Adicionar: escolha da refeição no topo, lupa, "+" para lançar com um toque a última quantidade, busca limpa ao voltar.
- Ajustes em lista com ícones; Progresso com indicadores (dias seguidos, % na meta, variação de peso).
- Open Food Facts: busca por nome corrigida (servidor br.*; world.* dava 503 e o novo search não libera CORS); fallback entre servidores.
- Atalhos do ícone com ícones próprios; ícones com antialiasing.
- Robustez: dia muda sozinho se o app ficar aberto após meia-noite; base pré-carregada; dia vazio é removido do banco; refeição sugerida pelo horário ao abrir pela barra.
- README.md. Testes: 86 aprovados.
**Publicado:** https://arturaragao.github.io/app-calorias/ (push automático; o celular se atualiza sozinho).

## Pronto
**Etapa 1** — PWA, temas, TACO 597/597 (`scripts/importar_alimentos.py`), busca, diário com anel e macros, detalhe com fibra/sódio, metas %/g/g·kg e por dia da semana, onboarding, refeições editáveis, IndexedDB + migração.

**Etapa 2**
- Meus alimentos: criar/editar/excluir, campo fonte, valores digitados por qualquer porção (convertidos para 100 g), porção padrão, código de barras opcional; "Duplicar e editar" de alimento da base. Aviso (sem bloqueio) se kcal ≠ 4P+4C+9G.
- Receitas: ingredientes em gramas, nº de porções, peso final pronto opcional; lança por porção, receita inteira ou grama.
- Abas Recentes / Favoritos / Meus / Receitas; busca inclui tudo, Meus/Receitas/Recentes primeiro. Favoritar na tela de quantidade.
- Importar CSV (Configurações): arquivo ou colar, pré-visualização, erros, duplicatas (ignoradas por padrão), modelo para baixar.
- Diário: menu ⋯ por refeição → Adição rápida, Copiar de ontem, Fotos; botão "Copiar o dia anterior inteiro"; desfazer em tudo.
- Foto da refeição: câmera/galeria, comprimida para ≤1280 px JPEG 0,7, observação, ícone 📷 com contagem.
- Atualização automática do app no celular.
- Testes: 58 aprovados.

**Scanner (adiantado da Etapa 5)** — ícone de código de barras na busca e ao lado de "+ Adicionar alimento"; câmera traseira (BarcodeDetector), lanterna, campo manual; resolve local → Open Food Facts → revisar/salvar; busca por nome no OFF.

**Etapa 3**
- Peso: vários por dia (vale o último), gráfico com média, histórico com diferença, apagar/desfazer; atualiza o peso do perfil e, se ligado, recalcula a meta.
- Água: copo/500 ml/valor livre, desfazer, meta e tamanho do copo editáveis, navegação por dia.
- Circunferências: lista editável (adicionar/renomear/remover/reordenar), registro por data, diferença vs anterior, gráfico por medida.
- Dobras: Parrillo 9, Pollock 7, Pollock 3, Durnin-Womersley 4, Personalizado (só soma); último protocolo como padrão; %G, MG, MM, densidade; gráfico só do protocolo escolhido; nota do Parrillo; lembrete mensal desligável (no Diário e em Registros).
- Valores incoerentes pedem confirmação. Testes: 75 aprovados (fórmulas conferidas com referências calculadas à mão).

**Etapa 4**
- Progresso (7/30/90 dias/tudo): peso com média móvel de 7 dias (por calendário), calorias médias por semana × meta (barras), aderência ±10%, médias de macros/fibra/sódio × meta, %G por protocolo e circunferências.
- Backup: exportar JSON (fotos opcionais, compartilhar ou baixar), importar com validação de estrutura/versão e confirmação; lembrete no Diário após 30 dias sem backup; apagar tudo com confirmação dupla; uso de armazenamento e versão em Configurações.
- PWA: atalhos no ícone (Adicionar, Ler código, Registrar peso), aviso ao ficar offline, teste garante que sw.js lista todos os arquivos e que a versão bate.
- Leitor de código não abre mais o teclado sozinho.
- Testes: 85 aprovados.

## Pendências / próximas etapas
- Compartilhar para o app: o Android só passa a listar o app em "Compartilhar" quando renovar o WebAPK (até ~1 dia) ou ao reinstalar.
- Etapa 5: entregue (scanner validado pelo Artur no S23+).
- Atalhos do ícone: o Android só atualiza ícones/atalhos do app instalado quando renova o WebAPK (pode levar até 1 dia); reinstalar resolve na hora.

## Bugs conhecidos
- Limitação da fonte: na TACO, "Leite, de vaca, integral" (taco-458) e "desnatado, UHT" (taco-457) não têm kcal/macros (NA). O app agora avisa e oferece criar pelo rótulo/Open Food Facts.

## Manutenção
- Ícone novo: usar ic('nome-lucide') e rodar `node scripts/gerar_sprite.mjs` (requer `npm i`). Capturas: `node scripts/capturas.mjs <rótulo>`; contraste: `node scripts/auditar_contraste.mjs`.
- Mudou arquivo publicado → incrementar `VERSAO` em `sw.js` **e** em `js/versao.js`; arquivo JS novo → incluir em `ARQUIVOS` (testes conferem os dois).
- Publicar: `git add -A; git commit; git push` com `$env:GCM_INTERACTIVE='always'`.
- Verificações (requer `npm i`): `node tests/run.js` · `node scripts/fluxos.mjs` · `node scripts/auditar_a11y.mjs` · `node scripts/auditar_contraste.mjs` · `node scripts/medir_desempenho.mjs` · `node scripts/capturas.mjs <rótulo>` + `node scripts/comparar_capturas.mjs <antes> <depois>`.

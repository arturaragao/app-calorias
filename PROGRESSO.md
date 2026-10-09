# PROGRESSO

**Etapa atual:** roteiro novo (Pacotes 6–9). Pacotes 6 (v14), 7 (v15) e 8 (v16) entregues; próximo: Pacote 9, após OK do Artur.

**Roteiro aprovado pelo Artur (fazer TODOS, um pacote por vez):**
- [x] Pacote 1 — Progresso profissional (v10)
- [x] Pacote 2 — Registrar mais rápido (v11): refeições salvas, sugestões pelo horário, dia de treino × descanso, notas/etiquetas do dia, proteína por refeição
- [x] Pacote 3 — IA (v11): foto ligada à TACO (IA só identifica e pesa), foto do rótulo → Meus alimentos, lançar por texto livre
- [x] Pacote 4 (v12) — Relatório PDF para nutricionista, exportar diário CSV, micronutrientes da TACO, fotos de progresso corporal (antes/depois), polimento visual
- [x] Pacote 5 (v13) — telas organizáveis, cores editáveis, Detalhes do dia novo, painel da refeição, mL, ícone novo
- [x] Pacote 6 (v14) — correções e robustez
- [x] Pacote 7 (v15) — inteligência sem custo (o que comer agora, chips de 1 toque, lançamento suspeito, ditado por voz)
- [x] Pacote 8 (v16) — IA gratuita (coach semanal, foto de cardápio/receita, Gemini Nano, limite diário visível)
- [ ] Pacote 9 — acabamento (contraste AA, deslizar dias, animações, tour, Drive quando vier o ID OAuth)
- [ ] Backup no Google Drive: ADIADO pelo Artur; passo a passo no README (falta o ID do cliente OAuth)

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
- Ícone: anel em 3 segmentos (cores dos macros) + folha; gerador portado para Node (scripts/gerar_icones.mjs; o .py foi removido).
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
- Etapa 5: entregue (scanner validado pelo Artur no S23+).
- Atalhos do ícone: o Android só atualiza ícones/atalhos do app instalado quando renova o WebAPK (pode levar até 1 dia); reinstalar resolve na hora.

## Bugs conhecidos
- Limitação da fonte: na TACO, "Leite, de vaca, integral" (taco-458) e "desnatado, UHT" (taco-457) não têm kcal/macros (NA). O app agora avisa e oferece criar pelo rótulo/Open Food Facts.

## Manutenção
- Mudou arquivo publicado → incrementar `VERSAO` em `sw.js` **e** em `js/versao.js`; arquivo JS novo → incluir em `ARQUIVOS` (testes conferem os dois).
- Publicar: `git add -A; git commit; git push` com `$env:GCM_INTERACTIVE='always'`.

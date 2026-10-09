# Prompt para o Claude Code — App de Calorias 2.0 (Pacotes 10 a 16)

> Cole tudo abaixo no Claude Code, na pasta do projeto `app-calorias`.

\---

Você vai levar o app de calorias do Artur (v18, Pacotes 1–9 entregues, 132 testes) a um nível de **produto profissional**, à altura de MacroFactor, Cronometer, MyFitnessPal, Lose It, Yazio, Lifesum e Cal AI — mantendo o que já o torna melhor que eles para o Artur: **TACO como base confiável, tudo local, sem conta, sem anúncio e custo zero de tokens no uso diário.**

## 0\. Antes de tudo

1. Leia só `CLAUDE.md`, `PROGRESSO.md` e `DECISOES.md`. Todas as regras de trabalho da seção 0 do `CLAUDE.md` continuam valendo (economia de tokens, editar em vez de reescrever, não abrir `foods.json`, não inventar dados nem fórmulas, testes, `VERSAO` em `sw.js` e `js/versao.js`, parar ao fim de cada pacote e aguardar o OK).
2. Salve este roteiro como `ROTEIRO-2.md` na raiz e acrescente em `PROGRESSO.md` a lista de pacotes abaixo com caixas `\[ ]`.
3. **Custo zero continua sendo lei.** Ordem de preferência para qualquer "inteligência": (1) algoritmo local determinístico → (2) IA do Chrome (Gemini Nano / Prompt API, offline) → (3) Gemini na cota gratuita com a chave do Artur, contando no limite diário que já existe. Nunca API paga, nunca servidor próprio. Toda função de IA precisa ter caminho sem IA ou sumir quando não houver motor.
4. **Sem dependência em tempo de execução.** Ferramentas de desenvolvimento (Playwright, Lighthouse, scripts Node) podem ser usadas só em `scripts/` e `tests/`, nunca carregadas pelo app.
5. Quando algo depender de capacidade do navegador/Android que você não tem certeza que existe em 2026 (Web Share Target, Web NFC, Prompt API), **verifique na documentação oficial antes de implementar** e registre a conclusão em `DECISOES.md`. Se não for viável, implemente o plano B descrito no pacote.

## 1\. Diagnóstico atual (feito em 375–390 px, tema escuro, com dados reais)

Corrija isso ao longo dos pacotes — são os pontos que hoje separam o app de um produto profissional:

* **Ícones misturados:** \~70 emojis (30 diferentes: 🍽 📝 🏋 🎤 ⭐ ✍ 📋 🎯 ☁ 💾…) convivem com ícones de linha na barra inferior e nas refeições. Emoji renderiza diferente em cada versão do Android e fica "amador" ao lado de ícones vetoriais.
* **Ruído repetido:** o ícone de código de barras aparece em **cada** cartão de refeição (5×) e na busca.
* **Refeições vazias ocupam \~150 px cada**; com só o almoço lançado o Diário vira uma rolagem longa de cartões vazios.
* **Texto de ajuda fixo no rodapé do Diário** ("Toque no nome da refeição…") — instrução permanente é sinal de interface que não se explica sozinha.
* **Progresso sem dados** mostra cartões com "—" e parágrafos longos (Gasto real, Peso). Precisa de estado vazio único com "desbloqueia em N dias".
* **Adicionar:** cada resultado ocupa 3 linhas, mostra só kcal/100 g (sem P/C/G), e a fileira de atalhos (Foto, Descrever, Refeições…) é cortada sem indicação de que rola.
* **Toast** claro sobre o tema escuro, cobrindo conteúdo logo acima da barra.
* **Anel do Diário** mostra só calorias; macros ficam em barras finas ao lado — os concorrentes dão mais destaque visual a proteína.

\---

## 2\. Referências de mercado — o que aproveitar de cada um

|App|O que copiar (adaptado ao nosso contexto)|
|-|-|
|**MacroFactor**|Gasto energético adaptativo + **check-in semanal** que propõe a nova meta sem julgar a aderência; teclado numérico próprio na quantidade; "prato"/cesta para adicionar vários alimentos de uma vez; linha do tempo do dia por horário; visual sóbrio e denso em dados.|
|**Cronometer**|Profundidade de micronutrientes com metas e **pontuações de nutrição**; relatório de nutrientes por período; foto com **sugestão de ingredientes ocultos** (óleo, manteiga, molhos); registro por voz; ajuste de tamanho de fonte.|
|**MyFitnessPal** (comprou o Cal AI em mar/2026)|Meal Scan por foto; **AI Coach** com trocas de alimentos, ajuste de porções e escolha em cardápio de restaurante; planejador de refeições com receitas; botão "+" central que abre um menu de ações.|
|**Cal AI**|Registro "aponta e fotografa" com mínimo de atrito; cartões grandes de macros; onboarding de uma pergunta por tela com projeção no final.|
|**Lose It!**|Simplicidade do orçamento diário; sequência (streak) e marcos; Snap It.|
|**Yazio**|Jejum intermitente com timer; planos e receitas.|
|**Lifesum**|Visual "menos clínico" (ilustrações, transições de cor); painel único com comida + água + sono; avaliação da qualidade da refeição.|

**Onde já somos melhores e não podemos perder:** base TACO verificada (concorrentes sofrem com entradas duplicadas de usuários), privacidade total, zero anúncio, metas por dia da semana, dobras cutâneas com 5 protocolos, PDF para nutricionista, telas organizáveis.

\---

## 3\. Roteiro — Pacotes 10 a 16 (dois por vez, parar ao fim de cada um)

### Pacote 10 — Sistema de design 2.0 (fundação visual)

Objetivo: tudo passa a parecer da mesma família, no padrão de um app Android de 2026 (inspiração: Material 3 Expressive, sem copiar o Google).

1. **`DESIGN.md`** curto com os tokens e componentes — vira a referência de todas as telas futuras.
2. **Tokens** em `css/app.css`: escala tipográfica (12 / 14 / 16 / 20 / 28 / 40, pesos 400/500/600/700, números sempre `tabular-nums`), espaçamento em grade de 4 px, raios (8 / 12 / 18 / 28 / pílula), elevação (3 níveis), **movimento** (120 / 200 / 320 ms, curvas padrão e "ênfase"), estados pressionado/foco/desabilitado com camada de cor (state layer) em vez de opacidade.
3. **Ícones:** substituir **todos** os emojis de interface por um **sprite SVG único** (`icons/sprite.svg`, `<svg><use href="icons/sprite.svg#nome">`), gerado por script a partir do **Lucide** (licença ISC — citar em Sobre) só com os ícones usados. Traço 1,75, tamanhos 20/24. Emoji só em conteúdo digitado pelo usuário. Fazer uma tabela emoji → ícone em `DESIGN.md` e um teste que falhe se aparecer emoji novo em `js/` fora de uma lista permitida.
4. **Componentes padronizados** (CSS + helpers em `ui.js`): botão preenchido / tonal / contorno / texto, chip de filtro e de ação, controle segmentado, cartão, linha de lista (1 e 2 linhas), folha inferior, diálogo, **toast reposicionado** (acima da barra, cor `--sup` com sombra alta no escuro, nunca sobre o "+"), estado vazio, **skeleton** de carregamento, campo numérico com stepper.
5. **Tipografia:** avaliar Inter ou Roboto Flex auto-hospedada (woff2 com subconjunto latino, ≤ 60 KB, `font-display: swap`, no cache do SW) contra Roboto do sistema; escolher pelo resultado visual e de desempenho e registrar.
6. **Ajuste de tamanho de fonte** em Ajustes (0,85× a 1,3×, como o Cronometer) via variável raiz.
7. Revisar o tema claro com o mesmo cuidado do escuro e rodar a auditoria de contraste existente em todas as paletas.

**Pronto quando:** zero emoji de interface, todas as telas usando os componentes, contraste AA mantido, testes passando, capturas antes × depois das 5 telas nos dois temas enviadas ao Artur.

### Pacote 11 — Diário redesenhado (a tela que ele mais abre)

1. **Cartão-herói em páginas** (deslizar horizontal com pontos indicadores, última página lembrada):

   * Página 1 — Calorias: anel atual (restante / excesso).
   * Página 2 — **Macros em 3 anéis ou cartões grandes** (proteína em destaque, estilo Cal AI/MacroFactor), com "faltam X g".
   * Página 3 — Fibra, sódio e 2–3 micronutrientes mais distantes da meta no dia.
   * Toque no cartão continua abrindo Detalhes do dia.
2. **Refeições compactas:** cabeçalho com nome, kcal e mini-barra P/C/G; **refeição vazia vira uma linha só** (ícone, nome, "+" e os chips "Repetir de ontem"/"De sempre"). Remover o ícone de código de barras de cada refeição (fica no menu do "+" e na busca).
3. **Modo de visualização** alternável: "Por refeição" (padrão) ou "**Linha do tempo**" (itens por horário, como o MacroFactor). Guardar o horário de lançamento em cada item novo (itens antigos sem horário entram no horário padrão da refeição).
4. **Botão "+" central com ações:** toque = buscar; **toque longo ou arrastar para cima** = folha rápida com Buscar · Código de barras · Foto do prato · Falar · Adição rápida · Água · Peso. Os atalhos do ícone do app continuam.
5. **Faixa da semana** com ponto colorido pela aderência do dia (verde/âmbar/azul, como o calendário do Progresso).
6. "O que comer agora" vira cartão com a **primeira sugestão já visível** e botão Lançar; as outras em "ver mais".
7. Retirar o texto de ajuda do rodapé; dicas aparecem uma única vez como *coachmark* contextual (balão apontando o elemento) e somem.
8. Animações sutis: item novo entra deslizando, refeição expande/recolhe, anel e barras animam (respeitar "reduzir movimento").

**Pronto quando:** um dia com 1 refeição lançada cabe em \~1,5 tela; lançar um alimento recorrente leva ≤ 3 toques; testes e capturas.

### Pacote 12 — Registro ultrarrápido sem gastar tokens

1. **Interpretador local de texto em português** (`js/frase.js`, sem IA): "2 ovos mexidos e 1 pão francês com manteiga", "200 ml de leite", "meia xícara de arroz", "um prato de feijão" → alimento + quantidade + unidade, usando `porcoes.json`, a base e o histórico do Artur. Números por extenso, frações (meia, ½, um quarto), unidades caseiras e "com/e/mais" como separadores. Ambíguo → chips para escolher. Funciona com o ditado por voz que já existe. **IA só como reserva** quando o interpretador não reconhecer. Teste com ≥ 40 frases reais.
2. **Busca mais inteligente:** tolerância a erro de digitação (distância de edição ≤ 1–2 por palavra / trigramas), **sinônimos regionais** (aipim/mandioca/macaxeira, bergamota/mexerica/tangerina, abóbora/jerimum, pão francês/cacetinho… usar lista em `porcoes.json › sinonimos`), lembrar preferência cru × cozido por alimento, ranqueamento por frequência + recência + horário do dia. Resultado em 2 linhas com **kcal e P/C/G da porção usual**, não só por 100 g.
3. **Folha de quantidade com teclado numérico próprio** (sem abrir o teclado do Android), atalhos ½ · 1 · 1½ · 2 porções e prévia ao vivo do impacto no restante do dia ("depois disto: faltam 640 kcal, 38 g de proteína").
4. **Cesta / multi-seleção:** marcar vários alimentos na busca ou nos Recentes e lançar todos de uma vez, ajustando cada quantidade numa única folha.
5. **Compartilhar para o app (Web Share Target):** o Artur compartilha da galeria ou de outro app (print do pedido do iFood, foto de rótulo, foto de cardápio, texto de receita) → o app abre a folha de IA correspondente já com o arquivo/texto. Plano B se não funcionar no WebAPK: botão "Colar/abrir imagem" na folha de IA.
6. **Itens planejados:** lançar refeições futuras como "planejadas" (aparência fantasma, não somam no consumido); confirmar com 1 toque quando comer. Base para o Pacote 13.
7. **Copiar para vários dias** (refeição ou dia inteiro → intervalo de datas, útil para marmitas).

### Pacote 13 — Planejamento, receitas e lista de compras

1. **Planejador semanal** (como o planner do MyFitnessPal/Yazio): grade segunda→domingo × refeições usando refeições salvas, receitas e itens planejados; totais do dia × meta do dia (respeitando metas por dia da semana e dia de treino).
2. **Montar a semana automaticamente sem IA:** estender o otimizador de `js/inteligencia.js` para preencher a semana com os alimentos e refeições habituais dele batendo kcal e proteína, com variedade mínima configurável. Gemini opcional só para "sugerir pratos novos", sempre ligados à TACO.
3. **Lista de compras** agregada a partir do planejado (somar gramas crus, converter receitas em ingredientes, agrupar por grupo da TACO), marcar comprados, compartilhar como texto (WhatsApp).
4. **Receitas 2.0:** importar de texto colado ou de link (link → Gemini lê a página; sem chave, pede para colar o texto); **fator de cocção cru → pronto** quando a TACO tiver o par cru/cozido; duplicar e escalar receita; foto da receita.
5. **Comer fora:** fluxo "Restaurante" que aceita foto do cardápio (já existe) e devolve a **melhor escolha para o que falta no dia** (como o AI Coach do MyFitnessPal), marcando o lançamento como estimativa.

### Pacote 14 — Inteligência prática (determinística primeiro, IA só para redigir)

1. **Check-in semanal estilo MacroFactor** (toda segunda, só se houver dados suficientes): o algoritmo de gasto real que já existe propõe a nova meta com explicação curta (gasto estimado, tendência de peso, ritmo real × planejado); botões Aceitar / Ajustar / Manter; histórico de check-ins em Progresso. O coach Gemini só redige o texto, a conta é local.
2. **Cartões de padrão (sem IA):** detectar e mostrar, no máximo 1–2 por semana, coisas como "fins de semana +420 kcal em média", "proteína do café abaixo de 0,4 g/kg em 5 de 7 dias", "sódio acima da meta nos dias com etiqueta X", "aderência maior quando lança o café antes das 9 h". Cada cartão com o número que o sustenta e um "não mostrar este tipo".
3. **Lacunas de micronutrientes → sugestões de alimentos:** para o nutriente mais abaixo da DRI no período, listar alimentos da TACO (priorizando os que ele já come) ricos nesse nutriente por 100 kcal.
4. **Pontuação de qualidade do dia** (inspirada nas pontuações do Cronometer e na avaliação do Lifesum), declarada como heurística do app: proteína × meta, fibra, sódio, cobertura de micronutrientes. Mostrar como faixa simples, nunca como julgamento.
5. **Perguntas sobre os próprios dados ("Pergunte ao app"):** campo de texto onde ele pergunta "quanto de proteína comi no jantar nas últimas 2 semanas?" → Gemini Nano (ou Gemini) só converte a pergunta numa consulta estruturada (JSON com período, nutriente, refeição, agregação) que é **executada localmente**; nenhum dado do diário sai do aparelho. Sem motor de IA → perguntas prontas em chips.
6. **Foto do prato 2.0:** até 3 fotos/ângulos por refeição; pedir à IA **ingredientes ocultos prováveis** (óleo de preparo, manteiga, molho, açúcar no café) como sugestões desmarcadas; confiança por item; referência de escala opcional (prato de 26 cm / talher).
7. **Código não encontrado → fluxo do rótulo automaticamente** (abre a câmera para a tabela nutricional e salva com o código).

### Pacote 15 — Atalhos e extras do Android

Verifique cada item na documentação oficial antes; registre viabilidade e decisão em `DECISOES.md`. **Fora de escopo, por decisão do Artur:** balança Bluetooth e integração com dados de saúde (Health Connect, Samsung Health, Google Health API) — não implementar nem sugerir.

1. **Atalhos e lançamento rápido:** revisar os 4 atalhos do ícone (Adicionar, Foto, Código, Peso) e adicionar parâmetro de URL para "Falar" e "Água +250 mL" (útil para atalhos do Bixby Routines/Modos e Rotinas da Samsung).
2. **Jejum intermitente (opcional, bloco escondido por padrão):** timer de jejum derivado do último item lançado, meta de horas, histórico — estilo Yazio, sem notificações.
3. **Web NFC (experimental, opcional):** etiqueta NFC na garrafa/geladeira que abre "Água +500 mL" ou "Peso". Só se o Artur quiser.
4. **Backup no Google Drive:** continua pendente do ID OAuth — não mexer, só manter o passo a passo no README.

### Pacote 16 — Qualidade de produto profissional

1. **Onboarding 2.0:** uma pergunta por tela com barra de progresso, explicação curta de cada cálculo e tela final com a meta e um **gráfico de projeção** até o peso-alvo (estilo Cal AI), sem perder a opção "Restaurar backup".
2. **Acessibilidade:** rótulos para TalkBack em todos os botões de ícone, ordem de foco, alvos ≥ 48 px, escala de fonte do Pacote 10, "reduzir movimento".
3. **Desempenho com orçamento:** abrir < 1,5 s no S23+, JS inicial ≤ 120 KB, índice de busca construído fora da thread principal (Web Worker) se medir > 50 ms, imagens de fotos com `decoding="async"` e miniaturas.
4. **Testes visuais e de fluxo (só desenvolvimento):** script Playwright em `scripts/` que abre o app com dados simulados de 6 semanas, percorre Diário/Adicionar/Registros/Progresso/Ajustes nos dois temas a 390 px e salva capturas; comparar com as anteriores e listar diferenças. Fluxos de ponta a ponta: onboarding → lançar → editar → desfazer → backup → restaurar.
5. **Integridade dos dados:** instantâneo automático local diário no IndexedDB (últimos 7), restauração em Ajustes.
6. **Sobre/licenças:** TACO, Open Food Facts (ODbL), Lucide (ISC), fonte (se houver).

\---

## 4\. Prioridade sugerida (impacto × esforço)

1. **P10 Design 2.0** — base de tudo, alto impacto visual.
2. **P11 Diário** — tela mais usada.
3. **P12 Registro rápido** — maior ganho no dia a dia, custo zero.
4. **P14 Inteligência** — diferencial, quase todo local.
5. **P13 Planejamento** — alto valor, esforço maior.
6. **P16 Qualidade** — fazer em paralelo (os testes visuais ajudam desde o P10).
7. **P15 Atalhos e extras** — pequeno, pode ir junto de outro pacote.

## 5\. Entrega de cada pacote

* 3–6 linhas: o que ficou pronto, resultado dos testes, **capturas antes × depois** das telas afetadas (390 px, claro e escuro), roteiro de teste no S23+ com 3–6 ações, o que depende do Artur.
* `PROGRESSO.md`, `DECISOES.md` e `DESIGN.md` atualizados; `VERSAO` incrementada; commit e push como nos pacotes anteriores.
* Ao final do Pacote 16: lista do que ficou limitado e 3 próximas ideias.


# CLAUDE.md — App pessoal de calorias e macros (estilo MyFitnessPal)

Dono: Artur (médico residente de radiologia, português do Brasil). Celular: Samsung Galaxy S23+ (Android, Chrome). Uso só dele: sem login, sem servidor, sem conta.

Objetivo: um app rápido, confiável e bonito para registrar alimentação, metas, peso, água e composição corporal, com **custo zero de tokens/APIs no uso diário**.

\---

## 0\. Regras de trabalho (leia primeiro, sempre valem)

1. **Economize tokens.** Trabalhe por etapas (seção 9). Ao fim de cada etapa: rode os testes, atualize `PROGRESSO.md`, resuma em poucas linhas, diga como testar no celular e **pare** aguardando o OK do Artur.
2. **Retomada entre sessões:** no início de cada sessão leia só `CLAUDE.md`, `PROGRESSO.md` e `DECISOES.md`. Não varra o projeto inteiro. `PROGRESSO.md` = etapa atual, o que está pronto, pendências, bugs conhecidos (curto, atualizado ao fim de cada etapa).
3. **Edite, não reescreva.** Use edições pontuais. Não releia arquivos grandes sem necessidade. **Nunca abra nem imprima `foods.json` inteiro** (use `head`, contagem ou consulta por script).
4. **Dados de alimentos nunca passam pelo chat.** A base é gerada por script a partir de `dados/`.
5. **Atualize os arquivos da pasta do projeto sozinho**, sem pedir confirmação. Pode apagar versões obsoletas.
6. **Só pergunte o que for realmente bloqueante.** As decisões abaixo estão fechadas. Se algo for ambíguo, escolha o padrão sensato, registre uma linha em `DECISOES.md` e siga.
7. **Custo zero no uso diário.** O app NÃO chama IA nem API paga. Só APIs gratuitas e sem chave (Open Food Facts). Exceções autorizadas pelo Artur: estimativa por foto via Gemini (só cota gratuita, chave dele) e backup no Google Drive dele.
8. **Não invente dados nutricionais nem fórmulas.** Valor ausente na fonte = vazio e marcado. Fórmulas científicas: conferir com fonte publicada e citar a referência em comentário no código.
9. Código em seções comentadas, arquivos pequenos, nomes claros. Interface em português do Brasil, vírgula decimal, datas dd/mm/aaaa, semana começando na segunda-feira.
10. Sem dependências externas em tempo de execução, salvo necessidade real (e então de CDN confiável, com fallback offline).

\---

## 1\. Arquitetura

* Web app estático, **HTML + CSS + JS puro (ES modules), sem build**, PWA instalável (manifest + service worker, offline).
* Arquivos separados (mais barato de editar): `index.html`, `css/app.css`, `js/\*.js` (um módulo por área: db, foods, diary, goals, body, progress, scanner, settings, ui, utils), `foods.json`, `porcoes.json`, `manifest.webmanifest`, `sw.js`, `icons/`, `tests/`, `scripts/`, `dados/`.
* **Caminhos relativos** em tudo (o app roda em subpasta do GitHub Pages, ex.: `/app-calorias/`).
* Mobile-first (tela do S23+), boa também no desktop. Alvos de toque ≥ 44 px, poucos toques para registrar uma refeição.
* Navegação: barra inferior fixa com Diário · Adicionar · Registros · Progresso · Configurações (ou equivalente enxuto).
* **Armazenamento:** IndexedDB (registros e fotos), fallback localStorage para o essencial, tratamento de erro se indisponível. Pedir `navigator.storage.persist()`.
* **Versão de esquema** no banco (`schemaVersion`) com função de migração, para atualizações futuras não quebrarem dados antigos.
* **Service worker:** cache versionado; quando houver versão nova, mostrar aviso discreto "Atualização disponível — tocar para atualizar". `foods.json` também em cache para uso offline.
* **Desempenho:** abrir em < 2 s no S23+; busca responde em < 100 ms com 1000+ itens (índice normalizado em memória, carregado uma vez). Lista longa com renderização incremental.

## 2\. Modelo de dados (resumo — ajuste se necessário e registre em DECISOES.md)

* `foods` (base, só leitura): id, nome, grupo, fonte (TBCA/TACO), por 100 g: kcal, prot, carb, gord, fibra, sodio\_mg; porções \[{nome, g}].
* `customFoods`: mesmos campos + origem (manual / Open Food Facts / receita), código de barras opcional.
* `recipes`: nome, ingredientes \[{foodRef, g}], porções, peso final opcional; gera nutrientes por porção.
* `diary` (chave = data local AAAA-MM-DD, nunca UTC): refeições → itens. **Cada item guarda um snapshot dos nutrientes** (editar um alimento depois não altera o histórico).
* `goals`: modo (iguais / por dia da semana), conjuntos de metas, histórico de alterações com data (o progresso usa a meta vigente em cada dia).
* `weights`, `water`, `circumferences` (definições editáveis + medições), `skinfolds` (protocolo, valores, resultado), `photos` (blob comprimido ligado à refeição), `settings`, `meta` (schemaVersion, último backup).

## 3\. Base de alimentos

* Fonte inicial: **TACO 4ª ed. (NEPA/Unicamp)**, planilha oficial gratuita (\~600 alimentos) (coloquei o link do PDF, se tiver que ser planilha me avise. se ficar muito caro em tokens pelo PDF também me avise). Citar a fonte no app ("Sobre") e no README.
* **TBCA (USP) é opcional:** se conseguirem uma fonte de download delas seria ótimo. Se o Artur obtiver a planilha oficialmente e colocá-la em `dados/`, o script deve importá-la também, removendo duplicatas (nome normalizado; manter TBCA em conflito, por ser mais recente).
* **1000+ itens deixa de ser obrigatório.** A base cresce com o uso: alimentos personalizados, Open Food Facts e importação de CSV pelo app (ver 4.2).
* O Artur colocará as planilhas em `dados/` (`.xls`/`.xlsx`/`.csv`, nomes livres). Inspecione só o cabeçalho e algumas linhas, escreva `scripts/importar\_alimentos.py` (reexecutável e idempotente, detecta TACO e/ou TBCA pelo cabeçalho) e gere `foods.json` minificado.
* A planilha TACO vem com cabeçalhos em várias linhas e células mescladas; trate isso no script.
* Limpeza: traço/NA/\* = vazio; "tr" (traço) = 0 para soma, anotado; vírgula decimal; unidades conferidas (sódio em mg). Relatório final do script: total importado, duplicatas removidas, itens com campos faltando.
* **Porções caseiras:** TBCA/TACO não trazem porções completas. Criar `porcoes.json` com porções aproximadas por alimento comum/categoria (colher de sopa, colher de chá, xícara, concha, unidade, fatia, copo, filé médio etc.), **editáveis pelo usuário**, marcadas como aproximadas. Gramas sempre podem ser digitadas.
* Suplementos (whey etc.) não têm categoria própria: entram como alimentos comuns/personalizados.
* **Open Food Facts** (API gratuita, sem chave): busca por nome e por código de barras, online e opcional. Se falhar ou estiver bloqueado, o app segue com a base local e avisa discretamente. Alimento encontrado pode ser salvo em "Meus alimentos" (cache local). Não baixar a base inteira. Respeitar a política da API (User-Agent identificado, sem excesso de requisições).

## 4\. Funcionalidades

### 4.1 Diário (tela inicial)

* Refeições padrão: Café da manhã, Almoço, Lanche, Jantar, Ceia (nomes editáveis, adicionar/remover/reordenar).
* Navegação por dia (anterior/próximo/calendário, botão "Hoje").
* **Anel de calorias "restantes"** (meta − consumido; mostrar excesso de forma clara quando passar), barras de proteína, carboidrato e gordura. **Fibra e sódio só no detalhe do dia**, com suas metas.
* Item: quantidade em gramas ou porção caseira, cálculo automático, editar/apagar fácil (toque para editar, deslizar ou botão para apagar, com "desfazer").
* Totais por refeição e do dia: kcal, P, C, G, fibra, sódio.
* Por refeição: "+ Adicionar alimento" e "Adição rápida" (kcal e macros digitados).
* Copiar refeição ou dia anterior com um toque.
* **Foto da refeição (v1, simples):** anexar foto (câmera ou galeria), comprimir (\~1280 px, JPEG \~0,7) antes de salvar, campo de observação. Sem IA no app. O Artur pode mandar a foto ao Claude no chat para estimar e lançar via "Adição rápida".

### 4.2 Adicionar alimento

* Busca sem acento e sem caixa, ranqueada (começa com > contém > palavras), resultados de Meus alimentos/Recentes primeiro.
* Abas **Recentes / Favoritos / Meus alimentos / Receitas**, scanner de código de barras, item manual.
* **Alimentos personalizados:** criar, editar, excluir (nome, porção, kcal, P, C, G, fibra, sódio). Opção de "duplicar e editar" um alimento da base.
* **Receitas:** combinar alimentos, nº de porções, peso final cozido opcional (para lançar por grama do preparo), salvar como alimento; escalar corretamente.
* Favoritar com um toque. Lembrar a última quantidade usada de cada alimento.
* **Campo "fonte"** em cada alimento personalizado (ex.: TBCA, rótulo, nutricionista), mostrado discretamente na busca.
* **Importar alimentos de CSV** (Configurações): o Artur cola ou escolhe um arquivo com colunas nome; kcal; proteína; carboidrato; gordura; fibra; sódio (por 100 g) e porções opcionais. Pré-visualizar, validar, avisar duplicatas e salvar em "Meus alimentos". Oferecer um modelo de CSV para baixar. Aceitar vírgula decimal e separador `;`.

### 4.3 Metas (flexíveis — requisito central)

* Onboarding: sexo, idade (ou data de nascimento), altura, peso, nível de atividade, objetivo (perder/manter/ganhar) e ritmo semanal (kg/semana).
* TMB por **Mifflin-St Jeor**: homem = 10·peso + 6,25·altura(cm) − 5·idade + 5; mulher = … − 161.
* TDEE = TMB × fator: sedentário 1,2; leve 1,375; moderado 1,55; intenso 1,725; muito intenso 1,9.
* Ajuste diário = ritmo (kg/semana) × 7700 ÷ 7. **Piso de segurança** 1200 kcal (mulher) / 1500 kcal (homem), com aviso.
* Exercício **não** soma ao gasto.
* Macros em **três modos, alternáveis a qualquer momento**: (a) **% das calorias** (padrão 25/45/30, soma deve dar 100%), (b) **gramas fixos** (ex.: 200 g de proteína), (c) **g/kg de peso** (usa o peso mais recente registrado). Conversão 4/4/9 kcal/g. Deixar claro se as calorias derivam dos macros ou o contrário, e mostrar a diferença quando houver inconsistência. Ajuste grama a grama com botões +/− e digitação.
* Metas de **fibra** (g) e **sódio** (mg) editáveis.
* **Modo de metas:** "todos os dias iguais" OU "diferente por dia da semana" (7 conjuntos, com botão "copiar para todos os dias"). Alternar entre modos sem perder dados. Qualquer meta pode ser sobrescrita manualmente.
* Opção (desligável) de recalcular metas quando o peso mudar.

### 4.4 Registros e medidas

* **Peso** (com data, um ou mais por dia; usar o último do dia) e **água** (copos ou ml, tamanho do copo e meta editáveis, botões rápidos).
* **Circunferências** com lista **editável (adicionar/remover/renomear/reordenar)**. Padrão: pescoço, ombro, tórax, cintura, abdômen, quadril, braço D/E (relaxado e contraído), antebraço D/E, coxa D/E, panturrilha D/E. Histórico, gráfico e diferença em relação à medição anterior.
* **Dobras cutâneas e % de gordura (rotina mensal; lembrete opcional, desligável):**

  * Protocolos selecionáveis, com **sítios editáveis**, e **o último usado como padrão**:

    * **9 dobras (Parrillo)** — escolhido pelo Artur: peitoral, abdominal, coxa, bíceps, tríceps, subescapular, suprailíaca, lombar e panturrilha. %G = (soma em mm × 27) ÷ peso em libras.
    * **Pollock 7** (Jackson-Pollock): peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca, coxa. Densidade por sexo e idade; %G por Siri = (495 ÷ DC) − 450.
    * **Pollock 3** (homem: peitoral, abdominal, coxa; mulher: tríceps, suprailíaca, coxa) e **Durnin-Womersley 4** (bíceps, tríceps, subescapular, suprailíaca).
    * **Personalizado:** soma das dobras escolhidas (sem %G, só acompanhamento da soma).
  * Conferir todas as fórmulas em fonte publicada antes de implementar e testar com valores de referência.
  * Mostrar %G, massa gorda, massa magra, soma das dobras e o protocolo usado em cada registro. Não misturar protocolos no mesmo gráfico sem avisar.
  * Nota curta e discreta na tela: o 9 dobras (Parrillo) é menos validado que o Pollock 7; para comparar ao longo do tempo, use sempre o mesmo protocolo e o mesmo avaliador.
* Valores incoerentes (dobra > 80 mm, peso < 30 kg ou > 300 kg, circunferência fora de faixa) pedem confirmação.

### 4.5 Progresso

* Gráficos de peso (com média móvel de 7 dias), média semanal de calorias, aderência à meta (% dos dias dentro de ±10%), macros dos últimos 7/30/90 dias, evolução de %G e circunferências.
* Gráficos em SVG próprios, leves, com toque para ver o valor. Sem biblioteca, salvo necessidade real.

### 4.6 Scanner de código de barras

* BarcodeDetector API (suportada no Chrome Android) com câmera traseira + campo manual de fallback. Consulta Open Food Facts, mostra nutrientes por 100 g e por porção, permite corrigir e salvar. Código já salvo em "Meus alimentos" é resolvido localmente, sem internet.

### 4.7 Configurações

* Perfil, metas, unidades.
* **Tema:** escuro = **verde e preto**; claro = **verde e branco com verdes pastéis**. Visual sóbrio, masculino, agradável, sem cores vivas/neon. Padrão segue o sistema, com opção manual. Cores definidas em variáveis CSS, com contraste acessível (WCAG AA).
* Exportar/importar (JSON; opção de incluir ou não as fotos, por causa do tamanho), editar listas de circunferências/dobras, apagar tudo (confirmação dupla).
* Lembrete discreto de backup a cada \~30 dias (único lembrete do app além do opcional das dobras; sem lembretes de refeição).

## 5\. Regras de cálculo e exibição

* Calcular com precisão total; arredondar só na exibição: kcal inteiras, macros com 1 casa, sódio em mg inteiros.
* Nutrientes do item = valor por 100 g × gramas ÷ 100. Porção caseira converte para gramas antes.
* Totais somam valores não arredondados.

## 6\. Validação de entrada

* Rejeitar negativos, vazios e absurdos (ex.: > 5000 g por item, > 10000 kcal por item, macros incompatíveis com as kcal em alimento personalizado → aviso, não bloqueio). Mensagens de erro claras, em português.
* Importação de backup: validar estrutura e versão antes de gravar; nunca sobrescrever sem confirmação.

## 7\. Testes

* Testes automatizados em `tests/` (Node, sem framework), um comando: `node tests/run.js`.
* Cobrir: TMB, TDEE, ajuste por ritmo, piso de segurança, conversões % ↔ g ↔ g/kg, metas por dia da semana, totais por porção e por dia, escala de receita, Parrillo 9, Pollock 7 e 3, Durnin-Womersley, Siri, chave de data local, importação/exportação JSON, migração de esquema.
* Exemplo de referência: homem, 30 anos, 80 kg, 180 cm → TMB = 1780 kcal; × 1,55 = 2759 kcal.
* Mostrar ao Artur só o resumo (aprovados/reprovados e falhas relevantes).
* Antes de concluir uma etapa, abrir o app num servidor local e conferir que carrega sem erros no console.

## 8\. Hospedagem (GitHub Pages)

* O Artur tem conta no GitHub mas nunca publicou. Ao fim da Etapa 1, entregue um passo a passo bem simples: criar repositório, enviar os arquivos (pelo site ou por git), ativar Pages, abrir o link no Chrome do S23+ e "Adicionar à tela inicial". Inclua os comandos git para atualizações futuras.
* Se ele autorizar, faça você mesmo os commits e o push nas etapas seguintes.

## 9\. Etapas (parar e aguardar OK do Artur ao fim de cada uma)

1. **Núcleo:** estrutura PWA e temas, importação TACO (+TBCA se houver planilha oficial) → `foods.json`, busca, diário com refeições, anel, metas (%, g, g/kg e modo por dia da semana), fibra/sódio no detalhe, onboarding, passo a passo do GitHub Pages.
2. **Receitas, favoritos, recentes, alimentos personalizados (com campo fonte), importação de CSV, adição rápida, copiar dia anterior, foto da refeição (simples).**
3. **Peso, água, circunferências (editáveis), dobras cutâneas e %G (protocolos editáveis).**
4. **Progresso e gráficos, backup exportar/importar + lembrete de 30 dias, PWA offline polido.**
5. **Código de barras + Open Food Facts.**
6. **Acabamento:** polimento visual, acessibilidade, desempenho, revisão de bugs, `README.md` curto (instalar, backup, atualizar a base de alimentos).

**Critério de pronto de cada etapa:** testes passando, app abrindo sem erros, `PROGRESSO.md` atualizado e um roteiro de teste no celular com 3 a 6 ações.

## 10\. Entrega a cada etapa

* 3–6 linhas: o que ficou pronto, resultado dos testes, como testar no celular, o que depende dele.
* Ao final do projeto: o que ficou limitado + 3 sugestões de melhorias futuras.

## 11\. Ideias para o futuro (NÃO implementar agora)

* Estimar porções por foto com IA: (a) mandar a foto ao Claude no chat e lançar à mão (já suportado pela v1); (b) modelo open source no navegador, que reconhece o tipo de prato mas estima gramas mal e deixa o app pesado; (c) API com camada gratuita (ex.: Gemini) com chave dele, exigindo internet e com limite diário.
* Alimentos industrializados populares pré-embutidos (por enquanto vêm via código de barras).
* Sincronização na nuvem, rede social, planos pagos: fora de escopo.


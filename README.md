# Calorias e Macros

App pessoal (PWA) para registrar alimentação, metas, peso, água e composição corporal. Funciona offline, sem conta e sem custo. Os dados ficam no celular (e, se você quiser, num backup no seu Google Drive).

**Endereço:** https://arturaragao.github.io/app-calorias/

## Instalar no celular (Android/Chrome)
1. Abra o endereço no Chrome.
2. Menu ⋮ → **Adicionar à tela inicial** → **Instalar**.
3. Segure o ícone para ver os atalhos: *Adicionar alimento*, *Foto do prato*, *Ler código de barras*, *Registrar peso*.

As atualizações chegam sozinhas: ao abrir o app, ele baixa a versão nova e mostra "App atualizado".

## Backup (importante)
Os dados ficam só neste aparelho. Em **Ajustes › Backup**:
- **Exportar backup** gera um arquivo `.json` (com ou sem fotos). Guarde-o no Drive ou mande por e-mail para você.
- **Importar backup** substitui os dados atuais pelos do arquivo. O app confere o arquivo e pede confirmação antes.
- Se você passar 30 dias sem backup, aparece um lembrete no Diário.

### Backup automático no Google Drive
Em **Ajustes › Backup no Google Drive › Conectar ao Drive**. O app guarda um arquivo `app-calorias-backup.json` no seu Drive (o Drive mantém versões anteriores) e só enxerga esse arquivo (permissão `drive.file`).
- Envia sozinho, uma vez por dia, quando há novidades e o app está aberto. Como o app não tem servidor, o Google só dá acesso por ~1 h por login; quando vence, o Diário mostra **☁️ tocar para enviar** (um toque, sem digitar nada).
- **Celular novo:** instale o app e, na tela de boas-vindas, toque em **Trocou de celular? › Do Google Drive**.

**Configuração única (no PC, ~5 min, grátis):**
1. Abra https://console.cloud.google.com → crie um projeto (ex.: `app-calorias`). Não precisa de faturamento.
2. **APIs e serviços › Biblioteca** → procure **Google Drive API** → **Ativar**.
3. **Google Auth Platform** (tela de permissão OAuth) → **Começar**: nome `Calorias`, seu e-mail, público **Externo**. Em **Público › Usuários de teste**, adicione o seu Gmail.
4. **Clientes › Criar cliente** → tipo **Aplicativo da Web** → em **Origens JavaScript autorizadas** coloque `https://arturaragao.github.io` → **Criar**.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) e cole em Ajustes (ou mande ao Claude para fixar no código, o que faz o botão "Do Google Drive" aparecer já na instalação).
6. No 1º login o Google avisa que o app "não foi verificado": é o seu próprio app → **Continuar**.

## Estimar calorias por foto (IA)
No menu **⋯** de uma refeição → **Estimar por foto (IA)**, ou **Por foto** na tela Adicionar. Tire a foto do prato (e, se quiser, escreva uma dica); o Gemini devolve cada alimento com peso estimado, kcal e macros. Você confere, ajusta e lança: cada alimento entra como **Adição rápida**, e a foto fica guardada na refeição.
- Chave gratuita: https://aistudio.google.com/apikey → **Create API key** → cole em **Ajustes › Estimativa por foto**. A chave fica só no aparelho.
- **Custo zero:** não ative faturamento no projeto. Sem faturamento a API usa só a cota gratuita; passou do limite (por minuto ou por dia), ela recusa e o app avisa — nunca cobra.
- Na cota gratuita o Google pode usar as imagens enviadas para melhorar os produtos dele.
- É uma estimativa (erro típico de 20–30% nas porções): confira os pesos.

## Progresso
- **Tendência de peso:** linha que ignora as oscilações de água e sal; mostra o ritmo real (kg/semana) × o planejado.
- **Peso-alvo:** barra de progresso e data estimada para chegar lá no ritmo atual.
- **Gasto real estimado:** com 2–4 semanas de pesagens e alimentação registradas, calcula quanto você realmente gasta (consumo − variação da tendência × 7700 kcal/kg) e sugere a meta; um toque aplica.
- **Calendário** de aderência, **relatório semanal** (compartilhável como imagem), **de onde vêm as calorias**, **composição corporal** (massa magra × gorda).
- Arraste o dedo sobre os gráficos para ver os valores.

## Relatórios e exportação
- **Relatório em PDF** (Progresso › Relatório em PDF): escolha o período e, na tela de impressão, “Salvar como PDF”. Feito para levar à nutricionista.
- **Diário em CSV** (Ajustes › Exportar diário): item por item ou totais por dia; abre no Excel/Planilhas.

## Base de alimentos
- **TACO 4ª ed.** (NEPA/UNICAMP, 2011): 597 alimentos, valores por 100 g.
- **Open Food Facts**: produtos industrializados, por código de barras ou por nome (precisa de internet). O que você salva vai para *Meus alimentos* e passa a funcionar offline.
- **Meus alimentos, receitas e CSV**: criados por você.

### Atualizar ou ampliar a base (no PC)
1. Coloque a planilha oficial (TACO ou TBCA, `.csv` ou `.xlsx`) ou o PDF da TACO na pasta `dados/`.
2. Rode `python scripts/importar_alimentos.py` (precisa de `pip install pdfplumber`; `openpyxl` para `.xlsx`).
3. O script gera `foods.json` e mostra um relatório (total importado, duplicatas e campos faltando). Em nomes repetidos, a TBCA prevalece sobre a TACO.
4. Incremente `VERSAO` em `sw.js` e em `js/versao.js` e publique.

## Desenvolvimento
- HTML, CSS e JavaScript puros (ES modules), sem build e sem dependências.
- Testes: `node tests/run.js`.
- Ícones do app e dos atalhos: `node scripts/gerar_icones.mjs` (gera os PNG em `icons/`).
- Servidor local: `python -m http.server 8765`, depois abra http://127.0.0.1:8765.
- Publicar: `git add -A`, `git commit -m "…"`, `git push`. O GitHub Pages atualiza em cerca de 1 minuto.
- Ao mudar qualquer arquivo publicado, incremente a versão (`sw.js` e `js/versao.js`). Os testes conferem se as duas batem e se o `sw.js` lista todos os arquivos.
- Andamento e decisões ficam em `PROGRESSO.md` e `DECISOES.md`. A especificação completa está em `CLAUDE.md`.

## Referências
Mifflin-St Jeor (1990) para a TMB; Jackson & Pollock (1978) e Jackson, Pollock & Ward (1980) para 7 e 3 dobras; Durnin & Womersley (1974); Siri (1961). As citações completas estão nos comentários de `js/goals.js` e `js/body.js`.

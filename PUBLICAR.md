# Publicar no GitHub Pages (passo a passo)

O app é só um conjunto de arquivos; o GitHub Pages hospeda de graça. Os seus dados **não** vão para o GitHub — ficam no celular.

## 1. Criar o repositório (uma vez)
1. Entre em https://github.com e clique em **New** (ou "+" → *New repository*).
2. Nome: `app-calorias`. Marque **Public** (Pages gratuito exige público). Não marque nenhuma opção de README. Clique em **Create repository**.

## 2. Enviar os arquivos

**Opção A — pelo site (mais simples):**
1. Na página do repositório recém-criado, clique em **uploading an existing file**.
2. Abra `C:\Users\Artur\app-calorias` no Explorador, selecione **tudo** (Ctrl+A) e arraste para a página. Pastas vão junto.
3. Clique em **Commit changes**.

**Opção B — pelo Git (melhor para atualizar depois).** No PowerShell, dentro da pasta (troque `SEU-USUARIO`):
```bash
cd C:\Users\Artur\app-calorias
```
```bash
git init -b main
```
```bash
git config user.name "Artur"
```
```bash
git config user.email "seu-email-do-github"
```
```bash
git add .
```
```bash
git commit -m "Etapa 1"
```
```bash
git remote add origin https://github.com/SEU-USUARIO/app-calorias.git
```
```bash
git push -u origin main
```
Na primeira vez abre uma janela de login do GitHub — entre com a sua conta.

## 3. Ativar o Pages
1. No repositório: **Settings** → **Pages** (menu à esquerda).
2. Em *Source*: **Deploy from a branch**; *Branch*: **main** e pasta **/ (root)** → **Save**.
3. Espere 1–2 minutos. O link aparece no topo: `https://SEU-USUARIO.github.io/app-calorias/`.

## 4. Instalar no S23+
1. Abra o link no **Chrome** do celular.
2. Menu ⋮ → **Adicionar à tela inicial** (ou **Instalar app**) → **Instalar**.
3. Abra pelo ícone. Depois do primeiro acesso funciona offline.

## 5. Atualizações futuras (Git)
```bash
cd C:\Users\Artur\app-calorias
```
```bash
git add .
```
```bash
git commit -m "Etapa 2"
```
```bash
git push
```
No celular aparece **"Atualização disponível — Atualizar"**; toque para carregar a versão nova.
(Se eu fizer os commits por você, basta autorizar.)

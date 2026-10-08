// sw.js — cache versionado do app (offline). Ao mudar arquivos, incremente VERSAO.
const VERSAO = 'v4';
const CACHE = `calorias-${VERSAO}`;
const ARQUIVOS = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'foods.json', 'porcoes.json',
  'js/app.js', 'js/db.js', 'js/diary.js', 'js/foods.js', 'js/goals.js', 'js/state.js', 'js/ui.js', 'js/utils.js',
  'js/custom.js', 'js/csv.js', 'js/photos.js', 'js/off.js', 'js/views/scanner.js',
  'js/views/diario.js', 'js/views/adicionar.js', 'js/views/quantidade.js', 'js/views/metas.js',
  'js/views/onboarding.js', 'js/views/config.js', 'js/views/embreve.js',
  'js/views/alimento-form.js', 'js/views/receita.js', 'js/views/fotos.js', 'js/views/importar.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache HTTP do GitHub Pages (garante arquivos da versão nova)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));   // atualização automática (DECISOES.md)
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('calorias-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'pular-espera') self.skipWaiting(); });

// cache primeiro para arquivos do app; requisições externas (Open Food Facts, Etapa 5) vão direto à rede
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() =>
    e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});

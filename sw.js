// sw.js — cache versionado do app (offline). Ao mudar arquivos, incremente VERSAO.
const VERSAO = 'v23';   // manter igual a js/versao.js
const CACHE = `calorias-${VERSAO}`;
const ARQUIVOS = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'foods.json', 'porcoes.json',
  'js/app.js', 'js/db.js', 'js/diary.js', 'js/foods.js', 'js/goals.js', 'js/state.js', 'js/ui.js', 'js/utils.js',
  'js/custom.js', 'js/csv.js', 'js/photos.js', 'js/off.js', 'js/views/scanner.js',
  'js/body.js', 'js/chart.js', 'js/views/registros.js', 'js/views/reg-peso.js', 'js/views/reg-agua.js',
  'js/views/reg-medidas.js', 'js/views/reg-dobras.js',
  'js/views/diario.js', 'js/views/adicionar.js', 'js/views/quantidade.js', 'js/views/metas.js',
  'js/views/onboarding.js', 'js/views/config.js', 'js/views/progresso.js',
  'js/progress.js', 'js/backup.js', 'js/versao.js',
  'js/views/alimento-form.js', 'js/views/receita.js', 'js/views/fotos.js', 'js/views/importar.js',
  'js/ia.js', 'js/drive.js', 'js/views/foto-ia.js', 'js/views/drive-ui.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/atalho-adicionar.png', 'icons/atalho-codigo.png', 'icons/atalho-peso.png', 'icons/atalho-foto.png',
  'js/views/relatorio-img.js', 'js/views/salvas.js',
  'js/micros.js', 'js/exportar.js', 'js/views/micros-ui.js', 'js/views/reg-fotos.js', 'js/views/relatorio-pdf.js',
  'js/layout.js', 'js/layout-ordem.js', 'js/inteligencia.js', 'js/voz.js', 'js/views/sugestao.js', 'js/ia-cota.js', 'js/ia-local.js', 'js/coach.js', 'js/vazio.js', 'js/views/tour.js', 'js/cores.js', 'js/views/detalhe-dia.js',
  'js/icones.js', 'icons/sprite.svg', 'js/views/acoes.js', 'js/frase.js',
  'js/views/frase-ui.js', 'js/views/cesta.js', 'js/views/copiar-dias.js', 'js/views/compartilhado.js',
  'js/checkin.js', 'js/nutricao.js', 'js/padroes.js', 'js/perguntas.js', 'js/views/checkin-ui.js', 'js/views/dados.js', 'js/views/inteligencia-ui.js',
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

// Compartilhar para o app (Web Share Target, manifest › share_target): o Android manda um POST com texto/imagens;
// guardamos no cache "compartilhado" e abrimos o app em #compartilhado, que lê e oferece o que fazer.
async function receberCompartilhado(req) {
  try {
    const f = await req.formData();
    const c = await caches.open('compartilhado');
    for (const k of await c.keys()) await c.delete(k);
    const arqs = f.getAll('imagens').filter((x) => x && typeof x !== 'string' && x.size);
    await Promise.all(arqs.slice(0, 3).map((x, i) => c.put(`./compartilhado/${i}`, new Response(x, { headers: { 'content-type': x.type || 'image/jpeg' } }))));
    const meta = { titulo: f.get('title') || '', texto: f.get('text') || '', url: f.get('url') || '', imagens: Math.min(arqs.length, 3), em: Date.now() };
    await c.put('./compartilhado/meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
  } catch (err) { /* abre o app mesmo assim; a tela avisa que não recebeu nada */ }
  return Response.redirect('./#compartilhado', 303);
}

// cache primeiro para arquivos do app; requisições externas (Open Food Facts, Etapa 5) vão direto à rede
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/compartilhar')) {
    e.respondWith(receberCompartilhado(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() =>
    e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});

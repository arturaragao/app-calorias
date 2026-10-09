// servidor estático mínimo (só desenvolvimento): node scripts/servidor.mjs <pasta> <porta>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const raiz = process.argv[2], porta = Number(process.argv[3] || 8080);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = normalize(join(raiz, p));
  if (!arq.startsWith(normalize(raiz))) { res.writeHead(403); return res.end(); }
  try { const b = await readFile(arq); res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(b); }
  catch { res.writeHead(404); res.end('404'); }
}).listen(porta, () => console.log('ok http://localhost:' + porta));

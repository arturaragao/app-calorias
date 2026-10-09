// views/reg-fotos.js — fotos de progresso corporal (frente/lado/costas por data) e comparação antes × depois.
// Guardadas na store "photos" com chave "corpo|AAAA-MM-DD" -> { fotos: [{ id, blob, pose, ts }] } (entram no backup com fotos).

import { db } from '../db.js';
import { comprimir } from '../photos.js';
import { lerPesos } from './reg-peso.js';
import { $, $$, esc, aviso, abrirFolha, fecharFolha, ICONES } from '../ui.js';
import { chaveData, fmtData, fmtNum, uid } from '../utils.js';

export const POSES = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas']];
const PREFIXO = 'corpo|';
const nomePose = (p) => POSES.find(([v]) => v === p)?.[1] || p;

async function lerTudo() {
  return (await db.getAll('photos')).filter(([k]) => k.startsWith(PREFIXO))
    .map(([k, v]) => ({ data: k.slice(PREFIXO.length), fotos: v.fotos })).filter((r) => r.fotos.length)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}
async function gravar(data, fotos) {
  if (fotos.length) await db.put('photos', PREFIXO + data, { fotos }); else await db.del('photos', PREFIXO + data);
}

let urls = [];
const url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const liberar = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };

export async function render(el) {
  liberar();
  const regs = await lerTudo();
  const pesos = await lerPesos();
  const pesoEm = (data) => pesos.find((p) => p.data === data)?.kg;
  const comPose = (pose) => regs.filter((r) => r.fotos.some((f) => f.pose === pose));
  let pose = POSES.find(([p]) => comPose(p).length >= 2)?.[0] || 'frente';

  el.innerHTML = `<button class="btn prim bloco" data-nova>${ICONES.camera} Adicionar fotos de hoje</button>
    <div class="card" id="comp" style="margin-top:12px"></div>
    <div id="lista"></div>
    <p class="mudo">Dica: mesma luz, mesmo lugar, mesma distância e de manhã. As fotos ficam só neste aparelho
      (e no backup, se você marcar “incluir fotos”).</p>`;

  const desenharComp = () => {
    const ds = comPose(pose);
    const c = $('#comp', el);
    if (ds.length < 2) {
      c.innerHTML = `<h2 style="margin-bottom:6px">Antes × depois</h2>
        <p class="mudo" style="margin:0">Com fotos de duas datas na mesma posição, a comparação aparece aqui.</p>`;
      return;
    }
    const opts = (sel) => ds.map((r) => `<option value="${r.data}" ${r.data === sel ? 'selected' : ''}>${fmtData(r.data)}</option>`).join('');
    const a = c.dataset.a && ds.some((r) => r.data === c.dataset.a) ? c.dataset.a : ds.at(-1).data;
    const b = c.dataset.b && ds.some((r) => r.data === c.dataset.b) ? c.dataset.b : ds[0].data;
    const foto = (d) => ds.find((r) => r.data === d).fotos.filter((f) => f.pose === pose).at(-1);
    const pa = pesoEm(a), pb = pesoEm(b);
    c.innerHTML = `<div class="card-tit"><h2>Antes × depois</h2>
        <select id="c-pose" style="width:auto;min-height:40px">${POSES.map(([v, r]) => `<option value="${v}" ${v === pose ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="grade2"><label class="campo"><span>Antes</span><select id="c-a">${opts(a)}</select></label>
        <label class="campo"><span>Depois</span><select id="c-b">${opts(b)}</select></label></div>
      <div class="antes-depois" id="ad"><img src="${url(foto(a).blob)}" alt="Antes, ${fmtData(a)}">
        <img src="${url(foto(b).blob)}" alt="Depois, ${fmtData(b)}" class="depois" style="clip-path:inset(0 0 0 50%)">
        <div class="divisa" style="left:50%"></div><span class="rot-a">${dd(a)}</span><span class="rot-b">${dd(b)}</span></div>
      <input type="range" id="c-r" min="0" max="100" value="50" aria-label="Arraste para comparar" style="width:100%">
      ${pa != null && pb != null ? `<p class="mudo" style="margin:4px 0 0">Peso: ${fmtNum(pa)} → ${fmtNum(pb)} kg (${pb - pa > 0 ? '+' : pb - pa < 0 ? '−' : ''}${fmtNum(Math.abs(Math.round((pb - pa) * 10) / 10))} kg)</p>` : ''}`;
    $('#c-r', c).oninput = (e) => {
      const v = e.target.value;
      $('.depois', c).style.clipPath = `inset(0 0 0 ${v}%)`;
      $('.divisa', c).style.left = v + '%';
    };
    $('#c-pose', c).onchange = (e) => { pose = e.target.value; delete c.dataset.a; delete c.dataset.b; desenharComp(); };
    $('#c-a', c).onchange = (e) => { c.dataset.a = e.target.value; desenharComp(); };
    $('#c-b', c).onchange = (e) => { c.dataset.b = e.target.value; desenharComp(); };
  };
  const dd = (d) => fmtData(d).slice(0, 5);

  $('#lista', el).innerHTML = regs.length ? regs.map((r) => `<div class="card"><div class="card-tit"><h2>${fmtData(r.data)}</h2>
      ${pesoEm(r.data) != null ? `<span class="mudo num">${fmtNum(pesoEm(r.data))} kg</span>` : ''}</div>
      <div class="fotos-corpo">${r.fotos.map((f) => `<button data-ver="${r.data}|${f.id}" aria-label="${nomePose(f.pose)} em ${fmtData(r.data)}">
        <img src="${url(f.blob)}" alt=""><span>${nomePose(f.pose)}</span></button>`).join('')}</div></div>`).join('')
    : '<p class="mudo" style="text-align:center;margin:18px 0">Nenhuma foto ainda.</p>';
  desenharComp();

  el.onclick = async (e) => {
    if (e.target.closest('[data-nova]')) return folhaNova(() => render(el));
    const v = e.target.closest('[data-ver]');
    if (v) {
      const [data, id] = v.dataset.ver.split('|');
      const r = regs.find((x) => x.data === data), f = r.fotos.find((x) => x.id === id);
      const p = abrirFolha(`${nomePose(f.pose)} · ${fmtData(data)}`, `<img src="${url(f.blob)}" alt="" style="width:100%;border-radius:12px">
        <button class="btn perigo bloco" data-apagar style="margin-top:10px">Apagar foto</button>`);
      $('[data-apagar]', p).onclick = async () => {
        if (!confirm('Apagar esta foto?')) return;
        const antes = r.fotos;
        await gravar(data, antes.filter((x) => x.id !== id));
        fecharFolha(); render(el);
        aviso('Foto apagada', { acao: async () => { await gravar(data, antes); render(el); } });
      };
    }
  };
}

function folhaNova(depois) {
  const p = abrirFolha('Fotos de progresso', `<label class="campo"><span>Data</span><input type="date" name="data" value="${chaveData()}" max="${chaveData()}"></label>
    ${POSES.map(([v, r]) => `<div class="linha pose-linha" data-pose="${v}"><b style="flex:1">${r}</b><span class="mudo" data-ok></span>
      <label class="btn peq">${ICONES.camera} Câmera<input type="file" accept="image/*" capture="user" hidden></label>
      <label class="btn peq suave">Galeria<input type="file" accept="image/*" hidden></label></div>`).join('')}
    <p class="mudo">Câmera frontal (selfie no espelho) ou a traseira com timer da galeria. Uma foto por posição; tirar de novo substitui.</p>
    <button class="btn prim bloco" data-fim>Concluir</button>`, { foco: false });
  p.onchange = async (e) => {
    const inp = e.target.closest('input[type=file]');
    if (!inp?.files[0]) return;
    const pose = inp.closest('[data-pose]').dataset.pose, data = $('[name=data]', p).value || chaveData();
    try {
      const blob = await comprimir(inp.files[0]);
      const atual = ((await db.get('photos', PREFIXO + data)) || { fotos: [] }).fotos.filter((f) => f.pose !== pose);
      atual.push({ id: uid(), blob, pose, ts: Date.now() });
      await gravar(data, atual);
      inp.closest('[data-pose]').querySelector('[data-ok]').textContent = '✓ salva';
      navigator.vibrate?.(10);
    } catch (err) { console.error(err); aviso('Não consegui salvar essa foto.'); }
    inp.value = '';
  };
  $('[data-fim]', p).onclick = () => { fecharFolha(); depois(); };
}

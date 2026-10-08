#!/usr/bin/env python3
"""gerar_icones.py — gera os ícones do app e dos atalhos (PNG, sem dependências, com antialiasing).

icons/icon-192.png, icon-512.png, icon-maskable-512.png  — anel de progresso (marca do app)
icons/atalho-adicionar.png, atalho-codigo.png, atalho-peso.png (192 px) — atalhos do ícone
"""
import math, os, struct, zlib

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4                                   # supersampling 4x4
FUNDO_A, FUNDO_B = (16, 36, 25), (9, 20, 14)   # gradiente verde-escuro
VERDE, TRILHO, BRANCO = (126, 204, 152), (40, 66, 50), (236, 245, 238)


class Tela:
    def __init__(self, tam):
        self.t = tam * SS
        self.px = [[None] * self.t for _ in range(self.t)]

    def pintar(self, dentro, cor):
        """dentro(x, y) em coordenadas 0..1."""
        t = self.t
        for y in range(t):
            fy = (y + .5) / t
            linha = self.px[y]
            for x in range(t):
                if dentro((x + .5) / t, fy):
                    linha[x] = cor

    def salvar(self, caminho, fundo_cheio=True, raio_canto=0.22):
        t, n = self.t, self.t // SS
        linhas = []
        for Y in range(n):
            linha = bytearray([0])
            for X in range(n):
                r = g = b = a = 0
                for dy in range(SS):
                    for dx in range(SS):
                        x, y = X * SS + dx, Y * SS + dy
                        fx, fy = (x + .5) / t, (y + .5) / t
                        dentro = fundo_cheio or canto_ok(fx, fy, raio_canto)
                        if not dentro:
                            continue
                        c = self.px[y][x] or gradiente(fy)
                        r += c[0]; g += c[1]; b += c[2]; a += 255
                k = SS * SS
                linha += bytes((r // k if a else 0, g // k if a else 0, b // k if a else 0, a // k))
            linhas.append(bytes(linha))
        def bloco(tipo, dados):
            return struct.pack('>I', len(dados)) + tipo + dados + struct.pack('>I', zlib.crc32(tipo + dados) & 0xffffffff)
        ihdr = struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)
        with open(caminho, 'wb') as f:
            f.write(b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', ihdr) + bloco(b'IDAT', zlib.compress(b''.join(linhas), 9)) + bloco(b'IEND', b''))


def gradiente(fy):
    return tuple(int(a + (b - a) * fy) for a, b in zip(FUNDO_A, FUNDO_B))


def canto_ok(x, y, r):
    """Quadrado de cantos arredondados (para ícones não-mascaráveis)."""
    cx = min(max(x, r), 1 - r); cy = min(max(y, r), 1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def anel(tela, escala, frac=0.72):
    re, ri = 0.34 * escala, 0.245 * escala
    def em(x, y, so_valor):
        d = math.hypot(x - .5, y - .5)
        if not (ri <= d <= re):
            # ponta arredondada no fim do arco
            return False
        ang = (math.degrees(math.atan2(x - .5, .5 - y)) + 360) % 360
        return (ang <= 360 * frac) == so_valor
    tela.pintar(lambda x, y: em(x, y, False), TRILHO)
    tela.pintar(lambda x, y: em(x, y, True), VERDE)
    # pontas arredondadas do arco
    rm, rp = (re + ri) / 2, (re - ri) / 2
    for ang in (0, 360 * frac):
        a = math.radians(ang)
        px, py = .5 + rm * math.sin(a), .5 - rm * math.cos(a)
        tela.pintar(lambda x, y, px=px, py=py: math.hypot(x - px, y - py) <= rp, VERDE)


def mais(tela):
    w, l = 0.09, 0.30
    tela.pintar(lambda x, y: (abs(x - .5) <= w / 2 and abs(y - .5) <= l) or (abs(y - .5) <= w / 2 and abs(x - .5) <= l), BRANCO)
    tela.pintar(lambda x, y: 0.36 <= math.hypot(x - .5, y - .5) <= 0.40, VERDE)


def codigo(tela):
    barras = [(0.22, .035), (0.28, .02), (0.33, .05), (0.41, .02), (0.46, .035), (0.53, .055), (0.62, .02), (0.67, .04), (0.74, .02)]
    tela.pintar(lambda x, y: 0.30 <= y <= 0.70 and any(x0 <= x <= x0 + w for x0, w in barras), BRANCO)
    # cantos de mira
    def canto(x, y):
        e, c = 0.025, 0.12
        for cx, cy, sx, sy in ((.17, .2, 1, 1), (.83, .2, -1, 1), (.17, .8, 1, -1), (.83, .8, -1, -1)):
            dx, dy = (x - cx) * sx, (y - cy) * sy
            if (0 <= dx <= c and 0 <= dy <= e) or (0 <= dy <= c and 0 <= dx <= e):
                return True
        return False
    tela.pintar(canto, VERDE)


def balanca(tela):
    # corpo arredondado
    def corpo(x, y):
        r = 0.08
        if not (0.2 <= x <= 0.8 and 0.24 <= y <= 0.8):
            return False
        cx = min(max(x, 0.2 + r), 0.8 - r); cy = min(max(y, 0.24 + r), 0.8 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    tela.pintar(corpo, BRANCO)
    # mostrador
    tela.pintar(lambda x, y: math.hypot(x - .5, y - .46) <= 0.15 and y <= 0.46, FUNDO_A)
    # ponteiro
    def ponteiro(x, y):
        ax, ay, bx, by = .5, .46, .58, .36
        t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
        return math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) <= 0.018
    tela.pintar(ponteiro, VERDE)


os.makedirs(os.path.join(RAIZ, 'icons'), exist_ok=True)
for nome, tam, esc, cheio in (('icon-192.png', 192, 1, False), ('icon-512.png', 512, 1, False), ('icon-maskable-512.png', 512, .8, True)):
    t = Tela(tam); anel(t, esc); t.salvar(os.path.join(RAIZ, 'icons', nome), fundo_cheio=cheio)
for nome, fn in (('atalho-adicionar.png', mais), ('atalho-codigo.png', codigo), ('atalho-peso.png', balanca)):
    t = Tela(192); fn(t); t.salvar(os.path.join(RAIZ, 'icons', nome), fundo_cheio=False, raio_canto=0.5)
print('ícones gerados')

#!/usr/bin/env python3
"""gerar_icones.py — gera icons/icon-192.png, icon-512.png e icon-maskable-512.png (sem dependências)."""
import math, os, struct, zlib

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNDO, ANEL, TRILHO = (13, 21, 16), (116, 196, 143), (34, 53, 42)

def png(caminho, tam, escala_anel):
    linhas = []
    c = tam / 2
    r_ext, r_int = tam * 0.36 * escala_anel, tam * 0.26 * escala_anel
    for y in range(tam):
        linha = bytearray([0])
        for x in range(tam):
            dx, dy = x + .5 - c, y + .5 - c
            d = math.hypot(dx, dy)
            cor = FUNDO
            if r_int <= d <= r_ext:
                ang = (math.degrees(math.atan2(dx, -dy)) + 360) % 360   # 0° no topo, sentido horário
                cor = ANEL if ang <= 270 else TRILHO
            linha += bytes(cor)
        linhas.append(bytes(linha))
    def bloco(tipo, dados):
        return struct.pack('>I', len(dados)) + tipo + dados + struct.pack('>I', zlib.crc32(tipo + dados) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', tam, tam, 8, 2, 0, 0, 0)
    with open(caminho, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', ihdr) + bloco(b'IDAT', zlib.compress(b''.join(linhas), 9)) + bloco(b'IEND', b''))

os.makedirs(os.path.join(RAIZ, 'icons'), exist_ok=True)
png(os.path.join(RAIZ, 'icons', 'icon-192.png'), 192, 1)
png(os.path.join(RAIZ, 'icons', 'icon-512.png'), 512, 1)
png(os.path.join(RAIZ, 'icons', 'icon-maskable-512.png'), 512, 0.8)   # margem para a máscara do Android
print('ícones gerados')

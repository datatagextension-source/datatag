"""Draws the DataTag icon (a luggage tag with a red "ping" dot) at 16/48/128px.

No dependencies: shapes are rasterised with 4x4 supersampling and written as PNG by hand.
Run from the repo root: python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (22, 24, 29)
TAG = (255, 255, 255)
DOT = (217, 48, 37)

# Shapes in a 128-unit coordinate space, painted in order.
TAG_POLY = [(20, 64), (50, 30), (106, 30), (106, 98), (50, 98)]


def rounded_square(x, y, r=28, size=128):
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_poly(x, y, poly):
    inside = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def circle(x, y, cx, cy, r):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def color_at(x, y):
    """Returns RGBA for a point in 128-unit space."""
    if not rounded_square(x, y):
        return (0, 0, 0, 0)
    if circle(x, y, 100, 32, 15):
        return (*DOT, 255)
    if circle(x, y, 100, 32, 21):
        return (*BG, 255)
    if in_poly(x, y, TAG_POLY) and not circle(x, y, 46, 64, 9):
        return (*TAG, 255)
    return (*BG, 255)


def render(size, ss=4):
    rows = []
    scale = 128 / size
    for py in range(size):
        row = bytearray([0])  # PNG filter: none
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px + (sx + 0.5) / ss) * scale, (py + (sy + 0.5) / ss) * scale)
                    a = c[3]
                    acc[0] += c[0] * a
                    acc[1] += c[1] * a
                    acc[2] += c[2] * a
                    acc[3] += a
            n = ss * ss
            alpha = acc[3] / n
            rgb = [round(acc[i] / acc[3]) if acc[3] else 0 for i in range(3)]
            row += bytes([*rgb, round(alpha)])
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


if __name__ == "__main__":
    out = Path("icons")
    out.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(out / f"icon{size}.png", size, render(size))
        print(f"icons/icon{size}.png")

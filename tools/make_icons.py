#!/usr/bin/env python3
"""Compose PWA app icons from the Iwakaze rikishi art (head & shoulders crop).

Outputs (assets/icons/):
  icon-192.png          any-purpose, rounded, vermilion border
  icon-512.png          any-purpose, rounded, vermilion border
  icon-maskable-512.png maskable (content inside the 80% safe zone, square)
  apple-touch-icon.png  180×180 opaque (iOS rounds it itself)
Run: python3 tools/make_icons.py
"""
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"
PARCH = (240, 230, 210)      # parchment #f0e6d2
VERMILION = (178, 58, 46)    # seal red #b23a2e

_src = Image.open(ROOT / "art" / "characters" / "01_iwakaze.png").convert("RGB")
_w = _src.width
portrait = _src.crop((0, 0, _w, _w))      # square from the top: face + folded arms


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def build(size, frac, border=True, radius=0):
    img = Image.new("RGB", (size, size), PARCH)
    k = int(size * frac)
    art = portrait.resize((k, k), Image.LANCZOS)
    off = (size - k) // 2
    img.paste(art, (off, off))
    if border:
        d = ImageDraw.Draw(img)
        b = max(2, size // 48)
        r = radius or int(size * 0.14)
        d.rounded_rectangle([b, b, size - 1 - b, size - 1 - b], radius=r, outline=VERMILION, width=b)
    if radius:
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), rounded_mask(size, radius))
        return out
    return img.convert("RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    build(192, 0.86, border=True, radius=int(192 * 0.16)).save(OUT / "icon-192.png")
    build(512, 0.86, border=True, radius=int(512 * 0.16)).save(OUT / "icon-512.png")
    build(512, 0.76, border=False).save(OUT / "icon-maskable-512.png")     # safe zone
    build(180, 0.88, border=True).save(OUT / "apple-touch-icon.png")       # opaque square
    for f in sorted(OUT.glob("*.png")):
        print(f.name, Image.open(f).size)


if __name__ == "__main__":
    main()

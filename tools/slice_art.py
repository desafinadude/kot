#!/usr/bin/env python3
"""Slice the YOKOZUNA contact sheets into the per-asset files named in
data/yokozuna-data.json (`asset` keys — stable paths, never renamed).

Sheets (art/contact_sheets/):
  01_rikishi.webp         3 × 2  → art/characters/0N_<id>.png   (row-major, JSON order)
  02_market_keep.webp     5 × 2  → art/market/01..10_<id>.png    (KEEP cards, JSON order)
  03_market_discard.webp  5 × 2  → art/market/11..20_<id>.png    (DISCARD cards, JSON order)

The sheets have dark gutters between cells; we find them by scanning for
near-black rows/columns instead of assuming an even grid, then trim a few
pixels so no gutter bleeds into the art. Output is a 256-colour dithered PNG
(~200 KB) — full-colour PNG would be ~600 KB per card on a phone.
The art carries no text: names/costs/rules are rendered by the app.

Run: python3 tools/slice_art.py
"""
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEETS = ROOT / "art" / "contact_sheets"
DATA = json.loads((ROOT / "data" / "yokozuna-data.json").read_text())
TRIM = 3        # px shaved inside each detected cell edge
DARK = 45       # mean luminance below this = gutter line


def spans(profile, n):
    """Return n (start, end) content spans between dark gutter runs."""
    dark = [v < DARK for v in profile]
    cells, start = [], None
    for i, d in enumerate(dark + [True]):
        if not d and start is None:
            start = i
        elif d and start is not None:
            if i - start > 40:                       # ignore slivers
                cells.append((start, i))
            start = None
    if len(cells) != n:
        raise SystemExit(f"expected {n} cells, found {len(cells)}: {cells}")
    return cells


def slice_sheet(path, cols, rows):
    im = Image.open(path).convert("RGB")
    lum = im.convert("L")
    w, h = im.size
    px = lum.load()
    col_profile = [sum(px[x, y] for y in range(0, h, 4)) / len(range(0, h, 4)) for x in range(w)]
    row_profile = [sum(px[x, y] for x in range(0, w, 4)) / len(range(0, w, 4)) for y in range(h)]
    xs, ys = spans(col_profile, cols), spans(row_profile, rows)
    out = []
    for (y0, y1) in ys:
        for (x0, x1) in xs:
            out.append(im.crop((x0 + TRIM, y0 + TRIM, x1 - TRIM, y1 - TRIM)))
    return out


def save(img, rel):
    dst = ROOT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    q = img.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(dst, "PNG", optimize=True)
    return dst


def main():
    chars = DATA["characters"]
    keep = [c for c in DATA["cards"] if c["type"] == "KEEP"]
    disc = [c for c in DATA["cards"] if c["type"] == "DISCARD"]
    jobs = [
        ("01_rikishi.webp", 3, 2, chars),
        ("02_market_keep.webp", 5, 2, keep),
        ("03_market_discard.webp", 5, 2, disc),
    ]
    total = 0
    for sheet, cols, rows, items in jobs:
        cells = slice_sheet(SHEETS / sheet, cols, rows)
        assert len(cells) == len(items), (sheet, len(cells), len(items))
        for cell, item in zip(cells, items):
            dst = save(cell, item["asset"])
            total += 1
            print(f"{item['id']:<22} {cell.size[0]}×{cell.size[1]}  → {dst.relative_to(ROOT)}")
    print(f"{total} assets written")


if __name__ == "__main__":
    main()

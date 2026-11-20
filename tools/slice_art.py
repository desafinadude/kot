#!/usr/bin/env python3
"""Slice generated contact sheets into individual game assets + update data/art.json.

Layouts must match ART_BRIEF.md (all sheets verified 1536×1024):
  characters 3×2 @512   dice 6×2 @256×512 (square-cropped)   cards 6×4 @256 ×4 sheets
Run: python3 tools/slice_art.py
"""
import json
import pathlib
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "assets" / "art"

FACES = ["1", "2", "3", "energy", "attack", "heal"]
COLORWAYS = ["black", "green"]
MONSTERS = ["ryuga", "shirohime", "tetsujin9", "onizaru", "kagero", "ganryu"]


def grid_cells(sheet: pathlib.Path, cols: int, rows: int, square: bool = False):
    im = Image.open(sheet).convert("RGBA")
    w, h = im.size
    cw, ch = w // cols, h // rows
    out = []
    for r in range(rows):
        for c in range(cols):
            box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
            if square and (ch - cw) > 0:  # centre-crop tall cells to square
                off = (ch - cw) // 2
                box = (c * cw, r * ch + off, (c + 1) * cw, r * ch + off + cw)
            out.append(im.crop(box))
    return out


def die_cell_crop(cell: Image.Image, tol: int = 70) -> Image.Image:
    """The generator drew dice tall and low inside their 256×512 cells, so a
    blind square crop clipped them. Find the die by contrast against the
    corner-sampled parchment, then pad it onto a square of parchment."""
    rgb = cell.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    samples = [px[x, y] for x, y in
               [(4, 4), (w - 5, 4), (4, h - 5), (w - 5, h - 5), (w // 2, 4), (4, h // 2)]]
    bg = tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))
    diff = (ImageChops.difference(rgb, Image.new("RGB", rgb.size, bg))
            .convert("L").point(lambda p: 255 if p > tol else 0))
    bb = diff.getbbox()
    if not bb:
        return rgb
    pad = 12  # keep glow/halftone edge
    x0, y0 = max(0, bb[0] - pad), max(0, bb[1] - pad)
    x1, y1 = min(w, bb[2] + pad), min(h, bb[3] + pad)
    piece = rgb.crop((x0, y0, x1, y1))
    side = max(piece.size)
    canvas = Image.new("RGB", (side, side), bg)
    canvas.paste(piece, ((side - piece.width) // 2, (side - piece.height) // 2))
    return canvas


def save(im: Image.Image, path: pathlib.Path) -> pathlib.Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".webp":
        try:
            im.save(path, "WEBP", quality=92)
            return path
        except Exception:
            path = path.with_suffix(".png")
    im.save(path)
    return path


def main():
    saved = {}

    # 1) characters — 3×2, row-major
    cells = grid_cells(DATA / "sheet-characters.png", 3, 2)
    for i, mid in enumerate(MONSTERS):
        p = save(cells[i], OUT / "monsters" / f"{mid}.webp")
        saved[f"monster_{mid}"] = str(p.relative_to(ROOT)).replace("\\", "/")

    # 2) dice — 6×2, row0 = black, row1 = green; content-aware crop
    cells = grid_cells(DATA / "sheet-dice.png", 6, 2)
    for row, color in enumerate(COLORWAYS):
        for i, face in enumerate(FACES):
            p = save(die_cell_crop(cells[row * 6 + i]), OUT / "dice" / f"{face}_{color}.png")
            saved[f"dice_{face}_{color}"] = str(p.relative_to(ROOT)).replace("\\", "/")

    # 3) cards — 4 sheets × (6×4), same order as data/cards.json (= brief tables)
    cards = json.loads((DATA / "cards.json").read_text())["cards"]
    slots = []
    for n in (3, 4, 5, 6):
        slots += grid_cells(DATA / f"sheet-cards{n}.png", 6, 4)
    assert len(slots) >= len(cards), f"not enough cells: {len(slots)} < {len(cards)}"
    for i, c in enumerate(cards):
        p = save(slots[i], OUT / "cards" / f"{c['id']}.png")
        saved[f"card_{c['id']}"] = str(p.relative_to(ROOT)).replace("\\", "/")

    # 4) update data/art.json manifest with the real paths
    art_path = DATA / "art.json"
    art = json.loads(art_path.read_text())
    assets = art.setdefault("assets", {})
    for key, src in saved.items():
        assets[key] = {"src": src + "?v=2", "fallback": "none:"}  # bust cached 404s/art
    art_path.write_text(json.dumps(art, ensure_ascii=False, indent=2) + "\n")

    print(f"Sliced {len(saved)} assets:")
    print(f"  monsters: {len(MONSTERS)}  dice: {len(FACES) * len(COLORWAYS)}  cards: {len(cards)}")
    print("  manifest updated → data/art.json")


if __name__ == "__main__":
    main()

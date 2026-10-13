"""Cut a 4x4 character action sheet into game frames (background removed, feet aligned).
usage: python3 tools/import_hero_sheet.py tools/src/dau-dau-sheet.png dau-dau
Frame order (row-major): idle, idle-blink, walk1, walk2, run1, run2, jump, crouch,
guard, punch, knee, high-kick, hurt, knocked, KO, victory.
"""
import sys, os, json
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

src, hero = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'characters', hero)
os.makedirs(OUT, exist_ok=True)
im = Image.open(src).convert('RGB')
W, H = im.size
cw, ch = W / 4, H / 4
sess = new_session('isnet-general-use')
frames = []
for r in range(4):
    for c in range(4):
        box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
        cell = im.crop(box)
        cut = remove(cell, session=sess)
        a = np.array(cut)
        a[:, :, :3] = np.array(cell)  # original colours; the model only provides the matte
        al = a[:, :, 3] > 30
        lab, n = ndimage.label(al)
        if n:
            sizes = ndimage.sum(al, lab, range(1, n + 1))
            keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.004]
            a[:, :, 3] = np.where(np.isin(lab, keep), a[:, :, 3], 0)
        # light clothing gets partial alpha from the matting model: make the silhouette solid
        m = a[:, :, 3] > 40
        filled = ndimage.binary_fill_holes(m)
        holes, nh = ndimage.label(filled & ~m)
        if nh:
            hs = ndimage.sum(np.ones_like(m), holes, range(1, nh + 1))
            small = [i + 1 for i, v in enumerate(hs) if v < 900]
            m = m | np.isin(holes, small)
        soft = ndimage.gaussian_filter(m.astype(float), 0.7)
        a[:, :, 3] = (np.clip(soft * 1.6, 0, 1) * 255).astype('uint8')
        frames.append(Image.fromarray(a))
# uniform frame: keep each cell's layout, align feet (lowest opaque row) for grounded frames
FW, FH = round(cw), round(ch)
SCALE = 0.75
bottoms = []
for i, f in enumerate(frames):
    rows = np.where(np.array(f)[:, :, 3].max(1) > 30)[0]
    bottoms.append(int(rows.max()) if len(rows) else FH - 1)
grounded = [i for i in range(16) if i not in (6, 13, 14)]
foot = int(np.median([bottoms[i] for i in grounded]))
PAD = 30
sw, sh = round(FW * SCALE), round((FH + PAD) * SCALE)
sheet = Image.new('RGBA', (sw * 4, sh * 4), (0, 0, 0, 0))
for i, f in enumerate(frames):
    canvas = Image.new('RGBA', (FW, FH + PAD), (0, 0, 0, 0))
    dy = 0 if i in (6,) else foot - bottoms[i]  # jump keeps its airborne offset
    if i in (13, 14):
        dy = foot - bottoms[i]
    canvas.alpha_composite(f, (0, max(-FH, min(PAD, dy + PAD // 2)) ))
    canvas = canvas.resize((sw, sh), Image.LANCZOS)
    sheet.alpha_composite(canvas, ((i % 4) * sw, (i // 4) * sh))
sheet.save(os.path.join(OUT, 'sheet.png'), optimize=True)
footY = (foot + PAD // 2 + 1) / (FH + PAD)
meta = {'frameW': sw, 'frameH': sh, 'footY': round(footY, 3), 'facing': 'right', 'frames': 16,
        'bodyH': round((foot - min(int(np.where(np.array(frames[0])[:, :, 3].max(1) > 30)[0].min()), FH)) * SCALE)}
json.dump(meta, open(os.path.join(OUT, 'sheet.json'), 'w'))
print(meta)

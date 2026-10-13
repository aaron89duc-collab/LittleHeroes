"""Cut a labelled character action sheet (frames on a grid, each with a caption pill underneath) into a
game sprite sheet with background removed and feet aligned.

usage: python3 tools/import_labeled_sheet.py shu-shu|bap

Output: public/assets/characters/<hero>/sheet.png + sheet.json.
sheet.json has `frames` (count), `slots` (HeroSpriteView frame slot → index in this sheet) and optional
`walk` / `win` frame lists, so sheets with any number/order of frames plug into the same view.
"""
import sys, os, json
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
COLS = [(0, 384), (384, 768), (768, 1152), (1152, 1536)]

SPECS = {
    # Bắp (monkey ears, as in the reference art): 18 frames — rows of 4,4,4,4,2. Row y-ranges stop above the caption pills.
    'bap': dict(
        src='src/bap-sheet.png',
        rows=[(0, 206), (238, 428), (458, 644), (676, 846), (876, 1000)],
        scale={16: 1.3, 17: 1.3},  # the last row is drawn smaller in the source
        count=18,
        # 0 idle, 1-3 walk, 4-7 run, 8 jump, 9 jump happy, 10 landing crouch, 11 dash-crouch,
        # 12 punch, 13 kick, 14 hurt, 15 fallen, 16 KO, 17 victory
        airborne=[8, 9], lying=[15, 16],
        slots=dict(IDLE=0, BLINK=0, WALK1=1, WALK2=3, RUN1=4, RUN2=6, JUMP=8, CROUCH=11, GUARD=10,
                   PUNCH=12, KNEE=10, KICK=13, HURT=14, KNOCK=15, KO=16, WIN=9),
        walk=[1, 2, 3, 2], win=[9],  # frame 17 (victory) has its feet hidden by the caption in the source
    ),
    # Shu Shu (puppy ears, as in the reference art; the sheet's collar tag says "Bắp" but the reference wins): 16 frames 4x4.
    'shu-shu': dict(
        src='src/shu-shu-sheet.png',
        rows=[(0, 238), (272, 503), (537, 751), (787, 977)],
        count=16,
        # 0 idle, 1 walk, 2 run, 3 jump, 4 punch, 5 kick, 6 hurt, 7 fallen, 8 KO, 9-15 victory variants
        airborne=[3], lying=[7, 8],
        slots=dict(IDLE=0, BLINK=0, WALK1=1, WALK2=0, RUN1=2, RUN2=1, JUMP=3, CROUCH=14, GUARD=14,
                   PUNCH=4, KNEE=14, KICK=5, HURT=6, KNOCK=7, KO=8, WIN=9),
        walk=[1, 0, 2, 0], win=[9, 10, 11, 13],
    ),
}

hero = sys.argv[1]
spec = SPECS[hero]
OUT = os.path.join(HERE, '..', 'public', 'assets', 'characters', hero)
os.makedirs(OUT, exist_ok=True)
im = Image.open(os.path.join(HERE, spec['src'])).convert('RGB')
sess = new_session('isnet-general-use')

cells = []
for r, (y0, y1) in enumerate(spec['rows']):
    for c, (x0, x1) in enumerate(COLS):
        if len(cells) < spec['count']:
            cells.append((x0, y0, x1, y1))

frames = []
for box in cells:
    cell = im.crop(box)
    cut = remove(cell, session=sess)
    a = np.array(cut)
    a[:, :, :3] = np.array(cell)  # original colours; the model only provides the matte
    al = a[:, :, 3] > 40
    lab, n = ndimage.label(al)
    if n:
        sizes = ndimage.sum(al, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.02]  # drop specks & glow halos
        a[:, :, 3] = np.where(np.isin(lab, keep), a[:, :, 3], 0)
    m = a[:, :, 3] > 60
    filled = ndimage.binary_fill_holes(m)
    holes, nh = ndimage.label(filled & ~m)
    if nh:
        hs = ndimage.sum(np.ones_like(m), holes, range(1, nh + 1))
        m = m | np.isin(holes, [i + 1 for i, v in enumerate(hs) if v < 600])
    soft = ndimage.gaussian_filter(m.astype(float), 0.7)
    a[:, :, 3] = (np.clip(soft * 1.6, 0, 1) * 255).astype('uint8')
    fr = Image.fromarray(a)
    k = spec.get('scale', {}).get(len(frames))
    if k:
        fr = fr.resize((round(fr.width * k), round(fr.height * k)), Image.LANCZOS)
    frames.append(fr)

def rows_of(f):
    return np.where(np.array(f)[:, :, 3].max(1) > 40)[0]

FW = 360
bottoms = [int(rows_of(f).max()) for f in frames]
tops = [int(rows_of(f).min()) for f in frames]
ground = [i for i in range(len(frames)) if i not in spec['airborne'] + spec['lying']]
idle_h = bottoms[0] - tops[0]
FH = max(b - t for b, t in zip(bottoms, tops)) + 40
foot = FH - 12  # common baseline inside each output frame
cols = 4
nrows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGBA', (FW * cols, FH * nrows), (0, 0, 0, 0))
for i, f in enumerate(frames):
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    dx = (FW - f.width) // 2
    if i in spec['airborne']:
        dy = foot - bottoms[i] - 30  # keep a little air under jumps
    else:
        dy = foot - bottoms[i]
    if dx < 0:
        f = f.crop((-dx, 0, -dx + FW, f.height)); dx = 0
    canvas.alpha_composite(f, (dx, max(0, dy)))
    sheet.alpha_composite(canvas, ((i % cols) * FW, (i // cols) * FH))
sheet.save(os.path.join(OUT, 'sheet.png'), optimize=True)
meta = {'frameW': FW, 'frameH': FH, 'footY': round((foot + 1) / FH, 3), 'facing': 'right', 'frames': len(frames),
        'bodyH': idle_h, 'slots': spec['slots'], 'walk': spec['walk'], 'win': spec['win']}
json.dump(meta, open(os.path.join(OUT, 'sheet.json'), 'w'))
# contact sheet for review
prev = sheet.copy()
bg = Image.new('RGBA', prev.size, (70, 90, 120, 255))
bg.alpha_composite(prev)
bg.convert('RGB').save(os.path.join(HERE, 'out', f'{hero}-preview.jpg'), quality=80) if os.path.isdir(os.path.join(HERE, 'out')) else None
print(meta)

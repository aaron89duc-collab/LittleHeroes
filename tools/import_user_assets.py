"""Convert the user's asset packs (E:\\game\\asset) into game-ready files under public/assets/.
usage: python3 tools/import_user_assets.py <folder-with-unzipped-packs>
"""
import sys, os, glob, json, shutil
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
FLOOR_TOP, GAME_H, GAME_W = 452, 720, 1280
manifest = {'backgrounds': {}, 'sprites': {}, 'icons': {}, 'commander': []}

def P(*a): return os.path.join(SRC, *a)
def mk(*a):
    d = os.path.join(OUT, *a); os.makedirs(d, exist_ok=True); return d

# ───────────── street backgrounds → far / mid / floor layers ─────────────
CITY = P('craftpix-891123-free-pixel-art-street-2d-backgrounds', 'PNG')
CITY_LAYERS = {
    # back → front;  far = sky + distant layers, mid = front props, road = walkable floor
    'City1': dict(far=['Sky', 'buildings', 'wall2'], mid=['wall1', 'boxes&container', 'wheels&hydrant'], road=['road&border'], ground=850),
    'City2': dict(far=['Sky', 'back', 'houses3'], mid=['houses1', 'minishop&callbox', 'road&lamps'], road=['road&lamps'], ground=842),
    'City3': dict(far=['sky', 'houses3', 'houded2'], mid=['houses1'], road=['road', 'crosswalk'], ground=842),
    'City4': dict(far=['Sky', 'houses', 'houses2'], mid=['fountain&bush', 'houses1', 'umbrella&policebox'], road=['road'], ground=872),
}
THEME_CITY = {'street': 'City3', 'mall': 'City2', 'port': 'City1', 'rooftop': 'City4'}
S = 0.62  # horizontal scale of the 1920x1080 art

def comp(city, names):
    base = None
    for n in names:
        f = os.path.join(CITY, city, 'Bright', n + '.png')
        im = Image.open(f).convert('RGBA')
        base = im if base is None else Image.alpha_composite(base, im)
    return base

bgdir = mk('backgrounds')
for theme, city in THEME_CITY.items():
    L = CITY_LAYERS[city]; G = L['ground']
    far = comp(city, L['far'])
    top = max(0, int(G - FLOOR_TOP / S))
    w = round(1920 * S)
    farc = far.crop((0, top, 1920, G)).resize((w, FLOOR_TOP), Image.LANCZOS)
    far_full = Image.new('RGBA', (w, GAME_H), far.getpixel((960, top + 2)))
    far_full.alpha_composite(farc, (0, 0))
    far_full.convert('RGB').save(os.path.join(bgdir, f'bg-{theme}-far.png'))
    mid = comp(city, L['mid']).crop((0, top, 1920, G)).resize((w, FLOOR_TOP), Image.LANCZOS)
    mid.save(os.path.join(bgdir, f'bg-{theme}-mid.png'))
    road_top = int(G - 40 / S)
    allc = comp(city, L['far'] + L['mid'] + L['road'])
    floor = allc.crop((0, road_top, 1920, 1080)).resize((w, GAME_H - FLOOR_TOP + 40), Image.LANCZOS)
    floor.convert('RGB').save(os.path.join(bgdir, f'bg-{theme}-floor.png'))
    manifest['backgrounds'][theme] = {'far': f'assets/backgrounds/bg-{theme}-far.png', 'mid': f'assets/backgrounds/bg-{theme}-mid.png', 'floor': f'assets/backgrounds/bg-{theme}-floor.png', 'source': city}
    # stage card
    card = Image.open(glob.glob(os.path.join(CITY, city, 'Bright', city + '.png'))[0]).convert('RGB').resize((466, 262), Image.LANCZOS)
    card.save(os.path.join(bgdir, f'card-img-{theme}.jpg'), quality=88)

# nature: aurora mountains as the ice stage sky
NAT = P('craftpix-net-823949-free-nature-backgrounds-pixel-art', 'nature_6', 'orig.png')
im = Image.open(NAT).convert('RGB').resize((GAME_W, GAME_H), Image.NEAREST)
im.save(os.path.join(bgdir, 'bg-ice-far.png'))
manifest['backgrounds']['ice'] = {'far': 'assets/backgrounds/bg-ice-far.png', 'source': 'nature_6'}
# nature: rocky cliffs sky for the chaos-free menu? keep: nature_8 sea cliffs → port card alt (unused)

# ───────────── cyberpunk factory bosses (96x96 strips, facing right) ─────────────
CY = P('craftpix-net-412866-free-factory-boss-enemies-asset-pack-for-cyberpunk')
CY_ANIMS = {
    'cyber1': {'idle': 'Idle', 'walk': 'Run', 'attack': 'Attack', 'attack2': 'Attack2', 'attack3': 'Attack3', 'grab': 'Grab', 'hurt': 'Hurt', 'death': 'Death', 'jump': 'Jump', 'fall': 'Fall', 'prepare': 'Prepare'},
    'cyber2': {'idle': 'Idle', 'walk': 'Drive', 'attack': 'Special', 'attack2': 'Turn', 'hurt': 'Hurt', 'death': 'Death', 'prepare': 'Idle2'},
    'cyber3': {'idle': 'Idle', 'walk': 'Walk', 'attack': 'Attack', 'attack2': 'Attack2', 'attack3': 'Attack3', 'walkattack': 'WalkAttack', 'hurt': 'Hurt', 'death': 'Death', 'jump': 'Jump', 'fall': 'Fall'},
}
for key, anims in CY_ANIMS.items():
    d = mk('sprites', key); folder = key[-1]
    entry = {'frameW': 96, 'frameH': 96, 'facing': 'right', 'anims': {}}
    bottom = 0; heights = []
    for a, name in anims.items():
        src = os.path.join(CY, folder, name + '.png')
        im = Image.open(src).convert('RGBA')
        im.save(os.path.join(d, f'{a}.png'))
        n = im.width // 96
        al = np.array(im)[:, :, 3]
        rows = np.where(al.max(1) > 0)[0]
        if len(rows):
            bottom = max(bottom, rows.max()); heights.append(rows.max() - rows.min())
        entry['anims'][a] = {'file': f'assets/sprites/{key}/{a}.png', 'frames': n}
    entry['footY'] = round((bottom + 1) / 96, 3)
    entry['bodyH'] = int(np.median(heights))
    manifest['sprites'][key] = entry
shutil.copy(os.path.join(CY, '1', 'Projectile.png'), os.path.join(mk('sprites', 'cyber1'), 'projectile.png'))

# ───────────── fantasy boss creatures (side "Left" sequences) ─────────────
FB = P('craftpix-net-643385-free-fantasy-rpg-top-down-boss-creatures-pack')
FB_ANIMS = {'idle': ('Left - Idle', 2), 'walk': ('Left - Walking', 2), 'attack': ('Left - Attacking', 1), 'hurt': ('Left - Hurt', 1), 'death': ('Dying', 1)}
for name, key in [('Boar King', 'boar'), ('Devil Leader', 'devil'), ('Shaman King', 'shaman')]:
    seqs = {}
    for a, (folder, step) in FB_ANIMS.items():
        fs = sorted(glob.glob(os.path.join(FB, name, 'PNG', 'PNG Sequences', folder, '*.png')))[::step]
        seqs[a] = [Image.open(f).convert('RGBA') for f in fs]
    # union bounding box across every frame
    boxes = [im.getbbox() for fr in seqs.values() for im in fr if im.getbbox()]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    k = 0.42
    fw, fh = round((x1 - x0) * k), round((y1 - y0) * k)
    d = mk('sprites', key)
    entry = {'frameW': fw, 'frameH': fh, 'facing': 'left', 'anims': {}, 'footY': 1.0}
    for a, frames in seqs.items():
        cols = min(len(frames), max(1, 4000 // fw))
        rows = (len(frames) + cols - 1) // cols
        sheet = Image.new('RGBA', (fw * cols, fh * rows), (0, 0, 0, 0))
        for i, im in enumerate(frames):
            fr = im.crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS)
            sheet.alpha_composite(fr, ((i % cols) * fw, (i // cols) * fh))
        sheet.save(os.path.join(d, f'{a}.png'), optimize=True)
        entry['anims'][a] = {'file': f'assets/sprites/{key}/{a}.png', 'frames': len(frames)}
    # foot = lowest opaque row of the idle frames
    idle = seqs['idle'][0].crop((x0, y0, x1, y1))
    al = np.array(idle)[:, :, 3]
    entry['footY'] = round((np.where(al.max(1) > 0)[0].max() + 1) / (y1 - y0), 3)
    entry['bodyH'] = fh
    manifest['sprites'][key] = entry

# ───────────── UI icons (16x16 → 48x48 nearest) ─────────────
IC = P('craftpix-net-994534-free-basic-pixel-art-fantasy-icons-16x16-for-ui', 'PNG', 'Separately')
ICONS = {
    'icon-health': 'Skill_icon15', 'icon-energy': 'Icon8_1', 'icon-token': 'Icon3_1',
    'skill-dd_s1': 'Skill_icon3', 'skill-dd_s2': 'Skill_icon5', 'skill-dd_s3': 'Skill_icon14', 'skill-dd_ult': 'Skill_icon8',
    'skill-ss_s1': 'Skill_icon2', 'skill-ss_s2': 'Skill_icon13', 'skill-ss_s3': 'Skill_icon6', 'skill-ss_ult': 'Skill_icon12',
    'skill-bp_s1': 'Skill_icon1', 'skill-bp_s2': 'Skill_icon10', 'skill-bp_s3': 'Skill_icon11', 'skill-bp_ult': 'Skill_icon7',
    'icon-lock': 'Icon11_1', 'icon-fist': 'Icon7_1',
}
d = mk('ui', 'icons')
for k, n in ICONS.items():
    im = Image.open(os.path.join(IC, n + '.png')).convert('RGBA')
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(d, k + '.png'))
    manifest['icons'][k] = f'assets/ui/icons/{k}.png'

# ───────────── commander portraits (briefing on the stage intro) ─────────────
CM = P('craftpix-net-422327-free-rpg-swordsman-portrait-emotes-icon-pack', 'PNG', 'without background')
d = mk('ui', 'commander')
for i in [1, 2, 3, 4, 5, 6]:
    im = Image.open(os.path.join(CM, f'{i}.png')).convert('RGBA'); im.thumbnail((240, 240), Image.LANCZOS)
    im.save(os.path.join(d, f'commander-{i}.png'), optimize=True)
    manifest['commander'].append(f'assets/ui/commander/commander-{i}.png')

with open(os.path.join(os.path.dirname(__file__), '..', 'src', 'config', 'userAssets.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
print(json.dumps({k: (list(v.keys()) if isinstance(v, dict) else len(v)) for k, v in manifest.items()}))
for k, v in manifest['sprites'].items(): print(k, v['frameW'], v['frameH'], v['footY'], v.get('bodyH'), {a: x['frames'] for a, x in v['anims'].items()})

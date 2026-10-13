"""Convert the user's craftpix sound packs (E:\\game\\asset\\sound) into game-ready audio under public/assets/audio/.
usage: python3 tools/import_sounds.py <folder-with-unzipped-sound-packs>
Music → MP3 96 kbps stereo, loudness-normalised (-16 LUFS). SFX → mono 22 kHz WAV, leading silence trimmed.
"""
import sys, os, json, subprocess, glob

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'audio')
P1 = 'craftpix-net-608340-free-futuristic-sounds-and-music-pack-for-pixel-games'
P2 = 'craftpix-net-648698-free-music-and-sounds-for-cyberpunk-game-pack-1'
P3 = 'craftpix-net-936590-free-futuristic-game-music-and-sound-effects-pack-3'

# index = StageConfig.music (0-9 stages), 10 menu, 11 ending, 12 boss, 13 late-game boss
MUSIC = {
    0: (P1, 'Main_theme_night_city_loopable'),   # Phố đêm
    1: (P1, 'Main_theme_loopable'),              # Trung tâm thương mại
    2: (P3, 'Main_theme_sewerage'),              # Tàu điện ngầm
    3: (P2, 'Track Industrial'),                 # Nhà máy
    4: (P2, 'Track greenzone'),                  # Cảng
    5: (P2, 'Track Lab'),                        # Phòng thí nghiệm
    6: (P1, 'police_theme_loopable'),            # Truy đuổi mái nhà
    7: (P3, 'Main_theme_alternative_loopable'),  # Căn cứ băng
    8: (P3, 'Dark_ambient_loopable'),            # Tòa tháp Hắc Ảnh
    9: (P2, 'Track race'),                       # Cổng hỗn mang
    10: (P1, 'Game_menu_theme_loopable'),        # Menu
    11: (P3, 'Emotional_theme'),                 # Ending
    12: (P1, 'Battle_theme_loopable'),           # Boss màn 1-5
    13: (P3, 'Battle_theme_sewerage_loopable'),  # Boss màn 6-10
}

# sfx name → (pack, file, max seconds)
SFX = {
    'punch': (P2, 'Bump', 0.45),
    'heavy': (P2, 'Punch', 0.6),
    'explosion': (P2, 'Explosion', 1.5),
    'explosion2': (P2, 'Explosion2', 1.6),
    'warning': (P2, 'Access denied', 0.8),
    'pickup': (P1, 'Collect_sound', 0.9),
    'coin': (P1, 'Collect_cash_1', 0.8),
    'ui': (P3, 'UI_click_1', 0.35),
    'confirm': (P3, 'UI_click_2', 0.5),
    'break': (P2, 'Glass', 1.3),
    'train': (P3, 'Engine_acceleration_double', 1.6),
    'spit': (P1, 'Laser_shot', 0.6),
    'defeat': (P2, 'Dead1', 1.8),
    'victory': (P2, 'Access granted', 1.1),
    'ultimate': (P2, 'Thunderbolt', 1.6),
}

def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

os.makedirs(os.path.join(OUT, 'music'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'sfx'), exist_ok=True)
manifest = {'music': {}, 'sfx': {}}
for idx, (pack, name) in MUSIC.items():
    src = os.path.join(SRC, pack, 'Music', 'MP3', name + '.mp3')
    if not os.path.exists(src):
        src = os.path.join(SRC, pack, 'Music', 'WAV', name + '.wav')
    dst = f'music/m{idx:02d}.mp3'
    ff(['-i', src, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '2', '-ar', '44100', '-b:a', '96k', os.path.join(OUT, dst)])
    manifest['music'][str(idx)] = f'assets/audio/{dst}'
for key, (pack, name, mx) in SFX.items():
    src = os.path.join(SRC, pack, 'Sounds', name + '.wav')
    dst = f'sfx/{key}.wav'
    fade = max(0.05, mx * 0.25)
    ff(['-i', src, '-af', f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:{mx},afade=t=out:st={mx - fade}:d={fade},loudnorm=I=-14:TP=-1',
        '-ac', '1', '-ar', '22050', '-sample_fmt', 's16', os.path.join(OUT, dst)])
    manifest['sfx'][key] = f'assets/audio/{dst}'
with open(os.path.join(ROOT, 'src', 'config', 'audioAssets.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
print(json.dumps(manifest, indent=1))

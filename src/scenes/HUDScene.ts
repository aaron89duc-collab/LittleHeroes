import Phaser from 'phaser';
import { getMove } from '../config/moves';
import { FONT, GAME_W } from '../game/constants';
import { TouchController } from '../input/TouchController';
import { fullscreenSupported, toggleFullscreen } from '../systems/Fullscreen';
import { SaveSystem } from '../systems/SaveSystem';
import { makeTouchButton, type TouchButtonView, VirtualJoystick } from '../ui/VirtualJoystick';
import type { GameScene } from './GameScene';

/**
 * Screen-space HUD (separate scene so camera shake never moves it). GDD §12.3:
 * top-left portrait/HP/EN, top-right score/lives/stage, top-centre boss bar, bottom touch controls.
 */
/** Update a Text only when something changed (each re-render re-uploads a GPU texture). */
function setTxt(t: Phaser.GameObjects.Text, text: string, color?: string): void {
  if (t.text !== text) t.setText(text);
  if (color && t.style.color !== color) t.setColor(color);
}

export class HUDScene extends Phaser.Scene {
  private game_!: GameScene;
  private g!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private enText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private bossNames: Phaser.GameObjects.Text[] = [];
  private skillTexts: Phaser.GameObjects.Text[] = [];
  private skillIcons: Array<Phaser.GameObjects.Image | null> = [];
  private bannerC!: Phaser.GameObjects.Container;
  private bannerT!: Phaser.GameObjects.Text;
  private bannerS!: Phaser.GameObjects.Text;
  private goText!: Phaser.GameObjects.Text;
  private ultReady!: Phaser.GameObjects.Text;
  private touchButtons: TouchButtonView[] = [];
  joystick: VirtualJoystick | null = null;
  private shownScore = 0;
  private bannerTween: Phaser.Tweens.TweenChain | null = null;
  private touchOn = false;

  constructor() {
    super('HUDScene');
  }

  init(d: { game: GameScene }): void {
    this.game_ = d.game;
    this.bossNames = [];
    this.skillTexts = [];
    this.touchButtons = [];
    this.joystick = null;
    this.shownScore = 0;
  }

  create(): void {
    const gm = this.game_;
    const p = gm.world.player;
    const st = (size: number, color = '#ffffff', weight = '800'): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      stroke: '#0b1230',
      strokeThickness: 5,
    });
    this.g = this.add.graphics();
    // portrait
    this.add.circle(66, 66, 54, p.stats.palette.suit).setStrokeStyle(5, 0xffd23f);
    this.add.image(66, 66, `face-${p.stats.id}`).setDisplaySize(104, 104);
    this.add.text(134, 12, p.stats.displayName, st(26));
    this.hpText = this.add.text(140, 46, '', st(15)).setDepth(2);
    this.enText = this.add.text(140, 76, '', st(13, '#d8ecff')).setDepth(2);
    this.ultReady = this.add.text(136, 96, 'U: TUYỆT KỸ SẴN SÀNG!', st(16, '#ffd23f')).setVisible(false);
    this.tweens.add({ targets: this.ultReady, alpha: 0.4, yoyo: true, repeat: -1, duration: 350 });
    this.scoreText = this.add.text(GAME_W - 20, 10, '', st(30, '#ffd23f')).setOrigin(1, 0);
    this.livesText = this.add.text(GAME_W - 20, 48, '', st(24, '#ff6b8a')).setOrigin(1, 0);
    this.add.text(GAME_W - 20, 80, `MÀN ${gm.stage.id} • ${gm.stage.name}`, st(17, '#ffffff', '600')).setOrigin(1, 0);
    this.waveText = this.add.text(GAME_W / 2, 18, '', st(22, '#ffffff')).setOrigin(0.5, 0);
    for (let i = 0; i < 2; i++) this.bossNames.push(this.add.text(GAME_W / 2, 12 + i * 46, '', st(18, '#ffd6d6')).setOrigin(0.5, 0).setVisible(false));
    for (let i = 0; i < 4; i++) this.skillTexts.push(this.add.text(0, 0, '', st(15, '#ffffff', '700')).setOrigin(0.5).setDepth(3));
    this.skillIcons = [...p.skillIds, p.stats.ultimate].map((id) => {
      const k = `skill-${id}`;
      if (!this.textures.exists(k)) return null;
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return this.add.image(-100, -100, k).setDisplaySize(32, 32).setDepth(3);
    });

    // banner
    this.bannerT = this.add.text(0, 0, '', { ...st(60, '#ffd23f'), strokeThickness: 10 }).setOrigin(0.5);
    this.bannerS = this.add.text(0, 52, '', st(24, '#ffffff', '700')).setOrigin(0.5);
    this.bannerC = this.add.container(GAME_W / 2, 250, [this.bannerT, this.bannerS]).setAlpha(0).setDepth(50);
    this.goText = this.add.text(GAME_W - 70, 330, 'GO\n▶', { ...st(52, '#ffd23f'), align: 'center' }).setOrigin(0.5).setVisible(false);
    this.tweens.add({ targets: this.goText, x: GAME_W - 50, yoyo: true, repeat: -1, duration: 300 });

    // pause button (mouse & touch)
    const pb = this.add.circle(GAME_W - 40, 140, 24, 0x0b1230, 0.6).setStrokeStyle(3, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
    this.add.text(GAME_W - 40, 140, 'II', st(20)).setOrigin(0.5);
    pb.on('pointerdown', () => TouchController.get().press('pause'));
    if (fullscreenSupported()) {
      const fb = this.add.circle(GAME_W - 96, 140, 24, 0x0b1230, 0.6).setStrokeStyle(3, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
      this.add.text(GAME_W - 96, 140, '⛶', st(22)).setOrigin(0.5);
      fb.on('pointerup', () => void toggleFullscreen());
    }

    this.setupTouch();
    this.input.addPointer(3);
  }

  private setupTouch(): void {
    const s = SaveSystem.get().data.settings;
    const isTouch = this.sys.game.device.input.touch;
    this.touchOn = s.showTouch === 'on' || (s.showTouch === 'auto' && isTouch);
    if (!this.touchOn) return;
    const o = s.touchControlsOpacity;
    this.joystick = new VirtualJoystick(this, o);
    this.touchButtons = [
      makeTouchButton(this, 'attack', GAME_W - 130, 590, 66, 'ĐÁNH', 0xb3261e, o),
      makeTouchButton(this, 'jump', GAME_W - 258, 652, 46, 'NHẢY', 0x1d6fd6, o),
      makeTouchButton(this, 'dodge', GAME_W - 110, 452, 44, 'NÉ', 0x2a9d5a, o),
      makeTouchButton(this, 'skill', GAME_W - 250, 520, 48, 'KỸ', 0x7a3fd6, o),
      makeTouchButton(this, 'ultimate', GAME_W - 380, 640, 40, 'TUYỆT', 0xd69a00, o),
      makeTouchButton(this, 'cycleSkill', GAME_W - 360, 528, 28, '⟳', 0x34407a, o),
    ];
  }

  banner(title: string, sub = '', color = '#ffd23f'): void {
    this.bannerT.setText(title).setColor(color);
    this.bannerS.setText(sub);
    this.bannerTween?.stop();
    this.bannerC.setAlpha(0).setScale(0.6);
    this.bannerTween = this.tweens.chain({
      targets: this.bannerC,
      tweens: [
        { alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' },
        { alpha: 1, duration: 1500 },
        { alpha: 0, scale: 1.1, duration: 300 },
      ],
    });
  }

  setGo(on: boolean): void {
    this.goText.setVisible(on);
  }

  update(): void {
    const gm = this.game_;
    if (!gm.world?.player) return;
    const w = gm.world;
    const p = w.player;
    const g = this.g;
    g.clear();
    // HP
    const hpK = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    g.fillStyle(0x0b1230, 0.85).fillRoundedRect(130, 42, 316, 26, 8);
    g.fillStyle(hpK < 0.3 ? 0xff3b3b : 0x4dff88, 1).fillRoundedRect(134, 46, 308 * hpK, 18, 6);
    g.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(130, 42, 316, 26, 8);
    setTxt(this.hpText, `HP ${Math.ceil(p.hp)}/${p.maxHp}`);
    // EN
    const enK = p.energy.current / p.energy.max;
    g.fillStyle(0x0b1230, 0.85).fillRoundedRect(130, 72, 316, 20, 7);
    g.fillStyle(enK >= 1 ? 0xffd23f : 0x3fa9ff, 1).fillRoundedRect(134, 76, 308 * enK, 12, 5);
    const cost = p.selectedSkillMove.energyCost;
    g.fillStyle(0xffffff, 0.9).fillRect(134 + 308 * (cost / 100) - 1, 72, 3, 20);
    g.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(130, 72, 316, 20, 7);
    setTxt(this.enText, `EN ${Math.floor(p.energy.current)}`);
    this.enText.setPosition(140, 73);
    this.ultReady.setVisible(enK >= 1);
    // score / lives
    this.shownScore += (w.score - this.shownScore) * 0.2;
    setTxt(this.scoreText, `ĐIỂM ${String(Math.round(this.shownScore)).padStart(6, '0')}`);
    setTxt(this.livesText, `${'♥ '.repeat(Math.max(0, gm.sm.lives)).trim()}  x${gm.sm.lives}`);
    // waves / boss
    const wave = gm.sm.waveInfo;
    const bosses = gm.sm.isBossFight || gm.sm.state === 'victory' ? gm.sm.bosses : [];
    if (bosses.length) {
      this.waveText.setVisible(false);
      bosses.forEach((b, i) => {
        const y = 40 + i * 54;
        const wdt = bosses.length > 1 ? 380 : 420;
        const x = GAME_W / 2 - wdt / 2;
        const k = Math.max(0, b.hp / b.maxHp);
        g.fillStyle(0x0b1230, 0.9).fillRoundedRect(x - 4, y - 4, wdt + 8, 24, 8);
        g.fillStyle(b.shieldMul < 1 || b.curlArmor ? 0x8fa3c2 : b.enraged ? 0xff7a00 : 0xff3b3b, 1).fillRoundedRect(x, y, wdt * k, 16, 6);
        // phase pips
        b.cfg.phases.forEach((ph, j) => {
          if (j === 0) return;
          g.fillStyle(j <= b.phaseIndex ? 0x555555 : 0xffd23f, 1).fillRect(x + wdt * ph.hpBelow - 2, y - 4, 4, 24);
        });
        g.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(x - 4, y - 4, wdt + 8, 24, 8);
        const nm = this.bossNames[i];
        const tag = b.shieldMul < 1 ? '  🛡 GIÁP' : b.curlArmor ? '  🛡 CUỘN' : b.enraged ? '  🔥' : '';
        nm.setVisible(true).setPosition(GAME_W / 2, y - 24);
        setTxt(nm, `${b.cfg.name}${b.alive ? '' : ' — ĐÃ BẠI'}${tag}`);
      });
      for (let i = bosses.length; i < 2; i++) this.bossNames[i].setVisible(false);
    } else {
      for (const n of this.bossNames) n.setVisible(false);
      this.waveText.setVisible(!!wave);
      setTxt(this.waveText, wave ? `ĐỢT ${wave.index}/${wave.total} • Còn ${wave.remaining} địch` : '');
    }
    this.drawSkills(g);
    this.drawTouchState(g);
  }

  private drawSkills(g: Phaser.GameObjects.Graphics): void {
    const p = this.game_.world.player;
    const ids = [...p.skillIds, p.stats.ultimate];
    const slotW = 176;
    const baseX = this.touchOn ? 300 : GAME_W / 2 - (slotW * 4 + 30) / 2 + slotW / 2;
    const y = this.touchOn ? 30 + 0 : 690;
    if (this.touchOn) {
      // compact list under the bars on touch layouts
      for (const ic of this.skillIcons) ic?.setVisible(false);
      ids.forEach((id, i) => {
        const m = getMove(id);
        const sel = i === p.selectedSkill;
        const ok = p.energy.current >= m.energyCost;
        const t = this.skillTexts[i];
        if (t.style.fontSize !== '13px') t.setFontSize(13).setOrigin(0.5);
        t.setPosition(138 + (i % 2) * 170 + 70, 124 + Math.floor(i / 2) * 22);
        setTxt(t, `${i === 3 ? 'U' : i + 1} ${m.name} (${m.energyCost})`, sel ? '#ffd23f' : ok ? '#ffffff' : '#7a86b0');
        void baseX;
        void y;
      });
      return;
    }
    ids.forEach((id, i) => {
      const m = getMove(id);
      const x = baseX + i * (slotW + 10);
      const sel = i === p.selectedSkill;
      const ok = p.energy.current >= m.energyCost;
      g.fillStyle(i === 3 ? 0x5a3a00 : 0x13204a, ok ? 0.9 : 0.55).fillRoundedRect(x - slotW / 2, y - 22, slotW, 44, 10);
      if (!ok) {
        const k = p.energy.current / m.energyCost;
        g.fillStyle(0x3fa9ff, 0.35).fillRoundedRect(x - slotW / 2, y - 22, slotW * k, 44, 10);
      }
      const cd = p.skillCooldownLeft;
      if (cd > 0 && i < 3) g.fillStyle(0x000000, 0.5).fillRoundedRect(x - slotW / 2, y - 22, slotW * (cd / 400), 44, 10);
      g.lineStyle(sel || (i === 3 && ok) ? 4 : 2, sel ? 0xffd23f : i === 3 && ok ? 0xffd23f : 0x5a78d0, 1).strokeRoundedRect(x - slotW / 2, y - 22, slotW, 44, 10);
      const key = i === 3 ? 'U' : sel ? 'K ▶' : `${i + 1}`;
      const st = this.skillTexts[i];
      if (st.style.align !== 'center') st.setAlign('center');
      const icon = this.skillIcons[i];
      if (icon) icon.setPosition(x - slotW / 2 + 24, y).setAlpha(ok ? 1 : 0.4);
      st.setPosition(icon ? x + 16 : x, y);
      setTxt(st, `${key} ${m.name}\n${m.energyCost} EN`, ok ? '#ffffff' : '#9aa6cc');
    });
    // dodge cooldown pip
    const dx = baseX + 4 * (slotW + 10) - 50;
    const dk = p.dodgeCooldownLeft / 550;
    g.fillStyle(0x13204a, 0.9).fillCircle(dx, y, 22);
    if (dk > 0) g.slice(dx, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dk, false).fillStyle(0x000000, 0.6).fillPath();
    g.lineStyle(3, dk > 0 ? 0x5a78d0 : 0x4dff88, 1).strokeCircle(dx, y, 22);
  }

  private drawTouchState(g: Phaser.GameObjects.Graphics): void {
    if (!this.touchOn) return;
    const p = this.game_.world.player;
    for (const b of this.touchButtons) {
      let k = 0;
      if (b.key === 'dodge') k = p.dodgeCooldownLeft / 550;
      if (b.key === 'skill') k = p.energy.current >= p.selectedSkillMove.energyCost ? 0 : 1 - p.energy.current / p.selectedSkillMove.energyCost;
      if (b.key === 'ultimate') k = 1 - p.energy.current / 100;
      b.overlay.clear();
      if (k > 0) {
        b.overlay.fillStyle(0x000000, 0.5);
        b.overlay.slice(b.arc.x, b.arc.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false).fillPath();
      }
      if (b.key === 'skill') {
        if (b.label.style.align !== 'center') b.label.setAlign('center');
        setTxt(b.label, `KỸ\n${p.selectedSkill + 1}`);
      }
    }
    void g;
  }
}

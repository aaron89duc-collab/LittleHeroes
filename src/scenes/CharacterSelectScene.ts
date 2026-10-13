import Phaser from 'phaser';
import { CHARACTER_ORDER, CHARACTERS } from '../config/characters';
import { getMove } from '../config/moves';
import { FONT, UI_OFFSET } from '../game/constants';
import { createHeroView, type HeroViewT } from '../rig/HeroSpriteView';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type { CharacterId } from '../types/game';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, title } from '../ui/MenuComponents';

interface SelectData {
  next?: 'stage' | 'menu';
  stageId?: number;
  hard?: boolean;
}

export class CharacterSelectScene extends Phaser.Scene {
  private index = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private frames: Phaser.GameObjects.Graphics[] = [];
  private badges: Phaser.GameObjects.Text[] = [];
  private rig: HeroViewT | null = null;
  private info!: Phaser.GameObjects.Container;
  private demoT = 0;
  private demoI = 0;
  private dataIn: SelectData = {};

  constructor() {
    super('CharacterSelectScene');
  }

  init(d: SelectData): void {
    this.dataIn = d ?? {};
    this.index = Math.max(0, CHARACTER_ORDER.indexOf(SaveSystem.get().data.selectedCharacter));
  }

  create(): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    this.cards = [];
    this.frames = [];
    this.badges = [];
    this.rig = null;
    new Backdrop(this, 'street', 0.55);
    title(this, 640, 50, 'CHỌN NHÂN VẬT', 46);

    CHARACTER_ORDER.forEach((id, i) => {
      const c = CHARACTERS[id];
      const x = 120 + i * 205;
      const y = 300;
      const card = this.add.container(x, y);
      const frame = this.add.graphics();
      const img = this.add.image(0, -40, `portrait-${id}`).setDisplaySize(176, 270);
      const name = this.add
        .text(0, 120, c.displayName, { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 6 })
        .setOrigin(0.5);
      const role = this.add.text(0, 152, c.title, { fontFamily: FONT, fontSize: '16px', color: '#c9d6ff' }).setOrigin(0.5);
      const badge = this.add
        .text(0, -196, '▼ ĐÃ CHỌN', { fontFamily: FONT, fontSize: '18px', fontStyle: '800', color: '#0b1230', backgroundColor: '#ffd23f', padding: { x: 8, y: 2 } })
        .setOrigin(0.5);
      card.add([frame, img, name, role, badge]);
      card.setSize(196, 380).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        if (this.index === i) this.confirm();
        else this.select(i);
      });
      this.cards.push(card);
      this.frames.push(frame);
      this.badges.push(badge);
    });

    this.info = this.add.container(0, 0);
    const back = new MenuButton(this, 170, 660, '◀ Quay lại', () => this.goBack(), { width: 220, height: 56, fontSize: 24 });
    const go = new MenuButton(this, 470, 660, 'CHIẾN ĐẤU! ▶', () => this.confirm(), { width: 300, height: 64, fontSize: 30, color: 0xb3261e });
    go.setFocus(true);
    void back;

    const kb = this.input.keyboard;
    kb?.on('keydown', (ev: KeyboardEvent) => {
      AudioSystem.get().unlock();
      if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') this.select((this.index + 2) % 3);
      else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') this.select((this.index + 1) % 3);
      else if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'j' || ev.key === 'J') this.confirm();
      else if (ev.key === 'Escape' || ev.key === 'Backspace') this.goBack();
    });
    this.select(this.index, true);
  }

  private goBack(): void {
    AudioSystem.get().play('ui');
    this.scene.start(this.dataIn.next === 'stage' && this.dataIn.stageId && this.dataIn.stageId > 1 ? 'StageSelectScene' : 'MenuScene');
  }

  private select(i: number, silent = false): void {
    this.index = i;
    if (!silent) AudioSystem.get().play('ui');
    this.cards.forEach((card, j) => {
      const on = j === i;
      const id = CHARACTER_ORDER[j];
      const col = CHARACTERS[id].palette.suit;
      const f = this.frames[j];
      f.clear();
      f.fillStyle(0x000000, 0.45).fillRoundedRect(-92, -180, 196, 380, 18);
      f.fillStyle(col, on ? 1 : 0.55).fillRoundedRect(-98, -186, 196, 380, 18);
      f.lineStyle(on ? 7 : 3, on ? 0xffd23f : 0x2a3a70, 1).strokeRoundedRect(-98, -186, 196, 380, 18);
      this.badges[j].setVisible(on);
      this.tweens.add({ targets: card, scale: on ? 1.06 : 0.94, duration: 160 });
      card.setAlpha(on ? 1 : 0.75);
    });
    this.buildInfo(CHARACTER_ORDER[i]);
  }

  private buildInfo(id: CharacterId): void {
    this.info.removeAll(true);
    this.rig?.destroy();
    const c = CHARACTERS[id];
    const x0 = 690;
    const bg = this.add.graphics();
    bg.fillStyle(0x0f1a3d, 0.92).fillRoundedRect(x0, 100, 570, 600, 20);
    bg.lineStyle(4, c.palette.suit, 1).strokeRoundedRect(x0, 100, 570, 600, 20);
    const name = this.add.text(x0 + 30, 118, `${c.displayName} — ${c.title}`, { fontFamily: FONT, fontSize: '32px', fontStyle: '800', color: '#ffffff' });
    const desc = this.add.text(x0 + 30, 164, c.description, { fontFamily: FONT, fontSize: '18px', color: '#c9d6ff', wordWrap: { width: 330 } });
    this.info.add([bg, name, desc]);
    const stats: Array<[string, number, string]> = [
      ['Máu (HP)', c.maxHp / 26, `${c.maxHp}`],
      ['Tốc độ', c.ui.speed, `${c.moveSpeed}`],
      ['Sức mạnh', c.ui.power, ''],
      ['Phòng thủ', c.ui.defense, ''],
    ];
    stats.forEach(([label, v, val], k) => {
      const y = 240 + k * 34;
      const t = this.add.text(x0 + 30, y, label, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' });
      const g = this.add.graphics();
      for (let s = 0; s < 5; s++) {
        g.fillStyle(s < Math.round(v) ? 0xffd23f : 0x2a3560, 1).fillRoundedRect(x0 + 150 + s * 38, y + 4, 32, 16, 4);
      }
      const vt = this.add.text(x0 + 345, y, val, { fontFamily: FONT, fontSize: '16px', color: '#c9d6ff' });
      this.info.add([t, g, vt]);
    });
    const sk = this.add.text(x0 + 30, 384, 'KỸ NĂNG', { fontFamily: FONT, fontSize: '20px', fontStyle: '800', color: '#ffd23f' });
    this.info.add(sk);
    [...c.skills, c.ultimate].forEach((mid, k) => {
      const m = getMove(mid);
      const key = k < 3 ? `K (${k + 1})` : 'U';
      const t = this.add.text(x0 + 30, 416 + k * 30, `${key}  ${m.name}`, { fontFamily: FONT, fontSize: '18px', color: k === 3 ? '#ffd23f' : '#ffffff' });
      const cost = this.add.text(x0 + 300, 416 + k * 30, `${m.energyCost} EN • ${m.baseDamage} dmg`, { fontFamily: FONT, fontSize: '16px', color: '#9ad0ff' });
      this.info.add([t, cost]);
    });
    const combo = this.add.text(x0 + 30, 546, `Combo J-J-J: ${c.lightChain.map((x) => getMove(x).name).join(' → ')}`, {
      fontFamily: FONT,
      fontSize: '16px',
      color: '#c9d6ff',
      wordWrap: { width: 500 },
    });
    this.info.add(combo);
    this.rig = createHeroView(this, id, 1.35);
    this.rig.setPosition(x0 + 460, 360);
    this.rig.setDepth(10);
    this.demoT = 0;
    this.demoI = 0;
  }

  private confirm(): void {
    const id = CHARACTER_ORDER[this.index];
    SaveSystem.get().setCharacter(id);
    AudioSystem.get().unlock();
    AudioSystem.get().play('confirm');
    if (this.dataIn.next === 'stage') this.scene.start('StageIntroScene', { stageId: this.dataIn.stageId ?? 1, hard: this.dataIn.hard });
    else this.scene.start('MenuScene');
  }

  update(_t: number, dt: number): void {
    if (!this.rig) return;
    this.demoT += dt;
    if (this.demoT > 1500) {
      this.demoT = 0;
      const c = CHARACTERS[CHARACTER_ORDER[this.index]];
      const seq = [...c.lightChain, ...c.skills, c.ultimate];
      this.rig.playMove(getMove(seq[this.demoI % seq.length]));
      this.demoI++;
    }
    if (this.rig.animDone) this.rig.play('idle');
    this.rig.update(dt);
  }
}

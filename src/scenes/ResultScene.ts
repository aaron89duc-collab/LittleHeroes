import Phaser from 'phaser';
import { HEADS } from '../art/registry';
import { getStage, STAGE_COUNT } from '../config/stages';
import { FONT } from '../game/constants';
import { Rig } from '../rig/Rig';
import { DOWN, VICTORY, VICTORY2 } from '../rig/Poses';
import { AudioSystem } from '../systems/AudioSystem';
import type { RunStats } from '../systems/GameWorld';
import { SaveSystem } from '../systems/SaveSystem';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav, panel, title } from '../ui/MenuComponents';

export interface ResultData {
  victory: boolean;
  stageId: number;
  hard?: boolean;
  score: number;
  reward?: number;
  timeBonus?: number;
  total?: number;
  stats: RunStats;
  checkpoint?: boolean;
  checkpointScore?: number;
  losses?: number;
  fromEnding?: boolean;
}

export function rankFor(total: number, stageId: number, damageTaken: number): string {
  const par = 4000 + stageId * 1500;
  const k = total / par - damageTaken / 400;
  return k > 1.5 ? 'S' : k > 1.1 ? 'A' : k > 0.7 ? 'B' : 'C';
}

export class ResultScene extends Phaser.Scene {
  private rig: Rig | null = null;

  constructor() {
    super('ResultScene');
  }

  create(d: ResultData): void {
    const s = getStage(d.stageId);
    new Backdrop(this, s.theme, 0.55);
    panel(this, 90, 50, 1100, 620);
    const save = SaveSystem.get();
    const id = save.data.selectedCharacter;
    const h = HEADS[`head-${id}`];
    this.rig = new Rig(this, { partKey: `rig-${id}`, headKey: h.key, headHeight: h.height, headAnchorY: h.anchorY, headOffsetX: h.offsetX, scale: 1.9, tailKey: id === 'shu-shu' ? 'tail-shu-shu' : undefined, bulk: id === 'bap' ? 1.12 : 1 });
    this.rig.setPosition(300, 560);
    if (d.victory) {
      this.rig.hold('v', VICTORY, 200);
      this.time.addEvent({ delay: 500, loop: true, callback: () => this.rig?.hold('v', Math.random() < 0.5 ? VICTORY : VICTORY2, 200) });
    } else {
      this.rig.hold('down', DOWN, 10);
      this.rig.setLie(85);
      this.rig.setPosition(430, 590);
    }
    this.add.image(300, 562, 'fx-shadow').setScale(3, 2).setDepth(-1);

    title(this, 760, 100, d.victory ? 'HOÀN THÀNH MÀN!' : 'THẤT BẠI...', 52, d.victory ? '#ffd23f' : '#ff6b6b');
    this.add.text(760, 150, `Màn ${s.id}: ${s.name}${d.hard ? ' (Khó)' : ''}`, { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const st = d.stats;
    const rows: Array<[string, string]> = [
      ['Điểm chiến đấu', `${d.score}`],
      ['Hạ gục', `${st.kills}`],
      ['Combo cao nhất', `${st.maxCombo} hit`],
      ['Sát thương nhận', `${Math.round(st.damageTaken)}`],
      ['Thời gian', `${Math.floor(st.timeMs / 60000)}:${String(Math.floor((st.timeMs % 60000) / 1000)).padStart(2, '0')}`],
    ];
    if (s.rescueNpcs) rows.push(['Giải cứu người dân', `${st.rescued}/${s.rescueNpcs}`]);
    if (d.victory) {
      rows.push(['Thưởng hoàn thành', `+${d.reward ?? 0}`]);
      rows.push(['Thưởng thời gian', `+${d.timeBonus ?? 0}`]);
    }
    rows.forEach(([k, v], i) => {
      this.add.text(560, 190 + i * 36, k, { fontFamily: FONT, fontSize: '22px', color: '#c9d6ff' });
      this.add.text(1000, 190 + i * 36, v, { fontFamily: FONT, fontSize: '22px', fontStyle: '800', color: '#ffffff' }).setOrigin(1, 0);
    });
    const bottomY = 190 + rows.length * 36 + 10;
    if (d.victory && d.total !== undefined) {
      const rank = rankFor(d.total, d.stageId, st.damageTaken);
      this.add.text(560, bottomY, `TỔNG: ${d.total}`, { fontFamily: FONT, fontSize: '32px', fontStyle: '800', color: '#ffd23f' });
      const best = save.data.bestScores[`${d.stageId}`] ?? d.total;
      this.add.text(560, bottomY + 42, `Kỷ lục: ${best} • ${getStage(d.stageId).reward}`, { fontFamily: FONT, fontSize: '18px', color: '#9ad0ff', wordWrap: { width: 470 } });
      const r = title(this, 1090, bottomY + 10, rank, 90, rank === 'S' ? '#ffd23f' : '#ffffff');
      r.setScale(0);
      this.tweens.add({ targets: r, scale: 1, duration: 400, delay: 400, ease: 'Back.easeOut' });
      AudioSystem.get().play('victory');
    } else if (!d.victory && (d.losses ?? 0) >= 3) {
      this.add.text(560, bottomY, 'Gợi ý: hãy né (L) khi thấy vùng cảnh báo "!" và dùng kỹ năng khi đủ EN.', {
        fontFamily: FONT, fontSize: '18px', color: '#ffe066', wordWrap: { width: 520 },
      });
    }

    const buttons: MenuButton[] = [];
    const by = 600;
    if (d.victory) {
      if (d.stageId < STAGE_COUNT) buttons.push(new MenuButton(this, 560, by, 'Màn tiếp ▶', () => this.scene.start('StageIntroScene', { stageId: d.stageId + 1, hard: d.hard }), { width: 260, color: 0x1e5a3a }));
      buttons.push(new MenuButton(this, 840, by, 'Chơi lại', () => this.scene.start('StageIntroScene', { stageId: d.stageId, hard: d.hard }), { width: 220 }));
      buttons.push(new MenuButton(this, 1070, by, 'Menu', () => this.scene.start('MenuScene'), { width: 180 }));
    } else {
      if (d.checkpoint)
        buttons.push(new MenuButton(this, 560, by, 'Từ checkpoint', () => this.scene.start('GameScene', { stageId: d.stageId, hard: d.hard, checkpoint: true }), { width: 250, color: 0x1e5a3a, sub: 'Trước trận boss' }));
      buttons.push(new MenuButton(this, d.checkpoint ? 830 : 640, by, 'Chơi lại màn', () => this.scene.start('StageIntroScene', { stageId: d.stageId, hard: d.hard }), { width: 260 }));
      buttons.push(new MenuButton(this, 1070, by, 'Menu', () => this.scene.start('MenuScene'), { width: 180 }));
      if ((d.losses ?? 0) >= 3) {
        const key = `assist-${d.stageId}`;
        const on = (): boolean => !!this.registry.get(key);
        const assist: MenuButton = new MenuButton(this, 760, 520, `Hỗ trợ: giảm 10% sát thương nhận vào — ${on() ? 'BẬT' : 'TẮT'}`, () => {
          this.registry.set(key, !on());
          assist.setLabel(`Hỗ trợ: giảm 10% sát thương nhận vào — ${on() ? 'BẬT' : 'TẮT'}`);
        }, { width: 620, height: 50, fontSize: 19, color: 0x34407a });
        buttons.unshift(assist);
      }
    }
    new MenuNav(this, buttons, 1);
  }

  update(_t: number, dt: number): void {
    this.rig?.update(dt);
  }
}

import Phaser from 'phaser';
import { CHARACTER_ORDER, CHARACTERS } from '../config/characters';
import { STAGES } from '../config/stages';
import { BASE_W, GAME_W, UI_OFFSET } from '../game/constants';
import { CoopNet, normalizeCode } from '../net/Net';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type { CharacterId } from '../types/game';
import { Backdrop } from '../ui/Backdrop';
import { title } from '../ui/MenuComponents';

interface LobbyData {
  /** join this room right away (from a ?room=CODE link) */
  join?: string;
  /** coming back from a co-op stage */
  result?: { victory?: boolean; stageId?: number; total?: number; score?: number };
  error?: string;
}

const CSS = `
#coop-ui{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:"Baloo 2",system-ui,sans-serif;color:#fff}
#coop-ui .box{pointer-events:auto;width:min(560px,92vw);max-height:92dvh;overflow:auto;background:rgba(11,18,48,.94);border:3px solid #3a5bd0;border-radius:18px;padding:18px 22px;box-sizing:border-box;box-shadow:0 10px 40px rgba(0,0,0,.5);-webkit-user-select:text;user-select:text;touch-action:auto}
#coop-ui h2{margin:0 0 6px;color:#ffd23f;font-size:28px;text-align:center}
#coop-ui p{margin:6px 0;color:#c9d6ff;font-size:16px;line-height:1.35}
#coop-ui .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin:10px 0}
#coop-ui button{font:800 18px "Baloo 2",system-ui,sans-serif;color:#0b1230;background:#ffd23f;border:0;border-radius:12px;padding:10px 18px;box-shadow:0 4px 0 #a87d00;cursor:pointer}
#coop-ui button.sec{background:#2a3f8f;color:#fff;box-shadow:0 4px 0 #142060}
#coop-ui button.red{background:#a8322a;color:#fff;box-shadow:0 4px 0 #5c140e}
#coop-ui button:disabled{opacity:.45;cursor:default}
#coop-ui button.on{outline:3px solid #fff}
#coop-ui input,#coop-ui select{font:800 22px "Baloo 2",system-ui,sans-serif;border-radius:10px;border:2px solid #3a5bd0;background:#0b1230;color:#fff;padding:8px 12px}
#coop-ui input{width:150px;text-transform:uppercase;letter-spacing:4px;text-align:center}
#coop-ui select{font-size:17px;max-width:100%}
#coop-ui .code{font-size:46px;font-weight:800;letter-spacing:10px;color:#ffd23f;text-align:center;margin:4px 0}
#coop-ui .msg{min-height:22px;text-align:center;color:#ff9a9a;font-size:15px}
#coop-ui .ok{color:#7dff6a}
#coop-ui .note{font-size:13px;opacity:.75;text-align:center}
#coop-ui .who{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
#coop-ui .who div{background:#13204a;border-radius:12px;padding:8px;text-align:center;font-size:15px}
#coop-ui .who b{display:block;font-size:19px}
#coop-ui .res{background:#13204a;border-radius:12px;padding:8px;text-align:center;margin-bottom:6px}
`;

/**
 * Online co-op lobby (HTML overlay, so the room code can be typed on any device):
 * create a room / join with a code → both pick a hero → the host picks a stage and starts.
 */
export class CoopLobbyScene extends Phaser.Scene {
  private d!: LobbyData;
  private net = CoopNet.get();
  private root: HTMLDivElement | null = null;
  private offs: Array<() => void> = [];
  private myChar: CharacterId = 'dau-dau';
  private mateChar: CharacterId | null = null;
  private mateW = GAME_W;
  private stageId = 1;
  private hostStages: number[] = [1];
  private msg = '';
  private busy = false;

  constructor() {
    super('CoopLobbyScene');
  }

  init(d: LobbyData): void {
    this.d = d ?? {};
    this.offs = [];
    this.msg = d?.error ?? '';
    this.busy = false;
    this.myChar = SaveSystem.get().data.selectedCharacter;
    this.mateChar = null;
  }

  create(): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    new Backdrop(this, 'street', 0.55);
    title(this, BASE_W / 2, 50, 'CHƠI CÙNG BẠN (ONLINE)', 40);
    // typing in the code box must not be swallowed by the game's keyboard capture
    this.input.keyboard?.disableGlobalCapture();
    this.input.keyboard?.clearCaptures();
    AudioSystem.get().playMusic(10);

    const style = document.createElement('style');
    style.id = 'coop-css';
    if (!document.getElementById('coop-css')) {
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.root = document.createElement('div');
    this.root.id = 'coop-ui';
    document.body.appendChild(this.root);

    const n = this.net;
    this.offs.push(
      n.on('status', () => this.render()),
      n.on('hello', (m) => {
        // host: a guest arrived
        this.mateChar = m.c as CharacterId;
        this.mateW = Number(m.w) || GAME_W;
        this.syncLobby();
        this.render();
      }),
      n.on('lobby', (m) => {
        // guest: room state from the host
        this.mateChar = m.hc as CharacterId;
        this.stageId = Number(m.st);
        this.render();
      }),
      n.on('char', (m) => {
        this.mateChar = m.c as CharacterId;
        if (n.isHost) this.syncLobby();
        this.render();
      }),
      n.on('start', (m) => this.guestStart(m.st as number, m.hc as CharacterId)),
      n.on('close', (m) => {
        this.mateChar = null;
        this.msg = String(m.reason ?? 'Mất kết nối.');
        if (n.isGuest) n.leave(false);
        this.render();
      }),
      n.on('bye', () => {
        this.mateChar = null;
        this.msg = n.isHost ? 'Bạn đồng hành đã rời phòng. Mã phòng vẫn dùng được.' : 'Chủ phòng đã đóng phòng.';
        if (n.isGuest) n.leave(false);
        this.render();
      }),
      n.on('error', (m) => {
        this.msg = m.type === 'room-full' ? 'Phòng đã đủ 2 người.' : `Lỗi kết nối (${String(m.type)}).`;
        this.render();
      }),
    );
    this.events.once('shutdown', () => this.cleanup());

    const save = SaveSystem.get().data;
    this.hostStages = STAGES.filter((s) => s.id <= save.highestUnlockedStage).map((s) => s.id);
    this.stageId = Math.min(save.highestUnlockedStage, STAGES.length);
    if (this.d.result?.victory && this.d.result.stageId) this.stageId = Math.min(STAGES.length, this.d.result.stageId + 1);

    // back in the lobby after a stage: tell the partner our hero again
    if (n.connected) {
      if (n.isGuest) n.send({ t: 'hello', c: this.myChar, w: GAME_W });
      else this.syncLobby();
    }
    this.render();
    if (this.d.join && !n.connected) void this.doJoin(this.d.join);
  }

  private syncLobby(): void {
    if (!this.net.isHost) return;
    this.net.send({ t: 'lobby', hc: this.myChar, st: this.stageId });
  }

  private esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  }

  private shareLink(): string {
    const u = new URL(location.href);
    u.search = `?room=${this.net.code}`;
    u.hash = '';
    return u.toString();
  }

  private render(): void {
    const r = this.root;
    if (!r) return;
    const n = this.net;
    const st = n.status;
    let html = '<div class="box">';
    const res = this.d.result;
    if (res && res.stageId) {
      html += `<div class="res">${res.victory ? `🏆 Đã qua <b>Màn ${res.stageId}</b>!` : `💥 Thua ở Màn ${res.stageId}.`} Điểm: <b>${res.total ?? res.score ?? 0}</b></div>`;
    }
    if (!n.role || st === 'idle' || st === 'closed') {
      html += `<h2>Co-op 2 người</h2>
        <p>Một người <b>tạo phòng</b> rồi gửi mã cho bạn. Người kia nhập mã để vào. Máy chủ phòng sẽ chạy trận đấu, nên chủ phòng nên dùng máy mạnh và mạng ổn định.</p>
        <div class="row"><button id="c-host">➕ Tạo phòng</button></div>
        <div class="row"><input id="c-code" maxlength="8" placeholder="MÃ" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${this.esc(this.d.join ?? '')}"><button id="c-join" class="sec">Vào phòng</button></div>`;
    } else if (st === 'opening' || st === 'connecting') {
      html += `<h2>Đang kết nối…</h2><p style="text-align:center">${st === 'opening' ? 'Đang mở phòng' : 'Đang tìm phòng ' + this.esc(n.code)}…</p>`;
    } else if (n.isHost && st === 'waiting') {
      html += `<h2>Phòng của bạn</h2><div class="code">${this.esc(n.code)}</div>
        <p style="text-align:center">Gửi mã này (hoặc đường link) cho bạn của bạn, rồi chờ bạn ấy vào phòng…</p>
        <div class="row"><button id="c-copy" class="sec">📋 Sao chép link mời</button></div>`;
    } else if (st === 'connected') {
      const mine = CHARACTERS[this.myChar];
      const mate = this.mateChar ? CHARACTERS[this.mateChar] : null;
      html += `<h2>${n.isHost ? 'Phòng ' + this.esc(n.code) : 'Đã vào phòng ' + this.esc(n.code)}</h2>
        <div class="who"><div>Bạn (${n.isHost ? 'P1' : 'P2'})<b>${mine.displayName}</b></div><div>Đồng đội (${n.isHost ? 'P2' : 'P1'})<b>${mate ? mate.displayName : '…'}</b></div></div>
        <p style="text-align:center;margin-top:10px">Chọn nhân vật của bạn:</p>
        <div class="row">${CHARACTER_ORDER.map((id) => `<button class="sec ${id === this.myChar ? 'on' : ''}" data-char="${id}">${CHARACTERS[id].displayName}</button>`).join('')}</div>`;
      if (n.isHost) {
        html += `<div class="row"><select id="c-stage">${this.hostStages
          .map((id) => `<option value="${id}" ${id === this.stageId ? 'selected' : ''}>Màn ${id} — ${this.esc(STAGES[id - 1].name)}</option>`)
          .join('')}</select></div>
          <div class="row"><button id="c-start" ${this.mateChar ? '' : 'disabled'}>▶ BẮT ĐẦU</button></div>`;
      } else {
        html += `<p style="text-align:center">Màn sẽ chơi: <b>Màn ${this.stageId} — ${this.esc(STAGES[this.stageId - 1]?.name ?? '')}</b><br>Chờ chủ phòng bấm Bắt đầu…</p>`;
      }
      html += `<p class="note">Ping: ${n.rtt || '–'} ms</p>`;
    }
    html += `<div class="msg ${this.msg.startsWith('✓') ? 'ok' : ''}">${this.esc(this.msg)}</div>`;
    html += `<div class="row">${n.role ? '<button id="c-leave" class="red">Rời phòng</button>' : ''}<button id="c-back" class="sec">◀ Về menu</button></div>`;
    html += `<p class="note">Kết nối trực tiếp giữa 2 máy (WebRTC). Phím trên máy tính: ◀▲▼▶ di chuyển, A đánh, S kỹ năng, D né, Z nhảy, X tuyệt kỹ.</p></div>`;
    r.innerHTML = html;

    const $ = (id: string) => r.querySelector<HTMLElement>('#' + id);
    $('c-host')?.addEventListener('click', () => void this.doHost());
    $('c-join')?.addEventListener('click', () => void this.doJoin(($('c-code') as HTMLInputElement).value));
    $('c-code')?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e as KeyboardEvent).key === 'Enter') void this.doJoin(($('c-code') as HTMLInputElement).value);
    });
    $('c-copy')?.addEventListener('click', () => {
      const link = this.shareLink();
      void navigator.clipboard?.writeText(link).then(
        () => {
          this.msg = '✓ Đã sao chép link mời';
          this.render();
        },
        () => {
          this.msg = link;
          this.render();
        },
      );
      if (!navigator.clipboard) {
        this.msg = link;
        this.render();
      }
    });
    r.querySelectorAll<HTMLButtonElement>('button[data-char]').forEach((b) =>
      b.addEventListener('click', () => {
        this.myChar = b.dataset.char as CharacterId;
        SaveSystem.get().setCharacter(this.myChar);
        n.send({ t: 'char', c: this.myChar });
        if (n.isHost) this.syncLobby();
        AudioSystem.get().play('ui');
        this.render();
      }),
    );
    $('c-stage')?.addEventListener('change', (e) => {
      this.stageId = Number((e.target as HTMLSelectElement).value);
      this.syncLobby();
    });
    $('c-start')?.addEventListener('click', () => this.hostStart());
    $('c-leave')?.addEventListener('click', () => {
      n.leave();
      this.mateChar = null;
      this.msg = '';
      this.render();
    });
    $('c-back')?.addEventListener('click', () => {
      n.leave();
      this.scene.start('MenuScene');
    });
  }

  private async doHost(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.msg = '';
    AudioSystem.get().unlock();
    try {
      await this.net.host();
    } catch (e) {
      this.msg = (e as Error).message || 'Không tạo được phòng.';
    }
    this.busy = false;
    this.render();
  }

  private async doJoin(raw: string): Promise<void> {
    if (this.busy) return;
    const code = normalizeCode(raw);
    if (code.length < 4) {
      this.msg = 'Nhập mã phòng (5 ký tự).';
      this.render();
      return;
    }
    this.busy = true;
    this.msg = '';
    AudioSystem.get().unlock();
    try {
      await this.net.join(code);
      this.net.send({ t: 'hello', c: this.myChar, w: GAME_W });
      this.msg = '✓ Đã vào phòng';
    } catch (e) {
      this.msg = (e as Error).message || 'Không vào được phòng.';
      this.net.leave(false);
    }
    this.busy = false;
    this.render();
  }

  private hostStart(): void {
    if (!this.net.isHost || !this.mateChar) return;
    const coop = { hostChar: this.myChar, guestChar: this.mateChar, guestW: this.mateW };
    this.net.send({ t: 'start', st: this.stageId, hc: this.myChar });
    AudioSystem.get().play('confirm');
    this.scene.start('GameScene', { stageId: this.stageId, coop });
  }

  private guestStart(stageId: number, hostChar: CharacterId): void {
    if (!this.net.isGuest) return;
    AudioSystem.get().play('confirm');
    this.scene.start('CoopGuestScene', { stageId, hostChar, guestChar: this.myChar });
  }

  private cleanup(): void {
    this.offs.forEach((f) => f());
    this.offs = [];
    this.root?.remove();
    this.root = null;
    this.input.keyboard?.enableGlobalCapture();
  }
}

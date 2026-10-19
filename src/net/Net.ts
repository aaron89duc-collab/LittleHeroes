import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { isNativeApp, PUBLIC_URL } from '../systems/Platform';

/**
 * Online co-op transport: a direct WebRTC data channel between the two players (PeerJS).
 *
 *  - The host's browser runs the whole game; the guest sends its inputs and draws what the host sends.
 *  - PeerJS's free public signalling server is only used to find each other (room code → peer id).
 *  - ICE servers (STUN + optional TURN relay for strict mobile/office networks) come from the
 *    Vercel function /api/ice, which keeps the TURN API key secret. Without it, public STUN is used.
 */

export type NetRole = 'host' | 'guest';
export type NetStatus = 'idle' | 'opening' | 'waiting' | 'connecting' | 'connected' | 'closed';

/** Any message sent between the two browsers. `t` is the message type. */
export interface NetMsg {
  t: string;
  [k: string]: unknown;
}

type Handler = (msg: NetMsg) => void;

const ID_PREFIX = 'little-heroes-rcb-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const HEARTBEAT_MS = 1000;
const TIMEOUT_MS = 8000;

const DEFAULT_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

function randomCode(n = 5): string {
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/** STUN/TURN list from the Vercel function (falls back to public STUN when it is missing or slow). */
async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    // the Android app is served from https://localhost: ask the public site instead
    const r = await fetch(isNativeApp() ? `${PUBLIC_URL}/api/ice` : '/api/ice', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { iceServers?: RTCIceServer[] };
    if (Array.isArray(j.iceServers) && j.iceServers.length) return j.iceServers;
  } catch (e) {
    console.info('[coop] /api/ice unavailable, using public STUN only', e);
  }
  return DEFAULT_ICE;
}

/** Optional self-hosted PeerJS server (VITE_PEER_HOST etc.); default = PeerJS free cloud server. */
function peerOptions(ice: RTCIceServer[]): PeerOptions {
  const env = import.meta.env;
  const o: PeerOptions = { config: { iceServers: ice }, debug: 1 };
  if (env.VITE_PEER_HOST) {
    o.host = env.VITE_PEER_HOST;
    o.port = Number(env.VITE_PEER_PORT ?? 443);
    o.path = env.VITE_PEER_PATH ?? '/';
    o.secure = (env.VITE_PEER_SECURE ?? 'true') !== 'false';
  }
  return o;
}

export class CoopNet {
  private static inst: CoopNet | null = null;
  role: NetRole | null = null;
  status: NetStatus = 'idle';
  code = '';
  /** latest round-trip time (ms) */
  rtt = 0;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private lastSeen = 0;
  private beat: number | null = null;

  static get(): CoopNet {
    if (!CoopNet.inst) CoopNet.inst = new CoopNet();
    return CoopNet.inst;
  }

  get connected(): boolean {
    return this.status === 'connected';
  }

  get isHost(): boolean {
    return this.role === 'host';
  }

  get isGuest(): boolean {
    return this.role === 'guest';
  }

  /** Subscribe to a message type ('*' = all; 'close' / 'error' / 'status' are local events). Returns an unsubscribe fn. */
  on(type: string, fn: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  private emit(msg: NetMsg): void {
    this.handlers.get(msg.t)?.forEach((h) => h(msg));
    this.handlers.get('*')?.forEach((h) => h(msg));
  }

  private setStatus(s: NetStatus, info = ''): void {
    this.status = s;
    this.emit({ t: 'status', status: s, info });
  }

  send(msg: NetMsg): void {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
      } catch (e) {
        console.warn('[coop] send failed', e);
      }
    }
  }

  /** Create a room and wait for one partner. Resolves with the room code. */
  async host(): Promise<string> {
    this.leave(false);
    this.role = 'host';
    this.setStatus('opening');
    const ice = await fetchIceServers();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = randomCode();
      try {
        await this.openPeer(ID_PREFIX + code, ice);
        this.code = code;
        this.setStatus('waiting');
        this.peer!.on('connection', (c) => {
          if (this.conn && this.conn.open) {
            // room full
            c.on('open', () => {
              c.send({ t: 'full' });
              setTimeout(() => c.close(), 300);
            });
            return;
          }
          this.attach(c);
        });
        return code;
      } catch (e) {
        if ((e as { type?: string }).type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Không tạo được mã phòng, thử lại nhé.');
  }

  /** Join a room by its code. */
  async join(rawCode: string): Promise<void> {
    const code = normalizeCode(rawCode);
    if (code.length < 4) throw new Error('Mã phòng chưa đúng.');
    this.leave(false);
    this.role = 'guest';
    this.code = code;
    this.setStatus('opening');
    const ice = await fetchIceServers();
    await this.openPeer(undefined, ice);
    this.setStatus('connecting');
    const c = this.peer!.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Không kết nối được tới phòng (hết thời gian). Kiểm tra lại mã hoặc mạng.')), 15000);
      const offErr = this.on('error', (m) => {
        clearTimeout(t);
        offErr();
        reject(new Error(m.type === 'peer-unavailable' ? 'Không tìm thấy phòng này.' : `Lỗi kết nối: ${String(m.type)}`));
      });
      c.on('open', () => {
        clearTimeout(t);
        offErr();
        resolve();
      });
      this.attach(c);
    });
  }

  private openPeer(id: string | undefined, ice: RTCIceServer[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = id ? new Peer(id, peerOptions(ice)) : new Peer(peerOptions(ice));
      this.peer = p;
      let opened = false;
      p.on('open', () => {
        opened = true;
        resolve();
      });
      p.on('error', (err) => {
        const type = (err as { type?: string }).type ?? 'unknown';
        console.warn('[coop] peer error', type, err);
        if (!opened) {
          p.destroy();
          reject(err);
          return;
        }
        this.emit({ t: 'error', type });
      });
      // lost the signalling server: the direct link keeps working, try to re-register quietly
      p.on('disconnected', () => {
        if (!p.destroyed) setTimeout(() => !p.destroyed && p.reconnect(), 2000);
      });
    });
  }

  private attach(c: DataConnection): void {
    this.conn = c;
    const onOpen = () => {
      this.lastSeen = performance.now();
      this.setStatus('connected');
      this.startHeartbeat();
    };
    if (c.open) onOpen();
    else c.on('open', onOpen);
    c.on('data', (d) => {
      this.lastSeen = performance.now();
      const msg = d as NetMsg;
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'ping') {
        this.send({ t: 'pong', at: msg.at });
        return;
      }
      if (msg.t === 'pong') {
        this.rtt = Math.round(performance.now() - Number(msg.at));
        return;
      }
      if (msg.t === 'full') {
        this.emit({ t: 'error', type: 'room-full' });
        return;
      }
      this.emit(msg);
    });
    c.on('close', () => this.dropped('Bạn đồng hành đã rời phòng.'));
    c.on('error', (e) => {
      console.warn('[coop] connection error', e);
      this.dropped('Lỗi kết nối.');
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.beat = window.setInterval(() => {
      this.send({ t: 'ping', at: performance.now() });
      if (performance.now() - this.lastSeen > TIMEOUT_MS) this.dropped('Mất kết nối với bạn đồng hành.');
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.beat !== null) window.clearInterval(this.beat);
    this.beat = null;
  }

  private dropped(reason: string): void {
    if (this.status !== 'connected') return;
    this.stopHeartbeat();
    this.conn = null;
    // host keeps the room open so the partner can come back with the same code
    this.setStatus(this.role === 'host' && this.peer && !this.peer.destroyed ? 'waiting' : 'closed', reason);
    this.emit({ t: 'close', reason });
  }

  /** Leave the room and free everything. */
  leave(notify = true): void {
    this.stopHeartbeat();
    if (notify) this.send({ t: 'bye' });
    const c = this.conn;
    this.conn = null;
    setTimeout(() => c?.close(), 100);
    this.peer?.destroy();
    this.peer = null;
    this.role = null;
    this.code = '';
    if (this.status !== 'idle') this.setStatus('idle');
  }
}

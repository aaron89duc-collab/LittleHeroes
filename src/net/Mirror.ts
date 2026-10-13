import Phaser from 'phaser';

/**
 * Display-list mirroring for online co-op.
 *
 * The host serialises what its GameScene shows (containers, images, sprites, texts, graphics, rectangles)
 * as small deltas ~20×/s; the guest rebuilds the same objects and smooths their movement. Every visual
 * system (heroes, enemies, bosses, telegraphs, effects, damage numbers…) is mirrored without each of them
 * needing its own network code. Backgrounds, weather and particles are drawn locally by the guest.
 */

const enum K {
  Container = 1,
  Image = 2,
  Sprite = 3,
  Text = 4,
  Graphics = 5,
  Rect = 6,
}

const TYPE_OF: Record<string, K> = {
  Container: K.Container,
  Image: K.Image,
  Sprite: K.Sprite,
  Text: K.Text,
  Graphics: K.Graphics,
  Rectangle: K.Rect,
};

// common props
const X = 0,
  Y = 1,
  ROT = 2,
  SX = 3,
  SY = 4,
  ALPHA = 5,
  VIS = 6,
  DEPTH = 7,
  SF = 8,
  BLEND = 9;
// type specific props start at 10
const P0 = 10;

type Val = number | string | null;
type Obj = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
  depth: number;
  scrollFactorX: number;
  blendMode: number | string;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

function textStyle(t: Phaser.GameObjects.Text): Phaser.Types.GameObjects.Text.TextStyle {
  const s = t.style;
  const o: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontStyle: s.fontStyle,
    color: s.color as string,
    stroke: s.stroke as string,
    strokeThickness: s.strokeThickness,
    align: s.align,
    padding: { ...t.padding },
  };
  if (s.backgroundColor) o.backgroundColor = s.backgroundColor;
  if (s.wordWrapWidth) o.wordWrap = { width: s.wordWrapWidth };
  if (s.fixedWidth) o.fixedWidth = s.fixedWidth;
  if (s.shadowBlur || s.shadowOffsetX || s.shadowOffsetY) {
    o.shadow = { offsetX: s.shadowOffsetX, offsetY: s.shadowOffsetY, color: s.shadowColor, blur: s.shadowBlur, stroke: s.shadowStroke, fill: s.shadowFill };
  }
  return o;
}

function propsOf(o: Obj, k: K, ids: (c: Phaser.GameObjects.GameObject) => number): Val[] {
  const v: Val[] = [r1(o.x), r1(o.y), r3(o.rotation), r3(o.scaleX), r3(o.scaleY), r2(o.alpha), o.visible ? 1 : 0, Math.round(o.depth), o.scrollFactorX, typeof o.blendMode === 'number' ? o.blendMode : 0];
  switch (k) {
    case K.Image:
    case K.Sprite: {
      const im = o as unknown as Phaser.GameObjects.Image;
      v.push(im.texture.key, String(im.frame.name), r3(im.originX), r3(im.originY), im.flipX ? 1 : 0, im.flipY ? 1 : 0, im.tintTopLeft, im.tintFill ? 1 : 0);
      break;
    }
    case K.Text: {
      const t = o as unknown as Phaser.GameObjects.Text;
      v.push(t.text, JSON.stringify(textStyle(t)), r3(t.originX), r3(t.originY));
      break;
    }
    case K.Graphics:
      v.push(JSON.stringify((o as unknown as Phaser.GameObjects.Graphics).commandBuffer));
      break;
    case K.Rect: {
      const r = o as unknown as Phaser.GameObjects.Rectangle;
      v.push(r.width, r.height, r.isFilled ? r.fillColor : -1, r2(r.fillAlpha), r3(r.originX), r3(r.originY), r.isStroked ? r.strokeColor : -1, r.lineWidth);
      break;
    }
    case K.Container:
      v.push((o as unknown as Phaser.GameObjects.Container).list.map(ids).filter((n) => n > 0).join(','));
      break;
  }
  return v;
}

/** Host side: turns the scene's display list into delta messages. */
export class MirrorHost {
  private ids = new WeakMap<Phaser.GameObjects.GameObject, number>();
  private parentOf = new Map<number, number>();
  private last = new Map<number, Val[]>();
  private nextId = 1;

  constructor(private scene: Phaser.Scene) {}

  /** Forget what the guest has: the next diff re-sends everything (guest (re)joined). */
  reset(): void {
    this.ids = new WeakMap();
    this.parentOf.clear();
    this.last.clear();
  }

  private idOf = (o: Phaser.GameObjects.GameObject): number => {
    if (!TYPE_OF[o.type] || o.getData?.('noMirror')) return 0;
    let id = this.ids.get(o);
    if (!id) {
      id = this.nextId++;
      this.ids.set(o, id);
    }
    return id;
  };

  /**
   * c: created  [id, parentId, type, ...props]
   * u: updated  [id, propIndex, value, propIndex, value, …]
   * d: deleted ids
   */
  diff(): { c: Val[][]; u: Val[][]; d: number[] } {
    const c: Val[][] = [];
    const u: Val[][] = [];
    const seen = new Set<number>();
    const walk = (o: Phaser.GameObjects.GameObject, parent: number) => {
      const k = TYPE_OF[o.type];
      if (!k || o.getData?.('noMirror')) return;
      let id = this.idOf(o);
      if (this.parentOf.has(id) && this.parentOf.get(id) !== parent) {
        // re-parented: treat as a new object
        id = this.nextId++;
        this.ids.set(o, id);
      }
      seen.add(id);
      const props = propsOf(o as Obj, k, this.idOf);
      const prev = this.last.get(id);
      if (!prev) {
        c.push([id, parent, k, ...props]);
        this.parentOf.set(id, parent);
      } else {
        const ch: Val[] = [id];
        for (let i = 0; i < props.length; i++) if (props[i] !== prev[i]) ch.push(i, props[i]);
        if (ch.length > 1) u.push(ch);
      }
      this.last.set(id, props);
      if (k === K.Container) for (const ch of (o as Phaser.GameObjects.Container).list) walk(ch, id);
    };
    for (const o of this.scene.children.list) walk(o, 0);
    const d: number[] = [];
    for (const id of this.last.keys()) {
      if (!seen.has(id)) {
        d.push(id);
        this.last.delete(id);
        this.parentOf.delete(id);
      }
    }
    return { c, u, d };
  }
}

interface Mirrored {
  obj: Obj;
  k: K;
  tx: number;
  ty: number;
  tr: number;
  sf0: boolean;
}

/** Guest side: rebuilds the host's objects and interpolates their motion. */
export class MirrorGuest {
  private objs = new Map<number, Mirrored>();
  /** host screen width (scroll-factor-0 objects are re-centred on the guest's screen) */
  hostW = 1280;

  constructor(
    private scene: Phaser.Scene,
    private guestW: number,
  ) {}

  get count(): number {
    return this.objs.size;
  }

  apply(m: { c?: Val[][]; u?: Val[][]; d?: number[] }): boolean {
    let missing = false;
    for (const id of m.d ?? []) this.remove(id);
    for (const row of m.c ?? []) this.create(row);
    for (const row of m.u ?? []) {
      const e = this.objs.get(row[0] as number);
      if (!e) {
        missing = true;
        continue;
      }
      for (let i = 1; i < row.length; i += 2) this.set(e, row[i] as number, row[i + 1], false);
    }
    return missing;
  }

  private remove(id: number): void {
    const e = this.objs.get(id);
    if (!e) return;
    this.objs.delete(id);
    if (e.obj.scene) e.obj.destroy();
  }

  private create(row: Val[]): void {
    const [id, parent, k] = row as number[];
    const props = row.slice(3);
    this.remove(id);
    const sc = this.scene;
    let obj: Obj;
    switch (k as K) {
      case K.Container:
        obj = sc.add.container(0, 0) as unknown as Obj;
        break;
      case K.Image:
      case K.Sprite: {
        const key = props[P0] as string;
        const has = sc.textures.exists(key);
        const im = k === K.Sprite ? sc.add.sprite(0, 0, has ? key : '__WHITE') : sc.add.image(0, 0, has ? key : '__WHITE');
        if (!has) im.setData('missing', true);
        obj = im as unknown as Obj;
        break;
      }
      case K.Text:
        obj = sc.add.text(0, 0, '', {}) as unknown as Obj;
        break;
      case K.Graphics:
        obj = sc.add.graphics() as unknown as Obj;
        break;
      case K.Rect:
        obj = sc.add.rectangle(0, 0, 1, 1) as unknown as Obj;
        break;
      default:
        return;
    }
    const e: Mirrored = { obj, k: k as K, tx: 0, ty: 0, tr: 0, sf0: false };
    this.objs.set(id, e);
    if (parent) {
      const p = this.objs.get(parent);
      if (p && p.k === K.Container) (p.obj as unknown as Phaser.GameObjects.Container).add(obj);
    }
    for (let i = 0; i < props.length; i++) this.set(e, i, props[i], true);
  }

  private set(e: Mirrored, i: number, v: Val, snap: boolean): void {
    const o = e.obj;
    switch (i) {
      case X:
        e.tx = (v as number) + (e.sf0 ? (this.guestW - this.hostW) / 2 : 0);
        if (snap) o.x = e.tx;
        return;
      case Y:
        e.ty = v as number;
        if (snap) o.y = e.ty;
        return;
      case ROT:
        e.tr = v as number;
        if (snap) o.rotation = e.tr;
        return;
      case SX:
        o.scaleX = v as number;
        return;
      case SY:
        o.scaleY = v as number;
        return;
      case ALPHA:
        o.alpha = v as number;
        return;
      case VIS:
        o.visible = v === 1 && !(o as Phaser.GameObjects.GameObject).getData?.('missing');
        return;
      case DEPTH:
        (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(v as number);
        return;
      case SF:
        (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(v as number);
        e.sf0 = v === 0;
        if (e.sf0 && snap) o.x = e.tx = e.tx + (this.guestW - this.hostW) / 2;
        return;
      case BLEND:
        (o as unknown as Phaser.GameObjects.Components.BlendMode).setBlendMode(v as number);
        return;
    }
    const j = i - P0;
    switch (e.k) {
      case K.Image:
      case K.Sprite: {
        const im = o as unknown as Phaser.GameObjects.Image;
        if (j === 0) {
          const key = v as string;
          if (this.scene.textures.exists(key)) {
            im.setData('missing', false);
            if (im.texture.key !== key) im.setTexture(key);
          }
        } else if (j === 1) {
          if (!im.getData('missing')) {
            const f = v as string;
            if (im.texture.has(f)) im.setFrame(f);
            else if (im.texture.has(Number(f) as unknown as string)) im.setFrame(Number(f));
          }
        } else if (j === 2) im.setOrigin(v as number, im.originY);
        else if (j === 3) im.setOrigin(im.originX, v as number);
        else if (j === 4) im.flipX = v === 1;
        else if (j === 5) im.flipY = v === 1;
        else if (j === 6) im.setData('tint', v);
        else if (j === 7) im.setData('tintFill', v);
        if (j === 6 || j === 7) {
          const t = (im.getData('tint') as number | undefined) ?? 0xffffff;
          if (im.getData('tintFill') === 1) im.setTintFill(t);
          else if (t === 0xffffff) im.clearTint();
          else im.setTint(t);
        }
        return;
      }
      case K.Text: {
        const t = o as unknown as Phaser.GameObjects.Text;
        if (j === 0) t.setText(v as string);
        else if (j === 1) t.setStyle(JSON.parse(v as string));
        else if (j === 2) t.setOrigin(v as number, t.originY);
        else if (j === 3) t.setOrigin(t.originX, v as number);
        return;
      }
      case K.Graphics:
        if (j === 0) (o as unknown as Phaser.GameObjects.Graphics).commandBuffer = JSON.parse(v as string);
        return;
      case K.Rect: {
        const r = o as unknown as Phaser.GameObjects.Rectangle;
        if (j === 0 || j === 1) {
          let w = j === 0 ? (v as number) : r.width;
          const h = j === 1 ? (v as number) : r.height;
          // full-screen flashes: cover the guest's (maybe wider) screen
          if (e.sf0 && w >= this.hostW) w = Math.max(w, this.guestW);
          r.setSize(w, h);
          r.updateDisplayOrigin();
        } else if (j === 2) {
          if ((v as number) < 0) r.isFilled = false;
          else r.setFillStyle(v as number, r.fillAlpha);
        } else if (j === 3) r.fillAlpha = v as number;
        else if (j === 4) r.setOrigin(v as number, r.originY);
        else if (j === 5) r.setOrigin(r.originX, v as number);
        else if (j === 6) {
          if ((v as number) < 0) r.isStroked = false;
          else r.setStrokeStyle(r.lineWidth || 1, v as number);
        } else if (j === 7) r.lineWidth = v as number;
        return;
      }
      case K.Container: {
        if (j !== 0) return;
        const c = o as unknown as Phaser.GameObjects.Container;
        const order = new Map<Phaser.GameObjects.GameObject, number>();
        String(v)
          .split(',')
          .forEach((s, idx) => {
            const ch = this.objs.get(Number(s));
            if (ch) order.set(ch.obj, idx);
          });
        c.list.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
        return;
      }
    }
  }

  /** Smooth positions between snapshots (~20 Hz → 60 fps). */
  update(dt: number): void {
    const k = 1 - Math.exp(-dt / 55);
    for (const e of this.objs.values()) {
      const o = e.obj;
      const dx = e.tx - o.x;
      const dy = e.ty - o.y;
      if (Math.abs(dx) > 260 || Math.abs(dy) > 260) {
        o.x = e.tx;
        o.y = e.ty;
      } else {
        o.x += dx * k;
        o.y += dy * k;
      }
      let dr = e.tr - o.rotation;
      if (dr > Math.PI) dr -= Math.PI * 2;
      if (dr < -Math.PI) dr += Math.PI * 2;
      o.rotation += Math.abs(dr) > 1.2 ? dr : dr * k;
    }
  }

  clear(): void {
    for (const id of [...this.objs.keys()]) this.remove(id);
  }
}

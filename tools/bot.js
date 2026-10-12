// Autopilot injected into the page for smoke tests. Usage: window.__bot.start({god:true})
window.__bot = {
  timer: null, log: [],
  start(opts = {}) {
    const T = window.__touch;
    let tick = 0;
    this.timer = setInterval(() => {
      const g = __game.scene.getScene('GameScene');
      if (!g || !g.sys.isActive() || !g.world || !g.world.player) return;
      const p = g.world.player;
      tick++;
      if (opts.god) { p.hp = p.maxHp; }
      if (opts.energy) p.energy.add(5);
      const targets = [...g.world.hostiles(), ...g.world.pillars.filter(x => x.alive)].filter(e => e.x > g.world.camLeft - 10 && e.x < g.world.camRight + 10);
      if (!targets.length) { T.moveX = 1; T.moveY = Math.sign(580 - p.y) * (Math.abs(580 - p.y) > 20 ? 1 : 0); return; }
      targets.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const t = targets[0];
      const dx = t.x - p.x, dy = t.y - p.y;
      const want = 55 + (t.isBoss ? 30 : 0);
      T.moveY = Math.abs(dy) > 12 ? Math.sign(dy) : 0;
      T.moveX = Math.abs(dx) > want ? Math.sign(dx) : (Math.abs(dx) < 25 ? -Math.sign(dx || 1) : 0);
      if (Math.abs(dx) <= want + 25 && Math.abs(dy) < 26) {
        T.moveX = 0;
        if (p.facing !== Math.sign(dx) && dx !== 0) T.moveX = Math.sign(dx) * 0.5;
        if (p.energy.current >= 100 && tick % 7 === 0) T.press('ultimate');
        else if (p.energy.current >= 35 && tick % 11 === 0) { T.press('cycleSkill'); T.press('skill'); }
        else if (tick % 2 === 0) T.press('attack');
        if (t.z > 100 && tick % 9 === 0) { T.press('jump'); }
      }
    }, 60);
  },
  stop() { clearInterval(this.timer); window.__touch.reset(); },
};

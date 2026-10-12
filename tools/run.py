"""Smoke test runner: plays stages with the autopilot and reports state. usage: run.py <stageId> <seconds> [god]"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
async def main():
    stage = int(sys.argv[1]); secs = int(sys.argv[2]); god = len(sys.argv) > 3 and sys.argv[3] == 'god'
    shots = os.environ.get('SHOTS', '')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text[:300]}') if m.type in ('error','warning') and 'ERR_FAILED' not in m.text and 'swiftshader' not in m.text.lower() else None)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(os.environ.get('BASE','http://127.0.0.1:4173/') + '?renderer=canvas' + os.environ.get('EXTRA',''), timeout=20000)
        await pg.wait_for_timeout(2000)
        cdp = await pg.context.new_cdp_session(pg)
        await cdp.send('Runtime.evaluate', {'expression': open('tools/bot.js').read()})
        cp = 'true' if os.environ.get('CP') else 'false'
        await cdp.send('Runtime.evaluate', {'expression': f"__game.scene.getScenes(true).forEach(s=>s.scene.stop()); __game.scene.start('GameScene',{{stageId:{stage}, checkpoint:{cp}}}); __bot.start({{god:{str(god).lower()}, energy:{'true' if os.environ.get('EN') else 'false'}}})"})
        t = 0
        hooks = {}
        for part in [x for x in os.environ.get('JSAT','').split(';;') if x]:
            k, js = part.split('::', 1); hooks[int(k)] = js
        shot_at = [int(x) for x in shots.split(',') if x]
        while t < secs:
            await asyncio.sleep(1); t += 1
            if t in hooks: await cdp.send('Runtime.evaluate', {'expression': hooks[t]})
            if t in shot_at:
                await pg.screenshot(path=f'/tmp/claude-0/run{stage}_{t}.png')
            if t % 5 == 0 or t == secs:
                r = await cdp.send('Runtime.evaluate', {'expression': """(()=>{const g=__game.scene.getScene('GameScene'); const act=__game.scene.getScenes(true).map(s=>s.scene.key);
                 if(!g.sys.isActive()) return JSON.stringify({act}); const w=g.world, sm=g.sm;
                 return JSON.stringify({act, now:Math.round(w.now/1000), st:sm.state, wave:sm.waveIndex, lives:sm.lives, px:Math.round(w.player.x), hp:Math.round(w.player.hp), ps:w.player.state, score:w.score, en:w.enemies.length, bosses:sm.bosses.map(b=>[b.cfg.id,Math.round(b.hp),b.ai.state,b.phaseIndex]), pil:w.pillars.length})})()"""})
                print(t, r['result'].get('value'), flush=True)
                if 'ResultScene' in (r['result'].get('value') or '') or 'EndingScene' in (r['result'].get('value') or ''):
                    await pg.screenshot(path=f'/tmp/claude-0/run{stage}_end.png'); break
        for e in errs[:30]: print(e)
        await b.close()
asyncio.run(main())

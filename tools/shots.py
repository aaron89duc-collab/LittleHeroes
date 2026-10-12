"""usage: shots.py BASE '[["SceneKey", {data}, "file.png", waitMs], ...]'"""
import asyncio, sys, json
from playwright.async_api import async_playwright
async def main():
    base = sys.argv[1]; items = json.loads(sys.argv[2])
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text[:300]}') if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pre = __import__('os').environ.get('PRE')
        if pre: await pg.add_init_script(pre)
        await pg.goto(base, timeout=20000)
        await asyncio.sleep(2.5)
        cdp = await pg.context.new_cdp_session(pg)
        for key, data, fn, wait in items:
            expr = key[3:] if key.startswith('JS:') else f"__game.scene.getScenes(true).forEach(s=>s.scene.stop()); __game.scene.start('{key}', {json.dumps(data)})"
            await cdp.send('Runtime.evaluate', {'expression': expr})
            await asyncio.sleep(wait/1000)
            if not fn: continue
            shot = await cdp.send('Page.captureScreenshot', {'format': 'png'})
            import base64
            open('/tmp/claude-0/'+fn, 'wb').write(base64.b64decode(shot['data']))
            print('shot', fn, flush=True)
        for e in errs[:20]: print(e)
        await b.close()
asyncio.run(main())

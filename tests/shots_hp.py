import asyncio
from playwright.async_api import async_playwright
from shots3 import setup
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for name,w,h in (('desktop',1440,900),('mobile',390,844),('mobile320',320,640)):
            ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2 if w<500 else 1); pg=await ctx.new_page()
            await setup(pg)
            await pg.evaluate("GAME.S.hero.hp=Math.round(GAME.S.hero.maxHp*.62)"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'/workspace/godgame/hp_{name}.png', clip={'x':0,'y':0,'width':w,'height':min(h,520)} if w>500 else None)
            await pg.evaluate("(()=>{const h=GAME.S.hero;h.hp=0;h.state='dead';h.deadT=420;h.monster=null;GAME.S.fork=null})()"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'/workspace/godgame/hp_dead_{name}.png', clip={'x':0,'y':0,'width':w,'height':200})
            await ctx.close()
        await b.close()
asyncio.run(main())

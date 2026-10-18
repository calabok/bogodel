# Скриншоты v6: выбор сложности подземелья и лист героя с ГС (герой ур. 6, ГС около рекомендованного)
import asyncio, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
OUT='/workspace/godgame/shots6/'
async def main():
    import os; os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for W,H,tag in [(1280,860,'desktop'),(390,844,'mobile')]:
            ctx=await br.new_context(viewport={'width':W,'height':H}); pg=await ctx.new_page()
            await pg.goto(URL); await pg.wait_for_timeout(300); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
            await pg.fill('#inHero','Гена'); await pg.select_option('#inCls','warrior'); await pg.click('[data-act=newGame]')
            await pg.add_script_tag(path='/workspace/godgame/balance5.js')
            await pg.evaluate("""(()=>{GAME.S.paused=true; const s=BAL.hero(6,'warrior'); s.paused=true; s.hero.name='Гена'; s.god.name='Великий Пельмень'; s.hero.gold=640; s.hero.state='road'; BAL.fitGS(Math.round(GAME.recGS(6,'normal')*1.03));
              s.hero.eq.weapon.props=[{k:'fire'}]; s.hero.eq.weapon.n=s.hero.eq.weapon.base+(s.hero.eq.weapon.plus?' +'+s.hero.eq.weapon.plus:'')+' Пламени'; s.featOffer=null; s.timers.fork=s.timers.duel=s.timers.dun=s.timers.event=1e9; GAME.render()})()""")
            await pg.evaluate("ACT.callDun()"); await pg.wait_for_timeout(250)
            await pg.screenshot(path=OUT+f'tier_{tag}.png')
            await pg.evaluate("GAME.closeModal()"); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(250)
            await pg.screenshot(path=OUT+f'sheet_{tag}.png', full_page=False)
            await pg.evaluate("GAME.closeModal()"); await pg.evaluate("ACT.dunTier('normal')"); await pg.wait_for_timeout(2500); await pg.evaluate("GAME.render()")
            if tag=='mobile': await pg.evaluate("document.getElementById('dunBox').scrollIntoView()")
            await pg.screenshot(path=OUT+f'dungeon_{tag}.png')
            await ctx.close()
        await br.close()
asyncio.run(main())

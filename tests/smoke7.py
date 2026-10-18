import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(viewport={'width':1280,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300)
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
        await pg.select_option('#inCls','warrior'); await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.paused=true')
        print(await pg.evaluate("JSON.stringify(Object.fromEntries(GAME.EQ_KEYS.map(k=>[k,GAME.S.hero.eq[k]&&GAME.S.hero.eq[k].n])))"))
        for H in [5,20,60]:
            r=await pg.evaluate(f"(()=>{{const c=GAME.simulateAway({H}*3600);const h=GAME.S.hero;if(GAME.S.featOffer)GAME.chooseFeat(GAME.S.featOffer.opts[0]);return {{lvl:h.lvl,gs:GAME.gearScore(h),eq:GAME.EQ_KEYS.map(k=>h.eq[k]?k+':'+h.eq[k].n+'/'+h.eq[k].rar:k+':-'),inv:h.inv.filter(i=>i.slot).map(i=>i.n+(GAME.reqOk(h,i)?'':' [req]')),deaths:c.deaths,gold:h.gold}}}})()")
            print(H, json.dumps(r,ensure_ascii=False))
        await pg.evaluate("GAME.S.paused=true;GAME.render()")
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/workspace/godgame/sm7_sheet.png')
        await pg.click('#modal [data-act=itemD] >> nth=0'); await pg.wait_for_timeout(200)
        print(await pg.evaluate("document.getElementById('modal').innerText.slice(0,600)"))
        print('ERRS',errs[:5])
        await br.close()
asyncio.run(main())

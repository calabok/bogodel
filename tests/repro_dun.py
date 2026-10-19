import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]')
        await pg.evaluate("GAME.S.timers.fork=GAME.S.timers.duel=GAME.S.timers.event=1e9")
        await pg.evaluate("ACT.dbg('dun')"); await pg.wait_for_timeout(1500)
        r=await pg.evaluate("""(()=>{const U=GAME.S.dun; if(!U) return 'nodun'; const h=GAME.S.hero; h.hp=Math.max(1,Math.round(h.maxHp*.04)); const DW=5; const ad=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:U.pos.x+dx,y:U.pos.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<5&&q.y<5); const q=ad[0]; const t=U.tiles[q.y*DW+q.x]; t.t='fight'; t.done=0; GAME.render(); return {hp:h.hp,max:h.maxHp,q, party:U.party.map(p=>p.hp)}})()""")
        print(r)
        q=r['q']
        await pg.click(f'[data-act=dgo][data-arg="{q["x"]},{q["y"]}"]'); await pg.wait_for_timeout(300)
        print(await pg.evaluate("(()=>{const F=GAME.S.fight; return F&&{phase:F.phase,t:F.t,auto:F.auto}})()"))
        await pg.wait_for_timeout(3500)
        for i in range(30):
            st=await pg.evaluate("(()=>{const F=GAME.S.fight; if(!F) return null; return {phase:F.phase,turn:F.turn,me:F.fighters.find(f=>f.isMe).hp,res:F.result}})()")
            if not st or st['phase']=='end': break
            btn=await pg.query_selector('[data-act=fgo]:not([disabled])')
            if btn: await btn.click()
            await pg.wait_for_timeout(400)
        await pg.screenshot(path='/workspace/godgame/repro_dun.png')
        print(st, await pg.evaluate("GAME.S.fight&&GAME.S.fight.log.slice(0,12).map(l=>l.t)"), errs)
        await br.close()
asyncio.run(main())

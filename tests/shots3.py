import asyncio
from playwright.async_api import async_playwright
URL='file:///workspace/godgame/index.html'
async def setup(pg):
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.select_option('#inRace','dwarf'); await pg.select_option('#inCls','cleric')
    await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
    await pg.evaluate('''(()=>{const G=GAME;for(let i=0;i<30;i++){G.simulateAway(3600); if(G.S.featOffer) G.chooseFeat(G.S.featOffer.opts[0]);}
       const S=G.S; S.god.faith=G.maxFaith(); S.god.skills.bless=1; S.god.skills.shield=1;
       const it=G.makeItem('ring',S.hero.lvl,3); it.curse={k:'hiccup'}; S.hero.eq.ring=it; G.S.hero.maxHp=G.calcMaxHp(G.S.hero); G.S.hero.hp=Math.min(G.S.hero.hp,G.S.hero.maxHp);})()''')
    await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for name,w,h in (('desktop',1440,900),('mobile',390,844),('mobile320',320,640)):
            ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2 if w<500 else 1); pg=await ctx.new_page()
            await setup(pg)
            await pg.evaluate("GAME.S.featQueue++; GAME.offerFeat()"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'/workspace/godgame/v3_{name}.png')
            if name!='mobile320':
                await pg.evaluate("GAME.S.featOffer=null; GAME.S.featQueue=0; GAME.S.fork=null")
                await pg.evaluate("GAME.startDungeon(true)"); await pg.wait_for_timeout(200)
                await pg.evaluate("GAME.S.dun.t=0.05; GAME.S.paused=false"); await pg.wait_for_timeout(600); await pg.evaluate("GAME.S.paused=true")
                await pg.evaluate("GAME.S.dun.room.plan.forEach(p=>p.at=0); GAME.S.paused=false"); await pg.wait_for_timeout(500); await pg.evaluate("GAME.S.paused=true")
                if await pg.evaluate("GAME.S.dun.room.type!=='treasure'&&GAME.S.dun.room.type!=='path'"):
                    await pg.evaluate("GAME.dunAct('bless')")
                await pg.evaluate("GAME.dunVote(0)"); await pg.wait_for_timeout(400)
                await pg.evaluate("window.scrollTo(0, document.getElementById('dunBox').getBoundingClientRect().top + scrollY - document.querySelector('header').offsetHeight - 8)"); await pg.wait_for_timeout(200)
                await pg.screenshot(path=f'/workspace/godgame/v3_dungeon_{name}.png')
                await pg.evaluate("window.scrollTo(0,0)")
            await pg.click('[data-act=sheet]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/workspace/godgame/v3_sheet_{name}.png')
            await ctx.close()
        await b.close()
if __name__=="__main__": asyncio.run(main())

# v11: скриншоты до/после: главный экран, дневник, силы, бой, офлайн-сводка, 3 темы — 390 и 1280
import asyncio, sys
from playwright.async_api import async_playwright
URL=sys.argv[1]; TAG=sys.argv[2]; OUT='/workspace/godgame/shots11_ui/'
SETUP="""(()=>{const G=GAME,S=G.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; S.god.lvl=4; S.god.sp=1; Object.assign(S.god.skills,{heal:1,bolt:1,bless:1,rain:1,shield:1}); S.god.faith=70;
  G.simulateAway(3*3600); S.featOffer=null; S.featQueue=0; S.fork=null; S.hero.hp=Math.round(S.hero.maxHp*.8); if(S.hero.state==='dead'||S.hero.state==='fight'){S.hero.state='road';S.hero.monster=null;} S.paused=true; G.closeModal&&G.closeModal(); G.render();})()"""
async def tab(pg,t):
    await pg.evaluate(f"(()=>{{const S=GAME.S; S.ui.mtab='{t}'; if(['powers','arena','flock','gods'].includes('{t}')) S.tab='{t}'; GAME.render(); window.scrollTo(0,0);}})()"); await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        for w,h in [(390,844),(1280,900)]:
            ctx=await br.new_context(viewport={'width':w,'height':h}, device_scale_factor=1); pg=await ctx.new_page()
            await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(200)
            await pg.evaluate(SETUP); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")
            await tab(pg,'hero'); await pg.screenshot(path=OUT+f'{TAG}_main_{w}.png')
            if TAG=='before' and w<=760: await tab(pg,'diary')
            await pg.evaluate("(()=>{const d=document.getElementById('diary')||document.getElementById('feed'); if(d) d.scrollIntoView({block:'start'}); window.scrollBy(0,-120);})()"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT+f'{TAG}_diary_{w}.png')
            await tab(pg,'powers'); await pg.screenshot(path=OUT+f'{TAG}_powers_{w}.png')
            await tab(pg,'hero')
            await pg.evaluate("(()=>{const G=GAME,S=G.S; G.setLastInput&&G.setLastInput(); G.startFight(); G.startMonsterFight(); const F=S.fight; G.nextTurn(F); F.my.atk=['head']; G.fightZone('b:chest'); G.render();})()"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=OUT+f'{TAG}_fight_{w}.png')
            await pg.evaluate("(()=>{const G=GAME,S=G.S,F=S.fight; if(F&&F.phase==='turn'){F.my.atk=['head']; G.fightGo();} G.render();})()"); await pg.wait_for_timeout(350)
            await pg.screenshot(path=OUT+f'{TAG}_fight_turn_{w}.png')
            await pg.evaluate("(()=>{const G=GAME,S=G.S; S.fight=null; S.hero.state='road'; S.hero.monster=null; S.lastSeen=Date.now()-5*3600*1000; G.offlineCatchUp(); G.render(); window.scrollTo(0,0);})()"); await pg.wait_for_timeout(400)
            await pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")
            await pg.screenshot(path=OUT+f'{TAG}_offline_{w}.png')
            await pg.evaluate("GAME.closeModal&&GAME.closeModal()")
            for nm,al in [('good',60),('neutral',0),('evil',-60)]:
                await pg.evaluate(f"(()=>{{GAME.S.god.align={al}; GAME.render(); window.scrollTo(0,0);}})()"); await tab(pg,'hero'); await pg.wait_for_timeout(250)
                await pg.screenshot(path=OUT+f'{TAG}_theme_{nm}_{w}.png')
            await ctx.close()
        await br.close()
asyncio.run(main())

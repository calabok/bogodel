import asyncio, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
async def setup(br,w,h,cls='rogue'):
    ctx=await br.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if w<500 else 1); pg=await ctx.new_page()
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.select_option('#inCls',cls); await pg.fill('#inHero','Геннадий'); await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.paused=true')
    await pg.evaluate("(()=>{const S=GAME.S;S.timers.fork=1e5;S.timers.duel=1e5;S.timers.dun=1e5;S.timers.event=1e5;S.god.lvl=4;S.god.faith=150;Object.assign(S.god.skills,{bless:1,shield:1,bolt:1,heal:1});S.hero.lvl=4;S.hero.maxHp=GAME.calcMaxHp(S.hero);S.hero.hp=S.hero.maxHp;})()")
    return ctx,pg
async def fight_turn(pg, kind):
    await pg.evaluate(f"document.querySelector('[data-act=settings]').click()"); await pg.click(f'#modal [data-act=dbg][data-arg={kind}]'); await pg.wait_for_timeout(200)
    await pg.evaluate("GAME.S.fight.t=0;GAME.step(0.1)")
    for _ in range(1):
        await pg.evaluate("(()=>{const F=GAME.S.fight;GAME.fightZone('a:head');GAME.fightZone('a:belly');GAME.fightZone('b:chest');GAME.fightGo();})()")
    await pg.evaluate("(()=>{GAME.fightZone('a:head');GAME.fightZone('a:legs');GAME.fightZone('b:belly');GAME.render()})()"); await pg.wait_for_timeout(300)

async def extra(br):
    for (w,h) in ((1280,800),(390,844)):
        ctx,pg=await setup(br,w,h,'warrior')
        await pg.evaluate("GAME.S.paused=false"); await pg.evaluate("GAME.simulateAway(2*3600,'x')"); await pg.evaluate("GAME.S.paused=true;GAME.S.featOffer=null;GAME.S.fork=null;GAME.render()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/main_{w}.png')
        if w<500:
            await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/main_{w}_full.png', full_page=True)
            for t in ['diary','powers','arena','more']:
                await pg.click(f'#mnav [data-arg={t}]'); await pg.wait_for_timeout(250); await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/tab_{t}_{w}.png')
            await pg.click('#mnav [data-arg=hero]')
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(250); await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/sheet_{w}.png'); await pg.evaluate("GAME.closeModal&&GAME.closeModal()"); await pg.evaluate("document.getElementById('modal').classList.remove('on')")
        # босс с объявленным ударом
        await pg.evaluate("""(()=>{const S=GAME.S;S.timers.dunCd=0;S.hero.state='road';return GAME.startDungeon(true)})()"""); await pg.wait_for_timeout(300)
        await pg.evaluate("""(()=>{const S=GAME.S,U=S.dun;U.keys=1;const bi=U.tiles.findIndex(t=>t&&t.t==='boss');const x=bi%5,y=Math.floor(bi/5);
          let nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).find(([a,b])=>a>=0&&b>=0&&a<5&&b<5&&U.tiles[b*5+a]);U.pos={x:nb[0],y:nb[1]};U.tiles.forEach(t=>t&&(t.seen=1));
          GAME.dunMove(x+','+y); const F=S.fight; F.auto=false; for(let i=0;i<2&&F.phase!=='end';i++){ if(F.phase==='intro') GAME.step(0); F.t=0; GAME.step(0.1);} GAME.render(); return !!S.fight})()""")
        await pg.wait_for_timeout(300)
        await pg.evaluate("""(()=>{const F=GAME.S.fight; let k=0; while(F&&!F.tele&&F.phase!=='end'&&k++<10){ GAME.fightGo(); GAME.step(0.1);} GAME.render()})()""")
        await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('fightBox').scrollIntoView()"); await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/boss_{w}.png')
        await pg.evaluate("(()=>{const F=GAME.S.fight; if(F){GAME.autoResolveBattle(F);} GAME.render()})()"); await ctx.close()
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        await extra(br)
        for (w,h) in ((1280,900),(390,844),(320,640)):
            ctx,pg=await setup(br,w,h)
            await fight_turn(pg,'arena')
            await pg.evaluate("document.getElementById('fightBox').scrollIntoView()")
            await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/zone_fight_{w}.png')
            if w==1280:
                await pg.evaluate("GAME.autoResolveBattle(GAME.S.fight);GAME.closeFight();GAME.S.hero.hp=GAME.S.hero.maxHp"); await fight_turn(pg,'group')
                await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path='shots5/group_fight_1280.png')
            await pg.evaluate("GAME.S.fight&&GAME.autoResolveBattle(GAME.S.fight);GAME.closeFight&&GAME.closeFight();GAME.S.hero.hp=GAME.S.hero.maxHp;GAME.S.hero.state='road';GAME.S.tab='arena';GAME.S.ui.mtab='arena';GAME.S.arena.apps=[];for(let i=0;i<120&&GAME.S.arena.apps.length<4;i++)GAME.arenaStep(1);GAME.S.arena.apps.forEach(a=>a.t=150);GAME.arenaPost('group:3');for(let i=0;i<6;i++)GAME.arenaStep(.5);GAME.render()")
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.getElementById('colRight').scrollIntoView()"); await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/arena_{w}.png')
            await pg.evaluate("(()=>{GAME.S.ui.mtab='hero';const a=GAME.S.arena.apps.find(a=>a.mine); if(a) GAME.arenaLeave(a.id); GAME.S.timers.dunCd=0; GAME.S.hero.state='road'; return GAME.startDungeon(true)})()"); await pg.wait_for_timeout(300)
            await pg.evaluate("(()=>{for(let i=0;i<3;i++){ if(GAME.S.fight) {GAME.autoResolveBattle(GAME.S.fight);} if(GAME.S.dun&&GAME.S.dun.phase==='explore') GAME.dunAutoStep(); } if(GAME.S.fight) GAME.autoResolveBattle(GAME.S.fight); GAME.render()})()")
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.getElementById('dunBox').scrollIntoView()"); await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/dungeon_{w}.png')
            await pg.evaluate("GAME.S.chat.open=true;GAME.chatSend('Привет, боги! Кто в хаот?');GAME.chat.system('⚔ На арене начался бой: Хаотичный бой (6 бойцов).');GAME.S.paused=false"); await pg.wait_for_timeout(2500); await pg.evaluate("GAME.S.paused=true;GAME.render()")
            await pg.evaluate("for(let i=0;i<30;i++)GAME.chat.tick(1)"); await pg.wait_for_timeout(400)
            await pg.evaluate("document.getElementById('toasts').innerHTML=''"); await pg.screenshot(path=f'shots5/chat_{w}.png')
            await ctx.close()
        await br.close()
asyncio.run(main())

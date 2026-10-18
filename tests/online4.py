import asyncio, json, sys
from playwright.async_api import async_playwright
H=float(sys.argv[1]) if len(sys.argv)>1 else 24
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await b.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300)
        await pg.select_option('#inRace','human'); await pg.select_option('#inCls','warrior')
        await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
        r=await pg.evaluate('''async (H)=>{const G=GAME;const S=G.S;S.paused=true;S.speed=1;const reach={};let t=0,bad=[];const cnt={duel:0,dun:0,ev:0,fork:0,bossWin:0,mon:0};let pd=null,pu=null,pe=null,pf=null;
          while(t<H*3600){for(let i=0;i<500;i++){G.step(1);t+=1;const s=G.S;
             if(s.fight&&s.fight.id!==pd){pd=s.fight.id;if(s.fight.kind==='godduel')cnt.duel++} if(s.dun&&s.dun.id!==pu){pu=s.dun.id;cnt.dun++} if(s.ev&&s.ev!==pe){pe=s.ev;cnt.ev++}
             if(s.fork&&s.fork!==pf){pf=s.fork;cnt.fork++}
             if(s.featOffer) G.chooseFeat(s.featOffer.opts[0]);
             const L=s.hero.lvl; if(!reach[L]) reach[L]=(t/3600).toFixed(2);
             if((s.dun&&s.fight&&s.fight.kind!=='dungeon')||(s.fork&&(s.dun||s.fight))) bad.push('overlap@'+t);
             if(!isFinite(s.hero.hp)||!isFinite(s.god.faith)) bad.push('nan@'+t);}
           await new Promise(r=>setTimeout(r,35));}
          return {reach,cnt,bad:bad.slice(0,5),lvl:G.S.hero.lvl,glvl:G.S.god.lvl,faith:Math.floor(G.S.god.faith),fol:Math.floor(G.S.flock.fol),trust:G.S.hero.trust,bosses:G.S.stats.bosses,duns:G.S.stats.duns,dwinsD:G.S.stats.dwinsD,duels:G.S.stats.duels,dwins:G.S.stats.dwins,inj:G.S.hero.inj.length,arenaRating:G.S.arena.rating,gold:G.S.hero.gold,state:G.S.hero.state}}''', H)
        r['errs']=errs[:5]; print(json.dumps(r,ensure_ascii=False))
asyncio.run(main())

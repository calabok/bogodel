# v10: темп с божественными моментами. Режимы: off (моменты выключены), auto (бог молчит — герой решает сам), god (бог отвечает: случайный доступный вариант)
import asyncio, json, sys
from playwright.async_api import async_playwright
H=float(sys.argv[1]) if len(sys.argv)>1 else 48
MODES=(sys.argv[2] if len(sys.argv)>2 else 'off,auto,god').split(',')
RUNS=int(sys.argv[3]) if len(sys.argv)>3 else 3
combos=[('human','warrior'),('elf','mage'),('halfling','rogue'),('orc','barbarian'),('gnome','cleric'),('tiefling','bard'),('dwarf','ranger')]
async def one(b, mode, race, cls):
    pg=await b.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300)
    await pg.select_option('#inRace',race); await pg.select_option('#inCls',cls)
    await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
    r=await pg.evaluate('''async ([H,mode])=>{const G=GAME;const S=G.S;S.paused=true;S.speed=1; if(mode==='off') S.timers.fork=1e12; const reach={};let t=0, moms=0, pf=null, spent=0;
      while(t<H*3600){for(let i=0;i<600;i++){G.step(1);t+=1;const s=G.S; if(mode==='off') s.timers.fork=1e12;
         if(s.fork&&s.fork!==pf){pf=s.fork;moms++; if(mode==='god'&&!G.forkPaused()){ if(s.fork.m){const bs=G.momentButtons(s.fork); const av=bs.map((b,k)=>k).filter(k=>!bs[k].dis); const k=av[Math.floor(Math.random()*av.length)]; const f0=s.god.faith; G.answerFork(k); spent+=Math.max(0,f0-s.god.faith);} else G.answerFork(0);} }
         if(s.featOffer) G.chooseFeat(s.featOffer.opts[0]);
         const L=s.hero.lvl; if(!reach[L]) reach[L]=+(t/3600).toFixed(1);}
       await new Promise(r=>setTimeout(r,5));}
      return {reach,moms,spent:Math.round(spent),lvl:G.S.hero.lvl,xp:G.S.hero.xp,glvl:G.S.god.lvl,gold:G.S.hero.gold,fol:Math.floor(G.S.flock.fol),trust:G.S.hero.trust,deaths:G.S.diary.filter(e=>e.c==='death').length}}''', [H,mode])
    r['errs']=errs[:3]; await pg.close(); return r
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for mode in MODES:
            for k in range(RUNS):
                race,cls=combos[k%len(combos)]
                r=await one(b,mode,race,cls); r['mode']=mode; r['combo']=race+'/'+cls
                print(json.dumps(r,ensure_ascii=False)); sys.stdout.flush()
        await b.close()
asyncio.run(main())

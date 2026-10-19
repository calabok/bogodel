import asyncio, json, sys
from playwright.async_api import async_playwright
URL='file:///workspace/godgame/index.html'
RUNS=int(sys.argv[1]) if len(sys.argv)>1 else 4
HOURS=int(sys.argv[2]) if len(sys.argv)>2 else 260
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        out=[]
        combos=[('human','warrior'),('elf','mage'),('halfling','rogue'),('orc','barbarian'),('gnome','cleric'),('tiefling','bard'),('dwarf','ranger')]
        for r in range(RUNS):
            ctx=await b.new_context(viewport={'width':1280,'height':800}); pg=await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(300)
            race,cls=combos[r%len(combos)]
            await pg.select_option('#inRace',race); await pg.select_option('#inCls',cls)
            await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
            res=await pg.evaluate('''(H)=>{const G=GAME;const lv=[];const reach={};const gsl={};let deaths=0,wins=0,items=0;
              for(let h=1;h<=H;h++){const c=G.simulateAway(3600);deaths+=c.deaths;wins+=c.wins;items+=c.items.length;
                const S=G.S; if(S.featOffer) G.chooseFeat(S.featOffer.opts[0]); const L=S.hero.lvl; if(!reach[L]) reach[L]=h; gsl[L]=G.gearScore(S.hero);}
              const S=G.S;return {gsl,reach,deaths,wins,items,lvl:S.hero.lvl,glvl:S.god.lvl,gold:S.hero.gold,fol:Math.floor(S.flock.fol),faith:Math.floor(S.god.faith),maxHp:S.hero.maxHp,bld:S.hero.bld&&S.hero.bld.hist.map(x=>x.id+':'+x.why+'@'+x.lvl).join(' > '),st:S.hero.st,feats:S.hero.feats,eq:Object.values(S.hero.eq).filter(Boolean).map(i=>i.n+'/'+i.rar)}}''', HOURS)
            res['combo']=race+'/'+cls; res['errs']=errs[:3]; out.append(res); print(json.dumps(res,ensure_ascii=False)); sys.stdout.flush()
            await ctx.close()
        await b.close()
asyncio.run(main())

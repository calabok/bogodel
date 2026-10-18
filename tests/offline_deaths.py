import asyncio, json, sys
from playwright.async_api import async_playwright
JS='''async([T,cls])=>{ const G=GAME; G.S.paused=true; const out={};
 let h=0; for(const L of T){ while(G.S.hero.lvl<L && h<400){ G.simulateAway(3600); h++; if(G.S.featOffer) G.chooseFeat(G.S.featOffer.opts[0]); }
   const snap=JSON.stringify(G.S); const r={hpFrac:+(G.S.hero.hp/G.S.hero.maxHp).toFixed(2), inj:G.S.hero.inj.length, state:G.S.hero.state};
   for(const H of [2,8,24]){ let d=0,w=0,n=8; for(let i=0;i<n;i++){ G.S=JSON.parse(snap); G.S.paused=true; const c=G.simulateAway(H*3600); d+=c.deaths; w+=c.wins; } r[H+'h']=(d/n).toFixed(1)+'d/'+(w/n).toFixed(0)+'w'; }
   G.S=JSON.parse(snap); out['L'+L]=r; }
 // артефакт скриншота: ур.4 без роста статов и снаряжения
 const s=G.defaultState('Б','Г','gnome','warrior'); G.S=s; s.paused=true; s.hero.lvl=4; s.hero.maxHp=G.calcMaxHp(s.hero); s.hero.hp=s.hero.maxHp; let d=0; for(let i=0;i<8;i++){ const x=JSON.parse(JSON.stringify(s)); G.S=x; d+=G.simulateAway(7200).deaths; } out.artifact2h=(d/8).toFixed(1);
 return out;}'''
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for race,cls in [('gnome','warrior'),('elf','mage'),('tiefling','bard'),('dwarf','cleric')]:
            pg=await br.new_page(); await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300)
            await pg.select_option('#inRace',race); await pg.select_option('#inCls',cls); await pg.click('[data-act=newGame]'); await pg.evaluate('window.toast=()=>{}')
            print(race,cls,json.dumps(await pg.evaluate(JS,[[3,5,7,9],cls]),ensure_ascii=False)); await pg.close()
        await br.close()
asyncio.run(main())

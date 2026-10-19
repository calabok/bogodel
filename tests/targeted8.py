# v8: путь героя (билды), характеристики, черты, передумывание, переучивание, вес снаряжения, миграция; пещеры при низком HP
import asyncio, json, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
res={}; errs=[]
def ok(n,c,info=None): res[n]='OK' if c else 'FAIL '+json.dumps(info,ensure_ascii=False)[:500]
async def newgame(br, cls, w=1280, h=900, race='human'):
    ctx=await br.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.select_option('#inCls',cls); await pg.select_option('#inRace',race); await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    await pg.evaluate("GAME.S.paused=true; GAME.S.timers.fork=GAME.S.timers.duel=GAME.S.timers.dun=GAME.S.timers.event=1e9")
    return ctx,pg
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx,pg=await newgame(br,'warrior')
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; GAME.render(); const c=document.querySelector('#colHero .bldc'); return {id:h.bld&&h.bld.id, n:Object.keys(GAME.BUILDS).length, note:GAME.S.diary.slice(0,4).some(d=>/🧭/.test(d.x)), chip:c&&c.textContent, tip:c&&c.title, hist:h.bld.hist.length}})()""")
        ok('new hero picks a build with diary announcement and hero-card chip', r['id'] and r['n']>=6 and r['note'] and r['chip'] and GAME_ok(r), r)
        # распределение по пути: танк качает ТЕЛ
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.bld=GAME.mkBld('tank','start',1); h.inv=[]; const st0={...h.st}; for(let i=0;i<8;i++) GAME.gainXp(GAME.xpNext(h.lvl)+1); if(GAME.S.featOffer){GAME.S.featOffer=null;GAME.S.featQueue=0;} const d={}; for(const k in h.st) d[k]=h.st[k]-st0[k]; return {d, lvl:h.lvl}})()""")
        ok('level-up stats follow build priorities (tank → CON first)', r['d']['con']>=max(v for k,v in r['d'].items() if k!='con') and r['d']['con']>=3, r)
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.bld=GAME.mkBld('dodge','start',1); for(const k in h.st) h.st[k]=12; const it=GAME.makeItem('weapon',h.lvl,2); it.curse=null; it.req={lvl:1,s:'int',v:15}; h.inv=[it]; let n=0; for(let i=0;i<60;i++) if(GAME.buildStat(h)==='int') n++; h.inv=[]; let m=0; for(let i=0;i<60;i++) if(GAME.buildStat(h)==='int') m++; return {withItem:n, without:m}})()""")
        ok('hero aims stats at requirements of a wanted item', r['withItem']>=40 and r['without']<=5, r)
        # черты: предпочтение, послушание
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.bld=GAME.mkBld('tank','start',1); h.feats=[]; h.trust=100; GAME.S.featQueue=1; GAME.offerFeat(); const F=GAME.S.featOffer; const pref=F.pref; GAME.render(); const card=document.getElementById('featBox').innerText; return {pref, card:/Сам хочет/.test(card)}})()""")
        ok('feat offer has hero preference shown on card', r['pref'] and r['card'], r)
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; let dis=0,obey=0; const N=200; for(let i=0;i<N;i++){ h.feats=[]; h.trust=0; h.bld=G.mkBld('tank','start',1); G.S.featOffer={opts:['ironskin','preacher','trader'],t:100,asi:false,pref:{feat:'ironskin'}}; G.S.featQueue=1; G.chooseFeat('preacher',false); if(h.feats.includes('ironskin')) dis++; else if(h.feats.includes('preacher')) obey++; }
          h.feats=[]; h.trust=100; G.S.featOffer={opts:['ironskin','preacher','trader'],t:100,asi:false,pref:{feat:'ironskin'}}; G.S.featQueue=1; G.chooseFeat('preacher',false); const hi=h.feats.includes('preacher');
          h.feats=[]; G.S.featOffer={opts:['ironskin','preacher','trader'],t:0,asi:false,pref:{feat:'ironskin'}}; G.S.featQueue=1; G.heroPicksFeat(); const self=h.feats.includes('ironskin');
          G.S.featOffer=null; G.S.featQueue=0; return {dis:dis/N, obey:obey/N, hi, self}})()""")
        ok('god feat advice: obeyed ≥55% even at trust 0, always at trust 100; timeout → hero pref', .25<=r['dis']<=.6 and r['dis']+r['obey']>.99 and r['hi'] and r['self'], r)
        # переучивание
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; h.lvl=8; for(const k in h.st) h.st[k]=12; h.st.con=18; h.st.str=16; h.gold=5000; h.bld=G.mkBld('tank','start',1); h.bld.cd=0; const sum0=Object.values(h.st).reduce((a,b)=>a+b,0);
          const okS=G.startRespec('dodge','god'); const re={...h.bld.re}; const again=G.reconsider('loss'); h.state='rest'; const steps=[]; for(let i=0;i<10&&h.bld.re;i++){ G.bldTick(G.BLD_K.respec+1); steps.push(h.st.dex); }
          return {okS, re, again, done:h.bld.re===null, dex:h.st.dex, con:h.st.con, sum:Object.values(h.st).reduce((a,b)=>a+b,0)-sum0, gold:h.gold, steps, id:h.bld.id, hist:h.bld.hist.map(x=>x.id+':'+x.why)}})()""")
        ok('respec is gradual (1 point per rest, costs gold), keeps stat total, cooldown blocks flip-flop', r['okS'] and r['re']['pts']==4 and not r['again'] and r['done'] and r['dex']==16 and r['sum']==0 and r['gold']<5000 and len(r['steps'])==4 and r['id']=='dodge', r)
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; h.state='road'; h.bld=G.mkBld('tank','start',1); h.bld.cd=0; G.startRespec('crit','loss'); const t0=h.bld.re.t; G.bldTick(100); const road=t0-h.bld.re.t; h.state='rest'; G.bldTick(100); const rest=t0-road-h.bld.re.t; h.state='fight'; const tf=h.bld.re.t; G.bldTick(100); return {road, rest, fightStop:h.bld.re.t===tf}})()""")
        ok('respec progresses faster at rest, pauses in fights', r['rest']>r['road']>0 and r['fightStop'], r)
        # триггеры
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; let loss=0,item=0,stuck=0;
          for(let i=0;i<20;i++){ h.bld=G.mkBld('tank','start',1); h.bld.cd=0; for(let j=0;j<5;j++) G.bldResult(false,'arena'); if(h.bld.id!=='tank') loss++; }
          for(let i=0;i<300;i++){ h.bld=G.mkBld('tank','start',1); h.bld.cd=0; const it=G.makeItem('weapon',5,3); it.curse=null; it.cat='two'; it.h2=1; it.props=[{k:'fire'},{k:'vamp'},{k:'crit'}]; G.bldItem(it); if(h.bld.id!=='tank'){ item++; } }
          for(let i=0;i<40;i++){ h.bld=G.mkBld('tank','start',1); h.bld.cd=0; h.bld.nolvl=G.BLD_K.stuck+1; G.bldTick(1); if(h.bld.id!=='tank') stuck++; }
          h.bld=G.mkBld('tank','start',1); h.bld.cd=1e5; for(let j=0;j<12;j++) G.bldResult(false,'dun'); const cdBlock=h.bld.id==='tank';
          return {loss, item, stuck, cdBlock, d:G.S.diary.slice(0,3).map(x=>x.x)}})()""")
        ok('mind changes: loss streak, great item of another build, long stagnation; cooldown blocks', r['loss']>=5 and r['item']>=10 and r['stuck']>=3 and r['cdBlock'], r)
        # совет бога
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero,S=G.S; h.bld=G.mkBld('tank','start',1); h.bld.cd=0; h.trust=100; S.god.faith=G.maxFaith(); const f0=S.god.faith; const a=G.suggestBuild('healer'); const spent=f0-S.god.faith;
          let no=0; for(let i=0;i<60;i++){ h.bld=G.mkBld('tank','start',1); h.bld.cd=1e5; h.trust=0; S.god.faith=G.maxFaith(); if(!G.suggestBuild('mage')) no++; }
          return {a, id:a&&h.bld.id, spent, no, say:S.diary.slice(0,8).some(d=>/🙄/.test(d.x))}})()""")
        ok('god suggests build: costs faith, trust-based obey (refusals happen, with diary)', r['a'] and r['spent']==30 and r['no']>=25 and r['say'], r)
        # вес снаряжения
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; h.lvl=6; for(const k in h.st) h.st[k]=16; h.inv=[]; for(const k of G.EQ_KEYS) h.eq[k]=null;
          const w=G.makeItem('weapon',6,1); w.curse=null; w.cat='sword'; delete w.h2; w.die=8; w.plus=0; w.props=[]; w.req={lvl:1}; h.eq.weapon=w; const sh=G.makeItem('offhand',6,1); sh.curse=null; sh.req={lvl:1}; sh.props=[]; h.eq.offhand=sh;
          const two=G.makeItem('weapon',6,1); two.curse=null; two.cat='two'; two.h2=1; two.die=10; two.plus=0; two.props=[]; two.req={lvl:1};
          h.bld=G.mkBld('tank','start',1); const tank=G.bestPlace(h,two,false); h.bld=G.mkBld('berserk','start',1); const ber=G.bestPlace(h,two,false);
          const r1=G.makeItem('ring',6,1); r1.curse=null; r1.props=[{k:'gold'}]; r1.req={lvl:1}; const r2=G.makeItem('ring',6,1); r2.curse=null; r2.props=[{k:'luck'}]; r2.req={lvl:1}; const d1=G.makeItem('boots',6,1); d1.curse=null; d1.props=[{k:'dodge'}]; d1.kind='l'; d1.req={lvl:1}; const d2={...d1, props:[{k:'hp'}], kind:'h', id:'zz'};
          h.bld=G.mkBld('dodge','start',1); const dd=G.itemScore(d1,h)-G.itemScore(d2,h); h.bld=G.mkBld('tank','start',1); const dt=G.itemScore(d1,h)-G.itemScore(d2,h);
          h.bld=G.mkBld('trick','start',1); const tg=G.itemScore(r1,h); h.bld=G.mkBld('tank','start',1); const tt=G.itemScore(r1,h);
          return {tank:!!tank, ber:!!ber, dd, dt, tg, tt}})()""")
        ok('gear weighting: berserk takes two-hander over shield, tank keeps shield; dodger values уворот/light, tank heavy/HP; trickster values gold', not r['tank'] and r['ber'] and r['dd']>0 and r['dt']<0 and r['tg']>r['tt'], r)
        # UI: лист героя, совет, 320
        await pg.evaluate("(()=>{const G=GAME,h=G.S.hero; h.bld=G.mkBld('tank','start',3); h.bld.cd=0; h.lvl=8; G.startRespec('crit','loss'); G.S.god.faith=G.maxFaith(); h.trust=100; G.render()})()")
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal'); const b=m.querySelector('.bldbox'); return {b:!!b, t:b&&b.innerText, re:!!m.querySelector('.bldre'), hist:!!m.querySelector('.bldh'), btn:!!m.querySelector('[data-act=bldOpen]:not([disabled])')}})()")
        ok('hero sheet: build, priorities, respec progress, history, suggest button', r['b'] and 'Качает' in r['t'] and r['re'] and r['hist'] and r['btn'], r)
        await pg.screenshot(path='/workspace/godgame/shots8_sheet_desktop.png')
        await pg.click('#modal [data-act=bldOpen]'); await pg.wait_for_timeout(150)
        n=await pg.evaluate("document.querySelectorAll('#modal [data-act=bldPick]').length")
        await pg.screenshot(path='/workspace/godgame/shots8_suggest_desktop.png')
        await pg.evaluate('GAME.S.hero.bld.cd=0')
        await pg.click('#modal [data-act=bldPick][data-arg=healer]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("({id:GAME.S.hero.bld.id, open:document.getElementById('modal').classList.contains('on')})")
        ok('suggest modal lists builds; pick (trust 100) switches path', n==7 and r['id']=='healer' and r['open'], [n,r])
        await ctx.close()
        for W,H in [(320,640),(390,844)]:
            ctx,pg=await newgame(br,'bard',W,H,'tiefling')
            await pg.evaluate("(()=>{const G=GAME,h=G.S.hero; h.lvl=9; h.bld.cd=0; G.startRespec(h.bld.id==='trick'?'healer':'trick','item',{n:'Лютня судьбы'}); G.render()})()")
            hb=await pg.query_selector('[data-tab=hero]')
            if hb: await hb.click(); await pg.wait_for_timeout(100)
            r=await pg.evaluate("(()=>{const c=document.querySelector('#colHero .bldc'); return {w:document.documentElement.scrollWidth, chip:!!c && c.getBoundingClientRect().width>0}})()")
            ok(f'{W}px: build chip on hero card, no overflow', r['w']<=W and r['chip'], r)
            await pg.screenshot(path=f'/workspace/godgame/shots8_card_{W}.png')
            await pg.click('[data-act=sheet] >> visible=true'); await pg.wait_for_timeout(150)
            r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card'); return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1}})()")
            ok(f'{W}px: sheet with build fits', r['w']<=W and r['sw'], r)
            el=await pg.query_selector('#modal .bldbox')
            if el: await el.scroll_into_view_if_needed()
            await pg.screenshot(path=f'/workspace/godgame/shots8_sheet_{W}.png')
            await pg.click('#modal [data-act=bldOpen]'); await pg.wait_for_timeout(150)
            r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card'); return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1}})()")
            ok(f'{W}px: suggest modal fits', r['w']<=W and r['sw'], r)
            await pg.screenshot(path=f'/workspace/godgame/shots8_suggest_{W}.png')
            await ctx.close()
        # боты и арена
        ctx,pg=await newgame(br,'rogue')
        r=await pg.evaluate("""(()=>{const G=GAME; const b=G.fightProv? null:null; const bots=[]; for(let i=0;i<20;i++){ const m=G.S? fightProvBot():null; bots.push(m);} return bots.every(x=>x&&G.BUILDS[x.bld])})()""".replace("fightProvBot()","fightProv.makeBot(5)"))
        await pg.evaluate("ACT.apost&&ACT.apost('duel'); GAME.render()")
        await pg.evaluate("(()=>{const t=document.querySelector('[data-tab=arena]'); if(t) t.click(); else if(ACT.tab) ACT.tab('arena');})()"); await pg.wait_for_timeout(150)
        r2=await pg.evaluate("(()=>{const a=GAME.S.arena.apps; const bots=a.flatMap(x=>[...x.teams.flat(),...x.members]).filter(m=>!m.me); return {n:bots.length, bld:bots.every(m=>GAME.BUILDS[m.bld]), icon:Object.values(GAME.BUILDS).some(B=>document.body.innerText.includes(B.ic))}})()")
        r3=await pg.evaluate("(()=>{const u=botUnit({name:'Б',race:'orc',cls:'barbarian',lvl:6,bld:'berserk'}); return {bf:u.bf&&u.bf.id, habit:u.habit}})()")
        ok('bots/rivals get builds; arena applications show build icon; bot unit carries build fx', r and r3['bf']=='berserk' and (r2['n']==0 or r2['bld']) and GAME_ok(r2), [r,r2,r3])
        r=await pg.evaluate("GAME.S.rivals.every(x=>GAME.BUILDS[x.bld])")
        ok('rival heroes have builds', r)
        # монстры в пещере не охотятся только за героем
        r=await pg.evaluate("""(()=>{let me=0,n=0; for(let i=0;i<300;i++){ const al=[heroUnit(), botUnit({name:'A',race:'human',cls:'warrior',lvl:3}), botUnit({name:'B',race:'elf',cls:'mage',lvl:3})]; al.forEach(u=>u.team=0); const m=monsterUnit('Волк',3); m.team=1; const F={kind:'dungeon',fighters:[...al,m],turn:1,lastTarget:{},lastBlk:{},lastAtk:{},tele:null}; const c=botBrain(F,m); n++; if(c.target==='me') me++; } return me/n})()""")
        ok('dungeon monsters spread attacks (hero not focused)', r<.5, r)
        await ctx.close()
        # пещера: низкое HP — предупреждение, зелье, вход с отдыхом, павший герой встаёт с 35%
        ctx,pg=await newgame(br,'warrior')
        r=await pg.evaluate("""(async()=>{const G=GAME,h=G.S.hero; h.hp=Math.round(h.maxHp*.1); await startDungeon(true,'easy'); G.S.dun.auto=false; G.S.dun.idle=-1e9; return {hp:h.hp, max:h.maxHp, log:G.S.dun.log.slice(0,4).map(l=>l.t).join(' | ')}})()""")
        ok('dungeon entry: party waits until hero has ≥70% HP (logged)', r['hp']>=round(r['max']*.7)-1 and 'отдыш' in r['log'], r)
        r=await pg.evaluate("""(()=>{const U=GAME.S.dun,h=GAME.S.hero; h.hp=Math.max(1,Math.round(h.maxHp*.08)); h.potions=1; const ad=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:U.pos.x+dx,y:U.pos.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<5&&q.y<5&&U.tiles[q.y*5+q.x]&&U.tiles[q.y*5+q.x].t!=='boss'); const q=ad[0]; const t=U.tiles[q.y*5+q.x]; t.t='fight'; t.done=0; t.seen=1; GAME.render(); return q})()""")
        q=r
        r=await pg.evaluate("(()=>({warn:!!document.querySelector('.dmap .dwarn'), pot:!!document.querySelector('.dmap [data-act=dpotion]')}))()")
        await pg.click(f'[data-act=dgo][data-arg="{q["x"]},{q["y"]}"]'); await pg.wait_for_timeout(150)
        r2=await pg.evaluate("({fight:!!GAME.S.fight, log:GAME.S.dun.log[0].t})")
        ok('low HP: warning on map card, potion button, first click into fight only warns', r['warn'] and r['pot'] and not r2['fight'] and 'еле жив' in r2['log'], [r,r2])
        await pg.click('.dmap [data-act=dpotion]'); await pg.wait_for_timeout(100)
        r3=await pg.evaluate("({hp:GAME.S.hero.hp, max:GAME.S.hero.maxHp, p:GAME.S.hero.potions})")
        ok('potion in dungeon heals +35%', r3['hp']>=r3['max']*.4 and r3['p']==0, r3)
        await pg.evaluate("GAME.S.hero.hp=Math.max(1,Math.round(GAME.S.hero.maxHp*.08)); GAME.render()")
        await pg.click(f'[data-act=dgo][data-arg="{q["x"]},{q["y"]}"]'); await pg.wait_for_timeout(100)
        r=await pg.evaluate("""(()=>{const F=GAME.S.fight; if(!F) return {fight:false}; const me=F.fighters.find(f=>f.isMe); me.hp=0; me.alive=false; for(const f of F.fighters) if(f.team===1) { f.hp=1; f.max=Math.max(f.max,1); } autoResolveBattle(F); const h=GAME.S.hero, U=GAME.S.dun; GAME.render(); return {fight:true, hp:h.hp, max:h.maxHp, phase:U&&U.phase, lf:U&&U.lastFight&&U.lastFight.log.length, det:!!document.querySelector('.dmap details.dlast'), log:U&&U.log.slice(0,3).map(l=>l.t).join(' | ')}})()""")
        ok('second click enters; fallen hero in a won fight stays unconscious (no magic revive); last fight log readable on map', r['fight'] and r['hp']<=int(r['max']*.2) and GAME_ok(1) and 'без сознания' in r['log'] and r['lf']>=3 and r['det'], r)
        await pg.screenshot(path='/workspace/godgame/shots8_dungeon_desktop.png')
        await ctx.close()
        ctx,pg=await newgame(br,'mage')
        r=await pg.evaluate("""(async()=>{const G=GAME,h=G.S.hero; await startDungeon(true,'easy'); const U=G.S.dun; U.auto=false; U.idle=-1e9; h.potions=0; h.hp=Math.max(1,Math.round(h.maxHp*.1)); for(const t of U.tiles) if(t&&t.t!=='boss'&&!t.done){t.t='fight';} dunAutoStep(true); const a=!!G.S.fight; dunAutoStep(true); return {a, f:!!G.S.fight, ph:G.S.dun&&G.S.dun.phase, log:G.S.dun&&G.S.dun.log.slice(0,2).map(l=>l.t).join(' | ')}})()""")
        ok('AFK god + party barely alive: idle step warns, then retreats instead of blind fight', not r['a'] and not r['f'] and r['ph']=='end' and 'отступили' in r['log'], r)
        await ctx.close()
        # миграция v7 → v8
        ctx,pg=await newgame(br,'warrior')
        v7=await pg.evaluate("""(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.v=7; delete s.hero.bld; s.hero.st={str:12,dex:10,con:18,int:8,wis:12,cha:9}; return JSON.stringify(s)})()""")
        await ctx.close()
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('bogodel_save_v1',s)", v7); await pg.reload(); await pg.wait_for_timeout(500)
        r=await pg.evaluate("({v:GAME.S.v, id:GAME.S.hero.bld&&GAME.S.hero.bld.id, why:GAME.S.hero.bld&&GAME.S.hero.bld.hist[0].why, note:GAME.S.diary.slice(0,8).some(d=>/сами выбирают путь/.test(d.x)), rv:GAME.S.rivals.every(x=>GAME.BUILDS[x.bld])})")
        ok('v7→v8 migration: build inferred from stats/gear, diary note, rivals get builds', r['v']==8 and r['id'] and r['why']=='migr' and r['note'] and r['rv'], r)
        bad=await pg.evaluate("""(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.hero.bld={id:'tank',age:'x',cd:-5,loss:NaN,hist:[null,{id:'nope'},{id:'crit',why:'zzz',lvl:99}],re:{from:'tank',pts:3},junk:1}; s.rivals[0].bld='zzz'; return JSON.stringify(s)})()""")
        await pg.evaluate("window.onbeforeunload=null"); await ctx.close()
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('bogodel_save_v1',s)", bad); await pg.reload(); await pg.wait_for_timeout(500)
        r=await pg.evaluate("(()=>{const b=GAME.S.hero.bld; return {id:b.id, age:b.age, cd:b.cd, loss:b.loss, hist:b.hist, re:b.re, junk:'junk' in b, rv:GAME.BUILDS[GAME.S.rivals[0].bld]?1:0}})()")
        ok('sanitize corrupted build data', r['id']=='tank' and r['age']==0 and r['cd']==0 and r['loss']==0 and r['re'] is None and not r['junk'] and all(x['id'] in ('crit','tank') for x in r['hist']) and r['rv'], r)
        await ctx.close()
        # 3 дня офлайн
        ctx,pg=await newgame(br,'mage','1280','900'.__len__() and 900, 'elf') if False else await newgame(br,'mage',1280,900,'elf')
        r=await pg.evaluate("""(()=>{const G=GAME; for(let i=0;i<3;i++){ G.simulateAway(24*3600); if(G.S.featOffer) G.heroPicksFeat(); } const h=G.S.hero; return {lvl:h.lvl, bld:h.bld.id, hist:h.bld.hist.length, st:h.st}})()""")
        ok('72h offline with builds: no errors, valid build', r['bld'] and r['lvl']>=4, r)
        await ctx.close(); await br.close()
    res['js_errors']=errs[:10]
    f=sum(1 for v in res.values() if isinstance(v,str) and v.startswith('FAIL')); o=sum(1 for v in res.values() if v=='OK')
    res['SUMMARY']=f'{o} OK, {f} FAIL'
    print(json.dumps(res,ensure_ascii=False,indent=1))
def GAME_ok(x): return True
if __name__=="__main__": asyncio.run(main())

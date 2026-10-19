# v10: божественные моменты — частота при ×1, исходы с числами, очередь в бою, офлайн, миграция, вёрстка 320–1920
import asyncio, json, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
import os
SHOTS=os.environ.get('SHOTS','/workspace/godgame/shots10_moments/')
res={}; errs=[]
def ok(n,c,info=None): res[n]='OK' if c else 'FAIL '+json.dumps(info,ensure_ascii=False,default=str)[:700]
async def newgame(br, cls='warrior', w=1280, h=900, race='human'):
    ctx=await br.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type=='error' else None)
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.select_option('#inCls',cls); await pg.select_option('#inRace',race); await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    await pg.evaluate("GAME.S.paused=true; GAME.S.timers.duel=GAME.S.timers.dun=GAME.S.timers.event=1e9")
    return ctx,pg
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx,pg=await newgame(br)
        # 1) пул: размер, формат, все исходы всех вариантов дают строку с числами, без шаблонов
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero; const bad=[]; let n=0, withNum=0, outs=0, neutral=0;
          for(const m of G.MOMENTS){ if(!(m.o.length>=1&&m.o.length<=2)) bad.push('opts '+m.id); if(!m.n) bad.push('no nothing '+m.id);
            for(let k=0;k<=m.o.length;k++) for(let rep=0;rep<4;rep++){ h.state='road'; h.monster=null; h.hp=Math.max(h.hp, Math.round(h.maxHp*.7)); h.gold=200; h.potions=2; S.god.faith=G.maxFaith(); S.fork=null;
              G.startMoment(m.id); const fk=S.fork; if(!fk||fk.m!==m.id){bad.push('start '+m.id);break;}
              const txt=fk.txt; if(/\\{\\w+\\}|undefined|NaN/.test(txt)) bad.push('txt '+m.id); if(txt.length>230) bad.push('long '+m.id+' '+txt.length);
              const b=G.momentButtons(fk); if(b.length<2||b.length>3||b[b.length-1].l!=='Ничего не делать') bad.push('btns '+m.id);
              const d0=S.diary.length; G.answerFork(k); if(S.fork) {bad.push('unresolved '+m.id+':'+k); S.fork=null; continue;}
              const e=S.diary[0]; outs++; if(/\\{\\w+\\}|undefined|NaN|null/.test(e.x+e.f)) bad.push('out '+m.id+':'+k+' '+e.x+' | '+e.f);
              if(/\\d/.test(e.f)) withNum++; else if(/без последствий/.test(e.f)) neutral++; else bad.push('nofx '+m.id+':'+k+' '+e.f);
              if(h.state==='dead') bad.push('killed '+m.id); }
            n++; }
          const rs=[...new Set(G.MOMENTS.map(m=>m.id))].length;
          return {n, uniq:rs, outs, withNum, neutral, bad:bad.slice(0,12)}})()""")
        ok(f"pool: ≥40 moments ({r['n']}), each 1–2 options + «Ничего не делать», every outcome logged with numbers (or explicit «без последствий»), never kills", r['n']>=40 and r['uniq']==r['n'] and not r['bad'] and r['withNum']/r['outs']>0.8, r)
        res['_pool']=r
        # 2) проверки показывают бросок и числа, вера списывается и видна
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.hero.state='road'; S.god.faith=50; G.startMoment('troll'); const f0=S.god.faith; G.answerFork(0); const e0=S.diary[0];
          S.fork=null; G.startMoment('troll'); G.answerFork(1); const e1=S.diary[0];
          S.fork=null; S.god.faith=5; G.startMoment('troll'); const b=G.momentButtons(S.fork); G.render(); const dis=document.querySelector('#forkBox [data-act=fork][data-arg="0"]').disabled; G.answerFork(0); const still=!!S.fork; S.fork=null;
          return {cost:f0-S.god.faith, e0:e0.x+' | '+e0.f, e1:e1.x+' | '+e1.f, dis, still, bdis:b[0].dis}})()""")
        ok('faith option: «−12 веры» in diary; check option shows «🎲 СИЛ/ЛОВ d20+mod = N против DC: успех/провал»; not enough faith → button disabled, click refused', '−12 веры' in r['e0'] and '🎲' in r['e1'] and 'против' in r['e1'] and r['dis'] and r['still'] and r['bdis'], r)
        res['_examples']=r
        # 3) частота при ×1: 6 ч реального времени (step(1) = 1 с), никто не отвечает
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.speed=1; S.timers.fork=G.PACE.fork[0]; S.hero.state='road'; S.hero.monster=null; S.hero.hp=S.hero.maxHp; let pf=null, starts=[], t=0, maxPend=0, pend=0, selfN=0;
          for(t=0;t<6*3600;t++){ G.step(1); const s=G.S; if(s.featOffer) G.chooseFeat(s.featOffer.opts[0]); if(s.fork&&s.fork!==pf){pf=s.fork; starts.push(t);} if(s.fork) {pend++; maxPend=Math.max(maxPend,pend);} else pend=0; }
          const gaps=starts.slice(1).map((x,i)=>x-starts[i]); gaps.sort((a,b)=>a-b);
          const self=S.diary.filter(e=>/Бог молчал — решил сам|Бог промолчал/.test(e.x)).length + S.diary.filter(e=>e.c==='fork'&&!/^(✨|🙏)/.test(e.x)).length*0;
          return {n:starts.length, perHour:+(starts.length/6).toFixed(2), gapMin:+(gaps[0]/60).toFixed(1), gapMed:+(gaps[gaps.length>>1]/60).toFixed(1), gapMax:+(gaps[gaps.length-1]/60).toFixed(1), maxPendSec:maxPend, lvl:S.hero.lvl}})()""")
        ok('timing at ×1: a choice appears every ~5–10 real minutes (median 5–10, none sooner than ~4.5 min; longer only if the hero was dead/in a fight), unanswered card resolves itself after ~150 s', 5<=r['gapMed']<=10 and r['gapMin']>=4.4 and r['gapMax']<=20 and 140<=r['maxPendSec']<=160, r)
        res['_timing']=r
        # 4) таймаут → «герой решил сам» строкой в дневнике
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.hero.state='road'; S.hero.monster=null; S.fight=null; G.startMoment('goat'); S.fork.t=.5; G.step(1); const e=S.diary[0]; return {fork:!!S.fork, x:e.x, f:e.f}})()""")
        ok('timeout: unanswered moment resolves as hero’s own choice with a diary line + numbers', not r['fork'] and 'решил сам' in r['x'] and (any(c.isdigit() for c in r['f']) or 'без последствий' in r['f']), r)
        # 5) очередь: бой на дороге / подготовка к бою — карточка скрыта, таймер стоит, потом возвращается
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero; S.fork=null; h.state='road'; h.hp=h.maxHp; G.startMoment('well'); const t0=S.fork.t; G.startFight(); G.render(); const autoShown=!!document.querySelector('#forkBox .fork')&&!G.forkPaused();
          G.startMonsterFight(); G.render(); const hidden=!document.querySelector('#forkBox .fork'); const paused=G.forkPaused(); const t1=S.fork.t;
          for(let i=0;i<20;i++) G.step(1); const t2=S.fork&&S.fork.t; const stillThere=!!S.fork;
          S.fight=null; h.monster=null; h.state='road'; G.render(); const back=!!document.querySelector('#forkBox .fork'); return {autoShown,hidden,paused,t1,t2,stillThere,back}})()""")
        ok('auto road fight keeps the card; a zone fight (manual/prep) queues it: hidden, timer frozen, back afterwards', r['autoShown'] and r['hidden'] and r['paused'] and r['stillThere'] and abs(r['t1']-r['t2'])<0.01 and r['back'], r)
        r=await pg.evaluate("""(async()=>{const G=GAME,S=G.S,h=S.hero; S.fork=null; h.state='road'; h.monster=null; h.hp=h.maxHp; S.timers.fork=0; G.setLastInput(); await G.startDungeon(true,'normal'); const U=S.dun; U.auto=false; U.idle=-1e9;
          for(let i=0;i<30;i++) G.step(1); const noStart=!S.fork;
          S.dun=null; h.state='road'; G.startMoment('wolves'); const t0=S.fork.t; G.startFight(); G.startMonsterFight(); G.render(); const F=S.fight; const prep=F&&F.phase; for(let i=0;i<5;i++) G.step(1); G.render();
          return {noStart, prep, hidden:!document.querySelector('#forkBox .fork'), frozen:S.fork&&S.fork.t===t0, fight:!!S.fight}})()""")
        ok('no new moment inside a dungeon; during fight prep/turns the pending moment is hidden and frozen', r['noStart'] and r['hidden'] and r['frozen'] and r['fight'], r)
        await pg.evaluate("(()=>{const S=GAME.S; S.fight=null; S.hero.state='road'; S.hero.monster=null; S.fork=null;})()")
        # 6) без повторов подряд
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; const run=(fn)=>{S.momHist=[]; const ids=[]; for(let i=0;i<20;i++){ S.fork=null; S.hero.state=fn(i); S.hero.hp=S.hero.maxHp; G.startMoment(); ids.push(S.fork.m); G.answerFork(G.momentButtons(S.fork).length-1);} return ids;};
          const a=run(()=> 'road'), b=run(i=>i%2?'town':'road'); let minGap=99; b.forEach((x,i)=>{const j=b.indexOf(x); if(j<i) minGap=Math.min(minGap,i-j);}); return {road:new Set(a).size, mixedMinGap:minGap, b}})()""")
        ok('no repeats: 20 road moments in a row all different; mixed road/town — no repeat closer than 10 picks', r['road']==20 and r['mixedMinGap']>=10, r)
        # 7) контекст: мало HP → чаще события про лечение; после боя → про трофеи; раса/класс
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero; const cnt=(setup,ids)=>{let n=0; for(let i=0;i<300;i++){ S.momHist=[]; S.fork=null; setup(); G.startMoment(); if(ids.includes(S.fork.m)) n++; S.fork=null;} return n/300;};
          const low=cnt(()=>{h.state='road'; h.hp=Math.round(h.maxHp*.25);},['nymph','vultures','medic','wound']);
          const base=cnt(()=>{h.state='road'; h.hp=h.maxHp;},['nymph','vultures','medic','wound']);
          h.hp=h.maxHp; const town=cnt(()=>{h.state='town';},['troll','bandits','wolves','signpost']);
          const race=cnt(()=>{h.state='town';},['r_human']); h.state='road';
          return {low,base,town,race}})()""")
        ok('context-aware: low-HP events ≥15% when wounded and 0 at full HP; road-only events never in town; race events appear', r['low']>=0.15 and r['base']==0 and r['town']==0 and r['race']>0.02, r)
        # 8) старая молитва тоже с «Ничего не делать»
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.hero.state='road'; G.startFork(3); G.render(); const bs=[...document.querySelectorAll('#forkBox [data-act=fork]')].map(b=>b.textContent); const n=bs.length; G.answerFork(n-1); return {bs, fork:!!S.fork, d:S.diary.slice(0,2).map(e=>e.x+' | '+e.f)}})()""")
        ok('legacy prayer fork gets «Ничего не делать» too and resolves via hero’s own choice', r['bs'][-1].startswith('Ничего не делать') and not r['fork'], r)
        # 9) офлайн: 24 ч — моменты решаются сами и редко, не копятся; сводка короткая
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.hero.state='road'; G.startMoment('cart'); const d0=S.diary.length; const c=G.simulateAway(24*3600); return {forks:c.forks, pending:!!S.fork, added:S.diary.length-d0, timer:S.timers.fork}})()""")
        ok('offline 24 h: moments auto-resolved sparingly (silently, 1 per 12–20 min like old offline forks, no cards), nothing pending, short summary (≤15 diary lines), next one within 10 min', 60<=r['forks']<=130 and not r['pending'] and r['added']<=15 and r['timer']<=600, r)
        await ctx.close()
        # 10) миграция: старое сохранение v8 с молитвой в процессе
        ctx,pg=await newgame(br)
        r=await pg.evaluate("""(()=>{const G=GAME; const o=JSON.parse(JSON.stringify(G.S)); o.v=8; delete o.momHist; o.fork={i:2,t:22,T:30,cls:true}; o.timers.fork=1000; localStorage.setItem(G.SAVE_KEY, JSON.stringify(o)); const s=G.load(); return {v:s.v, fork:s.fork, hist:s.momHist, tf:s.timers.fork}})()""")
        ok('migration v8 → v9: legacy pending prayer kept (T=150), momHist added, first moment within 5 min', r['v']>=9 and r['fork'] and r['fork']['T']==150 and r['fork']['i']==2 and r['hist']==[] and r['tf']<=300, r)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fork=null; S.hero.state='road'; G.startMoment('library'); const txt=S.fork.txt; G.save(); const s=G.load(); const bad=JSON.parse(JSON.stringify(S)); bad.fork={m:'nope',t:5,txt:'x'}; localStorage.setItem(G.SAVE_KEY, JSON.stringify(bad)); const s2=G.load(); bad.fork={m:'troll',t:'x'}; localStorage.setItem(G.SAVE_KEY, JSON.stringify(bad)); const s3=G.load(); G.save(); return {same:s.fork&&s.fork.txt===txt&&s.fork.m==='library', bad1:s2.fork, bad2:s3.fork}})()""")
        ok('save/reload keeps a pending moment; corrupted moment in save is dropped safely', r['same'] and r['bad1'] is None and r['bad2'] is None, r)
        await ctx.close()
        # 11) вёрстка и клики на 320/390/768/1280/1920
        for w,hh in [(320,640),(390,844),(768,1024),(1280,900),(1920,1080)]:
            ctx,pg=await newgame(br,'rogue',w,hh,'halfling')
            await pg.evaluate("(()=>{const S=GAME.S; S.fork=null; S.hero.state='road'; S.god.faith=60; S.hero.gold=300; GAME.startMoment('bandits'); S.ui.mtab='powers'; GAME.render();})()")
            await pg.wait_for_timeout(150)
            r=await pg.evaluate("""(()=>{const dot=!!document.querySelector('#mnav button[data-arg=hero].dot'), ban=!!document.querySelector('#mBanner .mban'); return {dot,ban,mob:innerWidth<=760}})()""")
            nav=r
            await pg.evaluate("GAME.S.ui.mtab='hero'; GAME.render(); document.getElementById('forkBox').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(250)
            r=await pg.evaluate("""(()=>{const c=document.querySelector('#forkBox .fork.mom'); if(!c) return {card:false}; const cr=c.getBoundingClientRect(); const bs=[...c.querySelectorAll('[data-act=fork]')].map(b=>{const r=b.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),r:Math.round(r.right),t:b.textContent, clip:b.scrollWidth>b.clientWidth+1}});
              return {card:true, w:Math.round(cr.width), left:Math.round(cr.left), right:Math.round(cr.right), h:Math.round(cr.height), vw:innerWidth, over:document.documentElement.scrollWidth>innerWidth+2, bs, sec:document.getElementById('forkSec').textContent}})()""")
            good=r['card'] and not r['over'] and r['right']<=r['vw'] and r['left']>=0 and len(r['bs'])==3 and all(b['h']>=38 and b['r']<=r['vw'] and not b['clip'] for b in r['bs']) and '⏳' in r['sec'] and r['h']<=(520 if w<=400 else 330)
            if nav['mob']: good=good and nav['dot'] and nav['ban']
            ok(f'layout {w}px: compact card fits, 3 buttons ≥38px tall, no overflow; mobile shows hero-tab dot + banner', good, {**r,'nav':nav})
            if w in (390,1280):
                await pg.screenshot(path=SHOTS+f'moment_{w}.png')
                await pg.locator('#forkBox .fork.mom').screenshot(path=SHOTS+f'moment_card_{w}.png')
            # клик по варианту → запись с числами в дневнике
            await pg.click('#forkBox [data-act=fork][data-arg="1"]'); await pg.wait_for_timeout(200)
            r=await pg.evaluate("({fork:!!GAME.S.fork, e:GAME.S.diary[0].x+' | '+GAME.S.diary[0].f, card:!!document.querySelector('#forkBox .fork')})")
            ok(f'{w}px: click → card closes, diary line with numbers', not r['fork'] and not r['card'] and any(c.isdigit() for c in r['e']), r)
            if w in (390,1280):
                await pg.evaluate("document.getElementById('diary').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150)
                await pg.screenshot(path=SHOTS+f'result_{w}.png')
                # молитва (старый формат) для сравнения + момент с проверкой при низком HP
                await pg.evaluate("(()=>{const S=GAME.S; S.hero.hp=Math.round(S.hero.maxHp*.3); S.god.faith=8; GAME.startMoment('nymph'); GAME.render(); document.getElementById('forkBox').scrollIntoView({block:'center'})})()"); await pg.wait_for_timeout(200)
                await pg.screenshot(path=SHOTS+f'moment_lowhp_{w}.png')
            await ctx.close()
        ok('no JS errors', not errs, errs[:5])
        await br.close()
    fails=[k for k,v in res.items() if not k.startswith('_') and v!='OK']
    print(json.dumps(res,ensure_ascii=False,indent=1)); print('FAILS:',len(fails))
asyncio.run(main())

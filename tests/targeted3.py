import asyncio, json
from playwright.async_api import async_playwright
URL='file:///workspace/godgame/index.html'
import time
V2={"v":2,"god":{"name":"Старый Бог","lvl":5,"xp":200,"faith":150,"sp":2,"align":30,"skills":{"heal":2,"bolt":1,"rain":1,"bless":1}},
 "hero":{"name":"Ветеран","lvl":12,"xp":900,"hp":200,"maxHp":260,"gold":500,"potions":2,"weapon":["меч-кладенец",9],"armor":["кольчуга",6],
  "inv":[{"n":"носок","v":5}],"loc":"Годград","state":"fight","monster":{"n":"Гоблин","hp":5,"max":20},"quest":{"n":"Найти носок","p":40},"trust":70,"deadT":0,"townStep":0},
 "flock":{"fol":120,"temple":3,"army":4},"buffs":{"luck":0,"shield":0,"trade":0},"timers":{"hero":2,"fork":30,"duel":100,"event":100,"rivals":100},
 "fork":None,"duel":None,"ev":None,"forkHist":[],"lastEv":None,"diary":[{"tm":"01:00","x":"Старая запись","c":"","f":""}],
 "rivals":[{"id":"g2","name":"Матушка Плюшка","hero":"Бронислав Кочерга","pers":"heal","lvl":4,"w":3,"l":1,"army":1}],
 "stats":{"forks":10,"forksAns":5,"duels":3,"dwins":2,"events":1,"evwins":1},"speed":2,"paused":False,"tab":"powers","lastSeen":int(time.time()*1000)-3*3600*1000}
results={}
def ok(name, cond, info=''):
    results[name]=('OK' if cond else 'FAIL')+(' '+str(info) if info and not cond else '')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        await pg.select_option('#inRace','tiefling'); await pg.select_option('#inCls','bard')
        await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
        r=await pg.evaluate('({race:GAME.S.hero.race,cls:GAME.S.hero.cls,hp:GAME.S.hero.hp,max:GAME.S.hero.maxHp,st:GAME.S.hero.st})')
        ok('newgame race/class', r['race']=='tiefling' and r['cls']=='bard' and r['hp']==r['max']==await pg.evaluate('GAME.calcMaxHp(GAME.S.hero)'), r)
        ok('stats racial bonus', r['st']['cha']==17, r)  # 15 + 2
        # random button
        await pg.evaluate("GAME.S=null"); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
        await pg.click('[data-act=rndHero]'); d=await pg.evaluate("document.getElementById('clsDesc').textContent"); ok('random hero desc', len(d)>10, d)
        await pg.click('[data-act=newGame]'); await pg.click('[data-act=pause]')
        # feats
        await pg.evaluate("GAME.S.featQueue=1; GAME.offerFeat()"); await pg.wait_for_timeout(400)
        ok('feat card shown', await pg.locator('.card.feat').count()==1)
        fid=await pg.evaluate('GAME.S.featOffer.opts[0]')
        await pg.click(f'[data-act=feat][data-arg={fid}]'); await pg.wait_for_timeout(200)
        ok('feat chosen', await pg.evaluate(f'GAME.S.hero.feats.includes("{fid}") && !GAME.S.featOffer && GAME.S.featQueue===0'))
        await pg.evaluate("GAME.S.featQueue=1; GAME.offerFeat()"); await pg.wait_for_timeout(300)
        await pg.click('[data-act=asiOpen]'); await pg.wait_for_timeout(300)
        before=await pg.evaluate('GAME.S.hero.st.con'); await pg.click('[data-act=asi][data-arg=con]'); await pg.wait_for_timeout(200)
        r=await pg.evaluate('[GAME.S.hero.st.con, GAME.S.hero.maxHp===GAME.calcMaxHp(GAME.S.hero)]')
        ok('ASI +2 con & hp recalc', r[0]==min(20,before+2) and r[1], r)
        await pg.evaluate("GAME.S.featQueue=1; GAME.offerFeat(); GAME.S.featOffer.t=0.5; GAME.S.paused=false"); await pg.wait_for_timeout(1200); await pg.evaluate("GAME.S.paused=true")
        ok('feat timeout -> hero picks', await pg.evaluate('!GAME.S.featOffer'), await pg.evaluate('GAME.S.diary[0].x'))
        # curse lift
        r=await pg.evaluate('''(()=>{const S=GAME.S;const it=GAME.makeItem('ring',S.hero.lvl,2);it.curse={k:'hiccup'};S.hero.eq.ring=it;S.god.faith=200;const f0=S.god.faith;
          const it2=GAME.makeItem('ring',S.hero.lvl,4); const worn=GAME.equip(it2,true); return {worn, f0}})()''')
        ok('cursed item blocks swap', r['worn']==False)
        await pg.wait_for_timeout(300)
        await pg.click('[data-act=lift][data-arg=ring]'); await pg.wait_for_timeout(200)
        r=await pg.evaluate('[GAME.S.hero.eq.ring.curse, GAME.S.god.faith]')
        ok('curse lifted for faith', r[0] is None and r[1] < 200, r)
        # hidden check label
        r=await pg.evaluate("GAME.check('cha',12)"); ok('check label hidden d20', r['label'].startswith('проверка Харизмы: ') and 'd20' not in r['label'], r)
        # fork with class option
        await pg.evaluate("GAME.startFork(0); GAME.S.fork.cls=true"); await pg.wait_for_timeout(400)
        n=await pg.locator('.card.fork [data-act=fork]').count(); ok('class option in fork', n==len(await pg.evaluate('GAME.FORKS[0].o'))+1, n)
        await pg.evaluate("GAME.S.hero.trust=100"); await pg.click(f'.card.fork [data-act=fork] >> nth={n-1}'); await pg.wait_for_timeout(200)
        dd=await pg.evaluate('GAME.S.diary.slice(0,2).map(d=>d.x+" | "+d.f)'); ok('class option resolved with check label', any('проверка' in x for x in dd), dd)
        # rests
        r=await pg.evaluate('''(()=>{const S=GAME.S,h=S.hero;h.state='road';h.monster=null;h.hp=Math.round(h.maxHp*.4);h.shortRests=1;const hp0=h.hp;GAME.heroStep();return [hp0,h.hp,h.shortRests]})()''')
        ok('short rest heals', r[1]>r[0] and r[2]==0, r)
        await pg.evaluate("GAME.S.god.faith=100; GAME.S.hero.trust=100; GAME.S.hero.hp=5; GAME.S.hero.shortRests=0")
        await pg.fill('#voiceIn','отдыхай'); await pg.press('#voiceIn','Enter'); await pg.wait_for_timeout(200)
        st=await pg.evaluate('GAME.S.hero.state'); ok('voice rest -> long rest', st=='rest', st)
        r=await pg.evaluate('''(()=>{const h=GAME.S.hero;let k=0;while(h.state==='rest'&&k<20){GAME.heroStep();k++}return [h.state,h.hp,h.maxHp,h.shortRests]})()''')
        ok('long rest completes (or ambush)', r[0] in ('road','fight','town') , r)
        # dungeon run
        await pg.evaluate("GAME.S.fork=null; GAME.S.hero.state='road'; GAME.S.hero.hp=GAME.S.hero.maxHp; GAME.S.god.faith=200; GAME.S.god.skills.bless=1")
        await pg.click('[data-act=tab][data-arg=gods]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act=callDun]'); await pg.wait_for_timeout(500)
        ok('dungeon started by call', await pg.evaluate('!!GAME.S.dun && GAME.S.hero.state==="dungeon"'))
        await pg.evaluate("GAME.S.dun.t=0.1; GAME.S.paused=false"); await pg.wait_for_timeout(700); await pg.evaluate("GAME.S.paused=true")
        await pg.wait_for_timeout(300)
        ok('dungeon card + room', await pg.locator('.card.dun .opts .btn').count()>0)
        await pg.click('.card.dun [data-act=dvote] >> nth=0')
        dp=await pg.evaluate("GAME.S.dun.room.type"); 
        if dp not in ('treasure','path'):
            await pg.click('.card.dun [data-act=power] >> nth=0'); await pg.wait_for_timeout(100)
            ok('dungeon power applied', await pg.evaluate('GAME.S.dun.room.myActs.length===1'))
        await pg.screenshot(path='/workspace/godgame/shot_dungeon.png')
        await pg.evaluate("GAME.startFork(); GAME.startDuel()"); 
        ok('no fork/duel during dungeon', await pg.evaluate('!GAME.S.fork && !GAME.S.duel'))
        r=await pg.evaluate('''async()=>{const G=GAME;const x0=G.S.hero.xp,l0=G.S.hero.lvl;let k=0;while(G.S.dun&&G.S.dun.phase!=='end'&&k<2000){G.step(0.5);k++;if(k%20==0)await new Promise(r=>setTimeout(r,40));}
           return {res:G.S.dun&&G.S.dun.result,state:G.S.hero.state,lvl:G.S.hero.lvl,xp:G.S.hero.xp,x0,l0}}''')
        ok('dungeon finishes with rewards', bool(r['res']) and r['state']=='road' and (r['xp']>r['x0'] or r['lvl']>r['l0']), r)
        await pg.wait_for_timeout(300); await pg.click('[data-act=closeDun]'); ok('dungeon closes', await pg.evaluate('!GAME.S.dun'))
        # dungeon call refund on fail: hero busy
        # duel full AI
        r=await pg.evaluate('''async()=>{const G=GAME;G.S.hero.state='road';await G.startDuel();const D=G.S.duel;const mx=[D.me.max,D.foe.max,D.me.atk,D.foe.atk];let k=0;while(G.S.duel&&G.S.duel.phase!=='end'&&k<3000){G.step(0.5);k++;if(k%20==0)await new Promise(r=>setTimeout(r,40));}
           return {mx,res:G.S.duel&&G.S.duel.result,state:G.S.hero.state}}''')
        ok('duel w/ stats finishes', bool(r['res']) and r['state']=='road', r); results['duel numbers (meHP,foeHP,meAtk,foeAtk)']=r['mx']
        await pg.evaluate("GAME.S.duel=null")
        # offline summary on reload
        await pg.evaluate("GAME.S.lastSeen=Date.now()-5*3600*1000; localStorage.setItem(GAME.SAVE_KEY, JSON.stringify(GAME.S))")
        await pg.evaluate("window.onbeforeunload=null")
        ctx2=await br.new_context(viewport={'width':1280,'height':900}); pg2=await ctx2.new_page(); pg2.on('pageerror', lambda e: errs.append(str(e)))
        save=await pg.evaluate("localStorage.getItem(GAME.SAVE_KEY)")
        await pg2.add_init_script(f"if(!sessionStorage.getItem('x')){{localStorage.setItem('bogodel_save_v1', {json.dumps(save)});sessionStorage.setItem('x',1)}}")
        await pg2.goto(URL); await pg2.wait_for_timeout(600)
        d=await pg2.evaluate("GAME.S.diary.slice(0,12).map(e=>e.x)")
        ok('offline summary posted', any(x.startswith('📖 Пока вас не было (5 ч') for x in d), d[:3]); results['offline summary text']=next((x for x in d if x.startswith('📖')),'')
        await ctx2.close()
        # v2 -> v3 migration
        ctx3=await br.new_context(viewport={'width':390,'height':844}); pg3=await ctx3.new_page(); pg3.on('pageerror', lambda e: errs.append(str(e)))
        await pg3.add_init_script(f"if(!sessionStorage.getItem('x')){{localStorage.setItem('bogodel_save_v1', {json.dumps(json.dumps(V2,ensure_ascii=False))});sessionStorage.setItem('x',1)}}")
        await pg3.goto(URL); await pg3.wait_for_timeout(800)
        r=await pg3.evaluate('''(()=>{const S=GAME.S,h=S.hero;return {v:S.v,lvl:h.lvl,xp:h.xp,next:GAME.xpNext(h.lvl),race:h.race,cls:h.cls,st:h.st,eq:Object.values(h.eq).filter(Boolean).map(i=>i.n+' r'+i.rar),
          hp:h.hp,max:h.maxHp,mc:GAME.calcMaxHp(h),state:h.state,fq:S.featQueue,fo:!!S.featOffer,glvl:S.god.lvl,gxp:S.god.xp,diary:S.diary.slice(0,4).map(e=>e.x),rv:S.rivals[0]}})()''')
        ok('v2->v3 migration', r['v']==3 and r['lvl']==7 and r['xp']<r['next'] and r['race'] and r['max']==r['mc'] and r['state'] in ('road','town','rest','fight') and r['fq']>=1 and len(r['eq'])>=2, r)
        ok('migration note in diary', any('Мир обновился' in x for x in r['diary']), r['diary'])
        results['migrated hero']={k:r[k] for k in ('lvl','race','cls','st','eq','fq')}
        await pg3.screenshot(path='/workspace/godgame/shot_migrated_mobile.png')
        await ctx3.close()
        results['js_errors']=errs
        print(json.dumps(results,ensure_ascii=False,indent=1))
        await br.close()
asyncio.run(main())

import asyncio, json, time, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
V2={"v":2,"god":{"name":"Старый Бог","lvl":5,"xp":200,"faith":150,"sp":2,"align":30,"skills":{"heal":2,"bolt":1,"rain":1,"bless":1}},
 "hero":{"name":"Ветеран","lvl":12,"xp":900,"hp":200,"maxHp":260,"gold":500,"potions":2,"weapon":["меч-кладенец",9],"armor":["кольчуга",6],
  "inv":[{"n":"носок","v":5}],"loc":"Годград","state":"fight","monster":{"n":"Гоблин","hp":5,"max":20},"quest":{"n":"Найти носок","p":40},"trust":70,"deadT":0,"townStep":0},
 "flock":{"fol":120,"temple":3,"army":4},"buffs":{"luck":0,"shield":0,"trade":0},"timers":{"hero":2,"fork":30,"duel":100,"event":100,"rivals":100},
 "fork":None,"duel":None,"ev":None,"forkHist":[],"lastEv":None,"diary":[{"tm":"01:00","x":"Старая запись","c":"","f":""}],
 "rivals":[{"id":"g2","name":"Матушка Плюшка","hero":"Бронислав Кочерга","pers":"heal","lvl":4,"w":3,"l":1,"army":1}],
 "stats":{"forks":10,"forksAns":5,"duels":3,"dwins":2,"events":1,"evwins":1},"speed":2,"paused":False,"tab":"powers","lastSeen":int(time.time()*1000)-3*3600*1000}
results={}
def ok(name, cond, info=''):
    results[name]=('OK' if cond else 'FAIL')+(' '+json.dumps(info,ensure_ascii=False)[:400] if info!='' and not cond else '')
RUN='''async(n)=>{const G=GAME;let k=0;while(k<n){G.step(0.5);k++;if(k%40==0)await new Promise(r=>setTimeout(r,20));} return k}'''
async def fresh(pg, cls='warrior'):
    await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
    await pg.select_option('#inCls',cls); await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.paused=true')
    await pg.evaluate("GAME.S.timers.fork=1e5;GAME.S.timers.duel=1e5;GAME.S.timers.dun=1e5;GAME.S.timers.event=1e5;GAME.S.god.faith=GAME.maxFaith();GAME.S.god.skills.bless=1;GAME.S.god.skills.shield=1")
async def dbg(pg, a):
    await pg.click('[data-act=settings]'); await pg.click(f'#modal [data-act=dbg][data-arg={a}]'); await pg.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        await fresh(pg,'warrior')
        ok('save version 7', await pg.evaluate('GAME.S.v===7 && !("duel" in GAME.S) && GAME.S.arena.rating===1000 && Array.isArray(GAME.S.hero.inj)'))
        # ---------- 1нс1 по зонам ----------
        await dbg(pg,'arena')
        r=await pg.evaluate("[GAME.S.fight&&GAME.S.fight.kind, GAME.S.hero.state, GAME.S.fight&&GAME.S.fight.fighters.length]")
        ok('1v1 arena fight starts', r==['duel','duel',2], r)
        await pg.evaluate("GAME.S.fight.t=0"); await pg.evaluate(RUN,1); await pg.wait_for_timeout(300)
        ok('zone picker: 10 body buttons', await pg.locator('#fightBox .zb').count()==10)
        await pg.click('#fightBox [data-act=fz][data-arg="a:head"]'); await pg.click('#fightBox [data-act=fz][data-arg="b:belly"]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("[GAME.S.fight.my.atk, GAME.S.fight.my.blk]")
        ok('warrior picks 1 attack + 3 adjacent blocks', r==[['head'],['chest','belly','waist']], r)
        ok('selected zones highlighted', await pg.locator('#fightBox .body.atk .zb.on').count()==1 and await pg.locator('#fightBox .body.blk .zb.on').count()==3)
        f0=await pg.evaluate("[GAME.S.god.faith, GAME.S.fight.powersLeft]")
        await pg.click('#fightBox [data-act=fpow] >> nth=0'); await pg.wait_for_timeout(150)
        f1=await pg.evaluate("[GAME.S.god.faith, GAME.S.fight.powersLeft, GAME.S.fight.usedTurn]")
        ok('god power in fight spends faith & limit', f1[0]<f0[0] and f1[1]==2 and f1[2]==1, [f0,f1])
        ok('second power same turn disabled', await pg.locator('#fightBox [data-act=fpow]:not([disabled])').count()==0)
        t0=await pg.evaluate("GAME.S.fight.turn"); await pg.click('#fightBox [data-act=fgo]'); await pg.wait_for_timeout(200)
        r=await pg.evaluate("[GAME.S.fight.turn, GAME.S.fight.log.some(l=>/Ход 1/.test(l.t)), GAME.S.fight.log.slice(0,6).map(l=>l.t)]")
        ok('turn resolves on «Ход!»', (r[0]==t0+1 or await pg.evaluate("GAME.S.fight.phase==='end'")) and r[1], r)
        results['sample combat log']=r[2]
        ok('log lines have hp tags', any('[' in x and '/' in x for x in r[2]) or any('блок' in x.lower() or 'увернул' in x.lower() for x in r[2]), r[2])
        # timer -> habit
        if await pg.evaluate("GAME.S.fight.phase==='turn'"):
            await pg.evaluate("GAME.S.fight.my.atk=[];GAME.S.fight.my.blk=[];GAME.S.fight.t=0.2"); await pg.evaluate(RUN,1)
            ok('timeout -> hero acts by habit', await pg.evaluate("GAME.S.fight.log.some(l=>/по привычке/.test(l.t))"))
        # auto
        await pg.click('#fightBox [data-act=fauto]')
        ok('auto-fight toggles', await pg.evaluate("GAME.S.fight.auto===true && GAME.S.fightAuto===true"))
        await pg.evaluate(RUN,400)
        r=await pg.evaluate("[!!GAME.S.fight, GAME.S.hero.state, GAME.S.arena.w+GAME.S.arena.l, GAME.S.arena.rating, GAME.S.hero.hp>=1]")
        ok('auto-fight finishes, rating changes, hero alive', r[0]==False and r[1]!='duel' and r[2]==1 and r[3]!=1000 and r[4], r)
        await pg.evaluate("GAME.fightAuto(false)")
        # ---------- 3нс3 ----------
        await pg.evaluate("GAME.S.hero.hp=GAME.S.hero.maxHp"); await dbg(pg,'group')
        r=await pg.evaluate("[GAME.S.fight.kind, GAME.S.fight.fighters.filter(f=>f.team===0).length, GAME.S.fight.fighters.filter(f=>f.team===1).length]")
        ok('3v3 group fight', r==['group',3,3], r)
        await pg.evaluate("GAME.S.fight.t=0"); await pg.evaluate(RUN,1); await pg.wait_for_timeout(250)
        n=await pg.locator('#fightBox [data-act=ftarget]').count(); ok('enemy rows clickable for target', n==3, n)
        tid=await pg.evaluate("GAME.S.fight.fighters.filter(f=>f.team===1)[2].id")
        await pg.click(f'#fightBox [data-act=ftarget][data-arg="{tid}"]'); await pg.wait_for_timeout(150)
        ok('target selection', await pg.evaluate(f"GAME.S.fight.my.target==='{tid}'") and await pg.locator('#fightBox .fr.sel').count()==1)
        await pg.screenshot(path='/workspace/godgame/shot4_group.png')
        await pg.evaluate("GAME.autoResolveBattle(GAME.S.fight)")
        ok('group fight resolves', await pg.evaluate("!GAME.S.fight && GAME.S.hero.state!=='duel'"))
        # ---------- хаот ----------
        r=await pg.evaluate('''(()=>{const G=GAME,S=G.S;S.hero.hp=S.hero.maxHp;S.hero.state='road';S.arena.apps=[];G.arenaPost('chaos:6');const a=S.arena.apps[0];let k=0;while(S.arena.apps.includes(a)&&k<400){G.arenaStep(0.5);k++}
           const F=S.fight;return F&&[F.kind,F.fighters.length,F.fighters.find(f=>f.isMe).team, F.fighters.filter(f=>f.team===0).length]})()''')
        ok('chaos: 6 fighters random split, me on team 0', r and r[0]=='chaos' and r[1]==6 and r[2]==0 and r[3]==3, r)
        await pg.evaluate("GAME.S.fight&&GAME.autoResolveBattle(GAME.S.fight)")
        # ---------- заявки ----------
        r=await pg.evaluate('''(()=>{const G=GAME,S=G.S;S.hero.hp=S.hero.maxHp;S.hero.state='road';S.arena.apps=[];let k=0;while(S.arena.apps.length<4&&k<2000){G.arenaStep(0.5);k++} return [S.arena.apps.length,S.arena.apps.map(a=>a.type)]})()''')
        ok('bots post applications', r[0]>=3, r)
        await pg.evaluate("GAME.S.tab='arena'; GAME.S.arena.apps.push(GAME.newBotApp(GAME.S.arena,{name:'Бот Тест',race:'elf',cls:'mage',lvl:1},1)); GAME.S.arena.apps.forEach(a=>{a.t=500;}); "
                          "(()=>{const a=GAME.S.arena.apps.find(a=>a.type==='group'); if(!a){const b=GAME.newBotApp(GAME.S.arena,{name:'Бот Г',race:'elf',cls:'mage',lvl:1},1); b.type='group';b.size=3;b.members=[];b.teams=[[{name:'Бот Г',race:'elf',cls:'mage',lvl:1}],[]];b.t=500;GAME.S.arena.apps.push(b);} })()")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path='/workspace/godgame/shot4_arena.png')
        aid=await pg.evaluate("(GAME.S.arena.apps.find(a=>a.type==='group'&&a.teams[1].length<a.size)||{}).id")
        await pg.click(f'[data-act=ajoin][data-arg="{aid}:1"]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate(f"(()=>{{const a=GAME.S.arena.apps.find(a=>a.id==='{aid}');return a&&[a.joined,a.teams[1].some(m=>m.me)]}})()")
        ok('join group app on side B', r==[1,True], r)
        ok('cannot join two apps', await pg.evaluate("!GAME.S.arena.apps.filter(a=>a.joined===null).some(a=>{GAME.arenaJoin(a.id+':0'); return a.joined!==null})"))
        await pg.click(f'[data-act=aleave][data-arg="{aid}"]'); await pg.wait_for_timeout(100)
        ok('leave application', await pg.evaluate(f"GAME.S.arena.apps.find(a=>a.id==='{aid}').joined===null"))
        await pg.click('[data-act=apost][data-arg="group:3"]'); await pg.wait_for_timeout(100)
        r=await pg.evaluate('''(()=>{const G=GAME,S=G.S;let k=0;while(!S.fight&&k<400){G.arenaStep(0.5);k++}return [S.fight&&S.fight.kind,k*0.5,S.fight&&S.fight.fighters.length]})()''')
        ok('own 3v3 application fills with bots and starts', r[0]=='group' and r[2]==6 and r[1]<=76, r)
        await pg.evaluate("GAME.autoResolveBattle(GAME.S.fight)")
        # ---------- травмы ----------
        r=await pg.evaluate('''(()=>{const G=GAME,S=G.S,h=S.hero;h.inj=[];const v0=G.statVal('str');h.inj.push({k:'mid',s:'str',t:3600,n:'x'});const v1=G.statVal('str');
            G.healInjuries('temple');const v2=G.statVal('str');h.inj.push({k:'light',s:'dex',t:1.5,n:'x'});S.paused=false;G.step(1);G.step(1);G.step(1);return [v0,v1,v2,h.inj.length]})()''')
        ok('injury lowers stat, temple cures, time heals', r[1]==r[0]-2 and r[2]==r[0] and r[3]==0, r)
        r=await pg.evaluate('''(()=>{const G=GAME,S=G.S,h=S.hero;h.state='road';h.inj=[{k:'heavy',s:'con',t:9000,n:'x'}];h.maxHp=G.calcMaxHp(h);S.god.faith=100;G.usePower('heal');return [h.inj.length,h.maxHp===G.calcMaxHp(h)]})()''')
        ok('heal power cures one injury', r==[0,True], r)
        await pg.evaluate("GAME.S.paused=true")
        # ---------- ручной бой с монстром ----------
        await pg.evaluate("GAME.S.hero.hp=GAME.S.hero.maxHp;GAME.S.hero.state='road';GAME.heroStep&&0"); 
        await pg.evaluate("(()=>{const h=GAME.S.hero;h.state='road';})()")
        r=await pg.evaluate("(()=>{const G=GAME,h=G.S.hero; let k=0; while(h.state!=='fight'&&k<200){G.heroStep();k++; if(h.state==='town'||h.state==='rest'){h.state='road';h.restT=0}} return h.state})()")
        await pg.wait_for_timeout(300)
        ok('manual-fight button on hero panel', await pg.locator('[data-act=fmanual]').count()==1, r)
        await pg.click('[data-act=fmanual]'); await pg.wait_for_timeout(150)
        ok('monster fight under control', await pg.evaluate("GAME.S.fight&&GAME.S.fight.kind==='monster'"))
        await pg.evaluate("GAME.autoResolveBattle(GAME.S.fight)")
        r=await pg.evaluate("[!!GAME.S.fight, GAME.S.hero.state, !!GAME.S.hero.monster]")
        ok('monster fight ends cleanly', r[0]==False and r[1] in ('road','dead','town') and r[2]==False, r)
        # ---------- дуэль богов ----------
        r=await pg.evaluate('''async()=>{const G=GAME,S=G.S;if(S.hero.state==='dead'){S.hero.state='road';S.hero.hp=S.hero.maxHp}S.hero.state='road';S.hero.hp=S.hero.maxHp;const w0=S.rivals.reduce((a,r)=>a+r.w+r.l,0);
            await G.startGodDuel();const F=S.fight;const rg=F&&F.rivalGod&&F.rivalGod.name;G.autoResolveBattle(F);return [F&&F.kind,rg,S.rivals.reduce((a,r)=>a+r.w+r.l,0)-w0,S.hero.state,S.stats.duels]}''')
        ok('god duel = zone fight vs rival god', r[0]=='godduel' and r[1] and r[2]==1 and r[3]=='road', r)
        # ---------- пещера ----------
        await pg.evaluate("GAME.S.hero.state='road';GAME.S.hero.hp=GAME.S.hero.maxHp;GAME.S.god.faith=200;GAME.S.timers.dunCd=0;GAME.S.tab='gods'"); await pg.wait_for_timeout(300)
        await pg.click('[data-act=callDun]'); await pg.wait_for_timeout(150); await pg.click('#modal [data-act=dunTier][data-arg=normal]'); await pg.wait_for_timeout(500)
        r=await pg.evaluate("[!!GAME.S.dun, GAME.S.hero.state, GAME.S.dun&&GAME.S.dun.party.length, GAME.S.dun&&GAME.S.dun.tiles.filter(Boolean).length, GAME.S.timers.dunCd]")
        ok('dungeon map started (party 3-4, 12-15 rooms, cooldown set)', r[0] and r[1]=='dungeon' and 3<=r[2]<=4 and 12<=r[3]<=15 and r[4]>0, r)
        n=await pg.locator('#dunBox [data-act=dgo]').count(); ok('adjacent rooms clickable', n>=1, n)
        await pg.screenshot(path='/workspace/godgame/shot4_dungeon.png')
        p0=await pg.evaluate("JSON.stringify(GAME.S.dun.pos)"); await pg.click('#dunBox [data-act=dgo] >> nth=0'); await pg.wait_for_timeout(150)
        ok('move to adjacent room', await pg.evaluate("JSON.stringify(GAME.S.dun.pos)")!=p0)
        r=await pg.evaluate('''(()=>{const G=GAME,U=G.S.dun; if(G.S.fight) G.autoResolveBattle(G.S.fight); if(!G.S.dun) return 'ended'; const bi=U.tiles.findIndex(t=>t&&t.t==='boss'); const bx=bi%5,by=Math.floor(bi/5);
           const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[bx+dx,by+dy]).find(([x,y])=>x>=0&&y>=0&&x<5&&y<5&&U.tiles[y*5+x]); U.pos={x:nb[0],y:nb[1]}; U.keys=0; U.party.forEach(p=>{if(p.cls==='rogue')p.cls='warrior'}); if(G.S.hero.cls==='rogue') return 'skip';
           G.dunMove(bx+','+by); return [U.pos.x===bx&&U.pos.y===by, U.log[0].t]})()''')
        ok('boss door locked without key', r=='ended' or r=='skip' or r[0]==False, r)
        r=await pg.evaluate('''async()=>{const G=GAME,S=G.S;S.dun&&(S.dun.auto=true);let k=0;while(S.dun&&S.dun.phase!=='end'&&k<6000){ if(S.fight&&!S.fight.auto) G.fightAuto(true); G.step(0.5);k++;if(k%40==0)await new Promise(r=>setTimeout(r,10));}
           return {res:S.dun&&S.dun.result,state:S.hero.state,k,bosses:S.stats.bosses}}''')
        ok('dungeon completes with result', bool(r['res']) and r['state'] in ('road',), r); results['dungeon result']=r['res']
        await pg.wait_for_timeout(300)
        if await pg.locator('[data-act=dclose]').count(): await pg.click('[data-act=dclose]')
        ok('dungeon closes', await pg.evaluate('!GAME.S.dun'))
        ok('cooldown blocks auto dungeon', await pg.evaluate("(async()=>{GAME.S.hero.state='road'; return (await GAME.startDungeon(false))===false && !GAME.S.dun})()"))
        await pg.evaluate("GAME.fightAuto(false)")
        # ---------- чат ----------
        await pg.click('#chatPill'); await pg.wait_for_timeout(150)
        ok('chat opens', await pg.evaluate("GAME.S.chat.open") and await pg.locator('#chatDock .chatPanel').is_visible())
        await pg.fill('#chatIn','Привет всем, кто в хаот?'); await pg.press('#chatIn','Enter'); await pg.wait_for_timeout(150)
        ok('my message in chat', await pg.evaluate("GAME.S.chat.msgs.some(m=>m.c==='me'&&/Привет всем/.test(m.x))") and 'Привет всем' in await pg.inner_text('#chatLog'))
        await pg.evaluate("for(let i=0;i<6;i++) GAME.chatSend('привет '+i)")
        await pg.evaluate("GAME.S.paused=false"); await pg.evaluate(RUN,40); await pg.evaluate("GAME.S.paused=true")
        ok('bots reply', await pg.evaluate("GAME.S.chat.msgs.filter(m=>m.c==='bot').length>=1"))
        await pg.fill('#chatIn','<img src=x onerror="window.__xss=1">'); await pg.press('#chatIn','Enter'); await pg.wait_for_timeout(200)
        ok('chat escapes html', await pg.evaluate("!window.__xss && !document.querySelector('#chatLog img')"))
        ok('chat capped at 60', await pg.evaluate("(()=>{for(let i=0;i<100;i++)GAME.chat.system('спам '+i);return GAME.S.chat.msgs.length===60})()"))
        await pg.screenshot(path='/workspace/godgame/shot4_chat.png')
        await pg.click('#chatDock [data-act=chatToggle] >> visible=true'); 
        # ---------- сохранение посреди боя ----------
        await pg.evaluate("GAME.S.hero.state='road';GAME.S.hero.hp=GAME.S.hero.maxHp;GAME.S.fork=null"); await dbg(pg,'arena')
        await pg.evaluate("GAME.S.fight.t=0;GAME.step(0.1);GAME.fightZone('a:legs');GAME.save()")
        fid=await pg.evaluate("GAME.S.fight.id")
        await pg.reload(); await pg.wait_for_timeout(400)
        r=await pg.evaluate("[GAME.S.fight&&GAME.S.fight.id, GAME.S.fight&&GAME.S.fight.my.atk, GAME.S.hero.state]")
        ok('fight survives reload', r==[fid,['legs'],'duel'], r)
        r=await pg.evaluate("(()=>{GAME.simulateAway(3600);return [!!GAME.S.fight,GAME.S.hero.state]})()")
        ok('offline resolves fight', r[0]==False and r[1]!='duel', r)
        r=await pg.evaluate('''async()=>{const S=GAME.S;S.hero.state='road';S.hero.hp=S.hero.maxHp;S.timers.dunCd=0;await GAME.startDungeon(true);GAME.dunMove&&0;GAME.simulateAway(7200);return [!!S.dun,!!S.fight,S.hero.state,S.diary.slice(0,15).some(e=>/🏰/.test(e.x))]}''')
        ok('offline finishes dungeon', r[0]==False and r[1]==False and r[2] not in ('dungeon','duel'), r)
        # ---------- миграции ----------
        v3=await pg.evaluate('''(()=>{const s=JSON.parse(JSON.stringify(GAME.S));s.v=3;delete s.fight;delete s.arena;delete s.chat;delete s.fightAuto;delete s.hero.inj;delete s.timers.dunCd;s.hero.state='duel';
           s.duel={phase:'fight',me:{hp:10},foe:{hp:10},opp:{god:'X'},log:[],myActs:[],foeActs:[]};s.dun={phase:'room',party:[],rooms:['fight'],idx:0,log:[],room:{opts:[]}};s.lastSeen=Date.now();return JSON.stringify(s)})()''')
        for name,save,vp in (('v3->v4',v3,(390,844)),('v2->v4',json.dumps(V2,ensure_ascii=False),(320,640))):
            c=await br.new_context(viewport={'width':vp[0],'height':vp[1]}); q=await c.new_page(); q.on('pageerror', lambda e: errs.append(name+': '+str(e)))
            await q.add_init_script(f"if(!sessionStorage.getItem('x')){{localStorage.setItem('bogodel_save_v1', {json.dumps(save)});sessionStorage.setItem('x',1)}}")
            await q.goto(URL); await q.wait_for_timeout(800)
            r=await q.evaluate('''(()=>{const S=GAME.S,h=S.hero;return {v:S.v,duel:'duel' in S,dun:S.dun,fight:S.fight,state:h.state,inj:h.inj,arena:S.arena&&S.arena.rating,chat:S.chat&&S.chat.msgs.length,diary:S.diary.slice(0,4).map(e=>e.x.slice(0,60)),max:h.maxHp===GAME.calcMaxHp(h)}})()''')
            ok(name+' migration', r['v']==7 and not r['duel'] and r['dun'] is None and r['fight'] is None and r['state'] in ('road','town','rest','fight','dead') and r['inj']==[] and r['arena']==1000 and r['max'], r)
            ok(name+' arena note in diary', any('Арена' in x for x in r['diary']), r['diary'])
            await q.screenshot(path=f'/workspace/godgame/shot4_mig_{name[:2]}.png')
            await c.close()
        results['js_errors']=errs
        fails=[k for k,v in results.items() if isinstance(v,str) and v.startswith('FAIL')]
        results['SUMMARY']=f"{sum(1 for v in results.values() if isinstance(v,str) and v.startswith('OK'))} OK, {len(fails)} FAIL"
        print(json.dumps(results,ensure_ascii=False,indent=1))
        await br.close()
asyncio.run(main())

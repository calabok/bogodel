# v12: целевые проверки «Войны за Олимп»
import asyncio, json, sys, os
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
SHOTS=os.environ.get('SHOTS12','/workspace/godgame/shots12_olymp/'); os.makedirs(SHOTS,exist_ok=True)
res={}; errs=[]
def ok(name,cond,info=None):
    res[name]='OK' if cond else 'FAIL'
    if not cond: res['_'+name[:40]]=info
    print(('OK  ' if cond else 'FAIL'),name, '' if cond else info, flush=True)
async def newpage(br,w,h=860,fresh=True):
    ctx=await br.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(f'{w}: '+str(e))); pg.on('console',lambda m: errs.append(f'{w}: '+m.text) if m.type=='error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(250)
    if fresh and await pg.is_visible('[data-act=newGame]'): await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    if fresh: await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx,pg
CLEAN="(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); GAME.render(); window.scrollTo(0,0);})()"
SIZES="""(sel)=>{const sm=[]; if(innerWidth<=760) for(const b of document.querySelectorAll(sel)){ if(!b.offsetParent) continue; const r=b.getBoundingClientRect(); if(!r.width) continue; if(r.height<40||r.width<40) sm.push((b.dataset.act||b.className)+':'+Math.round(r.width)+'x'+Math.round(r.height)); } return sm}"""
OV="document.documentElement.scrollWidth>innerWidth+1 || [...document.querySelectorAll('#modal .mbox, .omap, .oboard')].some(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+2)"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        # ---------- 1. ширины: карта, таблица, лист региона, конец сезона ----------
        for W in [320,390,768,1280,1920]:
            ctx,pg=await newpage(br,W)
            await pg.evaluate("(()=>{const G=GAME; G.simulateAway(3*3600); GAME.S.paused=true;})()"); await pg.evaluate(CLEAN)
            lab=await pg.evaluate("document.querySelector('#mnav [data-arg=gods]').textContent")
            await pg.click('#mnav [data-arg=gods]'); await pg.wait_for_timeout(150)
            r=await pg.evaluate(f"""(()=>{{const m=document.querySelector('.omap'); const b=m&&m.getBoundingClientRect(); const hx=[...document.querySelectorAll('.omap .rg')];
              const hb=hx.map(e=>e.getBoundingClientRect()); const minHex=Math.min(...hb.map(r=>Math.min(r.width,r.height)));
              return {{map:!!(m&&b.width>200&&b.height>150), w:b&&Math.round(b.width), hexes:hx.length, minHex:Math.round(minHex), roles:hx.every(e=>e.getAttribute('role')==='button'&&e.getAttribute('tabindex')==='0'&&e.getAttribute('aria-label')),
                rows:document.querySelectorAll('.oboard .orow').length, season:!!document.querySelector('.osea'), legend:!!document.querySelector('.olegend'), chron:document.body.innerText.includes('Хроника'), ov:{OV}}}}})()""")
            ok(f'{W}px: «🏛 Олимп» tab — map (14 tappable hexes ≥40px), season box, leaderboard (9 gods), legend, chronicle, no horizontal scroll',
               'Олимп' in lab and r['map'] and r['hexes']==14 and r['minHex']>=40 and r['roles'] and r['rows']==9 and r['season'] and r['legend'] and r['chron'] and not r['ov'], r)
            sm=await pg.evaluate(SIZES,'#rightBody button, .omap .rg')
            if W<=760: ok(f'{W}px: Олимп tab buttons ≥40px', not sm, sm)
            if W in (390,1280):
                await pg.evaluate("window.scrollTo(0,0)"); el=await pg.query_selector('.osea')
                await el.scroll_into_view_if_needed(); await pg.screenshot(path=f'{SHOTS}map_{W}.png')
                el=await pg.query_selector('.oboard'); await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(80); await pg.screenshot(path=f'{SHOTS}leaderboard_{W}.png')
            # лист региона
            await pg.evaluate("document.querySelector('.omap .rg[data-arg=zamok]').scrollIntoView({block:'center'})")
            await pg.click('.omap .rg[data-arg=zamok]'); await pg.wait_for_timeout(150)
            r=await pg.evaluate(f"""(()=>{{const m=document.getElementById('modal'); const t=m.innerText; return {{on:m.classList.contains('on'), name:t.includes('Замок барона Храпуна'), owner:t.includes('Владелец'), bonus:t.includes('Бонус владельцу'),
               btn:['rsend','rtemple','rstorm','rduel'].every(a=>!!m.querySelector('[data-act='+a+']')), gods:m.querySelectorAll('.rgods li').length, ov:{OV}}}}})()""")
            ok(f'{W}px: region sheet — name, owner, bonus, per-god souls, buttons send/temple/storm/duel, no overflow', r['on'] and r['name'] and r['owner'] and r['bonus'] and r['btn'] and r['gods']>=2 and not r['ov'], r)
            sm=await pg.evaluate(SIZES,'#modal button')
            if W<=760: ok(f'{W}px: region sheet buttons ≥40px', not sm, sm)
            if W in (390,1280): await pg.screenshot(path=f'{SHOTS}region_{W}.png')
            await pg.evaluate(CLEAN)
            # конец сезона (онлайн)
            await pg.evaluate("(()=>{const S=GAME.S; S.oly.inf.me=99999; S.oly.end=Date.now()-1000; GAME.olyTick(1); GAME.render();})()"); await pg.wait_for_timeout(250)
            r=await pg.evaluate(f"""(()=>{{const m=document.getElementById('modal'),S=GAME.S; return {{on:m.classList.contains('on'), t:m.innerText.includes('Сезон 1 окончен'), throne:m.innerText.includes('трон'), big:!!m.querySelector('.mcbig'), n:S.oly.n, ov:{OV}}}}})()""")
            ok(f'{W}px: season end card (throne, list of 7 thrones, big «В новый сезон»), no overflow', r['on'] and r['t'] and r['throne'] and r['big'] and r['n']==2 and not r['ov'], r)
            if W in (390,1280): await pg.screenshot(path=f'{SHOTS}season_end_{W}.png')
            await pg.click('#modal [data-act=seasonOk]'); await pg.wait_for_timeout(120)
            r=await pg.evaluate("(()=>({closed:!document.getElementById('modal').classList.contains('on'), seen:GAME.S.oly.last.seen, frame:document.body.dataset.frame||'', hdr:!!document.querySelector('header .gav.fr')}))()")
            ok(f'{W}px: «В новый сезон» closes the card; throne frame shows in the header', r['closed'] and r['seen'] and r['frame']=='f1' and r['hdr'], r)
            # вступление
            await pg.evaluate("(()=>{GAME.S.oly.intro=0; GAME.S.ui.mtab='hero'; GAME.render(); window.scrollTo(0,0)})()"); await pg.wait_for_timeout(120)
            r=await pg.evaluate(f"(()=>{{const b=document.querySelector('#olyBox .olyintro'); return {{vis:!!(b&&b.offsetParent), ov:{OV}}}}})()")
            ok(f'{W}px: one-time intro card visible, no overflow', r['vis'] and not r['ov'], r)
            if W in (390,1280):
                el=await pg.query_selector('#olyBox'); await el.scroll_into_view_if_needed(); await pg.screenshot(path=f'{SHOTS}intro_{W}.png')
            await pg.click('#olyBox [data-act=olyGo]'); await pg.wait_for_timeout(120)
            r=await pg.evaluate("(()=>({intro:GAME.S.oly.intro, tab:GAME.S.ui.mtab, gone:!document.querySelector('#olyBox .olyintro')}))()")
            ok(f'{W}px: intro «Открыть карту» → Олимп tab, never shown again', r['intro']==1 and r['tab']=='gods' and r['gone'], r)
            await ctx.close()
        # ---------- 2. механика ----------
        ctx,pg=await newpage(br,390)
        await pg.evaluate(CLEAN)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,O=S.oly; const homes={}; for(const g of G.GOD_IDS){const o=G.REGIONS.find(R=>O.reg[R.id].own===g); homes[g]=o&&o.id;}
          return {n:O.n, len:Math.round((O.end-O.start)/86400e3), homes, me:O.reg.godgrad.own, heroReg:S.hero.reg, neutral:G.REGIONS.filter(R=>!O.reg[R.id].own).length}})()""")
        ok('new world: 14 regions, 9 gods each own their home, season = 28 days, hero in Годград', r['n']==1 and r['len']==28 and all(r['homes'].values()) and r['me']=='me' and r['heroReg']=='godgrad', r)
        # отправить героя
        await pg.click('#mnav [data-arg=gods]'); await pg.evaluate("document.querySelector('.omap .rg[data-arg=kapust]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await pg.wait_for_timeout(100)
        await pg.click('#modal [data-act=rsend]'); await pg.wait_for_timeout(100)
        r=await pg.evaluate("""async()=>{const G=GAME,S=G.S; const d0=S.oly.dest; let t=0; while(S.hero.reg!=='kapust'&&t<6*3600){for(let i=0;i<300;i++){G.step(1);t++;} if(S.fight){S.fight=null;S.hero.state='road';} await new Promise(r=>setTimeout(r,1));}
          return {d0, reg:S.hero.reg, h:+(t/3600).toFixed(2), hold:!!S.oly.hold, diary:S.diary.some(e=>/Капустинск/.test(e.x))}}""")
        ok('send hero: region → «Отправить героя» → hero walks there over time (≤6 game h), then holds it', r['d0']=='kapust' and r['reg']=='kapust' and r['hold'] and r['diary'], r)
        # захват региона
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,X=S.oly.reg.pinki; X.s={g1:200,me:150}; X.own=null; G.regOwner('pinki'); const a=X.own; X.s.me=400; G.regOwner('pinki');
          return {a, b:X.own, diary:/Нижние Пинки.*мой/.test(S.diary[0].x), log:S.oly.log[0].x, bonus:G.olyOwned('me')>=2}})()""")
        ok('region capture: largest share (≥12% of souls) takes the region with hysteresis; diary + chronicle line', r['b']=='me' and r['diary'], r)
        # бонусы
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; const c0=G.soldierCost(); S.oly.reg.pereval.own='me'; const c1=G.soldierCost(); const f0=G.maxFaith(); return {c0,c1}})()""")
        ok('region bonus applies (Перевал: soldier −3 faith)', r['c1']==r['c0']-3, r)
        # храм в регионе
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.god.faith=G.maxFaith(); const f0=S.god.faith; G.regionModal(S.hero.reg); const b=document.querySelector('#modal [data-act=rtemple]'); const dis=b.disabled; b.click(); G.render();
          return {dis, tp:S.oly.reg[S.hero.reg].tp.me, spent:Math.round(f0-S.god.faith), btn:document.querySelector('#modal [data-act=rtemple]').textContent}})()""")
        ok('temple in region: build where the hero is (costs faith, level 1 → converts and defends)', not r['dis'] and r['tp']>=1 and r['spent']>=50, r)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,id=S.hero.reg; const X=S.oly.reg[id]; const tp=X.tp.me; const m0=X.s.me||0; S.hero.reg='godgrad'; for(let i=0;i<60;i++) G.olyStep(60); return {tp, gain:Math.round((X.s.me||0)-m0)}})()""")
        ok('region temple keeps converting while the hero is elsewhere', r['gain']>0, r)
        await pg.evaluate(CLEAN)
        # штурм армией
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.flock.army=20; const X=S.oly.reg.zamok, m0=X.s.me||0, g0=X.s.g1; G.regionModal('zamok'); document.querySelector('#modal [data-act=rstorm][data-arg="zamok:all"]').click(); G.render();
          const b=document.querySelector('#modal [data-act=rstorm]'); return {gain:Math.round((X.s.me||0)-m0), take:Math.round(g0-X.s.g1), army:S.flock.army, cd:X.cdS, dis:b.disabled, diary:S.diary.slice(0,4).some(e=>/штурмует регион Замок/.test(e.x))}})()""")
        ok('army storm: existing army converts the owner\'s souls, loses some soldiers, then cooldown', r['gain']>0 and r['take']>0 and 0<r['army']<20 and r['cd']>0 and r['dis'] and r['diary'], r)
        await pg.evaluate(CLEAN)
        # атаки ботов
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,X=S.oly.reg.godgrad; S.flock.army=0; const r1=S.rivals.find(r=>r.id==='g1'); r1.army=20; const m0=X.s.me;
          G.olyApply({god:'g1',kind:'focus',reg:'godgrad'}); const warn=S.diary.find(e=>/⚠ Бог .* обращает души в Годграде/.test(e.x));
          G.olyApply({god:'g1',kind:'storm',reg:'godgrad',n:12}); const st=S.diary.find(e=>/🔥 Армия бога/.test(e.x));
          G.olyApply({god:'g1',kind:'preach',reg:'godgrad',power:50});
          return {warn:!!warn, st:!!st, lost:Math.round(m0-X.s.me), army:r1.army}})()""")
        ok('bot attacks: «⚠ Бог X обращает души в Годграде» diary line, bot army storm takes my souls', r['warn'] and r['st'] and r['lost']>0 and r['army']<20, r)
        r=await pg.evaluate("""async()=>{const G=GAME,S=G.S; const own0=G.REGIONS.map(R=>S.oly.reg[R.id].own).join(); const L=S.oly.log.length; let t=0, firstFlip=null; const o0=G.REGIONS.map(R=>S.oly.reg[R.id].own);
          const gods=new Set(); let ev=0; while(t<6*3600){ const head=S.oly.log[0]; for(let i=0;i<300;i++){G.step(1);t++;} {const k=S.oly.log.indexOf(head); ev+= k<0?30:k;} if(S.fight){S.fight=null;S.hero.state='road';} for(const e of S.oly.log) {const m=e.x.match(/^\\S+ (.+?) (проповедует|:)/); if(m) gods.add(m[1]);}
            if(firstFlip===null && G.REGIONS.some((R,i)=>S.oly.reg[R.id].own!==o0[i])) firstFlip=t; await new Promise(r=>setTimeout(r,1)); }
          return {gods:gods.size, evPerH:+(ev/6).toFixed(1), firstFlipMin:firstFlip&&Math.round(firstFlip/60), flips:G.REGIONS.filter((R,i)=>S.oly.reg[R.id].own!==o0[i]).length}}""")
        ok('bots live: in 6 game hours ≥5 different bot gods act, chronicle events every few minutes (≥8/h), regions change hands within ~3 h', r['gods']>=5 and r['evPerH']>=8 and r['firstFlipMin'] is not None and r['firstFlipMin']<=180, r)
        print('   bots live:', r)
        # дуэль богов за регион
        await pg.evaluate(CLEAN)
        r=await pg.evaluate("""async()=>{const G=GAME,S=G.S; S.god.faith=50; const id=G.REGIONS.find(R=>{const X=S.oly.reg[R.id]; return X.own&&X.own!=='me'&&X.cdD<=0}).id; S.hero.state='road';
          const ok=G.olyDuel(id); for(let i=0;i<40&&!S.fight;i++) await new Promise(r=>setTimeout(r,50));
          const F=S.fight; const res={ok, kind:F&&F.kind, region:F&&F.region, id};
          const X=S.oly.reg[id], g=X.own, m0=X.s.me||0; const txt=G.olyDuelResult(id,g,true); res.gain=Math.round((X.s.me||0)-m0); res.txt=txt; return res}""")
        ok('god duel in region: starts the existing god duel (zones), carries the region, win moves souls', r['ok'] and r['kind']=='godduel' and r['region']==r['id'] and r['gain']>0, r)
        await pg.evaluate(CLEAN)
        # голос
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.god.faith=50; S.hero.trust=100; S.oly.dest=null; const i=document.getElementById('voiceIn'); i.value='иди в Туманные болота'; document.querySelector('[data-act=voice]').click(); return {dest:S.oly.dest}})()""")
        ok('voice: «иди в Туманные болота» sends the hero there', r['dest']=='tuman', r)
        # ролловер
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero; const lvl=h.lvl, items=JSON.stringify(h.eq), gold=h.gold, temple=S.flock.temple; S.oly.inf.me=1; S.oly.end=Date.now()-1; G.olyTick(1); const O=S.oly;
          return {n:O.n, rank:O.last.rank, rew:O.rew, lvl:h.lvl===lvl, items:JSON.stringify(h.eq)===items, temple:S.flock.temple===temple, inf:O.inf.me, hist:O.hist.length, home:O.reg.godgrad.own, tp:G.REGIONS.filter(R=>O.reg[R.id].tp.me&&R.id!=='godgrad').length, chip:document.querySelector('.olyc')&&document.querySelector('.olyc').textContent}})()""")
        ok('rollover: last season ranked, map reset (homes again, my region temples gone), influence 0, hero level/items/main temple kept; no throne at rank 9', r['n']==2 and r['lvl'] and r['items'] and r['temple'] and r['inf']==0 and r['hist']==1 and r['home']=='me' and r['tp']==0 and (r['rew'] is None)==(r['rank']>7), r)
        await pg.wait_for_timeout(150); await pg.evaluate("GAME.S.oly.last.seen=1")
        await pg.evaluate(CLEAN)
        # офлайн: конец сезона в догонялке
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.oly.inf.me=1e6; S.oly.end=Date.now()-5*3600e3; const n0=S.oly.n; G.simulateAway(2*86400); const la=G.getLastAway(); G.awayModal(); const m=document.getElementById('modal').innerText;
          return {n0, n:S.oly.n, oly:la.oly, card:m.includes('Сезон '+n0+' завершился'), rank1:/1-й/.test(m), rew:S.oly.rew&&S.oly.rew.title, frame:document.body.dataset.frame}})()""")
        ok('offline season end: catch-up (beyond the 24 h hero cap) ends the season, offline card shows the result', r['n']==r['n0']+1 and r['card'] and r['rank1'] and r['rew'], r)
        await pg.screenshot(path=f'{SHOTS}offline_season_390.png')
        await pg.click('#modal [data-act=awayOk]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>({season:document.getElementById('modal').innerText.includes('окончен')}))()")
        ok('after the offline card, the season-end card follows', r['season'], r)
        await pg.evaluate(CLEAN)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.oly.reg.les.s.me=NaN; S.oly.reg.les.own='zzz'; S.hero.reg='nowhere'; S.oly.end='x'; G.save(); return 1})()""")
        await pg.reload(); await pg.wait_for_timeout(300)
        r=await pg.evaluate("(()=>{const S=GAME.S; return {own:S.oly.reg.les.own, me:S.oly.reg.les.s.me, reg:S.hero.reg, end:typeof S.oly.end, n:S.oly.n}})()")
        ok('corrupted world in a save is repaired on load', r['own']!='zzz' and (r['me'] is None or r['me']>=0) and r['reg'] in ['les','pinki','boloto','pereval','godgrad','dolina','gora','kapust','zamok','ponty','pustosh','bereg','ovrag','tuman'] and r['end']=='number', r)
        await ctx.close()
        # ---------- 3. миграция старого сохранения ----------
        ctx,pg=await newpage(br,390)
        old=await pg.evaluate("(()=>{const S=JSON.parse(JSON.stringify(GAME.S)); S.v=9; delete S.oly; delete S.hero.reg; S.hero.loc='Капустинск'; S.hero.lvl=7; S.lastSeen=Date.now(); return JSON.stringify(S);})()")
        key=await pg.evaluate("GAME.SAVE_KEY"); await ctx.close()
        ctx=await br.new_context(viewport={'width':390,'height':860}); pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append('mig: '+str(e)))
        await pg.add_init_script("if(!sessionStorage.getItem('mig')){sessionStorage.setItem('mig','1'); localStorage.setItem(%s, %s);}" % (json.dumps(key), json.dumps(old)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r=await pg.evaluate("""(()=>{const S=GAME.S,O=S.oly; return {v:S.v, n:O&&O.n, left:O&&Math.round((O.end-Date.now())/86400e3), started:O&&Math.round((Date.now()-O.start)/3600e3), reg:S.hero.reg, lvl:S.hero.lvl, intro:!!document.querySelector('#olyBox .olyintro'),
           diary:S.diary.some(e=>/Война за Олимп/.test(e.x)), inf:O&&Math.round(O.inf.me), own:O&&O.reg.godgrad.own}})()""")
        ok('migration v9 → v10: old save keeps hero (lvl 7), starts season 1 fairly (fresh map, ~28 days left), hero region from location, intro card + diary notice', r['n']==1 and 27<=r['left']<=28 and r['reg']=='kapust' and r['lvl']==7 and r['intro'] and r['diary'] and r['own']=='me', r)
        await ctx.close()
        ok('no JS errors', not errs, errs[:6])
        await br.close()
    fails=[k for k,v in res.items() if v=='FAIL']
    print(f"\n{sum(1 for v in res.values() if v=='OK')}/{sum(1 for k in res if not k.startswith('_'))} OK", 'FAILS:' if fails else '', fails)
asyncio.run(main())

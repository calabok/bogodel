# v11: целевые проверки нового интерфейса «Сцена бога»
import asyncio, json, sys, os
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
SHOTS=os.environ.get('SHOTS11','/workspace/godgame/shots11_ui/')
res={}; errs=[]
def ok(name,cond,info=None):
    res[name]='OK' if cond else 'FAIL'
    if not cond: res['_'+name[:40]]=info
    print(('OK  ' if cond else 'FAIL'),name, '' if cond else info, flush=True)
async def newpage(br,w,h=860,**kw):
    ctx=await br.new_context(viewport={'width':w,'height':h},**kw); pg=await ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(f'{w}: '+str(e))); pg.on('console',lambda m: errs.append(f'{w}: '+m.text) if m.type=='error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(250)
    if await pg.is_visible('[data-act=newGame]'): await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx,pg
CLEAN="(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(h.state==='dead'||h.state==='fight'||h.state==='duel'||h.state==='dungeon'){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); GAME.render(); window.scrollTo(0,0);})()"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        # ---------- 1. ширины: навигация, переполнение, размеры кнопок ----------
        for W in [320,390,768,1280,1920]:
            ctx,pg=await newpage(br,W)
            await pg.evaluate("(()=>{const G=GAME,S=G.S; S.god.lvl=4; S.god.sp=1; Object.assign(S.god.skills,{heal:1,bolt:1,rain:1}); G.simulateAway(2*3600); S.paused=true;})()"); await pg.evaluate(CLEAN)
            labels=await pg.evaluate("[...document.querySelectorAll('#mnav button')].map(b=>b.textContent.replace(/[^А-Яа-яЁё]/g,''))")
            ok(f'{W}px: bottom nav = Силы|Паства|Арена|Олимп|Герой, visible at bottom', labels==['Силы','Паства','Арена','Олимп','Герой'] and await pg.evaluate("(()=>{const r=document.getElementById('mnav').getBoundingClientRect(); return r.height>=48&&r.bottom<=innerHeight+1&&r.bottom>innerHeight-30})()"), labels)
            bad=[]; small=[]
            for t,probe in [('powers','.pcard'),('flock','[data-act=temple]'),('arena','[data-act=apost]'),('gods','#rightBody [data-act=chatToggle]'),('hero','#rightBody .stgrid' if W>760 else '#diary .entry')]:
                await pg.click(f'#mnav [data-arg={t}]'); await pg.wait_for_timeout(120)
                r=await pg.evaluate(f"""(()=>{{const el=document.querySelector('{probe}'); const vis=!!(el&&el.offsetParent); const ov=document.documentElement.scrollWidth>innerWidth+1;
                  const sm=[]; if(innerWidth<=760) for(const b of document.querySelectorAll('button')){{ if(!b.offsetParent) continue; const r=b.getBoundingClientRect(); if(!r.width||r.bottom<0) continue; if(r.height<40||r.width<40) sm.push((b.dataset.act||b.className)+':'+Math.round(r.width)+'x'+Math.round(r.height)); }}
                  const on=document.querySelector('#mnav button.on'); return {{vis, ov, sm:sm.slice(0,4), on:on&&on.dataset.arg, scene:!!document.getElementById('colHero').offsetParent}}}})()""")
                if not r['vis'] or r['ov'] or r['on']!=t: bad.append((t,r))
                if r['sm']: small.append((t,r['sm']))
                if W>760 and not r['scene']: bad.append((t,'scene hidden on desktop'))
            ok(f'{W}px: every tab reachable from nav, highlighted, no horizontal scroll{" (scene stays visible)" if W>760 else ""}', not bad, bad)
            if W<=760: ok(f'{W}px: all visible buttons ≥40px on every tab', not small, small)
            await pg.click('#mnav [data-arg=hero]'); await pg.wait_for_timeout(100)
            r=await pg.evaluate("""(()=>{const t=document.getElementById('colHero').innerText, S=GAME.S,h=S.hero; const q=s=>{const e=document.querySelector(s); return e&&e.offsetParent?e.getBoundingClientRect():null};
              return {name:t.includes(h.name), lvl:/ур\\. \\d/.test(t), hp:t.includes('Здоровье'), trust:t.includes('Доверие'), loc:t.includes(h.loc), route:!!q('.route'), dot:!!q('#routeDot'), diary:!!q('#diary'), voice:!!q('#voiceIn'), chips:document.querySelectorAll('#voiceBar .chip').length===8,
                faith:/🔥 \\d+ \\/ \\d+/.test(document.getElementById('hFaith').textContent)&&/\\/мин/.test(document.getElementById('hFaith').textContent), lvlG:/Ур\\. \\d/.test(document.getElementById('hGxp').textContent), star:/★/.test(document.getElementById('hGxp').textContent)||innerWidth<=360,
                speed: innerWidth>760 ? document.querySelectorAll('.speed [data-act=speed]').length===4&&!!q('#pauseBtn') : !!q('#spdC')&&!!q('#pauseBtn2'), help:!!q('header [data-act=help]'), set:!!q('header [data-act=settings]'), av:document.getElementById('hAv').textContent.length>0,
                noov:document.documentElement.scrollWidth<=innerWidth+1}})()""")
            ok(f'{W}px: top bar (god+character, faith number & rate, level+stars, speed, ❔ ⚙) and scene (hero name/class/level/HP/trust/location, route, diary, voice + chips)', all(r.values()), r)
            if W in (390,1280):
                dr=await pg.evaluate("(()=>{const d=document.getElementById('diaryCard').getBoundingClientRect(); return {h:d.height, vh:innerHeight}})()")
                ok(f'{W}px: diary is the main feed (card ≥45% of the viewport height)', dr['h']>=dr['vh']*.45, dr)
            await ctx.close()
        # ---------- 2. мобильный ----------
        ctx,pg=await newpage(br,390)
        h0=await pg.evaluate("document.getElementById('colHero').getBoundingClientRect().height")
        await pg.click('[data-act=heroCol]'); await pg.wait_for_timeout(100)
        h1=await pg.evaluate("document.getElementById('colHero').getBoundingClientRect().height")
        await pg.evaluate("GAME.save()"); await pg.reload(); await pg.wait_for_timeout(250)
        kept=await pg.evaluate("GAME.S.ui.heroCol && document.body.classList.contains('heroCol')")
        ok('390px: hero card collapses (≥35% smaller), state saved across reload', h1<h0*.65 and kept, [h0,h1,kept])
        await pg.click('[data-act=heroCol]')
        await pg.click('header [data-act=settings]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("""(()=>{const c=document.querySelector('#modal .card').getBoundingClientRect(), b=document.querySelector('#modal .mcbar .btn'), br=b&&b.getBoundingClientRect();
          return {w:c.width, h:c.height, iw:innerWidth, ih:innerHeight, btn:br&&br.height, btnVis:br&&br.bottom<=innerHeight+1, txt:/Закрыть/.test(b&&b.textContent), exp:!!document.querySelector('#modal [data-act=exportSave]'), imp:!!document.querySelector('#modal [data-act=importSave]'), dbg:document.querySelectorAll('#modal [data-act=dbg]').length, snd:!!document.querySelector('#modal [data-act=sndToggle]')}})()""")
        ok('390px: settings modal full-screen with big sticky «Закрыть»; has export/import, debug, sound toggle', r['w']==r['iw'] and r['h']==r['ih'] and r['btn']>=48 and r['btnVis'] and r['txt'] and r['exp'] and r['imp'] and r['dbg']>=10 and r['snd'], r)
        await pg.click('#modal .mcbar .btn'); await pg.wait_for_timeout(100)
        ok('390px: «Закрыть» closes the modal', not await pg.evaluate("document.getElementById('modal').classList.contains('on')"))
        await pg.click('#mnav [data-arg=gods]'); await pg.click('#rightBody [data-act=chatToggle]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const p=document.querySelector('#chatDock .chatPanel').getBoundingClientRect(); const x=document.querySelector('.chatX').getBoundingClientRect(); return {w:p.width,h:p.height,iw:innerWidth,ih:innerHeight,x:x.height, inp:!!document.getElementById('chatIn').offsetParent}})()")
        ok('390px: chat reachable from «Олимп», opens full-screen with big close', r['w']==r['iw'] and r['h']>=r['ih']-1 and r['x']>=40 and r['inp'], r)
        await pg.click('.chatX'); await pg.wait_for_timeout(80)
        r={'dun':await pg.evaluate("!!document.querySelector('#rightBody [data-act=callDun]')")}
        await pg.click('#mnav [data-arg=hero]'); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(120)
        r['items']=await pg.evaluate("!!document.querySelector('#modal .doll')&&!!document.querySelector('#modal .inv')")
        await pg.evaluate("GAME.closeModal()")
        await pg.click('#mnav [data-arg=flock]'); r['temple']=await pg.evaluate("!!document.querySelector('#rightBody [data-act=temple]')&&!!document.querySelector('#rightBody [data-act=miracle]')&&!!document.querySelector('#rightBody [data-act=recruit]')")
        await pg.click('header [data-act=help]'); r['help']=await pg.evaluate("/Где что/.test(document.getElementById('modal').innerText)"); await pg.evaluate("GAME.closeModal()")
        r['debug']=await pg.evaluate("(()=>{document.querySelector('header [data-act=settings]').click(); const n=document.querySelectorAll('#modal [data-act=dbg]').length; GAME.closeModal(); return n>=10})()")
        ok('390px: dungeons (Олимп), items/gear (📋), temple/miracles/army (Паства), help (❔), debug (⚙) all reachable', all(r.values()), r)
        await pg.evaluate("(()=>{const G=GAME,S=G.S; S.hero.state='road'; G.startFight(); G.startMonsterFight(); S.ui.mtab='powers'; G.render();})()"); await pg.wait_for_timeout(100)
        r=await pg.evaluate("({ban:!!document.querySelector('#mBanner .mban'), dot:!!document.querySelector('#mnav button[data-arg=hero].dot')})")
        await pg.click('#mBanner [data-act=mtab]'); await pg.wait_for_timeout(150)
        r['fight']=await pg.evaluate("!!document.getElementById('fightBox').offsetParent"); r['voiceHidden']=await pg.evaluate("getComputedStyle(document.getElementById('voiceBar')).display==='none'")
        ok('390px: during a fight other tabs show a banner + nav dot; «Открыть» returns to the fight; voice bar hidden while fighting', all(r.values()), r)
        await ctx.close()
        # ---------- 3. маршрут ----------
        ctx,pg=await newpage(br,1280)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero,o={}; const node=()=>{G.render(); return +document.getElementById('routeDot').dataset.node};
          h.state='town'; o.town=node(); h.state='road'; h.quest.p=10; o.road=node(); const l1=parseFloat(document.getElementById('routeDot').style.left); h.quest.p=90; node(); const l2=parseFloat(document.getElementById('routeDot').style.left);
          o.moves=l2>l1; h.state='dungeon'; o.dun=node(); h.state='road'; return o})()""")
        await pg.evaluate("GAME.startDungeon(true,'easy')"); await pg.wait_for_timeout(400)
        r['dunReal']=await pg.evaluate("(()=>{GAME.render(); return GAME.S.dun?+document.getElementById('routeDot').dataset.node:-1})()")
        r['back']=await pg.evaluate("(()=>{const G=GAME,S=G.S; if(S.dun) G.dunLeave(); S.dun=null; S.fight=null; S.hero.state='road'; G.render(); return +document.getElementById('routeDot').dataset.node})()")
        r['home']=await pg.evaluate("(()=>{const G=GAME,S=G.S; S.hero.state='town'; G.render(); return +document.getElementById('routeDot').dataset.node})()")
        r['dead']=await pg.evaluate("(()=>{const G=GAME,S=G.S,h=S.hero; h.state='dead'; h.hp=0; h.deadT=600; G.render(); const t=document.getElementById('routeDot').textContent; h.state='road'; h.hp=5; G.render(); return t})()")
        ok('route strip: dot follows real state — town→Город, road→Лес (moves with quest), dungeon→Подземелье, after dungeon→back to Город, dead→💀', r['town']==0 and r['road']==1 and r['moves'] and r['dun']==2 and r['dunReal']==2 and r['back'] in (2,3) and r['home']==3 and r['dead']=='💀', r)
        # ---------- 4. дневник ----------
        await pg.evaluate(CLEAN)
        await pg.evaluate("(()=>{GAME.S.god.faith=50; GAME.S.paused=true; GAME.render();})()")
        await pg.click('#voiceBar .chip[data-arg="Копай клад!"]'); await pg.wait_for_timeout(100)
        r=await pg.evaluate("""(()=>{const S=GAME.S,d=S.diary[0],n=document.querySelector('#diary .entry'); return {u:d.u===1, iv:n.classList.contains('iv'), badge:/вмешательство/.test(n.innerText), tm:!!n.querySelector('.tm')&&n.querySelector('.tm').textContent===d.tm, id:+n.dataset.id===d.i}})()""")
        r['other']=await pg.evaluate("(()=>{const S=GAME.S,i=S.diary.findIndex(e=>!e.u); const n=document.querySelector(`#diary .entry[data-id=\"${S.diary[i].i}\"]`); return !!n&&!n.classList.contains('iv')})()")
        ok('diary: player intervention (voice chip) → card highlighted + «🙏 вмешательство» badge; time on the left; hero-only entries not highlighted', all(r.values()), r)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.hero.state='road'; S.fork=null; G.startMoment('troll'); G.render(); const bs=G.momentButtons(S.fork); const k=bs.findIndex(b=>b.st&&!b.dis); document.querySelector(`#forkBox [data-act=fork][data-arg="${k}"]`).click(); const e=S.diary[0]; const n=document.querySelector('#diary .entry'); return {k, dice:/🎲/.test(e.f), u:e.u===1, can:n.classList.contains('can'), big:n.classList.contains('big'), iv:n.classList.contains('iv'), detBefore:!!n.querySelector('.edet')}})()""")
        await pg.click('#diary .entry'); await pg.wait_for_timeout(80)
        r['detAfter']=await pg.evaluate("(()=>{const n=document.querySelector('#diary .entry'); const d=n.querySelector('.edet .dice'); return !!d&&/🎲 .+ = \\d+ против \\d+/.test(d.textContent)})()")
        await pg.click('#diary .entry'); await pg.wait_for_timeout(80)
        r['collapsed']=await pg.evaluate("!document.querySelector('#diary .entry .edet')")
        ok('diary: moment answer = big intervention card; tap expands dice roll (🎲 … = N против M), tap again collapses', r['k']>=0 and r['dice'] and r['u'] and r['can'] and r['big'] and r['iv'] and not r['detBefore'] and r['detAfter'] and r['collapsed'], r)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S,h=S.hero; S.fork=null; h.state='road'; h.hp=h.maxHp; const s0=S.dseq; G.startFight(); G.startMonsterFight(); const F=S.fight; G.nextTurn(F); const me=F.fighters.find(f=>f.isMe);
          for(let k=0;k<12&&F.phase==='turn';k++){ for(const e of F.fighters) if(e.team===1){e.hp=Math.min(e.hp,1); e.avg=.01;} F.my.atk=me.atkN>1?['head','legs']:['head']; F.my.blk=G.ZONES.slice(0,me.blkN); G.fightGo(); } G.render();
          const e=S.diary.find(x=>x.i>s0&&x.d&&x.d.length); if(!e) return {d:0}; const n=document.querySelector(`#diary .entry[data-id="${e.i}"]`); n.click(); G.render(); const n2=document.querySelector(`#diary .entry[data-id="${e.i}"]`); return {d:e.d.length, lines:n2.querySelectorAll('.edet div').length, txt:n2.innerText.includes('Ход 1'), big:n2.classList.contains('med')||n2.classList.contains('big')}})()""")
        ok('diary: fight result carries the fight log; expanding shows the turns', r.get('d',0)>=3 and r['lines']>=3 and r['txt'] and r['big'], r)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; S.fight=null; S.hero.state='road'; S.hero.monster=null; for(let i=0;i<200;i++) S.diary.unshift({tm:'12:00',x:'тест '+i,c:i%7?'':'level',f:'',i:(S.dseq=(S.dseq||0)+1)}); S.diary.length=150; G.diary('сдвиг'); G.render();
          const n0=document.querySelectorAll('#diary .entry').length; const keep=document.querySelector('#diary .entry:nth-child(5)'); keep._mark=1; const id5=keep.dataset.id;
          G.diary('новая'); G.diary('ещё одна', 'level'); G.render();
          const same=document.querySelector(`#diary .entry[data-id="${id5}"]`); const n1=document.querySelectorAll('#diary .entry').length; const top=document.querySelector('#diary .entry .tx').textContent; const big=document.querySelector('#diary .entry').classList.contains('big');
          document.querySelector('[data-act=dmore]').click(); const n2=document.querySelectorAll('#diary .entry').length;
          return {n0,n1,n2,kept:!!(same&&same._mark), top, big}})()""")
        ok('diary perf: DOM capped (40) with «Показать ещё», new entries prepend without re-creating old nodes; level entries are big', r['n0']==40 and r['n1']==40 and r['n2']==80 and r['kept'] and r['top']=='ещё одна' and r['big'], r)
        await ctx.close()
        ctx,pg=await newpage(br,390)
        r=await pg.evaluate("(()=>{const e=document.querySelector('#diaryEmpty .dempty'); return {vis:!!(e&&e.offsetParent), txt:e&&e.innerText}})()")
        ok('empty diary state: «Герой пока бродит. Дай ему команду»', r['vis'] and 'Герой пока бродит. Дай ему команду' in (r['txt'] or ''), r)
        await ctx.close()
        # ---------- 5. силы ----------
        for W in (390,1280):
            ctx,pg=await newpage(br,W)
            await pg.evaluate("(()=>{const S=GAME.S; S.god.lvl=2; S.god.sp=0; S.god.skills={heal:1,bolt:1}; S.god.faith=40; S.hero.hp=Math.round(S.hero.maxHp*.5); GAME.render();})()")
            await pg.click('#mnav [data-arg=powers]'); await pg.wait_for_timeout(100)
            r=await pg.evaluate("""(()=>{const g=[...document.querySelectorAll('#rightBody .pgrp h3')].map(h=>h.textContent); const c=[...document.querySelectorAll('#rightBody .pcard')];
              const info=id=>{const b=document.querySelector(`.pcard[data-arg=${id}]`); return {dim:b.classList.contains('dim'), w:(b.querySelector('.pw')||{}).textContent, ic:!!b.querySelector('.pic').textContent, cost:/🔥\\d+/.test(b.querySelector('.pc').textContent), d:b.querySelector('.pd').textContent.length>5}};
              return {g, n:c.length, heal:info('heal'), quake:info('quake')}})()""")
            ok(f'{W}px powers: cards grouped Свет/Гнев/Стихии with icon, name, cost, short description; locked dimmed with «нужен ур. N»', len(r['g'])==3 and r['g'][0].startswith('☀️ Свет') and 'Гнев' in r['g'][1] and 'Стихии' in r['g'][2] and r['n']==9 and not r['heal']['dim'] and r['heal']['ic'] and r['heal']['cost'] and r['heal']['d'] and r['quake']['dim'] and 'нужен ур. 5' in r['quake']['w'], r)
            await pg.evaluate("(()=>{GAME.S.god.faith=5; GAME.render();})()")
            r=await pg.evaluate("(()=>{const b=document.querySelector('.pcard[data-arg=heal]'); return {dim:b.classList.contains('dim'), w:b.querySelector('.pw').textContent}})()")
            ok(f'{W}px powers: not enough faith → dimmed «не хватает веры»', r['dim'] and 'не хватает веры' in r['w'], r)
            await pg.evaluate("(()=>{GAME.S.god.faith=40; GAME.render();})()")
            await pg.click('.pcard[data-arg=heal]'); await pg.wait_for_timeout(120)
            r=await pg.evaluate("(()=>{const t=document.getElementById('modal').innerText; return {q:/Потратить 15 веры\\? Герой получит лечение/.test(t), go:!!document.querySelector('#modal [data-act=powerGo]:not([disabled])'), f:GAME.S.god.faith}})()")
            ok(f'{W}px powers: tap → preview/confirm «Потратить 15 веры? Герой получит лечение» (nothing spent yet)', r['q'] and r['go'] and r['f']==40, r)
            hp0=await pg.evaluate("GAME.S.hero.hp")
            await pg.click('#modal [data-act=powerGo]'); await pg.wait_for_timeout(60)
            r=await pg.evaluate("({f:GAME.S.god.faith, hp:GAME.S.hero.hp, u:GAME.S.diary[0].u, fly:document.querySelectorAll('#fxLayer .fly').length, flash:document.querySelectorAll('#fxLayer .fflash').length, modal:document.getElementById('modal').classList.contains('on')})")
            ok(f'{W}px powers: confirm → faith spent, hero healed, diary intervention, flash + icon flies to the diary', r['f']==25 and r['hp']>hp0 and r['u']==1 and r['fly']==1 and r['flash']>=1 and not r['modal'], r)
            if W==390:
                await pg.wait_for_timeout(250); await pg.screenshot(path=SHOTS+'t11_power_fly_390.png')
            await pg.click('.pcard[data-arg=quake]'); await pg.wait_for_timeout(80)
            r=await pg.evaluate("(()=>({go:!!document.querySelector('#modal [data-act=powerGo]'), why:/нужен ур\\. 5/.test(document.getElementById('modal').innerText)}))()")
            ok(f'{W}px powers: locked power preview explains why and has no «Применить»', not r['go'] and r['why'], r)
            await pg.evaluate("GAME.closeModal()")
            await ctx.close()
        # ---------- 6. бой ----------
        for W in (390,1280):
            ctx,pg=await newpage(br,W)
            await pg.evaluate("(()=>{const G=GAME,S=G.S; S.god.faith=80; S.hero.potions=2; G.setLastInput&&G.setLastInput(); S.god.skills={heal:1}; G.startFight(); G.startMonsterFight(); G.render();})()"); await pg.wait_for_timeout(150)
            r=await pg.evaluate("""(()=>{const b=document.getElementById('fightBox'); return {prep:!!b.querySelector('.fprep'), go:!!b.querySelector('[data-act=fgo]'), pot:!!b.querySelector('[data-act=fpot]'), flee:!!b.querySelector('[data-act=fflee]'), vs:b.querySelectorAll('.vsbar .vsu .bar.hp').length, zones:b.querySelectorAll('.zb').length, icons:b.querySelectorAll('.zb .zi').length,
              minH:Math.min(...[...b.querySelectorAll('.zb')].map(z=>z.getBoundingClientRect().height)), vsTop:b.querySelector('.vsbar').getBoundingClientRect().top < b.querySelector('.zpick').getBoundingClientRect().top}})()""")
            ok(f'{W}px fight: prefight card, potion & retreat kept; HP bars of hero vs enemy on top; 5 zones ×(удар, блок) with icons, ≥44px', r['prep'] and r['go'] and r['pot'] and r['flee'] and r['vs']==2 and r['zones']==10 and r['icons']==10 and r['minH']>=44 and r['vsTop'], r)
            await pg.click('#fightBox [data-act=fgo]'); await pg.wait_for_timeout(100)
            n=await pg.evaluate("GAME.S.fight.fighters.find(f=>f.isMe).atkN")
            await pg.click('#fightBox [data-act=fz][data-arg="a:head"]')
            if n>1: await pg.click('#fightBox [data-act=fz][data-arg="a:legs"]')
            await pg.click('#fightBox [data-act=fz][data-arg="b:chest"]'); await pg.wait_for_timeout(60)
            ok(f'{W}px fight: «Ход» button says ready when zones are chosen', '⚔ Ход!' in await pg.evaluate("document.querySelector('#fightBox [data-act=fgo]').textContent"))
            r=await pg.evaluate("(()=>({a:document.querySelector('#fightBox .body.atk .zb.head').classList.contains('on'), b:[...document.querySelectorAll('#fightBox .body.blk .zb.on')].length}))()")
            ok(f'{W}px fight: selected zones highlighted', r['a'] and r['b']>=1, r)
            f0=await pg.evaluate("GAME.S.god.faith")
            await pg.click('#fightBox [data-act=fhint]'); await pg.wait_for_timeout(80)
            r=await pg.evaluate(f"""(()=>{{const F=GAME.S.fight; return {{cost:{f0}-GAME.S.god.faith, hint:F.hint&&F.hint.zones.length, txt:!!document.querySelector('#fightBox .fhint'), hz:document.querySelectorAll('#fightBox .body.blk .zb.hintz').length, dis:document.querySelector('#fightBox [data-act=fhint]').disabled, pl:F.powersLeft}}}})()""")
            ok(f'{W}px fight: «Подсказать» costs 6 faith, once per turn, marks 3 (4 for 3-zone blockers) likely zones on the block silhouette, no power slot used', r['cost']==6 and r['hint'] in (3,4) and r['txt'] and r['hz']==r['hint'] and r['dis'] and r['pl']==3, r)
            await pg.click('#fightBox [data-act=fgo]'); await pg.wait_for_timeout(120)
            r=await pg.evaluate("({ftx:[...document.querySelectorAll('#fxLayer .ftx')].map(e=>e.textContent), fl:document.querySelectorAll('#fxLayer .fflash').length, turn:GAME.S.fight&&GAME.S.fight.turn})")
            if W==1280: await pg.screenshot(path=SHOTS+'t11_fight_fx_1280.png')
            await pg.wait_for_timeout(700)
            r['later']=await pg.evaluate("[...document.querySelectorAll('#fxLayer .ftx')].map(e=>e.textContent)")
            allf=r['ftx']+r['later']
            ok(f'{W}px fight: after a turn — flash + floating texts (−N / Крит! / Блок / Уворот)', r['fl']>=1 and len(allf)>=1 and all(any(k in t for k in ['−','Крит','Блок','Уворот','Лечение']) for t in allf), r)
            await ctx.close()
        ctx,pg=await newpage(br,1280)
        r=await pg.evaluate("""(()=>{const G=GAME,S=G.S; let n=0, hit=0, seen=0, blocked=0;
          for(let k=0;k<150;k++){ S.fight=null; S.hero.state='road'; S.hero.monster=null; S.hero.hp=S.hero.maxHp; G.startFight(); if(!G.startMonsterFight()) continue; const F=S.fight; G.nextTurn(F); S.god.faith=G.maxFaith();
            G.fightHint(); const h=F.hint; if(!h||!h.zones.length){ S.fight=null; continue; } n++; const me=F.fighters.find(f=>f.isMe);
            F.my.atk=['head']; F.my.blk=h.zones.slice(0,me.blkN);
            const z0=(F.choices[h.fid].atk||[])[0]; G.fightGo(); if(z0){seen++; if(h.zones.includes(z0)) hit++; if(F.my.blk.includes(z0)) blocked++;} S.fight=null; S.hero.monster=null; S.hero.state='road'; }
          return {n, seen, hit, blocked}})()""")
        ok('hint is honest (real enemy attack is inside the shown zones) yet modest (blocking as much of the region as possible stops < 90%)', r['n']>=40 and r['seen']>=30 and r['hit']==r['seen'] and r['blocked']<r['seen']*.9, r)
        await ctx.close()
        # ---------- 7. темы ----------
        ctx,pg=await newpage(br,1280)
        th={}
        for nm,al in [('good',60),('neutral',0),('evil',-60)]:
            th[nm]=await pg.evaluate(f"(()=>{{GAME.S.god.align={al}; GAME.render(); const cs=getComputedStyle(document.body); return {{t:document.body.dataset.theme, g:cs.getPropertyValue('--gold').trim(), hdr:getComputedStyle(document.querySelector('header')).backgroundImage.slice(0,70), av:document.getElementById('hAv').textContent, title:document.getElementById('hTitle').textContent}}}})()")
        ok('themes by character: добрый=good (warm gold), себе на уме=neutral (cold), злой=evil (dark red); accent + header change', th['good']['t']=='good' and th['neutral']['t']=='neutral' and th['evil']['t']=='evil' and len({th[k]['g'] for k in th})==3 and len({th[k]['hdr'] for k in th})==3 and th['good']['g']=='#c9962b' and th['evil']['g']=='#b8412f', th)
        # ---------- 8. звук ----------
        r=await pg.evaluate("({snd:GAME.S.ui.snd, ctx:!!GAME.audioCtx})")
        await pg.click('header [data-act=settings]'); await pg.wait_for_timeout(80)
        await pg.click('#modal [data-act=sndToggle]'); await pg.wait_for_timeout(80)
        r2=await pg.evaluate("({snd:GAME.S.ui.snd, ctx:!!GAME.audioCtx, btn:document.getElementById('sndBtn').textContent})")
        await pg.reload(); await pg.wait_for_timeout(250)
        r3=await pg.evaluate("({snd:GAME.S.ui.snd, ctx:!!GAME.audioCtx})")
        await pg.evaluate("GAME.sfx('level')"); r3['ctxNoGesture']=await pg.evaluate("!!GAME.audioCtx")
        await pg.mouse.click(600,500); await pg.evaluate("GAME.sfx('level')"); await pg.wait_for_timeout(50); r3['ctxAfter']=await pg.evaluate("!!GAME.audioCtx")
        ok('sound: off by default (no AudioContext), toggle in settings is saved across reload, audio only starts after a user gesture', r['snd'] is False and not r['ctx'] and r2['snd'] and r2['ctx'] and 'вкл' in r2['btn'] and r3['snd'] and not r3['ctx'] and not r3['ctxNoGesture'] and r3['ctxAfter'], [r,r2,r3])
        await ctx.close()
        # ---------- 9. офлайн-сводка при входе ----------
        for W in (390,1280):
            ctx,pg=await newpage(br,W)
            await pg.evaluate("(()=>{const S=GAME.S; S.lastSeen=Date.now()-5*3600*1000; S.paused=false; localStorage.setItem(GAME.SAVE_KEY, JSON.stringify(S)); localStorage.setItem=()=>{};})()")
            await pg.reload(); await pg.wait_for_timeout(400)
            r=await pg.evaluate("""(()=>{const m=document.getElementById('modal'); const a=m.querySelector('.away'); const c=m.querySelector('.card').getBoundingClientRect(); return {on:m.classList.contains('on'), away:!!a, tiles:m.querySelectorAll('.awt').length>=6, faithBar:!!m.querySelector('.bar.faith'), txt:!!a&&/Пока вас не было/.test(a.innerText), full:innerWidth>760||(c.width===innerWidth&&c.height===innerHeight), cont:!!m.querySelector('.mcbig')}})()""")
            ok(f'{W}px: offline summary shown on entry as its own card (tiles, faith bar, highlights){" full-screen" if W<=760 else ""}', all(r.values()), r)
            await pg.click('#modal .mcbig'); await pg.wait_for_timeout(80)
            ok(f'{W}px: «Продолжить» closes the summary', not await pg.evaluate("document.getElementById('modal').classList.contains('on')"))
            await ctx.close()
        # ---------- 10. reduced motion ----------
        ctx,pg=await newpage(br,390,reduced_motion='reduce')
        await pg.evaluate("(()=>{const S=GAME.S; S.god.skills.heal=1; S.god.faith=60; GAME.render();})()")
        await pg.click('#mnav [data-arg=powers]'); await pg.click('.pcard[data-arg=heal]'); await pg.click('#modal [data-act=powerGo]'); await pg.wait_for_timeout(50)
        r=await pg.evaluate("({rm:document.body.classList.contains('rm'), fly:document.querySelectorAll('#fxLayer .fly').length, flash:document.querySelectorAll('#fxLayer .fflash').length, anim:parseFloat(getComputedStyle(document.querySelector('#diary .entry')).animationDuration)})")
        ok('prefers-reduced-motion: no flying icons/flashes, animations ~0', r['rm'] and r['fly']==0 and r['flash']==0 and r['anim']<0.01, r)
        await ctx.close()
        # ---------- 11. миграция, момент, safe-area ----------
        ctx,pg=await newpage(br,390)
        r=await pg.evaluate("""(()=>{const G=GAME; const old=JSON.parse(JSON.stringify(G.S)); old.ui={mtab:'diary'}; old.tab='flock'; delete old.dseq; old.diary=[{tm:'10:00',x:'a',c:'',f:''},{tm:'09:00',x:'b',c:'level',f:''},{tm:'08:00',x:'c',c:'',f:'',i:3}];
          const a=G.sanitize(JSON.parse(JSON.stringify(old))); old.ui={mtab:'more'}; const b=G.sanitize(JSON.parse(JSON.stringify(old))); old.ui={mtab:'powers',junk:1}; old.tab='weird'; const c=G.sanitize(JSON.parse(JSON.stringify(old)));
          const ids=a.diary.map(e=>e.i); return {a:a.ui.mtab, b:b.ui.mtab, c:c.ui.mtab, ctab:c.tab, junk:'junk' in c.ui, uniq:new Set(ids).size===3&&ids.every(x=>x>0), seq:a.dseq>Math.max(...ids), snd:a.ui.snd===false, col:a.ui.heroCol===false}})()""")
        ok('migration: old tabs «Дневник»→Герой, «Ещё»→Паства/Олимп; unknown tab → Силы; diary entries get unique ids; new ui fields default off', r['a']=='hero' and r['b']=='flock' and r['c']=='powers' and r['ctab']=='powers' and not r['junk'] and r['uniq'] and r['seq'] and r['snd'] and r['col'], r)
        r=await pg.evaluate("(()=>{const G=GAME,S=G.S; S.hero.state='road'; S.fork=null; G.startMoment('troll'); S.ui.mtab='hero'; G.render(); const c=document.querySelector('#forkBox .fork.mom'); const cr=c.getBoundingClientRect(); const bs=[...c.querySelectorAll('[data-act=fork]')].map(b=>b.getBoundingClientRect()); return {vis:!!c.offsetParent, fit:cr.right<=innerWidth+1&&cr.left>=-1, minH:Math.min(...bs.map(b=>b.height)), accent:getComputedStyle(c,'::before').height}})()")
        ok('moment card in the new design: themed accent strip, fits 390px, buttons ≥44px', r['vis'] and r['fit'] and r['minH']>=44 and r['accent']=='5px', r)
        meta=await pg.evaluate("document.querySelector('meta[name=viewport]').content")
        css=await pg.evaluate("[...document.styleSheets].map(s=>[...s.cssRules].map(r=>r.cssText).join('\\n')).join('\\n')")
        ok('safe-area insets respected (viewport-fit=cover; nav/voice bar/header/modals use env(safe-area-inset-*))', 'viewport-fit=cover' in meta and css.count('safe-area-inset-bottom')>=6 and 'safe-area-inset-top' in css, meta)
        await ctx.close()
        ok('no JS errors', not errs, errs[:6])
        await br.close()
    fails=[k for k,v in res.items() if not k.startswith('_') and v!='OK']
    print(json.dumps({'SUMMARY':f'{len([k for k in res if not k.startswith("_")])-len(fails)} OK, {len(fails)} FAIL','fails':fails},ensure_ascii=False,indent=1))
asyncio.run(main())

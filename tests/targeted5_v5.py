# v5-проверки: баланс, пещеры, новый интерфейс, миграция v4→v5
import asyncio, json, sys, time
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
R={}
def ok(n,c,info=''): R[n]=('OK' if c else 'FAIL')+(' '+json.dumps(info,ensure_ascii=False)[:300] if (info!='' and not c) else '')
async def fresh(pg, cls='warrior'):
    await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
    await pg.select_option('#inCls',cls); await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.paused=true')
    await pg.evaluate("GAME.S.timers.fork=1e5;GAME.S.timers.duel=1e5;GAME.S.timers.dun=1e5;GAME.S.timers.event=1e5;GAME.S.god.faith=GAME.maxFaith();GAME.S.featOffer=null;GAME.render()")
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(300); await fresh(pg)
        # --- десктоп: 2 колонки ---
        r=await pg.evaluate("""(()=>{const c=document.getElementById('colCenter').getBoundingClientRect(),r=document.getElementById('colRight').getBoundingClientRect(),h=document.getElementById('colHero').getBoundingClientRect();
          return {two: r.left>=c.right-2 && Math.abs(r.top-c.top)<40, heroIn: h.left>=c.left-1&&h.right<=c.right+1, nav: getComputedStyle(document.getElementById('mnav')).display}})()""")
        ok('desktop: 2 columns, hero card in main column, no bottom nav', r['two'] and r['heroIn'] and r['nav']=='none', r)
        r=await pg.evaluate("""(()=>{const t=document.getElementById('colHero').innerText; return {len:t.length, eq:/Снаряжение|Рюкзак/.test(t), stats:!!document.querySelector('#colHero .stgrid')}})()""")
        ok('hero card is compact (no stats/equipment/backpack)', r['len']<400 and not r['eq'] and not r['stats'], r)
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');return {on:m.classList.contains('on'),t:/Снаряжение/.test(m.innerText)&&/Рюкзак/.test(m.innerText)&&/Доверие/.test(m.innerText),st:!!m.querySelector('.stgrid')}})()")
        ok('hero sheet: stats, trust, equipment, backpack', r['on'] and r['t'] and r['st'], r)
        await pg.evaluate("(()=>{const h=GAME.S.hero; const it=GAME.makeItem('ring',h.lvl,1); it.curse={k:'chatty',n:'Болтун'}; h.eq.ring=it; GAME.S.god.faith=GAME.maxFaith(); document.getElementById('modal').classList.remove('on'); GAME.render()})()")
        hint=await pg.evaluate("/проклят/.test(document.getElementById('colHero').innerText)")
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        n=await pg.evaluate("document.querySelectorAll('#modal [data-act=liftS]').length")
        if n: await pg.click('#modal [data-act=liftS]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("({c:!!(GAME.S.hero.eq.ring&&GAME.S.hero.eq.ring.curse), open:document.getElementById('modal').classList.contains('on')})")
        ok('curse hint on card + lift from sheet', hint and n==1 and not r['c'] and r['open'], [hint,n,r])
        await pg.evaluate("document.getElementById('modal').classList.remove('on')")
        # --- силы: описание по нажатию ---
        await pg.evaluate("GAME.S.tab='powers';GAME.render()")
        vis0=await pg.evaluate("[...document.querySelectorAll('#rightBody .skill .ds')].filter(d=>d.offsetParent).length")
        await pg.click('#rightBody .skill .nm[data-arg=heal]'); await pg.wait_for_timeout(100)
        vis1=await pg.evaluate("[...document.querySelectorAll('#rightBody .skill .ds')].filter(d=>d.offsetParent).length")
        ok('power descriptions hidden, shown on tap', vis0==0 and vis1==1, [vis0,vis1])
        # --- дневник: эффекты чипами ---
        await pg.evaluate("diary('Тест','loot','+34 💰, +67 опыта, +1 паствы');GAME.render()")
        r=await pg.evaluate("document.querySelectorAll('#diary .entry')[0].querySelectorAll('.fxc').length")
        ok('diary effects as chips', r==3, r)
        # --- баланс: таблицы и эталон ---
        r=await pg.evaluate("(()=>{const ok=Object.keys(GAME.CLASSES).every(c=>GAME.CLASS_BAL[c]&&GAME.CLASS_BAL[c].z>0&&GAME.CLASS_BAL[c].r>0); const a=GAME.monsterRef(5), b=GAME.monsterRef(15); return {ok, grow: b.hp>a.hp*2 && b.avg>a.avg*1.8}})()")
        ok('class balance table + monster ref grows with level', r['ok'] and r['grow'], r)
        r=await pg.evaluate("(()=>{const e=monsterUnit('Волк',8,{elite:1}), m=monsterUnit('Волк',8); return {e:e.max>m.max*1.1&&e.kind==='elite'&&/элита/.test(e.name), b:e.blkN===2}})()")
        ok('elite monsters: tougher, marked', r['e'] and r['b'], r)
        # --- пещера: генерация ---
        r=await pg.evaluate("(()=>{let bad=0,el=0; for(let i=0;i<200;i++){const G=genDungeon(6); const c=t=>G.tiles.filter(x=>x&&x.t===t).length; if(c('shrine')>1||c('boss')!==1||c('key')!==1||c('elite')>2) bad++; el+=c('elite');} return {bad, el:el/200}})()")
        ok('dungeon gen: 1 shrine max, ≤2 elite rooms, 1 key, 1 boss', r['bad']==0 and r['el']>0.8, r)
        # --- пещера: лечение силой и отступление ---
        await pg.evaluate("(()=>{GAME.S.timers.dunCd=0;GAME.S.hero.state='road';return GAME.startDungeon(true)})()"); await pg.wait_for_timeout(200)
        r=await pg.evaluate("""(()=>{const S=GAME.S,U=S.dun,h=S.hero; h.hp=Math.round(h.maxHp*.3); const f0=S.god.faith, hp0=h.hp; GAME.render();
          const btn=document.querySelector('[data-act=dheal]'); btn&&btn.click(); const hp1=h.hp, f1=S.god.faith; GAME.render();
          const dis=document.querySelector('[data-act=dheal]').disabled; dunHeal(); return {btn:!!btn, healed:hp1>hp0, paid:f0-f1===dunHealCost(), once:dis&&h.hp===hp1, heals:U.heals}})()""")
        ok('dungeon: heal party by power (once, costs faith)', r['btn'] and r['healed'] and r['paid'] and r['once'], r)
        r=await pg.evaluate("""(()=>{const S=GAME.S,U=S.dun,h=S.hero; U.gold=100; U.xp=0; const it=GAME.makeItem('amulet',h.lvl,1); U.loot=[it]; const g0=h.gold; dunLeave(); return {gold:h.gold-g0, kept: Object.values(h.eq).some(x=>x&&x.id===it.id)||h.inv.some(x=>x.id===it.id)||true, phase:U.phase, res:U.result}})()""")
        ok('retreat keeps 60% gold', r['gold']==60 and r['phase']=='end', r)
        await pg.evaluate("GAME.S.dun=null;GAME.S.hero.state='road';GAME.render()")
        # --- босс: объявленный удар, блок спасает ---
        r=await pg.evaluate("""(()=>{let blk=0,unb=0,n=0; for(let i=0;i<60;i++){ const me=heroUnit(); me.hp=me.max=99999; const b=monsterUnit('Голем',GAME.S.hero.lvl+2,{boss:{m:'tele'},hp:5});
            const F=beginBattle('dungeon',[me],[b],{ctx:{boss:true}}); F.auto=false; nextTurn(F); nextTurn(F); if(!F.tele) continue; n++;
            const z=F.tele.zone; F.my={atk:['head'],blk:blkSet(z,me.blkN),target:b.id}; const h0=me.hp; resolveTurn(F); blk+=h0-me.hp;
            const me2=heroUnit(); me2.hp=me2.max=99999; const b2=monsterUnit('Голем',GAME.S.hero.lvl+2,{boss:{m:'tele'},hp:5}); const F2=beginBattle('dungeon',[me2],[b2],{ctx:{boss:true}}); F2.auto=false; nextTurn(F2); nextTurn(F2); if(!F2.tele) continue;
            const z2=F2.tele.zone, other=ZONES.filter(x=>!blkSet(x,me2.blkN).includes(z2))[0]||ZONES.find(x=>x!==z2); F2.my={atk:['head'],blk:blkSet(other,me2.blkN).filter(x=>x!==z2).concat([]).slice(0,me2.blkN),target:b2.id};
            if(F2.my.blk.length<me2.blkN) F2.my.blk=ZONES.filter(x=>x!==z2).slice(0,me2.blkN); const h2=me2.hp; resolveTurn(F2); unb+=h2-me2.hp; S.fight=null; }
          S.fight=null; return {n, blk:Math.round(blk/Math.max(1,n)), unb:Math.round(unb/Math.max(1,n)), mul:DUN_K.tele}})()""")
        ok('boss telegraph: blocked ≪ unblocked damage', r['n']>10 and r['unb']>r['blk']*2.5+5, r)
        await pg.evaluate("GAME.S.fight=null;GAME.S.hero.state='road';GAME.render()")
        # --- миграция v4 → v5 с пещерой в процессе ---
        await pg.evaluate("(()=>{GAME.S.timers.dunCd=0;GAME.S.hero.state='road';return GAME.startDungeon(true)})()"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.v=4; delete s.ui; s.dun.tiles.forEach(t=>{if(t){delete t.d; if(t.t==='elite') t.t='fight';}}); delete s.dun.heals; const j=JSON.stringify(s); localStorage.setItem(GAME.SAVE_KEY, j); const w=()=>localStorage.setItem(GAME.SAVE_KEY, j); window.addEventListener('beforeunload',w); document.addEventListener('visibilitychange',w); window.addEventListener('pagehide',w);})()")
        await pg.reload(); await pg.wait_for_timeout(400)
        r=await pg.evaluate("({v:GAME.S.v, ui:GAME.S.ui&&GAME.S.ui.mtab, dun:!!GAME.S.dun, heals:GAME.S.dun&&GAME.S.dun.heals, note:GAME.S.diary.slice(0,5).some(d=>/Обновление мира/.test(d.x))})")
        ok('v4->v5 migration keeps dungeon, adds ui + note', r['v']==5 and r['ui']=='hero' and r['dun'] and r['heals']==0 and r['note'], r)
        await pg.evaluate("GAME.S.paused=true"); 
        r=await pg.evaluate("(()=>{let k=0; while(GAME.S.dun&&k++<400){ if(GAME.S.fight) GAME.autoResolveBattle?GAME.autoResolveBattle(GAME.S.fight):autoResolveBattle(GAME.S.fight); else if(GAME.S.dun.phase==='explore') dunAutoStep(); else if(GAME.S.dun.phase==='end') GAME.S.dun=null; else GAME.S.dun.phase='explore'; } return {done:!GAME.S.dun}})()")
        ok('migrated dungeon playable to the end', r['done'], r)
        await ctx.close()
        # --- телефон: нижние вкладки ---
        ctx=await br.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(300); await fresh(pg)
        vis=lambda sel: pg.evaluate(f"!!(document.querySelector('{sel}')&&document.querySelector('{sel}').offsetParent)")
        r={'nav':await pg.evaluate("getComputedStyle(document.getElementById('mnav')).display==='grid'"),'hero':await vis('#colHero'),'right':await vis('#colRight'),'diary':await vis('#diaryCard'),'mini':await vis('#diaryMini'),'n':await pg.evaluate("document.querySelectorAll('#mnav button').length")}
        ok('mobile: bottom nav (5), hero tab = card + recent diary', r['nav'] and r['n']==5 and r['hero'] and not r['right'] and not r['diary'] and r['mini'], r)
        await pg.click('#mnav [data-arg=diary]'); r={'diary':await vis('#diaryCard'),'hero':await vis('#colHero'),'voice':await vis('#voiceIn')}
        ok('mobile: diary tab with voice', r['diary'] and r['voice'] and not r['hero'], r)
        await pg.click('#mnav [data-arg=powers]'); r={'right':await vis('#colRight'),'pw':await pg.evaluate("document.querySelectorAll('#rightBody .skill').length"),'tabs':await vis('#colRight .tabs')}
        ok('mobile: powers tab', r['right'] and r['pw']>=6 and not r['tabs'], r)
        await pg.click('#mnav [data-arg=arena]'); r={'s':await pg.evaluate("GAME.S.tab"),'a':await pg.evaluate("/рейтинг|Рейтинг|Заявк/.test(document.getElementById('rightBody').innerText)")}
        ok('mobile: arena tab', r['s']=='arena' and r['a'], r)
        await pg.click('#mnav [data-arg=more]'); r={'s':await pg.evaluate("GAME.S.tab"),'links':await vis('#moreLinks'),'gods':await vis('#colRight .tabs [data-arg=gods]'),'pw':await vis('#colRight .tabs [data-arg=powers]')}
        ok('mobile: more tab = flock/pantheon + help/settings/chat', r['s']=='flock' and r['links'] and r['gods'] and not r['pw'], r)
        await pg.click('#colRight .tabs [data-arg=gods]'); ok('mobile: pantheon reachable', await pg.evaluate("GAME.S.tab==='gods'&&/Подвиги|подвиги/.test(document.getElementById('rightBody').innerText)"))
        await pg.click('#moreLinks [data-act=chatToggle]'); await pg.wait_for_timeout(150)
        ok('mobile: chat opens from more tab', await vis('#chatIn'))
        await pg.evaluate("GAME.S.chat.open=false;GAME.render()")
        await pg.evaluate("(()=>{GAME.S.timers.dunCd=0;GAME.S.hero.state='road';return GAME.startDungeon(true)})()"); await pg.wait_for_timeout(200); await pg.evaluate("GAME.render()")
        r={'ban':await vis('#mBanner .mban')}
        await pg.click('#mBanner [data-act=mtab]'); r['map']=await vis('#dunBox .dgrid'); r['tab']=await pg.evaluate("GAME.S.ui.mtab")
        ok('mobile: active dungeon banner on other tabs → opens hero tab with map', r['ban'] and r['map'] and r['tab']=='hero', r)
        await pg.click('#spdC'); ok('mobile: speed cycle button', await pg.evaluate("GAME.S.speed===2"))
        await pg.reload(); await pg.wait_for_timeout(300)
        ok('mobile tab persists over reload', await pg.evaluate("GAME.S.ui.mtab==='hero' && document.body.dataset.mtab==='hero'"))
        await ctx.close(); await br.close()
        R['js_errors']=errs[:5]; R['SUMMARY']=f"{sum(1 for v in R.values() if isinstance(v,str) and v.startswith('OK'))} OK, {sum(1 for v in R.values() if isinstance(v,str) and v.startswith('FAIL'))} FAIL"
        print(json.dumps(R,ensure_ascii=False,indent=1))
asyncio.run(main())

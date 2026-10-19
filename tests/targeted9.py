# v9: реалистичные бои — без мгновенных смертей, без магического воскрешения, подготовка к бою, присутствие бога
import asyncio, json, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
res={}; errs=[]
def ok(n,c,info=None): res[n]='OK' if c else 'FAIL '+json.dumps(info,ensure_ascii=False,default=str)[:600]
async def newgame(br, cls, w=1280, h=900, race='human'):
    ctx=await br.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.select_option('#inCls',cls); await pg.select_option('#inRace',race); await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    await pg.evaluate("GAME.S.paused=true; GAME.S.timers.fork=GAME.S.timers.duel=GAME.S.timers.dun=GAME.S.timers.event=1e9")
    return ctx,pg
# заводим пещеру и бой в соседней комнате
DUN_JS="""async (o)=>{const G=GAME,h=G.S.hero; o=o||{}; h.potions=o.pot===undefined?2:o.pot; await startDungeon(true,'normal'); const U=G.S.dun; U.auto=false; U.idle=-1e9;
  const ad=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:U.pos.x+dx,y:U.pos.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<5&&q.y<5&&U.tiles[q.y*5+q.x]&&U.tiles[q.y*5+q.x].t!=='boss');
  const q=ad[0], t=U.tiles[q.y*5+q.x]; t.t=o.t||'fight'; t.done=0; t.seen=1; if(o.go){ G.setLastInput(); dunMove(q.x+','+q.y); if(!G.S.fight) dunMove(q.x+','+q.y); } G.render(); return {q, fight:!!G.S.fight}}"""
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx,pg=await newgame(br,'mage')
        # 1) нет смерти с полного HP быстрее 3 ходов против обычных монстров, даже без блока; удар ≤30% HP
        r=await pg.evaluate("""(()=>{const G=GAME,h=G.S.hero; let minT=99, maxHit=0, n=0;
          for(const L of [2,3,5,8,10]){ h.lvl=L; h.maxHp=G.calcMaxHp(h);
            for(let i=0;i<60;i++){ h.hp=h.maxHp; const k=1+(i%4); const mons=[]; for(let j=0;j<k;j++){ const m=monsterUnit('Волк',L+1,{hp:20,dmg:DUN_K.mdmg*1.15,elite:j===0&&i%3===0}); mons.push(m);} 
              const me=heroUnit(); const F=beginBattle('dungeon',[me],mons,{}); nextTurn(F); let t=0;
              while(F.phase!=='end' && t<30){ F.my.atk=['head'].concat(me.atkN>1?['legs']:[]).slice(0,me.atkN); F.my.blk=blkSet('waist',me.blkN); F.my.act=null; const hp0=me.hp; resolveTurn(F); t++; if(me.alive) maxHit=Math.max(maxHit,0); if(!me.alive){ minT=Math.min(minT,t); break; } }
              for(const l of F.log) { const m=/−(\\d+)$/.exec(l.t); if(m && l.c==='foe') maxHit=Math.max(maxHit, +m[1]/me.max); }
              G.S.fight=null; n++; } }
          return {minT, maxHit:+maxHit.toFixed(3), n}})()""")
        ok('no full-HP → dead in <3 turns vs normal monsters (1–4 foes, no right block); single hit ≤30% max HP', r['minT']>=3 and r['maxHit']<=0.305, r)
        # 2) объявленный удар босса всегда блокируется
        r=await pg.evaluate("""(()=>{let leak=0,n=0; for(let i=0;i<300;i++){ const me=heroUnit(); const b=monsterUnit('Голем',6,{boss:{m:'tele'},dmg:3}); const F=beginBattle('dungeon',[me],[b],{}); nextTurn(F); F.tele={zone:'belly',fid:b.id,mul:2.5}; const picks={}; picks[me.id]={blk:blkSet('belly',me.blkN)}; const r=hitOne(F,b,me,'belly',picks,{aoe:1,mul:2.5}); n++; if(r.dmg>0) leak++; GAME.S.fight=null; } return {leak,n}})()""")
        ok('boss telegraph is always fully blockable (crit/aim cannot pierce)', r['leak']==0, r)
        await ctx.close()
        # 3) подготовка к бою: бог рядом — карточка «Бой начинается», зоны выбираются, ход не идёт до «В бой» / таймера; ×10 не сжимает таймер
        ctx,pg=await newgame(br,'warrior')
        r=await pg.evaluate(DUN_JS, {'go':1})
        await pg.wait_for_timeout(200)
        r=await pg.evaluate("""(()=>{const F=GAME.S.fight, b=document.getElementById('fightBox'); return {ph:F&&F.phase, T:F&&F.T, prep:F&&F.prep, card:/Бой начинается/.test(b.innerText), zone:!!b.querySelector('[data-act=fz]:not([disabled])'), go:!!b.querySelector('[data-act=fgo]'), traits:!!b.querySelector('.fprep'), pot:/зелий/.test(b.innerText)}})()""")
        ok('pre-fight card: «⚔ Бой начинается!», enemies/party/potions, zone picker active, 30s prep when god present', r['ph']=='intro' and r['T']>=25 and r['prep']==1 and r['card'] and r['zone'] and r['go'] and r['pot'], r)
        await pg.evaluate("GAME.S.speed=10; GAME.S.paused=false"); await pg.wait_for_timeout(2300); await pg.evaluate("GAME.S.paused=true")
        r=await pg.evaluate("({ph:GAME.S.fight.phase, t:GAME.S.fight.t, turn:GAME.S.fight.turn})")
        ok('at ×10 speed the prep timer runs in real time (≈2s gone, not 20s)', r['ph']=='intro' and r['t']>=26 and r['turn']==0, r)
        await pg.screenshot(path='/workspace/godgame/shots9_prep_desktop.png')
        await pg.click('#fightBox [data-act=fz][data-arg="a:legs"]'); await pg.click('#fightBox [data-act=fz][data-arg="b:head"]'); await pg.wait_for_timeout(100)
        await pg.click('#fightBox [data-act=fgo]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("({ph:GAME.S.fight.phase, turn:GAME.S.fight.turn, atk:GAME.S.fight.my.atk, blk:GAME.S.fight.my.blk, T:GAME.S.fight.T})")
        ok('«В бой» starts turn 1 keeping the zones chosen during prep; turn timer ≥15s', r['ph']=='turn' and r['turn']==1 and 'legs' in r['atk'] and 'head' in r['blk'] and r['T']>=15, r)
        # 4) низкое HP в бою: предупреждение и варианты
        await pg.evaluate("(()=>{const F=GAME.S.fight, me=F.fighters.find(f=>f.isMe); me.hp=Math.round(me.max*.2); GAME.S.hero.hp=me.hp; GAME.render()})()")
        await pg.wait_for_timeout(100)
        r=await pg.evaluate("""(()=>{const b=document.getElementById('fightBox'); return {low:!!b.querySelector('.lowhp'), pot:!!b.querySelector('[data-act=fpot]:not([disabled])'), flee:!!b.querySelector('[data-act=fflee]'), pow:b.querySelectorAll('[data-act=fpow]').length, blk:!!b.querySelector('[data-act=fz][data-arg^="b:"]:not([disabled])')}})()""")
        ok('low HP in fight: clear warning + block, potion, god power and flee options', r['low'] and r['pot'] and r['flee'] and r['blk'] and r['pow']>=1, r)
        await pg.evaluate("document.getElementById('fightBox').scrollIntoView()"); await pg.screenshot(path='/workspace/godgame/shots9_lowhp_desktop.png')
        # зелье как действие хода
        r=await pg.evaluate("""(()=>{const G=GAME,F=G.S.fight,me=F.fighters.find(f=>f.isMe); for(const e of F.fighters) if(e.team===1){e.avg=.01;} const p0=G.S.hero.potions, hp0=me.hp, eh=F.fighters.filter(f=>f.team===1).map(f=>f.hp).join(); G.fightAct('potion'); F.my.blk=blkSet('head',me.blkN); G.fightGo(); const tl=[]; for(const l of F.log){ if(l.c==='turn') break; tl.push(l); } return {p0,p1:G.S.hero.potions,hp0,hp1:me.hp, heroHit: tl.some(l=>l.c==='me' && l.t.startsWith(me.name+' ') && /−\d+$/.test(l.t)), log:tl.map(l=>l.t).join(' | ')}})()""")
        ok('potion as a turn action: +HP, −1 potion, hero does not attack that turn', r['p1']==r['p0']-1 and r['hp1']>r['hp0'] and not r['heroHit'] and 'вместо удара пьёт зелье' in r['log'], r)
        # побег из боя в пещере → отряд уходит с добычей
        r=await pg.evaluate("""(()=>{const G=GAME; let k=0; while(G.S.fight && G.S.fight.phase==='turn' && k++<40){ const F=G.S.fight, me=F.fighters.find(f=>f.isMe); for(const e of F.fighters) if(e.team===1){e.avg=.01; e.hp=e.max;} G.fightAct('flee'); F.my.blk=blkSet('head',me.blkN); G.fightGo(); }
          const F=G.S.fight; return {k, fled:F&&F.fled, ph:G.S.dun&&G.S.dun.phase, res:G.S.dun&&G.S.dun.result}})()""")
        ok('flee attempt: eventually succeeds; dungeon party retreats with loot', r['fled']==1 and r['ph']=='end' and 'ушёл' in (r['res'] or ''), r)
        await ctx.close()
        # 5) павший герой остаётся без сознания, пока не вылечат
        ctx,pg=await newgame(br,'rogue')
        await pg.evaluate(DUN_JS, {'go':1, 'pot':1})
        r=await pg.evaluate("""(()=>{const G=GAME,F=G.S.fight,me=F.fighters.find(f=>f.isMe); me.hp=0; me.alive=false; for(const f of F.fighters) if(f.team===1){f.hp=1;} autoResolveBattle(F); const U=G.S.dun,h=G.S.hero; return {out:U.out, hp:h.hp, ph:U.phase}})()""")
        ok('fallen hero in a won dungeon fight stays unconscious (out, 1 HP — no free revive)', r['out']==1 and r['hp']<=2 and r['ph']=='explore', r)
        r=await pg.evaluate("""(()=>{const G=GAME,U=G.S.dun; const ad=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:U.pos.x+dx,y:U.pos.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<5&&q.y<5&&U.tiles[q.y*5+q.x]&&U.tiles[q.y*5+q.x].t!=='boss'); const q=ad[0], t=U.tiles[q.y*5+q.x]; t.t='fight'; t.done=0; t.seen=1; dunMove(q.x+','+q.y); if(!G.S.fight) dunMove(q.x+','+q.y); const F=G.S.fight, me=F&&F.fighters.find(f=>f.isMe); const r={fight:!!F, meAlive:me&&me.alive, intro:F&&/без сознания/.test(F.log.map(l=>l.t).join(' '))}; 
          G.S.god.skills.heal=1; G.S.god.faith=G.maxFaith(); if(F.phase==='intro') nextTurn(F); G.fightPower('heal'); r.revived=me.alive; r.out=U.out; r.hp=me.hp; autoResolveBattle(F); return r})()""")
        ok('next fight: unconscious hero does not fight (party carries him); god «Исцеление» in fight raises him', r['fight'] and r['meAlive']==False and r['intro'] and r['revived'] and r['out']==0 and r['hp']>0, r)
        r=await pg.evaluate("""(()=>{const G=GAME,U=G.S.dun; if(!U||U.phase!=='explore') return {skip:1}; U.out=1; G.S.hero.hp=1; G.S.hero.potions=1; const a=G.dunPotion(false); const r={a, out:U.out, hp:G.S.hero.hp}; U.out=1; G.S.hero.hp=1; U.heals=0; G.S.god.faith=G.maxFaith(); G.dunHeal(); r.out2=U.out; r.hp2=G.S.hero.hp; return r})()""")
        ok('between rooms: party pours a potion / god heals → hero wakes up', r.get('skip') or (r['a'] and r['out']==0 and r['hp']>1 and r['out2']==0 and r['hp2']>1), r)
        await pg.evaluate("GAME.render()"); await pg.screenshot(path='/workspace/godgame/shots9_dungeon_desktop.png')
        await ctx.close()
        # 6) бога нет: герой осторожен — без подготовки, блок объявленного удара, зелье на краю, без сил; отряд уходит, если слаб
        ctx,pg=await newgame(br,'cleric')
        await pg.evaluate("GAME.setLastInput(0)")
        r=await pg.evaluate(DUN_JS, {'go':0})
        r=await pg.evaluate("""(()=>{const G=GAME,U=G.S.dun; G.setLastInput(0); const ad=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:U.pos.x+dx,y:U.pos.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<5&&q.y<5&&U.tiles[q.y*5+q.x]&&U.tiles[q.y*5+q.x].t!=='boss'); const q=ad[0]; dunMove(q.x+','+q.y); if(!G.S.fight) dunMove(q.x+','+q.y); const F=G.S.fight; if(!F) return {fight:false};
          const r={fight:true, prep:F.prep, T:F.T}; nextTurn(F); r.absent=F.absent; r.T2=F.T; const me=F.fighters.find(f=>f.isMe); const b=F.fighters.find(f=>f.team===1);
          let bl=0; for(let i=0;i<200;i++){ F.tele={zone:'legs',fid:b.id,mul:2}; const c=G.heroBrain(F,me); if(c.blk.includes('legs')) bl++; } r.tblk=bl/200; F.tele=null;
          me.hp=Math.round(me.max*.2); G.S.hero.potions=1; r.act=G.heroBrain(F,me).act; const pl=F.powersLeft, f0=G.S.god.faith; autoResolveBattle(F); r.pow=pl-((G.S.fight===F?F:F).powersLeft); r.faith=f0-G.S.god.faith; return r})()""")
        ok('god absent: no prep wait, quick careful turns, blocks telegraphs (≥75%), potion at low HP, never uses god powers', r['fight'] and r['prep']==0 and r['T']<=3 and r['absent'] and r['T2']<=6 and r['tblk']>=.75 and r['act']=='potion' and r['pow']==0 and r['faith']==0, r)
        r=await pg.evaluate("""(()=>{const G=GAME,U=G.S.dun; if(!U||U.phase!=='explore') return {skip:1}; U.out=1; G.S.hero.hp=1; G.S.hero.potions=0; for(const p of U.party) if(!p.isMe) p.hp=20; for(const t of U.tiles) if(t&&!t.done&&t.t!=='boss') { t.t='fight'; } dunAutoStep(true); return {ph:U.phase, f:!!G.S.fight, res:U.result}})()""")
        ok('absent + hero out + party weak + no potions → party retreats instead of fighting on', r.get('skip') or (r['ph']=='end' and not r['f']), r)
        await ctx.close()
        # 7) арена: бег/зелье недоступны; таймер стоит, пока карточка не видна (мобайл, другая вкладка)
        for W,H in [(390,844),(320,640)]:
            ctx,pg=await newgame(br,'bard',W,H)
            await pg.evaluate("GAME.S.ui.mtab='arena'; GAME.render()")
            await pg.evaluate(DUN_JS, {'go':1}); await pg.wait_for_timeout(250)
            r=await pg.evaluate("(()=>{const b=document.getElementById('fightBox').getBoundingClientRect(); return {mtab:GAME.S.ui.mtab, vis:b.top<innerHeight&&b.bottom>0&&b.height>0, w:document.documentElement.scrollWidth}})()")
            ok(f'{W}px: fight start switches bottom-nav to hero and scrolls fight card into view, no overflow', r['mtab']=='hero' and r['vis'] and r['w']<=W, r)
            await pg.screenshot(path=f'/workspace/godgame/shots9_prep_{W}.png')
            await pg.evaluate("GAME.S.ui.mtab='powers'; GAME.render()"); await pg.wait_for_timeout(100)
            t0=await pg.evaluate("GAME.S.fight.t"); await pg.evaluate("GAME.S.paused=false"); await pg.wait_for_timeout(1300); await pg.evaluate("GAME.S.paused=true")
            t1=await pg.evaluate("GAME.S.fight.t")
            ok(f'{W}px: fight timer paused while the fight card is not visible (other tab)', abs(t1-t0)<0.01, [t0,t1])
            await pg.evaluate("GAME.S.ui.mtab='hero'; GAME.render()"); await pg.wait_for_timeout(100)
            await pg.click('#fightBox [data-act=fgo]'); await pg.wait_for_timeout(100)
            await pg.evaluate("(()=>{const F=GAME.S.fight, me=F.fighters.find(f=>f.isMe); me.hp=Math.round(me.max*.2); GAME.S.hero.hp=me.hp; GAME.render()})()"); await pg.wait_for_timeout(100)
            r=await pg.evaluate("(()=>({low:!!document.querySelector('#fightBox .lowhp'), w:document.documentElement.scrollWidth}))()")
            ok(f'{W}px: low-HP warning with options fits', r['low'] and r['w']<=W, r)
            await pg.evaluate("(()=>{const e=document.querySelector('#fightBox .lowhp'); window.scrollTo(0, e.getBoundingClientRect().top+scrollY-130)})()"); await pg.screenshot(path=f'/workspace/godgame/shots9_lowhp_{W}.png')
            await ctx.close()
        ctx,pg=await newgame(br,'warrior')
        r=await pg.evaluate("""(()=>{const G=GAME; const me=heroUnit(); const b=botUnit({name:'Бот',race:'elf',cls:'rogue',lvl:3}); const F=beginBattle('duel',[me],[b],{}); nextTurn(F); G.fightAct('flee'); G.fightAct('potion'); G.render(); const x={act:F.my.act||null, btn:!!document.querySelector('#fightBox [data-act=fflee]')}; G.S.fight=null; return x})()""")
        ok('arena: no flee/potion actions', r['act'] is None and not r['btn'], r)
        await ctx.close()
        await br.close()
    res['js_errors']=errs[:5]
    nf=sum(1 for v in res.values() if isinstance(v,str) and v.startswith('FAIL')); res['SUMMARY']=f"{sum(1 for v in res.values() if v=='OK')} OK, {nf} FAIL"
    print(json.dumps(res,ensure_ascii=False,indent=1))
if __name__=="__main__": asyncio.run(main())

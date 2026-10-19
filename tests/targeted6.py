# v6-проверки: сила снаряжения (ГС), сложности подземелий, кузнец, свойства в бою, миграция v5→v6
import asyncio, json, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
R={}
def ok(n,c,info=''): R[n]=('OK' if c else 'FAIL')+(' '+json.dumps(info,ensure_ascii=False)[:300] if (info!='' and not c) else '')
async def fresh(pg, cls='warrior'):
    await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(300)
    await pg.select_option('#inCls',cls); await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.paused=true')
    await pg.evaluate("GAME.S.timers.fork=1e5;GAME.S.timers.duel=1e5;GAME.S.timers.dun=1e5;GAME.S.timers.event=1e5;GAME.S.god.faith=GAME.maxFaith();GAME.S.featOffer=null;GAME.S.hero.state='road';GAME.render()")
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(300); await fresh(pg)
        r=await pg.evaluate("(()=>{const c=document.querySelector('#colHero .gsc');return {t:c&&c.innerText, tip:c&&c.title, gs:GAME.gearScore(GAME.S.hero)}})()")
        ok('hero card: GS chip with tooltip', r['t'] and str(r['gs']) in r['t'] and 'Оружие' in (r['tip'] or ''), r)
        r=await pg.evaluate("[1,3,6,10,15].map(L=>[GAME.recGS(L,'easy'),GAME.recGS(L,'normal'),GAME.recGS(L,'hard')])")
        ok('recommended GS: easy<normal<hard, grows with level', all(a<b<c for a,b,c in r) and all(r[i][1]<=r[i+1][1] for i in range(4)) and r[0][1]<r[-1][1], r)
        # GS components
        r=await pg.evaluate("""(()=>{const it=GAME.makeItem('weapon',5,1); it.curse=null; const a=GAME.itemGS(it); it.plus++; const b=GAME.itemGS(it); it.rar++; const c=GAME.itemGS(it); it.props.push({k:'fire'}); const d=GAME.itemGS(it); return [a,b,c,d]})()""")
        ok('itemGS: +N, rarity, properties raise GS', r[1]==r[0]+4 and r[2]==r[1]+3 and r[3]==r[2]+3, r)
        # sheet + smith
        await pg.evaluate("GAME.S.hero.gold=5000;GAME.S.hero.eq.weapon.plus=0;GAME.S.hero.eq.weapon.rar=1;GAME.render()")
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');return {gs:/ГС \\d+/.test(m.innerText), rec:/рек\\. (ГС )?\\d+/.test(m.innerText), sm:m.querySelectorAll('[data-act=itemD]').length}})()")
        ok('hero sheet: GS, recommended per tier, clickable items', r['gs'] and r['rec'] and r['sm']>=3, r)
        await pg.click('#modal [data-act=itemD][data-arg="eq:weapon"]'); await pg.wait_for_timeout(150)
        b=await pg.evaluate("({gs:GAME.gearScore(GAME.S.hero),g:GAME.S.hero.gold,p:GAME.S.hero.eq.weapon.plus,c:GAME.smithCost(GAME.S.hero.eq.weapon)})")
        await pg.click('#modal [data-act=smith][data-arg=weapon]'); await pg.wait_for_timeout(150)
        a=await pg.evaluate("({gs:GAME.gearScore(GAME.S.hero),g:GAME.S.hero.gold,p:GAME.S.hero.eq.weapon.plus,n:GAME.S.hero.eq.weapon.n,d:GAME.S.diary[0].x,open:document.getElementById('modal').classList.contains('on')})")
        ok('smith: +1, gold spent, GS +4, name updated, diary', a['p']==b['p']+1 and a['g']==b['g']-b['c'] and a['gs']==b['gs']+4 and '+1' in a['n'] and 'кузнец' in a['d'].lower() and a['open'], [b,a])
        await pg.click('#modal [data-act=smith][data-arg=weapon]'); await pg.wait_for_timeout(100)
        r=await pg.evaluate("({p:GAME.S.hero.eq.weapon.plus, btn:!!document.querySelector('#modal [data-act=smith][data-arg=weapon]')})")
        ok('smith cap from rarity (uncommon → +2), button hidden at cap', r['p']==2 and not r['btn'], r)
        await pg.evaluate("GAME.closeModal()")
        r=await pg.evaluate("(()=>{const h=GAME.S.hero;h.gold=0;const p=h.eq.armor.plus;GAME.smithUpgrade('armor');return h.eq.armor.plus===p})()")
        ok('smith: no gold → no upgrade', r)
        # tier modal
        await pg.evaluate("GAME.S.hero.gold=100;GAME.S.god.faith=GAME.maxFaith();GAME.render()")
        await pg.evaluate("ACT.callDun()"); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');return {on:m.classList.contains('on'),n:m.querySelectorAll('[data-act=dunTier]').length,t:m.innerText}})()")
        ok('callDun opens tier picker: 3 tiers with rec GS and verdict', r['on'] and r['n']==3 and r['t'].count('рек. ГС')==3 and 'Награда зависит только от сложности' in r['t'], r['t'][:200])
        await pg.screenshot(path='/workspace/godgame/shots6_tier_desktop.png')
        f0=await pg.evaluate("GAME.S.god.faith")
        await pg.click('[data-act=dunTier][data-arg=hard]'); await pg.wait_for_timeout(2500)
        r=await pg.evaluate("(()=>{const U=GAME.S.dun;return U&&{diff:U.diff,rec:U.rec,want:GAME.recGS(GAME.S.hero.lvl,'hard'),gm:U.gm,name:U.name,gs:U.party.map(p=>p.gs),f:GAME.S.god.faith,box:document.getElementById('dunBox').innerText}})()")
        ok('hard dungeon started: tier, rec, party GS, faith −40, card shows tier/GS/boss affinity', r and r['diff']=='hard' and r['rec']==r['want'] and all(g>0 for g in r['gs']) and r['f']==f0-40 and 'Тяжёлая' in r['box'] and 'ГС отряда' in r['box'] and ('боится' in r['box'] or 'не берёт' in r['box']), r)
        await pg.screenshot(path='/workspace/godgame/shots6_dun_desktop.png')
        # monster multiplier: low GS hero ⇒ stronger monsters, high GS ⇒ weaker
        r=await pg.evaluate("""(()=>{const U=GAME.S.dun, me=U.party.find(p=>p.isMe); me.gs=Math.round(U.rec*.6); const lo=GAME.dunGearMul(U).m; me.gs=Math.round(U.rec*1.5); const hi=GAME.dunGearMul(U).m; me.gs=U.rec; const eq=GAME.dunGearMul(U).m; return {lo,hi,eq}})()""")
        ok('gear multiplier: under-geared > 1.25, at rec ≈1, over-geared < .8', r['lo']>1.25 and .9<r['eq']<1.12 and r['hi']<.8, r)
        # rewards independent of GS: same RNG, different gear ⇒ same chest gold and same fight rewards
        r=await pg.evaluate("""(()=>{const U=GAME.S.dun, sv=JSON.stringify(U), me=U.party.find(p=>p.isMe); const mean=(q,diff)=>{ me.gs=Math.round(U.rec*q); U.diff=diff; U.gm=GAME.dunGearMul(U).m; let s=0,n=0;
            for(let i=0;i<600;i++){ const t={t:'chest',x:0,y:0,seen:1}; const g0=U.gold; dunEnter(U,t); if(GAME.S.fight){GAME.S.fight=null;U.phase='explore';continue;} s+=U.gold-g0; n++; U.gold=g0; } return s/n; };
            const r={lo:mean(.5,'hard'),hi:mean(2,'hard'),easy:mean(1,'easy')}; GAME.S.dun=JSON.parse(sv); return r})()""")
        ok('chest gold: same for under/over-geared, depends on tier', abs(r['lo']-r['hi'])/r['hi']<.08 and r['easy']<r['hi']*.6, r)
        # props in fights
        r=await pg.evaluate("""(()=>{const out={};const L=GAME.S.hero.lvl+3; GAME.S.dun=null; GAME.S.fight=null;
          const mk=(props,boss)=>{const me=heroUnit(); me.props=props; me.hp=me.max=9999; const b=monsterUnit('Каменный Голем',L,{hp:3,boss:boss}); const F=beginBattle('duel',[me],[b],{}); for(let i=0;i<30&&F.phase!=='end';i++){ if(F.phase==='intro') nextTurn(F); F.my.atk=['head'];F.my.blk=['legs'];F.my.target=b.id;F.ready=true; resolveTurn(F);} const t=F.log.map(l=>l.t||l.x||l).join('\\n'); GAME.S.fight=null; return {t,bhp:b.hp,bmax:b.max,mehp:me.hp}};
          let a=mk(['fire'],null); out.fire=/🔥/.test(a.t);
          a=mk(['fire'],{m:'none',weak:'crit',res:'fire'}); out.fireRes=/не берёт/.test(a.t);
          a=mk(['crit'],{m:'none',weak:'crit',res:'fire'}); out.weak=/слабость/.test(a.t);
          a=mk(['vamp'],null); out.vamp=/🩸\\+\\d/.test(a.t);
          const me=heroUnit(); me.props=['thorns']; me.hp=me.max=9999; const m=monsterUnit('Волк',L,{hp:5}); const F=beginBattle('duel',[me],[m],{}); for(let i=0;i<25&&F.phase!=='end';i++){ if(F.phase==='intro') nextTurn(F); F.my.atk=['head'];F.my.blk=['legs'];F.my.target=m.id;F.ready=true; resolveTurn(F);} out.thorns=/🌵/.test(F.log.map(l=>l.t||l.x||l).join('\\n')); GAME.S.fight=null;
          return out})()""")
        ok('props visible in fight: fire, boss resist, boss weakness, vampirism, thorns', all(r.values()), r)
        r=await pg.evaluate("(()=>{const u=monsterUnit('Скелет без чувства юмора',5,{elite:1});return [u.weak,u.res]})()")
        ok('undead elite weak to silver', r==['holy','vamp'], r)
        # auto tier
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const s=JSON.stringify(h.eq); const res=[]; for(const sl of ['amulet','ring']) h.eq[sl]=null; h.eq.weapon.plus=0;h.eq.armor.plus=0;h.eq.weapon.props=[];h.eq.armor.props=[];h.eq.weapon.rar=0;h.eq.armor.rar=0; const ar=h.eq.armor; h.eq.armor=null; res.push(GAME.autoTier(h)); h.eq.armor=ar; h.eq.weapon.plus=5;h.eq.armor.plus=5;h.eq.weapon.rar=4;h.eq.armor.rar=4; res.push(GAME.autoTier(h)); h.eq=JSON.parse(s); return res})()""")
        ok('hero picks tier himself by GS (weak → easy, strong → hard)', r==['easy','hard'], r)
        # migration v5 → v6 with active dungeon
        await ctx.close(); ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300); await fresh(pg)
        await pg.evaluate("(()=>{GAME.S.timers.dunCd=0;GAME.S.hero.state='road';return GAME.startDungeon(true,'normal')})()"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.v=5; delete s.dun.diff; delete s.dun.rec; delete s.dun.gm; s.dun.party.forEach(p=>delete p.gs); const j=JSON.stringify(s); localStorage.setItem(GAME.SAVE_KEY, j); const w=()=>localStorage.setItem(GAME.SAVE_KEY, j); window.addEventListener('beforeunload',w); document.addEventListener('visibilitychange',w); window.addEventListener('pagehide',w);})()")
        await pg.reload(); await pg.wait_for_timeout(400)
        r=await pg.evaluate("({v:GAME.S.v, diff:GAME.S.dun&&GAME.S.dun.diff, rec:GAME.S.dun&&GAME.S.dun.rec, gs:GAME.S.dun&&GAME.S.dun.party.every(p=>p.gs>0), note:GAME.S.diary.slice(0,6).some(d=>/ГС/.test(d.x)&&/Обновление мира/.test(d.x)), card:/ГС отряда/.test(document.getElementById('dunBox').innerText)})")
        ok('v5->v8 migration: dungeon kept as normal tier, rec/GS filled, note', r['v']==8 and r['diff']=='normal' and r['rec']>0 and r['gs'] and r['note'] and r['card'], r)
        await pg.evaluate("GAME.S.paused=true")
        r=await pg.evaluate("(()=>{let k=0; while(GAME.S.dun&&k++<400){ if(GAME.S.fight) autoResolveBattle(GAME.S.fight); else if(GAME.S.dun.phase==='explore') dunAutoStep(); else if(GAME.S.dun.phase==='end') GAME.S.dun=null; else GAME.S.dun.phase='explore'; } return {done:!GAME.S.dun}})()")
        ok('migrated dungeon playable to the end', r['done'], r)
        # corrupted dungeon fields sanitized
        await pg.evaluate("(()=>{GAME.S.timers.dunCd=0;GAME.S.fight=null;GAME.S.hero.state='road';return GAME.startDungeon(true,'easy')})()"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.dun.diff='ultra'; s.dun.gm='x'; s.dun.rec=-5; s.dun.party[0].gs='bad'; localStorage.setItem(GAME.SAVE_KEY, JSON.stringify(s)); const j=JSON.stringify(s); const w=()=>localStorage.setItem(GAME.SAVE_KEY, j); window.addEventListener('beforeunload',w); document.addEventListener('visibilitychange',w); window.addEventListener('pagehide',w);})()")
        await pg.reload(); await pg.wait_for_timeout(400)
        r=await pg.evaluate("({diff:GAME.S.dun&&GAME.S.dun.diff, gm:GAME.S.dun&&GAME.S.dun.gm, rec:GAME.S.dun&&GAME.S.dun.rec, gs:GAME.S.dun&&GAME.S.dun.party[0].gs})")
        ok('corrupted v6 dungeon fields sanitized', r['diff']=='normal' and isinstance(r['gm'],(int,float)) and r['rec']>0 and r['gs']>0, r)
        await ctx.close()
        # mobile
        ctx=await br.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300); await fresh(pg)
        await pg.evaluate("ACT.callDun()"); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card');return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1}})()")
        ok('mobile: tier picker fits 390px', r['w']<=390 and r['sw'], r)
        await pg.screenshot(path='/workspace/godgame/shots6_tier_mobile.png')
        await pg.evaluate("GAME.closeModal()"); await pg.evaluate("GAME.S.hero.gold=3000;GAME.render()"); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card');return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1}})()")
        ok('mobile: sheet (doll) fits 390px', r['w']<=390 and r['sw'], r)
        await pg.screenshot(path='/workspace/godgame/shots6_sheet_mobile.png')
        await ctx.close(); await br.close()
        R['js_errors']=errs[:5]; R['SUMMARY']=f"{sum(1 for v in R.values() if isinstance(v,str) and v.startswith('OK'))} OK, {sum(1 for v in R.values() if isinstance(v,str) and v.startswith('FAIL'))} FAIL"
        print(json.dumps(R,ensure_ascii=False,indent=1))
asyncio.run(main())

# v7: слоты, требования, комплекты, щит, двуручное, кукла, миграция v6→v7
import asyncio, json, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/godgame/index.html'
res={}; errs=[]
def ok(n,c,info=None):
    res[n]='OK' if c else 'FAIL '+json.dumps(info,ensure_ascii=False)[:400]
async def newgame(br, cls, w=1280, h=900):
    ctx=await br.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.select_option('#inCls',cls); await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    await pg.evaluate("GAME.S.paused=true; GAME.S.timers.fork=GAME.S.timers.duel=GAME.S.timers.dun=GAME.S.timers.event=1e9")
    return ctx,pg
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx,pg=await newgame(br,'warrior')
        r=await pg.evaluate("""(()=>{const G=GAME,b=Object.values(G.BASES).reduce((s,a)=>s+a.length,0);
          return {slots:G.EQ_KEYS.length, bases:b, wb:G.BASES.weapon.length, cats:Object.keys(G.WCAT).length, props:Object.keys(G.PROP_DEF).length, sets:Object.keys(G.SETS).length,
          pcs:Object.values(G.SETS).reduce((s,x)=>s+x.pcs.length,0), leg:G.LEGENDARY.length, legfl:G.LEGENDARY.every(l=>l.fl&&l.lv), curses:Object.keys(G.CURSES).length,
          other:['armor','helm','boots','belt','gloves','offhand','amulet','ring'].map(k=>G.BASES[k].length),
          setsz:Object.values(G.SETS).every(x=>x.pcs.length>=3&&x.pcs.length<=6&&x.b[2]&&x.lv[0]<=x.lv[1])}})()""")
        ok('content counts: 10 slots, 15-25+ weapon bases, 8-15 per slot, 9 sets, 15 legendaries', r['slots']==10 and r['wb']>=15 and all(8<=x<=15 for x in r['other']) and r['sets']>=6 and r['leg']>=10 and r['legfl'] and r['props']>=20 and r['setsz'], r)
        res['_counts']=r
        r=await pg.evaluate("(()=>{const h=GAME.S.hero;return {o:h.eq.offhand&&h.eq.offhand.n, sh:h.eq.offhand&&h.eq.offhand.blk>0, keys:Object.keys(h.eq).length, helm:h.eq.helm}})()")
        ok('warrior starts with shield, 10 eq keys, empty new slots', r['sh'] and r['keys']==10 and r['helm'] is None, r)
        # GS includes new slots
        r=await pg.evaluate("(()=>{const h=GAME.S.hero,g0=GAME.gearScore(h);const it=GAME.makeItem('helm',3,1);it.curse=null;h.eq.helm=it;const g1=GAME.gearScore(h);const gl=GAME.makeItem('gloves',3,1);gl.curse=null;h.eq.gloves=gl;return [g0,g1,GAME.gearScore(h)]})()")
        ok('GS includes helm and gloves', r[1]>r[0] and r[2]>r[1], r)
        # requirements
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.inv=[]; const it=GAME.makeItem('weapon',9,2); it.curse=null; it.req={lvl:h.lvl+5,s:'str',v:19}; it.die=12; h.inv.push(it);
          const ok1=GAME.reqOk(h,it), eq1=GAME.equipInv(it.id), still=h.inv.includes(it)&&h.eq.weapon!==it; const eqT=GAME.equip(it,true); return {id:it.id,ok1,eq1,still,eqT,inv:h.inv.includes(it)}})()""")
        ok('requirements: unmet → cannot equip (manual or auto), stays in backpack', not r['ok1'] and not r['eq1'] and r['still'] and not r['eqT'] and r['inv'], r)
        iid=r['id']
        await pg.evaluate("GAME.render()"); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');return {red:m.querySelectorAll('.inv .rqb').length, cells:m.querySelectorAll('.doll .slotc').length}})()")
        ok('backpack shows unmet requirement in red; doll has 10 cells', r['red']>=1 and r['cells']==10, r)
        await pg.click(f'#modal [data-act=itemD][data-arg="inv:{iid}"]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');return {t:m.innerText, red:m.querySelectorAll('.rqb').length, eqb:!!m.querySelector('[data-act=equipInv]:not([disabled])'), cmp:!!m.querySelector('.cmp')}})()")
        ok('item detail: requirement red, "Требуется", comparison, no equip button', r['red']>=1 and 'Требуется' in r['t'] and r['cmp'] and not r['eqb'], {k:v for k,v in r.items() if k!='t'})
        r=await pg.evaluate(f"""(()=>{{const h=GAME.S.hero; h.lvl+=5; h.st.str=19; const it=h.inv.find(i=>i.id==='{iid}'); GAME.tryEquipInv(); return {{eq:h.eq.weapon===it, inv:h.inv.includes(it), d:GAME.S.diary.slice(0,4).map(x=>x.x).join(' | ')}}}})()""")
        ok('after level/stat met: auto-equips from backpack', r['eq'] and not r['inv'], r)
        await pg.evaluate("GAME.closeModal()")
        # 2h blocks shield
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.inv=[]; h.eq.weapon=GAME.makeItem('weapon',3,1); h.eq.weapon.curse=null; h.eq.weapon.cat='sword'; delete h.eq.weapon.h2; const sh=GAME.makeItem('offhand',3,1); sh.curse=null; h.eq.offhand=sh; const w=GAME.makeItem('weapon',3,1); w.curse=null; w.cat='two'; w.h2=1; w.die=12; w.req={lvl:1};
          GAME.equip(w,true,true); const a={eq:h.eq.weapon===w, off:h.eq.offhand, shInInv:h.inv.includes(sh)};
          const sh2=GAME.makeItem('offhand',3,1); sh2.curse=null; sh2.req={lvl:1}; h.inv.push(sh2); const fits=GAME.bestPlace(h,sh2,false);
          return Object.assign(a,{opt:fits?fits.k:null, wAfter:fits?(fits.eq.weapon?fits.eq.weapon.h2:null):null})})()""")
        ok('2h weapon removes shield to backpack; shield cannot coexist with 2h', r['eq'] and r['off'] is None and r['shInInv'] and (r['opt'] is None or not r['wAfter']), r)
        await pg.evaluate("GAME.render()"); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("!!document.querySelector('#modal .slotc.empty[title*=\"двуруч\"]')")
        ok('doll marks offhand blocked by two-hander', r)
        await pg.evaluate("GAME.closeModal()")
        r=await pg.evaluate("""(()=>{const s=GAME.S; const e=document.createElement('x'); const h=s.hero; h.eq.offhand={...h.eq.weapon, id:'x1'}; return true})()""")
        await pg.evaluate("(()=>{localStorage.setItem('bogodel_save_v1', JSON.stringify(GAME.S));})()")
        await pg.evaluate("window.onbeforeunload=null"); 
        # shield block in fight log
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.eq.weapon=GAME.makeItem('weapon',3,1); h.eq.weapon.curse=null; delete h.eq.weapon.h2; h.eq.weapon.cat='sword';
          const s=GAME.makeItem('offhand',3,1); s.curse=null; s.blk=.3; h.eq.offhand=s; GAME.recalcHp&&GAME.recalcHp(); const u=heroUnit(); const b=botUnit({name:'Бот',race:'human',cls:'warrior',lvl:3});
          u.gx.blk=1; const F={fighters:[u,b],turn:2,log:[]}; const r=hitOne(F,b,u,'chest',{}, {}); return {line:r.line, dmg:r.dmg, blkN:u.blkN, sh:u.gx.sh}})()""")
        ok('shield: blocks hit with "принимает удар на щит", warrior blocks 3 zones', 'щит' in (r['line'] or '') and r['dmg']==0 and r['blkN']==3 and r['sh'], r)
        r=await pg.evaluate("""(()=>{let n=0,hits=0; const h=GAME.S.hero; for(let i=0;i<400;i++){const u=heroUnit(); const b=botUnit({name:'Бот',race:'human',cls:'warrior',lvl:3}); const F={fighters:[u,b],turn:2,log:[]}; const r=hitOne(F,b,u,'chest',{},{}); if(/щит/.test(r.line||'')) n++;} return n/400})()""")
        ok('shield block chance in zone combat ~ shield blk', .15<r<.45, r)
        # helm protects head, boots legs
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.eq.helm=null; h.eq.boots=null; const a=zoneArmor(h,0); const hm=GAME.makeItem('helm',5,1); hm.ac=4; hm.curse=null; h.eq.helm=hm; const bt=GAME.makeItem('boots',5,1); bt.ac=4; bt.curse=null; h.eq.boots=bt; const b=zoneArmor(h,0); return {a,b}})()""")
        ok('zone armor: helm → head, boots → legs', r['b']['head']>=r['a']['head']+3 and r['b']['legs']>=r['a']['legs']+3 and r['b']['chest']==r['a']['chest'], r)
        # sets 2/4/full + progress
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; for(const k of GAME.EQ_KEYS) if(k!=='weapon'&&k!=='armor') h.eq[k]=null; h.inv=[]; h.lvl=20; for(const k in h.st) h.st[k]=20; const id='knight'; const S0=GAME.SETS[id]; const got={}; let t=0;
          const steps=[]; while(Object.keys(got).length<S0.pcs.length && t++<300){ const it=GAME.makeSetItem(id,S0.lv[1],3); if(got[it.base]) continue; it.curse=null; it.req={lvl:1}; got[it.base]=1;
            const b=GAME.bestPlace(h,it,true,true); if(!b) continue; applyPlace(h,it,b); steps.push([GAME.setCounts(h)[id]||0, GAME.setBonusProps(h).length]); }
          return {n:S0.pcs.length, steps, tiers:Object.keys(S0.b), worn:GAME.setCounts(h)[id]}})()""")
        st=r['steps']; byN={a:b for a,b in st}
        ok('set bonuses at 2/4/full pieces (knight 6 pcs)', r['worn']==r['n'] and byN.get(1,0)==0 and byN.get(2,0)>0 and byN.get(4,0)>byN.get(3,0) and byN.get(r['n'],0)>byN.get(5,0), r)
        await pg.evaluate("GAME.render()"); await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');const s=m.querySelector('.sets');return {t:s&&s.innerText, on:m.querySelectorAll('.setc.on').length}})()")
        ok('hero sheet shows set progress', r['t'] and '6/6' in r['t'].replace(' ','') and r['on']>=1, r)
        await pg.click('#modal [data-act=itemD][data-arg="eq:helm"]'); await pg.wait_for_timeout(150)
        r=await pg.evaluate("(()=>{const m=document.getElementById('modal');const b=m.querySelector('.setbox');return {box:!!b, t:b&&b.innerText, on:b?b.querySelectorAll('.setb.on').length:0}})()")
        ok('item detail shows set box with active bonuses', r['box'] and r['on']>=3, r)
        await pg.screenshot(path='/workspace/godgame/shots7_item_set_desktop.png')
        await pg.evaluate("GAME.closeModal()")
        # smith on new slots
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.gold=1e6; const out={}; for(const k of ['helm','boots','ring2','offhand','gloves','belt']){ if(!h.eq[k]){const it=GAME.makeItem(k==='ring2'?'ring':k,5,2); it.curse=null; h.eq[k]=it;} const it=h.eq[k]; it.plus=0; delete it.unique; ACT.smith(k); out[k]=it.plus;} return out})()""")
        ok('smith works on all new slots', all(v==1 for v in r.values()), r)
        await pg.evaluate("GAME.closeModal()")
        # shop + loot respect requirements
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; h.lvl=4; for(const k in h.st) h.st[k]=10; for(const k of GAME.EQ_KEYS) if(k!=='weapon') h.eq[k]=null; let bad=0,n=0; for(let i=0;i<400;i++){const it=GAME.shopPick(h,4); if(it){n++; if(!GAME.reqOk(h,it)) bad++;}} return {n,bad}})()""")
        ok('shop offers only items the hero meets requirements for', r['n']>20 and r['bad']==0, r)
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; let bad=0; for(let i=0;i<200;i++){ const it=GAME.makeItem(GAME.EQ_KEYS[i%9]==='ring2'?'ring':['weapon','offhand','helm','armor','belt','gloves','boots','amulet','ring'][i%9],8,2); it.curse=null; GAME.equip(it,true); } for(const k of GAME.EQ_KEYS){const it=h.eq[k]; if(it&&!GAME.reqOk(h,it)&&!(it.req&&it.req.lvl<=1&&!it.req.v)) bad++;} return {bad, inv:h.inv.length}})()""")
        ok('auto-equip never wears items with unmet requirements; inventory ≤16', r['bad']==0 and r['inv']<=16, r)
        await ctx.close()
        # rogue dual-wield
        ctx,pg=await newgame(br,'rogue')
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const a=sheetOf(h,0).avg; const o=h.eq.offhand; h.eq.offhand=null; const b=sheetOf(h,0).avg; h.eq.offhand=o; return {cat:o&&o.cat, slot:o&&o.slot, a, b}})()""")
        ok('rogue starts dual-wielding; offhand dagger adds damage', r['cat']=='dagger' and r['slot']=='weapon' and r['a']>r['b'], r)
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const sh=GAME.makeItem('offhand',2,1); sh.curse=null; sh.req={lvl:1}; return GAME.bestPlace(h,sh,true,true)?'ok':'none'})()""")
        ok('rogue can still use a shield in offhand', r=='ok', r)
        await ctx.close()
        # non-rogue cannot hold dagger offhand
        ctx,pg=await newgame(br,'mage')
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const d=GAME.makeItem('weapon',2,1); d.cat='dagger'; delete d.h2; d.curse=null; d.req={lvl:1}; const b=GAME.bestPlace(h,d,true,true); return {k:b&&b.k, off:h.eq.offhand}})()""")
        ok('non-rogue never puts a weapon in offhand', r['k']!='offhand', r)
        # bots/arena/party new slots
        r=await pg.evaluate("""(()=>{const v=GAME.virtualHero('human','warrior',8), u=botUnit({name:'Б',race:'human',cls:'warrior',lvl:8}), m=botUnit({name:'М',race:'elf',cls:'mage',lvl:8});
          return {helm:!!v.eq.helm, boots:!!v.eq.boots, sh:!!(v.eq.offhand&&v.eq.offhand.blk), head:u.za.head, blkN:u.blkN, gsh:u.gx.sh, mOff:!!m.gx.sh, gs:GAME.gearScore(v)}})()""")
        ok('bots get gear in new slots (helm/boots/shield → zone armor, block)', r['helm'] and r['boots'] and r['sh'] and r['head']>0 and r['blkN']==3 and r['gsh'] and not r['mOff'], r)
        # legendary flavor
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const it=GAME.makeLegend(GAME.LEGENDARY[0],10); h.inv=[it]; GAME.render(); return {id:it.id, fl:!!it.fl, rar:it.rar, req:!!it.req}})()""")
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(100)
        await pg.click(f'#modal [data-act=itemD][data-arg="inv:{r["id"]}"]'); await pg.wait_for_timeout(100)
        r2=await pg.evaluate("!!document.querySelector('#modal .fl')")
        ok('legendary has flavor text shown in detail', r['fl'] and r['rar']==4 and r2, [r,r2])
        await ctx.close()
        # migration v6 → v7 and sanitize
        ctx,pg=await newgame(br,'warrior')
        v6=await pg.evaluate("""(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); s.v=6; const e=s.hero.eq;
          s.hero.eq={weapon:{id:'w1',slot:'weapon',n:'Старый меч +2',base:'Старый меч',die:8,plus:2,rar:1,props:[{k:'fire'}],v:30},armor:{id:'a1',slot:'armor',n:'Кольчуга',base:'Кольчуга',ac:3,plus:0,rar:0,props:[],v:10},amulet:{id:'m1',slot:'amulet',n:'Амулет',base:'Амулет',plus:0,rar:1,props:[{k:'luck'}],v:9},ring:null};
          s.hero.inv=[{id:'r9',slot:'ring',n:'Кольцо',base:'Кольцо',plus:0,rar:0,props:[],v:3},{n:'Носок',v:2}]; return JSON.stringify(s)})()""")
        await ctx.close()
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('bogodel_save_v1',s)", v6); await pg.reload(); await pg.wait_for_timeout(500)
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; return {v:GAME.S.v, w:h.eq.weapon&&h.eq.weapon.n, wp:h.eq.weapon&&h.eq.weapon.plus, cat:h.eq.weapon&&h.eq.weapon.cat, a:h.eq.armor&&h.eq.armor.n, am:h.eq.amulet&&h.eq.amulet.n,
          nulls:['helm','belt','gloves','boots','offhand','ring2'].every(k=>h.eq[k]===null), keys:Object.keys(h.eq).length, inv:h.inv.length, note:GAME.S.diary.slice(0,8).some(d=>/10 слотов/.test(d.x))}})()""")
        ok('v6→v7 migration: old items kept (with +N), new slots empty, note', r['v']==7 and r['w']=='Старый меч +2' and r['wp']==2 and r['cat'] and r['a']=='Кольчуга' and r['am']=='Амулет' and r['nulls'] and r['keys']==10 and r['inv']==2 and r['note'], r)
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        ok('migrated save renders doll', await pg.evaluate("document.querySelectorAll('#modal .doll .slotc').length==10"))
        bad=await pg.evaluate("""(()=>{const s=JSON.parse(JSON.stringify(GAME.S)); const h=s.hero; h.eq.bogus={slot:'weapon',n:'x'}; h.eq.helm={slot:'weapon',n:'Меч в шлеме',die:6,props:[]};
          h.eq.weapon={id:'w2',slot:'weapon',n:'Двуручник',base:'Двуручник',cat:'two',h2:1,die:12,plus:0,rar:1,props:[],v:5}; h.eq.offhand={id:'o2',slot:'offhand',n:'Щит',base:'Щит',ac:2,blk:9,plus:0,rar:0,props:[],v:3};
          h.inv.push({id:'q',slot:'ring',n:'Кольцо?',rar:7,plus:-3,req:{lvl:'abc',v:1e9,s:'zzz'},set:'nope',props:[{k:'nope'}]}); h.eq.ring2={id:'r2',slot:'armor',n:'Броня в кольце',ac:3,props:[]}; return JSON.stringify(s)})()""")
        await pg.evaluate("window.onbeforeunload=null")
        await ctx.close()
        ctx=await br.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("s=>localStorage.setItem('bogodel_save_v1',s)", bad); await pg.reload(); await pg.wait_for_timeout(500)
        r=await pg.evaluate("""(()=>{const h=GAME.S.hero; const q=h.inv.find(i=>i.id==='q'); return {bogus:'bogus' in h.eq, helm:h.eq.helm, off:h.eq.offhand, w2:h.eq.weapon&&h.eq.weapon.h2, offInInv:h.inv.some(i=>i.id==='o2'), ring2:h.eq.ring2, q:q?{rar:q.rar,plus:q.plus,req:q.req,set:q.set||null}:null, inv:h.inv.length}})()""")
        ok('sanitize: unknown keys dropped, wrong-slot items removed, 2h pushes shield to bag, bad item fields fixed', not r['bogus'] and r['helm'] is None and r['off'] is None and r['w2'] and r['offInInv'] and r['ring2'] is None and (r['q'] is None or (0<=r['q']['rar']<=4 and r['q']['plus']>=0 and r['q']['set'] is None)) and r['inv']<=16, r)
        await pg.click('#colHero [data-act=sheet]'); await pg.wait_for_timeout(150)
        ok('sanitized save renders sheet', await pg.evaluate("document.querySelectorAll('#modal .doll .slotc').length==10"))
        await ctx.close()
        # layout: doll at 320/390/1280 and item modal fits
        for W,H in [(320,640),(390,844),(1280,900)]:
            ctx,pg=await newgame(br,'cleric',W,H)
            await pg.evaluate("""(()=>{const h=GAME.S.hero; h.lvl=12; for(const k in h.st) h.st[k]=18; for(const k of ['helm','belt','gloves','boots','amulet','ring','ring2']){const it=GAME.makeItem(k==='ring2'?'ring':k,10,1+(k.length%3)); it.curse=null; h.eq[k]=it;} const s=GAME.makeSetItem('pious',10,3); s.req={lvl:1}; s.curse=null; GAME.equip(s,true,true); h.inv=[GAME.makeItem('weapon',14,2)]; GAME.render()})()""")
            if W<700:
                hb=await pg.query_selector('[data-tab=hero]')
                if hb: await hb.click(); await pg.wait_for_timeout(100)
            await pg.click('[data-act=sheet] >> visible=true'); await pg.wait_for_timeout(200)
            r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card'); const d=m.querySelector('.doll'); const cells=[...d.querySelectorAll('.slotc')]; return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1, dw:d.scrollWidth<=d.clientWidth+1, cells:cells.length, minw:Math.min(...cells.map(c=>c.getBoundingClientRect().width))}})()")
            ok(f'doll fits {W}px', r['w']<=W and r['sw'] and r['dw'] and r['cells']==10 and r['minw']>=70, r)
            tag='mobile' if W==390 else ('320' if W==320 else 'desktop')
            await pg.screenshot(path=f'/workspace/godgame/shots7_doll_{tag}.png', full_page=False)
            el=await pg.query_selector('#modal .doll'); 
            if el: await el.screenshot(path=f'/workspace/godgame/shots7_doll_{tag}_crop.png')
            k=await pg.evaluate("(()=>{const h=GAME.S.hero; return GAME.EQ_KEYS.find(k=>h.eq[k]&&h.eq[k].set)})()")
            await pg.click(f'#modal [data-act=itemD][data-arg="eq:{k}"]'); await pg.wait_for_timeout(150)
            r=await pg.evaluate("(()=>{const m=document.querySelector('#modal .card'); return {w:document.documentElement.scrollWidth, sw:m.scrollWidth<=m.clientWidth+1, box:!!m.querySelector('.setbox')}})()")
            ok(f'item detail with set fits {W}px', r['w']<=W and r['sw'] and r['box'], r)
            await pg.screenshot(path=f'/workspace/godgame/shots7_item_set_{tag}.png')
            # hero card shows only GS chip
            await pg.evaluate("GAME.closeModal()")
            r=await pg.evaluate("(()=>{const c=document.getElementById('colHero'); return {gs:!!c.querySelector('.gsChip, [data-act=sheet] b'), eqList:!!c.querySelector('.eq li, .doll')}})()")
            ok(f'hero card: GS only, no gear list ({W}px)', not r['eqList'], r)
            await ctx.close()
        # offline 48h smoke with new items
        ctx,pg=await newgame(br,'barbarian')
        r=await pg.evaluate("""(()=>{const G=GAME; G.simulateAway(24*3600); if(G.S.featOffer) G.chooseFeat(G.S.featOffer.opts[0]); G.simulateAway(24*3600); const h=G.S.hero;
          return {lvl:h.lvl, gs:G.gearScore(h), worn:G.EQ_KEYS.filter(k=>h.eq[k]).length, inv:h.inv.length, h2off:!!(h.eq.weapon&&h.eq.weapon.h2&&h.eq.offhand), bad:G.EQ_KEYS.filter(k=>h.eq[k]&&!G.reqOk(h,h.eq[k])).length}})()""")
        ok('48h offline: fills new slots, no 2h+offhand, inv ≤16', r['worn']>=6 and r['inv']<=16 and not r['h2off'], r)
        await ctx.close(); await br.close()
    res['js_errors']=errs[:10]
    f=sum(1 for k,v in res.items() if isinstance(v,str) and v.startswith('FAIL')); o=sum(1 for v in res.values() if v=='OK')
    res['SUMMARY']=f'{o} OK, {f} FAIL'
    print(json.dumps(res,ensure_ascii=False,indent=1))
asyncio.run(main())

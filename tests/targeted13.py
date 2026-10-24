# v13: целевые проверки визуальной куклы героя (paper-doll)
import asyncio, json, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///workspace/godgame/index.html'
SHOTS = os.environ.get('SHOTS13', '/workspace/godgame/shots13_visual/')
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = 'OK' if cond else 'FAIL'
    if not cond: res['_' + name[:50]] = info
    print(('OK  ' if cond else 'FAIL'), name, '' if cond else info, flush=True)
async def newpage(br, w, h=860, fresh=True, rm=False):
    ctx = await br.new_context(viewport={'width': w, 'height': h},
                               reduced_motion='reduce' if rm else 'no-preference')
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{w}: ' + str(e)))
    pg.on('console', lambda m: errs.append(f'{w}: ' + m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(250)
    if fresh and await pg.is_visible('[data-act=newGame]'):
        await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    if fresh:
        await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx, pg
CLEAN = "(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); GAME.render(); window.scrollTo(0,0);})()"
OV = "document.documentElement.scrollWidth>innerWidth+1"
SIZES = """(sel)=>{const sm=[]; if(innerWidth<=760) for(const b of document.querySelectorAll(sel)){ if(!b.offsetParent) continue; const r=b.getBoundingClientRect(); if(!r.width) continue; if(r.height<40||r.width<40) sm.push((b.dataset.act||b.className.toString().slice(0,40))+':'+Math.round(r.width)+'x'+Math.round(r.height)); } return sm}"""
LAYER = {
    'weapon': '.vl.weapon', 'offhand': '.vl.offhand', 'helm': '.vl.helm', 'armor': '.vl.armor',
    'belt': '.vl.belt', 'gloves': '.vl.gloves', 'boots': '.vl.boots', 'amulet': '.vl.amulet',
    'ring': '.vl.ring', 'ring2': '.vl.ring2'
}
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---------- 1. ширины: кукла, без гориз. скролла, tap ≥40 ----------
        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            r = await pg.evaluate(f"""(()=>{{
              const doll=document.querySelector('#colHero .vis');
              const wrap=document.querySelector('#colHero .vwrap.vtap');
              const wr=wrap&&wrap.getBoundingClientRect();
              const nav=[...document.querySelectorAll('#mnav [data-arg]')].map(b=>b.dataset.arg);
              return {{doll:!!doll, pose:doll&&[...doll.classList].find(c=>c.startsWith('p-')),
                tap:wr&&Math.round(wr.width), taph:wr&&Math.round(wr.height),
                nav, ov:{OV}, moments:!!document.querySelector('#diary')||!!document.querySelector('.diary')||!!document.getElementById('colDiary')}};
            }})()""")
            ok(f'{W}px: doll present on hero card, no h-scroll, bottom nav intact',
               r['doll'] and not r['ov'] and set(r['nav']) >= {'powers', 'flock', 'arena', 'gods', 'hero'}, r)
            if W <= 760:
                ok(f'{W}px: doll tap target ≥40px', r['tap'] >= 40 and r['taph'] >= 40, r)
                sm = await pg.evaluate(SIZES, '#mnav button, #colHero .vwrap.vtap, header button')
                ok(f'{W}px: key buttons ≥40px', not sm, sm)
            await ctx.close()

        # ---------- 2. слои снаряжения ↔ слоты ----------
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero, keys=G.EQ_KEYS;
          const before={};
          for(const k of keys) before[k]=!!document.querySelector('#colHero '+({
            weapon:'.vl.weapon',offhand:'.vl.offhand',helm:'.vl.helm',armor:'.vl.armor',belt:'.vl.belt',
            gloves:'.vl.gloves',boots:'.vl.boots',amulet:'.vl.amulet',ring:'.vl.ring',ring2:'.vl.ring2'
          }[k]));
          // снять всё
          for(const k of keys) h.eq[k]=null;
          G.render();
          const naked=!!document.querySelector('#colHero .vl.bodyt') && !document.querySelector('#colHero .vl.armor');
          const after={};
          for(const k of keys){
            const slot=k==='ring2'?'ring':k;
            let it=G.makeItem(slot, 10, 2);
            if(k==='offhand'){ it=G.makeItem('offhand',10,2); }
            h.eq[k]=it;
            G.render();
            const sel={weapon:'.vl.weapon',offhand:'.vl.offhand',helm:'.vl.helm',armor:'.vl.armor',belt:'.vl.belt',
              gloves:'.vl.gloves',boots:'.vl.boots',amulet:'.vl.amulet',ring:'.vl.ring',ring2:'.vl.ring2'}[k];
            after[k]=!!document.querySelector('#colHero '+sel);
          }
          // unequip armor → body
          h.eq.armor=null; G.render();
          const bodyBack=!!document.querySelector('#colHero .vl.bodyt') && !document.querySelector('#colHero .vl.armor');
          // legendary glow
          const L=G.LEGENDARY.find(l=>l.slot==='weapon')||G.LEGENDARY[0];
          const leg=G.makeLegend(L, 12); h.eq[leg.slot]=leg; G.render();
          const glow=document.querySelector('#colHero .vis.leg') && document.querySelector('#colHero .vaura');
          return {keys, naked, after, bodyBack, glow:!!glow, all:keys.every(k=>after[k])};
        }""")
        ok('EQ_KEYS has 10 slots', len(r['keys']) == 10, r['keys'])
        ok('unequip all → bare body (bodyt, no armor layer)', r['naked'], r)
        ok('each equipped slot changes a visible layer', r['all'], r['after'])
        ok('unequip armor restores bare body', r['bodyBack'], r)
        ok('legendary item → .leg + aura glow', r['glow'], r)

        # ---------- 3. travel walk ----------
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null;
          h.state='road'; h.travel={to:'town',left:4,total:6}; h.monster=null; G.render();
          const card=document.querySelector('#colHero .vis.p-walk');
          const route=document.querySelector('.route .rdot.hasvis .vis, .route .vis');
          const pose=route && [...route.classList].find(c=>c.startsWith('p-'));
          return {card:!!card, route:!!route, pose};
        }""")
        ok('travel «в пути»: hero card doll has p-walk', r['card'], r)
        ok('travel: route strip shows small doll', r['route'], r)

        # ---------- 4. fight poses + prefight pair ----------
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          h.state='road'; h.travel=null;
          // force poses
          const poses={};
          for(const p of ['attack','block','hurt','idle']){
            G.visApplyFightPose(null, p);
            poses[p]=!!document.querySelector('#colHero .vis.p-'+p);
          }
          // prefight: start a zone fight card if possible
          let pair=false, foe=false;
          try {
            const mon=G.monsterRef ? G.monsterRef(h.lvl||3) : null;
            // render fight box manually via visPairHTML
            const html=G.visPairHTML(h, {kind:'monster',name:'Гоблин'}, {size:'md'});
            const box=document.createElement('div'); box.id='fightBox'; box.innerHTML='<div class="card">'+html+'</div>';
            document.body.appendChild(box);
            pair=!!document.querySelector('#fightBox .vpair');
            foe=!!document.querySelector('#fightBox .vis.foe');
            const me=!!document.querySelector('#fightBox .vwrap.me .vis');
            G.visApplyFightPose(null,'attack');
            const atk=!!document.querySelector('#fightBox .vwrap.me .vis.p-attack');
            box.remove();
            return {poses, pair, foe, me, atk};
          } catch(e){ return {poses, err:String(e)}; }
        }""")
        ok('fight pose classes: attack/block/hurt/idle fire', all(r.get('poses', {}).values()), r)
        ok('prefight pair: hero doll + enemy silhouette', r.get('pair') and r.get('foe') and r.get('me'), r)
        ok('prefight attack pose on me doll', r.get('atk'), r)

        # tap opens sheet
        await pg.evaluate(CLEAN)
        await pg.click('#colHero .vwrap.vtap')
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("(()=>({on:document.getElementById('modal').classList.contains('on'), sheet:document.getElementById('modal').innerText.includes('Снаряжение')||document.getElementById('modal').querySelector('.dav, .doll, .eq')!==null, vis:!!document.querySelector('#modal .vis')}))()")
        ok('tap doll → gear/inventory sheet (with doll)', r['on'] and (r['sheet'] or r['vis']), r)
        await pg.evaluate(CLEAN)

        # ---------- 5. reduced-motion: static poses ----------
        await ctx.close()
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          h.state='road'; h.travel={to:'town',left:3,total:5}; G.render();
          const el=document.querySelector('#colHero .vis.p-walk .vroot');
          const cs=el&&getComputedStyle(el);
          return {rm:document.body.classList.contains('rm'), name:cs&&cs.animationName, dur:cs&&cs.animationDuration};
        }""")
        ok('prefers-reduced-motion: body.rm + walk animation none/near-zero',
           r['rm'] and (r['name'] in (None, 'none') or (r['dur'] and float(r['dur'].replace('s','').split(',')[0] or '1') < 0.05)), r)

        # ---------- 6. screenshots 390 & 1280 ----------
        await ctx.close()
        for W in (390, 1280):
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            # gear off
            await pg.evaluate("""()=>{const h=GAME.S.hero; for(const k of GAME.EQ_KEYS) h.eq[k]=null; h.state='town'; GAME.render();}""")
            await pg.wait_for_timeout(80)
            await pg.screenshot(path=f'{SHOTS}hero_bare_{W}.png', full_page=False)
            # gear on
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero;
              for(const k of G.EQ_KEYS){
                const slot=k==='ring2'?'ring':k;
                h.eq[k]=G.makeItem(slot,10,2);
              }
              h.state='town'; G.render();
            }""")
            await pg.wait_for_timeout(80)
            el = await pg.query_selector('#colHero')
            await el.scroll_into_view_if_needed()
            await pg.screenshot(path=f'{SHOTS}hero_geared_{W}.png', full_page=False)
            # travel
            await pg.evaluate("""()=>{const h=GAME.S.hero; h.state='road'; h.travel={to:'forest',left:4,total:6}; GAME.render();}""")
            await pg.wait_for_timeout(80)
            await pg.screenshot(path=f'{SHOTS}travel_{W}.png', full_page=False)
            # prefight
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero;
              const box=document.getElementById('fightBox');
              box.style.cssText='display:block;position:relative;margin:8px;background:var(--card,#fff);border-radius:12px;padding:8px;box-shadow:var(--shadow)';
              box.innerHTML='<div class="card"><h3>Бой</h3>'+G.visPairHTML(h,{kind:'monster',name:'Волк'},{size:'md'})+'</div>';
              G.visApplyFightPose(null,'idle');
            }""")
            await pg.wait_for_timeout(80)
            await pg.screenshot(path=f'{SHOTS}prefight_{W}.png', full_page=False)
            # mid-fight attack
            await pg.evaluate("GAME.visApplyFightPose(null,'attack')")
            await pg.wait_for_timeout(60)
            await pg.screenshot(path=f'{SHOTS}fight_attack_{W}.png', full_page=False)
            # legendary glow
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero,S=G.S;
              S.fight=null; h.state='town'; h.monster=null;
              const box=document.getElementById('fightBox');
              if(box){ box.innerHTML=''; box.style.cssText=''; }
              const L=G.LEGENDARY.find(l=>l.slot==='weapon')||G.LEGENDARY[0];
              h.eq[L.slot]=G.makeLegend(L,12);
              G.render();
            }""")
            await pg.wait_for_timeout(80)
            el = await pg.query_selector('#colHero')
            await el.scroll_into_view_if_needed()
            await pg.screenshot(path=f'{SHOTS}legendary_{W}.png', full_page=False)
            await ctx.close()

        # ---------- 7. no JS errors, moments + olymp still work ----------
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await pg.click('#mnav [data-arg=gods]'); await pg.wait_for_timeout(150)
        r = await pg.evaluate("""()=>({map:!!document.querySelector('.omap'), hex:document.querySelectorAll('.omap .rg').length, moments:!!document.querySelector('#mnav')})""")
        ok('Olympus map still works (14 hexes)', r['map'] and r['hex'] == 14, r)
        await pg.click('#mnav [data-arg=hero]'); await pg.wait_for_timeout(100)
        # diary / moments
        r = await pg.evaluate("""()=>({diary:!!(document.getElementById('colDiary')||document.querySelector('.diary, #diary')), nav:!!document.getElementById('mnav')})""")
        ok('moments/diary + bottom nav still present', r['diary'] and r['nav'], r)
        await ctx.close()

        js_err = [e for e in errs if 'favicon' not in e.lower() and 'Failed to load' not in e]
        ok('no JS errors during suite', not js_err, js_err[:8])

        # summary
        fails = [k for k, v in res.items() if v == 'FAIL' and not k.startswith('_')]
        print('\\n====', len([k for k in res if not k.startswith('_')]), 'checks,', len(fails), 'FAIL ====')
        if fails:
            for f in fails: print(' ', f, res.get('_' + f[:50], ''))
            sys.exit(1)
        print('SHOTS', SHOTS, len(os.listdir(SHOTS)), 'files')
        sys.exit(0)
asyncio.run(main())

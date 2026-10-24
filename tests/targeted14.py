# v14: живая сцена местности
import asyncio, json, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///workspace/godgame/index.html'
SHOTS = os.environ.get('SHOTS14', '/workspace/godgame/shots14_scene/')
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
BIOMES = [
    ('godgrad', 'city', 'town'),
    ('les', 'forest', 'road'),
    ('boloto', 'swamp', 'road'),
    ('gora', 'mount', 'road'),
    ('bereg', 'coast', 'road'),
    ('pustosh', 'waste', 'road'),
    ('zamok', 'castle', 'road'),
    ('dolina', 'valley', 'road'),
]
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---------- layouts ----------
        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            r = await pg.evaluate(f"""(()=>{{
              const scn=document.querySelector('#colHero .scn');
              const doll=document.querySelector('#colHero .scn .vis');
              const lab=document.querySelector('#colHero .scn-label');
              const nav=[...document.querySelectorAll('#mnav [data-arg]')].map(b=>b.dataset.arg);
              const br=scn&&scn.getBoundingClientRect();
              return {{scn:!!scn, doll:!!doll, lab:!!(lab&&lab.textContent.trim()),
                h:br&&Math.round(br.height), biome:scn&&scn.dataset.biome,
                nav, ov:{OV},
                moments:!!(document.getElementById('diary')||document.getElementById('diaryCard'))}};
            }})()""")
            ok(f'{W}px: scene+doll+label, no h-scroll, nav intact',
               r['scn'] and r['doll'] and r['lab'] and not r['ov'] and set(r['nav']) >= {'powers', 'flock', 'arena', 'gods', 'hero'}, r)
            if W <= 760:
                ok(f'{W}px: scene height ~40–50% phone (120–280px)', 120 <= (r['h'] or 0) <= 280, r)
                sm = await pg.evaluate(SIZES, '#mnav button, #colHero .scn, header button, #colHero .hc-btns button')
                ok(f'{W}px: buttons/scene tap ≥40px', not sm, sm)
            await ctx.close()

        # ---------- biome mapping ----------
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero, out={};
          const pairs=[['godgrad','city'],['les','forest'],['boloto','swamp'],['gora','mount'],['bereg','coast'],
            ['pustosh','waste'],['ovrag','ravine'],['dolina','valley'],['kapust','field'],['zamok','castle'],['pinki','village'],['ponty','city']];
          for(const [reg,exp] of pairs){
            h.reg=reg; h.loc=G.REG_BY[reg].n; h.state='road'; G.S.dun=null; G.render();
            out[reg]=document.querySelector('#colHero .scn').dataset.biome===exp;
          }
          h.state='dungeon'; G.render(); out.dungeon=document.querySelector('#colHero .scn').dataset.biome==='dungeon';
          h.state='town'; h.reg='godgrad'; G.render();
          return out;
        }""")
        ok('biome changes with Olympus region / dungeon', all(r.values()), r)

        # ---------- walk parallax ----------
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.render();
          const scn=document.querySelector('#colHero .scn');
          const far=document.querySelector('#colHero .scn-far .scn-parallax');
          const cs=far&&getComputedStyle(far);
          return {walk:scn.classList.contains('scn-walk'), dollWalk:!!document.querySelector('#colHero .scn .vis.p-walk'),
            anim:cs&&cs.animationName, biome:scn.dataset.biome, label:document.querySelector('.scn-label').textContent};
        }""")
        ok('travel: scn-walk + doll p-walk + parallax animation', r['walk'] and r['dollWalk'] and r['anim'] and r['anim'] != 'none' and r['biome']=='forest', r)

        # idle town — no walk
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='town'; h.reg='godgrad'; G.render();
          const scn=document.querySelector('#colHero .scn');
          return {walk:scn.classList.contains('scn-walk'), biome:scn.dataset.biome, idle:!!document.querySelector('#colHero .scn .vis.p-idle, #colHero .scn .vis:not(.p-walk)')};
        }""")
        ok('town idle: city biome, no scn-walk', r['biome']=='city' and not r['walk'], r)

        # ---------- gear on doll in scene ----------
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          for(const k of G.EQ_KEYS){ const slot=k==='ring2'?'ring':k; h.eq[k]=G.makeItem(slot,10,2); }
          h.state='road'; G.render();
          const layers=['weapon','armor','helm','boots','gloves','belt','amulet','offhand'].every(k=>
            !!document.querySelector('#colHero .scn .vl.'+k));
          return {layers, hasVis:!!document.querySelector('#colHero .scn .vis')};
        }""")
        ok('doll in scene still shows equipped gear layers', r['layers'] and r['hasVis'], r)

        # ---------- fight backdrop ----------
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='boloto'; h.state='road';
          const html=G.scnFightWrap(G.visPairHTML(h,{kind:'monster',name:'Трясина'},{size:'md'}), h);
          const box=document.getElementById('fightBox');
          box.innerHTML='<div class="card zf">'+html+'</div>';
          const scn=box.querySelector('.scn.scn-fight');
          const pair=box.querySelector('.vpair');
          return {biome:scn&&scn.dataset.biome, fight:scn&&scn.classList.contains('scn-fight'), pair:!!pair, foe:!!box.querySelector('.vis.foe')};
        }""")
        ok('fight backdrop matches place biome + combatants', r['biome']=='swamp' and r['fight'] and r['pair'] and r['foe'], r)
        await pg.evaluate("document.getElementById('fightBox').innerHTML=''")
        await pg.evaluate(CLEAN)

        # ---------- tap scene → sheet ----------
        await pg.click('#colHero .scn')
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("(()=>({on:document.getElementById('modal').classList.contains('on')}))()")
        ok('tap scene opens gear sheet', r['on'], r)
        await pg.evaluate(CLEAN)

        # ---------- reduced motion ----------
        await ctx.close()
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.render();
          const far=document.querySelector('#colHero .scn-far .scn-parallax');
          const cs=far&&getComputedStyle(far);
          const root=document.querySelector('#colHero .scn .vis.p-walk .vroot');
          const rcs=root&&getComputedStyle(root);
          return {rm:document.body.classList.contains('rm'), walk:document.querySelector('#colHero .scn').classList.contains('scn-walk'),
            parName:cs&&cs.animationName, parDur:cs&&cs.animationDuration,
            dollName:rcs&&rcs.animationName};
        }""")
        ok('reduced-motion: parallax/walk animations none',
           r['rm'] and (r['parName'] in (None, 'none') or (r['parDur'] and float(str(r['parDur']).split(',')[0].replace('s','') or '1') < 0.05)), r)

        # ---------- olymp + moments ----------
        await ctx.close()
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await pg.click('#mnav [data-arg=gods]'); await pg.wait_for_timeout(150)
        r = await pg.evaluate("()=>({hex:document.querySelectorAll('.omap .rg').length, map:!!document.querySelector('.omap')})")
        ok('Olympus map untouched (14 hexes)', r['map'] and r['hex']==14, r)
        await pg.click('#mnav [data-arg=hero]'); await pg.wait_for_timeout(80)
        r = await pg.evaluate("()=>({diary:!!(document.getElementById('diary')||document.getElementById('diaryCard')), scn:!!document.querySelector('#colHero .scn')})")
        ok('moments/diary + scene still present', r['diary'] and r['scn'], r)
        await ctx.close()

        # ---------- screenshots ----------
        shots = [
            ('godgrad', 'town', 'city'),
            ('les', 'road', 'forest'),
            ('boloto', 'road', 'swamp'),
            ('gora', 'road', 'mountain'),
            ('bereg', 'road', 'coast'),
            ('les', 'dungeon', 'dungeon'),
            ('les', 'road', 'travel'),
            ('boloto', 'fight', 'fight'),
        ]
        for W in (390, 1280):
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate("""()=>{const G=GAME,h=G.S.hero; for(const k of G.EQ_KEYS){const slot=k==='ring2'?'ring':k; h.eq[k]=G.makeItem(slot,10,k==='weapon'?3:1);} }""")
            for reg, state, name in shots:
                await pg.evaluate("""(arg)=>{
                  const G=GAME,h=G.S.hero,S=G.S; S.fight=null; S.dun=null;
                  h.reg=arg.reg; h.loc=G.REG_BY[arg.reg]?G.REG_BY[arg.reg].n:h.loc;
                  document.getElementById('fightBox').innerHTML='';
                  if(arg.state==='dungeon'){ h.state='dungeon'; }
                  else if(arg.state==='fight'){
                    h.state='road';
                    const box=document.getElementById('fightBox');
                    box.innerHTML='<div class="card zf"><h3>Бой</h3>'+G.scnFightWrap(G.visPairHTML(h,{kind:'monster',name:'Враг'},{size:'md'}),h)+'</div>';
                  } else { h.state=arg.state; }
                  G.render();
                }""", {'reg': reg, 'state': state})
                await pg.wait_for_timeout(80)
                if name == 'fight':
                    el = await pg.query_selector('#fightBox')
                    await el.scroll_into_view_if_needed()
                else:
                    el = await pg.query_selector('#colHero .scn')
                    await el.scroll_into_view_if_needed()
                await pg.screenshot(path=f'{SHOTS}{name}_{W}.png', full_page=False)
            await ctx.close()

        js_err = [e for e in errs if 'favicon' not in e.lower()]
        ok('no JS errors', not js_err, js_err[:8])
        fails = [k for k, v in res.items() if v == 'FAIL' and not k.startswith('_')]
        print('\n====', len([k for k in res if not k.startswith('_')]), 'checks,', len(fails), 'FAIL ====')
        if fails:
            for f in fails: print(' ', f, res.get('_' + f[:50], ''))
            sys.exit(1)
        print('SHOTS', SHOTS, sorted(os.listdir(SHOTS)))
        sys.exit(0)
asyncio.run(main())

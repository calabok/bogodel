# v15: нарисованные пластины + улучшенная кукла
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///workspace/godgame/index.html'
SHOTS = os.environ.get('SHOTS15', '/workspace/godgame/shots15_art/')
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = 'OK' if cond else 'FAIL'
    if not cond: res['_' + name[:50]] = info
    print(('OK  ' if cond else 'FAIL'), name, '' if cond else info, flush=True)
async def newpage(br, w, h=900, fresh=True, rm=False):
    ctx = await br.new_context(viewport={'width': w, 'height': h},
                               reduced_motion='reduce' if rm else 'no-preference')
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'{w}: ' + str(e)))
    pg.on('console', lambda m: errs.append(f'{w}: ' + m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(280)
    if fresh and await pg.is_visible('[data-act=newGame]'):
        await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(150)
    if fresh:
        await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx, pg
CLEAN = "(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML=''; GAME.render(); window.scrollTo(0,0);})()"
OV = "document.documentElement.scrollWidth>innerWidth+1"
async def wait_art(pg, timeout=2500):
    await pg.wait_for_function(
        "() => { const s=document.querySelector('#colHero .scn'); return s && (s.classList.contains('has-art') || s.querySelector('.scn-plate.fail') || !s.querySelector('.scn-plate')); }",
        timeout=timeout)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate("(()=>{GAME.S.hero.reg='les'; GAME.S.hero.state='road'; GAME.render();})()")
            try: await wait_art(pg)
            except Exception as e: errs.append(f'{W} art wait: {e}')
            r = await pg.evaluate(f"""(()=>{{
              const scn=document.querySelector('#colHero .scn');
              const img=scn&&scn.querySelector('.scn-plate-img');
              const plate=scn&&scn.querySelector('.scn-plate');
              const nav=[...document.querySelectorAll('#mnav [data-arg]')].map(b=>b.dataset.arg);
              return {{scn:!!scn, hasArt:scn&&scn.classList.contains('has-art'),
                fail:plate&&plate.classList.contains('fail'),
                natural:img&&img.naturalWidth||0,
                doll:!!(scn&&scn.querySelector('.vis')),
                svgFb:!!(scn&&scn.querySelector('.scn-svg-fallback')),
                ov:{OV}, nav}};
            }})()""")
            # plate load OR svg fallback visible
            art_ok = (r['hasArt'] and r['natural'] > 0) or (r['fail'] and r['svgFb']) or (not r.get('fail') and r['svgFb'] and r['natural']==0 and URL.startswith('file:'))
            # for http live, prefer hasArt; for file ok either
            ok(f'{W}px: scene+doll, plate or SVG fallback, no h-scroll',
               r['scn'] and r['doll'] and r['svgFb'] and not r['ov'] and set(r['nav']) >= {'powers','flock','arena','gods','hero'} and (r['hasArt'] or r['fail'] or r['svgFb']), r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        # distinct biomes with art keys
        r = await pg.evaluate("""async()=>{
          const G=GAME,h=G.S.hero, out={};
          const pairs=[['godgrad','city'],['les','forest'],['boloto','swamp'],['gora','mount'],['bereg','coast'],
            ['dolina','valley'],['zamok','castle'],['pustosh','waste'],['kapust','field'],['pinki','village']];
          for(const [reg,exp] of pairs){
            h.reg=reg; h.loc=G.REG_BY[reg].n; h.state='road'; G.render();
            await new Promise(r=>setTimeout(r,120));
            const scn=document.querySelector('#colHero .scn');
            const art=scn.querySelector('.scn-plate')&&scn.querySelector('.scn-plate').dataset.art;
            out[reg]={biome:scn.dataset.biome===exp, art:art===exp || (exp==='mount'&&art==='mount'), has:scn.classList.contains('has-art')||scn.querySelector('.scn-plate.fail')};
          }
          h.state='dungeon'; G.render(); await new Promise(r=>setTimeout(r,150));
          const d=document.querySelector('#colHero .scn');
          out.dungeon={biome:d.dataset.biome==='dungeon', art:d.querySelector('.scn-plate').dataset.art==='dungeon'};
          return out;
        }""")
        ok('biomes distinct + matching art keys', all(v.get('biome') and v.get('art') for v in r.values()), r)

        # gear on doll
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          for(const k of G.EQ_KEYS){ const slot=k==='ring2'?'ring':k; h.eq[k]=G.makeItem(slot,10,2); }
          h.state='road'; h.reg='les'; G.render();
          return {weapon:!!document.querySelector('#colHero .scn .vl.weapon'),
            armor:!!document.querySelector('#colHero .scn .vl.armor'),
            helm:!!document.querySelector('#colHero .scn .vl.helm'),
            shade:!!document.querySelector('#colHero .scn svg defs #sk')};
        }""")
        ok('geared doll with shaded SVG defs', all(r.values()), r)

        # walk
        r = await pg.evaluate("""()=>{
          const scn=document.querySelector('#colHero .scn');
          return {walk:scn.classList.contains('scn-walk'), doll:!!scn.querySelector('.vis.p-walk'), dust:!!scn.querySelector('.scn-dust')};
        }""")
        ok('travel: walk + dust particles', r['walk'] and r['doll'] and r['dust'], r)

        # fight backdrop art
        r = await pg.evaluate("""async()=>{
          const G=GAME,h=G.S.hero; h.reg='boloto';
          document.getElementById('fightBox').innerHTML='<div class="card zf">'+G.scnFightWrap(G.visPairHTML(h,{kind:'monster',name:'Трясина'},{size:'md'}),h)+'</div>';
          await new Promise(r=>setTimeout(r,350));
          const scn=document.querySelector('#fightBox .scn');
          return {biome:scn.dataset.biome, art:scn.querySelector('.scn-plate').dataset.art, has:scn.classList.contains('has-art')||scn.querySelector('.scn-plate.fail'), pair:!!scn.querySelector('.vpair')};
        }""")
        ok('fight backdrop uses swamp plate + combatants', r['biome']=='swamp' and r['art']=='swamp' and r['pair'], r)
        await pg.evaluate(CLEAN)

        # reduced motion
        await ctx.close()
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();
          const sh=document.querySelector('#colHero .scn-plate-shift');
          const cs=sh&&getComputedStyle(sh);
          return {rm:document.body.classList.contains('rm'), name:cs&&cs.animationName,
            dur:cs&&cs.animationDuration};
        }""")
        ok('reduced-motion: plate scroll static',
           r['rm'] and (r['name'] in (None,'none') or float(str(r['dur'] or '1').split(',')[0].replace('s','') or '1') < 0.05), r)
        await ctx.close()

        # offline/SW hint: art files listed in page origin (skip deep SW on file://)
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""async()=>{
          const keys=['forest','city','swamp','dungeon','arena'];
          const hits={};
          for(const k of keys){
            hits[k]=await new Promise(res=>{
              const i=new Image();
              i.onload=()=>res(i.naturalWidth>0);
              i.onerror=()=>res(false);
              i.src='art/'+k+'.webp';
            });
          }
          // SW CORE list present in registered script when http(s)
          let swArt=null;
          if(location.protocol.startsWith('http') && navigator.serviceWorker){
            try{
              const reg=await navigator.serviceWorker.getRegistration();
              swArt=!!reg;
            }catch(e){ swArt=false; }
          }
          return {hits, swArt, proto:location.protocol};
        }""")
        ok('art webp loadable as images', all(r['hits'].values()), r)
        if r.get('proto','').startswith('http'):
          ok('service worker registration available for art cache', r.get('swArt') is not False, r)

        # olymp + diary
        await pg.click('#mnav [data-arg=gods]'); await pg.wait_for_timeout(120)
        r = await pg.evaluate("()=>({hex:document.querySelectorAll('.omap .rg').length})")
        ok('Olympus still 14 hexes', r['hex']==14, r)
        await pg.click('#mnav [data-arg=hero]'); await pg.wait_for_timeout(80)
        r = await pg.evaluate("()=>({diary:!!document.getElementById('diary'), scn:!!document.querySelector('#colHero .scn')})")
        ok('diary not buried; scene present', r['diary'] and r['scn'], r)
        await ctx.close()

        # screenshots
        shots = [
            ('godgrad','town','city'),
            ('les','road','forest'),
            ('boloto','road','swamp'),
            ('gora','road','mount'),
            ('bereg','road','coast'),
            ('zamok','road','castle'),
            ('les','dungeon','dungeon'),
            ('les','road','travel'),
            ('boloto','fight','fight'),
        ]
        for W in (390, 1280):
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate("""()=>{const G=GAME,h=G.S.hero; for(const k of G.EQ_KEYS){const slot=k==='ring2'?'ring':k; h.eq[k]=G.makeItem(slot,10,k==='weapon'?3:2);} }""")
            for reg, state, name in shots:
                await pg.evaluate("""(arg)=>{
                  const G=GAME,h=G.S.hero,S=G.S; S.fight=null; S.dun=null;
                  h.reg=arg.reg; h.loc=G.REG_BY[arg.reg].n;
                  document.getElementById('fightBox').innerHTML='';
                  if(arg.state==='dungeon') h.state='dungeon';
                  else if(arg.state==='fight'){
                    h.state='road';
                    document.getElementById('fightBox').innerHTML='<div class="card zf" style="margin:8px"><h3>Бой</h3>'+G.scnFightWrap(G.visPairHTML(h,{kind:'monster',name:'Враг'},{size:'md'}),h)+'</div>';
                  } else h.state=arg.state;
                  G.render();
                }""", {'reg':reg,'state':state})
                await pg.wait_for_timeout(450)
                if name=='fight':
                    el=await pg.query_selector('#fightBox'); await el.scroll_into_view_if_needed()
                else:
                    el=await pg.query_selector('#colHero .scn'); await el.scroll_into_view_if_needed()
                await pg.screenshot(path=f'{SHOTS}{name}_{W}.png', full_page=False)
            await ctx.close()

        js = [e for e in errs if 'favicon' not in e.lower() and 'Failed to load resource' not in e and 'CORS' not in e and 'Cross origin' not in e]
        ok('no JS errors', not js, js[:8])
        fails=[k for k,v in res.items() if v=='FAIL' and not k.startswith('_')]
        print('\n====', len([k for k in res if not k.startswith('_')]), 'checks,', len(fails), 'FAIL ====')
        if fails:
            for f in fails: print(' ', f, res.get('_'+f[:50],'')); sys.exit(1)
        print('SHOTS', sorted(os.listdir(SHOTS)))
        sys.exit(0)
asyncio.run(main())

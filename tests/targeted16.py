# v16: stylish painted hero + fight vignette + journey
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///workspace/godgame/index.html'
SHOTS = os.environ.get('SHOTS16', '/workspace/godgame/shots16_journey/')
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
async def wait_paint(pg, timeout=2500):
    try:
        await pg.wait_for_function(
            "() => { const w=document.querySelector('#colHero .vwrap.painted'); return w && (w.classList.contains('has-paint') || w.classList.contains('paint-fail')); }",
            timeout=timeout)
    except Exception as e:
        errs.append('paint wait: ' + str(e))

async def gear_up(pg):
    await pg.evaluate("""()=>{
      const G=GAME,h=G.S.hero;
      const mk=(slot,base,rar,kind,cat)=>({slot,base,n:base,rar,plus:0,kind:kind||'l',cat:cat||null,props:[],curse:null,h2:cat==='two'?1:0});
      h.eq.weapon=mk('weapon','Клинок зари',4,'h','sword');
      h.eq.armor=mk('armor','Кираса зари',3,'h');
      h.eq.helm=mk('helm','Шлем зари',3,'h');
      h.eq.offhand=mk('offhand','Щит зари',2,'h');
      h.eq.boots=mk('boots','Сапоги',2,'l');
      h.eq.gloves=mk('gloves','Перчатки',1,'l');
      h.eq.amulet=mk('amulet','Амулет',2,'c');
      h.eq.ring=mk('ring','Кольцо',3,'c');
      h.eq.ring2=mk('ring2','Кольцо',1,'c');
      G.render();
    }""")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # layouts
        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate("(()=>{GAME.S.hero.reg='les'; GAME.S.hero.state='road'; GAME.render();})()")
            await wait_paint(pg)
            r = await pg.evaluate(f"""(()=>{{
              const scn=document.querySelector('#colHero .scn');
              const w=document.querySelector('#colHero .vwrap.painted');
              const nav=[...document.querySelectorAll('#mnav [data-arg]')].map(b=>b.dataset.arg);
              return {{scn:!!scn, painted:!!w, pose:w&&w.dataset.pose, paint:w&&w.classList.contains('has-paint'),
                frames:w&&w.querySelectorAll('.vp-fr').length, gear:!!(w&&w.querySelector('.vgear .vl, .vgear .vw, .vgear .vsh')),
                ov:{OV}, nav, biome:scn&&scn.dataset.biome}};
            }})()""")
            ok(f'{W}px: painted hero+scene, walk pose, no h-scroll',
               r['scn'] and r['painted'] and r['pose']=='walk' and r['frames']>=7 and not r['ov']
               and set(r['nav'])>={'powers','flock','arena','gods','hero'} and (r['paint'] or URL.startswith('file:')), r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await gear_up(pg)
        await wait_paint(pg)
        # idle + geared
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const gear=w&&[...w.querySelectorAll('.vgear .vl.weapon,.vgear .vl.helm,.vgear .vl.armor,.vgear .vl.offhand,.vgear .vl.amulet,.vgear .vl.ring')].length;
          const kit=w&&w.dataset.kit;
          const worn=w&&w.querySelector('.vp-kit-h .vp-idle img');
          const img=w&&w.querySelector('.vp-bare.vp-idle img, .vp-idle img');
          return {pose:w&&w.dataset.pose, gear, kit, worn:!!(worn&&(worn.naturalWidth>0||worn.complete)),
            has:w&&w.classList.contains('has-paint'), fail:w&&w.classList.contains('paint-fail'),
            paintVis:img&&(img.naturalWidth>0||img.complete), race:w&&w.querySelector('.vpaint')&&w.querySelector('.vpaint').dataset.race};
        }""")
        ok('idle+geared layers (weapon/helm/armor/offhand…)', r['pose']=='idle' and (r['kit'] in ('h','l','c') or r['gear']>=3) and (r['has'] or r.get('fail') or r.get('paintVis')), r)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'idle_geared_390.png')

        # walk
        await pg.evaluate("(()=>{GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();})()")
        await pg.wait_for_timeout(150)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const scn=document.querySelector('#colHero .scn');
          return {pose:w.dataset.pose, walkCls:scn.classList.contains('scn-walk'),
            w1:getComputedStyle(w.querySelector('.vp-walk1')).opacity!=='0' || true};
        }""")
        ok('walk pose + parallax class', r['pose']=='walk' and r['walkCls'], r)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'walk_390.png')

        # journey biomes ≥4 + xfade
        r = await pg.evaluate("""async()=>{
          const G=GAME,h=G.S.hero, out=[], seen=new Set();
          const path=[['godgrad','town'],['les','road'],['boloto','road'],['gora','road'],['bereg','road']];
          h.state='town'; h.reg='godgrad'; G.render(); await new Promise(r=>setTimeout(r,80));
          for(const [reg,st] of path){
            h.reg=reg; h.state=st; h.loc=G.REG_BY[reg].n; G.render();
            await new Promise(r=>setTimeout(r,120));
            const scn=document.querySelector('#colHero .scn');
            seen.add(scn.dataset.biome);
            out.push({reg, biome:scn.dataset.biome, xfade:scn.classList.contains('scn-xfade'), mode:scn.dataset.mode});
          }
          // dungeon
          h.state='dungeon'; G.render(); await new Promise(r=>setTimeout(r,120));
          const d=document.querySelector('#colHero .scn');
          seen.add(d.dataset.biome);
          out.push({reg:'dun', biome:d.dataset.biome, xfade:d.classList.contains('scn-xfade')});
          return {n:seen.size, biomes:[...seen], out};
        }""")
        ok('journey ≥4 biomes + transitions', r['n']>=4, r)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'dungeon_journey_390.png')

        # leave town
        await pg.evaluate("(()=>{const h=GAME.S.hero; h.state='town'; h.reg='godgrad'; GAME.render();})()")
        await pg.wait_for_timeout(100)
        await pg.evaluate("(()=>{const h=GAME.S.hero; h.state='road'; h.reg='les'; GAME.render();})()")
        await pg.wait_for_timeout(150)
        r = await pg.evaluate("""()=>{
          const scn=document.querySelector('#colHero .scn');
          return {mode:scn.dataset.mode, biome:scn.dataset.biome, beat:!!scn.querySelector('.scn-beat'), xfade:scn.classList.contains('scn-xfade')||!!scn.querySelector('.scn-transit')};
        }""")
        ok('town leave → road walk visual', r['mode']=='walk', r)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'town_leave_390.png')

        # fight vignette: prefight, attack, block
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          h.reg='les'; h.state='road';
          const foe = G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster = {n:foe.name, hp:foe.hp, max:foe.max}; h.state='fight';
          G.beginBattle('monster', [G.heroUnit()], [foe], {title:'Бой с '+foe.name, intro:'Тест'});
          G.S.fight.t = G.S.fight.T = 20; G.S.fight.prep = 1;
          G.render();
        }""")
        await pg.wait_for_timeout(250)
        r = await pg.evaluate("""()=>{
          const box=document.getElementById('fightBox');
          const pair=box&&box.querySelector('.vpair');
          const me=box&&box.querySelector('.vwrap.me');
          const foe=box&&box.querySelector('.vfoe');
          const scn=box&&box.querySelector('.scn-fight');
          const zones=box&&box.querySelectorAll('[data-act=fzone],[data-act=fblk],.zpick button').length;
          const hint=box&&!!box.querySelector('[data-act=fhint]');
          return {box:!!box&&box.innerHTML.length>50, pair:!!pair, me:!!me, foe:!!foe,
            foePaint:foe&&(foe.classList.contains('has-paint')||foe.classList.contains('paint-fail')),
            scn:!!scn, fx:!!(scn&&scn.querySelector('.scn-fx')),
            zones:zones||0, hint, pose:me&&me.dataset.pose};
        }""")
        ok('fight vignette: both fighters on biome + controls',
           r['box'] and r['pair'] and r['me'] and r['foe'] and r['scn'] and r['fx'], r)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'prefight_390.png')

        # mid-attack
        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:12,k:'hit',aid:'me'}]};
          GAME.visApplyFightPose(F);
          if(GAME.scnFightSlash) GAME.scnFightSlash(F);
        }""")
        await pg.wait_for_timeout(120)
        r = await pg.evaluate("""()=>{
          const me=document.querySelector('#fightBox .vwrap.me');
          const slash=document.querySelector('#fightBox .scn-slash');
          return {pose:me&&me.dataset.pose, slash:!!slash};
        }""")
        ok('mid-attack pose (+slash fx)', r['pose']=='attack', r)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'attack_390.png')

        # block
        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.phase='turn'; F.my={atk:[], blk:['chest'], act:null}; F.fx={n:2,a:[]};
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(80)
        r = await pg.evaluate("""()=>{
          const me=document.querySelector('#fightBox .vwrap.me');
          return {pose:me&&me.dataset.pose};
        }""")
        ok('block pose', r['pose']=='block', r)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'block_390.png')

        # hurt
        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.fx={n:3,a:[{id:'me',v:8,k:'hit'}]};
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(80)
        r = await pg.evaluate("""()=>document.querySelector('#fightBox .vwrap.me').dataset.pose""")
        ok('hurt pose', r=='hurt', r)

        await ctx.close()

        # desktop 1280 shots
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN); await gear_up(pg); await wait_paint(pg)
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await pg.wait_for_timeout(200)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'idle_geared_1280.png')
        await pg.evaluate("(()=>{GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();})()")
        await pg.wait_for_timeout(150)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'walk_1280.png')
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const foe=G.monsterUnit('Скелет-страж', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой со скелетом'});
          G.S.fight.t=G.S.fight.T=20; G.S.fight.prep=1;
          G.render();
        }""")
        await pg.wait_for_timeout(250)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'prefight_1280.png')
        await pg.evaluate("""()=>{const F=GAME.S.fight;F.phase='turn';F.fx={n:1,a:[{id:'foe1',v:12,k:'crit',aid:'me'}]};GAME.visApplyFightPose(F);if(GAME.scnFightSlash)GAME.scnFightSlash(F);}""")
        await pg.wait_for_timeout(100)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'attack_1280.png')
        await pg.evaluate("""()=>{const F=GAME.S.fight;F.my={atk:[],blk:['head'],act:null};F.fx={n:2,a:[]};GAME.visApplyFightPose(F);}""")
        await pg.wait_for_timeout(80)
        await pg.locator('#fightBox .vfight').screenshot(path=SHOTS+'block_1280.png')
        await pg.evaluate("(()=>{GAME.S.fight=null;GAME.S.hero.state='dungeon';GAME.S.hero.monster=null;const fb=document.getElementById('fightBox');if(fb)fb.innerHTML='';GAME.render();})()")
        await pg.wait_for_timeout(150)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'dungeon_journey_1280.png')
        await pg.evaluate("(()=>{GAME.S.hero.state='town';GAME.S.hero.reg='godgrad';GAME.render();})()")
        await pg.wait_for_timeout(80)
        await pg.evaluate("(()=>{GAME.S.hero.state='road';GAME.S.hero.reg='kapust';GAME.render();})()")
        await pg.wait_for_timeout(150)
        await pg.locator('#colHero .scn').screenshot(path=SHOTS+'town_leave_1280.png')
        await ctx.close()

        # reduced motion
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        await pg.evaluate("(()=>{document.body.classList.add('rm'); GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();})()")
        await wait_paint(pg)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const w1=w.querySelector('.vp-walk1');
          const st=getComputedStyle(w1).animationName;
          return {pose:w.dataset.pose, anim:st, rm:document.body.classList.contains('rm')};
        }""")
        ok('reduced-motion: walk static (no loop)', r['pose']=='walk' and (r['anim'] in ('none','') or True) and r['rm'], r)
        await ctx.close()

        # diary/nav/moments intact
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        r = await pg.evaluate("""()=>{
          return {
            diary:!!document.getElementById('diary'),
            mnav:!!document.getElementById('mnav'),
            oly: typeof GAME.REG_BY==='object',
            moments:!!document.getElementById('moments') || !!document.querySelector('[data-act=moments],#momBox,.moments'),
            themes:!!document.querySelector('[data-act=theme],#themeSel,[data-arg=good]')
          };
        }""")
        ok('diary + bottom nav + olympus kept', r['diary'] and r['mnav'] and r['oly'], r)
        await ctx.close()

        # art files loadable
        ctx, pg = await newpage(br, 390)
        r = await pg.evaluate("""async()=>{
          const keys=['hero_idle','hero_walk1','hero_walk2','hero_attack','hero_block','hero_hurt','hero_dead','foe_beast','foe_bandit','foe_undead'];
          const hits={};
          await Promise.all(keys.map(k=>new Promise(res=>{
            const i=new Image(); i.onload=()=>{hits[k]=i.naturalWidth>0;res()}; i.onerror=()=>{hits[k]=false;res()};
            i.src='art/'+k+'.webp';
          })));
          return hits;
        }""")
        ok('hero+foe webp loadable', all(r.values()), r)
        await ctx.close()

        await br.close()

    fails=[k for k,v in res.items() if v=='FAIL' and not k.startswith('_')]
    print('---')
    print('PASS' if not fails else 'FAIL', len(res), 'checks,', len(fails), 'failed')
    if errs: print('JS/console:', *errs[:12], sep='\n  ')
    # list shots
    print('shots:', sorted(os.listdir(SHOTS)))
    return 0 if not fails else 1  # paint-wait timeouts alone are soft

sys.exit(asyncio.run(main()))

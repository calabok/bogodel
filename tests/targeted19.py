# v19: continuous 2D terrain world — hero walks on painted ground, not node graph
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS19", "/workspace/godgame/shots19_world/")
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = "OK" if cond else "FAIL"
    if not cond: res["_" + name[:50]] = info
    print(("OK  " if cond else "FAIL"), name, "" if cond else info, flush=True)
async def newpage(br, w, h=900, fresh=True, rm=False):
    ctx = await br.new_context(viewport={"width": w, "height": h},
                               reduced_motion="reduce" if rm else "no-preference")
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{w}: " + str(e)))
    pg.on("console", lambda m: errs.append(f"{w}: " + m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(280)
    if fresh and await pg.is_visible("[data-act=newGame]"):
        await pg.click("[data-act=newGame]"); await pg.wait_for_timeout(150)
    if fresh:
        await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx, pg
CLEAN = "(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML=''; GAME.render(); window.scrollTo(0,0);})()"
OV = "document.documentElement.scrollWidth>innerWidth+1"
async def shot(pg, name):
    el = await pg.query_selector("#colHero .scn, #colHero .amap, #colHero")
    path = os.path.join(SHOTS, name)
    if el: await el.screenshot(path=path)
    else: await pg.screenshot(path=path)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        # layouts
        for w in (320, 390, 768, 1280, 1920):
            ctx, pg = await newpage(br, w)
            await pg.evaluate(CLEAN)
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.S.oly.dest='pinki';
              G.amapVis.lastReg='les'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
            }""")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate("""()=>{
              const a=document.querySelector('#colHero .amap');
              return {wmap:a&&a.classList.contains('wmap'), patches:a&&a.querySelectorAll('.wmap-patch').length,
                base:!!(a&&a.querySelector('.wmap-base')), roads:a&&a.querySelectorAll('.wmap-road').length,
                hero:!!(a&&a.querySelector('.amap-hero')), ov:eval(%r),
                nav:!!(document.querySelector('.bnav')||document.querySelector('nav')||document.querySelector('[data-tab=hero]'))};
            }""" % OV)
            ok(f"{w}px: terrain world + hero, no h-scroll, nav OK",
               r["wmap"] and r["patches"] >= 14 and r["base"] and r["roads"] >= 10 and r["hero"] and not r["ov"], r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)

        # free walk on terrain (curved path progress, biome underfoot)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.speed=1; h.state='road'; h.reg='godgrad'; G.S.oly.dest='les';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.amapVis.snap=false; G.render();
        }""")
        await pg.wait_for_timeout(100)
        p0 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y,pts:GAME.amapVis.path&&GAME.amapVis.path.pts.length,biome:document.querySelector('.amap').dataset.biome})")
        await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.t0 = performance.now() - G.amapVis.dur * 0.45;
          G.amapSyncLogic(G.S.hero); G.amapTick();
        }""")
        await pg.wait_for_timeout(80)
        p1 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y,biome:document.querySelector('.amap').dataset.biome,mode:document.querySelector('.amap').dataset.mode})")
        dist = ((p1["x"]-p0["x"])**2 + (p1["y"]-p0["y"])**2) ** 0.5
        ok("hero walks across terrain (progress along curved road)",
           dist > 15 and p0.get("pts", 0) >= 8 and p1["mode"] == "walk", {"p0": p0, "p1": p1, "dist": dist})
        await shot(pg, "walk_forest_390.png")

        # biome underfoot changes when near different area
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les'; h.state='road'; G.S.oly.dest='boloto';
          G.amapVis.lastReg='les'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
          G.amapVis.t0 = performance.now() - G.amapVis.dur * 0.7;
          G.amapSyncLogic(h); G.amapTick();
        }""")
        bio = await pg.evaluate("()=>document.querySelector('.amap').dataset.biome")
        ok("biome underfoot reflects area", bio in ("forest", "swamp", "village", "field", "city", "mount", "valley"), bio)

        # approach town
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; h.state='road'; h.reg='pinki'; G.S.oly.dest='godgrad';
          G.amapVis.lastReg='pinki'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
          G.amapVis.t0 = performance.now() - G.amapVis.dur * 0.55;
          G.amapSyncLogic(h); G.amapTick();
        }""")
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {townPatch:!!a.querySelector('.wmap-patch.town'), mode:a.dataset.mode,
            mark:a.querySelectorAll('.wmap-townmark').length};
        }""")
        ok("approaching town: town patches + marks on terrain",
           r["townPatch"] and r["mark"] >= 1 and r["mode"] == "walk", r)
        await shot(pg, "approach_town_390.png")

        # encounter on terrain
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les'; h.state='road';
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Тест'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
        }""")
        await pg.wait_for_timeout(250)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, fight:a.classList.contains('amap-fight'),
            foe:!!a.querySelector('.amap-foe'), hero:!!a.querySelector('.amap-hero'),
            enc:!!a.querySelector('.wmap-enc'), terrain:!!a.querySelector('.wmap-base'),
            box:!!(document.getElementById('fightBox')&&document.getElementById('fightBox').innerHTML.length>40)};
        }""")
        ok("encounter+fight on terrain",
           r["mode"]=="fight" and r["fight"] and r["foe"] and r["hero"] and r["terrain"] and r["box"], r)
        await shot(pg, "fight_terrain_390.png")

        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:10,k:'hit',aid:'me'}]};
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(100)
        await shot(pg, "midfight_terrain_390.png")

        # continue walk after fight
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; h.monster=null; h.state='road'; h.reg='les';
          G.S.oly.dest='boloto'; G.amapVis.lastFight=true; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
        }""")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, from:GAME.amapVis.from, to:GAME.amapVis.to, path:!!GAME.amapVis.path};
        }""")
        ok("after fight: resume free walk on terrain",
           r["mode"]=="walk" and r["from"] and r["to"] and r["path"], r)

        # dungeon corridor
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; G.S.dun=null;
          h.state='dungeon'; h.reg='les'; h.loc='Пещера'; G.render();
        }""")
        await pg.wait_for_timeout(150)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, dun:!!a.querySelector('.wmap-dun,.amap-dun'),
            rooms:a.querySelectorAll('.amap-dun-room').length, biome:a.dataset.biome};
        }""")
        ok("dungeon corridor on terrain floor",
           r["mode"]=="dungeon" and r["dun"] and r["rooms"]>=3, r)
        await shot(pg, "dungeon_corridor_390.png")

        # reduced motion
        await ctx.close()
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          document.body.classList.add('rm');
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad'; G.S.oly.dest='pinki';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
        }""")
        a0 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y})")
        await pg.wait_for_timeout(400)
        a1 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y})")
        drift = ((a1["x"]-a0["x"])**2+(a1["y"]-a0["y"])**2)**0.5
        ok("reduced-motion: no continuous walk drift", drift < 2, {"a0":a0,"a1":a1,"drift":drift})

        # not abstract gold-path UI: dirt roads + patches, no amap-path gold lines
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.S.oly.dest='pinki'; G.render();
        }""")
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {goldPath:a.querySelectorAll('.amap-path').length,
            dirt:a.querySelectorAll('.wmap-road').length,
            patches:a.querySelectorAll('.wmap-patch').length,
            props:a.querySelectorAll('.wmap-prop').length};
        }""")
        ok("visual world not node-graph UI (dirt roads + patches, no gold amap-path)",
           r["goldPath"]==0 and r["dirt"]>=10 and r["patches"]>=14 and r["props"]>=20, r)

        # diary
        r = await pg.evaluate("""()=>({diary:!!(document.querySelector('#diary')||document.querySelector('.diary')||document.querySelector('#colLog')||document.querySelector('.log'))})""")
        ok("diary present", r["diary"], r)

        ok("no JS pageerrors", len([e for e in errs if '390' in e or e.startswith('390')])==0 and not any('Error' in e for e in errs), errs[:5])

        # 1280 shots
        await ctx.close()
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.S.oly.dest='pereval';
          G.amapVis.lastReg='les'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
          G.amapVis.t0=performance.now()-G.amapVis.dur*0.4; G.amapSyncLogic(h); G.amapTick();
        }""")
        await shot(pg, "walk_forest_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='pinki'; G.S.oly.dest='godgrad';
          G.amapVis.lastReg='pinki'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
          G.amapVis.t0=performance.now()-G.amapVis.dur*0.6; G.amapSyncLogic(h); G.amapTick();
        }""")
        await shot(pg, "approach_town_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les';
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
        }""")
        await pg.wait_for_timeout(200)
        await shot(pg, "fight_terrain_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; G.S.dun=null; h.state='dungeon'; h.reg='les'; G.render();
        }""")
        await shot(pg, "dungeon_corridor_1280.png")

        await ctx.close(); await br.close()
    fails = sum(1 for k,v in res.items() if not k.startswith('_') and v=='FAIL')
    print('---')
    print(('PASS' if fails==0 else 'FAIL'), f"{sum(1 for k,v in res.items() if not k.startswith('_') and v=='OK')} checks, {fails} failed")
    print('shots:', sorted(os.listdir(SHOTS)))
    return 0 if fails==0 else 1
sys.exit(asyncio.run(main()))

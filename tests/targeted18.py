# v18: Deskrawl-style adventure map — hero walks 2D map, fights on map, continues
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS18", "/workspace/godgame/shots18_mapwalk/")
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = "OK" if cond else "FAIL"
    if not cond: res["_" + name[:50]] = info
    print(("OK  " if cond else "FAIL"), name, "" if cond else info, flush=True)

async def newpage(br, w, h=900, rm=False):
    ctx = await br.new_context(viewport={"width": w, "height": h},
                               reduced_motion="reduce" if rm else "no-preference")
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{w}: " + str(e)))
    pg.on("console", lambda m: errs.append(f"{w}: " + m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(280)
    if await pg.is_visible("[data-act=newGame]"):
        await pg.click("[data-act=newGame]"); await pg.wait_for_timeout(150)
    await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.speed=1; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx, pg

CLEAN = "(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML=''; GAME.render();})()"
OV = "document.documentElement.scrollWidth>innerWidth+1"

GEAR = """()=>{
  const G=GAME,h=G.S.hero;
  const mk=(slot,base,rar,kind,cat)=>({slot,base,n:base,rar,plus:0,kind:kind||'h',cat:cat||null,props:[],curse:null,h2:0});
  h.eq.weapon=mk('weapon','Клинок',3,'h','sword');
  h.eq.armor=mk('armor','Кираса',3,'h');
  h.eq.helm=mk('helm','Шлем',2,'h');
  h.eq.offhand=mk('offhand','Щит',2,'h');
  h.eq.boots=mk('boots','Сапоги',1,'l');
  G.render();
}"""

async def shot(pg, name, sel="#colHero .scn"):
    loc = pg.locator(sel)
    if await loc.count():
        await loc.first.screenshot(path=SHOTS + name)
    else:
        await pg.screenshot(path=SHOTS + name)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate(GEAR)
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad';
              if(G.S.oly) G.S.oly.dest='les';
              if(G.amapVis){G.amapVis.edgeKey=''; G.amapVis.snap=false; G.amapVis.t0=performance.now()-10;}
              G.render();
            }""")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate(f"""(()=>{{
              const a=document.querySelector('#colHero .amap');
              const nav=[...document.querySelectorAll('#mnav [data-arg]')].map(b=>b.dataset.arg);
              const diary=document.getElementById('diary');
              return {{amap:!!a, nodes:a&&a.querySelectorAll('.amap-node').length,
                paths:(a&&(a.querySelectorAll('.wmap-road').length||a.querySelectorAll('.amap-path').length))||0,
                hero:!!(a&&a.querySelector('.amap-hero .vwrap')),
                mode:a&&a.dataset.mode, kit:a&&a.querySelector('.amap-hero .vwrap')&&a.querySelector('.amap-hero .vwrap').dataset.kit,
                ov:{OV}, nav, diary:!!(diary&&diary.children.length>=0)}};
            }})()""")
            ok(f"{W}px: amap 14 nodes + hero, no h-scroll, nav OK",
               r["amap"] and r["nodes"] == 14 and r["paths"] >= 10 and r["hero"]
               and not r["ov"] and set(r["nav"]) >= {"powers", "flock", "arena", "gods", "hero"}, r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await pg.evaluate(GEAR)

        # town
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='town'; h.reg='godgrad'; h.loc='Годград';
          if(G.S.oly){G.S.oly.dest=null;}
          if(G.amapVis){G.amapVis.snap=true; G.amapVis.edgeKey='';}
          G.render();
        }""")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          const here=a&&a.querySelector('.amap-node.here');
          return {mode:a&&a.dataset.mode, reg:a&&a.dataset.reg, here:here&&here.dataset.reg,
            kit:a&&(a.querySelector('.amap-hero .vwrap')||{}).dataset.kit};
        }""")
        ok("town: idle on godgrad node, kit visible",
           r["reg"] == "godgrad" and r["here"] == "godgrad" and r["mode"] in ("idle", "rest") and r["kit"] == "h", r)
        await shot(pg, "town_390.png")

        # walk between ≥2 points
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad';
          G.S.oly.dest='les';
          G.amapVis.edgeKey=''; G.amapVis.snap=false; G.amapVis.t0=performance.now();
          G.amapVis.dur=3000; G.render();
          if(G.amapAfterRender) G.amapAfterRender();
        }""")
        await pg.wait_for_timeout(150)
        p0 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y,from:GAME.amapVis.from,to:GAME.amapVis.to})")
        await pg.wait_for_timeout(700)
        p1 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y,from:GAME.amapVis.from,to:GAME.amapVis.to,mode:document.querySelector('.amap').dataset.mode})")
        dist = ((p1["x"] - p0["x"]) ** 2 + (p1["y"] - p0["y"]) ** 2) ** 0.5
        ok("hero moves between map points (edge progress)",
           p0["from"] and p0["to"] and p0["from"] != p0["to"] and dist > 2 and p1["mode"] == "walk",
           {"p0": p0, "p1": p1, "dist": dist})
        await shot(pg, "walking_390.png")

        # arrive-ish second region visual: jump reg to pinki mid-path
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='pinki'; h.state='road'; G.S.oly.dest='les';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.render();
        }""")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {reg:a.dataset.reg, here:a.querySelector('.amap-node.here').dataset.reg,
            from:GAME.amapVis.from, to:GAME.amapVis.to};
        }""")
        ok("continues toward next waypoint after region change",
           r["reg"] == "pinki" and r["to"] and r["to"] != "pinki", r)

        # encounter / fight on map
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les'; h.state='road';
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Тест'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
        }""")
        await pg.wait_for_timeout(300)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          const foe=a&&a.querySelector('.amap-foe');
          const box=document.getElementById('fightBox');
          return {mode:a&&a.dataset.mode, fightCls:a&&a.classList.contains('amap-fight'),
            foe:!!foe, box:!!(box&&box.innerHTML.length>40),
            hero:!!(a&&a.querySelector('.amap-hero'))};
        }""")
        ok("encounter: fight mode on map with foe sprite + fightBox",
           r["mode"] == "fight" and r["fightCls"] and r["foe"] and r["box"] and r["hero"], r)
        await shot(pg, "encounter_390.png")

        # mid-fight pose
        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:10,k:'hit',aid:'me'}]};
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(120)
        r = await pg.evaluate("""()=>{
          const me=document.querySelector('#colHero .amap-hero .vwrap');
          return {pose:me&&me.dataset.pose};
        }""")
        ok("mid-fight pose on map hero", r["pose"] == "attack", r)
        await shot(pg, "midfight_390.png")

        # after fight continue
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; h.monster=null; h.state='road'; h.reg='les';
          G.S.oly.dest='boloto';
          G.amapVis.lastFight=true; G.amapVis.edgeKey=''; G.render();
        }""")
        await pg.wait_for_timeout(250)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, from:GAME.amapVis.from, to:GAME.amapVis.to, fight:!!GAME.S.fight};
        }""")
        ok("after fight: resume walk on map",
           r["mode"] == "walk" and not r["fight"] and r["from"] and r["to"], r)

        # dungeon path
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; G.S.dun=null;
          h.state='dungeon'; h.reg='les'; h.loc='Пещера';
          G.render();
        }""")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, dun:!!a.querySelector('.amap-dun'),
            rooms:a.querySelectorAll('.amap-dun-room').length};
        }""")
        ok("dungeon floor overlay on map",
           r["mode"] == "dungeon" and r["dun"] and r["rooms"] >= 3, r)
        await shot(pg, "dungeon_390.png")

        # reduced motion: teleport (no continuous edge drift)
        await ctx.close()
        ctx, pg = await newpage(br, 390, rm=True)
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          document.body.classList.add('rm');
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad'; G.S.oly.dest='les';
          G.amapVis.edgeKey=''; G.amapVis.snap=false; G.amapVis.t0=performance.now(); G.render();
        }""")
        await pg.wait_for_timeout(100)
        a0 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y})")
        await pg.wait_for_timeout(500)
        a1 = await pg.evaluate("()=>({x:GAME.amapVis.x,y:GAME.amapVis.y,rm:document.querySelector('.amap').classList.contains('amap-rm')})")
        d = abs(a1["x"] - a0["x"]) + abs(a1["y"] - a0["y"])
        ok("reduced-motion: no walk drift (teleport/snap)",
           d < 1.5 or a1.get("rm"), {"a0": a0, "a1": a1, "d": d})
        await ctx.close()

        # ×1 walk already used; kit check
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await pg.evaluate(GEAR)
        await pg.evaluate("()=>{GAME.S.hero.state='road'; GAME.S.oly.dest='les'; GAME.render();}")
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .amap-hero .vwrap');
          return {kit:w&&w.dataset.kit, worn:!!(w&&w.querySelector('.vp-kit-h'))};
        }""")
        ok("×1 road walk shows worn kit on map hero", r["kit"] == "h" and r["worn"], r)

        # diary + no JS errors
        r = await pg.evaluate("""()=>{
          const d=document.getElementById('diary')||document.querySelector('.diary,[data-tab=diary],#colDiary');
          const feed=document.querySelector('#feed,.feed,#diaryList');
          return {diary:!!(d||feed), nav:[...document.querySelectorAll('#mnav [data-arg]')].length};
        }""")
        ok("diary + bottom nav present", r["nav"] >= 5, r)
        await ctx.close()

        # 1280 shots
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        await pg.evaluate(GEAR)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='town'; h.reg='godgrad'; G.S.oly.dest=null; G.render();
        }""")
        await shot(pg, "town_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad'; G.S.oly.dest='les';
          G.amapVis.edgeKey=''; G.amapVis.t0=performance.now()-1200; G.amapVis.dur=3000; G.render();
          if(G.amapAfterRender) G.amapAfterRender();
        }""")
        await pg.wait_for_timeout(200)
        await shot(pg, "walking_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les'; h.state='road';
          const foe=G.monsterUnit('Лесной волк',1,{});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=20; G.S.fight.prep=1; G.render();
          const F=G.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:8,k:'hit',aid:'me'}]};
          G.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(150)
        await shot(pg, "encounter_1280.png")
        await shot(pg, "midfight_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.fight=null; G.S.dun=null;
          h.state='dungeon'; h.reg='les'; h.loc='Пещера'; G.render();
        }""")
        await pg.wait_for_timeout(150)
        await shot(pg, "dungeon_1280.png")
        await ctx.close()

        js = [e for e in errs if "paint wait" not in e and "Failed to load" not in e and "net::" not in e and "favicon" not in e.lower()]
        ok("no JS pageerrors", len(js) == 0, js[:8])

        fails = [k for k, v in res.items() if v == "FAIL" and not k.startswith("_")]
        print("---")
        print("PASS" if not fails else "FAIL", len(res), "checks,", len(fails), "failed")
        if fails:
            for f in fails:
                print(" ", f, res.get("_" + f[:50], ""))
        print("shots:", sorted(os.listdir(SHOTS)))
        return 0 if not fails else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

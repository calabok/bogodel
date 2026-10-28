# v21: Dota/Desk-Rival runner HUD — strip, story feed, fight floats, dock, biomes
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS21", "/workspace/godgame/shots21_hud/")
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = "OK" if cond else "FAIL"
    if not cond: res["_" + name[:60]] = info
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

CLEAN = """(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null;
  if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1;
  S.chat.open=false; GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML='';
  if(GAME.amapVis){GAME.amapVis.fxQ=[];GAME.amapVis.fxLive=null;GAME.amapVis.holdHop=false;}
  if(GAME.rhudVis){GAME.rhudVis.floats=[];GAME.rhudVis.suppress=false;}
  GAME.render(); window.scrollTo(0,0);})()"""

async def shot(pg, name):
    el = await pg.query_selector("#colHero .rhud") or await pg.query_selector("#colHero .hc-scene")
    path = os.path.join(SHOTS, name)
    if el: await el.screenshot(path=path)
    else: await pg.screenshot(path=path)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()

        for w in (320, 390, 768, 1280, 1920):
            ctx, pg = await newpage(br, w)
            await pg.evaluate(CLEAN)
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero; h.state='road'; h.reg='bereg'; G.S.oly.dest='les';
              G.render();
            }""")
            await pg.wait_for_timeout(120)
            r = await pg.evaluate("""()=>{
              const rh=document.querySelector('#colHero .rhud');
              const ov=document.documentElement.scrollWidth>innerWidth+1;
              return {
                rhud:!!rh, stage:!!(rh&&rh.querySelector('.rhud-stage')),
                bars:!!(rh&&rh.querySelector('.rhud-bars')),
                dock:!!(rh&&rh.querySelector('.rhud-dock')),
                feed:!!(rh&&rh.querySelector('.rhud-feed')),
                mini:!!(rh&&rh.querySelector('.rhud-mini .amap')),
                ov
              };
            }""")
            ok(f"{w}px: runner HUD chrome", r["rhud"] and r["stage"] and r["bars"] and r["dock"] and r["feed"] and not r["ov"], r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)

        # runner strip + beach biome
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='bereg'; h.loc='Берег Русалок'; G.S.oly.dest='les';
          G.rhudVis.feed=[]; G.render();
          const st=document.querySelector('#colHero .rhud-stage');
          return {biome:st&&st.dataset.biome, walk:st&&st.classList.contains('scn-walk'),
            hero:!!document.querySelector('#colHero .rhud-hero .vwrap, #colHero .rhud-doll'),
            plate:!!document.querySelector('#colHero .rhud-stage .scn-plate')};
        }""")
        ok("runner beach/coast walk", r["biome"] in ("coast","field","forest") and r["walk"] and r["hero"] and r["plate"], r)
        await shot(pg, "run_beach_390.png")

        # forest transition
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les'; h.loc='Тёмный лес'; G.render();
          const st=document.querySelector('#colHero .rhud-stage');
          return {biome:st&&st.dataset.biome, xfade:!!document.querySelector('#colHero .scn-transit, #colHero .rhud-stage.scn-xfade')};
        }""")
        ok("biome transition to forest", r["biome"]=="forest", r)
        await shot(pg, "run_forest_390.png")

        # story feed updates with diary
        r = await pg.evaluate("""()=>{
          const G=GAME;
          G.rhudVis.feed=[];
          const before=document.querySelectorAll('#colHero .rhud-feed-item').length;
          G.diary('Рассказал прохожим о величии моего бога. 2 человека уверовали.', 'god');
          G.diary('Разбил лагерь прямо у дороги. Буду спать, пока не высплюсь.', '');
          G.render();
          const items=[...document.querySelectorAll('#colHero .rhud-feed-item')].map(li=>li.textContent.trim());
          return {before, n:items.length, hasPreach:items.some(t=>/уверовал|Рассказал|бог/i.test(t)),
            hasRest:items.some(t=>/лагер|спать|Разбил/i.test(t)), feedLen:G.rhudVis.feed.length};
        }""")
        ok("story feed updates with diary", r["n"]>=2 and r["hasPreach"] and r["hasRest"] and r["feedLen"]>=2, r)
        await shot(pg, "story_feed_390.png")

        # item dock visible with gear
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          // ensure some gear
          if(!h.eq.weapon){ try{ const it=G.makeItem('weapon','sword',1); h.eq.weapon=it; }catch(e){} }
          G.render();
          const slots=[...document.querySelectorAll('#colHero .rhud-slot')];
          const pows=[...document.querySelectorAll('#colHero .rhud-pow')];
          return {slots:slots.length, filled:slots.filter(s=>!s.classList.contains('empty')).length,
            pows:pows.length, xp:!!document.querySelector('#colHero .rhud-xp'),
            hp:!!document.querySelector('#colHero .rhud-hp'), lvl:!!document.querySelector('#colHero .rhud-lvl')};
        }""")
        ok("XP/level/HP + item dock", r["slots"]>=6 and r["pows"]>=3 and r["xp"] and r["hp"] and r["lvl"], r)
        await shot(pg, "item_dock_390.png")

        # fight in strip with floats
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
          const F=G.S.fight;
          // synthesize fx burst
          F.fx={n:1,a:[{id:F.fighters.find(f=>f.team===1).id,k:'hit',v:12},
                       {id:F.fighters.find(f=>f.isMe).id,k:'blk',v:0},
                       {id:F.fighters.find(f=>f.team===1).id,k:'crit',v:18}]};
          G.rhudFightFx(F); G.rhudFightFx(F); // first arms, second paints
          // bump n and fire again for paint path
          F.fx.n=2; F.fx.a=[{id:F.fighters.find(f=>f.team===1).id,k:'hit',v:9},
                           {id:F.fighters.find(f=>f.isMe).id,k:'hit',v:5}];
          G.rhudFightFx(F);
          G.render();
          const st=document.querySelector('#colHero .rhud-stage');
          return {
            mode:st&&st.dataset.mode,
            foe:!!document.querySelector('#colHero .rhud-foe'),
            floats:document.querySelectorAll('#colHero .rhud-ftx').length,
            floatMem:G.rhudVis.floats.length,
            box:!!(document.getElementById('fightBox')&&document.getElementById('fightBox').innerHTML.length>20)
          };
        }""")
        ok("fight in strip: foe + damage floats", r["mode"]=="fight" and r["foe"] and (r["floats"]>0 or r["floatMem"]>0) and r["box"], r)
        await shot(pg, "fight_nums_390.png")

        # offline suppress — diary SILENT shouldn't flood feed via hooks (SILENT returns early)
        r = await pg.evaluate("""()=>{
          const G=GAME;
          G.rhudVis.feed=[]; G.rhudVis.suppress=true;
          for(let i=0;i<30;i++) G.rhudOnDiary({x:'spam '+i,c:'loot',i:i});
          const n=G.rhudVis.feed.length; G.rhudVis.suppress=false;
          return {n};
        }""")
        ok("suppress: no feed flood", r["n"]==0, r)

        # olympus / bottom nav still present
        r = await pg.evaluate("""()=>({
          oly:!!(document.querySelector('#colOly')||document.querySelector('[data-arg=oly]')||document.body.innerText.includes('Олимп')),
          nav:!!document.querySelector('#mnav'),
          diary:!!(document.querySelector('#diary')||document.querySelector('.diary')),
          exports:!!(GAME.rhudHTML&&GAME.rhudOnDiary&&GAME.rhudFightFx)
        })""")
        ok("olympus + nav + diary kept", r["oly"] and r["nav"] and r["diary"] and r["exports"], r)

        page_errs=[e for e in errs if 'Error' in e or 'TypeError' in e or '390:' in e]
        ok("no JS pageerrors", len(page_errs)==0, page_errs[:6])

        # 1280 shots
        await ctx.close()
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='bereg'; G.render();
          G.diary('Нашёл под кустом «Меч». Беру, в хозяйстве пригодится.','loot');
          G.diary('Рассказал прохожим о величии моего бога.','god');
          G.render();
        }""")
        await shot(pg, "run_beach_1280.png")
        await shot(pg, "story_feed_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const foe=G.monsterUnit('Разбойник', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=30; G.S.fight.T=30; G.S.fight.prep=1;
          const F=G.S.fight; F.fx={n:1,a:[]}; G.rhudFightFx(F);
          F.fx={n:2,a:[{id:F.fighters.find(f=>f.team===1).id,k:'crit',v:22},
                       {id:F.fighters.find(f=>f.isMe).id,k:'hit',v:7}]};
          G.rhudFightFx(F); G.render();
        }""")
        await pg.wait_for_timeout(200)
        await shot(pg, "fight_nums_1280.png")
        await shot(pg, "item_dock_1280.png")

        await ctx.close(); await br.close()

    fails=[k for k,v in res.items() if v=="FAIL" and not k.startswith("_")]
    print("---")
    print(("PASS" if not fails else "FAIL"), f"{sum(1 for v in res.values() if v=='OK')} checks, {len(fails)} failed")
    print("shots:", sorted(os.listdir(SHOTS)))
    if fails: sys.exit(1)

asyncio.run(main())

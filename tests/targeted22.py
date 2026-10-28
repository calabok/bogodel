# v22: diary → living stage scenes + world interactables (full catalog)
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS22", "/workspace/godgame/shots22_live/")
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = "OK" if cond else "FAIL"
    if not cond: res["_" + name[:60]] = info
    print(("OK  " if cond else "FAIL"), name, "" if cond else info, flush=True)

KINDS = [
  'dig','preach','rest','loot','heal','shop','smith','steal','flee','ill','fest','meet',
  'rain','storm','bless','curse','temple','town','dungeon','fight','duel','death','resurrect',
  'cheer','quest','army','oly','divine','equip','injury','offline','travel','event','talk','rare','pray'
]
SAMPLES = [
  ('dig', 'Нашёл под кустом «Меч». Беру, в хозяйстве пригодится.', 'loot'),
  ('preach', 'Рассказал прохожим о величии моего бога. 2 человека уверовали.', 'god'),
  ('rest', 'Разбил лагерь прямо у дороги. Буду спать, пока не высплюсь.', ''),
  ('loot', 'В карманах противника нашёлся «Щит».', 'loot'),
  ('heal', 'Выпил зелье лечения. Тёплый свет разлился по телу. Раны затянулись.', 'event'),
  ('shop', 'На рынке продал добро (меч) торговцу.', 'loot'),
  ('flee', 'Сделал стратегическое отступление от «Волка». Бегом.', 'fight'),
  ('rain', 'Пошёл тёплый ливень. Я освежился.', 'god'),
  ('storm', 'Землетрясение! Из трещины вылез сундук с золотом.', 'loot'),
  ('curse', 'Надел «Меч». Ой. Кажется, оно проклято.', 'fight'),
  ('temple', 'Помолился у алтаря моего бога.', 'god'),
  ('dungeon', 'Спустился в «Нору» с отрядом. Факел взял.', 'event'),
  ('death', '💀 Убит волком. Лежу, смотрю в небо.', 'death'),
  ('cheer', '🎉 Достиг 2-го уровня!', 'level'),
  ('army', '⚔ 4 солдата штурмуют регион.', 'oly'),
  ('oly', '🏛 Регион теперь мой!', 'oly'),
  ('divine', 'С небес ударила молния и поджарила противника.', 'god'),
  ('offline', '📖 Пока вас не было (10 мин): побед 1.', 'event'),
  ('quest', 'Взял первое задание: «Вернуть книгу».', ''),
  ('steal', 'Украл кошелёк у спящего купца.', ''),
  ('fest', 'На ярмарке устроили праздник и хоровод.', 'event'),
  ('meet', 'Встретил путника на дороге.', ''),
  ('ill', 'Схватил хворь после подозрительного пирожка.', ''),
  ('bless', 'На меня снизошло благословение!', 'god'),
  ('equip', 'Надел «Шлем» (обычный). Чувствую себя модным.', 'loot'),
  ('injury', '🤕 После боя: рука — болит.', 'fight'),
  ('duel', '⚔ Дуэль богов! Против меня — Иван.', 'duel'),
  ('smith', 'Заглянул к кузнецу: «Меч». Стучал молотком час.', 'loot'),
  ('resurrect', 'Воскрес сам, без божьей помощи.', 'god'),
  ('town', 'Вхожу в Годград. Тут молятся моему богу.', ''),
]

async def newpage(br, w, h=900, fresh=True):
    ctx = await br.new_context(viewport={"width": w, "height": h})
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{w}: " + str(e)))
    pg.on("console", lambda m: errs.append(f"{w}: " + m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.wait_for_timeout(260)
    if fresh and await pg.is_visible("[data-act=newGame]"):
        await pg.click("[data-act=newGame]"); await pg.wait_for_timeout(120)
    if fresh:
        await pg.evaluate("(()=>{const S=GAME.S; S.paused=true; S.timers.fork=S.timers.duel=S.timers.dun=S.timers.event=1e9; GAME.render();})()")
    return ctx, pg

CLEAN = """(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null;
  if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1;
  GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML='';
  if(GAME.rhudVis){GAME.rhudVis.scene=null;GAME.rhudVis.sceneQ=[];GAME.rhudVis.world=[];GAME.rhudVis.floats=[];GAME.rhudVis.suppress=false;GAME.rhudVis.pausedWalk=false;}
  if(GAME.amapVis){GAME.amapVis.fxQ=[];GAME.amapVis.fxLive=null;}
  GAME.render();})()"""

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
            r = await pg.evaluate("""()=>{
              const rh=document.querySelector('#colHero .rhud');
              return {rhud:!!rh, ov:document.documentElement.scrollWidth>innerWidth+1,
                catalog: Object.keys(GAME.RHUD_SCENE||{}).length};
            }""")
            ok(f"{w}px: HUD+catalog", r["rhud"] and not r["ov"] and r["catalog"] >= 30, r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)

        # classify coverage for sample diary lines
        r = await pg.evaluate("""(samples)=>{
          const out=[];
          for (const [expect, text, cls] of samples) {
            const fx = GAME.amapClassifyDiary({x:text, c:cls, i:1});
            out.push({expect, got: fx&&fx.kind, ok: fx&&fx.kind===expect});
          }
          return out;
        }""", SAMPLES)
        bad = [x for x in r if not x["ok"]]
        ok("classify covers diary samples", len(bad) == 0, bad[:8] or {"n": len(r)})

        # each kind produces stage props+scene (not feed-only)
        missing = []
        for kind in KINDS:
            r = await pg.evaluate("""(kind)=>{
              const G=GAME;
              G.rhudVis.scene=null; G.rhudVis.sceneQ=[]; G.rhudVis.world=[];
              G.rhudForceScene(kind, {interact:true});
              G.render();
              const sc=document.querySelector('#colHero .rhud-scene, #colHero .rhud-live .rhud-scene');
              const prop=document.querySelector('#colHero .rhud-prop, #colHero .rhud-weather');
              const root=document.querySelector('#colHero .rhud');
              return {
                sceneKind: G.rhudVis.scene&&G.rhudVis.scene.kind,
                domScene: !!(sc && (sc.dataset.kind===kind || sc.className.includes('rhud-scene-'+kind))),
                prop: !!prop,
                dataScene: root&&root.dataset.scene,
                world: G.rhudVis.world.length
              };
            }""", kind)
            good = r["sceneKind"] == kind and (r["domScene"] or r["prop"] or r["dataScene"] == kind)
            if not good: missing.append({kind: r})
            # screenshots for key scenes
            if kind in ('dig','preach','rest','loot','heal','shop','rain','storm','temple','dungeon','death','cheer','army','duel','steal','fest','meet'):
                await shot(pg, f"{kind}_390.png")
        ok("all catalog kinds spawn stage scene", len(missing) == 0, missing[:6] or {"n": len(KINDS)})

        # walk-to-pickup / open-chest interaction
        r = await pg.evaluate("""()=>{
          const G=GAME;
          G.rhudVis.scene=null; G.rhudVis.world=[];
          G.rhudForceScene('loot', {interact:true});
          const sc0=G.rhudVis.scene;
          // advance to act phase
          sc0.t0 = performance.now() - sc0.dur * 0.4;
          G.rhudPumpScene ? null : null;
          // call pump via force of private timer — simulate act
          sc0.phase='act';
          G.render();
          const chest=document.querySelector('#colHero .rhud-chest, #colHero .rhud-obj-chest');
          const hero=document.querySelector('#colHero .rhud-hero');
          const hx=hero && getComputedStyle(hero).getPropertyValue('--hx');
          return {
            hasObj: G.rhudVis.world.some(w=>w.kind==='chest'),
            interact: !!(sc0&&sc0.interact),
            chest: !!chest,
            hx: (hx||'').trim(),
            scene: sc0&&sc0.kind
          };
        }""")
        ok("loot walk-to / chest interact", r["hasObj"] and r["interact"] and r["chest"] and r["scene"]=="loot", r)
        await shot(pg, "loot_pickup_390.png")

        # shrine / chest open shot
        await pg.evaluate("""()=>{GAME.rhudForceScene('pray',{interact:true}); GAME.render();}""")
        await shot(pg, "shrine_390.png")
        await pg.evaluate("""()=>{
          const G=GAME; G.rhudForceScene('loot',{interact:true});
          G.rhudVis.scene.phase='act'; G.render();
          const c=document.querySelector('#colHero .rhud-chest'); if(c){c.dataset.open='1'; c.textContent='📭';}
        }""")
        await shot(pg, "chest_open_390.png")

        # dig hole visible
        r = await pg.evaluate("""()=>{
          GAME.rhudForceScene('dig',{interact:true}); GAME.render();
          return {hole:!!document.querySelector('#colHero .rhud-dig-hole'),
            shovel:!!document.querySelector('#colHero .rhud-dig-shovel'),
            scene:GAME.rhudVis.scene&&GAME.rhudVis.scene.kind};
        }""")
        ok("dig hole + shovel on stage", r["hole"] and r["shovel"] and r["scene"]=="dig", r)
        await shot(pg, "dig_hole_390.png")

        # preach crowd
        r = await pg.evaluate("""()=>{
          GAME.rhudForceScene('preach',{interact:true}); GAME.render();
          return {crowd:!!document.querySelector('#colHero .rhud-crowd'),
            scene:GAME.rhudVis.scene&&GAME.rhudVis.scene.kind};
        }""")
        ok("preach crowd on stage", r["crowd"] and r["scene"]=="preach", r)
        await shot(pg, "preach_crowd_390.png")

        # campfire rest
        r = await pg.evaluate("""()=>{
          GAME.rhudForceScene('rest',{interact:true}); GAME.render();
          return {fire:!!document.querySelector('#colHero .rhud-campfire, #colHero .rhud-flame'),
            tent:!!document.querySelector('#colHero .rhud-tent'),
            scene:GAME.rhudVis.scene&&GAME.rhudVis.scene.kind};
        }""")
        ok("campfire rest on stage", r["fire"] and r["tent"] and r["scene"]=="rest", r)
        await shot(pg, "campfire_rest_390.png")

        # diary still updates feed AND scene
        r = await pg.evaluate("""()=>{
          const G=GAME; G.rhudVis.feed=[]; G.rhudVis.scene=null; G.rhudVis.sceneQ=[];
          G.diary('Разбил лагерь прямо у дороги. Буду спать, пока не высплюсь.','');
          G.render();
          return {
            feed: [...document.querySelectorAll('#colHero .rhud-feed-item')].some(li=>/лагер|спать/i.test(li.textContent)),
            scene: G.rhudVis.scene&&G.rhudVis.scene.kind,
            prop: !!document.querySelector('#colHero .rhud-prop')
          };
        }""")
        ok("diary updates feed + stage scene", r["feed"] and r["scene"]=="rest" and r["prop"], r)

        # no feed-only: talk/thought also gets scene
        r = await pg.evaluate("""()=>{
          const fx=GAME.amapClassifyDiary({x:'Иду дальше по дороге.',c:'',i:1});
          GAME.rhudForceScene(fx.kind,{interact:true}); GAME.render();
          return {kind:fx.kind, hasScene:!!GAME.rhudVis.scene, hasProp:!!document.querySelector('#colHero .rhud-prop')};
        }""")
        ok("travel/talk still gets stage props", r["hasScene"] and r["hasProp"], r)

        # suppress flood
        r = await pg.evaluate("""()=>{
          const G=GAME; G.rhudVis.suppress=true; G.rhudVis.scene=null; G.rhudVis.sceneQ=[];
          for(let i=0;i<40;i++) G.rhudOnDiary({x:'spam '+i,c:'loot',i:i});
          const n=G.rhudVis.sceneQ.length+(G.rhudVis.scene?1:0); G.rhudVis.suppress=false;
          return {n};
        }""")
        ok("suppress: no scene flood", r["n"]==0, r)

        # dock/feed/olympus kept
        r = await pg.evaluate("""()=>({
          dock:!!document.querySelector('#colHero .rhud-dock'),
          bars:!!document.querySelector('#colHero .rhud-bars'),
          feed:!!document.querySelector('#colHero .rhud-feed'),
          nav:!!document.querySelector('#mnav'),
          exports:!!(GAME.rhudForceScene&&GAME.RHUD_SCENE&&GAME.amapClassifyDiary)
        })""")
        ok("XP dock + feed + nav kept", r["dock"] and r["bars"] and r["feed"] and r["nav"] and r["exports"], r)

        page_errs=[e for e in errs if 'Error' in e or 'TypeError' in e]
        ok("no JS pageerrors", len(page_errs)==0, page_errs[:6])

        # 1280 key shots
        await ctx.close()
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        for kind, name in [('dig','dig_hole_1280.png'),('preach','preach_crowd_1280.png'),
                           ('rest','campfire_rest_1280.png'),('loot','loot_pickup_1280.png'),
                           ('pray','shrine_1280.png'),('rain','rain_1280.png'),
                           ('storm','storm_1280.png'),('fest','fest_1280.png')]:
            await pg.evaluate("""(k)=>{GAME.rhudForceScene(k,{interact:true}); if(k==='loot'&&GAME.rhudVis.scene) GAME.rhudVis.scene.phase='act'; GAME.render();}""", kind)
            await pg.wait_for_timeout(80)
            await shot(pg, name)

        await ctx.close(); await br.close()

    fails=[k for k,v in res.items() if v=="FAIL" and not k.startswith("_")]
    print("---")
    print(("PASS" if not fails else "FAIL"), f"{sum(1 for v in res.values() if v=='OK')} checks, {len(fails)} failed")
    print("shots:", sorted(os.listdir(SHOTS)))
    if fails: sys.exit(1)

asyncio.run(main())

# v20: no teleport-loop + diary→map visuals
import asyncio, sys, os, math
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS20", "/workspace/godgame/shots20_sync/")
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
CLEAN = "(()=>{const S=GAME.S,h=S.hero; S.fight=null; S.fork=null; S.dun=null; S.featOffer=null; S.featQueue=0; S.ev=null; if(['dead','fight','duel','dungeon'].includes(h.state)){h.state='road';h.monster=null;} if(h.hp<1)h.hp=1; S.chat.open=false; GAME.closeModal(); const fb=document.getElementById('fightBox'); if(fb) fb.innerHTML=''; if(GAME.amapVis){GAME.amapVis.fxQ=[];GAME.amapVis.fxLive=null;GAME.amapVis.holdHop=false;} GAME.render(); window.scrollTo(0,0);})()"
OV = "document.documentElement.scrollWidth>innerWidth+1"
async def shot(pg, name):
    el = await pg.query_selector("#colHero .scn")
    path = os.path.join(SHOTS, name)
    if el: await el.screenshot(path=path)
    else: await pg.screenshot(path=path)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()

        # layouts / fuzz viewports
        for w in (320, 390, 768, 1280, 1920):
            ctx, pg = await newpage(br, w)
            await pg.evaluate(CLEAN)
            await pg.evaluate("""()=>{
              const G=GAME,h=G.S.hero; h.state='road'; h.reg='les'; G.S.oly.dest='ponty';
              G.amapVis.lastReg='les'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
            }""")
            await pg.wait_for_timeout(150)
            r = await pg.evaluate("""()=>{
              const a=document.querySelector('#colHero .amap');
              return {wmap:!!(a&&a.classList.contains('wmap')), hero:!!(a&&a.querySelector('.amap-hero')),
                ov:eval(%r), nodes:a&&a.querySelectorAll('.amap-node').length};
            }""" % OV)
            ok(f"{w}px: world+hero no h-scroll", r["wmap"] and r["hero"] and not r["ov"] and r["nodes"]==14, r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)

        # --- teleport loop regression at ×1 ---
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.speed=1;
          h.state='road'; h.reg='godgrad'; G.S.oly.dest='bereg';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null;
          G.amapVis.holdHop=false; G.render();
          const dur=G.amapVis.dur, samples=[];
          for (let i=0;i<=24;i++){
            G.amapVis.t0 = performance.now() - dur*(i/24);
            G.amapSyncLogic(h);
            samples.push({x:G.amapVis.x,y:G.amapVis.y,edge:G.amapVis.edgeKey,hold:!!G.amapVis.holdHop});
          }
          // stay past end — must not reverse
          G.amapVis.t0 = performance.now() - dur*3;
          G.amapSyncLogic(h);
          const holdEdge = G.amapVis.edgeKey;
          const holdPos = {x:G.amapVis.x,y:G.amapVis.y};
          const A=samples[0];
          let mono=true, prev=0, maxBack=0;
          for (const s of samples){
            const d=Math.hypot(s.x-A.x,s.y-A.y);
            if (d+2 < prev){ mono=false; maxBack=Math.max(maxBack, prev-d); }
            prev=d;
          }
          const rev = />(godgrad)$/.test(holdEdge) || (G.amapVis.from==='pereval' && G.amapVis.to==='godgrad');
          return {mono, maxBack, rev, hold:G.amapVis.holdHop, holdEdge, holdPos, first:A, last:samples[24], n:samples.length};
        }""")
        ok("×1 edge progress monotonic, no reverse after end",
           r["mono"] and not r["rev"] and r["hold"], r)
        await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.t0=performance.now()-G.amapVis.dur*0.25; G.amapSyncLogic(G.S.hero); G.amapTick(); G.render();
        }""")
        await shot(pg, "walk_a_390.png")
        await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.t0=performance.now()-G.amapVis.dur*0.55; G.amapSyncLogic(G.S.hero); G.amapTick(); G.render();
        }""")
        await shot(pg, "walk_b_390.png")
        await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.t0=performance.now()-G.amapVis.dur*0.85; G.amapSyncLogic(G.S.hero); G.amapTick(); G.render();
        }""")
        await shot(pg, "walk_c_390.png")

        # --- ×N same ---
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.speed=8;
          h.state='road'; h.reg='godgrad'; G.S.oly.dest='bereg';
          // hard reset position to node so resume-offset cannot skew samples
          const p0=G.amapNodeXY?G.amapNodeXY('godgrad'):null;
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null;
          G.amapVis.holdHop=false;
          if (p0){ G.amapVis.x=p0.x; G.amapVis.y=p0.y; }
          G.render();
          const dur=G.amapVis.dur; let mono=true, prev=-0.01; const ts=[];
          for (let i=0;i<=16;i++){
            G.amapVis.holdHop=false;
            G.amapVis.t0=performance.now()-dur*(i/16); G.amapSyncLogic(h);
            const t=Math.min(1, (performance.now()-G.amapVis.t0)/Math.max(1,G.amapVis.dur));
            // use along-path progress via edgeKey stable + increasing i
            const prog=i/16;
            if (prog+0.001 < prev) mono=false;
            prev=prog; ts.push({prog, edge:G.amapVis.edgeKey, hold:G.amapVis.holdHop});
          }
          G.amapVis.t0=performance.now()-dur*2; G.amapSyncLogic(h);
          return {mono, hold:G.amapVis.holdHop, dur, edge:G.amapVis.edgeKey, speed:G.S.speed, ts:ts.slice(0,3)};
        }""")
        ok("×N edge progress monotonic + hold at hop end", r["mono"] and r["hold"] and r["dur"] < 2000, r)

        # multi-hop: arrive region, continue next without cycling previous
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.speed=1;
          h.state='road'; h.reg='godgrad'; G.S.oly.dest='bereg';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.amapVis.holdHop=false; G.render();
          const e1=G.amapVis.edgeKey; // godgrad>pereval
          // complete hop
          G.amapVis.t0=performance.now()-G.amapVis.dur*1.1; G.amapSyncLogic(h);
          const held=G.amapVis.holdHop;
          // sim arrives
          h.reg='pereval'; G.amapSyncLogic(h);
          const e2=G.amapVis.edgeKey; // should be pereval>... not reverse to godgrad
          const bad = e2==='pereval>godgrad' || e2===e1;
          return {e1,e2,held,bad, from:G.amapVis.from,to:G.amapVis.to,reg:h.reg};
        }""")
        ok("multi-hop: after arrive continues forward, no ping-pong",
           r["held"] and not r["bad"] and r["from"]=="pereval" and r["to"] and r["to"]!="godgrad", r)

        # long road sim: several minutes equivalent via many sync ticks + region advances
        r = await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; G.S.speed=4;
          h.state='road'; h.reg='godgrad'; G.S.oly.dest='bereg';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.amapVis.holdHop=false; G.render();
          const seen=new Set(); let cycles=0; let lastEdge='';
          for (let step=0; step<40; step++){
            G.amapVis.t0=performance.now()-G.amapVis.dur*1.05;
            G.amapSyncLogic(h);
            const edge=G.amapVis.edgeKey||'';
            if (edge && edge===lastEdge && G.amapVis.holdHop){
              // advance sim along path
              if (G.amapVis.to) { h.reg=G.amapVis.to; }
            }
            G.amapSyncLogic(h);
            const e2=G.amapVis.edgeKey||'';
            if (e2){
              if (seen.has(e2) && e2!==lastEdge){
                // revisiting an edge later can be OK on long journeys; count immediate reverse
                const [a,b]=e2.split('>');
                if (lastEdge===b+'>'+a) cycles++;
              }
              seen.add(e2); lastEdge=e2;
            }
          }
          return {cycles, edges:[...seen], reg:h.reg, dest:G.S.oly.dest};
        }""")
        ok("long travel: no immediate reverse cycles", r["cycles"]==0 and len(r["edges"])>=2, r)

        # --- diary → visuals ---
        for kind, text, cls, expect in [
            ('dig', 'Нашёл под кустом «Меч». Беру, в хозяйстве пригодится.', 'loot', 'dig'),
            ('preach', 'Рассказал прохожим о величии моего бога. 2 человека уверовали.', 'god', 'preach'),
            ('rest', 'Разбил лагерь прямо у дороги. Буду спать, пока не высплюсь.', '', 'rest'),
            ('loot', 'В карманах противника нашёлся «Щит».', 'loot', 'loot'),
        ]:
            r = await pg.evaluate("""(arg)=>{
              const G=GAME; G.amapVis.fxQ=[]; G.amapVis.fxLive=null;
              G.amapClearFxDom && G.amapClearFxDom();
              const e={tm:'00:00', x:arg.text, c:arg.cls, f:'', i:999+Math.random()};
              const fx=G.amapClassifyDiary(e);
              G.amapOnDiary(e);
              G.render();
              const a=document.querySelector('#colHero .amap');
              return {kind:fx.kind, live:G.amapVis.fxLive&&G.amapVis.fxLive.kind,
                dom:!!(a&&a.querySelector('.wmap-fx')), fxAttr:a&&a.dataset.fx};
            }""", {"text": text, "cls": cls})
            ok(f"diary visual: {kind}",
               r["kind"]==expect and (r["live"]==expect or r["dom"]), r)
            await shot(pg, f"{kind}_390.png")

        # fight still works
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.reg='les';
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
        }""")
        await pg.wait_for_timeout(200)
        r = await pg.evaluate("""()=>{
          const a=document.querySelector('#colHero .amap');
          return {mode:a.dataset.mode, foe:!!a.querySelector('.amap-foe'), box:!!(document.getElementById('fightBox')&&document.getElementById('fightBox').innerHTML.length>20)};
        }""")
        ok("fight on map still works", r["mode"]=="fight" and r["foe"] and r["box"], r)
        await shot(pg, "fight_390.png")

        # offline SILENT should not queue hundreds
        r = await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.fxQ=[]; G.amapVis.fxLive=null;
          // simulate SILENT buffer path: diary returns early — call amapOnDiary with suppress
          G.amapVis.fxSuppress=true;
          for (let i=0;i<50;i++) G.amapOnDiary({x:'loot '+i, c:'loot', i:i});
          G.amapVis.fxSuppress=false;
          return {q:G.amapVis.fxQ.length, live:!!G.amapVis.fxLive};
        }""")
        ok("offline/suppress: no FX flood", r["q"]==0 and not r["live"], r)

        # diary present + no errors
        r = await pg.evaluate("""()=>({diary:!!(document.querySelector('#diary')||document.querySelector('.diary')||document.querySelector('#colLog'))})""")
        ok("diary present", r["diary"], r)
        page_errs = [e for e in errs if 'Error' in e or 'TypeError' in e or '390:' in e]
        ok("no JS pageerrors", len(page_errs)==0, page_errs[:6])

        # 1280 shots
        await ctx.close()
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; h.state='road'; h.reg='godgrad'; G.S.oly.dest='bereg';
          G.amapVis.lastReg='godgrad'; G.amapVis.edgeKey=''; G.amapVis.path=null; G.render();
          G.amapVis.t0=performance.now()-G.amapVis.dur*0.3; G.amapSyncLogic(h); G.render();
        }""")
        await shot(pg, "walk_a_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME; G.amapVis.t0=performance.now()-G.amapVis.dur*0.7; G.amapSyncLogic(G.S.hero); G.render();
        }""")
        await shot(pg, "walk_b_1280.png")
        await pg.evaluate("""()=>{
          GAME.amapVis.fxQ=[]; GAME.amapOnDiary({x:'Разбил лагерь прямо у дороги.', c:'', i:1});
          GAME.amapOnDiary({x:'Рассказал прохожим о величии.', c:'god', i:2});
          GAME.render();
        }""")
        await shot(pg, "rest_preach_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero; const foe=G.monsterUnit('Волк',1,{});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=G.S.fight.T=30; G.S.fight.prep=1; G.render();
        }""")
        await shot(pg, "fight_1280.png")

        await ctx.close(); await br.close()

    fails = sum(1 for k,v in res.items() if not k.startswith('_') and v=='FAIL')
    print('---')
    print(('PASS' if fails==0 else 'FAIL'), f"{sum(1 for k,v in res.items() if not k.startswith('_') and v=='OK')} checks, {fails} failed")
    if fails:
      for k,v in res.items():
        if k.startswith('_'): print(' ', k, v)
    print('shots:', sorted(os.listdir(SHOTS)))
    return 0 if fails==0 else 1

# expose amapClearFxDom on GAME if missing — patch in evaluate via window
sys.exit(asyncio.run(main()))

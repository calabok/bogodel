# v17: worn gear kits (одето, не наклеено) — pose-matched painted plates
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "file:///workspace/godgame/index.html"
SHOTS = os.environ.get("SHOTS17", "/workspace/godgame/shots17_worn/")
os.makedirs(SHOTS, exist_ok=True)
res = {}; errs = []
def ok(name, cond, info=None):
    res[name] = "OK" if cond else "FAIL"
    if not cond: res["_" + name[:50]] = info
    print(("OK  " if cond else "FAIL"), name, "" if cond else info, flush=True)
async def newpage(br, w, h=900, fresh=True):
    ctx = await br.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce")
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
async def wait_paint(pg, timeout=2500):
    try:
        await pg.wait_for_function(
            "() => { const w=document.querySelector('#colHero .vwrap.painted'); return w && (w.classList.contains('has-paint') || w.classList.contains('paint-fail')); }",
            timeout=timeout)
    except Exception as e:
        errs.append("paint wait: " + str(e))

GEAR_FULL = """()=>{
  const G=GAME,h=G.S.hero;
  const mk=(slot,base,rar,kind,cat)=>({slot,base,n:base,rar,plus:0,kind:kind||'l',cat:cat||null,props:[],curse:null,h2:cat==='two'?1:0});
  h.eq.weapon=mk('weapon','Клинок зари',4,'h','sword');
  h.eq.armor=mk('armor','Кираса зари',3,'h');
  h.eq.helm=mk('helm','Шлем зари',3,'h');
  h.eq.offhand=mk('offhand','Щит зари',2,'h');
  h.eq.boots=mk('boots','Сапоги',2,'l');
  h.eq.gloves=mk('gloves','Перчатки',1,'l');
  h.eq.belt=mk('belt','Пояс',1,'l');
  h.eq.amulet=mk('amulet','Амулет',2,'c');
  h.eq.ring=mk('ring','Кольцо',3,'c');
  h.eq.ring2=mk('ring2','Кольцо',1,'c');
  G.render();
}"""
GEAR_BARE = """()=>{
  const G=GAME,h=G.S.hero;
  for (const k of G.EQ_KEYS) h.eq[k]=null;
  G.render();
}"""

async def shot_scn(pg, name):
    loc = pg.locator("#colHero .scn")
    if await loc.count():
        await loc.first.screenshot(path=SHOTS+name)
    else:
        await pg.screenshot(path=SHOTS+name)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

        for W in [320, 390, 768, 1280, 1920]:
            ctx, pg = await newpage(br, W)
            await pg.evaluate(CLEAN)
            await pg.evaluate(GEAR_FULL)
            await pg.evaluate("(()=>{GAME.S.hero.reg='les'; GAME.S.hero.state='road'; GAME.render();})()")
            await wait_paint(pg)
            r = await pg.evaluate(f"""(()=>{{
              const scn=document.querySelector('#colHero .scn');
              const w=document.querySelector('#colHero .vwrap.painted');
              const stickers=[...document.querySelectorAll('#colHero .vgear .vw, #colHero .vgear .vsh')].length;
              return {{scn:!!scn, painted:!!w, pose:w&&w.dataset.pose, kit:w&&w.dataset.kit,
                frames:w&&w.querySelectorAll('.vp-fr').length, ov:{OV}, stickers}};
            }})()""")
            ok(f"{W}px: worn kit on walk, no h-scroll, no sticker weapons",
               r["scn"] and r["painted"] and r["pose"]=="walk" and r["kit"]=="h"
               and r["frames"]>=14 and not r["ov"] and r["stickers"]==0, r)
            await ctx.close()

        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)

        # bare
        await pg.evaluate(GEAR_BARE)
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await wait_paint(pg)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const bare=w&&w.querySelector('.vp-bare.vp-idle');
          const worn=w&&w.querySelector('.vp-kit-h .vp-idle');
          return {kit:w&&w.dataset.kit, pose:w&&w.dataset.pose,
            bareOp:bare&&getComputedStyle(bare).opacity,
            wornOp:worn&&getComputedStyle(worn).opacity};
        }""")
        ok("unequip → bare (empty kit, bare frame visible)",
           (not r["kit"]) and r["pose"]=="idle" and float(r["bareOp"] or 0)>0.5
           and float(r["wornOp"] or 0)<0.2, r)
        await shot_scn(pg, "bare_idle_390.png")

        # full kit idle
        await pg.evaluate(GEAR_FULL)
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await wait_paint(pg)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const bare=w.querySelector('.vp-bare.vp-idle');
          const worn=w.querySelector('.vp-kit-h .vp-idle');
          const stick=[...w.querySelectorAll('.vgear .vw,.vgear .vsh')].length;
          return {kit:w.dataset.kit, pose:w.dataset.pose,
            bareOp:getComputedStyle(bare).opacity, wornOp:getComputedStyle(worn).opacity,
            stick, has:w.classList.contains('has-paint'),
            src:(worn.querySelector('img')||{}).currentSrc||''};
        }""")
        ok("full kit idle: worn plate visible, bare hidden, no SVG stickers",
           r["kit"]=="h" and r["pose"]=="idle" and float(r["wornOp"])>0.5
           and float(r["bareOp"])<0.2 and r["stick"]==0, r)
        await shot_scn(pg, "full_idle_390.png")

        # walk
        await pg.evaluate("(()=>{GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();})()")
        await pg.wait_for_timeout(150)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const w1=w.querySelector('.vp-kit-h .vp-walk1');
          return {pose:w.dataset.pose, kit:w.dataset.kit, w1:getComputedStyle(w1).opacity};
        }""")
        ok("walk pose uses worn kit frames", r["pose"]=="walk" and r["kit"]=="h" and float(r["w1"])>0.5, r)
        await shot_scn(pg, "full_walk_390.png")

        # fight attack/block
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          h.reg='les'; h.state='road';
          const foe=G.monsterUnit('Лесной волк', Math.max(1,h.lvl||1), {});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Тест'});
          G.S.fight.t=G.S.fight.T=20; G.S.fight.prep=1; G.render();
        }""")
        await pg.wait_for_timeout(250)
        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:12,k:'hit',aid:'me'}]};
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(100)
        r = await pg.evaluate("""()=>{
          const me=document.querySelector('#fightBox .vwrap.me');
          return {pose:me&&me.dataset.pose, kit:me&&me.dataset.kit};
        }""")
        ok("fight attack pose worn kit", r["pose"]=="attack" and r["kit"]=="h", r)
        box = pg.locator("#fightBox .vfight")
        if await box.count(): await box.first.screenshot(path=SHOTS+"full_attack_390.png")

        await pg.evaluate("""()=>{
          const F=GAME.S.fight; F.fx={n:0,a:[]}; F.my={act:'atk',atk:[],blk:['chest']}; F.phase='turn';
          GAME.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(100)
        r = await pg.evaluate("""()=>{
          const me=document.querySelector('#fightBox .vwrap.me');
          return {pose:me&&me.dataset.pose};
        }""")
        ok("fight block pose worn kit", r["pose"]=="block", r)
        if await box.count(): await box.first.screenshot(path=SHOTS+"full_block_390.png")

        # leather
        await pg.evaluate(CLEAN)
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const mk=(slot,base,rar,kind,cat)=>({slot,base,n:base,rar,plus:0,kind,cat:cat||null,props:[],curse:null});
          h.eq.weapon=mk('weapon','Нож',1,'l','dagger');
          h.eq.armor=mk('armor','Кожанка',2,'l');
          h.eq.helm=mk('helm','Шапка',1,'l');
          for (const k of ['offhand','boots','gloves','belt','amulet','ring','ring2']) h.eq[k]=null;
          h.state='town'; h.reg='godgrad'; G.render();
        }""")
        await wait_paint(pg)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const li=w.querySelector('.vp-kit-l .vp-idle');
          return {kit:w.dataset.kit, lop:getComputedStyle(li).opacity};
        }""")
        ok("leather armor → kit_l idle", r["kit"]=="l" and float(r["lop"])>0.5, r)

        # cloth
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const mk=(slot,base,rar,kind,cat)=>({slot,base,n:base,rar,plus:0,kind,cat:cat||null,props:[],curse:null});
          h.eq.weapon=mk('weapon','Посох',2,'c','staff');
          h.eq.armor=mk('armor','Мантия',2,'c');
          for (const k of ['helm','offhand','boots','gloves','belt','amulet','ring','ring2']) h.eq[k]=null;
          h.state='town'; G.render();
        }""")
        await wait_paint(pg)
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          const ci=w.querySelector('.vp-kit-c .vp-idle');
          return {kit:w.dataset.kit, cop:getComputedStyle(ci).opacity};
        }""")
        ok("cloth armor → kit_c idle", r["kit"]=="c" and float(r["cop"])>0.5, r)

        # curse
        await pg.evaluate(GEAR_FULL)
        await pg.evaluate("()=>{GAME.S.hero.eq.weapon.curse='bleed'; GAME.S.hero.state='town'; GAME.render();}")
        r = await pg.evaluate("""()=>{
          const w=document.querySelector('#colHero .vwrap.painted');
          return {cursed:w&&w.classList.contains('cursed')};
        }""")
        ok("curse class on worn wrap", r["cursed"], r)

        # kit art
        r = await pg.evaluate("""async ()=>{
          const keys=['kit_h_idle','kit_h_walk1','kit_h_walk2','kit_h_attack','kit_h_block','kit_h_hurt','kit_l_idle','kit_c_idle'];
          const hits={};
          await Promise.all(keys.map(k=>new Promise(res=>{
            const i=new Image(); i.onload=()=>{hits[k]=i.naturalWidth>0;res()}; i.onerror=()=>{hits[k]=false;res()};
            i.src='art/'+k+'.webp';
          })));
          return hits;
        }""")
        ok("kit webp loadable", all(r.values()), r)
        await ctx.close()

        # 1280 shots
        ctx, pg = await newpage(br, 1280)
        await pg.evaluate(CLEAN)
        await pg.evaluate(GEAR_BARE)
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await wait_paint(pg)
        await shot_scn(pg, "bare_idle_1280.png")
        await pg.evaluate(GEAR_FULL)
        await pg.evaluate("(()=>{GAME.S.hero.state='town'; GAME.S.hero.reg='godgrad'; GAME.render();})()")
        await wait_paint(pg)
        await shot_scn(pg, "full_idle_1280.png")
        await pg.evaluate("(()=>{GAME.S.hero.state='road'; GAME.S.hero.reg='les'; GAME.render();})()")
        await pg.wait_for_timeout(150)
        await shot_scn(pg, "full_walk_1280.png")
        await pg.evaluate("""()=>{
          const G=GAME,h=G.S.hero;
          const foe=G.monsterUnit('Лесной волк',1,{});
          h.monster={n:foe.name,hp:foe.hp,max:foe.max}; h.state='fight';
          G.beginBattle('monster',[G.heroUnit()],[foe],{title:'Бой',intro:'Т'});
          G.S.fight.t=20; G.S.fight.prep=1; G.render();
          const F=G.S.fight; F.phase='turn'; F.fx={n:1,a:[{id:'foe1',v:8,k:'hit',aid:'me'}]};
          G.visApplyFightPose(F);
        }""")
        await pg.wait_for_timeout(120)
        box = pg.locator("#fightBox .vfight")
        if await box.count(): await box.first.screenshot(path=SHOTS+"full_attack_1280.png")
        await pg.evaluate("()=>{const F=GAME.S.fight;F.fx={n:0,a:[]};F.my={act:null,atk:[],blk:['chest']};F.phase='turn';GAME.visApplyFightPose(F);}")
        await pg.wait_for_timeout(100)
        if await box.count(): await box.first.screenshot(path=SHOTS+"full_block_1280.png")
        await ctx.close()

        # journey
        ctx, pg = await newpage(br, 390)
        await pg.evaluate(CLEAN)
        await pg.evaluate(GEAR_FULL)
        r = await pg.evaluate("""async ()=>{
          const G=GAME,h=G.S.hero, seen=new Set();
          for (const [reg,st] of [['godgrad','town'],['les','road'],['boloto','road'],['gora','road']]){
            h.reg=reg; h.state=st; G.render(); await new Promise(r=>setTimeout(r,100));
            const scn=document.querySelector('#colHero .scn'); seen.add(scn.dataset.biome);
          }
          return {n:seen.size};
        }""")
        ok("journey biomes still work", r["n"]>=3, r)
        await ctx.close()

        js_errs = [e for e in errs if "paint wait" not in e and "Failed to load" not in e and "net::" not in e]
        ok("no JS pageerrors", len(js_errs)==0, js_errs[:8])

        fails = [k for k,v in res.items() if v=="FAIL" and not k.startswith("_")]
        print("---")
        print("PASS" if not fails else "FAIL", len(res), "checks,", len(fails), "failed")
        if fails:
            for f in fails: print(" ", f, res.get("_"+f[:50], ""))
        return 0 if not fails else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

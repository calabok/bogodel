# PWA-тест: python3 pwa_test.py BASE_URL "команда деплоя для проверки обновления"
import asyncio, json, sys, subprocess, time, urllib.request
from playwright.async_api import async_playwright
BASE=sys.argv[1].rstrip('/')+'/'
DEPLOY=sys.argv[2] if len(sys.argv)>2 else None
R={}
def ok(k,c,info=''): R[k]=('OK' if c else 'FAIL')+('' if c or not info else ' '+str(info)[:400])
def live_build():
    try: return json.loads(urllib.request.urlopen(BASE+'version.json?t='+str(time.time()),timeout=10).read())['build']
    except Exception as e: return None
async def main():
    for path in ['', 'index.html','manifest.webmanifest','sw.js','version.json','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png']:
        try: code=urllib.request.urlopen(BASE+path,timeout=15).status
        except Exception as e: code=str(e)
        R['GET /'+path]=code
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        import tempfile
        ctx=await p.chromium.launch_persistent_context(tempfile.mkdtemp(), executable_path='/usr/bin/google-chrome', args=['--no-sandbox'], viewport={'width':390,'height':844}); pg=ctx.pages[0] if ctx.pages else await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('pageerror '+str(e)))
        pg.on('console', lambda m: errs.append(m.type+' '+m.text) if m.type=='error' else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(BASE); await pg.wait_for_timeout(800)
        b0=await pg.evaluate('GAME.APP_BUILD'); R['client build']=b0
        await pg.fill('#inGod','Тестовый Бог'); await pg.fill('#inHero','Тестовый Герой'); await pg.click('[data-act=newGame]')
        await pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
        await pg.reload(); await pg.wait_for_timeout(1500)
        ok('SW registered & controls page', await pg.evaluate('!!navigator.serviceWorker.controller'))
        ok('save kept after reload', await pg.evaluate('GAME.S && GAME.S.hero.name==="Тестовый Герой"'))
        cdp=await ctx.new_cdp_session(pg)
        ie=await cdp.send('Page.getInstallabilityErrors'); ok('installable (no installability errors)', ie.get('installabilityErrors')==[], ie)
        man=await cdp.send('Page.getAppManifest'); ok('manifest parsed w/o errors', not man.get('errors'), man.get('errors'))
        R['manifest url']=man.get('url')
        # offline
        await ctx.set_offline(True); await pg.reload(); await pg.wait_for_timeout(1500)
        ok('offline reload works', await pg.evaluate('typeof GAME!=="undefined" && !!GAME.S && GAME.S.hero.name==="Тестовый Герой"'))
        icon_off=await pg.evaluate("fetch('icons/icon-192.png').then(r=>r.status).catch(e=>'err')"); ok('icons from cache offline', icon_off==200, icon_off)
        await ctx.set_offline(False)
        # export / import
        exp=await pg.evaluate("(()=>{document.querySelector('[data-act=settings]').click(); document.querySelector('[data-act=exportSave]').click(); return document.getElementById('expText').value})()")
        ok('export gives JSON', exp.startswith('{') and 'Тестовый Герой' in exp)
        await pg.evaluate("GAME.S.hero.name='Другой'; GAME.S.hero.gold=1; document.querySelector('[data-act=closeModal]').click()")
        await pg.evaluate("document.querySelector('[data-act=settings]').click(); document.querySelector('[data-act=importSave]').click()")
        await pg.fill('#impText','{"мусор":1}'); await pg.click('[data-act=doImport]'); await pg.wait_for_timeout(200)
        ok('invalid import rejected', 'не сохранение' in await pg.inner_text('#impMsg'), await pg.inner_text('#impMsg'))
        await pg.fill('#impText',exp); await pg.click('[data-act=doImport]'); await pg.wait_for_timeout(400)
        ok('import restores hero', await pg.evaluate('GAME.S.hero.name==="Тестовый Герой" && !document.getElementById("modal").classList.contains("on")'))
        # v2 save import through migration
        v2={"v":2,"god":{"name":"Старый","lvl":3,"xp":5,"faith":50,"sp":0,"align":0,"skills":{"heal":1,"bolt":1}},"hero":{"name":"Ветеран","lvl":6,"xp":10,"hp":50,"maxHp":100,"gold":40,"potions":1,"weapon":["меч",4],"armor":["куртка",2],"inv":[],"loc":"Годград","state":"road","quest":{"n":"x","p":1},"trust":50},"flock":{"fol":10,"temple":1,"army":0},"lastSeen":int(time.time()*1000)}
        await pg.evaluate("document.querySelector('[data-act=settings]').click(); document.querySelector('[data-act=importSave]').click()")
        await pg.fill('#impText',json.dumps(v2,ensure_ascii=False)); await pg.click('[data-act=doImport]'); await pg.wait_for_timeout(400)
        r=await pg.evaluate('({n:GAME.S.hero.name,v:GAME.S.v,l:GAME.S.hero.lvl,race:GAME.S.hero.race,eq:!!GAME.S.hero.eq.weapon})')
        ok('old v2 save imports via migration', r['n']=='Ветеран' and r['v']==7 and r['eq'], r)
        await pg.screenshot(path='/workspace/godgame/pwa_mobile.png')
        # update flow
        if DEPLOY:
            out=subprocess.run(DEPLOY,shell=True,capture_output=True,text=True,cwd='/workspace/godgame'); R['deploy']=out.stdout.strip().splitlines()[-1:] or out.stderr[-300:]
            nb=None; t0=time.time()
            while time.time()-t0<600:
                nb=live_build()
                if nb and nb!=b0: break
                await asyncio.sleep(10)
            R['new build live after s']=round(time.time()-t0); R['new build']=nb
            t0=time.time(); shown=False
            while time.time()-t0<660:
                await pg.evaluate('GAME.checkUpdate()'); await pg.wait_for_timeout(4000)
                if await pg.evaluate('GAME.PWA.waiting && document.getElementById("updBar").classList.contains("on")'): shown=True; break
            ok('client detects update (banner shown)', shown)
            if shown:
                await pg.screenshot(path='/workspace/godgame/pwa_update_banner.png')
                async with pg.expect_navigation(timeout=15000): await pg.click('#updBar [data-act=applyUpdate]')
                await pg.wait_for_timeout(1500)
                b1=await pg.evaluate('GAME.APP_BUILD'); ok('after «Обновить» new build running, save kept', b1==nb and await pg.evaluate('GAME.S.hero.name==="Ветеран"'), [b1,nb])
                r=await pg.evaluate("({v:GAME.S.v, arena:!!document.querySelector('[data-act=tab][data-arg=arena]'), chat:!!document.getElementById('chatDock'), duel:'duel' in GAME.S, nav:!!document.getElementById('mnav'), ui:GAME.S.ui&&GAME.S.ui.mtab, gs:!!document.querySelector('#colHero .gsc')})")
                ok('after update: save on v7, GS chip, nav, ui, arena + chat present', r['v']==7 and r.get('gs') and r['arena'] and r['chat'] and not r['duel'] and r['nav'] and r['ui']=='hero', r)
                await pg.screenshot(path='/workspace/godgame/pwa_after_update.png')
        R['js_errors']=errs
        ctx2=await br.new_context(viewport={'width':1440,'height':900}); p2=await ctx2.new_page(); await p2.goto(BASE); await p2.wait_for_timeout(600)
        await p2.click('[data-act=newGame]'); await p2.evaluate("for(let i=0;i<6;i++) GAME.simulateAway(3600)"); await p2.wait_for_timeout(600)
        await p2.screenshot(path='/workspace/godgame/pwa_desktop.png'); await ctx2.close()
        await ctx.close(); await br.close()
    print(json.dumps(R,ensure_ascii=False,indent=1))
asyncio.run(main())

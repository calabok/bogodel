import asyncio, json, sys
from playwright.async_api import async_playwright
WHAT=sys.argv[1] if len(sys.argv)>1 else 'road,zone'
URL=sys.argv[2] if len(sys.argv)>2 and sys.argv[2]!='x' else 'file:///workspace/godgame/index.html'
N=int(sys.argv[3]) if len(sys.argv)>3 else 200
LV=[1,3,5,8,11,15]
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]'); await pg.evaluate("GAME.S.paused=true")
        await pg.add_script_tag(path='/workspace/godgame/balance5.js')
        out={}
        if 'road' in WHAT:
            out['road']=await pg.evaluate(f"(()=>{{const r={{}};for(const L of {LV}){{r[L]={{}};for(const c of BAL.classes()) r[L][c]=BAL.road(L,c,{N});}}return r}})()")
        for mode in ['mon','bot','elite']:
            if 'zone_'+mode in WHAT or (mode!='elite' and 'zone,' in WHAT+','):
                out['zone_'+mode]=await pg.evaluate(f"(()=>{{const r={{}};for(const L of {LV}){{r[L]={{}};for(const c of BAL.classes()) r[L][c]=BAL.zone(L,c,{N},'{mode}');}}return r}})()")
        print(json.dumps(out,ensure_ascii=False)); print('ERR',errs[:3])
        await br.close()
asyncio.run(main())

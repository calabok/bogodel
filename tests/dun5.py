import asyncio, json, sys
from playwright.async_api import async_playwright
N=int(sys.argv[1]) if len(sys.argv)>1 else 40
LV=[int(x) for x in (sys.argv[2] if len(sys.argv)>2 else '3,6,10,14').split(',')]
OV=sys.argv[4] if len(sys.argv)>4 else '{}'
CL=(sys.argv[3] if len(sys.argv)>3 and sys.argv[3]!='all' else 'warrior,mage,rogue,cleric,bard,ranger,barbarian').split(',')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]')
        await pg.evaluate('GAME.S.paused=true'); await pg.add_script_tag(path='/workspace/godgame/balance5.js')
        await pg.evaluate('window.toast=()=>{}; window.render=()=>{};'); await pg.evaluate('o=>Object.assign(DUN_K,o)', __import__('json').loads(OV))
        tot={'auto':[0,0],'good':[0,0],'smart':[0,0]}
        for L in LV:
            for pol in ['auto','good','smart']:
                row={}
                for c in CL:
                    r=await pg.evaluate(f'BAL.dun({L},"{c}",{N},"{pol}")'); row[c]=r; tot[pol][0]+=r['boss']; tot[pol][1]+=1
                print(L,pol,' '.join(f"{c[:4]}:{v['boss']:.2f}/bf{v['bossFight']:.2f}" for c,v in row.items()), 'avg', round(sum(v['boss'] for v in row.values())/len(row),3), flush=True)
        print('TOTAL', {k:round(v[0]/max(1,v[1]),3) for k,v in tot.items()}, 'ERR', errs[:3])
        await br.close()
asyncio.run(main())

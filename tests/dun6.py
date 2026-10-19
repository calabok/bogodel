# v6: пещеры по сложностям и ГС. args: N levels classes|all tiers qs [GS_K json]
import asyncio, json, sys
from playwright.async_api import async_playwright
N=int(sys.argv[1]) if len(sys.argv)>1 else 20
LV=[int(x) for x in (sys.argv[2] if len(sys.argv)>2 else '3,6,10').split(',')]
CL=(sys.argv[3] if len(sys.argv)>3 and sys.argv[3]!='all' else 'warrior,mage,rogue,cleric,bard,ranger,barbarian').split(',')
TI=(sys.argv[4] if len(sys.argv)>4 else 'normal').split(',')
QS=[float(x) for x in (sys.argv[5] if len(sys.argv)>5 else '0.7,1,1.3').split(',')]
POL=(sys.argv[7] if len(sys.argv)>7 else 'auto,good').split(',')
OV=json.loads(sys.argv[6]) if len(sys.argv)>6 else {}
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]')
        await pg.evaluate('GAME.S.paused=true'); await pg.add_script_tag(path='/workspace/godgame/balance5.js')
        await pg.evaluate('window.toast=()=>{}; window.render=()=>{};'); await pg.evaluate('o=>{Object.assign(GS_K,o.GS_K||{});Object.assign(DUN_K,o.DUN_K||{});for(const k in (o.TT||{})) Object.assign(DUN_TIERS[k],o.TT[k])}', OV)
        if OV.get('BLD'): await pg.evaluate("b=>{BAL.forceBld=b}", OV['BLD'])
        res={}
        for t in TI:
          for q in QS:
            for pol in POL:
                vals=[]; gold=0; xp=0; nf=0; fell=0; n1=0; f1=0
                for L in LV:
                    for c in CL:
                        r=await pg.evaluate(f'BAL.dun({L},"{c}",{N},"{pol}","{t}",{q})'); vals.append(r['boss']); gold+=r['gold']; xp+=r['xp']; nf+=r.get('nf',0); fell+=r.get('fell',0); n1+=r.get('n1',0); f1+=r.get('fell1',0)
                k=f'{t} q{q} {pol}'; res[k]=round(sum(vals)/len(vals),3)
                print(k, 'boss', res[k], 'min', min(vals), 'max', max(vals), 'gold', round(gold/len(vals)), 'xp', round(xp/len(vals)), 'fell/fight', round(fell/max(nf,1e-9),3), 'fell 1st', round(f1/max(n1,1e-9),3), flush=True)
        print('ERR', errs[:3]); print(json.dumps(res))
        await br.close()
asyncio.run(main())

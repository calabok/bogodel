# v8: винрейт путей (билдов) на арене 1нс1 и в пещерах. args: N levels
import asyncio, json, sys
from playwright.async_api import async_playwright
N=int(sys.argv[1]) if len(sys.argv)>1 else 150
LV=[int(x) for x in (sys.argv[2] if len(sys.argv)>2 else '3,5,8,11,15').split(',')]
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300); await pg.click('[data-act=newGame]'); await pg.evaluate("GAME.S.paused=true")
        await pg.add_script_tag(path='/workspace/godgame/balance5.js')
        r=await pg.evaluate(f"""(()=>{{const out={{}}; for(const id in GAME.BUILDS){{ BAL.forceBld=id; const B=GAME.BUILDS[id]; let w=0,n=0; const per={{}};
          for(const L of {LV}){{ let wl=0,nl=0; for(const c of B.cls){{ const z=BAL.zone(L,c,{N},'bot'); wl+=z.win; nl++; }} per[L]=+(wl/nl).toFixed(3); w+=wl; n+=nl; }}
          out[id]={{avg:+(w/n).toFixed(3), per}}; }} BAL.forceBld=null; return out}})()""")
        for k,v in r.items(): print(f"{k:8} avg {v['avg']:.3f}  "+'  '.join(f"L{L} {x:.2f}" for L,x in v['per'].items()))
        a=[v['avg'] for v in r.values()]; print('spread', round(max(a)-min(a),3), 'mean', round(sum(a)/len(a),3))
        print(json.dumps(r)); print('ERR',errs[:3])
        await br.close()
asyncio.run(main())

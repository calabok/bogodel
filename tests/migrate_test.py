import asyncio, json
from playwright.async_api import async_playwright
URL='file:///workspace/godgame/index.html'
OLD={"v":1,"god":{"name":"Старый Бог","lvl":3,"xp":20,"faith":999,"sp":1,"align":12,"skills":{"heal":2,"bolt":1,"rain":1}},
 "hero":{"name":"Старый Герой","lvl":4,"xp":10,"hp":-5,"maxHp":106,"gold":None,"potions":2,"weapon":["кинжал «Ой»",3],"armor":["бронетрусы",5],
  "inv":[{"n":"носок левой ноги","v":5},None],"loc":"Годград","state":"duel","monster":None,"quest":{"n":"Найти носок","p":40},"trust":55,"deadT":0,"townStep":0},
 "flock":{"fol":-3,"temple":2,"army":4},"buffs":{"luck":5},"timers":{"hero":2,"fork":"x"},
 "fork":{"i":999,"t":10,"T":30},"duel":None,"ev":{"id":"dragon","t":20,"T":60,"parts":[],"ai":{},"my":{"vote":None,"power":30,"army":2},"thr":100,"phase":"live","result":None},
 "diary":[{"tm":"01:00","x":"Старая запись","c":"","f":""}],
 "rivals":[{"id":"g2","name":"Матушка Плюшка","hero":"Агнесса Кочерга","pers":"heal","lvl":2,"w":3,"l":1,"army":1}],
 "speed":7,"tab":"powers","lastSeen":0}
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx0=await br.new_context(); pg=await ctx0.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(200)
        await pg.evaluate(f"localStorage.setItem('bogodel_save_v1', {json.dumps(json.dumps(OLD, ensure_ascii=False))})")
        await pg.reload(); await pg.wait_for_timeout(1500)
        r=await pg.evaluate('''(()=>{const S=GAME.S; return {v:S.v,god:S.god.name,faith:S.god.faith,max:GAME.maxFaith(),skills:S.god.skills,hp:S.hero.hp,state:S.hero.state,gold:S.hero.gold,inv:S.hero.inv.length,fol:S.flock.fol,
          fork:S.fork,speed:S.speed,stats:S.stats,ev:S.ev&&[S.ev.phase,S.ev.parts.length,S.ev.thr],rivals:S.rivals.length,g2:S.rivals.find(r=>r.id==='g2').hero+' '+S.rivals.find(r=>r.id==='g2').w,
          diary:S.diary.slice(0,3).map(d=>d.x), modal:document.getElementById('modal').classList.contains('on'), timers:S.timers}})()''')
        print(json.dumps(r,ensure_ascii=False,indent=1))
        await pg.wait_for_timeout(3000)
        ctx=pg.context
        await pg.close()
        pg=await ctx.new_page(); await pg.add_init_script("localStorage.setItem('bogodel_save_v1','{broken json')"); pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(500)
        print('corrupt -> onboarding:', await pg.evaluate("document.getElementById('modal').classList.contains('on')"), 'backup kept:', await pg.evaluate("localStorage.getItem('bogodel_save_v1_backup')"))
        print('errors', errs); await br.close()
asyncio.run(main())

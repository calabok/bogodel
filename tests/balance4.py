import asyncio, json, sys
from playwright.async_api import async_playwright
JS='''(N)=>{const G=GAME, out={};
 const fresh=(L,cls)=>{const s=G.defaultState('Тест','Гена','human',cls||'warrior'); G.S=s; const h=s.hero; h.lvl=L; for(let i=2;i<=L;i++) h.st[G.CLASSES[h.cls].prim]=Math.min(20,h.st[G.CLASSES[h.cls].prim]+(i%2));
   const c=G.CLASSES[h.cls]; h.eq.weapon.plus=Math.min(3,Math.floor(L/4)); h.eq.armor.ac+=Math.floor(L/5); h.maxHp=G.calcMaxHp(h); h.hp=h.maxHp; return s;};
 const classes=Object.keys(G.CLASSES), races=Object.keys(G.RACES);
 const bot=(L)=>G.botUnit({name:'Бот',race:races[Math.floor(Math.random()*races.length)],cls:classes[Math.floor(Math.random()*classes.length)],lvl:L});
 for(const L of [1,3,6,10]){
  const r={};
  for(const mode of ['1v1','mon','mon+1','3v3','boss']){
   let w=0,turns=0,hpl=0;
   for(let i=0;i<N;i++){
     const cls=classes[i%classes.length]; fresh(L,cls);
     let al=[G.heroUnit()], en;
     if(mode==='1v1') en=[bot(L)];
     else if(mode==='mon') en=[G.monsterUnit('Волк',L)];
     else if(mode==='mon+1') en=[G.monsterUnit('Волк',L+1)];
     else if(mode==='3v3'){al.push(bot(L),bot(L)); en=[bot(L),bot(L),bot(L)];}
     else {al.push(bot(L),bot(L),bot(L)); en=[G.monsterUnit('Голем',L+2,{hp:1.6+.45*4,dmg:1.15,boss:{m:['tele','adds','enrage','sweep'][i%4]}})];}
     const F=G.beginBattle('duel',al,en,{}); G.autoResolveBattle(F);
     if(F.win===0) w++; turns+=F.turn; const me=F.fighters.find(f=>f.isMe); hpl+=1-me.hp/me.max;
   }
   r[mode]={win:+(w/N).toFixed(2),turns:+(turns/N).toFixed(1),hpLost:+(hpl/N).toFixed(2)};
  }
  // пещера целиком на автопроходе
  let ok=0,carried=0,ttl=0; for(let i=0;i<Math.max(20,N/5);i++){ fresh(L,classes[i%classes.length]); const s=G.S; s.timers.dunCd=0;
    G.startDungeon(true); }
  out['L'+L]=r;
 }
 return out;}'''
DJS='''async (N)=>{const G=GAME,res={}; const classes=Object.keys(G.CLASSES);
 for(const L of [1,3,6,10]){ let ok=0,car=0,lost=0,turns=0, fights=0;
  for(let i=0;i<N;i++){ const s=G.defaultState('Тест','Гена','human',classes[i%classes.length]); G.S=s; const h=s.hero; h.lvl=L; for(let k=2;k<=L;k++) h.st[G.CLASSES[h.cls].prim]=Math.min(20,h.st[G.CLASSES[h.cls].prim]+(k%2)); h.eq.weapon.plus=Math.min(3,Math.floor(L/4)); h.eq.armor.ac+=Math.floor(L/5); h.maxHp=G.calcMaxHp(h); h.hp=h.maxHp;
   await G.startDungeon(true); if(!G.S.dun) continue; G.dunAutoFinish(); const d=s.diary.find(e=>e.x.startsWith('🏰')&&!e.x.includes('Спустился'));
   if(s.stats.bosses) ok++; else if(s.diary.some(e=>e.x.includes('Вынесли'))) car++; else lost++; }
  res['L'+L]={boss:ok/N,carried:car/N,other:lost/N};}
 return res;}'''
async def main():
    N=int(sys.argv[1]) if len(sys.argv)>1 else 150
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg=await br.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///workspace/godgame/index.html'); await pg.wait_for_timeout(300)
        await pg.click('[data-act=newGame]')
        await pg.evaluate("GAME.S.paused=true")
        r=await pg.evaluate(JS.replace("  // пещера целиком на автопроходе\n  let ok=0,carried=0,ttl=0; for(let i=0;i<Math.max(20,N/5);i++){ fresh(L,classes[i%classes.length]); const s=G.S; s.timers.dunCd=0;\n    G.startDungeon(true); }\n",""), N)
        d=await pg.evaluate(DJS, max(20,N//3))
        print(json.dumps({'fights':r,'dungeon':d},ensure_ascii=False)); print(errs[:5])
        await br.close()
asyncio.run(main())

# v12: симуляция полного сезона «Войны за Олимп» (28 дней) для разных стилей игры.
# python3 season12.py [profiles] [runs] [days]
import asyncio, json, sys
from playwright.async_api import async_playwright
PROF=(sys.argv[1] if len(sys.argv)>1 else 'hard,active,casual,absent').split(',')
RUNS=int(sys.argv[2]) if len(sys.argv)>2 else 1
DAYS=float(sys.argv[3]) if len(sys.argv)>3 else 28.5
URL=sys.argv[4] if len(sys.argv)>4 else 'file:///workspace/godgame/index.html'
SCHED={ # (час начала, минут онлайн)
 'hard':[(8,60),(12,60),(18,360)],
 'active':[(8.5,15),(13,15),(19,120),(22.5,15)],
 'casual':[(9,10),(21,20)],
 'absent':[(20,15)],   # первая неделя casual, дальше — раз в 3 дня
}
INIT='''(()=>{let VT=null;const dn=Date.now.bind(Date);Date.now=()=>VT===null?dn():VT;window.__vt=v=>{VT=v};})()'''
JS=r'''async ([prof,sched,DAYS])=>{
const G=GAME; let S=G.S; S.paused=true; S.speed=1;
const T0=Date.now(); let vt=T0; __vt(vt);
const H=3600, out={prof, samples:[], seasons:[], away:[], online:{h:0,log:0,flips:0,warn:0}, lvlAt:{}, errs:0};
const K=G.OLY_K, HAS=!!G.olyRanking;
if(!HAS){ G.olyRank=()=>0; G.olyOwned=()=>0; G.olyRanking=()=>[]; }
function owners(){const o={};for(const R of G.REGIONS)o[R.id]=G.S.oly.reg[R.id].own;return o}
function god(){
  S=G.S; const O=S.oly, h=S.hero, f=()=>S.god.faith;
  if(S.featOffer) G.chooseFeat(S.featOffer.opts[0]);
  if(!HAS) return;
  if(O.rew && O.gift<=0 && h.state!=='dead') G.olyGift();
  const ids=G.REGIONS.map(R=>R.id);
  // храмы: свои регионы и место героя
  const reserve = prof==='hard'?15:25;
  const tc=ids.filter(id=>(O.reg[id].tp.me||0)<K.tMax&&(G.myShare(id)>=K.tReq||h.reg===id))
     .sort((a,b)=>((O.reg[a].own==='me'?0:1)-(O.reg[b].own==='me'?0:1))||((O.reg[a].tp.me||0)-(O.reg[b].tp.me||0))||(G.myShare(b)-G.myShare(a)));
  if(tc.length && f()>=G.regTempleCost(tc[0])+reserve) G.olyTemple(tc[0]);
  if(prof==='casual'||prof==='absent') { // простые действия: храм + иногда герой в самый «свой» ничейный регион
    if(!O.dest && Math.random()<.3){ const t=ids.filter(id=>O.reg[id].own!=='me').sort((a,b)=>G.myShare(b)-G.myShare(a))[0]; if(t) G.olySend(t); }
    return;
  }
  // армия
  if(f()>60 && S.flock.fol>=6 && S.flock.army<30) G.recruit(prof==='hard'?3:2);
  // штурм: регион, где мы вторые и можем перевернуть
  if(S.flock.army>=8){
    let best=null,bv=0; for(const id of ids){const X=O.reg[id]; if(X.own==='me'||X.cdS>0) continue; const c=G.olyStormCalc(id,'me',Math.min(S.flock.army,K.stormMax)); const v=c.gain+(X.own?c.take:0)+G.mySouls(id)*.3; if(v>bv){bv=v;best=id}}
    if(best) G.olyStormMe(best, Math.min(S.flock.army,K.stormMax));
  }
  // дуэль за регион, если ведём борьбу
  if(f()>=30 && h.state==='road' && !S.fight && !S.dun){ const t=ids.filter(id=>{const X=O.reg[id]; return X.own&&X.own!=='me'&&X.cdD<=0&&G.myShare(id)>=.15}).sort((a,b)=>G.myShare(b)-G.myShare(a))[0]; if(t && Math.random()<.5) G.olyDuel(t); }
  // герой: защищать свой регион под угрозой, иначе идти туда, где ближе к захвату
  if(!O.dest && !(O.hold&&O.hold.t>0)){
    const thr=ids.filter(id=>O.reg[id].own==='me'&&G.regThreat(id)); 
    let t=thr.sort((a,b)=>G.regDist(h.reg,a)-G.regDist(h.reg,b))[0];
    if(!t){ t=ids.filter(id=>O.reg[id].own!=='me').map(id=>{const X=O.reg[id];let lead=0;for(const g in X.s) if(g!=='me') lead=Math.max(lead,X.s[g]); return {id,v:(G.mySouls(id)-lead)/G.REG_BY[id].pop - .05*G.regDist(h.reg,id)}}).sort((a,b)=>b.v-a.v)[0]?.id; }
    if(t) G.olySend(t);
  }
}
function forks(){S=G.S; if(S.fork && !G.forkPaused()){ if(S.fork.m && (prof==='hard'||prof==='active')){const bs=G.momentButtons(S.fork); const av=bs.map((b,k)=>k).filter(k=>!bs[k].dis&&!bs[k].cost); G.answerFork(av.length?av[Math.floor(Math.random()*av.length)]:0);} else if(!S.fork.m) G.answerFork(0);} }
function sample(day){ S=G.S; if(!HAS){out.samples.push({d:+day.toFixed(2),rank:0,regs:0,lvl:S.hero.lvl});return;} const rk=G.olyRanking(); out.samples.push({d:+day.toFixed(2), n:S.oly.n, rank:G.olyRank(), regs:G.olyOwned('me'), inf:Math.round(S.oly.inf.me||0), top:rk.slice(0,3).map(x=>x.g+':'+x.regs+':'+Math.round(x.inf)), lvl:S.hero.lvl, army:S.flock.army, faith:Math.round(S.god.faith)}); }
function seasonsCheck(){ S=G.S; if(HAS&&S.oly.last && !S.oly.last.seen){ out.seasons.push(S.oly.last); S.oly.last.seen=1; } }
const sess=[]; // список [начало (с от T0), длительность (с)]
for(let d=0; d<DAYS; d++){
  if(prof==='active' && d===14) continue; // день без игры: проверяем «сутки отсутствия»
  if(prof==='absent' && d>=7){ if(d%3) continue; }
  const sc = (prof==='absent' && d<7) ? [[9,10],[21,20]] : sched;
  for(const [hh,mm] of sc) sess.push([d*86400+hh*H, mm*60]);
}
let t=0, nextSample=0;
for(const [st,dur] of sess){
  if(st>=DAYS*86400) break;
  if(st>t){ const gap=st-t; const before={rank:G.olyRank(), regs:G.olyOwned('me'), n:HAS&&G.S.oly.n};
    vt=T0+st*1000; __vt(vt); G.S.lastSeen=vt-gap*1000; try{G.simulateAway(gap);}catch(e){out.errs++; out.lastErr=String(e)} t=st;
    const la=G.getLastAway?G.getLastAway():null; if(gap>=20*H) out.away.push({day:+(t/86400).toFixed(1), h:+(gap/H).toFixed(1), before, after:{rank:G.olyRank(), regs:G.olyOwned('me'), n:HAS&&G.S.oly.n}, oly:la&&la.oly});
    seasonsCheck(); }
  // онлайн-сессия
  const o0=HAS?owners():{}; let logN=0;
  for(let s=0;s<dur;s+=300){
    const n=Math.min(300,dur-s);
    for(let i=0;i<n;i++){ G.step(1); t+=1; if(i%30===0) forks(); }
    vt=T0+t*1000; __vt(vt); G.S.lastSeen=vt;
    try{god();}catch(e){out.errs++; out.lastErr=String(e)}
    seasonsCheck();
    await new Promise(r=>setTimeout(r,2));
  }
  const o1=HAS?owners():{}; let fl=0; for(const k in o0) if(o0[k]!==o1[k]) fl++;
  out.online.h+=dur/H; out.online.flips+=fl;
  for(let L=1;L<=G.S.hero.lvl;L++) if(!out.lvlAt[L]) out.lvlAt[L]=+(t/86400).toFixed(2);
  if(t>=nextSample){ sample(t/86400); nextSample+=6*H; }
}
// финал: дожить до DAYS
const endT=DAYS*86400; if(endT>t){ vt=T0+endT*1000; __vt(vt); G.S.lastSeen=vt-(endT-t)*1000; G.simulateAway(endT-t); t=endT; seasonsCheck(); }
sample(t/86400);
S=G.S; out.final={lvl:S.hero.lvl, xp:S.hero.xp, gs:G.gearScore(S.hero), gold:S.hero.gold, deaths:S.diary.filter(e=>e.c==='death').length, rew:HAS&&S.oly.rew, hist:HAS&&S.oly.hist};
return out;}'''
async def one(b, prof):
    pg=await b.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(INIT)
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.click('[data-act=newGame]'); await pg.wait_for_timeout(200)
    r=await pg.evaluate(JS,[prof,SCHED[prof],DAYS]); r['pageErrs']=errs[:3]; await pg.close(); return r
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for k in range(RUNS):
            for pr in PROF:
                r=await one(b,pr); r['run']=k
                print(json.dumps(r,ensure_ascii=False)); sys.stdout.flush()
        await b.close()
asyncio.run(main())

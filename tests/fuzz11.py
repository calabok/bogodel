# v11: fuzz10 + новый интерфейс (нижняя навигация, лента дневника, карточки сил, подсказка в бою)
import asyncio, sys, json, random
from playwright.async_api import async_playwright
URL='file:///workspace/godgame/index.html'
W,H,ITERS=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3])
SEED=int(sys.argv[4]) if len(sys.argv)>4 else 1
random.seed(SEED)
INV='''()=>{const S=GAME.S, e=[]; if(!S) return ['S null']; GAME.render();
 const walk=(o,p)=>{for(const k in o){const v=o[k]; if(typeof v==='number'&&!isFinite(v)) e.push('NaN '+p+'.'+k); else if(v&&typeof v==='object') walk(v,p+'.'+k);}}; walk(S,'S');
 const g=S.god,h=S.hero,f=S.flock;
 if(g.faith<-1e-9||g.faith>GAME.maxFaith()+1e-6) e.push('faith '+g.faith+'/'+GAME.maxFaith());
 if(f.fol<0) e.push('fol<0 '+f.fol); if(f.army<0) e.push('army<0'); if(h.gold<0) e.push('gold<0 '+h.gold); if(h.potions<0) e.push('potions<0');
 if(h.hp>h.maxHp) e.push('hp>max'); if(h.hp<0) e.push('hp<0 '+h.hp);
 if(h.state==='dead'&&h.hp!==0) e.push('dead but hp '+h.hp); if(h.state!=='dead'&&h.hp<=0) e.push('alive with hp '+h.hp);
 if(h.trust<0||h.trust>100) e.push('trust '+h.trust); if(g.align<-100||g.align>100) e.push('align');
 for(const k of Object.keys(h.eq)) if(!GAME.EQ_KEYS.includes(k)) e.push('bad eq key '+k);
 if(h.eq.weapon&&h.eq.weapon.h2&&h.eq.offhand) e.push('2h + offhand');
 if(h.eq.offhand&&h.eq.offhand.slot==='weapon'&&h.cls!=='rogue') e.push('offhand weapon non-rogue');
 if(h.inv.length>16) e.push('inv>16');
 for(const k of GAME.EQ_KEYS){const it=h.eq[k]; if(it&&!['weapon','offhand','helm','armor','belt','gloves','boots','amulet','ring'].includes(it.slot)) e.push('bad item slot '+k);}
 if(!h.bld||!GAME.BUILDS[h.bld.id]) e.push('no build'); else { if(h.bld.re&&(h.bld.re.pts<1||h.bld.re.from===h.bld.id)) e.push('bad respec'); if(h.bld.cd<0) e.push('bld cd<0'); }
 for(const k in h.st) if(h.st[k]<1||h.st[k]>20) e.push('stat out of range '+k+' '+h.st[k]);
 if('duel' in S) e.push('old duel field'); if(S.fork&&!GAME.forkPaused()&&document.querySelector('#forkBox .fork')&&false) e.push(''); if(S.fork&&GAME.forkPaused()&&document.querySelector('#forkBox .fork')) e.push('fork card visible while paused'); if(S.fork&&!GAME.forkPaused()&&!document.querySelector('#forkBox .fork')) e.push('fork card missing'); if(S.fork&&S.fork.m&&!(S.fork.t>0&&S.fork.t<=GAME.MOM_T)) e.push('mom timer '+S.fork.t); if(S.fork&&S.fork.m){const bs=document.querySelectorAll('#forkBox [data-act=fork]'); if(bs.length&&(bs.length<2||bs.length>3||!/Ничего не делать/.test(bs[bs.length-1].textContent))) e.push('mom buttons '+bs.length);} if(S.fork&&h.state==='dead') e.push('fork while dead');
 if((h.state==='fight')!==!!h.monster) e.push('fight/monster mismatch '+h.state);
 const F=S.fight, AK=['duel','group','chaos','godduel'];
 if(F){ if(!['intro','turn','end'].includes(F.phase)) e.push('fight phase '+F.phase);
  if(F.phase!=='end'){ if(AK.includes(F.kind)&&h.state!=='duel') e.push('arena fight but hero '+h.state);
   if(F.kind==='monster'&&!(h.state==='fight'&&h.monster)) e.push('monster fight but hero '+h.state);
   if(F.kind==='dungeon'&&!(S.dun&&S.dun.phase==='fight')) e.push('dungeon fight w/o dun fight phase');
   if(!F.fighters.some(f=>f.alive&&f.team===0)||!F.fighters.some(f=>f.alive&&f.team===1)) e.push('fight continues with wiped team'); }
  const me=F.fighters.find(f=>f.isMe); if(!me) e.push('no me in fight'); else { if(F.my.atk.length>me.atkN||F.my.blk.length>me.blkN) e.push('too many zones'); if(F.my.atk.concat(F.my.blk).some(z=>!GAME.ZONES.includes(z))) e.push('bad zone'); }
  if(!(F.powersLeft>=0&&F.powersLeft<=3)) e.push('powersLeft '+F.powersLeft); if(F.usedTurn>1) e.push('usedTurn '+F.usedTurn);
  for(const f of F.fighters){ if(f.hp<0||f.hp>f.max) e.push('fighter hp '+f.name+' '+f.hp+'/'+f.max); if(f.alive&&f.hp<=0) e.push('alive with 0 hp '+f.name); }
  if(F.turn>41) e.push('fight too long '+F.turn);
  if(S.dun&&F.kind!=='dungeon'&&F.phase!=='end') e.push('arena fight inside dungeon'); }
 if(S.dun){ const U=S.dun; if(U.phase==='fight'&&!(F&&F.kind==='dungeon')) e.push('dun fight phase without fight');
  const t=U.tiles[U.pos.y*5+U.pos.x]; if(!t) e.push('dun pos off map'); if(U.keys<0) e.push('keys<0'); if(U.party.filter(p=>p.isMe).length!==1) e.push('party me');
  for(const p of U.party) if(!p.isMe&&(p.hp<0||p.hp>100)) e.push('party hp '+p.hp); }
 if(h.inj.length>4) e.push('inj>4'); for(const j of h.inj) if(!(j.t>0)||!['light','mid','heavy'].includes(j.k)) e.push('bad inj '+JSON.stringify(j));
 if(S.chat.msgs.length>60) e.push('chat>60'); if(S.arena.apps.filter(a=>a.joined!==null).length>1) e.push('in 2 apps');
 for(const a of S.arena.apps){ const n=a.type==='chaos'?a.members.length:a.teams[0].length+a.teams[1].length; if(n>(a.type==='chaos'?a.size:a.size*2)) e.push('app overfull '+a.id); }
 if(S.arena.rating<100) e.push('rating '+S.arena.rating);
 if(F&&F.phase==='turn'){ for(const b of document.querySelectorAll('.zb')){const r=b.getBoundingClientRect(); if(r.width&&(r.height<38||r.width<44)) {e.push('zone btn small '+Math.round(r.width)+'x'+Math.round(r.height)); break;}} }
 for(const k in g.skills) if(g.skills[k]<0||g.skills[k]>3) e.push('skill '+k);
 if(g.sp<0) e.push('sp<0'); if(h.inv.length>12) e.push('inv '+h.inv.length); if(S.diary.length>150) e.push('diary>150');
 if(S.ev&&S.ev.my.power<0) e.push('ev power<0');
 if(S.dun&&S.dun.phase!=='end'&&h.state!=='dungeon') e.push('dun but hero '+h.state);
 if(h.state==='dungeon'&&!S.dun&&!GAME.dunPending) e.push('hero dungeon without dun');
 if(h.state==='duel'&&!(S.fight&&S.fight.phase!=='end')&&!GAME.duelPending) e.push('hero duel without fight');
 if(!['road','fight','town','dead','duel','rest','dungeon'].includes(h.state)) e.push('bad state '+h.state);
 if(!GAME.RACES[h.race]||!GAME.CLASSES[h.cls]) e.push('bad race/cls');
 for(const k of ['str','dex','con','int','wis','cha']) if(!(h.st[k]>=1&&h.st[k]<=30)) e.push('stat '+k+'='+h.st[k]);
 if(h.lvl<1||h.lvl>GAME.MAX_LVL) e.push('lvl '+h.lvl); if(h.lvl<GAME.MAX_LVL&&h.xp>=GAME.xpNext(h.lvl)) e.push('xp>=next '+h.xp);
 if(h.maxHp!==GAME.calcMaxHp(h)) e.push('maxHp stale '+h.maxHp+' vs '+GAME.calcMaxHp(h));
 for(const sl of ['weapon','armor','amulet','ring']){const it=h.eq[sl]; if(it&&(it.slot!==sl||!(it.rar>=0&&it.rar<=4)||!Array.isArray(it.props)||!it.n)) e.push('bad item '+sl);}
 if(S.featOffer&&(!Array.isArray(S.featOffer.opts)||S.featOffer.opts.some(f=>!GAME.FEATS[f]||h.feats.includes(f)))) e.push('bad featOffer');
 if(new Set(h.feats).size!==h.feats.length) e.push('dup feats');
 if(S.featQueue<0) e.push('featQueue<0');
 for(const d of S.diary.slice(0,20)) if(/undefined|NaN|\\{\\w+\\}|null/.test(d.x+d.f)) e.push('bad text: '+d.x+' '+d.f);
 const fm=document.getElementById('faithMeter').getBoundingClientRect();
 if(fm.top<-1||fm.bottom>innerHeight+1||fm.width<120||fm.height<16) e.push('faith meter not visible '+JSON.stringify(fm));
 if(!document.getElementById('modal').classList.contains('on')&&!(S.chat.open&&innerWidth<=760)){const el=document.elementFromPoint(fm.left+fm.width/2,fm.top+fm.height/2); if(!el||!el.closest('#faithMeter')) e.push('faith meter covered by '+(el&&el.className));}
 const hb=document.getElementById('hpMeter').getBoundingClientRect();
 if(hb.top<-1||hb.bottom>innerHeight+1||hb.width<100||hb.height<16) e.push('hp meter not visible '+JSON.stringify(hb));
 if(!document.getElementById('modal').classList.contains('on')&&!(S.chat.open&&innerWidth<=760)){const el=document.elementFromPoint(hb.left+hb.width/2,hb.top+hb.height/2); if(!el||!el.closest('#hpMeter')) e.push('hp meter covered by '+(el&&el.className));}
 const ht=document.getElementById('hHp').textContent; if(h.state==='dead'?!/мёртв/.test(ht):!(new RegExp('(HP: )?'+Math.max(0,h.hp)+' / '+h.maxHp)).test(ht)) e.push('hp text '+ht+' vs '+h.hp+'/'+h.maxHp+' '+h.state);
 const hs=document.getElementById('hHp'); if(hs.scrollWidth>hs.clientWidth+1) e.push('hp text clipped '+ht);
 const t=document.getElementById('hFaith').textContent; if(!/🔥 \\d+ \\/ \\d+/.test(t)||Math.floor(g.faith)!==+t.match(/🔥 (\\d+)/)[1]) e.push('faith text '+t);
 if(document.documentElement.scrollWidth>innerWidth+2) e.push('horizontal overflow '+document.documentElement.scrollWidth);
 if(!S.ui||!GAME.NAV_TABS.includes(S.ui.mtab)||!GAME.NAV_TABS.includes(S.tab)) e.push('bad mtab '+S.ui.mtab+'/'+S.tab);
 const nvb=document.getElementById('mnav').getBoundingClientRect(); if(nvb.height<40||nvb.bottom>innerHeight+1) e.push('nav not visible');
 if(innerWidth<=760&&!document.getElementById('modal').classList.contains('on')&&!S.chat.open){ for(const b of document.querySelectorAll('button')){ if(!b.offsetParent) continue; const r=b.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight||!r.width) continue; if(r.height<39.5){ e.push('small button '+(b.dataset.act||b.className)+' '+Math.round(r.height)); break; } } }
 { const ds=document.querySelectorAll('#diary .entry').length; if(ds>GAME.diaryLim||ds!==Math.min(S.diary.length,GAME.diaryLim)) e.push('diary dom '+ds+' vs '+S.diary.length); const fe=document.querySelector('#diary .entry'); if(fe&&S.diary[0]&&+fe.dataset.id!==S.diary[0].i) e.push('diary top stale'); }
 if(innerWidth<=760){ const nv=document.getElementById('mnav').getBoundingClientRect(); if(nv.height<40||nv.bottom<innerHeight-2) e.push('mnav not at bottom '+JSON.stringify(nv));
   if(document.body.dataset.mtab!==S.ui.mtab) e.push('body mtab stale');
   if(S.ui.mtab==='hero'&&S.fight&&S.fight.phase!=='end'&&!document.getElementById('fightBox').offsetParent) e.push('fight hidden on hero tab');
   if(S.ui.mtab!=='hero'&&!document.getElementById('colRight').offsetParent) e.push('right panel hidden on '+S.ui.mtab);
   if((S.fight||S.dun||(S.fork&&!GAME.forkPaused()))&&S.ui.mtab!=='hero'&&!document.querySelector('#mBanner .mban')) e.push('no active banner on '+S.ui.mtab);
 } else if(!document.getElementById('colHero').offsetParent||!document.getElementById('colRight').offsetParent||!document.getElementById('diaryCard').offsetParent) e.push('desktop column hidden');
 return e;}'''
ACT='''(r)=>{const modal=document.getElementById('modal').classList.contains('on');
 const root=modal?document.getElementById('modal'):document;
 let bs=[...root.querySelectorAll('[data-act]')].filter(b=>!b.disabled&&b.offsetParent!==null&&!['reset','newGame'].includes(b.dataset.act));
 if(!modal) bs=bs.filter(b=>(!['speed','speedCycle','sheet','help','pause'].includes(b.dataset.act))||Math.random()<.05);
 const pri=bs.filter(b=>['bldOpen','bldPick','bldPick','dpotion','fpot','fflee','itemD','itemD','equipInv','smith','liftS','sheet','fork','fz','fz','fz','fgo','ftarget','fpow','fauto','fclose','fmanual','dgo','dgo','dgo','dauto','dclose','apost','ajoin','aleave','chatToggle','evGive','evVote','evArmy','pprev','powerGo','learnGo','fhint','dexp','heroCol','dmore','pprev','powerGo','temple','miracle','recruit','challenge','resurrect','closeEv','feat','asi','asiOpen','lift','liftS','callDun','dunTier','dunTier','smith','sheet','mtab','mtab','dheal','dleave'].includes(b.dataset.act));
 const pool=(pri.length&&r<.8)?pri:bs; if(!pool.length) return 'none';
 const b=pool[Math.floor(Math.random()*pool.length)]; b.click(); return b.dataset.act+':'+(b.dataset.arg||'');}'''
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':W,'height':H})
        pg=await ctx.new_page(); errs=[]; inv_errs={}
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type in('error','warning') else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        await pg.click('[data-act=newGame]'); await pg.evaluate('GAME.S.speed=10')
        acts={}; seen=set(); reloads=0; maxlvl=0
        for i in range(ITERS):
            r=random.random()
            if r<0.015 and await pg.evaluate("GAME.S.chat.open") and await pg.is_visible('#chatIn'):
                await pg.fill('#chatIn', random.choice(['привет всем','кто в хаот?','<img src=x onerror=alert(1)>','бой!','лол','пельмень']))
                await pg.press('#chatIn','Enter')
            elif r<0.02: await pg.evaluate("GAME.S.tab='arena'")
            elif r<0.03 and await pg.is_visible('#voiceIn'):
                await pg.fill('#voiceIn', random.choice(['лечись','бей','копай','привет','беги','{god} молодец','<b>x</b>','в город','вперёд']))
                await pg.press('#voiceIn','Enter')
            elif r<0.05: await pg.mouse.wheel(0, random.choice([-2000,600,2000]))
            elif r<0.075:
                await pg.evaluate(f'GAME.simulateAway({random.choice([600,3600,4*3600,12*3600])}); GAME.S.god.faith=Math.min(GAME.maxFaith(), GAME.S.god.faith+60)')
            elif r<0.14:
                await pg.evaluate("(()=>{const S=GAME.S; if(!S.fork) GAME.startFork(); else if(Math.random()<.3) S.fork.t=0.3; GAME.render();})()")
            elif r<0.17:
                # debug triggers via settings
                await pg.evaluate("document.querySelector('[data-act=settings]').click()")
                await pg.evaluate(f"(()=>{{const b=[...document.querySelectorAll('#modal [data-act=dbg]')]; b[{random.randint(0,13)}%b.length].click();}})()")
            elif r<0.11 and i>20:
                before=await pg.evaluate("JSON.stringify((s=>({g:s.god.lvl,sk:s.god.skills,h:s.hero.lvl,w:Object.values(s.hero.eq).map(i=>i&&i.id),st6:s.hero.st,ft:s.hero.feats,un:s.dun&&s.dun.id,t:s.flock.temple,st:s.stats,fk:s.fork&&(s.fork.m||s.fork.i),fi:s.fight&&s.fight.id,fl:s.fight&&s.fight.fighters.map(f=>f.hp),ar:s.arena.rating,inj:s.hero.inj.length,ev:s.ev&&s.ev.id,ui:s.ui,rv:s.rivals.map(r=>r.w+':'+r.l)}))(GAME.S))")
                await pg.evaluate('GAME.save()'); await pg.reload(); await pg.wait_for_timeout(100)
                after=await pg.evaluate("JSON.stringify((s=>({g:s.god.lvl,sk:s.god.skills,h:s.hero.lvl,w:Object.values(s.hero.eq).map(i=>i&&i.id),st6:s.hero.st,ft:s.hero.feats,un:s.dun&&s.dun.id,t:s.flock.temple,st:s.stats,fk:s.fork&&(s.fork.m||s.fork.i),fi:s.fight&&s.fight.id,fl:s.fight&&s.fight.fighters.map(f=>f.hp),ar:s.arena.rating,inj:s.hero.inj.length,ev:s.ev&&s.ev.id,ui:s.ui,rv:s.rivals.map(r=>r.w+':'+r.l)}))(GAME.S))")
                if before!=after: inv_errs.setdefault('save/load mismatch',[before,after])
                reloads+=1
            else:
                a=await pg.evaluate(ACT, random.random()); k=a.split(':')[0]; acts[k]=acts.get(k,0)+1
            await pg.evaluate("GAME.S.paused=false;GAME.S.speed=10")
            await pg.wait_for_timeout(random.choice([100,250,400]))
            e=await pg.evaluate(INV)
            for x in e:
                key=x.split(' ')[0]+' '+(x.split(' ')[1] if len(x.split(' '))>1 else '')
                inv_errs.setdefault(x[:70],i)
            st=await pg.evaluate('[GAME.S.fork&&(GAME.S.fork.m?"mom":"pray"),GAME.S.fight&&(GAME.S.fight.kind+\'/\'+GAME.S.fight.phase),GAME.S.ev&&GAME.S.ev.phase,GAME.S.hero.state,GAME.S.dun&&GAME.S.dun.phase,!!GAME.S.featOffer,GAME.S.hero.lvl,GAME.S.god.lvl]')
            for name,val in (('fork',st[0]),('fight',st[1]),('event',st[2]),('state_'+st[3],True)):
                if val: seen.add(name+('' if val is True else ':'+str(val)))
            maxlvl=st[6]
            if st[4]: seen.add('dun:'+st[4])
            if st[5]: seen.add('feat')
        shot=f'/workspace/godgame/fuzz_{W}x{H}.png'
        await pg.evaluate('window.scrollTo(0, 400)'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot)
        print(json.dumps({'vp':f'{W}x{H}','iters':ITERS,'reloads':reloads,'heroLvl':maxlvl,'godLvl':st[7],'seen':sorted(seen),'acts':acts,'invariant_violations':inv_errs,'js_errors':errs[:30]},ensure_ascii=False,indent=1))
        await br.close()
asyncio.run(main())

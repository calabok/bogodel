// Балансные симуляции БогоДел (выполняются в странице игры). window.BAL.*
window.BAL = (() => {
  const G = GAME, CL = () => Object.keys(G.CLASSES);
  const RACE_FOR = { warrior: 'human', mage: 'elf', rogue: 'halfling', cleric: 'dwarf', bard: 'tiefling', ranger: 'elf', barbarian: 'orc' };
  // «Типичный» герой уровня L: прирост характеристик, черты-ASI, снаряжение по уровню
  function hero(L, cls, race) {
    race = race || RACE_FOR[cls];
    const s = G.defaultState('Бог', 'Гена', race, cls); G.S = s; s.paused = true; s.timers.fork = s.timers.duel = s.timers.dun = s.timers.event = 1e9;
    const h = s.hero, c = G.CLASSES[cls]; h.lvl = L;
    for (let i = 2; i <= L; i++) { if (i % 2) h.st[c.prim] = Math.min(20, h.st[c.prim] + 1); else { h.st[c.prim] = Math.min(20, h.st[c.prim] + 1); h.st.con = Math.min(20, h.st.con + 1); } }
    const rar = L < 3 ? 0 : L < 7 ? 1 : L < 12 ? 2 : 3;
    const put = (sl, r) => { for (let t = 0; t < 4; t++) { const it = G.makeItem(sl, L, r); it.curse = null; it.n = nameOf(it); if (!G.reqOk(h, it) && t < 3) continue; const b = G.bestPlace(h, it, true, true); if (b) { applyPlace(h, it, b); return; } } };
    if (L >= 2) { put('weapon', rar); put('armor', rar); put('helm', rar); put('boots', rar); }
    if (L >= 3) { put('belt', rar); put('gloves', rar); if (!(h.eq.weapon && h.eq.weapon.h2)) put(cls === 'rogue' ? 'weapon' : 'offhand', rar); }
    if (L >= 4) for (const sl of ['amulet', 'ring', 'ring']) put(sl, Math.max(1, rar - 1));
    h.inv = [];
    h.maxHp = G.calcMaxHp(h); h.hp = h.maxHp; h.potions = 1; s.god.lvl = Math.max(1, Math.ceil(L / 2)); s.god.faith = G.maxFaith();
    return s;
  }
  function road(L, cls, N) {
    let w = 0, d = 0, lost = 0, rounds = 0;
    for (let i = 0; i < N; i++) { const s = hero(L, cls); const h = s.hero; h.state = 'road'; G.startFight(); let k = 0;
      while (h.state === 'fight' && k < 60) { G.heroStep(); k++; } rounds += k;
      if (h.state === 'dead' || h.hp <= 0) d++; else { w++; lost += 1 - h.hp / h.maxHp; } }
    return { win: +(w / N).toFixed(3), death: +(d / N).toFixed(3), hpLost: +(lost / Math.max(1, w)).toFixed(2), steps: +(rounds / N).toFixed(1) };
  }
  function bot(L, cls) { const c = cls || CL()[Math.floor(Math.random() * 7)]; return G.botUnit({ name: 'Бот', race: RACE_FOR[c], cls: c, lvl: L }); }
  function zone(L, cls, N, mode) {
    let w = 0, t = 0, hpl = 0;
    for (let i = 0; i < N; i++) { hero(L, cls); const al = [G.heroUnit()]; let en;
      if (mode === 'mon') en = [G.monsterUnit('Волк', L)];
      else if (mode === 'elite') en = [G.monsterUnit('Волк', L, { elite: 1 })];
      else if (mode === 'bot') en = [bot(L)];
      else en = [bot(L, cls)];
      const F = G.beginBattle('duel', al, en, {}); G.autoResolveBattle(F);
      if (F.win === 0) w++; t += F.turn; const me = F.fighters.find(f => f.isMe); hpl += 1 - me.hp / me.max; }
    return { win: +(w / N).toFixed(3), turns: +(t / N).toFixed(1), hpLost: +(hpl / N).toFixed(2) };
  }
  return { hero, road, zone, bot, RACE_FOR, classes: CL };
})();
// ---------- Пещеры: автопроход vs «умный бог» ----------
window.BAL.smartChoice = function (F, good) {
  const me = fMe(F); if (!me || !me.alive) return;
  const en = fEnemies(F, me), b = botBrain(F, me);
  const boss = en.find(e => e.boss), adds = en.filter(e => !e.boss);
  let tgt = en.slice().sort((x, y) => x.hp - y.hp)[0];
  if (boss && boss.boss.m !== 'adds' && adds.length && adds.every(a => a.hp > boss.hp)) tgt = boss;
  F.my.target = tgt.id; F.my.atk = b.atk;
  F.my.blk = F.tele && !(good && Math.random() < .15) && F.fighters.find(x => x.id === F.tele.fid).team !== me.team ? blkSet(F.tele.zone, me.blkN) : b.blk;
  F.ready = true;
  const has = id => S.god.skills[id] && S.god.faith >= powerCost(id) && F.powersLeft > 0 && F.usedTurn < 1;
  const isBoss = !!F.ctx.boss, reserve = isBoss ? 0 : 35;
  if (me.hp < me.max * (isBoss ? .45 : .3) && has('heal') && S.god.faith - powerCost('heal') >= reserve) fightPower('heal');
  else if (isBoss && F.tele && has('shield') && me.hp < me.max * .6) fightPower('shield');
  else if (isBoss && has('bolt') && S.god.faith > 45) { F.my.target = (boss || tgt).id; fightPower('bolt'); F.my.target = tgt.id; }
};
window.BAL.smartRoute = function (U) {
  const h = S.hero, start = U.pos.y * DW + U.pos.x;
  const cost = i => { const t = U.tiles[i]; if (!t) return Infinity; if (t.done) return .1; if (!(t.seen)) return 2;
    return { empty: .2, start: .1, key: .1, shrine: .1, chest: 1.5, trap: 3, fight: 4, elite: 8, boss: (U.keys > 0 ? .1 : Infinity) }[t.t]; };
  const dist = new Array(DW * DH).fill(Infinity), prev = new Array(DW * DH).fill(-1), done = new Set(); dist[start] = 0;
  while (true) { let u = -1, m = Infinity; for (let i = 0; i < DW * DH; i++) if (!done.has(i) && dist[i] < m) { m = dist[i]; u = i; } if (u < 0) break; done.add(u);
    const x = u % DW, y = Math.floor(u / DW); if (u !== start && U.tiles[u] && !U.tiles[u].done && U.tiles[u].t !== 'empty' && u !== start) { /* не проходим насквозь непройденные комнаты */ if (U.tiles[u].seen && !['empty', 'start'].includes(U.tiles[u].t)) continue; if (!U.tiles[u].seen) continue; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= DW || ny >= DH) continue; const j = ny * DW + nx, c = cost(j); if (dist[u] + c < dist[j]) { dist[j] = dist[u] + c; prev[j] = u; } } }
  const goals = [];
  for (let i = 0; i < DW * DH; i++) { const t = U.tiles[i]; if (!t || t.done || i === start || dist[i] === Infinity) continue;
    let v = dist[i];
    if (t.t === 'boss' && U.keys > 0) v += (h.hp / h.maxHp < .6 && U.tiles.some(x => x && x.t === 'shrine' && !x.done && x.seen) ? 20 : 0);
    else if (t.t === 'key' && t.seen) v -= 50; else if (t.t === 'shrine' && t.seen) v -= (h.hp / h.maxHp < .75 ? 30 : 0);
    else if (!t.seen) v += 0; else if (U.keys > 0) v += 30; // ключ есть — лишнего не трогаем
    goals.push([v, i]); }
  if (!goals.length) return null; goals.sort((a, b) => a[0] - b[0]);
  let j = goals[0][1]; while (prev[j] !== start && prev[j] >= 0) j = prev[j];
  return { x: j % DW, y: Math.floor(j / DW) };
};
// Подогнать снаряжение героя под целевой ГС (±2): +N, затем кольцо/амулет, затем базовая вещь
window.BAL.fitGS = function (target) {
  const h = S.hero, sl = EQ_KEYS; let k = 0;
  while (gearScore(h) < target - 2 && k++ < 80) { const c = sl.filter(x => h.eq[x] && (h.eq[x].plus || 0) < smithCap(h.eq[x])); const em = EQ_KEYS.find(x => !h.eq[x] && !(x === 'offhand' && h.eq.weapon && h.eq.weapon.h2)); if (em) { const it = makeItem(em === 'ring2' ? 'ring' : em === 'offhand' && h.cls === 'rogue' ? 'weapon' : em, h.lvl, 1); if (em === 'offhand' && h.cls === 'rogue') { it.cat = 'dagger'; delete it.h2; } it.curse = null; h.eq[em] = it; continue; } if (!c.length) { const r = sl.filter(x => h.eq[x] && h.eq[x].rar < 4); if (!r.length) break; h.eq[r[Math.floor(Math.random() * r.length)]].rar++; continue; } h.eq[c[Math.floor(Math.random() * c.length)]].plus++; }
  while (gearScore(h) > target + 2 && k++ < 160) { const c = sl.filter(x => h.eq[x] && h.eq[x].plus > 0); if (c.length) { h.eq[c[Math.floor(Math.random() * c.length)]].plus--; continue; }
    { const dk = ['ring2', 'ring', 'amulet', 'gloves', 'belt'].find(x => h.eq[x]); if (dk) { h.eq[dk] = null; continue; } }
    const w = h.eq.weapon, ar = h.eq.armor; if (w && w.props.length) { w.props.pop(); continue; } if (ar && ar.props.length) { ar.props.pop(); continue; }
    if (w && w.rar > 0) { w.rar--; continue; } if (ar && ar.rar > 0) { ar.rar--; continue; } if (ar && ar.ac > 1) { ar.ac--; continue; } if (w && w.die > 4) { w.die -= 2; continue; } break; }
  for (const x of sl) { const it = h.eq[x]; if (it && !it.unique) it.n = it.base + (it.plus ? ` +${it.plus}` : '') + (it.props[0] ? ' ' + PROP_DEF[it.props[0].k].n : ''); }
  h.maxHp = calcMaxHp(h); h.hp = h.maxHp; return gearScore(h);
};
window.BAL.dun = async function (L, cls, N, policy, tier, q) {
  const out = { bossFight: 0, boss: 0, carried: 0, left: 0, nokey: 0, fights: 0, heroHp: 0, gold: 0, xp: 0, gs: 0 };
  for (let i = 0; i < N; i++) {
    const s = BAL.hero(L, cls); s.god.skills.bless = s.god.lvl >= 2 ? 1 : 0; s.god.skills.shield = s.god.lvl >= 4 ? 1 : 0;
    s.god.faith = Math.round(maxFaith() * .7); s.timers.dunCd = 0; S.hero.inj = [];
    if (q) { out.gs += BAL.fitGS(Math.round(q * recGS(L, tier || 'normal'))); }
    const xp0 = S.hero.xp + 0, g0 = S.hero.gold, lv0 = S.hero.lvl;
    await startDungeon(true, tier); if (!S.dun) { i--; continue; }
    const U = S.dun; U.auto = true; let k = 0, res = null;
    while (S.dun && k++ < 400) {
      if (S.fight) { const F = S.fight; if (F.ctx.boss && !F._c) { F._c = 1; out.bossFight++; }
        if (policy !== 'auto') { F.auto = false; let q = 0; while (S.fight === F && F.phase !== 'end' && q++ < 200) { if (F.phase === 'intro') nextTurn(F); else { BAL.smartChoice(F, policy === 'good'); if (F.phase === 'turn') resolveTurn(F); } } if (S.fight === F) closeFight(); }
        else autoResolveBattle(F); continue; }
      if (S.dun.phase === 'end') { res = S.dun.result; break; }
      if (policy === 'good' && Math.random() < .2) { dunAutoStep(); continue; }
      if (policy !== 'auto') { const h = S.hero; const bossNext = (() => { const n = BAL.smartRoute(S.dun); return n && S.dun.tiles[n.y * DW + n.x].t === 'boss'; })();
        if ((h.hp / h.maxHp < .5 || (bossNext && h.hp / h.maxHp < .8)) && (S.dun.heals || 0) < DUN_K.heals && S.god.faith >= dunHealCost()) dunHeal();
        const n = BAL.smartRoute(S.dun); if (!n) { endDungeon(false, 'nokey'); continue; } dunMove(n.x + ',' + n.y); }
      else dunAutoStep();
    }
    const r = res || '';
    if (r.includes('Босс повержен')) out.boss++; else if (r.includes('вынесли')) out.carried++; else if (r.includes('Ключ')) out.nokey++; else out.left++;
    out.fights += U.fights; out.heroHp += S.hero.hp / S.hero.maxHp; out.gold += S.hero.gold - g0; out.xp += S.hero.xp - xp0 + (S.hero.lvl - lv0) * 1e3;
  }
  for (const k in out) out[k] = +(out[k] / N).toFixed(3);
  return out;
};

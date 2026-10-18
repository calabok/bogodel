
/* =====================================================================
   13) ПЕЩЕРЫ: карта комнат, отряд, ключи, ловушки, босс
   ===================================================================== */
let dunPending = false;
const DW = 5, DH = 5;
function ulog(t, c) { const U = S.dun; U.log.unshift({ t, c: c || 'sys' }); if (U.log.length > 40) U.log.length = 40; }
const tileAt = (U, x, y) => x >= 0 && y >= 0 && x < DW && y < DH ? U.tiles[y * DW + x] : null;
function genDungeon(lvl) {
  const tiles = new Array(DW * DH).fill(null), sx = rnd(0, DW - 1), sy = DH - 1, N = rnd(12, 15);
  const rooms = [[sx, sy]]; tiles[sy * DW + sx] = { t: 'start', seen: 1, done: 1 };
  let guard = 0;
  while (rooms.length < N && guard++ < 500) {
    const [x, y] = pick(rooms), [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1], [0, -1]]), nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= DW || ny >= DH || tiles[ny * DW + nx]) continue;
    tiles[ny * DW + nx] = { t: 'empty', seen: 0, done: 0 }; rooms.push([nx, ny]);
  }
  // расстояния от входа
  const dist = new Array(DW * DH).fill(-1), q = [[sx, sy]]; dist[sy * DW + sx] = 0;
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * DW + nx; if (nx >= 0 && ny >= 0 && nx < DW && ny < DH && tiles[i] && dist[i] < 0) { dist[i] = dist[y * DW + x] + 1; q.push([nx, ny]); } } }
  const idx = rooms.map(([x, y]) => y * DW + x).filter(i => tiles[i].t !== 'start');
  const boss = idx.reduce((b, i) => dist[i] > dist[b] ? i : b, idx[0]);
  tiles[boss].t = 'boss';
  const rest = idx.filter(i => i !== boss).sort(() => R() - .5);
  const keyI = rest.findIndex(i => dist[i] >= 2); const key = rest.splice(keyI >= 0 ? keyI : 0, 1)[0]; tiles[key].t = 'key';
  const plan = ['fight', 'fight', 'fight', 'fight', 'fight', 'trap', 'trap', 'chest', 'chest', 'shrine'];
  rest.forEach((i, k) => { if (plan[k]) tiles[i].t = plan[k]; });
  // глубина комнаты: чем дальше от входа, тем злее; дальние логова — элитные
  for (const i of idx) tiles[i].d = dist[i];
  const deep = idx.filter(i => tiles[i].t === 'fight').sort((a, b) => dist[b] - dist[a]);
  deep.slice(0, 2).forEach(i => { if (dist[i] >= 2) tiles[i].t = 'elite'; });
  const B = pick(BOSSES);
  return { tiles, pos: { x: sx, y: sy }, boss: { n: B.n, m: B.m, d: B.d } };
}
function dunReveal(U) {
  const r = U.party.some(p => p.cls === 'ranger' && (p.isMe || p.hp > 0)) ? 2 : 1;
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const t = tileAt(U, x, y); if (t && Math.abs(x - U.pos.x) + Math.abs(y - U.pos.y) <= r) t.seen = 1; }
}
const dunHas = (U, cls) => U.party.some(p => p.cls === cls && (p.isMe ? S.hero.state !== 'dead' : p.hp > 0));
async function startDungeon(byCall) {
  if (S.dun || S.fight || S.fork || duelPending || dunPending) return false;
  const h = S.hero; if (h.state === 'dead' || h.state === 'duel' || h.state === 'dungeon') return false;
  if (!byCall && S.timers.dunCd > 0) return false;
  const st = S; h.state = 'dungeon'; h.monster = null; h.restT = 0; dunPending = true;
  let mates;
  try { mates = await rivals.formParty({ heroLvl: h.lvl, godLvl: S.god.lvl }); } finally { dunPending = false; }
  if (S !== st || h.state !== 'dungeon' || S.fight || S.dun) { if (S === st && h.state === 'dungeon' && !S.dun) h.state = 'road'; return false; }
  const party = [{ godId: 'me', god: S.god.name, hero: h.name, race: h.race, cls: h.cls, lvl: h.lvl, isMe: true, hp: 100 }]
    .concat(mates.map(m => ({ godId: m.godId, god: m.god, hero: m.hero, race: m.race, cls: m.cls, lvl: m.heroLvl, pers: m.pers, hp: 100 })));
  const G = genDungeon(h.lvl);
  S.dun = { id: 'd' + Date.now().toString(36), name: pick(DUN_NAMES), tier: h.lvl, tiles: G.tiles, pos: G.pos, boss: G.boss, party, keys: 0, log: [], phase: 'explore', gold: 0, xp: 0, loot: [], fights: 0, heals: 0, idle: 0, auto: false, t: 0, result: null, byCall: !!byCall, picked: false };
  dunReveal(S.dun);
  S.stats.duns++; S.timers.dunCd = PACE.dunCd;
  ulog(`Отряд у входа в «${S.dun.name}»: ${party.map(p => `${p.hero} (${CLASSES[p.cls].n.toLowerCase()})`).join(', ')}. Где-то в глубине ждёт ${G.boss.n}. Ищите ключ 🗝!`);
  diary(`🏰 Спустился в «${S.dun.name}» с отрядом: ${mates.map(m => m.hero).join(', ')}. Факел взял. Совесть — тоже.`, 'event');
  if (!SILENT) { chatSys(`🏰 Отряд ${h.name} спустился в «${S.dun.name}».`); toast('🏰 Пещера! Ведите отряд по карте: нажимайте на соседние комнаты.'); }
  return true;
}
function partyUnits(U) {
  const out = [heroUnit()];
  for (const p of U.party) if (!p.isMe && p.hp > 0) out.push(botUnit({ name: p.hero, race: p.race, cls: p.cls, lvl: p.lvl, hpPct: p.hp, ref: p.godId }));
  return out;
}
function dunMove(arg) {
  const U = S.dun; if (!U || U.phase !== 'explore') return;
  const [x, y] = String(arg).split(',').map(Number), t = tileAt(U, x, y);
  if (!t || Math.abs(x - U.pos.x) + Math.abs(y - U.pos.y) !== 1) return;
  if (t.t === 'boss' && !t.done && U.keys < 1) {
    if (dunHas(U, 'rogue') && !U.picked) { U.picked = true; if (R() < .5) { ulog('🔓 Плут поковырялся в замке шпилькой — дверь открылась!', 'me'); U.keys++; } else { ulog('Плут сломал шпильку. Нужен ключ 🗝.', 'foe'); return; } }
    else { ulog('🔒 Дверь в логово босса заперта. Нужен ключ 🗝.', 'foe'); return; }
  }
  U.pos = { x, y }; U.idle = 0; dunReveal(U); dunEnter(U, t);
}
function dunEnter(U, t) {
  const h = S.hero, L = U.tier;
  if (t.done) { ulog(pick(['Здесь уже были. Пахнет нами.', 'Знакомый зал. Тот же скелет машет рукой.'])); return; }
  switch (t.t) {
    case 'empty': ulog(pick(D_EMPTY)); t.done = 1; break;
    case 'key': U.keys++; t.done = 1; ulog('🗝 Нашли ключ от логова босса! (Под ковриком. Как всегда.)', 'me'); break;
    case 'shrine': { const a = healHero(h.maxHp * DUN_K.shrine); U.party.forEach(p => { if (!p.isMe && p.hp > 0) p.hp = Math.min(100, p.hp + DUN_K.shrine * 100); }); t.done = 1; ulog(`⛲ Целебный источник: отряд подлечился (${h.name} +${a} HP). Он один на всю пещеру.`, 'me'); break; }
    case 'trap': {
      t.done = 1; const tx = pick(D_TRAP);
      if (dunHas(U, 'rogue') && R() < DUN_K.disarm) { ulog(`🪤 ${tx} …но плут заметил растяжку и обезвредил ловушку.`, 'me'); break; }
      const chk = check('dex', 13 + Math.ceil(L / 2));
      if (chk.ok) { ulog(`🪤 ${tx} ${h.name} успел отпрыгнуть (${chk.label}), остальным досталось.`, 'me'); }
      let k = DUN_K.trap[0] + R() * (DUN_K.trap[1] - DUN_K.trap[0]); if (h.race === 'dwarf') k *= .67; if (hasFeat('sentinel')) k *= .3; if (chk.ok) k = 0;
      const d = Math.min(h.hp - 1, Math.round(h.maxHp * k)); if (d > 0) h.hp -= d;
      U.party.forEach(p => { if (!p.isMe && p.hp > 0) p.hp = Math.max(1, p.hp - Math.round(100 * (DUN_K.trap[0] + R() * (DUN_K.trap[1] - DUN_K.trap[0])))); });
      if (chk.ok) break;
      ulog(`🪤 ${tx} Досталось всем (${chk.label}). ${h.name} −${Math.max(0, d)} HP.`, 'foe'); break;
    }
    case 'chest': {
      if (R() < .2) { ulog('💎 Сундук открыл пасть — это мимик!', 'foe'); return dunFight(U, t, [monsterUnit('Сундук-мимик', L + 1, { elite: 1 })], 'Мимик!'); }
      t.done = 1; const g = Math.round(rnd(15, 35) * goldScale(L)); U.gold += g; let txt = `${pick(D_CHEST)} +${g} 💰`;
      if (R() < .45 || dunHas(U, 'rogue') && R() < .3) { const it = makeItem(undefined, L, rollRarity(.6)); U.loot.push(it); txt += `, «${it.n}» (${RARITY[it.rar].n})`; }
      ulog('💎 ' + txt, 'me'); break;
    }
    case 'fight': case 'elite': {
      const alive = U.party.filter(p => p.isMe || p.hp > 0).length, el = t.t === 'elite', depth = t.d || 1, mons = [];
      const n = clamp(alive - 1 + (depth >= 3 ? 1 : 0) + rnd(0, 1) - (el ? 1 : 0), 1, 4);
      for (let i = 0; i < n; i++) {
        const tier = clamp(L - 1 + Math.floor(depth / 3) + pick([-1, 0, 0]), 1, 25), near = ALL_MONSTERS.filter(m => Math.abs(m[1] - tier) <= 1);
        mons.push(monsterUnit(pick(near.length ? near : ALL_MONSTERS)[0], tier, { hp: DUN_K.mhp, dmg: DUN_K.mdmg, elite: el && i === 0 }));
      }
      return dunFight(U, t, mons, el ? `💀 Элита: ${mons[0].name}. Злее, толще, на половине здоровья звереет.` : depth >= 3 ? 'Засада в глубине!' : 'Засада!');
    }
    case 'boss': {
      const pn = U.party.filter(p => p.isMe || p.hp > 0).length;
      const b = monsterUnit(U.boss.n, L + 2, { hp: DUN_K.bhp[0] + DUN_K.bhp[1] * pn, dmg: DUN_K.bdmg, boss: { m: U.boss.m } });
      const mons = [b]; if (pn >= 3) mons.push(monsterUnit('Прихвостень', Math.max(1, L - 1)));
      ulog(`👑 ${U.boss.n}! ${U.boss.d}`, 'warn');
      return dunFight(U, t, mons, `${U.boss.n}: ${U.boss.d}`);
    }
  }
}
function dunFight(U, t, mons, intro) {
  U.phase = 'fight'; U.fightTile = U.tiles.indexOf(t);
  const allies = partyUnits(U);
  const F = beginBattle('dungeon', allies, mons, { title: `${U.name}: ${t.t === 'boss' ? 'босс' : 'бой'}`, intro, ctx: { tile: U.fightTile, boss: t.t === 'boss' } });
  if (dunHas(U, 'mage')) { for (const m of mons) m.hp -= Math.max(1, Math.round(m.max * .08)); flog(F, '🔥 Маг отряда открывает бой огненным шаром: все противники обожжены!', 'crit'); }
  if (SILENT) autoResolveBattle(F);
}
function dunAfterFight(F, won) {
  const U = S.dun, h = S.hero; if (!U) return;
  for (const f of F.fighters) if (f.team === 0 && f.ref) { const p = U.party.find(x => x.godId === f.ref); if (p) p.hp = f.alive ? Math.max(1, Math.round(f.hp / f.max * 100)) : 0; }
  const me = fMe(F), t = U.tiles[F.ctx.tile];
  if (!won) {
    h.hp = Math.max(1, Math.min(h.maxHp, me.hp)); injure('mid', 'Вынесли из пещеры');
    ulog(`🩹 Отряд разбит. ${h.name} без сознания — его вынесли на руках.`, 'foe');
    return endDungeon(false, 'carried');
  }
  if (!me.alive || me.hp <= 0) { h.hp = Math.max(1, Math.round(h.maxHp * .1)); injure('light', 'Упал в бою, но отряд победил'); ulog(`🩹 ${h.name} упал, но друзья его подняли и отряхнули.`, 'foe'); }
  else h.hp = clamp(me.hp, 1, h.maxHp);
  U.fights++;
  const foes = F.fighters.filter(f => f.team === 1).length, boss = F.ctx.boss;
  const elite = F.fighters.some(f => f.elite), x = Math.round(xpUnit(U.tier) * (boss ? 20 : 2.2 * foes * (elite ? 1.5 : 1))), g = Math.round(rnd(8, 18) * goldScale(U.tier) * (boss ? 7 : foes / 2 * (elite ? 1.6 : 1)));
  U.xp += x; U.gold += g; if (t) t.done = 1;
  let txt = `Победа! +${g} 💰, +${x} опыта в общий котёл.`;
  if (!boss && (elite || R() < .3)) { const it = makeItem(undefined, U.tier, elite ? Math.max(1, rollRarity(.8)) : rollRarity(.4)); U.loot.push(it); txt += ` Трофей: «${it.n}».`; }
  if (DUN_K.camp) { healHero(h.maxHp * DUN_K.camp); U.party.forEach(p => { if (!p.isMe && p.hp > 0) p.hp = Math.min(100, p.hp + DUN_K.camp * 100); }); }
  if (dunHas(U, 'cleric')) { healHero(h.maxHp * DUN_K.cleric); U.party.forEach(p => { if (!p.isMe && p.hp > 0) p.hp = Math.min(100, p.hp + DUN_K.cleric * 100); }); txt += ' Жрец чуть подлатал отряд.'; }
  ulog('⚔ ' + txt, 'me');
  if (boss) {
    U.loot.push(makeItem(undefined, U.tier + 1, Math.max(2, rollRarity(1.4)))); U.loot.push(makeItem(undefined, U.tier, Math.max(1, rollRarity(1)))); if (R() < .35) U.loot.push(makeItem(undefined, U.tier + 1, Math.max(2, rollRarity(1.6))));
    S.stats.bosses++; endDungeon(true, 'boss');
  }
}
function endDungeon(ok, why) {
  const U = S.dun, h = S.hero; if (!U || U.phase === 'end') return;
  const mult = why === 'carried' ? DUN_K.carried : why === 'boss' ? 1 : DUN_K.left;
  const gold = Math.round(U.gold * mult), xp = Math.round((U.xp + (ok ? xpUnit(U.tier) * 15 : 0)) * mult);
  h.gold += gold; gainXp(xp); addGxp(20 + U.fights * 8 + (ok ? 25 : 0));
  if (ok) { addTrust(3); S.stats.dwinsD++; }
  const items = why === 'carried' ? U.loot.slice(0, 1) : U.loot, names = [];
  for (const it of items) { const worn = equip(it, true); names.push(`«${it.n}» (${RARITY[it.rar].n}${worn ? ', надел' : ''})`); }
  rivals.reportDungeon({ ok, godIds: U.party.filter(p => !p.isMe).map(p => p.godId) });
  U.result = `${ok ? '🏆 Босс повержен, пещера пройдена!' : why === 'carried' ? '🩹 Героя вынесли на руках.' : why === 'left' ? '🚪 Отряд ушёл из пещеры.' : why === 'nokey' ? '🔒 Ключ так и не нашли — отряд ушёл.' : '😵 Отряд отступил.'} Добыча: ${gold} 💰, ${xp} опыта${names.length ? ', ' + names.join(', ') : ''}.`;
  ulog(U.result, 'sys');
  diary(`🏰 ${ok ? `Прошёл «${U.name}» и победил: ${U.boss.n}!` : `Вернулся из «${U.name}». Было темно и обидно.`}`, items.some(i => i.rar >= 2) ? 'rare' : 'event', `+${gold} 💰, +${xp} опыта${names.length ? ', ' + names.join(', ') : ''}`);
  if (!SILENT) chatSys(`🏰 Отряд ${h.name} ${ok ? 'зачистил' : 'покинул'} «${U.name}».`);
  U.phase = 'end'; U.t = 15; S.timers.dunCd = PACE.dunCd;
  if (h.state === 'dungeon') h.state = 'road';
}
/* Лечение отряда между комнатами — силой бога, за веру, не больше DUN_K.heals раз за пещеру */
function dunHealCost() { return Math.round(powerCost('heal') * 1.5); }
function dunHeal() {
  const U = S.dun; if (!U || U.phase !== 'explore') return;
  if (!S.god.skills.heal) return toast('Нужна изученная сила «Лечение».');
  if ((U.heals || 0) >= DUN_K.heals) return toast(`В пещере можно лечить отряд не больше ${DUN_K.heals} раз.`);
  const c = dunHealCost(); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; U.heals = (U.heals || 0) + 1; addGxp(c / 3); shiftAlign(POWERS.heal.al);
  const a = healHero(S.hero.maxHp * Math.min(.5, .3 * pmult('heal'))); U.party.forEach(p => { if (!p.isMe && p.hp > 0) p.hp = Math.min(100, p.hp + 20); });
  ulog(`✨ Бог лечит отряд: ${S.hero.name} +${a} HP, остальным +20%. (${U.heals}/${DUN_K.heals})`, 'me');
}
function dunLeave() { const U = S.dun; if (!U || U.phase !== 'explore') return; endDungeon(false, 'left'); }
/* Автопроход: идём к ближайшей неисследованной комнате (босс — когда есть ключ) */
function dunNextStep(U) {
  const start = U.pos.y * DW + U.pos.x, prev = new Array(DW * DH).fill(-2), q = [start]; prev[start] = -1;
  const passable = i => { const t = U.tiles[i]; return t && (t.t !== 'boss' || t.done || U.keys > 0); };
  let found = -1, bossI = -1;
  while (q.length) {
    const i = q.shift(), x = i % DW, y = Math.floor(i / DW), t = U.tiles[i];
    if (i !== start && !t.done) { if (t.t === 'boss') { if (bossI < 0) bossI = i; } else { found = i; break; } }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * DW + nx; if (nx >= 0 && ny >= 0 && nx < DW && ny < DH && prev[j] === -2 && passable(j)) { prev[j] = i; q.push(j); } }
  }
  const goal = found >= 0 ? found : bossI; if (goal < 0) return null;
  let j = goal; while (prev[j] !== start && prev[j] >= 0) j = prev[j];
  return { x: j % DW, y: Math.floor(j / DW) };
}
function dunAutoStep() {
  const U = S.dun; if (!U || U.phase !== 'explore') return;
  const nx = dunNextStep(U);
  if (!nx) { const boss = U.tiles.find(t => t && t.t === 'boss'); return endDungeon(false, boss && !boss.done && U.keys < 1 ? 'nokey' : 'left'); }
  dunMove(nx.x + ',' + nx.y);
}
function dunToggleAuto() { if (S.dun) { S.dun.auto = !S.dun.auto; S.dun.idle = 0; } }
function dunTick(idt) {
  const U = S.dun;
  if (U.phase === 'end') { U.t -= idt; if (U.t <= 0) S.dun = null; return; }
  if (U.phase !== 'explore') return;
  U.idle += idt;
  if ((U.auto && U.idle >= 2.5) || U.idle >= 25) { if (!U.auto) ulog('Бог задумался — отряд пошёл сам.'); U.idle = 0; dunAutoStep(); }
}
function dunAutoFinish() {
  let k = 0;
  while (S.dun && k++ < 300) {
    const U = S.dun;
    if (S.fight) { autoResolveBattle(S.fight); continue; }
    if (U.phase === 'end') { S.dun = null; break; }
    if (U.phase === 'fight') { U.phase = 'explore'; continue; }
    const p = { ...U.pos }; dunAutoStep();
    if (S.dun && S.dun.phase === 'explore' && S.dun.pos.x === p.x && S.dun.pos.y === p.y && !S.fight) endDungeon(false, 'nokey');
  }
  if (S.dun) S.dun = null;
  if (S.hero.state === 'dungeon') S.hero.state = 'road';
}

/* ---------- проверка сохранений v4 (вызывается из sanitize) ---------- */
function validFight(F) {
  if (!F || typeof F !== 'object' || !['monster', 'dungeon', ...ARENA_KINDS].includes(F.kind) || !['intro', 'turn', 'end'].includes(F.phase)) return false;
  if (!Array.isArray(F.fighters) || F.fighters.length < 2 || !Array.isArray(F.log) || !F.my || typeof F.my !== 'object') return false;
  for (const f of F.fighters) if (!(f && typeof f.id === 'string' && typeof f.name === 'string' && (f.team === 0 || f.team === 1) && isNum(f.hp) && isNum(f.max) && f.max > 0 && isNum(f.avg) && isNum(f.armor) && isNum(f.atkN) && isNum(f.blkN) && ZONES.includes(f.habit))) return false;
  if (F.fighters.filter(f => f.isMe).length !== 1) return false;
  for (const f of F.fighters) { f.hp = clamp(Math.round(f.hp), 0, f.max); f.alive = !!f.alive && f.hp > 0; f.atkN = clamp(Math.round(f.atkN), 1, 2); f.blkN = clamp(Math.round(f.blkN), 1, 3); if (!f.buf || typeof f.buf !== 'object') f.buf = {}; if (!f.used || typeof f.used !== 'object') f.used = {}; fixNum(f, 'debuf', 0, 0, 10); fixNum(f, 'bear', 0, 0, 10); fixNum(f, 'dealt', 0, 0); fixNum(f, 'dex', 0, -5, 10); fixNum(f, 'intu', 0, -5, 10); fixNum(f, 'wis', 0, -5, 10); }
  const me = F.fighters.find(f => f.isMe), ids = F.fighters.map(f => f.id);
  F.my.atk = Array.isArray(F.my.atk) ? [...new Set(F.my.atk.filter(z => ZONES.includes(z)))].slice(0, me.atkN) : [];
  F.my.blk = Array.isArray(F.my.blk) ? [...new Set(F.my.blk.filter(z => ZONES.includes(z)))].slice(0, me.blkN) : [];
  if (!ids.includes(F.my.target)) F.my.target = null;
  if (!F.choices || typeof F.choices !== 'object') F.choices = {};
  for (const k of ['lastAtk', 'lastBlk', 'lastTarget', 'ctx']) if (!F[k] || typeof F[k] !== 'object') F[k] = {};
  fixNum(F, 'turn', 0, 0, 999); fixNum(F, 'T', TURN_T, 1, TURN_T); fixNum(F, 't', F.T, 0, F.T); fixNum(F, 'powersLeft', 3, 0, 3); F.powersLeft = Math.floor(F.powersLeft); fixNum(F, 'usedTurn', 0, 0, 3); fixNum(F, 'stuck', 0, 0);
  F.auto = !!F.auto; F.ready = !!F.ready; if (F.log.length > 80) F.log.length = 80;
  if (F.tele && !(F.tele && ids.includes(F.tele.fid) && ZONES.includes(F.tele.zone))) F.tele = null;
  if (F.tele) fixNum(F.tele, 'mul', 1.5, 1, 3);
  if (F.rivalGod && !(typeof F.rivalGod === 'object' && typeof F.rivalGod.name === 'string')) F.rivalGod = null;
  if (F.rivalGod) fixNum(F.rivalGod, 'left', 0, 0, 5);
  if (F.phase === 'end' && !F.result) return false;
  if (F.phase !== 'end' && (!F.fighters.some(f => f.alive && f.team === 0) || !F.fighters.some(f => f.alive && f.team === 1))) return false;
  return true;
}
function validDun(U) {
  if (!U || typeof U !== 'object' || !['explore', 'fight', 'end'].includes(U.phase) || !Array.isArray(U.tiles) || U.tiles.length !== DW * DH || !Array.isArray(U.party) || !Array.isArray(U.log) || !U.pos || !U.boss) return false;
  if (!U.party.some(p => p && p.isMe)) return false;
  for (const t of U.tiles) if (t !== null && !(t && DTILE[t.t])) return false;
  if (!tileAt(U, U.pos.x, U.pos.y)) return false;
  if (!U.tiles.some(t => t && t.t === 'boss')) return false;
  U.party = U.party.filter(p => p && typeof p.hero === 'string' && CLASSES[p.cls] && RACES[p.race]).slice(0, 5);
  for (const p of U.party) { fixNum(p, 'hp', 100, 0, 100); fixNum(p, 'lvl', 1, 1, MAX_LVL); }
  U.loot = Array.isArray(U.loot) ? U.loot.filter(i => i && i.slot && validItem(i, i.slot)).map(sanitizeItem).slice(0, 10) : [];
  fixNum(U, 'keys', 0, 0, 3); fixNum(U, 'gold', 0, 0); fixNum(U, 'xp', 0, 0); fixNum(U, 'fights', 0, 0); fixNum(U, 'heals', 0, 0, 9); fixNum(U, 'idle', 0, 0, 60); fixNum(U, 't', 1, 0, 20); fixNum(U, 'tier', 1, 1, 30);
  U.auto = !!U.auto; if (typeof U.name !== 'string') U.name = 'Пещера';
  if (U.log.length > 40) U.log.length = 40;
  return true;
}
function sanitizeArena(o, h) {
  const d = { rating: 1000, w: 0, l: 0, fat: 0, fatT: 0, apps: [], seq: 0 };
  if (!o.arena || typeof o.arena !== 'object') o.arena = d;
  const A = o.arena;
  fixNum(A, 'rating', 1000, 0, 5000); A.rating = Math.round(A.rating); fixNum(A, 'w', 0, 0); fixNum(A, 'l', 0, 0); fixNum(A, 'fat', 0, 0, 10); fixNum(A, 'fatT', 0, 0, 100000); fixNum(A, 'seq', 0, 0);
  A.apps = Array.isArray(A.apps) ? A.apps.filter(a => a && typeof a.id === 'string' && ARENA_TYPES[a.type] && isNum(a.size) && Array.isArray(a.teams) && a.teams.length === 2 && a.teams.every(Array.isArray) && Array.isArray(a.members) && isNum(a.t)).slice(0, 8) : [];
  // своё участие в заявке после перезагрузки не держим (бот-арена всё равно локальная)
  A.apps = A.apps.filter(a => !a.mine && a.joined === null && ![...a.teams[0], ...a.teams[1], ...a.members].some(m => m && m.me));
  if (!o.chat || typeof o.chat !== 'object') o.chat = { msgs: [], unread: 0, open: false };
  const C = o.chat;
  C.msgs = Array.isArray(C.msgs) ? C.msgs.filter(m => m && typeof m.x === 'string' && typeof m.from === 'string').map(m => ({ tm: typeof m.tm === 'string' ? m.tm : '', from: m.from.slice(0, 30), x: m.x.slice(0, 200), c: ['bot', 'me', 'sys', 'fight'].includes(m.c) ? m.c : 'bot' })).slice(-60) : [];
  fixNum(C, 'unread', 0, 0, 99); C.unread = Math.floor(C.unread); C.open = !!C.open;
}


/* =====================================================================
   6) ДУЭЛЬ БОГОВ
   ===================================================================== */
const DUEL_ROUNDS = 5, ROUND_T = 10;
const DUEL_NAMES = { bolt: '⚡ Молния', heal: '✚ Исцеление', shield: '🛡 Щит', curse: '☠ Проклятие', quake: '🌋 Землетрясение', beast: '🐻 Зверь', bless: '✨ Благословение', luck: '🍀 Удача', rain: '🌧 Ливень', cheer: '📣 Подбадривание' };
function dlog(t, c) { const D = S.duel; D.log.unshift({ t, c: c || 'sys' }); if (D.log.length > 40) D.log.length = 40; }
function duelFighter(name, h, temple) {
  const sh = sheetOf(h, temple), hit = clamp((21 - (13 - sh.atkB)) / 20, .15, .95), max = calcMaxHp(h) * 2;
  return { name, hp: max, max, atk: Math.max(2, Math.round(sh.avg * hit * 1.6)), def: Math.max(0, Math.floor((sh.ac - 10) / 2)), beast: 0, beastM: 1, race: h.race, cls: h.cls, lvl: h.lvl };
}
let duelPending = false;
const heroBusy = () => !!(S.fork || S.duel || S.dun || duelPending || dunPending);
async function startDuel(godId) {
  if (S.duel || S.dun || duelPending || dunPending || S.hero.state === 'dead' || S.hero.state === 'duel' || S.hero.state === 'dungeon') return false;
  const h = S.hero, st = S, prev = h.state;
  h.state = 'duel'; h.monster = null; h.restT = 0; duelPending = true;
  let opp;
  try { opp = await rivals.findOpponent({ godLvl: S.god.lvl, heroLvl: h.lvl, godId }); } finally { duelPending = false; }
  if (S !== st || h.state !== 'duel') return false;
  const vh = virtualHero(opp.race, opp.cls, opp.heroLvl);
  S.duel = { id: Date.now(), phase: 'intro', t: 5, T: 5, round: 0, opp,
    me: duelFighter(h.name, h, S.flock.temple), foe: duelFighter(opp.hero, vh, 0),
    foeFaith: 50 + opp.lvl * 12, myActs: [], foeActs: [], plan: [], log: [], result: null };
  S.stats.duels++; S.timers.duel = Math.max(S.timers.duel, 1200);
  dlog(`${h.name} встречает героя по имени ${opp.hero} (${RACES[opp.race].n.toLowerCase()}-${CLASSES[opp.cls].n.toLowerCase()}, ур. ${opp.heroLvl}). Покровитель — ${opp.god} (${PERS[opp.pers]}). Арена богов удваивает здоровье обоим — бой честный!`);
  diary(`⚔ Встретил героя по имени ${opp.hero} (его бог — ${opp.god}). Он сказал, что мой бог — «так себе». Начинается дуэль богов!`, 'duel');
  toast('⚔ Дуэль богов! Вмешивайтесь в каждый раунд.');
  return true;
}
function duelView(D, extra) {
  return Object.assign({ round: D.round, roundT: ROUND_T, pers: D.opp.pers, lvl: D.opp.lvl, faith: D.foeFaith,
    self: { hp: D.foe.hp, max: D.foe.max }, enemy: { hp: D.me.hp, max: D.me.max }, selfCursed: D.myActs.includes('curse'), elapsed: ROUND_T - D.t }, extra || {});
}
function beginRound() {
  const D = S.duel; D.round++; D.t = ROUND_T; D.T = ROUND_T; D.myActs = []; D.foeActs = []; D.plan = [];
  D.foeFaith = Math.min(200, D.foeFaith + 14);
  dlog(`— Раунд ${D.round} из ${DUEL_ROUNDS} —`);
  const tok = D.id + ':' + D.round, st = S;
  rivals.planRound(duelView(D)).then(pl => { if (S === st && S.duel && S.duel.id + ':' + S.duel.round === tok) S.duel.plan = S.duel.plan.concat(pl); });
}
function duelAct(id) {
  const D = S.duel; if (!D || D.phase !== 'fight') return;
  if (id !== 'cheer' && D.myActs.filter(a => a !== 'cheer').length >= 2) return toast('Не больше двух сил за раунд.');
  if (id === 'cheer') { if (D.myActs.includes('cheer')) return toast('Уже подбодрили в этом раунде.'); D.myActs.push('cheer'); dlog('Вы: 📣 «Давай, ты сможешь!» (+15% к удару)', 'me'); return; }
  if (!S.god.skills[id]) return toast('Сила не изучена.');
  if (D.myActs.includes(id)) return toast('Эта сила уже применена в раунде.');
  const c = powerCost(id); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; D.myActs.push(id); shiftAlign(POWERS[id].al); addGxp(c / 3);
  dlog(`Вы: ${DUEL_NAMES[id]}`, 'me');
  const r = rivals.react(duelView(D), id); if (r) D.plan.push(r);
}
function calcHit(att, def, acts, oacts, mul, army, log, k) {
  let base = att.atk * (.8 + R() * .4) + Math.min(army, 10) * 1.2 * k;
  if (acts.includes('cheer')) base *= 1.15;
  if (acts.includes('bless')) { base *= 1.3 + .3 * mul('bless'); log.push('крит'); }
  if (oacts.includes('curse') && !acts.includes('rain')) { base *= .5; log.push('проклят'); }
  base = Math.max(1, base - def.def);
  let extra = 0;
  if (acts.includes('bolt')) { extra += 16 * mul('bolt') * k; log.push('молния'); }
  if (acts.includes('quake')) { extra += 34 * mul('quake') * k; log.push('землетрясение'); }
  if (att.beast > 0) { extra += 11 * att.beastM * k; log.push('медведь'); }
  let total = base + extra;
  if (oacts.includes('shield')) { total *= .3; log.push('щит'); }
  if (oacts.includes('luck') && R() < .5) { total = 0; log.push('уворот!'); }
  return Math.round(total);
}
function resolveRound() {
  const D = S.duel, me = D.me, foe = D.foe, A = D.myActs, B = D.foeActs;
  const k = (me.max + foe.max) / 140;
  const fmul = () => 1 + .5 * Math.min(2, Math.floor(D.opp.lvl / 3));
  if (A.includes('beast')) { me.beast = 2; me.beastM = pmult('beast'); }
  if (B.includes('beast')) { foe.beast = 2; foe.beastM = fmul(); }
  const hm = [], hf = [];
  const heal = (f, v) => { const a = Math.max(0, Math.min(f.max - f.hp, Math.round(v))); f.hp += a; return a; };
  if (A.includes('heal')) hm.push(`+${heal(me, 20 * pmult('heal') * k)} HP`);
  if (A.includes('rain')) hm.push(`ливень +${heal(me, 10 * pmult('rain') * k)}`);
  if (B.includes('heal')) hf.push(`+${heal(foe, 20 * fmul() * k)} HP`);
  if (B.includes('rain')) hf.push(`ливень +${heal(foe, 10 * fmul() * k)}`);
  const lm = [], lf = [];
  const dMe = calcHit(me, foe, A, B, pmult, S.flock.army, lm, k);
  const dFoe = calcHit(foe, me, B, A, fmul, D.opp.army || 0, lf, k);
  foe.hp -= dMe; me.hp -= dFoe;
  if (me.beast > 0) me.beast--; if (foe.beast > 0) foe.beast--;
  dlog(`${me.name} бьёт на ${dMe}${lm.length ? ' (' + lm.join(', ') + ')' : ''}${hm.length ? '; ' + hm.join(', ') : ''}.`, 'me');
  dlog(`${foe.name} бьёт на ${dFoe}${lf.length ? ' (' + lf.join(', ') + ')' : ''}${hf.length ? '; ' + hf.join(', ') : ''}.`, 'foe');
  if (me.hp <= 0 || foe.hp <= 0 || D.round >= DUEL_ROUNDS) endDuel(); else beginRound();
}
function endDuel() {
  const D = S.duel, me = D.me, foe = D.foe, h = S.hero;
  let win;
  if (foe.hp <= 0 && me.hp > 0) win = true; else if (me.hp <= 0 && foe.hp > 0) win = false;
  else if (me.hp <= 0 && foe.hp <= 0) win = me.hp >= foe.hp; else win = me.hp / me.max >= foe.hp / foe.max;
  D.phase = 'end'; D.t = 8; D.T = 8;
  rivals.reportDuel({ godId: D.opp.godId, playerWon: win });
  h.state = 'road';
  if (win) {
    S.stats.dwins++;
    const g = Math.round(30 * goldScale(h.lvl)), x = Math.round(xpUnit(h.lvl) * 6), n = rnd(2, 5) + Math.floor(S.flock.army / 5);
    h.gold += g; S.flock.fol += n; addTrust(5); gainXp(x); addGxp(30);
    D.result = `Победа! ${me.name} сильнее, чем ${foe.name}. ${n} ${plural(n, 'последователь соперника перешёл', 'последователя соперника перешли', 'последователей соперника перешли')} к вам.`;
    dlog('🏆 ' + D.result);
    diary(`🏆 Победил в дуэли! ${foe.name} повержен. Мой бог сильнее, чем ${D.opp.god}. Его последователи перебегают к нам.`, 'duel', `+${g} 💰, +${x} опыта, +${n} паствы, +5 доверия`);
  } else {
    const g = Math.floor(h.gold * .1), n = Math.min(Math.floor(S.flock.fol), rnd(1, 3));
    h.gold -= g; S.flock.fol -= n; addTrust(-3); addGxp(12);
    const hd = Math.min(h.hp - 1, Math.round(h.maxHp * .2)); if (hd > 0) h.hp -= hd;
    D.result = `Поражение. ${foe.name} оказался сильнее. ${D.opp.god} злорадствует.`;
    dlog('💔 ' + D.result);
    diary(`💔 Проиграл дуэль: ${foe.name} оказался сильнее. Где был мой бог, когда он был так нужен? Ушёл, прихрамывая.`, 'duel', `−${g} 💰, −${n} паствы, −3 доверия`);
  }
}
function duelTick(idt) {
  const D = S.duel;
  D.t -= idt;
  if (D.phase === 'intro') { if (D.t <= 0) { D.phase = 'fight'; beginRound(); } return; }
  if (D.phase === 'end') { if (D.t <= 0) S.duel = null; return; }
  const el = ROUND_T - D.t;
  for (const p of D.plan) if (!p.done && el >= p.at) {
    p.done = 1; const c = DUEL_COST[p.act];
    if (D.foeFaith >= c && !D.foeActs.includes(p.act)) { D.foeFaith -= c; D.foeActs.push(p.act); dlog(`${D.opp.god}: ${DUEL_NAMES[p.act]}`, 'foe'); }
  }
  if (D.t <= 0) resolveRound();
}

/* =====================================================================
   7) МИРОВЫЕ СОБЫТИЯ
   ===================================================================== */
async function startEvent(id) {
  if (S.ev) return false;
  const def = id ? WEVENTS.find(e => e.id === id) : pick(WEVENTS.filter(e => e.id !== S.lastEv));
  S.lastEv = def.id;
  const ev = { id: def.id, t: 60, T: 60, parts: [], ai: {}, my: { vote: null, power: 0, army: 0 }, thr: 100, phase: 'live', result: null };
  S.ev = ev; S.stats.events++; S.timers.event = Math.max(S.timers.event, 3600);
  await joinEvent(ev);
  diary(`${def.ic} МИРОВОЕ СОБЫТИЕ: ${def.n}! ${def.t}`, 'event');
  toast(`${def.ic} Мировое событие: ${def.n}! Все боги собираются.`);
  return true;
}
async function joinEvent(ev) {
  const st = S, j = await rivals.joinEvent(ev);
  if (S !== st || S.ev !== ev) return;
  ev.parts = j.parts; ev.ai = j.ai; ev.thr = Math.round(j.expected * 1.12 + 60 + S.god.lvl * 10); ev.joined = true;
}
function evTally(ev) {
  const def = WEVENTS.find(e => e.id === ev.id), t = def.o.map(() => 0);
  for (const p of ev.parts) if (p.vote !== null) t[p.vote] += p.power + 5;
  if (ev.my.vote !== null) t[ev.my.vote] += ev.my.power + 5;
  return t;
}
function evTotal(ev) { return ev.parts.reduce((s, p) => s + p.power, 0) + ev.my.power; }
function evLeader(ev) { const t = evTally(ev); let b = 0; t.forEach((v, i) => { if (v > t[b]) b = i; }); if (ev.my.vote !== null && t[ev.my.vote] === t[b]) b = ev.my.vote; return b; }
function evVote(k) { if (!S.ev || S.ev.phase !== 'live') return; S.ev.my.vote = +k; }
function evGive(n) {
  const ev = S.ev; if (!ev || ev.phase !== 'live') return; n = +n;
  if (S.god.faith < n) return toast('Не хватает веры.');
  S.god.faith -= n; ev.my.power += n;
}
function evArmy() {
  const ev = S.ev; if (!ev || ev.phase !== 'live') return;
  const a = S.flock.army; if (a < 1) return toast('Армии нет. Наберите солдат во вкладке «Паства».');
  S.flock.army = 0; ev.my.army += a; ev.my.power += a * 10;
  toast(`Отправлено ${a} солдат (+${a * 10} силы).`);
}
function evTick(idt) {
  const ev = S.ev;
  ev.t -= idt;
  if (ev.phase === 'done') { if (ev.t <= 0) S.ev = null; return; }
  for (const u of rivals.eventUpdates(ev, idt)) {
    const p = ev.parts.find(x => x.id === u.id); if (!p) continue;
    if (u.vote !== undefined) p.vote = u.vote;
    if (u.add) p.power += u.add;
  }
  if (ev.t <= 0) resolveEvent();
}
function resolveEvent() {
  const ev = S.ev, def = WEVENTS.find(e => e.id === ev.id), h = S.hero;
  const k = evLeader(ev), opt = def.o[k], total = Math.max(1, evTotal(ev));
  const share = ev.my.power / total;
  const ok = total * opt.m >= ev.thr * (.85 + R() * .3);
  const fx = [];
  if (ok) {
    S.stats.evwins++;
    const f = Math.round(15 + share * 120), x = Math.round(20 + share * 120), n = Math.round((3 + share * 30) * opt.rw), g = Math.round((15 + share * 150) * opt.rw * goldScale(h.lvl)), hx = Math.round(xpUnit(h.lvl) * (2 + share * 6));
    addFaith(f); addGxp(x); S.flock.fol += n; h.gold += g; gainXp(hx);
    fx.push(`+${f} веры`, `+${x} опыта бога`, `+${n} паствы`, `+${g} 💰 и +${hx} опыта герою`);
    if (ev.my.army) { const lost = Math.floor(ev.my.army * .1); S.flock.army += ev.my.army - lost; fx.push(`армия вернулась (−${lost})`); }
  } else {
    const n = Math.floor(S.flock.fol * .1); S.flock.fol -= n;
    const hd = Math.min(Math.max(0, h.hp - 1), Math.round(h.maxHp * .25)); if (h.state !== 'dead' && hd > 0) h.hp -= hd;
    const x = Math.round(5 + share * 40); addGxp(x);
    fx.push(`−${n} паствы`, `−${h.state !== 'dead' ? hd : 0} HP герою`, `+${x} опыта бога за старание`);
    if (ev.my.army) { const lost = Math.ceil(ev.my.army * .35); S.flock.army += ev.my.army - lost; fx.push(`погибло солдат: ${lost}`); }
  }
  for (const r of S.rivals) if (R() < .3 && r.lvl < S.god.lvl + 3) r.lvl++;
  ev.phase = 'done'; ev.t = 12; ev.T = 12;
  ev.result = { ok, k, share: Math.round(share * 100), text: (ok ? '✅ ' + opt.ok : '❌ ' + opt.fail), fx: fx.join(', ') };
  diary(`${def.ic} Итог события «${def.n}»: решили «${opt.l}». ${ok ? opt.ok : opt.fail} Ваш вклад: ${Math.round(share * 100)}%.`, 'event', fx.join(', '));
}

/* =====================================================================
   8) ПОДЗЕМЕЛЬЯ С ОТРЯДОМ
   ===================================================================== */
const DUN_ROOM_T = 20;
let dunPending = false;
function ulog(t, c) { const U = S.dun; U.log.unshift({ t, c: c || 'sys' }); if (U.log.length > 50) U.log.length = 50; }
async function startDungeon(byCall) {
  if (S.dun || S.duel || S.fork || duelPending || dunPending) return false;
  const h = S.hero; if (h.state === 'dead' || h.state === 'duel' || h.state === 'dungeon') return false;
  const st = S; h.state = 'dungeon'; h.monster = null; h.restT = 0; dunPending = true;
  let mates;
  try { mates = await rivals.formParty({ heroLvl: h.lvl, godLvl: S.god.lvl }); } finally { dunPending = false; }
  if (S !== st || h.state !== 'dungeon') return false;
  const party = [{ godId: 'me', god: S.god.name, hero: h.name, race: h.race, cls: h.cls, lvl: h.lvl, pers: 'me', isMe: true, hp: 100 }]
    .concat(mates.map(m => ({ godId: m.godId, god: m.god, hero: m.hero, race: m.race, cls: m.cls, lvl: m.heroLvl, pers: m.pers, hp: 100 })));
  const pool = ['fight', 'trap', 'puzzle', 'path', 'treasure', 'fight', 'trap', 'puzzle'];
  const rooms = [];
  while (rooms.length < 4) { const t = pick(pool); if (rooms[rooms.length - 1] === t) continue; if (t === 'path' && rooms.includes('path')) continue; rooms.push(t); }
  rooms.push('boss');
  S.dun = { id: Date.now(), name: pick(DUN_NAMES), tier: h.lvl, party, rooms, idx: 0, phase: 'intro', t: 6, T: 6, room: null, log: [], gold: 0, xp: 0, loot: [], wins: 0, fails: 0, bonusNext: 0, result: null, byCall: !!byCall };
  S.stats.duns++; S.timers.dun = Math.max(S.timers.dun, 3600);
  ulog(`Отряд собран: ${party.map(p => `${p.hero} (${CLASSES[p.cls].n.toLowerCase()})`).join(', ')}. Впереди — ${S.dun.name}.`);
  diary(`🏰 Собрался в «${S.dun.name}» с отрядом: ${mates.map(m => m.hero).join(', ')}. Надеюсь, хоть кто-то взял факел.`, 'event');
  toast('🏰 Подземелье! Голосуйте в каждой комнате и помогайте силами.');
  return true;
}
function dunView(U) { return { type: U.room.type, opts: U.room.opts.map(o => ({ l: o.l, s: o.s, cls: o.cls, split: o.split })), party: U.party.map(p => ({ godId: p.godId, cls: p.cls, pers: p.pers, isMe: !!p.isMe })), roundT: DUN_ROOM_T }; }
function dunBeginRoom() {
  const U = S.dun, type = U.rooms[U.idx], def = DUN_ROOMS[type], h = S.hero;
  const mt = clamp(U.tier + (type === 'boss' ? 2 : 0), 1, 22), near = ALL_MONSTERS.filter(m => Math.abs(m[1] - mt) <= 1);
  const mname = pick(near.length ? near : ALL_MONSTERS)[0];
  const classes = U.party.map(p => p.cls);
  const opts = def.o.filter(o => !o.cls || !o.need || o.cls.some(c => classes.includes(c))).map(o => Object.assign({}, o, { has: !o.cls || o.cls.some(c => classes.includes(c)) }));
  U.room = { type, text: pick(def.t).split('{m}').join(mname), m: mname, opts, votes: {}, myVote: null, myActs: [], aiActs: [], plan: [], bonus: U.bonusNext, heal: 0, shield: false, spent: 0, planned: false };
  U.bonusNext = 0;
  U.phase = 'room'; U.t = DUN_ROOM_T; U.T = DUN_ROOM_T;
  ulog(`${def.ic} Комната ${U.idx + 1}/${U.rooms.length}: ${def.n}. ${U.room.text}`);
  dunRequestPlan();
}
function dunRequestPlan() {
  const U = S.dun, st = S, tok = U.id + ':' + U.idx;
  U.room.planned = true;
  rivals.dungeonDecide(dunView(U)).then(pl => { if (S === st && S.dun && S.dun.room && S.dun.id + ':' + S.dun.idx === tok) S.dun.room.plan = S.dun.room.plan.concat(pl); });
}
function dunVote(k) { const U = S.dun; if (!U || U.phase !== 'room' || !U.room.opts[+k]) return; U.room.myVote = +k; }
function dunAct(id) {
  const U = S.dun; if (!U || U.phase !== 'room') return;
  const rm = U.room;
  if (rm.type === 'treasure' || rm.type === 'path') return toast('Тут силы не помогут — только голосование.');
  if (rm.myActs.length >= 2) return toast('Не больше двух сил на комнату.');
  if (!S.god.skills[id]) return toast('Сила не изучена.');
  if (rm.myActs.includes(id)) return toast('Эта сила уже применена здесь.');
  const c = powerCost(id); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; rm.myActs.push(id); rm.spent += c; shiftAlign(POWERS[id].al); addGxp(c / 3);
  const P = DUN_POW[id] || {}, mu = pmult(id);
  if (P.bonus) rm.bonus += Math.round(P.bonus * mu);
  if (P.heal) rm.heal += P.heal * mu;
  if (P.shield) rm.shield = true;
  ulog(`Вы: ${DUEL_NAMES[id]}${P.bonus ? ` (+${Math.round(P.bonus * mu)} к проверке)` : ''}${P.heal ? ' (лечение отряда)' : ''}${P.shield ? ' (урон вдвое меньше)' : ''}`, 'me');
}
function dunTally(U) {
  const rm = U.room, t = rm.opts.map(() => 0);
  for (const id in rm.votes) if (t[rm.votes[id]] !== undefined) t[rm.votes[id]] += 1;
  if (rm.myVote !== null) t[rm.myVote] += 1 + rm.spent / 20;
  return t;
}
function dunChoice(U) {
  const rm = U.room, t = dunTally(U);
  if (t.every(x => x === 0)) { const i = rm.opts.findIndex(o => o.cls && o.has); return i >= 0 ? i : 0; }
  let b = 0; t.forEach((v, i) => { if (v > t[b]) b = i; });
  if (rm.myVote !== null && t[rm.myVote] === t[b]) b = rm.myVote;
  return b;
}
function memberCheck(U, opt) {
  // кто выполняет: подходящий по классу, иначе тот, у кого стат выше
  const cands = U.party.filter(p => p.hp > 0 || p.isMe);
  let best = null, bestV = -99;
  for (const p of cands) {
    const vh = p.isMe ? S.hero : virtualHero(p.race, p.cls, p.lvl);
    let v = mod(statValOf(vh, opt.s)) + (CLASSES[p.cls].prof.includes(opt.s) ? profB(p.lvl) : 0) + (opt.cls && opt.cls.includes(p.cls) ? 4 : 0);
    if (v > bestV) { bestV = v; best = p; }
  }
  return { who: best, bonus: bestV };
}
function dunResolve() {
  const U = S.dun, rm = U.room, h = S.hero, k = dunChoice(U), opt = rm.opts[k], L = h.lvl;
  ulog(`Решение отряда: «${opt.l}».`, 'sys');
  if (rm.heal > 0) { const a = healHero(h.maxHp * rm.heal); U.party.forEach(p => { if (!p.isMe) p.hp = Math.min(100, p.hp + Math.round(rm.heal * 100)); }); ulog(a > 0 ? `Божественное лечение: ${h.name} +${a} HP, отряд взбодрился.` : 'Божественное лечение: отряд взбодрился (наш герой и так цел).', 'me'); }
  if (rm.type === 'treasure') {
    const pot = Math.round(rnd(30, 60) * goldScale(L));
    if (opt.split === 'fair') { const g = Math.round(pot / U.party.length * 2); U.gold += g; ulog(`Поделили честно. Доля героя: ${g} 💰. Все довольны, даже облизывающийся сундук.`); shiftAlign(2); }
    else if (opt.split === 'greedy') {
      U.gold += pot; const it = makeItem(undefined, L, Math.max(1, rollRarity(.8))); U.loot.push(it); shiftAlign(-3);
      ulog(`Лучшее забрал ${h.name}: ${pot} 💰 и «${it.n}». Остальные боги запомнят это.`);
      for (const p of U.party) if (!p.isMe) { const g = S.rivals.find(r => r.id === p.godId); if (g) g.w++; }
    } else { addFaith(25); U.gold += Math.round(pot * .3); ulog('Часть сокровищ ушла в храмы богов. +25 веры, совесть чиста.'); shiftAlign(3); }
    U.wins++;
  } else if (rm.type === 'path') {
    const next = U.idx + 1;
    if (opt.to === 'skip') {
      const c = memberCheck(U, opt), ok = rnd(1, 20) + c.bonus + rm.bonus >= 12;
      if (ok) { ulog(`${c.who.hero} нашёл потайной ход! Отряд срезал путь прямо к боссу и подкрался незаметно (+3 к следующей проверке).`); U.rooms.splice(next, U.rooms.length - next - 1); U.bonusNext = 3; U.wins++; }
      else { ulog(`${c.who.hero} застрял в щели. Пока его вытаскивали, проснулась стража.`); if (U.rooms[next] !== 'boss') U.rooms[next] = 'fight'; U.fails++; }
    } else if (U.rooms[next] && U.rooms[next] !== 'boss') { U.rooms[next] = opt.to; ulog(opt.to === 'treasure' ? 'Сыр привёл к сокровищнице!' : 'Храп привёл к страже. Зато там будет добыча.'); }
  } else {
    const isBoss = rm.type === 'boss';
    const dc = 10 + Math.ceil(U.tier / 2) + (isBoss ? 3 : 0) + rnd(0, 2);
    let tries = isBoss ? 2 : 1, ok = false, who;
    while (tries-- > 0 && !ok) {
      const c = memberCheck(U, opt.s ? opt : { s: 'str' }); who = c.who;
      if (who.isMe) { const chk = check(opt.s || 'str', dc, rm.bonus + (opt.cls && opt.cls.includes(h.cls) ? 4 : 0)); ok = chk.ok; if (chk.note) ulog(`(${chk.label})`); }
      else ok = rnd(1, 20) + c.bonus + rm.bonus >= dc;
      if (!ok && isBoss && tries > 0) ulog(`${who.hero} не справился — босс отбросил отряд! Ещё одна попытка…`, 'foe');
    }
    const cn = CLASSES[who.cls].n.toLowerCase();
    if (ok) {
      U.wins++; const g = Math.round(rnd(10, 25) * goldScale(L) * (isBoss ? 3 : 1)); U.gold += g; U.xp += Math.round(xpUnit(L) * (isBoss ? 10 : 4));
      const lines = { fight: `${who.hero} (${cn}) повёл отряд — стража разбита!`, trap: `${who.hero} (${cn}) провёл всех через ловушку без единой царапины.`, puzzle: `${who.hero} (${cn}) разгадал загадку. Ответ был «огурец». Опять.`, boss: `${who.hero} (${cn}) нанёс решающий удар! «${rm.m}» повержен!` };
      ulog('✅ ' + lines[rm.type], 'me');
      if (rm.type === 'fight' && R() < .4) U.loot.push(makeItem(undefined, L, rollRarity(.6)));
      if (isBoss) { U.loot.push(makeItem(undefined, L, Math.max(2, rollRarity(1.2 + U.wins * .2)))); if (R() < .4) U.loot.push(makeItem(undefined, L, Math.max(1, rollRarity(.8)))); }
    } else {
      U.fails++;
      let dmg = h.maxHp * (rm.type === 'trap' ? .2 : .25) * (isBoss ? 1.4 : 1) * (.8 + R() * .4);
      if (rm.shield) dmg *= .5; if (rm.type === 'trap' && h.race === 'dwarf') dmg *= .67; if (rm.type === 'trap' && hasFeat('sentinel')) dmg *= .3;
      const d = Math.round(dmg); h.hp -= d;
      U.party.forEach(p => { if (!p.isMe) p.hp = Math.max(0, p.hp - rnd(10, 30)); });
      const lines = { fight: `Стража оказалась сильнее. ${who.hero} отступил первым.`, trap: `${who.hero} наступил ровно туда, куда не надо. Сработало всё сразу.`, puzzle: `Ответ был неверный. Дверь обиделась и плюнула в отряд камнями.`, boss: `«${rm.m}» раскидал отряд. Пришлось отступить с тем, что успели схватить.` };
      ulog(`❌ ${lines[rm.type]} ${h.name}: −${d} HP.`, 'foe');
      if (h.hp <= 0) { h.hp = 1; U.carried = true; ulog(`${h.name} без сознания. Отряд выносит его на руках. Поход окончен.`, 'foe'); }
    }
  }
  U.idx++;
  U.phase = 'resolve'; U.t = 5; U.T = 5;
}
function endDungeon() {
  const U = S.dun, h = S.hero;
  const boss = U.rooms[U.rooms.length - 1] === 'boss' && U.idx >= U.rooms.length;
  const ok = !U.carried && U.wins >= Math.ceil(U.rooms.length / 2) && boss;
  const mult = U.carried ? .4 : 1;
  const gold = Math.round(U.gold * mult), xp = Math.round((U.xp + (ok ? xpUnit(h.lvl) * 15 : 0)) * mult);
  h.gold += gold; gainXp(xp); addGxp(30 + U.wins * 10);
  if (ok) { addTrust(3); S.stats.dwinsD++; }
  const items = U.carried ? U.loot.slice(0, 1) : U.loot;
  const names = [];
  for (const it of items) { const worn = equip(it, true); names.push(`«${it.n}» (${RARITY[it.rar].n}${worn ? ', надел' : ''})`); if (worn && it.curse) diary(`Надел трофей «${it.n}», а он проклят: ${CURSES[it.curse.k].d}!`, 'fight'); }
  rivals.reportDungeon({ ok, godIds: U.party.filter(p => !p.isMe).map(p => p.godId) });
  U.result = `${ok ? '🏆 Подземелье пройдено!' : U.carried ? '🩹 Героя вынесли на руках.' : '😅 Отряд выбрался, но босс жив.'} Добыча: ${gold} 💰, ${xp} опыта${names.length ? ', ' + names.join(', ') : ''}.`;
  ulog(U.result, 'sys');
  diary(`🏰 ${ok ? `Прошёл «${U.name}»! Отряд — молодцы, я — особенно.` : `Вернулся из «${U.name}». Было весело, но не очень.`}`, items.some(i => i.rar >= 2) ? 'rare' : 'event', `+${gold} 💰, +${xp} опыта${names.length ? ', ' + names.join(', ') : ''}`);
  U.phase = 'end'; U.t = 12; U.T = 12;
  h.state = 'road';
}
function dunTick(idt) {
  const U = S.dun;
  U.t -= idt;
  if (U.phase === 'intro') { if (U.t <= 0) dunBeginRoom(); return; }
  if (U.phase === 'end') { if (U.t <= 0) S.dun = null; return; }
  if (U.phase === 'resolve') { if (U.t <= 0) { if (U.carried || U.idx >= U.rooms.length) endDungeon(); else dunBeginRoom(); } return; }
  const rm = U.room, el = DUN_ROOM_T - U.t;
  if (!rm.planned) dunRequestPlan();
  for (const p of rm.plan) if (!p.done && el >= p.at) {
    p.done = 1; const m = U.party.find(x => x.godId === p.godId); if (!m) continue;
    if (p.vote !== undefined && rm.opts[p.vote]) { rm.votes[p.godId] = p.vote; ulog(`${m.god} (бог героя ${m.hero}) голосует: «${rm.opts[p.vote].l}»`, 'foe'); }
    if (p.act && DUN_POW[p.act]) { const P = DUN_POW[p.act]; if (P.bonus) rm.bonus += P.bonus; if (P.heal) rm.heal += P.heal * .5; if (P.shield) rm.shield = true; rm.aiActs.push(p.act); ulog(`${m.god} помогает: ${DUEL_NAMES[p.act]}`, 'foe'); }
  }
  if (U.t <= 0) dunResolve();
}
function dunAutoFinish() {
  // Бог отсутствовал: отряд доходит сам, голосуют только ИИ-боги (по умолчанию — классовый вариант)
  let guard = 0;
  while (S.dun && S.dun.phase !== 'end' && guard++ < 20) {
    const U = S.dun;
    if (U.phase === 'intro' || (U.phase === 'resolve' && !U.carried && U.idx < U.rooms.length)) { dunBeginRoom(); continue; }
    if (U.phase === 'resolve') { endDungeon(); continue; }
    if (U.phase === 'room') dunResolve();
  }
  if (S.dun) S.dun = null;
  if (S.hero.state === 'dungeon') S.hero.state = 'road';
}

/* =====================================================================
   9) ГЛАВНЫЙ ЦИКЛ И ОФЛАЙН
   ===================================================================== */
let saveAcc = 0;
const rspan = a => a[0] + R() * (a[1] - a[0]);
function syncGuards() {
  const h = S.hero;
  if (h.state === 'duel' && !S.duel && !duelPending) h.state = 'road';
  if (h.state === 'dungeon' && !S.dun && !dunPending) h.state = 'road';
  if (h.state === 'fight' && !h.monster) h.state = 'road';
  if (h.monster && h.state !== 'fight') h.monster = null;
  if (h.state === 'rest' && h.restT <= 0) h.state = 'road';
  if (S.fork && (h.state === 'dead' || S.duel || S.dun)) S.fork = null;
}
function passiveTick(gdt) {
  const h = S.hero;
  addFaith(faithRegen() * gdt);
  S.flock.fol += (S.flock.temple * 0.00014 + (S.god.align > 40 ? 0.0001 : 0)) * gdt;
  for (const k in S.buffs) if (S.buffs[k] > 0) S.buffs[k] = Math.max(0, S.buffs[k] - gdt);
  if (h.orcCd > 0) h.orcCd = Math.max(0, h.orcCd - gdt);
  if (h.state === 'dead') { h.deadT -= gdt; if (h.deadT <= 0) resurrect(false); }
  if (S.featOffer) { if (!SILENT) { S.featOffer.t -= gdt; if (S.featOffer.t <= 0) heroPicksFeat(); } } // офлайн черты ждут бога
  else if (S.featQueue > 0) offerFeat();
  S.timers.rivals -= gdt;
  if (S.timers.rivals <= 0) { S.timers.rivals = PACE.rivals; const r = pick(S.rivals); if (r.lvl < S.god.lvl + 2 && R() < .5) r.lvl++; r.hlvl = clamp(h.lvl + rnd(-1, 1), 1, MAX_LVL); if (R() < .5) r.army += rnd(0, 2); }
}
function step(realDt) {
  const gdt = realDt * S.speed;               // игровое время
  const idt = realDt * Math.min(S.speed, 2);   // время на решения игрока (ускоряется максимум ×2)
  const h = S.hero;
  syncGuards();
  passiveTick(gdt);
  if (!S.fork && !S.duel && !S.dun) { S.timers.hero -= gdt; if (S.timers.hero <= 0) { heroStep(); S.timers.hero = rspan(PACE.step); } }
  if (S.fork) { S.fork.t -= idt; if (S.fork.t <= 0) timeoutFork(); }
  else if (!S.duel && !S.dun && !dunPending && !duelPending) { S.timers.fork -= gdt; if (S.timers.fork <= 0 && (h.state === 'road' || h.state === 'town')) { startFork(); S.timers.fork = rspan(PACE.fork); } }
  if (S.duel) duelTick(idt);
  else if (!S.fork && !S.dun && !dunPending) { S.timers.duel -= gdt; if (S.timers.duel <= 0 && h.state === 'road') { S.timers.duel = rspan(PACE.duel); startDuel(); } }
  if (S.dun) dunTick(idt);
  else if (!S.fork && !S.duel && !duelPending) { S.timers.dun -= gdt; if (S.timers.dun <= 0 && h.state === 'road') { S.timers.dun = rspan(PACE.dun); startDungeon(false); } }
  if (S.ev) evTick(idt);
  else { S.timers.event -= gdt; if (S.timers.event <= 0) { S.timers.event = rspan(PACE.event); startEvent(); } }
  saveAcc += realDt; if (saveAcc > 5) { saveAcc = 0; save(); }
}
function fmtDur(sec) { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h} ч ${m} мин` : `${m} мин`; }
/* Офлайн-симуляция: герой живёт сам (75% темпа), развилки решает сам, итог — сжатая сводка в дневнике */
function simulateAway(sec, why) {
  if (!(sec >= 60)) return null;
  const h = S.hero, cap = Math.min(sec, PACE.offCap);
  if (S.duel) { S.duel = null; h.state = 'road'; diary('Соперник по дуэли не дождался и ушёл с арены.', 'duel'); }
  if (S.dun) dunAutoFinish();
  if (S.ev && S.ev.phase === 'live') resolveEvent();
  if (S.ev) S.ev = null;
  const c = { wins: 0, deaths: 0, quests: 0, forks: 0, lvls: 0, items: [] };
  const g0 = h.gold, f0 = Math.floor(S.flock.fol), l0 = h.lvl, fa0 = S.god.faith;
  SILENT = { buf: [], c };
  let buf;
  try {
    if (S.fork) timeoutFork(true);
    const stepDt = ((PACE.step[0] + PACE.step[1]) / 2) / PACE.offEff;
    let t = 0, forkT = Math.max(60, S.timers.fork);
    while (t < cap) {
      t += stepDt;
      syncGuards();
      passiveTick(stepDt);
      forkT -= stepDt;
      if (forkT <= 0 && (h.state === 'road' || h.state === 'town')) { if (startFork() !== false && S.fork) timeoutFork(true); forkT = rspan(PACE.fork); }
      heroStep();
    }
    S.timers.fork = Math.max(60, forkT);
    S.timers.hero = Math.min(S.timers.hero, 5);
  } finally { buf = SILENT.buf; SILENT = null; }
  // яркие моменты: уровни, черты, редкие вещи, смерти + пара смешных развилок
  const pri = buf.filter(e => ['level', 'rare', 'death'].includes(e.c));
  const forks = buf.filter(e => e.c === 'fork' && !e.x.startsWith('🙏')).sort(() => R() - .5).slice(0, 2);
  const hl = pri.slice(-8).concat(forks);
  for (const e of hl.reverse()) { e.x = '⏳ ' + e.x; S.diary.unshift(e); }
  const gd = h.gold - g0, fd = Math.floor(S.flock.fol) - f0;
  diary(`📖 Пока вас не было (${fmtDur(cap)}${sec > cap ? ', дальше герой спал' : ''})${why ? ' — ' + why : ''}: побед в боях ${c.wins}, смертей ${c.deaths}, заданий ${c.quests}, развилок решил сам ${c.forks}. Золото ${gd >= 0 ? '+' : ''}${gd}, паства ${fd >= 0 ? '+' : ''}${fd}, вера ${Math.floor(fa0)} → ${Math.floor(S.god.faith)}.${h.lvl > l0 ? ` Уровень ${l0} → ${h.lvl}!` : ''}${c.items.length ? ' Ценные находки: ' + c.items.slice(0, 4).join(', ') + '.' : ''}`, 'event');
  if (S.diary.length > 150) S.diary.length = 150;
  diaryVer++;
  return c;
}
function offlineCatchUp() {
  const sec = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (sec >= 60) simulateAway(sec);
  if (S._migratedV3) {
    const m = S._migratedV3; delete S._migratedV3;
    diary(`✨ Мир обновился! Теперь я — ${RACES[m.race].n.toLowerCase()}-${CLASSES[m.cls].n.toLowerCase()}. Память слегка подтёрлась: был ${m.oldL}-го уровня, теперь ${m.newL}-го, зато с характеристиками и чертами. Боги говорят, так честнее.`, 'level');
  }
}

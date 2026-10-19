
/* =====================================================================
   11) ПРОВАЙДЕРЫ v4: бои/арена и чат.
   Вся «чужая воля» в боях (боты сейчас, живые игроки потом) идёт через
   FightProvider, а чат — через ChatProvider. Для онлайна (например, Supabase
   Realtime) достаточно реализовать NetworkFightProvider / NetworkChatProvider
   с теми же методами и заменить две строки создания провайдеров ниже.
   ===================================================================== */
class FightProvider {
  /** Ходы всех не-наших бойцов. view: {id, turn, fighters:[{id,team,cls,hp,max,alive,isMe}], tele}
   *  @returns {Promise<Array<{fid,target,atk:string[],blk:string[]}>>|Array} — можно вернуть не всех: недостающих доберёт локальная логика. */
  decideTurn(view) { throw new Error('not implemented'); }
  /** Сила бога-соперника в дуэли богов на этот ход. @returns {Promise<{act}|null>|{act}|null} */
  rivalPower(view) { return null; }
  /** Обновить заявки арены (новые заявки, вступления). Возвращает заявки с игроком, которые пора начинать. */
  arenaTick(arena, dt, ctx) { return []; }
  /** Боец-бот под уровень. @returns {{name,race,cls,lvl,rating}} */
  makeBot(lvl) { throw new Error('not implemented'); }
  reportFight(result) { }
}
class ChatProvider {
  /** onMsg({from, x, c}) — входящие сообщения (боты/игроки/система) */
  connect(onMsg) { this.on = onMsg; }
  send(from, text) { }
  system(text) { }
  tick(dt) { }
}
const FIGHT_POW_COST = DUEL_COST;
class LocalBotFightProvider extends FightProvider {
  constructor(getState) { super(); this.st = getState; }
  decideTurn(view) {
    const F = this.st().fight; if (!F || F.id !== view.id) return [];
    return F.fighters.filter(f => !f.isMe && f.alive).map(f => Object.assign({ fid: f.id }, botBrain(F, f)));
  }
  rivalPower(view) {
    const F = this.st().fight; const G = F && F.rivalGod; if (!G || G.left < 1 || R() > .4) return null;
    const foe = F.fighters.find(f => f.team === 1), w = Object.assign({}, AI_W[G.pers] || AI_W.aggr);
    if (foe && foe.hp / foe.max < .4) { w.heal = (w.heal || 0) + 6; w.rain = (w.rain || 0) + 3; }
    const opts = Object.keys(w).filter(k => FIGHT_POW_COST[k] <= G.faith && w[k] > 0); if (!opts.length) return null;
    let r = R() * opts.reduce((s, k) => s + w[k], 0); for (const k of opts) { r -= w[k]; if (r <= 0) return { act: k }; }
    return { act: opts[0] };
  }
  makeBot(lvl) {
    const used = new Set((this.st().arena.apps || []).flatMap(a => appBots(a).map(b => b.name)));
    let name = pick(BOT_NAMES), k = 0; while (used.has(name) && k++ < 20) name = pick(BOT_NAMES);
    const L = clamp(lvl + rnd(-1, 1), 1, MAX_LVL);
    const race = pick(Object.keys(RACES)), cls = pick(Object.keys(CLASSES));
    return { name, race, cls, bld: bldForBot(cls, race), lvl: L, rating: Math.round(1000 + (L - 1) * 25 + rnd(-120, 120)) };
  }
  arenaTick(A, dt, ctx) {
    const start = [];
    for (const a of A.apps.slice()) {
      a.t -= dt;
      const fillP = dt * (a.joined !== null ? .28 : .08);
      if (!appFull(a) && R() < fillP && !(a.type === 'duel' && a.joined === null && !a.mine)) appAddBot(a, this.makeBot(ctx.lvl));
      if (a.type === 'duel' && a.mine && !appFull(a) && a.t < a.T - rnd(4, 12)) appAddBot(a, this.makeBot(ctx.lvl));
      if (appFull(a)) {
        if (a.joined !== null) { start.push(a); continue; }
        if (a.type !== 'duel') { chatSys(`⚔ На арене начался бой: ${ARENA_TYPES[a.type].n} (${appTitle(a)}).`); A.apps.splice(A.apps.indexOf(a), 1); continue; }
      }
      if (a.t <= 0) {
        if (a.joined !== null) { while (!appFull(a)) appAddBot(a, this.makeBot(ctx.lvl)); start.push(a); }
        else A.apps.splice(A.apps.indexOf(a), 1);
      }
    }
    if (A.apps.filter(a => !a.mine).length < 5 && R() < dt * .15) A.apps.push(newBotApp(A, this.makeBot(ctx.lvl), ctx.lvl));
    return start;
  }
}
class LocalBotChatProvider extends ChatProvider {
  constructor() { super(); this.t = 25; this.pending = []; }
  tick(dt) {
    if (SILENT || !this.on) return;
    this.t -= dt;
    if (this.t <= 0) { this.t = rnd(60, 150); this.on({ from: pick(BOT_NAMES), x: pick(CHAT_BOT_LINES), c: 'bot' }); }
    for (const p of this.pending.slice()) { p.t -= dt; if (p.t <= 0) { this.pending.splice(this.pending.indexOf(p), 1); this.on({ from: p.from, x: p.x, c: 'bot' }); } }
  }
  send(from, text) {
    if (!this.on) return; this.on({ from, x: text, c: 'me' });
    if (R() < .6) { const rr = CHAT_REPLIES.find(r => r.re.test(text)); this.pending.push({ t: rnd(2, 6), from: pick(BOT_NAMES), x: pick(rr.r).split('{me}').join(from) }); }
  }
  system(text) { if (this.on) this.on({ from: '', x: text, c: 'sys' }); }
  fightNews(text) { this.system(text); if (R() < .2) this.pending.push({ t: rnd(3, 8), from: pick(BOT_NAMES), x: pick(['удачи!', 'ставлю на наших', 'опять без меня 😢', 'бей в голову!', 'смотрю лог, болею']) }); }
}
const fightProv = new LocalBotFightProvider(() => S);
const chat = new LocalBotChatProvider();
let chatVer = 0;
chat.connect(m => {
  if (!S || SILENT) return;
  const C = S.chat; C.msgs.push({ tm: nowStr(), from: String(m.from || '').slice(0, 30), x: String(m.x || '').slice(0, 200), c: m.c || 'bot' });
  if (C.msgs.length > 60) C.msgs.splice(0, C.msgs.length - 60);
  if (!C.open && m.c !== 'me') C.unread = Math.min(99, C.unread + 1);
  chatVer++;
});
const chatSys = t => chat.system(t);
function chatSend(text) { text = String(text || '').trim().slice(0, 120); if (!text) return; chat.send(S.god.name, text); }

/* =====================================================================
   12) БОЙ ПО ЗОНАМ (как в «Бойцовском клубе»)
   ===================================================================== */
const TURN_T = 30, AUTO_T = 2.5, DMG_K = 1.6, MAX_TURNS = 40;
const ARENA_KINDS = ['duel', 'group', 'chaos', 'godduel'];
let FSEQ = 0;
const newFid = () => 'f' + (++FSEQ) + Math.random().toString(36).slice(2, 6);
function armorOf(h, temple) { const a = h.eq.armor; return (a ? a.ac + a.plus : 0) + Math.floor((temple || 0) / 2) + (h.feats && h.feats.includes('ironskin') ? 1 : 0); }
function heroUnit() {
  const h = S.hero, sh = sheet(), st = STYLE[h.cls];
  return { id: 'me', name: h.name, team: 0, kind: 'hero', isMe: true, race: h.race, cls: h.cls, lvl: h.lvl, hp: Math.max(1, h.hp), max: h.maxHp,
    avg: sh.avg * CLASS_BAL[h.cls].z, armor: armorOf(h, S.flock.temple), za: zoneArmor(h, S.flock.temple), gx: gearFx(h), dex: mod(statVal('dex')), intu: Math.max(mod(statVal('wis')), mod(statVal('int'))), wis: mod(statVal('wis')),
    atkN: st.atk, blkN: blkFor(h.cls, h), habit: BLD(h) && R() < .75 ? BLD(h).z : st.h, bz: BLD(h) ? BLD(h).bz : null, bf: bldFx(bldId(h), h.cls), alive: true, buf: {}, debuf: 0, bear: 0, used: {}, rating: S.arena.rating, dealt: 0, props: gearProps(h) };
}
/* Боевые свойства снаряжения, которые видны в бою по зонам */
function gearProps(h) { const o = []; for (const p of allProps(h)) if (PROP_IC[p.k] && !o.includes(p.k)) o.push(p.k); return o; }
function botUnit(b) {
  const bb = BUILDS[b.bld] ? b.bld : bldForBot(b.cls, b.race);
  const vh = virtualHero(b.race, b.cls, b.lvl), sh = sheetOf(vh, 0), st = STYLE[b.cls], gk = clamp(b.gk || 1, .5, 2), max = Math.round(calcMaxHp(vh) * gk);
  return { id: newFid(), name: b.name, team: 1, kind: 'bot', race: b.race, cls: b.cls, lvl: b.lvl, hp: b.hpPct ? Math.max(1, Math.round(max * b.hpPct / 100)) : max, max,
    avg: sh.avg * CLASS_BAL[b.cls].z * BOT_K * (1 + Math.max(0, b.lvl - 9) * .065) * gk, armor: armorOf(vh, 0), za: zoneArmor(vh, 0), gx: gearFx(vh), props: gearProps(vh), dex: mod(statValOf(vh, 'dex')), intu: Math.max(mod(statValOf(vh, 'wis')), mod(statValOf(vh, 'int'))), wis: mod(statValOf(vh, 'wis')),
    atkN: st.atk, blkN: blkFor(b.cls, vh), habit: BUILDS[bb] && R() < .6 ? BUILDS[bb].z : R() < .6 ? st.h : pick(ZONES), bz: BUILDS[bb] ? BUILDS[bb].bz : null, bf: bldFx(bb, b.cls), bld: bb, alive: true, buf: {}, debuf: 0, bear: 0, used: {}, rating: b.rating || 1000, ref: b.ref || null, dealt: 0 };
}
const MON_REF = {};
function monsterRef(t) {
  if (MON_REF[t]) return MON_REF[t];
  let avg = 0, hp = 0, arm = 0; const cl = Object.keys(CLASSES);
  for (const c of cl) { const vh = virtualHero('human', c, t); avg += sheetOf(vh, 0).avg * (CLASS_BAL[c].z || 1); hp += calcMaxHp(vh); arm += armorOf(vh, 0); }
  return (MON_REF[t] = { avg: avg / cl.length, hp: hp / cl.length, arm: arm / cl.length });
}
function monsterUnit(name, tier, o) {
  o = o || {}; tier = Math.max(1, tier);
  const ref = monsterRef(Math.min(tier, MAX_LVL + 5)), el = !!o.elite;
  const max = Math.max(8, Math.round(ref.hp * MON_K.hp * (o.hp || 1) * (el ? 1.25 : 1) * (.9 + R() * .2)));
  return { id: newFid(), name: el ? `${name} (элита)` : name, team: 1, kind: o.boss ? 'boss' : el ? 'elite' : 'monster', cls: null, lvl: tier, hp: max, max,
    avg: Math.max(1, ref.avg * MON_K.d * (o.dmg || 1) * (el ? 1.12 : 1)), armor: Math.round(ref.arm * MON_K.arm) + (o.boss ? 2 : el ? 1 : 0),
    dex: Math.floor(tier / 5), intu: Math.floor(tier / 6) + (el ? 1 : 0), wis: Math.floor(tier / 6), elite: el,
    atkN: 1, blkN: o.boss || el ? 2 : 1, habit: pick(ZONES), alive: true, buf: {}, debuf: 0, bear: 0, used: {}, boss: o.boss || null, dealt: 0,
    weak: el && UNDEAD_RE.test(name) ? 'holy' : null, res: el && UNDEAD_RE.test(name) ? 'vamp' : el && /Голем|Огр|Медвед/.test(name) ? 'thorns' : null };
}
const UNDEAD_RE = /Скелет|Некромант|Дух|Призрак|Лич|Зомби|Упыр|Мертв|Вампир/;
function blkSet(z, n) { const i = ZONES.indexOf(z), at = k => ZONES[(i + k + 5) % 5]; return n <= 1 ? [z] : n === 2 ? [z, at(1)] : [at(-1), z, at(1)]; }
function flog(F, t, c) { F.log.unshift({ t, c: c || 'sys' }); if (F.log.length > 80) F.log.length = 80; }
const fAlive = (F, team) => F.fighters.filter(f => f.alive && (team === undefined || f.team === team));
const fEnemies = (F, f) => F.fighters.filter(x => x.alive && x.team !== f.team);
const fMe = F => F.fighters.find(f => f.isMe);
/* Присутствие бога: недавний ввод и открытая вкладка. Нет бога — герой бьётся сам, осторожно и без сил. */
let lastInputT = Date.now(), hiddenSince = 0, fightVis = false, fightWait = 0;
const godPresent = () => !SILENT && typeof document !== 'undefined' && !document.hidden && Date.now() - lastInputT < 120000;
const setLastInput = t => { lastInputT = t === undefined ? Date.now() : t; };
const FIGHT_ACT_KINDS = ['monster', 'dungeon'];
const capUnit = f => !!f && (f.kind === 'hero' || f.kind === 'bot');
const PREP_T = 30, TURN_MIN = 15;
const hpTag = f => `[${Math.max(0, f.hp)}/${f.max}]`;
function wpick(w) { let s = 0; for (const k in w) s += w[k]; let r = R() * s; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; }
/* «Мозг» бота (и привычки героя, когда бог молчит) */
function botBrain(F, f) {
  const en = fEnemies(F, f); if (!en.length) return { target: null, atk: [], blk: [] };
  let target;
  if (f.isMe && F.my.target && en.find(e => e.id === F.my.target)) target = F.my.target;
  else {
    const mon = f.kind !== 'bot' && f.kind !== 'hero', tg = F._tg || (F._tg = {});
    const w = {}; for (const e of en) { w[e.id] = 1 + (e.hp / e.max < .35 ? 2 : 0) + ((e.cls === 'warrior' || e.cls === 'barbarian') ? .8 : 0) + (e.kind === 'boss' ? 1 : 0) + (e.isMe && f.kind !== 'bot' && F.kind !== 'dungeon' ? .5 : 0);
      if (mon) { if (e.bf && e.bf.id === 'tank') w[e.id] += 1.2; w[e.id] /= 1 + .9 * (tg[e.id] || 0); } } /* монстры не сваливаются толпой на одного: танк держит внимание */
    const lt = F.lastTarget && F.lastTarget[f.id];
    target = R() < .55 && lt && en.find(e => e.id === lt) && !(mon && (tg[lt] || 0) >= 1) ? lt : wpick(w);
    if (mon) tg[target] = (tg[target] || 0) + 1;
  }
  const tb = (F.lastBlk || {})[target] || [];
  const atk = [];
  while (atk.length < f.atkN) {
    const w = {}; for (const z of ZONES) w[z] = 1 + (z === f.habit ? 2.2 : 0) - (tb.includes(z) ? .6 : 0) + (z === 'head' ? .4 : 0);
    const z = wpick(w); if (!atk.includes(z) || atk.length >= 4) atk.push(z);
  }
  let bz;
  if (F.tele && f.team !== F.fighters.find(x => x.id === F.tele.fid).team && R() < (f.isMe ? DUN_K.ablk : .6)) bz = F.tele.zone;
  else { const la = (F.lastAtk || {})[f.id] || []; bz = la.length && R() < .5 ? pick(la) : f.bz && R() < .35 ? f.bz : (R() < .4 ? 'head' : pick(ZONES)); }
  const blk = f.blkN === 2 && R() < .5 ? blkSet(ZONES[(ZONES.indexOf(bz) + 4) % 5], 2) : blkSet(bz, f.blkN);
  return { target, atk, blk };
}
/* Герой без подсказки бога: осторожен — закрывается от объявленного удара, от того, куда били, пьёт зелье на краю */
function heroBrain(F, me) {
  const c = botBrain(F, me); c.act = null;
  const tf = F.tele && F.fighters.find(x => x.id === F.tele.fid);
  if (tf && tf.team !== me.team && R() < .85) c.blk = blkSet(F.tele.zone, me.blkN);
  if (FIGHT_ACT_KINDS.includes(F.kind) && me.hp < me.max * .3 && S.hero.potions > 0) c.act = 'potion';
  return c;
}
function fleeChance(F, me) {
  if (!me || !FIGHT_ACT_KINDS.includes(F.kind)) return 0;
  const en = fEnemies(F, me), boss = en.some(e => e.boss);
  return clamp(.5 + .05 * (me.dex || 0) - (boss ? .25 : 0) - .06 * Math.max(0, en.length - 1) + (fAlive(F, 0).length > 1 ? .1 : 0), .15, .85);
}
function fightView(F) { return { id: F.id, turn: F.turn, tele: F.tele, fighters: F.fighters.map(f => ({ id: f.id, team: f.team, cls: f.cls, hp: f.hp, max: f.max, alive: f.alive, isMe: !!f.isMe })) }; }
/* Начало боя. allies/enemies — массивы бойцов (наш герой — в allies). */
function beginBattle(kind, allies, enemies, o) {
  o = o || {};
  allies.forEach(u => u.team = 0); enemies.forEach(u => u.team = 1);
  const F = { id: 'b' + Date.now().toString(36) + rnd(100, 999), kind, title: o.title || 'Бой', fighters: allies.concat(enemies), turn: 0, phase: 'intro', t: 3, T: 3, prep: 0,
    my: { atk: [], blk: [], target: null }, choices: {}, ready: false, log: [], auto: !!S.fightAuto || !!o.auto, powersLeft: 3, usedTurn: 0,
    result: null, rew: '', win: null, rivalGod: o.rivalGod || null, ctx: o.ctx || {}, tele: null, lastAtk: {}, lastBlk: {}, lastTarget: {}, stuck: 0 };
  S.fight = F; F._tg = {};
  /* подготовка: бог рядом — есть время осмотреться и выбрать зоны; без бога герой начинает почти сразу */
  if (!SILENT && !F.auto && godPresent()) { F.T = F.t = PREP_T; F.prep = 1; }
  fightVis = false; fightWait = 0;
  if (!SILENT && S.ui) S.ui.mtab = 'hero';
  const n0 = allies.map(u => u.name).join(', '), n1 = enemies.map(u => u.name).join(', ');
  flog(F, `Бой начался! ${n0} против ${n1}. ${o.intro || ''}`.trim());
  if (!SILENT) chat.fightNews(`⚔ ${F.title}: ${allies.length > 1 ? 'команда ' + S.hero.name : S.hero.name} против ${enemies.length > 1 ? enemies.length + ' противников' : enemies[0].name}.`);
  return F;
}
function nextTurn(F) {
  const me0 = fMe(F);
  const pres = godPresent();
  F.turn++; F.phase = 'turn'; F.absent = !F.auto && !pres; F.T = F.auto || !(me0 && me0.alive) ? AUTO_T : pres ? TURN_T : AUTO_T * 2; F.t = F.T; F.choices = {}; F.ready = false; F.usedTurn = 0; F._tg = {};
  for (const f of F.fighters) { f.buf.shield = 0; f.buf.dodge = 0; }
  const me = fMe(F), en = me ? fEnemies(F, me) : [];
  const keepAtk = F.turn === 1 && F.my.atk && F.my.atk.length === (me ? me.atkN : 1) ? F.my.atk : [];
  F.my.atk = keepAtk; F.my.act = F.turn === 1 ? F.my.act || null : null; F.my.blk = F.my.blk && F.my.blk.length === (me ? me.blkN : 2) ? F.my.blk : [];
  if (!F.my.target || !en.find(e => e.id === F.my.target)) F.my.target = en[0] ? en[0].id : null;
  bossPreTurn(F);
  if ((F.auto || F.absent) && me && me.alive) { const c = heroBrain(F, me); F.my = { atk: c.atk, blk: c.blk, target: c.target, act: c.act }; F.ready = !!F.auto; }
  const st = S, id = F.id, turn = F.turn;
  Promise.resolve(fightProv.decideTurn(fightView(F))).then(list => { if (S !== st || !S.fight || S.fight.id !== id || S.fight.turn !== turn) return; for (const c of list || []) S.fight.choices[c.fid] = c; }).catch(() => { });
  if (F.rivalGod && F.rivalGod.left > 0) Promise.resolve(fightProv.rivalPower(fightView(F))).then(p => { if (p && S === st && S.fight && S.fight.id === id && S.fight.turn === turn && S.fight.phase === 'turn') rivalGodAct(S.fight, p.act); }).catch(() => { });
}
function bossPreTurn(F) {
  F.tele = null;
  for (const e of F.fighters) if (e.elite && e.alive && !e.used.enr && e.hp < e.max / 2) { e.used.enr = 1; e.atkN = 2; flog(F, `⚠ ${e.name} звереет: теперь бьёт дважды!`, 'warn'); }
  const b = F.fighters.find(f => f.boss && f.alive); if (!b) return;
  const m = b.boss.m, T = F.turn, K = (typeof DUN_K !== 'undefined' ? DUN_K.tele : 2.3);
  const heavy = (z, mul, txt) => { F.tele = { zone: z, fid: b.id, mul }; flog(F, `⚠ ${txt || `${b.name} замахивается ${ZONE_ACC[z]} по всему отряду!`} Блокируйте ${ZONE_GEN[z]}!`, 'warn'); };
  if (m === 'tele' && T % 2 === 0) heavy(pick(ZONES), K);
  if (m === 'adds') {
    if (T % 3 === 2) flog(F, `⚠ ${b.name} набирает воздуха — на следующем ходу позовёт крысят. Пока они живы, он бьёт больнее.`, 'warn');
    if (T % 3 === 0 && T <= 12) { for (let i = 0; i < 2; i++) { const a = monsterUnit('Крысёныш', Math.max(1, b.lvl - 4), { hp: .6, dmg: .7 }); a.team = b.team; F.fighters.push(a); } flog(F, `⚠ ${b.name} свистнул — из нор лезут крысята!`, 'warn'); }
    if (T % 4 === 0) heavy(pick(ZONES), K * .9);
    const adds = F.fighters.filter(f => f.alive && f.team === b.team && !f.boss).length; b.buf.adds = adds;
  }
  if (m === 'sweep' && T % 3 === 0) { const z = pick(['legs', 'belly']); heavy(z, K * .85, `${b.name} раскручивает хвост — он летит низко, ${ZONE_ACC[z]}!`); }
  if (m === 'enrage') {
    if (!b.used.warn && b.hp < b.max * .65) { b.used.warn = 1; flog(F, `⚠ ${b.name} закипает: ещё немного — и впадёт в ярость. Добивайте быстрее или готовьте щит!`, 'warn'); }
    if (!b.used.enr && b.hp < b.max / 2) { b.used.enr = 1; b.atkN = 2; b.avg *= 1.25; flog(F, `⚠ ${b.name} в ярости! Теперь бьёт дважды за ход.`, 'warn'); }
    if (T % 3 === 0) heavy(pick(ZONES), K);
  }
}
function fightTargetOk(F, f, t) { const x = F.fighters.find(e => e.id === t); return x && x.alive && x.team !== f.team; }
function choiceFor(F, f) {
  if (f.isMe) {
    const c = { target: F.my.target, atk: F.my.atk.slice(), blk: F.my.blk.slice(), act: F.my.act || null };
    if (c.atk.length < f.atkN || c.blk.length !== f.blkN || !fightTargetOk(F, f, c.target)) {
      const b = heroBrain(F, f); let note = false;
      if (!fightTargetOk(F, f, c.target)) { c.target = b.target; note = true; }
      while (c.atk.length < f.atkN) { c.atk.push(b.atk[c.atk.length] || pick(ZONES)); note = true; }
      if (c.blk.length !== f.blkN) { c.blk = b.blk; note = true; }
      if (note && !F.auto && !F.absent) flog(F, `${f.name} не дождался подсказки бога и действует осторожно, по привычке.`, 'sys');
    }
    return c;
  }
  let c = F.choices[f.id];
  if (!c || !Array.isArray(c.atk) || !Array.isArray(c.blk)) c = botBrain(F, f);
  if (!fightTargetOk(F, f, c.target)) c = Object.assign({}, c, { target: botBrain(F, f).target });
  return { target: c.target, atk: c.atk.filter(z => ZONES.includes(z)).slice(0, f.atkN), blk: c.blk.filter(z => ZONES.includes(z)).slice(0, 3) };
}
function hitOne(F, a, d, z, picks, o) {
  o = o || {};
  const P = picks[d.id] || { blk: [] };
  const ag = a.gx || {}, dg = d.gx || {};
  const aimed = (a.cls && STYLE[a.cls].aimed && R() < .15) || (ag.aim && R() < ag.aim);
  const blocked = !o.magic && !o.aoe && P.blk.includes(z) && !aimed || (o.aoe && P.blk.includes(z));
  const abf = a.bf || {}, dbf = d.bf || {};
  const dodgeP = clamp(.07 + .03 * (d.dex - a.dex) + (d.buf.dodge || 0) + (dg.dodge || 0) + (dbf.dodge || 0) - (d.kind === 'boss' ? .03 : 0), .03, .55);
  const bard = F.fighters.some(x => x.alive && x.team === a.team && x.cls === 'bard');
  const ap = a.props || [], bw = d.weak || d.boss && d.boss.weak, br = d.res || d.boss && d.boss.res;
  let critP = clamp((.06 + .03 * (a.intu - d.wis) + (a.cls === 'rogue' ? .05 : 0) + (bard ? .05 : 0) + (br !== 'crit' ? ag.crit || 0 : 0) + (abf.crit || 0)) * (1 - (dg.acrit || 0)), .02, .5);
  if (a.buf.crit) { critP = 1; a.buf.crit = 0; }
  if (a.debuf > 0) critP = 0;
  const zacc = ZONE_ACC[z];
  if (!blocked && R() < dodgeP) return { dmg: 0, line: pick(F_DODGE).replace('{d}', d.name).replace('{a}', a.name).replace('{z}', zacc), c: 'miss' };
  if (!blocked && !o.magic && !o.aoe && (dg.blk || dbf.blk) && R() < (dg.blk || 0) + (dbf.blk || 0)) return { dmg: 0, line: `🛡 ${d.name} ${dg.sh ? 'принимает удар на щит' : 'в последний миг закрывается'} — ${a.name} бьёт ${zacc} впустую.`, c: 'miss' };
  const crit = R() < critP;
  if (blocked && !(crit && !o.aoe)) return { dmg: 0, line: pick(F_BLOCK).replace('{d}', d.name).replace('{a}', a.name).replace('{z}', zacc), c: 'miss' };
  let dmg = a.avg * DMG_K * (.75 + R() * .5) * ZONE_MUL[z] * (o.mul || 1);
  if (crit) dmg *= blocked ? 1 : 2;
  if (a.cls === 'barbarian') dmg *= 1.15 * (a.hp < a.max / 2 ? 1.3 : 1);
  if (a.cls === 'rogue' && F.turn === 1) dmg *= 1.5;
  if (a.debuf > 0) dmg *= .6;
  if (a.bf) { dmg *= (1 + (abf.dmg || 0)) * (abf.d || 1); if (abf.first && F.turn === 1) dmg *= 1 + abf.first; }
  if (d.bf) dmg *= (1 - (dbf.red || 0)) * (dbf.r || 1);
  if (a.boss && a.buf.adds) dmg *= 1 + .15 * a.buf.adds;
  let tag = '';
  if (ap.includes('fire') && br !== 'fire') { dmg *= 1.12; tag += '🔥'; }
  if (ap.includes('holy') && br !== 'holy') dmg *= 1.05;
  if (bw && ap.includes(bw)) { dmg *= 1.4; tag += ` ${PROP_IC[bw]} слабость!`; }
  if (br && ap.includes(br)) { dmg *= .8; tag += ` ${PROP_IC[br]} не берёт`; }
  dmg *= 1 - Math.min(.5, (d.za ? d.za[z] || 0 : d.armor * ZONE_ARM[z]) * (1 - (ag.pierce || 0)) * .035);
  if (!o.aoe && !o.magic) { const fx = k => ap.includes(k) && br !== k; if (fx('ice') && R() < .12) { d.debuf = Math.max(d.debuf, 2); tag += ' ❄ заморозка'; } if (fx('poison') && R() < .25) { d.buf.psn = 3; tag += ' ☠ яд'; } if (fx('stun') && R() < .08) { d.buf.stun = 1; tag += ' 💫 оглушение'; } }
  if (d.buf.shield) dmg *= .3;
  if (!o.aoe && capUnit(d)) dmg = Math.min(dmg, d.max * (ARENA_KINDS.includes(F.kind) ? DUN_K.aCap[0] : DUN_K.hitCap)); /* один удар не сносит героя целиком */
  dmg = Math.max(1, Math.round(dmg));
  const adv = pick(F_ADV), verb = pick(F_VERB);
  const line = (crit ? `${a.name} ${pick(F_CRIT)} ${verb} ${zacc}${blocked ? ', пробив блок' : ''}! Критический удар` : `${a.name} ${adv} ${verb} ${zacc}${aimed ? ' (меткий выстрел сквозь блок)' : ''}…`) + (tag ? ` ${tag.trim()}` : '');
  const dp = d.props || [], ar = a.res || a.boss && a.boss.res;
  return { dmg, line, c: crit ? 'crit' : (a.team === 0 ? 'me' : 'foe'), vamp: ap.includes('vamp') && br !== 'vamp' ? Math.round(dmg * .15) : 0, thorn: dp.includes('thorns') && ar !== 'thorns' ? Math.max(1, Math.round(dmg * .15)) : 0 };
}
function resolveTurn(F) {
  const alive = F.fighters.filter(f => f.alive), picks = {}, pend = {};
  for (const f of alive) picks[f.id] = choiceFor(F, f);
  F.lastAtk = {}; F.lastBlk = {};
  const add = (d, v) => { pend[d.id] = (pend[d.id] || 0) + v; }, heal = {}, pendT = {};
  const lines = [];
  /* действия героя вместо удара: зелье или попытка сбежать */
  const me0 = fMe(F), mp = me0 && me0.alive ? picks[me0.id] : null; F.my.act = null;
  if (mp && mp.act && FIGHT_ACT_KINDS.includes(F.kind)) {
    if (mp.act === 'flee') {
      const p = fleeChance(F, me0);
      if (R() < p) { flog(F, `— Ход ${F.turn} —`, 'turn'); flog(F, `🏃 ${me0.name} ${F.kind === 'dungeon' ? 'командует отход — отряд вырвался из боя и уходит из пещеры!' : 'вырвался и дал дёру!'} (шанс ${Math.round(p * 100)}%)`, 'me'); return endFled(F); }
      lines.push({ r: { dmg: 0, line: `🏃 ${me0.name} пытается сбежать, но его не пускают (шанс был ${Math.round(p * 100)}%)! Хорошо хоть блок держит.`, c: 'foe' }, d: me0 }); mp.atk = [];
    } else if (mp.act === 'potion') {
      if (S.hero.potions > 0) { S.hero.potions--; const a = Math.min(me0.max - me0.hp, Math.round(me0.max * .35 * (hasFeat('gourmet') ? 1.5 : 1))); me0.hp += a; lines.push({ r: { dmg: 0, line: `🧪 ${me0.name} вместо удара пьёт зелье: +${a} ${hpTag(me0)}`, c: 'heal' }, d: me0 }); }
      mp.atk = [];
    }
  }
  for (const a of alive) {
    const P = picks[a.id], d = F.fighters.find(x => x.id === P.target);
    if (!d || !d.alive) continue;
    F.lastTarget[a.id] = d.id;
    let zones = P.atk;
    if (F.tele && F.tele.fid === a.id) zones = [];
    if (a.buf.stun) { a.buf.stun = 0; if (zones.length) lines.push({ r: { dmg: 0, line: `💫 ${a.name} оглушён и пропускает удар.`, c: 'miss' }, d }); zones = []; }
    for (const z of zones) {
      const r = hitOne(F, a, d, z, picks);
      (F.lastAtk[d.id] = F.lastAtk[d.id] || []).push(z);
      if (r.dmg) { add(d, r.dmg); a.dealt += r.dmg; if (r.vamp) { heal[a.id] = (heal[a.id] || 0) + r.vamp; r.line += ` 🩸+${r.vamp}`; } if (r.thorn) { add(a, r.thorn); r.line += ` 🌵−${r.thorn} обидчику`; } }
      lines.push({ r, d });
    }
    if (zones.length && a.gx && a.gx.xatk && R() < a.gx.xatk) { const r = hitOne(F, a, d, pick(ZONES), picks, { mul: .7 }); if (r.dmg) { add(d, r.dmg); a.dealt += r.dmg; } r.line = '🗡 Добавочный удар: ' + r.line; lines.push({ r, d }); }
    if (a.cls === 'mage' && F.turn % 3 === 0) { const r = hitOne(F, a, d, 'chest', picks, { magic: 1, mul: .8 }); if (r.dmg) { add(d, r.dmg); a.dealt += r.dmg; r.line = `🔥 ${a.name} швыряет огненный шар!`; r.c = 'crit'; } lines.push({ r, d }); }
    if (a.bear > 0) { a.bear--; const r = hitOne(F, a, d, pick(ZONES), picks, { mul: .8 }); if (r.dmg) { add(d, r.dmg); r.line = `🐻 Божий медведь ${a.isMe ? 'героя' : ''} кусает противника…`; } lines.push({ r, d }); }
  }
  // приёмы боссов по площади
  for (const b of alive.filter(f => f.boss)) {
    const foes = alive.filter(x => x.team !== b.team);
    if (F.tele && F.tele.fid === b.id) for (const d of foes) { const r = hitOne(F, b, d, F.tele.zone, picks, { aoe: 1, mul: F.tele.mul || 1.5 }); if (r.dmg) pendT[d.id] = (pendT[d.id] || 0) + r.dmg; r.line = r.dmg ? `💥 ${b.name} обрушивает удар ${ZONE_ACC[F.tele.zone]}!` : `🛡 ${d.name} закрыл ${ZONE_GEN[F.tele.zone]} — удар босса прошёл мимо!`; lines.push({ r, d }); }
  }
  for (const f of alive) { const P = picks[f.id]; F.lastBlk[f.id] = P.blk; }
  for (const f of alive) if (f.buf.psn > 0) { f.buf.psn--; const v = Math.max(1, Math.round(f.max * .03)); add(f, v); lines.push({ r: { dmg: v, line: `☠ Яд жжёт: ${f.name}`, c: 'foe' }, d: f }); }
  // применяем урон одновременно
  const capped = [];
  for (const f of alive) {
    let v = pend[f.id] || 0;
    const tc = ARENA_KINDS.includes(F.kind) ? DUN_K.aCap[1] : DUN_K.turnCap;
    if (v && capUnit(f) && v > f.max * tc) { v = Math.round(f.max * tc); capped.push(f); } /* за ход не больше трети здоровья — есть время среагировать */
    f.hp -= v + (pendT[f.id] || 0);
  }
  for (const f of alive) if (f.bf && f.bf.heal && f.hp > 0 && f.hp < f.max) heal[f.id] = (heal[f.id] || 0) + Math.max(1, Math.round(f.max * f.bf.heal));
  for (const f of alive) if (heal[f.id] && f.hp > 0) f.hp = Math.min(f.max, f.hp + heal[f.id]);
  flog(F, `— Ход ${F.turn} —`, 'turn');
  for (const { r, d } of lines) flog(F, r.dmg ? `${r.line} ${d.name} −${r.dmg}` : r.line, r.c);
  for (const f of capped) flog(F, `🛡 ${f.name} уворачивается, как может: часть ударов прошла вскользь.`, 'me');
  for (const f of alive) if (pend[f.id] || pendT[f.id]) flog(F, `${f.name}: ${hpTag(f)}`, f.team === 0 ? 'me' : 'foe');
  for (const f of alive) {
    if (f.hp <= 0) { f.hp = 0; f.alive = false; flog(F, '☠ ' + pick(F_DEATH).replace('{d}', f.name), 'dead'); continue; }
    if (f.cls === 'warrior' && !f.used.wind && f.hp < f.max * .3) { f.used.wind = 1; const a = Math.round(f.max * .25); f.hp = Math.min(f.max, f.hp + a); flog(F, `💨 ${f.name}: второе дыхание! +${a} ${hpTag(f)}`, 'heal'); }
    if (f.cls === 'cleric' && !f.used.word) {
      const allies = F.fighters.filter(x => x.alive && x.team === f.team && x.hp > 0 && x.hp < x.max * .4).sort((a, b) => a.hp / a.max - b.hp / b.max);
      if (allies.length) { const t = allies[0]; f.used.word = 1; const a = Math.round(t.max * .2); t.hp = Math.min(t.max, t.hp + a); flog(F, `✚ ${f.name} читает исцеляющее слово: ${t.name} +${a} ${hpTag(t)}`, 'heal'); }
    }
    if (f.debuf > 0) f.debuf--;
  }
  const meL = fMe(F); if (meL && meL.alive && meL.hp < meL.max * .3 && !meL.used.lowW) { meL.used.lowW = 1; flog(F, `⚠ ${meL.name} еле жив (${hpTag(meL)})! ${FIGHT_ACT_KINDS.includes(F.kind) ? 'Блок, зелье, сила бога или побег — решайте.' : 'Блок или сила бога — решайте.'}`, 'warn'); }
  const me = fMe(F); if (me && F.kind !== 'monster') S.hero.hp = clamp(me.hp, 1, S.hero.maxHp); else if (me && me.hp > 0) S.hero.hp = Math.min(S.hero.maxHp, me.hp);
  checkBattleEnd(F);
}
function checkBattleEnd(F) {
  if (F.phase === 'end') return true;
  const a0 = fAlive(F, 0).length, a1 = fAlive(F, 1).length;
  if (!a0 || !a1 || F.turn >= MAX_TURNS) {
    let win = a0 > 0 && !a1 ? 0 : a1 > 0 && !a0 ? 1 : null;
    if (win === null) { const pct = t => F.fighters.filter(f => f.team === t).reduce((s, f) => s + Math.max(0, f.hp) / f.max, 0); win = pct(0) >= pct(1) ? 0 : 1; flog(F, 'Судья свистит: время вышло! Победа по очкам.', 'sys'); }
    endBattle(F, win); return true;
  }
  if (F.phase !== 'end') nextTurn(F);
  return false;
}
/* Силы бога в бою: не больше 3 за бой и 1 за ход */
function applyFightPower(F, user, id, mu, who) {
  const en = fEnemies(F, user), tgt = (user.isMe && en.find(e => e.id === F.my.target)) || (who === 'rival' ? en.find(e => e.isMe) : null) || en[0];
  const name = DUEL_NAMES[id] || id;
  let txt = '';
  switch (id) {
    case 'heal': { const up = !user.alive; if (up) { user.alive = true; user.hp = 0; } const a = Math.round(user.max * (up ? .3 : DUN_K.godHeal) * mu); user.hp = Math.min(user.max, user.hp + a); txt = `${up ? 'поднимает павшего! ' : ''}${user.name} +${a} ${hpTag(user)}`; if (user.isMe && S.dun) S.dun.out = 0; break; }
    case 'rain': for (const f of F.fighters.filter(x => x.alive && x.team === user.team)) f.hp = Math.min(f.max, f.hp + Math.round(f.max * .12 * mu)); txt = 'союзники подлечились'; break;
    case 'bless': user.buf.crit = 1; txt = `следующий удар ${user.name} — критический`; break;
    case 'shield': user.buf.shield = 1; txt = `урон по ${user.name} в этом ходу −70%`; break;
    case 'luck': user.buf.dodge = .3; txt = `${user.name} скользкий, как угорь`; break;
    case 'curse': if (tgt) { tgt.debuf = 2; txt = `${tgt.name} ослаблен на 2 хода`; } break;
    case 'beast': user.bear = 2; txt = 'на помощь идёт медведь'; break;
    case 'bolt': if (tgt) { const d = Math.max(1, Math.round(tgt.max * .12 * mu)); tgt.hp -= d; txt = `${tgt.name} −${d} ${hpTag(tgt)}`; } break;
    case 'quake': for (const e of en) e.hp -= Math.max(1, Math.round(e.max * .07 * mu)); txt = 'противники попадали'; break;
  }
  flog(F, `${who === 'rival' ? '😈 Бог ' + F.rivalGod.name : '✨ Ваш бог'}: ${name} — ${txt}`, who === 'rival' ? 'foe' : 'god');
  for (const f of F.fighters) if (f.alive && f.hp <= 0) { f.hp = 0; f.alive = false; flog(F, '☠ ' + pick(F_DEATH).replace('{d}', f.name), 'dead'); }
  const me = fMe(F); if (me) S.hero.hp = clamp(me.hp, F.kind === 'monster' ? 0 : 1, S.hero.maxHp);
  if (!fAlive(F, 0).length || !fAlive(F, 1).length) { const win = fAlive(F, 0).length ? 0 : 1; endBattle(F, win); }
}
function fightPower(id) {
  const F = S.fight; if (!F || F.phase !== 'turn') return toast('Силы в бою — только во время хода.');
  if (F.powersLeft < 1) return toast('Лимит сил на этот бой исчерпан (3).');
  if (F.usedTurn >= 1) return toast('Одна сила за ход.');
  if (!S.god.skills[id]) return toast('Сила не изучена.');
  const me = fMe(F); if (!me || (!me.alive && !(F.kind === 'dungeon' && id === 'heal'))) return toast('Ваш герой уже не в строю.');
  const c = powerCost(id); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; F.powersLeft--; F.usedTurn++; shiftAlign(POWERS[id].al); addGxp(c / 3);
  applyFightPower(F, me, id, pmult(id), 'me');
}
function rivalGodAct(F, act) {
  const G = F.rivalGod, foe = F.fighters.find(f => f.team === 1 && f.alive); if (!G || !foe || G.left < 1 || !FIGHT_POW_COST[act]) return;
  if (G.faith < FIGHT_POW_COST[act]) return;
  G.faith -= FIGHT_POW_COST[act]; G.left--;
  applyFightPower(F, foe, act, 1 + .5 * Math.min(2, Math.floor(G.lvl / 3)), 'rival');
}
function fightZone(arg) {
  const F = S.fight; if (!F || (F.phase !== 'turn' && F.phase !== 'intro') || F.auto) return;
  const me = fMe(F); if (!me || !me.alive) return;
  const [k, z] = String(arg).split(':'); if (!ZONES.includes(z)) return;
  if (k === 'a') { if (me.atkN === 1) F.my.atk = [z]; else { const i = F.my.atk.indexOf(z); if (i >= 0) F.my.atk.splice(i, 1); else { F.my.atk.push(z); if (F.my.atk.length > me.atkN) F.my.atk.shift(); } } }
  else F.my.blk = blkSet(z, me.blkN);
}
function fightTarget(id) { const F = S.fight; if (!F || (F.phase !== 'turn' && F.phase !== 'intro')) return; const me = fMe(F); if (me && fightTargetOk(F, me, id)) F.my.target = id; }
function fightGo() {
  const F = S.fight; if (!F) return;
  if (F.phase === 'intro') { nextTurn(F); return; }
  if (F.phase !== 'turn') return;
  const me = fMe(F);
  if (me && me.alive && ((F.my.atk.length < me.atkN && !F.my.act) || F.my.blk.length !== me.blkN)) return toast(`Выберите ${me.atkN > 1 ? 'две зоны удара' : 'зону удара'} и блок.`);
  F.ready = true; resolveTurn(F);
}
function fightAuto(on) {
  const F = S.fight; S.fightAuto = on === undefined ? !S.fightAuto : !!on;
  if (F) { F.auto = S.fightAuto; if (F.phase === 'turn') { if (F.auto) { F.t = Math.min(F.t, AUTO_T); const me = fMe(F); if (me && me.alive) { const c = heroBrain(F, me); F.my = { atk: c.atk, blk: c.blk, target: c.target, act: c.act }; } } else { F.T = TURN_T; F.t = TURN_T; } } }
}
function fightAct(k) {
  const F = S.fight; if (!F || (F.phase !== 'turn' && F.phase !== 'intro') || F.auto) return;
  const me = fMe(F); if (!me || !me.alive) return;
  if (!FIGHT_ACT_KINDS.includes(F.kind)) return toast('На арене так нельзя — только блок и силы бога.');
  if (k === 'potion' && S.hero.potions < 1) return toast('Зелий нет.');
  if (!['potion', 'flee'].includes(k)) return;
  F.my.act = F.my.act === k ? null : k;
}
function endFled(F) {
  const h = S.hero, me = fMe(F);
  F.phase = 'end'; F.t = 10; F.T = 10; F.win = null; F.tele = null; F.fled = 1;
  if (F.kind === 'monster') { h.hp = Math.max(1, me.hp); h.monster = null; h.state = 'road'; F.result = '🏃 Сбежал! Жив — уже победа.'; diary(`🏃 ${F.title}: вовремя унёс ноги. Бог одобрил (или промолчал).`, 'fight'); }
  else if (F.kind === 'dungeon') {
    const U = S.dun; h.hp = clamp(me.hp, 1, h.maxHp);
    if (U) { for (const f of F.fighters) if (f.team === 0 && f.ref) { const p = U.party.find(x => x.godId === f.ref); if (p) p.hp = f.alive ? Math.max(1, Math.round(f.hp / f.max * 100)) : 0; }
      U.lastFight = { title: F.title, won: false, turns: F.turn, log: F.log.slice(0, 14).map(l => ({ t: String(l.t).slice(0, 200), c: l.c })) };
      ulog('🏃 Отряд вырвался из боя и ушёл из пещеры со всей добычей.', 'warn'); endDungeon(false, 'left'); }
    F.result = '🏃 Отряд отступил из боя.';
  }
  flog(F, F.result, 'sys');
}
function fightTick(idt) {
  const F = S.fight;
  /* таймер стоит, пока карточка боя не видна (переходы, другая вкладка), но не дольше 90 с — потом герой решает сам */
  if (!SILENT && F.phase !== 'end' && !F.auto) {
    const hid = typeof document !== 'undefined' && document.hidden;
    if ((hid || (!fightVis && godPresent())) && fightWait < 90) { fightWait += idt; return; }
  }
  F.t -= idt;
  if (F.phase === 'intro') { if (F.t <= 0) nextTurn(F); return; }
  if (F.phase === 'end') { if (F.t <= 0) closeFight(); return; }
  if (F.t <= 0) resolveTurn(F);
}
function closeFight() {
  const F = S.fight; if (!F) return; S.fight = null;
  if (F.kind === 'dungeon' && S.dun && S.dun.phase === 'fight') { S.dun.phase = 'explore'; S.dun.idle = 0; }
}
function autoResolveBattle(F) {
  F.auto = true; let k = 0;
  while (S.fight === F && F.phase !== 'end' && k++ < 200) { if (F.phase === 'intro') nextTurn(F); else resolveTurn(F); }
  if (S.fight === F) closeFight();
}
/* Травмы после поражений: временный штраф к характеристике */
function injure(sev, why) {
  const h = S.hero; if (!INJURIES[sev]) return;
  if (h.inj.length >= 4) h.inj.shift();
  const s = pick(STATS), J = INJURIES[sev];
  h.inj.push({ k: sev, s, t: J.t, n: INJ_TEXT[s] });
  if (s === 'con') recalcHp();
  diary(`🤕 ${why || 'После боя'}: ${J.n} — ${INJ_TEXT[s]} (${STAT_SHORT[s]} −${J.pen}). Пройдёт за ${fmtDur(J.t)} или после отдыха в храме.`, 'fight');
}
function healInjuries(kind) {
  const h = S.hero; if (!h.inj.length) return 0; const n0 = h.inj.length;
  if (kind === 'temple' || kind === 'all') h.inj = [];
  else if (kind === 'one') h.inj.shift();
  else { h.inj = h.inj.filter(j => j.k !== 'light'); h.inj.forEach(j => j.t = Math.floor(j.t / 2)); }
  recalcHp(); return n0 - h.inj.length;
}
function endBattle(F, winTeam) {
  if (F.phase === 'end') return;
  F.phase = 'end'; F.t = 12; F.T = F.t; F.win = winTeam; F.tele = null;
  const h = S.hero, me = fMe(F), won = winTeam === 0, L = h.lvl;
  const foes = F.fighters.filter(f => f.team === 1), fx = [];
  if (F.kind === 'monster') {
    if (won && h.monster) { h.hp = Math.max(1, me.hp); h.monster.hp = 0; const bx = Math.round(xpUnit(L) * .8); winFight(); gainXp(bx); fx.push(`+${bx} опыта за ручной бой`); F.result = '🏆 Победа в ручном бою!'; }
    else {
      h.hp = 0; h.monster = null; h.state = 'fight'; killHero(`Пал в ручном бою с противником «${foes[0].name}». Бог руководил, но не спас.`);
      if (h.state !== 'dead') { h.state = 'road'; h.hp = Math.max(1, h.hp); F.result = '😤 Должен был пасть, но орки так просто не умирают.'; } else F.result = '💀 Герой пал в бою.';
    }
  } else if (F.kind === 'dungeon') {
    F.result = won ? '🏆 Отряд победил!' : '💀 Отряд разбит.';
    dunAfterFight(F, won);
  } else {
    const fat = Math.max(.25, 1 - .15 * (S.arena.fat || 0));
    const er = foes.reduce((s, f) => s + (f.rating || 1000), 0) / Math.max(1, foes.length);
    const exp = 1 / (1 + Math.pow(10, (er - S.arena.rating) / 400)), dr = Math.round(32 * ((won ? 1 : 0) - exp));
    S.arena.rating = Math.max(100, S.arena.rating + dr); S.arena.fat = (S.arena.fat || 0) + 1;
    h.hp = clamp(me ? me.hp : 1, 1, h.maxHp); h.state = 'road';
    if (won) {
      S.arena.w++; S.stats.arenaW++; bldResult(true, 'arena');
      const x = Math.round(xpUnit(L) * (3 + 1.5 * foes.length) * fat), g = Math.round(12 * goldScale(L) * foes.length * fat);
      gainXp(x); h.gold += g; fx.push(`+${x} опыта`, `+${g} 💰`, `рейтинг ${dr >= 0 ? '+' : ''}${dr}`);
      if (h.hp < h.maxHp * .2 && R() < .3) injure('light', 'Победа далась тяжело');
    } else {
      S.arena.l++; S.stats.arenaL++; bldResult(false, 'arena');
      const x = Math.round(xpUnit(L) * 1 * fat); gainXp(x); fx.push(`+${x} опыта за опыт`, `рейтинг ${dr}`);
      const r = R(); injure(r < .1 ? 'heavy' : r < .35 ? 'mid' : 'light', 'Поражение на арене');
    }
    if (F.kind === 'godduel') {
      const G = F.rivalGod;
      rivals.reportDuel({ godId: G.godId, playerWon: won });
      if (won) { S.stats.dwins++; const n = rnd(2, 5) + Math.floor(S.flock.army / 5); S.flock.fol += n; addTrust(5); addGxp(30); fx.push(`+${n} паствы`, '+5 доверия'); }
      else { const g = Math.floor(h.gold * .1), n = Math.min(Math.floor(S.flock.fol), rnd(1, 3)); h.gold -= g; S.flock.fol -= n; addTrust(-3); addGxp(12); fx.push(`−${g} 💰`, `−${n} паствы`, '−3 доверия'); }
    } else addGxp(won ? 12 : 5);
    if (fat < 1) fx.push(`усталость: награда ×${fat.toFixed(2)}`);
    F.result = won ? `🏆 Победа! ${F.kind === 'godduel' ? 'Бог ' + F.rivalGod.name + ' посрамлён.' : ''}` : `💔 Поражение. ${F.kind === 'godduel' ? 'Бог ' + F.rivalGod.name + ' злорадствует.' : 'Бывает.'}`;
    diary(won ? `🏆 ${F.title}: победа! ${pick(['Арена ревела.', 'Мой бог гордится мной (надеюсь).', 'Противники ушли зализывать раны.'])}` : `💔 ${F.title}: поражение. ${pick(['Где был мой бог?', 'Ничего, в следующий раз.', 'Зато красиво падал.'])}`, 'duel', fx.join(', '));
    fightProv.reportFight({ kind: F.kind, won, rating: S.arena.rating });
  }
  F.rew = fx.join(', ');
  flog(F, (F.result || '') + (F.rew ? ' ' + F.rew : ''), 'sys');
  if (!SILENT && F.kind !== 'dungeon') chat.fightNews(`🏁 ${F.title} окончен: ${won ? 'победил' : 'проиграл'} ${h.name}.`);
}

/* ---------- Запуск боёв ---------- */
const heroFree = () => S.hero.state !== 'dead' && (S.hero.state === 'road' || S.hero.state === 'town') && !S.fight && !S.dun && !S.fork && !duelPending && !dunPending;
function startMonsterFight() {
  const h = S.hero, m = h.monster;
  if (!m || h.state !== 'fight' || S.fight || S.dun) return false;
  const u = monsterUnit(m.n, m.tier || h.lvl, {}); u.max = m.max; u.hp = Math.max(1, m.hp);
  beginBattle('monster', [heroUnit()], [u], { title: `Ручной бой: ${m.n}`, intro: 'Бог берёт бой под контроль!' });
  return true;
}
async function startGodDuel(godId) {
  if (!heroFree() || S.hero.state !== 'road') return false;
  const h = S.hero, st = S; h.state = 'duel'; duelPending = true;
  let opp;
  try { opp = await rivals.findOpponent({ godLvl: S.god.lvl, heroLvl: h.lvl, godId }); } finally { duelPending = false; }
  if (S !== st || h.state !== 'duel' || S.fight || S.dun) { if (S === st && h.state === 'duel' && !S.fight) h.state = 'road'; return false; }
  const me = heroUnit(), foe = botUnit({ bld: opp.bld, name: opp.hero, race: opp.race, cls: opp.cls, lvl: opp.heroLvl, rating: 1000 + opp.lvl * 30 });
  me.avg *= 1 + Math.min(S.flock.army, 10) * .02; foe.avg *= 1 + Math.min(opp.army || 0, 10) * .02;
  beginBattle('godduel', [me], [foe], { title: `Дуэль богов: ${S.god.name} против ${opp.god}`, rivalGod: { godId: opp.godId, name: opp.god, pers: opp.pers, lvl: opp.lvl, faith: 50 + opp.lvl * 12, left: 3 },
    intro: `${opp.hero} (${RACES[opp.race].n.toLowerCase()}-${CLASSES[opp.cls].n.toLowerCase()}) говорит, что ваш бог — «так себе».` });
  S.stats.duels++; S.timers.duel = Math.max(S.timers.duel, 1200);
  diary(`⚔ Встретил героя по имени ${opp.hero} (его бог — ${opp.god}). Дуэль богов!`, 'duel');
  toast('⚔ Дуэль богов! Выбирайте удар и блок.');
  return true;
}
const startDuel = startGodDuel;

/* ---------- Арена: заявки ---------- */
const appBots = a => a.type === 'chaos' ? a.members.filter(m => !m.me) : a.teams.flat().filter(m => !m.me);
const appCount = a => a.type === 'chaos' ? a.members.length : a.teams[0].length + a.teams[1].length;
const appCap = a => a.type === 'chaos' ? a.size : a.size * 2;
const appFull = a => appCount(a) >= appCap(a);
const appTitle = a => a.type === 'duel' ? '1нс1' : a.type === 'group' ? `${a.size}нс${a.size}` : `${a.size} бойцов`;
function appAddBot(a, b) {
  if (appFull(a)) return;
  if (a.type === 'chaos') a.members.push(b);
  else { const t = a.teams[0].length < a.size && (a.teams[1].length >= a.size || a.teams[0].length <= a.teams[1].length) ? 0 : 1; a.teams[t].push(b); }
}
function newBotApp(A, author, lvl) {
  const r = R(), type = r < .4 ? 'duel' : r < .75 ? 'group' : 'chaos';
  const size = type === 'duel' ? 1 : type === 'group' ? (R() < .6 ? 3 : R() < .6 ? 5 : 2) : (R() < .6 ? 6 : 8);
  const a = { id: 'a' + (++A.seq), type, size, author: author.name, lvl: [Math.max(1, lvl - 2), Math.min(MAX_LVL, lvl + 2)], teams: [[author], []], members: [author], joined: null, mine: false, t: rnd(90, 200), T: 0 };
  if (type === 'chaos') { a.teams = [[], []]; const k = rnd(0, size - 3); for (let i = 0; i < k; i++) appAddBot(a, fightProv.makeBot(lvl)); }
  else if (type === 'group') { a.members = []; const k = rnd(0, size); for (let i = 0; i < k; i++) appAddBot(a, fightProv.makeBot(lvl)); }
  else a.members = [];
  a.T = a.t; return a;
}
function arenaCanJoin(silent) {
  const h = S.hero;
  if (!heroFree()) { if (!silent) toast(h.state === 'dead' ? 'Герой мёртв.' : 'Герой сейчас занят.'); return false; }
  if (h.hp < h.maxHp * .3) { if (!silent) toast('Герой слишком изранен для арены (нужно 30% HP). Пусть отдохнёт.'); return false; }
  if (S.arena.apps.some(a => a.joined !== null)) { if (!silent) toast('Вы уже в заявке.'); return false; }
  return true;
}
function arenaJoin(arg) {
  const [id, side] = String(arg).split(':'), a = S.arena.apps.find(x => x.id === id); if (!a || !arenaCanJoin()) return;
  const me = { me: true, name: S.hero.name };
  if (a.type === 'duel') { if (a.mine || appFull(a)) return; a.teams[1].push(me); a.joined = 1; startArenaFight(a); return; }
  if (appFull(a)) return toast('Заявка уже заполнена.');
  if (a.type === 'chaos') { a.members.push(me); a.joined = 'chaos'; }
  else { const t = +side === 1 ? 1 : 0; if (a.teams[t].length >= a.size) return toast('В этой команде нет мест.'); a.teams[t].push(me); a.joined = t; }
  a.t = Math.min(a.t, 60); toast('📜 Вы в заявке. Бой начнётся, когда наберутся бойцы.');
}
function arenaLeave(id) {
  const a = S.arena.apps.find(x => x.id === id); if (!a || a.joined === null) return;
  if (a.mine) { S.arena.apps.splice(S.arena.apps.indexOf(a), 1); return; }
  a.members = a.members.filter(m => !m.me); a.teams = a.teams.map(t => t.filter(m => !m.me)); a.joined = null;
}
function arenaPost(arg) {
  if (!arenaCanJoin()) return;
  const [type, sz] = String(arg).split(':'), A = S.arena, me = { me: true, name: S.hero.name };
  if (!ARENA_TYPES[type]) return;
  const size = type === 'duel' ? 1 : clamp(+sz || 3, 2, 8);
  const a = { id: 'a' + (++A.seq), type, size, author: S.hero.name, lvl: [Math.max(1, S.hero.lvl - 2), Math.min(MAX_LVL, S.hero.lvl + 2)], teams: [[me], []], members: [me], joined: type === 'chaos' ? 'chaos' : 0, mine: true, t: 75, T: 75 };
  if (type !== 'chaos') a.members = []; else a.teams = [[], []];
  A.apps.unshift(a);
  chatSys(`📜 ${S.hero.name} подал заявку: ${ARENA_TYPES[type].n} ${appTitle(a)}.`);
  toast('📜 Заявка подана. Ждём соперников (не дольше 75 с — потом доберём ботов).');
}
function startArenaFight(a) {
  const A = S.arena; A.apps = A.apps.filter(x => x !== a);
  if (!heroFree() || S.hero.hp < S.hero.maxHp * .2) { toast('Бой по заявке начался без вашего героя — он был занят.'); return false; }
  const mk = list => list.map(m => m.me ? heroUnit() : botUnit(m));
  let allies, enemies;
  if (a.type === 'chaos') {
    const all = a.members.slice().sort(() => R() - .5), half = Math.ceil(all.length / 2);
    let t0 = all.slice(0, half), t1 = all.slice(half); if (!t0.some(m => m.me)) [t0, t1] = [t1, t0];
    allies = mk(t0); enemies = mk(t1);
  } else { const mine = a.joined === 1 ? 1 : 0; allies = mk(a.teams[mine]); enemies = mk(a.teams[1 - mine]); }
  S.hero.state = 'duel'; S.hero.monster = null; S.hero.restT = 0;
  beginBattle(a.type, allies, enemies, { title: `${ARENA_TYPES[a.type].n} ${appTitle(a)}`, intro: a.type === 'chaos' ? 'Команды поделены случайно!' : '' });
  return true;
}
function arenaStep(idt) {
  const A = S.arena;
  if ((A.fat || 0) > 0) A.fatT = (A.fatT || 0) + idt * S.speed;
  if (A.fatT > 1200) { A.fatT = 0; A.fat = Math.max(0, A.fat - 1); }
  const start = fightProv.arenaTick(A, idt, { lvl: S.hero.lvl });
  for (const a of start) if (!S.fight) { if (!startArenaFight(a)) break; } else A.apps = A.apps.filter(x => x !== a);
}

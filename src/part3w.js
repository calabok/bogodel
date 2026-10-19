
/* =====================================================================
   13) ВОЙНА ЗА ОЛИМП (v12): карта регионов, души, боги-соперники, сезон
   ---------------------------------------------------------------------
   • 14 регионов (+ Олимп в центре), у каждого свои души (население). Душа принадлежит одному богу или ничья.
   • Владелец региона — бог с наибольшей долей (не меньше 12% населения; чтобы отнять, нужно на 5% больше владельца).
     Владелец получает веру и бонус региона, а также очки влияния (ОВ) каждый час.
   • Души растут: герой ходит, проповедует и побеждает в регионе, храм региона обращает сам, штурм армией,
     дуэль богов в регионе, божественные моменты. Без присутствия души медленно остывают (0,25% в час).
   • Боги-соперники — только через RivalProvider.worldTurn (сейчас LocalAIProvider). Сетевой провайдер
     будет возвращать те же действия от настоящих игроков: { god, kind: 'focus'|'preach'|'storm'|'temple', reg, power|n }.
   • Сезон — 28 суток реального времени. В конце топ-7 по ОВ занимают троны Олимпа; игрок с троном получает
     титул, рамку и «Олимпийский дар» на весь следующий сезон. Карта сбрасывается, герой и вещи остаются.
   ===================================================================== */
const OLY_K = {
  season: 28 * 86400e3,  // длина сезона, мс реального времени
  step: 60,              // шаг мира, с
  minShare: .12, hyst: 1.05,
  decay: .0025,          // остывание душ без присутствия, доля в час
  steal: .6,             // переманивать чужие души труднее, чем обращать ничьи
  bot: 62,               // душ в час у бога-бота в походе (×сила бога)
  heroWalk: 1.1, heroTown: 1.4, heroPreach: 5, heroWin: 3,
  tConv: 9, tDef: .12, tCost: [60, 120, 200, 320, 480], tMax: 5, tReq: .08,
  stormPer: 12, stormLoss: .25, stormCd: 1800, stormMax: 30, stormMin: 3,
  duelCd: 1800, duelWin: .10, duelLose: .05,
  regFaith: .0025,       // вера в секунду за каждый свой регион
  infBase: 6, infPop: 120, infSoul: 160,
  thrones: 7, giftCd: 6 * 3600, giftShare: .06,
  holdT: 2 * 3600, startShare: .3,
  amb: 1.6, sprint: 1.3, sprintT: 5 * 86400e3, // претенденты сильнее; в последние 5 дней — финишный рывок
               // сила двух ботов-претендентов
  heroOff: .85,           // герой без присмотра бога (офлайн) проповедует вполсилы
  offDef: .6,            // пока бога нет у экрана, его прихожан переманивать труднее (сутки без игры — не катастрофа)
  spread: .08            // большая религия растекается: −8% обращения за каждый регион сверх двух
};
/* Регионы: сетка шестиугольников 5×3 (нечётные колонки сдвинуты вниз), центр (2,1) — Олимп */
const REGIONS = [
  { id: 'les', v: 'в Лесу Чего-То-Там', to: 'в Лес Чего-То-Там', n: 'Лес Чего-То-Там', s: 'Лес', ic: '🌲', k: 'forest', c: 0, r: 0, pop: 800, b: 'loot', bt: 'добыча с врагов на 10% чаще' },
  { id: 'pinki', v: 'в Нижних Пинках', to: 'в Нижние Пинки', n: 'Нижние Пинки', s: 'Пинки', ic: '🏡', k: 'village', c: 0, r: 1, pop: 1000, town: 1, b: 'preach', bt: 'проповеди героя: +1 паствы' },
  { id: 'boloto', v: 'на Болоте Уныния', to: 'на Болото Уныния', n: 'Болото Уныния', s: 'Болото', ic: '🐸', k: 'swamp', c: 0, r: 2, pop: 650, b: 'potion', bt: 'зелья на 25% дешевле' },
  { id: 'pereval', v: 'на Перевале Последней Надежды', to: 'на Перевал Последней Надежды', n: 'Перевал Последней Надежды', s: 'Перевал', ic: '⛰', k: 'mount', c: 1, r: 0, pop: 600, b: 'army', bt: 'солдаты на 3 веры дешевле' },
  { id: 'godgrad', v: 'в Годграде', to: 'в Годград', n: 'Годград', s: 'Годград', ic: '🏰', k: 'city', c: 1, r: 1, pop: 1400, town: 1, b: 'shop', bt: 'покупки в городах на 10% дешевле' },
  { id: 'dolina', v: 'в Долине Носков', to: 'в Долину Носков', n: 'Долина Носков', s: 'Долина', ic: '🧦', k: 'valley', c: 1, r: 2, pop: 850, b: 'trust', bt: 'доверие героя растёт на 20% быстрее' },
  { id: 'gora', v: 'на Горе Вечного Понедельника', to: 'на Гору Вечного Понедельника', n: 'Гора Вечного Понедельника', s: 'Гора', ic: '🗻', k: 'mount', c: 2, r: 0, pop: 600, b: 'maxf', bt: 'запас веры +15' },
  { id: 'kapust', v: 'в Капустинске', to: 'в Капустинск', n: 'Капустинск', s: 'Капустинск', ic: '🥬', k: 'field', c: 2, r: 2, pop: 1100, town: 1, b: 'faith', bt: 'вера +14 в час' },
  { id: 'zamok', v: 'в Замке барона Храпуна', to: 'в Замок барона Храпуна', n: 'Замок барона Храпуна', s: 'Замок', ic: '🏯', k: 'castle', c: 3, r: 0, pop: 750, b: 'gold', bt: '+10% золота за победы' },
  { id: 'ponty', v: 'в Больших Понтах', to: 'в Большие Понты', n: 'Большие Понты', s: 'Понты', ic: '🏙', k: 'city', c: 3, r: 1, pop: 1300, town: 1, b: 'sell', bt: 'продажа добра +15%' },
  { id: 'pustosh', v: 'в Пустоши Забытых Паролей', to: 'в Пустошь Забытых Паролей', n: 'Пустошь Забытых Паролей', s: 'Пустошь', ic: '🏜', k: 'waste', c: 3, r: 2, pop: 550, b: 'temple', bt: 'храмы в регионах на 15% дешевле' },
  { id: 'bereg', v: 'на Берегу Русалок', to: 'на Берег Русалок', n: 'Берег Русалок', s: 'Берег', ic: '🌊', k: 'coast', c: 4, r: 0, pop: 700, b: 'rest', bt: 'короткий отдых лечит на 25% больше' },
  { id: 'ovrag', v: 'в Овраге Сомнений', to: 'в Овраг Сомнений', n: 'Овраг Сомнений', s: 'Овраг', ic: '🕳', k: 'ravine', c: 4, r: 1, pop: 600, b: 'hint', bt: '«👁 Подсказать» в бою на 3 веры дешевле' },
  { id: 'tuman', v: 'в Туманных болотах', to: 'в Туманные болота', n: 'Туманные болота', s: 'Туман', ic: '🌫', k: 'swamp', c: 4, r: 2, pop: 700, b: 'buff', bt: 'щит и благословение длятся на 20% дольше' }
];
const REG_BY = {}; for (const R0 of REGIONS) REG_BY[R0.id] = R0;
const OLY_HEX = 50;
const hexXY = (c, r) => ({ x: 52 + c * 75, y: 46 + r * 86.6 + (c % 2 ? 43.3 : 0) });
const OLY_CEN = hexXY(2, 1);
function hexAdj(a, b) {
  const dc = b.c - a.c, dr = b.r - a.r;
  if (dc === 0) return Math.abs(dr) === 1;
  if (Math.abs(dc) !== 1) return false;
  return a.c % 2 ? (dr === 0 || dr === 1) : (dr === 0 || dr === -1);
}
for (const A of REGIONS) { Object.assign(A, hexXY(A.c, A.r)); A.nb = REGIONS.filter(B => B !== A && hexAdj(A, B)).map(B => B.id); }
const TOWN_REGS = REGIONS.filter(x => x.town).map(x => x.id);
/* Боги на карте: вы (me) и 8 соперников. Цвета, родина, девиз */
const GOD_IDS = ['me'].concat(RIVALS_BASE.map(b => b.id));
const GOD_COL = { me: '#22b8e6', g1: '#d0453a', g2: '#e07fae', g3: '#8e5bd6', g4: '#2f9e8f', g5: '#e08a2c', g6: '#4f5fcf', g7: '#d4b21f', g8: '#5f9a3a' };
const GOD_HOME = { me: 'godgrad', g1: 'zamok', g2: 'dolina', g3: 'ovrag', g4: 'les', g5: 'kapust', g6: 'gora', g7: 'ponty', g8: 'tuman' };
const GOD_MOTTO = { g1: 'Сначала бьёт, потом обращает', g2: 'Обнимет, накормит, обратит', g3: 'Переманивает тех, кто плохо лежит', g4: 'Молча держит своё',
  g5: 'Обещает колбасу каждому', g6: 'Наводит тоску и штурмует', g7: 'Сияет и строит храмы', g8: 'Древний, медленный, упрямый' };
const PERS_OLY = { aggr: { conv: 1, storm: .45, temple: .05, att: 1.6, def: .6 }, heal: { conv: 1.05, storm: .08, temple: .2, att: .6, def: 1.2 },
  trick: { conv: 1.1, storm: .2, temple: .06, att: 1.1, def: .7 }, def: { conv: .9, storm: .1, temple: .16, att: .5, def: 2 } };
const TEMPLE_R = ['часовня', 'храм', 'собор', 'лавра', 'святыня'];
const THRONES = [['👑', 'Верховный бог Олимпа'], ['⚡', 'Громовержец'], ['🔥', 'Хранитель очага'], ['🌊', 'Повелитель морей'], ['🌾', 'Владыка урожая'], ['🍷', 'Покровитель пиров'], ['🥟', 'Хозяин подземных пельменей']];
const frameOf = rank => rank === 1 ? 'f1' : rank <= 3 ? 'f2' : 'f3';
let OLY_NOW = null, OLY_SLEEP = false;      // во время офлайн-симуляции: «виртуальное» время и сон героя
const olyNow = () => OLY_NOW !== null ? OLY_NOW : Date.now();
const godName = g => g === 'me' ? S.god.name : (RIVALS_BASE.find(b => b.id === g) || {}).name || '?';
const godShort = g => g === 'me' ? 'вы' : godName(g);
const rivalOf = g => S.rivals.find(r => r.id === g);
const regLoc = id => { const R0 = REG_BY[id]; return R0 ? R0.n : ''; };
const rIn = id => REG_BY[id] ? REG_BY[id].v : '', rTo = id => REG_BY[id] ? REG_BY[id].to : '';

/* ---------- Состояние мира ---------- */
function olyNewWorld(n, start) {
  const reg = {};
  for (const R0 of REGIONS) reg[R0.id] = { s: {}, tp: {}, own: null, cdS: 0, cdD: 0, hot: 0 };
  for (const g of GOD_IDS) {
    const hid = GOD_HOME[g], X = reg[hid];
    X.s[g] = Math.round(REG_BY[hid].pop * OLY_K.startShare); X.tp[g] = 1; X.own = g;
    for (const nb of REG_BY[hid].nb) reg[nb].s[g] = (reg[nb].s[g] || 0) + Math.round(REG_BY[nb].pop * (.03 + R() * .03));
  }
  const inf = {}; for (const g of GOD_IDS) inf[g] = 0;
  const amb = RIVALS_BASE.map(b => b.id).sort(() => R() - .5).slice(0, 2); // два «претендента» сезона — сильнее остальных
  const bots = {}; for (const b of RIVALS_BASE) bots[b.id] = { r: GOD_HOME[b.id], t: rnd(300, 1800), a: amb.includes(b.id) ? OLY_K.amb : 1 };
  return { n, start, end: start + OLY_K.season, reg, inf, bots, acc: 0, log: [], hold: null, dest: null, gift: 0 };
}
function olyNewState(now) {
  const O = olyNewWorld(1, now); O.v = 1; O.intro = 0; O.rew = null; O.hist = []; O.last = null; return O;
}
/* Санация сохранения: всё, что не похоже на мир, — новый мир с текущего момента (честный старт сезона) */
function sanitizeOly(o) {
  const now = Date.now(), O = o.oly, h = o.hero;
  const okW = O && typeof O === 'object' && isNum(O.n) && isNum(O.start) && isNum(O.end) && O.reg && typeof O.reg === 'object' && O.end > O.start && O.end - O.start <= OLY_K.season * 1.01;
  if (!okW) {
    const keep = O && typeof O === 'object' ? O : {};
    o.oly = olyNewState(now);
    if (keep.intro) o.oly.intro = 1;
  }
  const W = o.oly;
  W.v = 1; W.n = Math.max(1, Math.floor(W.n)); W.intro = W.intro ? 1 : 0;
  if (W.start > now + 60e3) { W.start = now; W.end = now + OLY_K.season; } // часы ушли вперёд — не ломаем сезон
  for (const R0 of REGIONS) {
    let X = W.reg[R0.id]; if (!X || typeof X !== 'object') X = W.reg[R0.id] = { s: {}, tp: {}, own: null };
    if (!X.s || typeof X.s !== 'object') X.s = {}; if (!X.tp || typeof X.tp !== 'object') X.tp = {};
    let sum = 0;
    for (const g of Object.keys(X.s)) { if (!GOD_IDS.includes(g) || !isNum(X.s[g]) || X.s[g] <= 0) delete X.s[g]; else sum += X.s[g]; }
    if (sum > R0.pop) for (const g in X.s) X.s[g] *= R0.pop / sum;
    for (const g of Object.keys(X.tp)) { if (!GOD_IDS.includes(g) || !isNum(X.tp[g]) || X.tp[g] < 1) delete X.tp[g]; else X.tp[g] = Math.min(OLY_K.tMax, Math.floor(X.tp[g])); }
    if (X.own !== null && !GOD_IDS.includes(X.own)) X.own = null;
    if (X.own === undefined) X.own = null;
    for (const k of ['cdS', 'cdD', 'hot']) fixNum(X, k, 0, 0, 1e6);
    for (const k of Object.keys(X)) if (!['s', 'tp', 'own', 'cdS', 'cdD', 'hot'].includes(k)) delete X[k];
  }
  for (const k of Object.keys(W.reg)) if (!REG_BY[k]) delete W.reg[k];
  if (!W.inf || typeof W.inf !== 'object') W.inf = {};
  for (const g of GOD_IDS) fixNum(W.inf, g, 0, 0, 1e9);
  for (const k of Object.keys(W.inf)) if (!GOD_IDS.includes(k)) delete W.inf[k];
  if (!W.bots || typeof W.bots !== 'object') W.bots = {};
  for (const b of RIVALS_BASE) { let B = W.bots[b.id]; if (!B || typeof B !== 'object' || !REG_BY[B.r]) B = W.bots[b.id] = { r: GOD_HOME[b.id], t: rnd(60, 900) }; fixNum(B, 't', 300, 0, 7200); }
  for (const k in W.bots) { const B = W.bots[k]; if (B && !(B.a >= 1 && B.a <= 2)) B.a = 1; }
  for (const k of Object.keys(W.bots)) if (!RIVALS_BASE.find(b => b.id === k)) delete W.bots[k];
  fixNum(W, 'acc', 0, 0, 3600); fixNum(W, 'gift', 0, 0, OLY_K.giftCd);
  W.log = Array.isArray(W.log) ? W.log.filter(e => e && typeof e.x === 'string').slice(0, 30).map(e => ({ tm: typeof e.tm === 'string' ? e.tm.slice(0, 12) : '', x: e.x.slice(0, 200), c: typeof e.c === 'string' ? e.c.slice(0, 8) : '' })) : [];
  W.dest = REG_BY[W.dest] ? W.dest : null;
  W.hold = W.hold && REG_BY[W.hold.r] && isNum(W.hold.t) && W.hold.t > 0 ? { r: W.hold.r, t: Math.min(W.hold.t, OLY_K.holdT) } : null;
  const rw = W.rew;
  W.rew = rw && typeof rw === 'object' && isNum(rw.rank) && rw.rank >= 1 && rw.rank <= OLY_K.thrones && isNum(rw.n) ? { n: Math.floor(rw.n), rank: Math.floor(rw.rank), title: THRONES[Math.floor(rw.rank) - 1][1], ic: THRONES[Math.floor(rw.rank) - 1][0], frame: frameOf(Math.floor(rw.rank)) } : null;
  W.hist = Array.isArray(W.hist) ? W.hist.filter(x => x && isNum(x.n) && isNum(x.rank)).slice(-12).map(x => ({ n: Math.floor(x.n), rank: Math.floor(x.rank), inf: isNum(x.inf) ? Math.round(x.inf) : 0, regs: isNum(x.regs) ? Math.floor(x.regs) : 0, of: isNum(x.of) ? Math.floor(x.of) : GOD_IDS.length })) : [];
  const L = W.last; W.last = L && typeof L === 'object' && isNum(L.n) && isNum(L.rank) && Array.isArray(L.top) ? { n: Math.floor(L.n), rank: Math.floor(L.rank), at: isNum(L.at) ? L.at : now, top: L.top.filter(t => t && GOD_IDS.includes(t.g)).slice(0, GOD_IDS.length).map(t => ({ g: t.g, inf: isNum(t.inf) ? Math.round(t.inf) : 0, regs: isNum(t.regs) ? Math.floor(t.regs) : 0 })), seen: L.seen ? 1 : 0 } : null;
  for (const k of Object.keys(W)) if (!['v', 'n', 'start', 'end', 'reg', 'inf', 'bots', 'acc', 'log', 'hold', 'dest', 'gift', 'intro', 'rew', 'hist', 'last'].includes(k)) delete W[k];
  if (!REG_BY[h.reg]) h.reg = regFromLoc(h.loc);
  h.loc = REG_BY[h.reg].n;
  for (const R0 of REGIONS) { const X = W.reg[R0.id]; if (X.own && !((X.s[X.own] || 0) >= R0.pop * OLY_K.minShare)) X.own = null; }
}
function regFromLoc(loc) {
  loc = String(loc || '').toLowerCase();
  const f = REGIONS.find(R0 => loc.includes(R0.s.toLowerCase().slice(0, 5)) || loc.includes(R0.n.toLowerCase().slice(0, 6)));
  return f ? f.id : 'godgrad';
}

/* ---------- Расчёты ---------- */
const regPop = id => REG_BY[id].pop;
function regSum(X) { let s = 0; for (const g in X.s) s += X.s[g]; return s; }
const mySouls = id => (S.oly.reg[id].s.me || 0);
const myShare = id => mySouls(id) / regPop(id);
const mySpread = () => 1 / (1 + OLY_K.spread * Math.max(0, olyOwned('me') - 2));
function olyOwned(g) { let n = 0; for (const R0 of REGIONS) if (S.oly.reg[R0.id].own === g) n++; return n; }
function olySouls(g) { let n = 0; for (const R0 of REGIONS) n += S.oly.reg[R0.id].s[g] || 0; return n; }
function olyRate(g) { // ОВ в час
  let v = olySouls(g) / OLY_K.infSoul;
  for (const R0 of REGIONS) if (S.oly.reg[R0.id].own === g) v += OLY_K.infBase + R0.pop / OLY_K.infPop;
  return v;
}
function olyRanking() {
  const O = S.oly;
  return GOD_IDS.map(g => ({ g, inf: O.inf[g] || 0, regs: olyOwned(g), souls: olySouls(g), rate: olyRate(g) })).sort((a, b) => b.inf - a.inf || b.rate - a.rate || (a.g === 'me' ? -1 : 1));
}
const olyRank = () => olyRanking().findIndex(x => x.g === 'me') + 1;
function olyB(key) { if (!S || !S.oly) return false; for (const R0 of REGIONS) if (R0.b === key && S.oly.reg[R0.id].own === 'me') return true; return false; }
const olyFaith = () => S && S.oly ? olyOwned('me') * OLY_K.regFaith + (olyB('faith') ? .004 : 0) : 0;
const heroIn = id => S.hero.reg === id && S.hero.state !== 'dead' && !OLY_SLEEP;
function olyDef(id, g) { const X = S.oly.reg[id]; let d = 1 - OLY_K.tDef * (X.tp[g] || 0); if (g === 'me' && heroIn(id)) d *= .6; if (g === 'me' && (SILENT || OLY_SLEEP)) d *= OLY_K.offDef; return Math.max(.25, d); }
function regTempleCost(id) { const L = S.oly.reg[id].tp.me || 0; return L >= OLY_K.tMax ? 0 : Math.round(OLY_K.tCost[L] * (olyB('temple') ? .85 : 1)); }
function olyLog(x, c) { const O = S.oly; O.log.unshift({ tm: nowStr(), x, c: c || '' }); if (O.log.length > 30) O.log.length = 30; }
/* Обращение душ: из ничьих легко, чужие — труднее (steal) и с учётом храмов/присутствия героя */
function olyConvert(id, g, amt) {
  if (!(amt > 0) || !S.oly.reg[id]) return 0;
  const X = S.oly.reg[id], pop = regPop(id), un = Math.max(0, pop - regSum(X));
  const oth = []; let ow = 0;
  for (const k in X.s) if (k !== g && X.s[k] > 0) { const w = X.s[k] * olyDef(id, k); oth.push([k, w]); ow += w; }
  const W = un + ow; if (W <= 0) return 0;
  const fu = un / W; let got = Math.min(un, amt * fu);
  const st = amt * (1 - fu) * OLY_K.steal;
  for (const [k, w] of oth) { const take = Math.min(X.s[k], st * w / ow); X.s[k] -= take; got += take; if (X.s[k] < .5) delete X.s[k]; }
  X.s[g] = (X.s[g] || 0) + got;
  return got;
}
/* Смена владельца с гистерезисом */
function regOwner(id) {
  const O = S.oly, X = O.reg[id], pop = regPop(id), cur = X.own, cv = cur ? (X.s[cur] || 0) : 0;
  let best = null, bv = 0; for (const g in X.s) if (X.s[g] > bv) { bv = X.s[g]; best = g; }
  let nw = cur;
  if (!cur || cv < pop * OLY_K.minShare) nw = bv >= pop * OLY_K.minShare ? best : null;
  else if (best !== cur && bv > cv * OLY_K.hyst + 2) nw = best;
  if (nw === cur) return;
  X.own = nw; X.hot = 180;
  const R0 = REG_BY[id];
  if (nw === 'me') {
    diary(`🏛 ${R0.ic} ${R0.n} теперь мой! Здешние души молятся ${S.god.name}. Бонус: ${R0.bt}.`, 'oly', `+${Math.round(OLY_K.regFaith * 3600)} веры в час`);
    if (!SILENT) { toast(`🏛 ${R0.n} — ваш регион! ${R0.bt}`); sfx('level'); }
    olyLog(`🏛 Вы заняли ${R0.n}${cur ? ` (было: ${godName(cur)})` : ''}`, 'me');
  } else if (cur === 'me') {
    diary(`💔 ${R0.ic} ${R0.n} потерян: ${nw ? 'там теперь правит бог ' + godName(nw) : 'души разбрелись, регион ничей'}. Боже, верни его!`, 'oly');
    if (!SILENT) toast(`💔 Потерян регион ${R0.n}${nw ? ' — его забрал ' + godName(nw) : ''}`);
    olyLog(`💔 ${R0.n} ушёл от вас${nw ? ' к богу ' + godName(nw) : ''}`, 'bad');
  } else olyLog(nw ? `${R0.ic} ${R0.n}: теперь правит ${godName(nw)}${cur ? ` (вместо ${godName(cur)})` : ''}` : `${R0.ic} ${R0.n} стал ничьим`, '');
}

/* ---------- Действия бога-игрока ---------- */
function olySend(id) {
  const R0 = REG_BY[id], O = S.oly, h = S.hero; if (!R0) return false;
  if (h.reg === id) { O.dest = null; O.hold = { r: id, t: OLY_K.holdT }; diary(`Бог велит стоять за регион «${R0.n}». Остаюсь здесь и несу слово!`, 'oly'); return true; }
  O.dest = id; O.hold = null;
  const d = regDist(h.reg, id);
  diary(`🧭 Бог велит идти ${R0.to}. Путь неблизкий (${d} ${plural(d, 'переход', 'перехода', 'переходов')}), но я уже шагаю!`, 'oly');
  return true;
}
function olyTemple(id) {
  const R0 = REG_BY[id], X = S.oly.reg[id], L = X.tp.me || 0; if (!R0) return;
  if (L >= OLY_K.tMax) return toast('Храм здесь уже величайший.');
  if (myShare(id) < OLY_K.tReq && S.hero.reg !== id) return toast(`Строить можно, где у вас от ${Math.round(OLY_K.tReq * 100)}% душ или где сейчас герой.`);
  const c = regTempleCost(id); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; X.tp.me = L + 1; addGxp(c / 5); X.hot = 120;
  diary(`⛪ ${R0.v[0].toUpperCase() + R0.v.slice(1)} ${L ? 'расширили' : 'построили'} ${TEMPLE_R[L]} во славу моего бога.`, 'oly', `−${c} веры, храм ур. ${L + 1}: +${OLY_K.tConv * (L + 1)} душ в час, защита ${Math.round(OLY_K.tDef * (L + 1) * 100)}%`);
  olyLog(`⛪ Вы: ${TEMPLE_R[L]} ${R0.v}`, 'me');
}
/* Штурм: солдаты переманивают души владельца (или главного соперника) в регионе */
function stormTarget(id, g) {
  const X = S.oly.reg[id]; if (X.own && X.own !== g) return X.own;
  let best = null, bv = 0; for (const k in X.s) if (k !== g && X.s[k] > bv) { bv = X.s[k]; best = k; } return best;
}
function olyStormCalc(id, g, n) {
  const X = S.oly.reg[id], tg = stormTarget(id, g);
  const garrison = tg === 'me' ? S.flock.army : tg ? ((rivalOf(tg) || {}).army || 0) : 0;
  const def = tg ? Math.max(.3, 1 - .1 * (X.tp[tg] || 0) - Math.min(.3, garrison * .01) - (tg === 'me' && heroIn(id) ? .15 : 0)) : 1;
  const take = tg ? Math.min(X.s[tg] || 0, n * OLY_K.stormPer * def) : Math.min(Math.max(0, regPop(id) - regSum(X)), n * OLY_K.stormPer * .7);
  return { tg, take, gain: tg ? take * .8 : take, loss: Math.min(n, Math.ceil(n * OLY_K.stormLoss * (tg ? 1.2 - def * .4 : .5))) };
}
function olyStorm(id, g, n) {
  const X = S.oly.reg[id], c = olyStormCalc(id, g, n);
  if (c.tg) { X.s[c.tg] = Math.max(0, (X.s[c.tg] || 0) - c.take); if (X.s[c.tg] < .5) delete X.s[c.tg]; }
  X.s[g] = (X.s[g] || 0) + c.gain; X.hot = 180;
  return c;
}
function olyStormMe(id, n) {
  const R0 = REG_BY[id], X = S.oly.reg[id], O = S.oly; if (!R0) return;
  n = n === 'all' ? S.flock.army : Math.min(+n || 0, S.flock.army, OLY_K.stormMax);
  n = Math.min(n, OLY_K.stormMax);
  if (n < 1) return toast('Армии нет. Наберите солдат во вкладке «Паства».');
  if (X.cdS > 0) return toast(`Армия ещё не оправилась после штурма здесь (${fmtDur(X.cdS)}).`);
  if (!stormTarget(id, 'me') && regSum(X) >= regPop(id) - 1) return toast('Здесь некого штурмовать.');
  const c = olyStorm(id, 'me', n);
  S.flock.army -= c.loss; X.cdS = OLY_K.stormCd; addGxp(n * 2); shiftAlign(-1);
  diary(`⚔ Божья армия (${n} ${plural(n, 'солдат', 'солдата', 'солдат')}) штурмует регион ${R0.n}${c.tg ? ` — оплот бога ${godName(c.tg)}` : ''}! ${c.tg ? 'Жрецы разбежались, прихожане перешли к нам.' : 'Ничейные души впечатлены вилами.'}`, 'oly', `+${Math.round(c.gain)} душ${c.tg ? `, у ${godShort(c.tg)} −${Math.round(c.take)}` : ''}, погибло солдат: ${c.loss}`);
  olyLog(`⚔ Вы штурмовали регион ${R0.n}: +${Math.round(c.gain)} душ`, 'me');
  regOwner(id);
  if (!SILENT) sfx('crit');
}
/* Дуэль богов в регионе — обычная дуэль богов (startGodDuel) с ставкой душ */
function olyDuel(id) {
  const X = S.oly.reg[id], g = X.own && X.own !== 'me' ? X.own : stormTarget(id, 'me');
  if (!g || g === 'me') return toast('Здесь не с кем драться за души.');
  if (X.cdD > 0) return toast(`За этот регион уже бились недавно (${fmtDur(X.cdD)}).`);
  if (S.god.faith < 10) return toast('Нужно 10 веры.');
  if (S.fight || S.dun || S.hero.state !== 'road' || duelPending) return toast('Герой сейчас занят — дуэль начнётся, когда он будет в пути.');
  S.god.faith -= 10; X.cdD = OLY_K.duelCd;
  startGodDuel(g, id).then(ok => { if (!ok && S) { addFaith(10); X.cdD = 0; } });
  return true;
}
function olyDuelResult(id, g, won) {
  const R0 = REG_BY[id], X = S.oly.reg[id]; if (!R0 || !X) return '';
  if (won) { const take = Math.min(X.s[g] || 0, R0.pop * OLY_K.duelWin); X.s[g] = (X.s[g] || 0) - take; X.s.me = (X.s.me || 0) + take; X.hot = 180; regOwner(id); olyLog(`🤺 Вы победили ${godName(g)} в дуэли за регион ${R0.n}`, 'me'); return `+${Math.round(take)} душ (${R0.s})`; }
  const take = Math.min(X.s.me || 0, R0.pop * OLY_K.duelLose); X.s.me = (X.s.me || 0) - take; X.s[g] = (X.s[g] || 0) + take; X.hot = 180; regOwner(id); olyLog(`🤺 ${godName(g)} отстоял регион ${R0.n} в дуэли`, 'bad');
  return take >= 1 ? `−${Math.round(take)} душ (${R0.s})` : '';
}
/* Олимпийский дар — награда трона на весь следующий сезон */
function olyGift() {
  const O = S.oly; if (!O.rew) return toast('Дар есть только у богов с троном Олимпа.');
  if (O.gift > 0) return toast(`Дар восстановится через ${fmtDur(O.gift)}.`);
  const id = S.hero.reg, R0 = REG_BY[id];
  const got = olyConvert(id, 'me', R0.pop * OLY_K.giftShare * 1.6); addFaith(25); O.gift = OLY_K.giftCd; S.oly.reg[id].hot = 180;
  diary(`${O.rew.ic} Олимпийский дар! ${R0.v[0].toUpperCase() + R0.v.slice(1)} разверзлись небеса, и сам ${O.rew.title} явился народу.`, 'oly', `+${Math.round(got)} душ, +25 веры`);
  regOwner(id);
}
/* ---------- Герой на карте ---------- */
function regDist(a, b) { if (a === b) return 0; const p = regPath(a, b); return p ? p.length : 99; }
function regPath(a, b) {
  if (!REG_BY[a] || !REG_BY[b]) return null;
  const prev = { [a]: null }, q = [a];
  while (q.length) { const x = q.shift(); if (x === b) break; for (const y of REG_BY[x].nb) if (!(y in prev)) { prev[y] = x; q.push(y); } }
  if (!(b in prev)) return null;
  const path = []; for (let x = b; x !== a; x = prev[x]) path.unshift(x); return path;
}
const olyGoal = () => { const O = S.oly; return O.dest || (O.hold && O.hold.t > 0 ? O.hold.r : null); };
function nearestTown(id) { if (REG_BY[id].town) return id; return TOWN_REGS.slice().sort((a, b) => regDist(id, a) - regDist(id, b) || (a === 'godgrad' ? -1 : 1))[0]; }
function olyEnter(id, quiet) {
  const h = S.hero, O = S.oly, R0 = REG_BY[id]; if (!R0 || h.reg === id) return;
  h.reg = id; h.loc = R0.n;
  if (O.dest === id) { O.dest = null; O.hold = { r: id, t: OLY_K.holdT }; diary(`🧭 Дошёл до места: ${R0.n}, как велел бог. Буду нести здесь его слово.`, 'oly'); return; }
  if (!quiet && R() < .5) { const X = O.reg[id]; diary(X.own === 'me' ? `Вхожу ${R0.to}. Тут молятся моему богу — приятно!` : X.own ? `Вхожу ${R0.to}. Здесь правит бог ${godName(X.own)}. Ничего, переубедим.` : `Вхожу ${R0.to}. Здесь пока никто никому не молится.`); }
}
/* Шаг пешком: идём к цели бога или (редко) бродим по соседям */
function olyWalk() {
  const h = S.hero, goal = olyGoal();
  if (goal && goal !== h.reg) { if (R() < .6) { const p = regPath(h.reg, goal); if (p && p.length) olyEnter(p[0]); } return; }
  if (!goal && R() < .1) { const nb = REG_BY[h.reg].nb; olyEnter(pick(nb)); }
}
function olyToTown() { const h = S.hero, t = nearestTown(h.reg); if (t !== h.reg) olyEnter(t, true); return REG_BY[h.reg].n; }
function olyLeaveTown() {
  const h = S.hero, goal = olyGoal();
  if (goal && goal !== h.reg) { const p = regPath(h.reg, goal); if (p && p.length) olyEnter(p[0], true); return goal; }
  if (!goal && R() < .6) { const nb = REG_BY[h.reg].nb; olyEnter(pick(nb), true); }
  return h.reg;
}
/* Вклад героя: прогулка, город, проповедь, победа (в регионе, где он сейчас) */
function olyHero(kind, n) {
  if (!S || !S.oly) return 0;
  const h = S.hero, id = h.reg; if (!REG_BY[id] || h.state === 'dead') return 0;
  const cha = 1 + .08 * mod(statVal('cha'));
  const v = kind === 'walk' ? OLY_K.heroWalk * cha : kind === 'town' ? OLY_K.heroTown * cha : kind === 'preach' ? OLY_K.heroPreach * (n || 1) : kind === 'win' ? OLY_K.heroWin : +n || 0;
  const got = olyConvert(id, 'me', v * (SILENT ? OLY_K.heroOff : 1) * mySpread());
  if (kind === 'preach' || kind === 'win') regOwner(id);
  return got;
}

/* ---------- Ход мира ---------- */
function olyTick(gdt) {
  if (!S) return;
  if (!S.oly) S.oly = olyNewState(olyNow());
  const O = S.oly;
  O.acc += gdt;
  while (O.acc >= OLY_K.step) { O.acc -= OLY_K.step; olyStep(OLY_K.step); }
  olySeasonCheck();
}
function olyStep(dt) {
  const O = S.oly, hrs = dt / 3600;
  for (const R0 of REGIONS) {
    const X = O.reg[R0.id];
    if (X.cdS > 0) X.cdS = Math.max(0, X.cdS - dt); if (X.cdD > 0) X.cdD = Math.max(0, X.cdD - dt); if (X.hot > 0) X.hot = Math.max(0, X.hot - dt);
    for (const g in X.s) {
      const pres = g === 'me' ? heroIn(R0.id) : O.bots[g] && O.bots[g].r === R0.id;
      if (!pres) { X.s[g] *= 1 - OLY_K.decay * hrs * (1 - .15 * (X.tp[g] || 0)); if (X.s[g] < .5) delete X.s[g]; }
    }
    for (const g in X.tp) olyConvert(R0.id, g, OLY_K.tConv * X.tp[g] * hrs * (g === 'me' ? mySpread() : 1));
  }
  if (O.hold) { O.hold.t -= dt; if (O.hold.t <= 0) O.hold = null; }
  if (O.gift > 0) O.gift = Math.max(0, O.gift - dt);
  const acts = rivals.worldTurn(olyView(), dt) || [];
  for (const a of acts) olyApply(a);
  for (const R0 of REGIONS) regOwner(R0.id);
  for (const g of GOD_IDS) O.inf[g] = (O.inf[g] || 0) + hrs * olyRate(g);
}
/* Что видят боги-соперники (тот же вид получит сетевой провайдер) */
function olyView() {
  const O = S.oly, rk = olyRanking();
  return { leader: rk[0].g, me: { reg: S.hero.reg, army: S.flock.army },
    regs: REGIONS.map(R0 => ({ id: R0.id, pop: R0.pop, nb: R0.nb, own: O.reg[R0.id].own, s: O.reg[R0.id].s, tp: O.reg[R0.id].tp })),
    gods: rk.map(x => ({ id: x.g, inf: x.inf, regs: x.regs, souls: x.souls })) };
}
/* Применить действие соперника (бот или, в будущем, настоящий игрок) */
function olyApply(a) {
  if (!a || !GOD_IDS.includes(a.god) || a.god === 'me' || !REG_BY[a.reg]) return;
  const O = S.oly, R0 = REG_BY[a.reg], X = O.reg[a.reg], nm = godName(a.god);
  if (a.kind === 'focus') {
    if (O.bots[a.god]) O.bots[a.god].r = a.reg;
    const mine = X.own === 'me' || myShare(a.reg) >= .15;
    if (mine && X.own !== a.god) {
      X.hot = 120;
      diary(`⚠ Бог ${nm} обращает души ${R0.v}${X.own === 'me' ? ' — это наш регион!' : '.'}`, 'oly');
      if (!SILENT) toast(`⚠ ${nm} обращает души ${R0.v}`);
    }
    olyLog(`${R0.ic} ${nm} проповедует ${R0.v}`, mine ? 'warn' : '');
  } else if (a.kind === 'preach') olyConvert(a.reg, a.god, Math.max(0, +a.power || 0));
  else if (a.kind === 'temple') {
    const L = X.tp[a.god] || 0; if (L >= 3) return; X.tp[a.god] = L + 1; X.hot = 90;
    olyLog(`⛪ ${nm}: ${TEMPLE_R[L]} ${R0.v}`, '');
  } else if (a.kind === 'storm') {
    const r = rivalOf(a.god); const n = Math.min(Math.floor(+a.n || 0), r ? Math.floor(r.army) : 0); if (n < OLY_K.stormMin) return;
    const c = olyStorm(a.reg, a.god, n); if (r) r.army = Math.max(0, r.army - c.loss);
    if (c.tg === 'me') {
      diary(`🔥 Армия бога ${nm} (${n}) штурмует наш регион ${R0.n}! Наши прихожане разбегаются.`, 'oly', `−${Math.round(c.take)} душ${S.flock.army ? `, гарнизон из ${S.flock.army} солдат сдерживал врага` : ''}`);
      if (!SILENT) toast(`🔥 ${nm} штурмует ${R0.n}: −${Math.round(c.take)} ваших душ`);
      olyLog(`🔥 ${nm} штурмовал ваш регион ${R0.n}`, 'bad');
    } else olyLog(`🔥 ${nm} штурмовал регион ${R0.n}${c.tg ? ' (' + godName(c.tg) + ')' : ''}`, '');
  }
}

/* ---------- Сезон ---------- */
function olySeasonCheck() {
  const O = S.oly; let guard = 0;
  while (olyNow() >= S.oly.end && guard++ < 60) olySeasonEnd();
  return O !== S.oly;
}
function olySeasonEnd() {
  const O = S.oly, rk = olyRanking(), rank = rk.findIndex(x => x.g === 'me') + 1, n = O.n, end = O.end;
  const me = rk[rank - 1];
  O.hist.push({ n, rank, inf: Math.round(me.inf), regs: me.regs, of: GOD_IDS.length }); if (O.hist.length > 12) O.hist.shift();
  const throne = rank <= OLY_K.thrones ? THRONES[rank - 1] : null;
  const last = { n, rank, at: end, top: rk.map(x => ({ g: x.g, inf: Math.round(x.inf), regs: x.regs })), seen: 0 };
  try { rivals.reportSeason({ n, rank, top: last.top }); } catch (e) { }
  const W = olyNewWorld(n + 1, end);
  W.v = 1; W.intro = O.intro; W.hist = O.hist; W.last = last;
  W.rew = throne ? { n: n + 1, rank, title: throne[1], ic: throne[0], frame: frameOf(rank) } : null;
  S.oly = W;
  for (const r of S.rivals) r.army = Math.min(r.army, 12);
  if (throne) { addGxp(60 - rank * 5); diary(`${throne[0]} Сезон ${n} окончен: ${S.god.name} занял трон Олимпа №${rank} — «${throne[1]}»! Новый сезон: карта снова чиста, но мой бог теперь носит титул, рамку и Олимпийский дар.`, 'oly', `место ${rank} из ${GOD_IDS.length}, ${Math.round(me.inf)} ОВ`); }
  else diary(`🏛 Сезон ${n} окончен: ${S.god.name} — ${rank}-й из ${GOD_IDS.length}, без трона. Ничего, новый сезон — новая война за Олимп!`, 'oly', `${Math.round(me.inf)} ОВ`);
  if (SILENT) SILENT.c.seasons = (SILENT.c.seasons || []).concat([{ n, rank, title: throne ? throne[1] : '' }]);
  else { toast(`🏛 Сезон ${n} окончен: вы ${rank}-й!`); if (typeof seasonModal === 'function' && typeof document !== 'undefined') setTimeout(() => { if (S && S.oly.last && !S.oly.last.seen) seasonModal(); }, 50); }
  S.hero.reg = S.hero.reg || 'godgrad';
}
/* Офлайн: дозапуск мира, когда герой уже спит (после 24 ч симуляции), крупными шагами */
function olyFastForward(sec) {
  const prevSleep = OLY_SLEEP; OLY_SLEEP = true;
  try { let t = 0; const st = 600; while (t < sec) { const d = Math.min(st, sec - t); t += d; if (OLY_NOW !== null) OLY_NOW += d * 1000; S.oly.acc += d; while (S.oly.acc >= OLY_K.step) { S.oly.acc -= OLY_K.step; olyStep(OLY_K.step); } olySeasonCheck(); } }
  finally { OLY_SLEEP = prevSleep; }
}
function olySnap() { const O = S.oly; return { n: O.n, rank: olyRank(), regs: REGIONS.filter(R0 => O.reg[R0.id].own === 'me').map(R0 => R0.id), inf: Math.round(O.inf.me || 0) }; }

/* ---------- Соперники на карте: локальный ИИ ---------- */
Object.assign(LocalAIProvider.prototype, {
  seasonCalendar() { return null; },   // локальный сезон (сервер вернёт общий календарь { n, start, end })
  reportSeason(res) { for (const t of res.top.slice(0, OLY_K.thrones)) { const r = this.st().rivals.find(x => x.id === t.g); if (r && R() < .5) r.lvl = Math.min(r.lvl + 1, this.st().god.lvl + 3); } },
  worldTurn(view, dt) {
    const st = this.st(), O = st.oly, out = [], hrs = dt / 3600;
    for (const g of st.rivals) {
      const B = O.bots[g.id]; if (!B) continue;
      const P = PERS_OLY[g.pers] || PERS_OLY.def, mine = view.regs.filter(x => x.own === g.id), owned = mine.length;
      B.t -= dt;
      if (B.t <= 0) {
        const tgt = this._target(g, view, P, B);
        B.t = rnd(900, 2700);
        if (tgt) out.push({ god: g.id, kind: 'focus', reg: tgt });
      }
      const pow = (.85 + .06 * Math.min(g.lvl, 10)) * P.conv * (B.a || 1) * (B.a > 1 && O.end - olyNow() < OLY_K.sprintT ? OLY_K.sprint : 1) / (1 + (B.a > 1 ? .08 : .15) * Math.max(0, owned - 1));
      out.push({ god: g.id, kind: 'preach', reg: B.r, power: OLY_K.bot * pow * hrs });
      if (R() < .4 * hrs) g.army += 1;
      if (g.army >= 4 && R() < P.storm * hrs) {
        const cand = view.regs.filter(x => x.own && x.own !== g.id).map(x => ({ x, w: 1 + (x.own === view.leader ? (B.a > 1 ? 2.5 : .8) : 0) + (x.own === 'me' && g.pers === 'aggr' ? 1 : 0) + (x.nb.some(n => mine.find(m => m.id === n)) ? 1 : 0) + R() }));
        cand.sort((a, b) => b.w - a.w);
        if (cand.length) out.push({ god: g.id, kind: 'storm', reg: cand[0].x.id, n: Math.min(Math.floor(g.army), 4 + Math.min(g.lvl, 8) * 2) });
      }
      if (owned && R() < P.temple * hrs) { const t = mine.filter(x => (x.tp[g.id] || 0) < 3).sort(() => R() - .5)[0]; if (t) out.push({ god: g.id, kind: 'temple', reg: t.id }); }
    }
    return out;
  },
  _target(g, view, P, B) {
    const lb = B && B.a > 1 ? 2.5 : .8; // претенденты охотятся за лидером, остальные больше заняты соседями
    const mine = new Set(view.regs.filter(x => x.own === g.id).map(x => x.id));
    let best = null, bw = -1e9;
    for (const x of view.regs) {
      const my = x.s[g.id] || 0, own = x.own;
      let w = R() * 1.5;
      if (!own) w += 2.2;
      else if (own === g.id) { let sec = 0; for (const k in x.s) if (k !== g.id) sec = Math.max(sec, x.s[k]); w += sec > my * .7 ? 2.5 * P.def : -1.5; }
      else { w += .6 * P.att + (own === view.leader ? lb : 0) + (own === 'me' && g.pers === 'aggr' ? .8 : 0); if (my > x.pop * .15) w += 1; }
      if (x.nb.some(n => mine.has(n))) w += 1;
      if (!mine.size && x.id === GOD_HOME[g.id]) w += 3;
      if (w > bw) { bw = w; best = x.id; }
    }
    return best;
  }
});

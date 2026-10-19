
/* =====================================================================
   2) ТЕМП ИГРЫ (все времена — в игровых секундах при скорости ×1)
   Цели: ур.2 ≈ 30 мин, ур.5 ≈ 11 ч, ур.10 ≈ 7 дней «жизни героя»
   (с учётом офлайна, где герой живёт на 75% темпа, — ≈ 9–10 дней реального времени).
   ===================================================================== */
const PACE = {
  step: [40, 60],          // шаг героя (запись в дневнике) раз в 40–60 с
  fork: [300, 600],        // божественный момент / развилка раз в 5–10 мин (при ×1 — реальных)
  forkOff: [720, 1200],    // офлайн герой сам решает момент раз в 12–20 мин (как старые развилки) — молча, в сводку попадают максимум 2
  duel: [2700, 4500],      // дуэль раз в 45–75 мин
  event: [7200, 10800],    // мировое событие раз в 2–3 ч
  dun: [10800, 18000],     // подземелье само раз в 3–5 ч (или по зову бога)
  dunCd: 4 * 3600,         // пещера не чаще раза в 4 ч
  rivals: 3600,            // соперники растут раз в час
  feat: 1800,              // 30 мин на выбор черты, потом герой выберет сам
  dead: 600,               // 10 мин до самовоскрешения
  offEff: 0.75,            // эффективность офлайна (без присмотра бога герой ленится)
  offCap: 86400            // офлайн учитывается до 24 ч за раз
};
/* Сколько часов (при ×1) занимает переход с уровня L на L+1 */
const LEVEL_HOURS = [0, 0.5, 1.5, 3, 6, 12, 20, 30, 42, 55, 70, 85, 100, 120, 140, 160, 180, 200, 220, 240];
/* Суммарный опыт для уровня (как в D&D) */
const XP_CUM = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const MAX_LVL = 20;
const XP_TUNE = 1.0;      // подстройка под симуляцию темпа
const STEPS_PER_HOUR = 3600 / ((PACE.step[0] + PACE.step[1]) / 2);
const xpNext = l => l >= MAX_LVL ? Infinity : XP_CUM[l + 1] - XP_CUM[l];
const xpUnit = l => { const L = clamp(l, 1, MAX_LVL - 1); return xpNext(L) / LEVEL_HOURS[L] / STEPS_PER_HOUR * XP_TUNE; };
const goldScale = l => 1 + 0.35 * (l - 1);
const gxpNext = l => 40 * l * l + 60;

/* =====================================================================
   3) СОСТОЯНИЕ И СОХРАНЕНИЕ
   ===================================================================== */
const RIVALS_BASE = [
  { id: 'g1', name: 'Громобой Неистовый', hero: 'Сэр Пузо', pers: 'aggr', lvl: 2, race: 'human', cls: 'warrior' },
  { id: 'g2', name: 'Матушка Плюшка', hero: 'Бронислав Кочерга', pers: 'heal', lvl: 1, race: 'dwarf', cls: 'cleric' },
  { id: 'g3', name: 'Шельмец Ухмыльский', hero: 'Лёха Ловкач', pers: 'trick', lvl: 2, race: 'halfling', cls: 'rogue' },
  { id: 'g4', name: 'Тихон Безмолвный', hero: 'Брат Молчун', pers: 'def', lvl: 1, race: 'elf', cls: 'ranger' },
  { id: 'g5', name: 'Великая Сосиска', hero: 'Бородан Голодный', pers: 'trick', lvl: 3, race: 'orc', cls: 'barbarian' },
  { id: 'g6', name: 'Бог Понедельников', hero: 'Унылый Вадим', pers: 'aggr', lvl: 3, race: 'tiefling', cls: 'mage' },
  { id: 'g7', name: 'Светлана Лучезарная', hero: 'Принц Кувалда', pers: 'heal', lvl: 4, race: 'human', cls: 'bard' },
  { id: 'g8', name: 'Кракозябр Древний', hero: 'Варвар Интеллигентный', pers: 'def', lvl: 4, race: 'orc', cls: 'mage' }
];
const PERS = { aggr: 'агрессор', heal: 'целитель', trick: 'хитрец', def: 'защитник' };
const HERO_STATES = ['road', 'fight', 'town', 'dead', 'duel', 'rest', 'dungeon'];

function newQuest() { return { n: pick(QUESTS).replace('{place}', pick(PLACES)), p: 0 }; }
/* Характеристики: стандартный набор D&D по приоритетам класса + бонусы расы */
function genStats(cls, race) {
  const arr = [15, 14, 13, 12, 10, 8], st = {};
  CLASSES[cls].prio.forEach((s, i) => { st[s] = arr[i]; });
  for (const s in RACES[race].b) st[s] += RACES[race].b[s];
  return st;
}
function starterItem(slot, base) {
  const it = { id: 'it' + Math.random().toString(36).slice(2, 9), slot, base: base[0], n: base[0], rar: 0, plus: 0,
    die: slot === 'weapon' ? base[1] : 0, ac: slot !== 'weapon' ? base[1] : 0, props: [], curse: null, v: 5, req: { lvl: 1 } };
  if (slot === 'offhand') it.blk = base[2] || .08;
  return upgradeItem(it);
}
/* Стартовые щиты/второй кинжал: воин и жрец — со щитом, плут — с двумя кинжалами */
function starterEq(cls) {
  const c = CLASSES[cls], eq = {}; for (const k of EQ_KEYS) eq[k] = null;
  eq.weapon = starterItem('weapon', c.wpn); eq.armor = starterItem('armor', c.arm);
  if (STYLE[cls].shield) eq.offhand = starterItem('offhand', ['Крышка от кастрюли', 1, .08]);
  if (cls === 'rogue') eq.offhand = starterItem('weapon', ['Кинжал «Ой»', 4]);
  return eq;
}
/* Проверка вещи для слота сохранения */
function itemFitsKey(it, k) { if (!it || typeof it !== 'object' || typeof it.slot !== 'string') return false; return k === 'ring2' ? it.slot === 'ring' : k === 'offhand' ? it.slot === 'offhand' || (it.slot === 'weapon' && it.cat === 'dagger') : it.slot === k; }
function defaultState(god, hero, race, cls) {
  race = RACES[race] ? race : 'human'; cls = CLASSES[cls] ? cls : 'warrior';
  const c = CLASSES[cls];
  const S0 = {
    v: SAVE_VERSION,
    god: { name: god, lvl: 1, xp: 0, faith: 60, sp: 1, align: 0, skills: { heal: 1, bolt: 1, rain: 0, bless: 0, shield: 0, curse: 0, quake: 0, luck: 0, beast: 0 } },
    hero: { name: hero, race, cls, st: genStats(cls, race), feats: [], lvl: 1, xp: 0, hp: 30, maxHp: 30, gold: 30, potions: 1,
      eq: starterEq(cls),
      inv: [], loc: 'Годград', state: 'road', monster: null, quest: newQuest(), trust: 40, deadT: 0, townStep: 0,
      restT: 0, restKind: '', shortRests: 2, orcCd: 0, inj: [] },
    flock: { fol: 3, temple: 0, templeProg: 0, army: 0 },
    buffs: { luck: 0, shield: 0, trade: 0 },
    timers: { hero: 3, fork: 90, duel: 480, event: 900, dun: 1500, dunCd: 0, rivals: PACE.rivals },
    fork: null, fight: null, ev: null, dun: null, fightAuto: false,
    arena: { rating: 1000, w: 0, l: 0, fat: 0, fatT: 0, apps: [], seq: 0 }, chat: { msgs: [], unread: 0, open: false }, featOffer: null, featQueue: 0, forkHist: [], momHist: [], lastEv: null,
    diary: [], rivals: RIVALS_BASE.map(r => Object.assign({ w: 0, l: 0, army: rnd(0, 4), hlvl: rnd(1, 2), bld: bldForBot(r.cls, r.race) }, r)),
    stats: { forks: 0, forksAns: 0, duels: 0, dwins: 0, events: 0, evwins: 0, duns: 0, dwinsD: 0, arenaW: 0, arenaL: 0, bosses: 0 },
    speed: 1, paused: false, tab: 'powers', ui: { mtab: 'hero' }, lastSeen: Date.now()
  };
  return S0;
}
let S = null;
let diaryVer = 0;
let SILENT = null; // во время офлайн-симуляции записи дневника копятся здесь
function save() { if (!S) return; S.lastSeen = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function deepMerge(def, obj) {
  for (const k in def) {
    if (obj[k] === undefined) obj[k] = def[k];
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && obj[k] && typeof obj[k] === 'object') deepMerge(def[k], obj[k]);
  }
  return obj;
}
const SAVE_VERSION = 9;
/* v8: путь героя */
function sanitizeBld(h) {
  const B = h.bld;
  if (!B || typeof B !== 'object' || !BUILDS[B.id]) { h.bld = mkBld(inferBuild(h), 'migr', h.lvl); return; }
  for (const [k, mx] of [['age', 1e9], ['cd', BLD_K.cd], ['loss', 20], ['nolvl', 1e8]]) { if (typeof B[k] !== 'number' || !isFinite(B[k])) B[k] = 0; B[k] = Math.max(0, Math.min(mx, B[k])); }
  B.hist = Array.isArray(B.hist) ? B.hist.filter(x => x && BUILDS[x.id]).map(x => ({ id: x.id, why: BLD_WHY[x.why] ? x.why : 'start', lvl: typeof x.lvl === 'number' && isFinite(x.lvl) ? Math.max(1, Math.min(MAX_LVL, Math.round(x.lvl))) : 1 })).slice(-8) : [];
  if (!B.hist.length) B.hist = [{ id: B.id, why: 'start', lvl: 1 }];
  const r = B.re; B.re = r && typeof r === 'object' && BUILDS[r.from] && r.from !== B.id && typeof r.pts === 'number' && r.pts >= 1 ? { from: r.from, pts: Math.min(6, Math.round(r.pts)), n: Math.min(6, Math.max(Math.round(r.pts), typeof r.n === 'number' && isFinite(r.n) ? Math.round(r.n) : 1)), t: typeof r.t === 'number' && isFinite(r.t) ? Math.max(0, Math.min(BLD_K.respec, r.t)) : BLD_K.respec } : null;
  for (const k of Object.keys(B)) if (!['id', 'age', 'cd', 'loss', 'nolvl', 'hist', 're'].includes(k)) delete B[k];
}
const isNum = v => typeof v === 'number' && isFinite(v);
function fixNum(o, k, def, min, max) { let v = o[k]; if (!isNum(v)) v = def; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); o[k] = v; }
/* Миграция старых сохранений */
function migrate(o) {
  const v = isNum(o.v) ? o.v : 1;
  if (v < 2) {
    const ren = { 'Агнесса Кочерга': 'Бронислав Кочерга', 'Принцесса Кувалда': 'Принц Кувалда' };
    if (Array.isArray(o.rivals)) o.rivals.forEach(r => { if (r && ren[r.hero]) r.hero = ren[r.hero]; });
    if (o.duel && o.duel.foe && ren[o.duel.foe.name]) o.duel.foe.name = ren[o.duel.foe.name];
  }
  if (v < 3 && o.hero) {
    // v2 → v3: раса/класс/характеристики, предметы-объекты, новый темп опыта (уровни сжаты вдвое)
    const h = o.hero;
    h.race = pick(Object.keys(RACES)); h.cls = pick(Object.keys(CLASSES));
    h.st = genStats(h.cls, h.race); h.feats = [];
    const oldL = isNum(h.lvl) ? Math.max(1, Math.floor(h.lvl)) : 1;
    const oldNext = 30 + oldL * oldL * 12, frac = clamp((isNum(h.xp) ? h.xp : 0) / oldNext, 0, 0.95);
    const newL = clamp(Math.round(1 + (oldL - 1) * 0.5), 1, MAX_LVL - 1);
    h.lvl = newL; h.xp = Math.floor(frac * xpNext(newL));
    for (let i = 2; i <= newL; i++) { const s = R() < .5 ? CLASSES[h.cls].prim : pick(STATS); h.st[s] = Math.min(20, h.st[s] + 1); }
    o.featQueue = Math.floor(newL / 2);
    const hpFrac = isNum(h.hp) && isNum(h.maxHp) && h.maxHp > 0 ? clamp(h.hp / h.maxHp, 0, 1) : 1;
    const wOld = Array.isArray(h.weapon) ? h.weapon : null, aOld = Array.isArray(h.armor) ? h.armor : null;
    const c = CLASSES[h.cls];
    const w = starterItem('weapon', wOld ? [String(wOld[0]).replace(/^./, x => x.toUpperCase()), clamp(4 + 2 * Math.floor((wOld[1] || 1) / 3), 4, 12)] : c.wpn);
    w.plus = wOld ? clamp(Math.floor((wOld[1] || 0) / 4), 0, 3) : 0; w.rar = w.plus; if (w.plus) w.n += ' +' + w.plus;
    const a = starterItem('armor', aOld ? [String(aOld[0]).replace(/^./, x => x.toUpperCase()), clamp(aOld[1] || 1, 1, 7)] : c.arm);
    h.eq = { weapon: w, armor: a, amulet: null, ring: null };
    delete h.weapon; delete h.armor;
    h.inv = Array.isArray(h.inv) ? h.inv.filter(i => i && typeof i.n === 'string').map(i => ({ n: i.n, v: isNum(i.v) ? i.v : 3 })) : [];
    h.monster = null; if (h.state === 'fight' || h.state === 'duel') h.state = 'road';
    h.restT = 0; h.restKind = ''; h.shortRests = 2; h.orcCd = 0;
    h._hpFrac = hpFrac;
    if (o.god) { const gl = isNum(o.god.lvl) ? o.god.lvl : 1, gOld = 40 * gl + 10 * gl * gl; o.god.xp = Math.floor(clamp((o.god.xp || 0) / gOld, 0, .95) * gxpNext(gl)); }
    o.duel = null; o.timers = null; // старые таймеры рассчитаны на быстрый темп
    if (o.flock) o.flock.templeProg = 0;
    if (Array.isArray(o.rivals)) o.rivals.forEach(r => { const b = RIVALS_BASE.find(x => x.id === r.id); if (b) { r.race = b.race; r.cls = b.cls; } r.hlvl = clamp(newL + rnd(-1, 1), 1, MAX_LVL); });
    o._migratedV3 = { race: h.race, cls: h.cls, oldL, newL };
  }
  if (v < 4) {
    // v3 → v4: старая дуэль и подземелье заменены боем по зонам и пещерой-картой
    const hadDun = !!o.dun;
    o.duel = null; o.dun = null; o.fight = null;
    if (o.hero) { const h = o.hero; if (['duel', 'dungeon'].includes(h.state)) h.state = 'road'; if (h.state === 'fight') { h.state = 'road'; h.monster = null; } h.inj = []; }
    if (o.timers && typeof o.timers === 'object') { o.timers.dunCd = hadDun ? 3600 : 0; o.timers.duel = Math.min(isNum(o.timers.duel) ? o.timers.duel : 600, 900); }
    o._migratedV4 = 1;
  }
  if (v < 5) {
    // v4 → v5: новый интерфейс (нижние вкладки на телефоне) и пересчитанный баланс; бой/пещера сохраняются
    o.ui = { mtab: 'hero' };
    o._migratedV5 = 1;
  }
  if (v < 6) {
    // v5 → v6: сила снаряжения (ГС), сложности подземелий, кузнец. Начатая пещера станет «обычной» (см. validDun)
    if (o.dun && typeof o.dun === 'object' && !o.dun.diff) o.dun.diff = 'normal';
    o._migratedV6 = 1;
  }
  if (v < 7) {
    // v6 → v7: 10 слотов (шлем, щит, пояс, перчатки, сапоги, 2-е кольцо), категории оружия, требования, комплекты.
    // Старые вещи остаются надетыми (требований у них нет), новые слоты пустые.
    const h = o.hero;
    if (h && h.eq && typeof h.eq === 'object') for (const k of ['offhand', 'helm', 'belt', 'gloves', 'boots', 'ring2']) if (!(k in h.eq)) h.eq[k] = null;
    o._migratedV7 = 1;
  }
  if (v < 8) o._migratedV8 = 1;
  if (v < 9 && o.timers && typeof o.timers === 'object' && isNum(o.timers.fork)) o.timers.fork = Math.min(o.timers.fork, 300); // v9: моменты — первый скоро
  delete o.duel;
  o.v = SAVE_VERSION;
  return o;
}
const ITEM_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'belt', 'gloves', 'boots', 'amulet', 'ring'];
function validItem(it, slot) {
  return it && typeof it === 'object' && it.slot === slot && ITEM_SLOTS.includes(slot) && typeof it.n === 'string' && isNum(it.rar) && isNum(it.plus) && Array.isArray(it.props);
}
function sanitizeItem(it) {
  it.rar = clamp(Math.floor(it.rar), 0, 4); it.plus = clamp(Math.floor(it.plus), 0, 5);
  fixNum(it, 'die', it.slot === 'weapon' ? 4 : 0, 0, 12); fixNum(it, 'ac', 0, 0, 10); fixNum(it, 'v', 5, 0);
  upgradeItem(it);
  if (it.slot === 'weapon') { if (!WCAT[it.cat]) it.cat = 'sword'; it.h2 = WCAT[it.cat].h2 ? 1 : 0; } else { delete it.cat; delete it.h2; }
  if (it.kind && !ARM_KIND[it.kind]) it.kind = 'l';
  if (it.slot === 'offhand') fixNum(it, 'blk', .08, 0, .3); else delete it.blk;
  if (it.slot === 'gloves') fixNum(it, 'hit', 0, 0, 4); else delete it.hit;
  if (!it.req || typeof it.req !== 'object') it.req = { lvl: 1 };
  fixNum(it.req, 'lvl', 1, 1, MAX_LVL); it.req.lvl = Math.floor(it.req.lvl);
  if (typeof it.req.s !== 'string' || !it.req.s.split('/').every(k => STATS.includes(k)) || !isNum(it.req.v)) { delete it.req.s; delete it.req.v; } else it.req.v = clamp(Math.round(it.req.v), 0, 20);
  if (it.set && !SETS[it.set]) delete it.set;
  for (const k of ['pre', 'suf', 'fl']) if (it[k] !== undefined && typeof it[k] !== 'string') delete it[k];
  it.props = it.props.filter(p => p && PROP_DEF[p.k]).map(p => STATS.includes(p.k) ? { k: p.k, v: clamp(isNum(p.v) ? p.v : 1, 1, 3) } : { k: p.k });
  if (it.curse && !(CURSES[it.curse.k])) it.curse = null;
  if (!it.id) it.id = 'it' + Math.random().toString(36).slice(2, 9);
  if (typeof it.base !== 'string') it.base = it.n;
  return it;
}
function sanitize(o) {
  const d = defaultState(o.god.name, o.hero.name, o.hero.race, o.hero.cls), g = o.god, h = o.hero, f = o.flock;
  if (typeof g.name !== 'string' || !g.name.trim()) g.name = 'Великий Пельмень';
  if (typeof h.name !== 'string' || !h.name.trim()) h.name = 'Геннадий Отважный';
  fixNum(g, 'lvl', 1, 1, 99); g.lvl = Math.floor(g.lvl); fixNum(g, 'xp', 0, 0, gxpNext(g.lvl) - 1); fixNum(g, 'sp', 0, 0); fixNum(g, 'align', 0, -100, 100);
  if (!g.skills || typeof g.skills !== 'object') g.skills = d.god.skills;
  for (const id in POWERS) { fixNum(g.skills, id, 0, 0, 3); g.skills[id] = Math.floor(g.skills[id]); }
  for (const k in g.skills) if (!POWERS[k]) delete g.skills[k];
  if (!RACES[h.race]) h.race = 'human'; if (!CLASSES[h.cls]) h.cls = 'warrior';
  if (!h.st || typeof h.st !== 'object') h.st = genStats(h.cls, h.race);
  for (const s of STATS) { fixNum(h.st, s, 10, 3, 20); h.st[s] = Math.round(h.st[s]); }
  h.feats = Array.isArray(h.feats) ? [...new Set(h.feats.filter(x => FEATS[x]))] : [];
  sanitizeBld(h);
  fixNum(h, 'lvl', 1, 1, MAX_LVL); h.lvl = Math.floor(h.lvl); fixNum(h, 'xp', 0, 0, Math.max(0, xpNext(h.lvl) - 1)); if (h.lvl >= MAX_LVL) h.xp = 0;
  if (!h.eq || typeof h.eq !== 'object') h.eq = d.hero.eq;
  for (const k of Object.keys(h.eq)) if (!EQ_KEYS.includes(k)) delete h.eq[k];
  for (const sl of EQ_KEYS) { const it = h.eq[sl]; if (!it || !itemFitsKey(it, sl) || !validItem(it, it.slot)) h.eq[sl] = null; else sanitizeItem(it); }
  if (h.eq.offhand && h.eq.offhand.slot === 'weapon' && h.cls !== 'rogue') h.eq.offhand = null;
  if (!h.eq.weapon) h.eq.weapon = starterItem('weapon', CLASSES[h.cls].wpn);
  if (!h.eq.armor) h.eq.armor = starterItem('armor', CLASSES[h.cls].arm);
  if (h.eq.weapon.h2 && h.eq.offhand) { if (!Array.isArray(h.inv)) h.inv = []; h.inv.push(h.eq.offhand); h.eq.offhand = null; }
  h.inv = Array.isArray(h.inv) ? h.inv.filter(i => i && typeof i.n === 'string' && (i.slot ? validItem(i, i.slot) : true)).map(i => i.slot ? sanitizeItem(i) : { n: i.n, v: isNum(i.v) ? Math.max(0, i.v) : 3 }).slice(-16) : [];
  fixNum(h, 'gold', 0, 0); h.gold = Math.floor(h.gold); fixNum(h, 'potions', 0, 0, 20); h.potions = Math.floor(h.potions); fixNum(h, 'trust', 40, 0, 100);
  fixNum(h, 'deadT', 0, 0, PACE.dead); fixNum(h, 'townStep', 0, 0, 5); fixNum(h, 'restT', 0, 0, 10); fixNum(h, 'shortRests', 2, 0, 2); fixNum(h, 'orcCd', 0, 0, 10800);
  if (!h.quest || typeof h.quest.n !== 'string') h.quest = newQuest(); fixNum(h.quest, 'p', 0, 0, 99);
  if (typeof h.loc !== 'string') h.loc = 'Годград';
  if (!HERO_STATES.includes(h.state)) h.state = 'road';
  fixNum(f, 'fol', 0, 0); fixNum(f, 'temple', 0, 0, 10); f.temple = Math.floor(f.temple); fixNum(f, 'templeProg', 0, 0); fixNum(f, 'army', 0, 0); f.army = Math.floor(f.army);
  h.inj = Array.isArray(h.inj) ? h.inj.filter(j => j && STATS.includes(j.s) && INJURIES[j.k] && isNum(j.t) && j.t > 0).map(j => ({ k: j.k, s: j.s, t: Math.min(j.t, INJURIES[j.k].t), n: INJ_TEXT[j.s] })).slice(-4) : [];
  // HP после пересчёта (максимум зависит от класса/ТЕЛ/черт)
  const oldMax = h.maxHp; h.maxHp = calcMaxHp(h);
  if (isNum(h._hpFrac)) { h.hp = Math.round(h.maxHp * h._hpFrac); delete h._hpFrac; }
  fixNum(h, 'hp', h.maxHp, 0, h.maxHp); h.hp = Math.round(h.hp);
  if (h.state === 'dead' && h.hp > 0) h.state = 'road';
  if (h.state !== 'dead' && h.hp <= 0) h.hp = 1;
  if (h.state === 'dead') h.hp = 0;
  if (h.monster && !(isNum(h.monster.hp) && isNum(h.monster.ac) && typeof h.monster.n === 'string')) h.monster = null;
  if (h.state === 'fight' && !h.monster) h.state = 'road';
  if (h.state !== 'fight') h.monster = null;
  if (h.state === 'rest' && h.restT <= 0) h.state = 'road';
  if (!o.buffs || typeof o.buffs !== 'object') o.buffs = {};
  for (const k in d.buffs) fixNum(o.buffs, k, 0, 0, 3600);
  if (!o.timers || typeof o.timers !== 'object') o.timers = d.timers;
  for (const k in d.timers) fixNum(o.timers, k, d.timers[k], -1, 100000);
  fixNum(g, 'faith', 0, 0, 100 + (g.lvl - 1) * 15 + f.temple * 20);
  if (![1, 2, 5, 10].includes(o.speed)) o.speed = 1;
  o.paused = !!o.paused;
  if (!['powers', 'flock', 'arena', 'gods'].includes(o.tab)) o.tab = 'powers';
  if (!o.ui || typeof o.ui !== 'object' || Array.isArray(o.ui)) o.ui = { mtab: 'hero' };
  if (!['hero', 'diary', 'powers', 'arena', 'more'].includes(o.ui.mtab)) o.ui.mtab = 'hero';
  if (!isNum(o.lastSeen)) o.lastSeen = Date.now();
  o.forkHist = Array.isArray(o.forkHist) ? o.forkHist.filter(i => isNum(i) && FORKS[i]) : [];
  o.momHist = Array.isArray(o.momHist) ? o.momHist.filter(i => typeof i === 'string' && MOM_BY[i]).slice(-MOM_HIST) : [];
  if (o.fork && o.fork.m !== undefined) {
    const F = o.fork;
    if (!(typeof F.m === 'string' && MOM_BY[F.m] && typeof F.txt === 'string' && isNum(F.t))) o.fork = null;
    else { o.fork = { m: F.m, txt: F.txt.slice(0, 400), t: clamp(F.t, 1, MOM_T), T: MOM_T, v: { m: F.v && typeof F.v.m === 'string' ? F.v.m.slice(0, 60) : 'противник' } }; }
  } else {
    if (o.fork && !(isNum(o.fork.i) && FORKS[o.fork.i] && isNum(o.fork.t))) o.fork = null;
    if (o.fork) o.fork = { i: o.fork.i, T: MOM_T, t: clamp(o.fork.t, 1, MOM_T), cls: !!o.fork.cls };
  }
  o.fightAuto = !!o.fightAuto;
  sanitizeArena(o, h);
  if (o.fight && !validFight(o.fight)) o.fight = null;
  if (o.dun && !validDun(o.dun)) o.dun = null;
  if (o.dun && o.dun.phase === 'end' && !o.dun.result) o.dun = null;
  const FK = o.fight && o.fight.phase !== 'end' ? o.fight.kind : null;
  if (FK === 'dungeon' && !o.dun) o.fight = null;
  if (FK === 'monster' && !(h.state === 'fight' && h.monster)) o.fight = null;
  if (o.dun && o.dun.phase === 'fight' && !(o.fight && o.fight.kind === 'dungeon')) o.dun.phase = 'explore';
  if (o.fight && ['duel', 'group', 'chaos', 'godduel'].includes(o.fight.kind) && o.fight.phase !== 'end') { if (o.dun) o.fight = null; else { h.state = 'duel'; h.monster = null; } }
  if (o.dun && o.dun.phase !== 'end') { h.state = h.state === 'dead' ? (h.hp = 1, 'dungeon') : 'dungeon'; h.monster = null; }
  if (h.state === 'duel' && !(o.fight && o.fight.phase !== 'end')) h.state = 'road';
  if (!o.dun && h.state === 'dungeon') h.state = 'road';
  if (o.fork && h.state === 'dead') o.fork = null;
  const E = o.ev;
  if (E && !(WEVENTS.find(e => e.id === E.id) && ['live', 'done'].includes(E.phase) && E.my && Array.isArray(E.parts))) {
    if (E && E.my && isNum(E.my.army)) f.army += E.my.army;
    o.ev = null;
  }
  if (o.ev) { fixNum(o.ev, 't', 1, 0, 60); fixNum(o.ev, 'thr', 100, 1); fixNum(o.ev.my, 'power', 0, 0); fixNum(o.ev.my, 'army', 0, 0); if (!o.ev.ai) o.ev.ai = {}; if (o.ev.phase === 'done' && !o.ev.result) o.ev = null; }
  if (o.featOffer && !(Array.isArray(o.featOffer.opts) && o.featOffer.opts.every(x => FEATS[x]) && isNum(o.featOffer.t))) o.featOffer = null;
  if (o.featOffer) { o.featOffer.opts = o.featOffer.opts.filter(x => !h.feats.includes(x)); o.featOffer.asi = !!o.featOffer.asi; const P = o.featOffer.pref; o.featOffer.pref = P && ((P.feat && FEATS[P.feat] && !h.feats.includes(P.feat)) || (P.asi && STATS.includes(P.asi))) ? (P.feat ? { feat: P.feat } : { asi: P.asi }) : null; }
  fixNum(o, 'featQueue', 0, 0, 10); o.featQueue = Math.floor(o.featQueue);
  if (!Array.isArray(o.rivals)) o.rivals = d.rivals;
  o.rivals = o.rivals.filter(r => r && RIVALS_BASE.find(b => b.id === r.id));
  for (const r of o.rivals) if (!BUILDS[r.bld]) r.bld = bldForBot(r.cls, r.race);
  for (const b of RIVALS_BASE) if (!o.rivals.find(r => r.id === b.id)) o.rivals.push(Object.assign({ w: 0, l: 0, army: 0, hlvl: 1 }, b));
  for (const r of o.rivals) { const b = RIVALS_BASE.find(x => x.id === r.id); Object.assign(r, { name: b.name, hero: b.hero, pers: b.pers, race: b.race, cls: b.cls }); fixNum(r, 'lvl', b.lvl, 1, 99); fixNum(r, 'hlvl', 1, 1, MAX_LVL); fixNum(r, 'w', 0, 0); fixNum(r, 'l', 0, 0); fixNum(r, 'army', 0, 0); }
  o.diary = Array.isArray(o.diary) ? o.diary.filter(e => e && typeof e.x === 'string').slice(0, 150) : [];
  if (!o.stats || typeof o.stats !== 'object') o.stats = {};
  for (const k in d.stats) fixNum(o.stats, k, 0, 0);
  return o;
}
function load() {
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
  try {
    const o = JSON.parse(raw); if (!o || !o.god || !o.hero) throw new Error('bad save');
    const m = migrate(o);
    return sanitize(deepMerge(defaultState(m.god.name, m.hero.name, m.hero.race, m.hero.cls), m));
  } catch (e) {
    console.warn('Сохранение повреждено, копия сохранена в', SAVE_KEY + '_backup', e);
    try { localStorage.setItem(SAVE_KEY + '_backup', raw); } catch (e2) { }
    return null;
  }
}

/* =====================================================================
   4) СЛОЙ СОПЕРНИКОВ
   Вся «чужая воля» (другие боги) идёт только через этот интерфейс.
   Сейчас его реализует LocalAIProvider (ИИ в браузере). Для настоящего
   мультиплеера достаточно написать NetworkRivalProvider с теми же методами
   (WebSocket/HTTP) и заменить строку `const rivals = new LocalAIProvider(...)`.
   ===================================================================== */
class RivalProvider {
  listGods() { throw new Error('not implemented'); }
  /** Подбор соперника для дуэли. @returns {Promise<{godId,god,hero,pers,lvl,heroLvl,race,cls,army}>} */
  findOpponent(player) { throw new Error('not implemented'); }
  /** План соперника на раунд дуэли. @returns {Promise<Array<{at,act}>>} */
  planRound(view) { throw new Error('not implemented'); }
  react(view, myAct) { return null; }
  reportDuel(result) { }
  /** Мировое событие. @returns {Promise<{parts, ai, expected}>} */
  joinEvent(ev) { throw new Error('not implemented'); }
  eventUpdates(ev, dt) { return []; }
  /** Собрать отряд для подземелья. @returns {Promise<Array<{godId,god,hero,race,cls,lvl,pers}>>} */
  formParty(player) { throw new Error('not implemented'); }
  /** Решения других богов в комнате подземелья. @returns {Promise<Array<{godId, vote?, act?, at}>>} */
  dungeonDecide(view) { throw new Error('not implemented'); }
  reportDungeon(result) { }
}

const DUEL_COST = { bolt: 20, heal: 15, shield: 25, curse: 18, quake: 45, beast: 35, bless: 20, luck: 22, rain: 12 };
const AI_W = {
  aggr: { bolt: 5, quake: 3, curse: 1, beast: 2, bless: 2, heal: 1 },
  heal: { heal: 4, rain: 3, shield: 2, bolt: 2, bless: 1 },
  trick: { curse: 4, luck: 3, beast: 2, bolt: 2, rain: 1 },
  def: { shield: 4, heal: 2, bolt: 2, rain: 1, curse: 1 }
};
class LocalAIProvider extends RivalProvider {
  constructor(getState) { super(); this.st = getState; }
  listGods() { return this.st().rivals; }
  _hero(g, heroLvl) { return { godId: g.id, god: g.name, hero: g.hero, pers: g.pers, lvl: g.lvl, race: g.race, cls: g.cls, bld: g.bld, heroLvl: clamp(heroLvl + rnd(-1, 1), 1, MAX_LVL), army: g.army }; }
  findOpponent(player) {
    const gods = this.st().rivals.slice().sort((a, b) => Math.abs(a.lvl - player.godLvl) - Math.abs(b.lvl - player.godLvl));
    const g = player.godId ? this.st().rivals.find(x => x.id === player.godId) || pick(gods.slice(0, 4)) : pick(gods.slice(0, 4));
    return new Promise(res => setTimeout(() => res(this._hero(g, player.heroLvl)), 30));
  }
  _choose(pers, view, budget) {
    const w = Object.assign({}, AI_W[pers]);
    const hpR = view.self.hp / view.self.max;
    if (hpR < .4) { w.heal = (w.heal || 0) + 5; w.shield = (w.shield || 0) + 2; w.rain = (w.rain || 0) + 1; }
    if (view.selfCursed) w.rain = (w.rain || 0) + 4;
    if (view.lvl < 5) delete w.quake;
    const opts = Object.keys(w).filter(k => DUEL_COST[k] <= budget && w[k] > 0);
    if (!opts.length) return null;
    let sum = opts.reduce((s, k) => s + w[k], 0), r = R() * sum;
    for (const k of opts) { r -= w[k]; if (r <= 0) return k; }
    return opts[0];
  }
  planRound(view) {
    const plan = []; let budget = view.faith;
    const n = R() < .45 ? 2 : (R() < .85 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = this._choose(view.pers, view, budget); if (!a) break;
      budget -= DUEL_COST[a]; plan.push({ at: 1 + R() * (view.roundT - 3), act: a });
    }
    return new Promise(res => setTimeout(() => res(plan), 30));
  }
  react(view, myAct) {
    if ((myAct === 'bolt' || myAct === 'quake' || myAct === 'beast') && (view.pers === 'def' || view.pers === 'heal') && R() < .4 && view.faith >= DUEL_COST.shield)
      return { at: view.elapsed + 1 + R() * 2, act: 'shield' };
    if (myAct === 'shield' && view.pers === 'trick' && R() < .35 && view.faith >= DUEL_COST.curse)
      return { at: view.elapsed + 1, act: 'curse' };
    return null;
  }
  reportDuel(res) { const g = this.st().rivals.find(x => x.id === res.godId); if (g) { if (res.playerWon) g.l++; else g.w++; } }
  joinEvent(ev) {
    const def = WEVENTS.find(e => e.id === ev.id);
    const ai = {}, parts = [];
    let expected = 0;
    for (const g of this.st().rivals) {
      if (R() < .15) continue;
      const budget = 25 + g.lvl * 9 + rnd(0, 30);
      const prefs = { aggr: 0, def: 1, heal: 1, trick: 2 };
      const pref = R() < .6 ? prefs[g.pers] : rnd(0, def.o.length - 1);
      ai[g.id] = { budget, left: budget, voteAt: 2 + R() * 14, pref };
      parts.push({ id: g.id, name: g.name, pers: g.pers, vote: null, power: 0 });
      expected += budget;
    }
    return Promise.resolve({ parts, ai, expected });
  }
  eventUpdates(ev, dt) {
    const out = [], el = ev.T - ev.t;
    for (const p of ev.parts) {
      const a = ev.ai[p.id]; if (!a) continue;
      const u = { id: p.id };
      if (p.vote === null && el >= a.voteAt) u.vote = a.pref;
      if (el > a.voteAt && a.left > 0 && R() < dt * .45) { const add = Math.min(a.left, rnd(5, 18)); a.left -= add; u.add = add; }
      if (u.vote !== undefined || u.add) out.push(u);
    }
    return out;
  }
  formParty(player) {
    const n = R() < .5 ? 2 : 3;
    const pool = this.st().rivals.slice().sort(() => R() - .5).slice(0, n);
    return new Promise(res => setTimeout(() => res(pool.map(g => this._hero(g, player.heroLvl))), 30));
  }
  dungeonDecide(view) {
    // view: { type, opts:[{l,s,cls,split}], party:[{godId,cls,pers,isMe}], roomT }
    const out = [];
    for (const m of view.party) {
      if (m.isMe) continue;
      const sc = view.opts.map((o, i) => {
        let v = R() * 2;
        if (o.cls && o.cls.includes(m.cls)) v += 5;
        if (o.cls && view.party.some(p => o.cls.includes(p.cls))) v += 2;
        if (m.pers === 'aggr' && (o.s === 'str' || o.split === 'greedy')) v += 2;
        if (m.pers === 'heal' && (o.s === 'wis' || o.split === 'temple')) v += 2;
        if (m.pers === 'trick' && (o.s === 'dex' || o.split === 'greedy')) v += 2;
        if (m.pers === 'def' && (o.s === 'con' || o.s === 'wis' || o.split === 'fair')) v += 2;
        return v;
      });
      const vote = sc.indexOf(Math.max(...sc));
      out.push({ godId: m.godId, vote, at: 1 + R() * (view.roundT * .6) });
      if (R() < .55) {
        const acts = view.type === 'treasure' || view.type === 'path' ? [] : m.pers === 'heal' ? ['heal', 'bless'] : m.pers === 'aggr' ? ['bolt', 'bless'] : m.pers === 'def' ? ['shield', 'heal'] : ['luck', 'curse'];
        if (acts.length) out.push({ godId: m.godId, act: pick(acts), at: 2 + R() * (view.roundT * .7) });
      }
    }
    return new Promise(res => setTimeout(() => res(out), 30));
  }
  reportDungeon(res) { for (const id of res.godIds || []) { const g = this.st().rivals.find(x => x.id === id); if (g && res.ok && R() < .5) g.lvl = Math.min(g.lvl + 1, this.st().god.lvl + 3); } }
}
const rivals = new LocalAIProvider(() => S);

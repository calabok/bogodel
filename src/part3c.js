
/* =====================================================================
   6) ОБЩЕЕ ДЛЯ БОЁВ (старая дуэль заменена боем по зонам — см. раздел 12)
   ===================================================================== */
const DUEL_NAMES = { bolt: '⚡ Молния', heal: '✚ Исцеление', shield: '🛡 Щит', curse: '☠ Проклятие', quake: '🌋 Землетрясение', beast: '🐻 Зверь', bless: '✨ Благословение', luck: '🍀 Удача', rain: '🌧 Ливень' };
let duelPending = false;
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
   9) ГЛАВНЫЙ ЦИКЛ И ОФЛАЙН
   ===================================================================== */
let saveAcc = 0;
const rspan = a => a[0] + R() * (a[1] - a[0]);
function syncGuards() {
  const h = S.hero;
  const F = S.fight, fk = F && F.phase !== 'end' ? F.kind : null;
  if (fk && ARENA_KINDS.includes(fk)) h.state = 'duel';
  if (fk === 'monster' && !(h.state === 'fight' && h.monster)) S.fight = null;
  if (fk === 'dungeon' && !S.dun) S.fight = null;
  if (S.dun && S.dun.phase !== 'end') h.state = h.state === 'dead' ? 'dead' : 'dungeon';
  if (h.state === 'duel' && !(S.fight && ARENA_KINDS.includes(S.fight.kind)) && !duelPending) h.state = 'road';
  if (h.state === 'dungeon' && !S.dun && !dunPending) h.state = 'road';
  if (h.state === 'fight' && !h.monster) h.state = 'road';
  if (h.monster && h.state !== 'fight') h.monster = null;
  if (h.state === 'rest' && h.restT <= 0) h.state = 'road';
  if (S.fork && h.state === 'dead') S.fork = null; // в бою/пещере момент не сбрасывается — ждёт (forkPaused)
}
function passiveTick(gdt) {
  const h = S.hero;
  addFaith(faithRegen() * gdt); momClock += gdt;
  S.flock.fol += (S.flock.temple * 0.00014 + (S.god.align > 40 ? 0.0001 : 0)) * gdt;
  for (const k in S.buffs) if (S.buffs[k] > 0) S.buffs[k] = Math.max(0, S.buffs[k] - gdt);
  if (h.orcCd > 0) h.orcCd = Math.max(0, h.orcCd - gdt);
  if (h.state === 'dead') { h.deadT -= gdt; if (h.deadT <= 0) resurrect(false); }
  if (S.featOffer) { if (!SILENT) { S.featOffer.t -= gdt; if (S.featOffer.t <= 0) heroPicksFeat(); } } // офлайн черты ждут бога
  else if (S.featQueue > 0) offerFeat();
  if (S.timers.dunCd > 0) S.timers.dunCd = Math.max(0, S.timers.dunCd - gdt);
  bldTick(gdt);
  if (h.inj.length) { for (const j of h.inj) j.t -= gdt; const n = h.inj.length; h.inj = h.inj.filter(j => j.t > 0); if (h.inj.length !== n) { recalcHp(); diary('🩹 Травма зажила. Снова как новенький (почти).', 'level'); } }
  olyTick(gdt);
  S.timers.rivals -= gdt;
  if (S.timers.rivals <= 0) { S.timers.rivals = PACE.rivals; const r = pick(S.rivals); if (r.lvl < S.god.lvl + 2 && R() < .5) r.lvl++; r.hlvl = clamp(h.lvl + rnd(-1, 1), 1, MAX_LVL); if (R() < .5) r.army += rnd(0, 2); }
}
function step(realDt) {
  const gdt = realDt * S.speed;               // игровое время
  const idt = realDt * Math.min(S.speed, 2);   // время на решения игрока (ускоряется максимум ×2)
  const h = S.hero;
  syncGuards();
  passiveTick(gdt);
  if (!S.fight && !S.dun) { S.timers.hero -= gdt; if (S.timers.hero <= 0) { heroStep(); S.timers.hero = rspan(PACE.step); } }
  // момент/развилка: герой живёт дальше, пока бог думает; в бою/пещере карточка ждёт, таймер стоит
  // таймер считает «от начала до начала» (5–10 мин при ×1), но после ответа даём минимум 2 мин тишины
  if (!forkPaused()) {
    if (S.fork) { S.fork.t -= idt; if (S.fork.t <= 0) timeoutFork(); if (!S.fork) S.timers.fork = Math.max(S.timers.fork, 120); }
    S.timers.fork -= gdt;
    if (!S.fork && S.timers.fork <= 0 && (h.state === 'road' || h.state === 'town' || h.state === 'rest')) { if (startFork() !== false) S.timers.fork = rspan(PACE.fork); else S.timers.fork = 30; }
  }
  if (S.fight) fightTick(realDt); // решения в бою — в реальном времени: на ×2–×10 таймер не сжимается
  else if (!S.dun && !dunPending) { S.timers.duel -= gdt; if (S.timers.duel <= 0 && h.state === 'road' && !S.arena.apps.some(a => a.joined !== null)) { S.timers.duel = rspan(PACE.duel); startGodDuel(); } }
  if (S.dun) dunTick(idt);
  else if (!S.fight && !duelPending) { S.timers.dun -= gdt; if (S.timers.dun <= 0 && h.state === 'road' && S.timers.dunCd <= 0) { if (h.hp < h.maxHp * .7) S.timers.dun = 120; else { S.timers.dun = rspan(PACE.dun); startDungeon(false); } } }
  if (S.ev) evTick(idt);
  else { S.timers.event -= gdt; if (S.timers.event <= 0) { S.timers.event = rspan(PACE.event); startEvent(); } }
  arenaStep(idt);
  chat.tick(idt);
  saveAcc += realDt; if (saveAcc > 5) { saveAcc = 0; save(); }
}
function olyAway(o0, seasons) {
  const o1 = olySnap(), lost = o0.regs.filter(x => !o1.regs.includes(x)), got = o1.regs.filter(x => !o0.regs.includes(x));
  return { r0: o0.rank, r1: o1.rank, n0: o0.regs.length, n1: o1.regs.length, lost: seasons.length ? [] : lost, got: seasons.length ? [] : got, seasons, n: o1.n, inf: o1.inf };
}
function fmtDur(sec) { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h} ч ${m} мин` : `${m} мин`; }
/* Офлайн-симуляция: герой живёт сам (75% темпа), развилки решает сам, итог — сжатая сводка в дневнике */
function simulateAway(sec, why) {
  if (!(sec >= 60)) return null;
  const h = S.hero, cap = Math.min(sec, PACE.offCap);
  if (S.dun) dunAutoFinish();
  if (S.fight) autoResolveBattle(S.fight);
  S.arena.apps = S.arena.apps.filter(a => a.joined === null && !a.mine);
  if (S.ev && S.ev.phase === 'live') resolveEvent();
  if (S.ev) S.ev = null;
  const c = { wins: 0, deaths: 0, quests: 0, forks: 0, lvls: 0, items: [] };
  const g0 = h.gold, f0 = Math.floor(S.flock.fol), l0 = h.lvl, fa0 = S.god.faith;
  const base = Date.now() - sec * 1000, o0 = S.oly ? olySnap() : null;
  SILENT = { buf: [], c }; OLY_NOW = base;
  let buf;
  try {
    if (S.fork) timeoutFork(true);
    const stepDt = ((PACE.step[0] + PACE.step[1]) / 2) / PACE.offEff;
    let t = 0, forkT = Math.max(PACE.forkOff[0] / 2, S.timers.fork);
    while (t < cap) {
      t += stepDt; OLY_NOW = base + t * 1000;
      syncGuards();
      passiveTick(stepDt);
      forkT -= stepDt;
      if (forkT <= 0 && (h.state === 'road' || h.state === 'town')) { if (startFork() !== false && S.fork) timeoutFork(true); forkT = rspan(PACE.forkOff); }
      heroStep();
    }
    if (sec > cap) olyFastForward(sec - cap); // герой спит, а мир живёт дальше: боги-соперники, храмы, конец сезона
    S.timers.fork = Math.min(PACE.fork[1], Math.max(60, forkT));
    S.timers.hero = Math.min(S.timers.hero, 5);
  } finally { buf = SILENT.buf; SILENT = null; OLY_NOW = null; }
  // яркие моменты: уровни, черты, редкие вещи, смерти + пара смешных развилок
  const pri = buf.filter(e => ['level', 'rare', 'death'].includes(e.c) || (e.c === 'oly' && /^(🏛|💔|👑|⚡|🔥 Сезон|🌊|🌾|🍷|🥟)/.test(e.x)));
  const forks = buf.filter(e => e.c === 'fork' && !/^(🙏|✨)/.test(e.x)).sort(() => R() - .5).slice(0, 2);
  const hl = pri.slice(-8).concat(forks);
  for (const e of hl.reverse()) { e.x = '⏳ ' + e.x; S.diary.unshift(e); }
  const gd = h.gold - g0, fd = Math.floor(S.flock.fol) - f0;
  diary(`📖 Пока вас не было (${fmtDur(cap)}${sec > cap ? ', дальше герой спал' : ''})${why ? ' — ' + why : ''}: побед в боях ${c.wins}, смертей ${c.deaths}, заданий ${c.quests}, развилок решил сам ${c.forks}. Золото ${gd >= 0 ? '+' : ''}${gd}, паства ${fd >= 0 ? '+' : ''}${fd}, вера ${Math.floor(fa0)} → ${Math.floor(S.god.faith)}.${h.lvl > l0 ? ` Уровень ${l0} → ${h.lvl}!` : ''}${c.items.length ? ' Ценные находки: ' + c.items.slice(0, 4).join(', ') + '.' : ''}`, 'event');
  if (S.diary.length > 150) S.diary.length = 150;
  diaryVer++;
  /* v11: сводка для отдельной карточки «Пока вас не было» */
  lastAway = { sec: cap, slept: sec > cap, why: why || '', wins: c.wins, deaths: c.deaths, quests: c.quests, forks: c.forks, gold: gd, fol: fd, fa0: Math.floor(fa0), fa1: Math.floor(S.god.faith), l0, l1: h.lvl, items: c.items.slice(0, 6), hl: hl.slice(0, 6).map(e => ({ x: e.x.replace(/^⏳ /, ''), c: e.c })), oly: o0 ? olyAway(o0, c.seasons || []) : null };
  return c;
}
let lastAway = null;
function offlineCatchUp() {
  const sec = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (sec >= 60 && simulateAway(sec) && typeof awayModal === 'function' && typeof document !== 'undefined') awayModal();
  if (S._migratedV3) {
    const m = S._migratedV3; delete S._migratedV3;
    diary(`✨ Мир обновился! Теперь я — ${RACES[m.race].n.toLowerCase()}-${CLASSES[m.cls].n.toLowerCase()}. Память слегка подтёрлась: был ${m.oldL}-го уровня, теперь ${m.newL}-го, зато с характеристиками и чертами. Боги говорят, так честнее.`, 'level');
  }
  if (S._migratedV10) { delete S._migratedV10; diary('🏛 Обновление мира: началась «Война за Олимп»! Мир поделён на 14 регионов, и боги-соперники обращают в них души. Регион принадлежит богу с самой большой паствой и даёт веру и бонус. Через 4 недели топ-7 богов займут троны Олимпа. Карта и таблица — во вкладке «🏛 Олимп».', 'oly'); }
  if (S._migratedV8) { delete S._migratedV8; const id = bldId(S.hero); diary(`🧭 Обновление мира: герои теперь сами выбирают путь. Посмотрев на свои мускулы и рюкзак, ${S.hero.name} решил, что он — ${bldName(id)}. Посоветовать другой путь можно в «📋 Герой».`, 'rare'); }
  if (S._migratedV7) { delete S._migratedV7; diary(`🧥 Обновление мира: у героя теперь 10 слотов — шлем, перчатки, сапоги, пояс, щит и второе кольцо. Новые слоты пока пусты; у вещей появились требования, 9 комплектов и 15 легендарок. Старое снаряжение на месте.`, 'rare'); }
  if (S._migratedV6) { delete S._migratedV6; diary(`⚒ Обновление мира: у снаряжения появилась сила — ⚔ ГС (сейчас ${gearScore(S.hero)}). Подземелья теперь трёх сложностей с рекомендуемым ГС: недобор — монстры злее, перебор — легче. Огонь, вампиризм, шипы и серебро работают в бою, у боссов есть слабости. Кузнец в городе точит вещи за золото.`, 'level'); }
  if (S._migratedV5) { delete S._migratedV5; diary('✨ Обновление мира: пещеры стали опаснее (элитные логова, один источник, боссы бьют по объявленной зоне — блокируйте её!), зато добыча богаче. Интерфейс стал спокойнее: подробности героя — по кнопке «📋 Герой».', 'level'); }
  if (S._migratedV4) { delete S._migratedV4; diary('✨ В мир пришла Арена! Теперь бои идут по зонам (голова, грудь, живот, пояс, ноги), а в пещерах есть карта, ключи и боссы. Заглядывайте во вкладку «Арена» и в чат.', 'level'); }
}

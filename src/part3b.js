
/* =====================================================================
   5) ПРАВИЛА: вера, характеристики, предметы, бой, жизнь героя
   ===================================================================== */
const maxFaith = () => 100 + (S.god.lvl - 1) * 15 + S.flock.temple * 20;
const faithRegen = () => 0.02 + 0.004 * Math.sqrt(Math.max(0, S.flock.fol)) + S.flock.temple * 0.006 + eqCount('faith') * 0.005;
const templeCost = () => Math.round(150 * Math.pow(S.flock.temple + 1, 1.6));
const soldierCost = () => S.god.align <= -30 ? 10 : 15;
const obeyChance = () => clamp(0.45 + S.hero.trust * 0.0055, 0.3, 1);
function alignTitle(a) { return a >= 60 ? 'Всеблагой' : a >= 25 ? 'Добрый' : a > -25 ? 'Себе на уме' : a > -60 ? 'Суровый' : 'Гневный'; }
function trustLabel(t) { return t < 20 ? 'считает вас выдумкой' : t < 40 ? 'сомневается в вас' : t < 60 ? 'прислушивается' : t < 80 ? 'уважает' : 'фанатично предан'; }
function powerCost(id) {
  const p = POWERS[id]; let c = p.cost; const a = S.god.align;
  if (a >= 30) { if (p.br === 'light') c *= .8; if (p.br === 'wrath') c *= 1.2; }
  if (a <= -30) { if (p.br === 'wrath') c *= .8; if (p.br === 'light') c *= 1.2; }
  return Math.round(c);
}
const pmult = id => 1 + 0.5 * ((S.god.skills[id] || 1) - 1);
function tx(t, d) {
  d = d || {};
  return t.replace(/\{(\w+)\}/g, (m, k) => d[k] !== undefined ? d[k] :
    k === 'god' ? S.god.name : k === 'hero' ? S.hero.name : k === 'place' ? pick(PLACES) : k === 'town' ? pick(TOWNS) : k === 'food' ? pick(FOODS) : k === 'item' ? pick(ITEMS) : m);
}
function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
function nowStr() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function diary(text, cls, fx) {
  const e = { tm: nowStr(), x: tx(text), c: cls || '', f: fx || '' };
  if (SILENT) { SILENT.buf.push(e); if (SILENT.buf.length > 400) SILENT.buf.splice(0, 100); return; }
  S.diary.unshift(e);
  if (S.diary.length > 150) S.diary.length = 150;
  diaryVer++;
}
function toast(msg) {
  if (SILENT || typeof document === 'undefined') return;
  if (/вер/i.test(msg)) { const fm = $('faithMeter'); if (fm) { fm.classList.remove('flash'); void fm.offsetWidth; fm.classList.add('flash'); } }
  const box = $('toasts'), lim = innerWidth <= 760 ? 2 : 4;
  for (const c of Array.from(box.children)) if (c.textContent === msg) c.remove();
  while (box.children.length >= lim) box.firstChild.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  box.appendChild(el); setTimeout(() => el.remove(), innerWidth <= 760 ? 3200 : 4200);
}
function addFaith(v) { S.god.faith = clamp(S.god.faith + v, 0, maxFaith()); }
function addTrust(v) { if (v > 0) v *= (hasFeat('devout') ? 1.5 : 1) * (S.hero.cls === 'cleric' ? 1.2 : 1); S.hero.trust = clamp(Math.round((S.hero.trust + v) * 10) / 10, 0, 100); }
function shiftAlign(v) { S.god.align = clamp(S.god.align + v, -100, 100); }
function addGxp(v) {
  const g = S.god; g.xp += Math.round(v);
  while (g.xp >= gxpNext(g.lvl)) {
    g.xp -= gxpNext(g.lvl); g.lvl++; g.sp++; addFaith(maxFaith() * .3);
    diary(`🌟 Мой бог стал могущественнее! (Уровень бога ${g.lvl})`, 'level');
    toast(`Уровень бога ${g.lvl}! +1 очко сил и +30% веры.`);
  }
}

/* ---------- Характеристики ---------- */
const mod = v => Math.floor((v - 10) / 2);
const fmtMod = m => (m >= 0 ? '+' : '') + m;
const hasFeat = id => S.hero.feats.includes(id);
const equipped = (h) => ['weapon', 'armor', 'amulet', 'ring'].map(s => (h || S.hero).eq[s]).filter(Boolean);
const eqCount = k => S && S.hero ? equipped().reduce((n, it) => n + it.props.filter(p => p.k === k).length, 0) : 0;
const eqHas = (k, slot) => slot ? !!(S.hero.eq[slot] && S.hero.eq[slot].props.some(p => p.k === k)) : eqCount(k) > 0;
const curseOn = k => equipped().some(it => it.curse && it.curse.k === k);
const profB = l => 2 + Math.floor((l - 1) / 4);
function statValOf(h, s) {
  let v = h.st[s];
  for (const it of equipped(h)) for (const p of it.props) if (p.k === s) v += p.v || 1;
  if (s === 'cha' && equipped(h).some(it => it.curse && it.curse.k === 'chatty')) v -= 1;
  if (h.inj) for (const j of h.inj) if (j.s === s && INJURIES[j.k]) v -= INJURIES[j.k].pen;
  return clamp(v, 1, 30);
}
const statVal = s => statValOf(S.hero, s);
function calcMaxHp(h) {
  const c = CLASSES[h.cls], cm = mod(statValOf(h, 'con'));
  let hp = 10 + 2 * (c.die + cm) + (h.lvl - 1) * 2 * Math.max(1, c.die / 2 + 1 + cm);
  if (h.race === 'dwarf') hp += h.lvl;
  if (h.feats && h.feats.includes('tough')) hp += 2 * h.lvl;
  hp *= (CLASS_BAL[h.cls] || CLASS_BAL.warrior).h;
  return Math.max(10, Math.round(hp));
}
function recalcHp() { const h = S.hero, old = h.maxHp; h.maxHp = calcMaxHp(h); if (h.state !== 'dead') h.hp = clamp(h.hp + (h.maxHp - old), 1, h.maxHp); }
/* Боевой лист: работает и для героя игрока, и для виртуального героя соперника */
function sheetOf(h, temple) {
  const c = CLASSES[h.cls], w = h.eq.weapon, a = h.eq.armor, feats = h.feats || [];
  const am = mod(statValOf(h, c.atk));
  const atkB = profB(h.lvl) + am + (w ? w.plus : 0) + (feats.includes('wmaster') ? 1 : 0);
  const die = w ? w.die || 4 : 4;
  const dmgB = am + (w ? w.plus : 0) + (feats.includes('wmaster') ? 2 : 0);
  let ac = 10 + (a ? a.ac + a.plus : 0) + Math.min(mod(statValOf(h, 'dex')), 3) + Math.floor((temple || 0) / 2) + (feats.includes('ironskin') ? 1 : 0);
  if (h.cls === 'barbarian') ac += Math.max(0, mod(statValOf(h, 'con')));
  if (equipped(h).some(it => it.curse && it.curse.k === 'clumsy')) ac -= 2;
  const scale = (1 + 0.2 * (h.lvl - 1)) * (CLASS_BAL[h.cls] || CLASS_BAL.warrior).d;
  return { atkB, die, dmgB, ac, scale, avg: Math.max(1, ((die + 1) / 2 + dmgB) * scale) };
}
const sheet = () => sheetOf(S.hero, S.flock.temple);
/* Типичное снаряжение и характеристики героя уровня L (для ботов арены/отряда и эталона монстров) */
const typRar = L => L < 3 ? 0 : L < 7 ? 1 : L < 12 ? 2 : 3;
function virtualHero(race, cls, lvl) {
  const c = CLASSES[cls], st = genStats(cls, race), L = lvl, rar = typRar(L), plus = [0, L >= 5 ? 1 : 0, 1, 2, 3][rar];
  for (let i = 2; i <= L; i++) { st[c.prim] = Math.min(20, st[c.prim] + 1); if (i % 2 === 0) st.con = Math.min(20, st.con + 1); }
  for (let i = 4; i <= L; i += 4) st[c.prim] = Math.min(20, st[c.prim] + 1); // свойства предметов
  const die = Math.max(c.wpn[1], L < 3 ? 6 : L < 8 ? 8 : L < 12 ? 10 : 11);
  const ac = Math.max(c.arm[1], L < 2 ? 1 : L < 4 ? 3 : L < 6 ? 4 : L < 8 ? 5 : L < 12 ? 6 : 7);
  return { race, cls, lvl, st, feats: [], eq: { weapon: { die, plus, props: [] }, armor: { ac, plus, props: [] }, amulet: null, ring: null } };
}
/* Скрытая проверка характеристики (d20 + модификатор + мастерство) */
function check(s, dc, bonus) {
  const h = S.hero; let b = mod(statVal(s)) + (bonus || 0) + eqCount('luck') - (curseOn('hiccup') ? 2 : 0) + (S.buffs.luck > 0 ? 2 : 0);
  if (CLASSES[h.cls].prof.includes(s)) b += profB(h.lvl);
  if (s === 'con' && hasFeat('gourmet')) b += 3; if (s === 'cha' && hasFeat('silver')) b += 3; if (s === 'wis' && hasFeat('sentinel')) b += 3;
  if (s === 'int' && h.race === 'gnome') b += 2;
  let r = rnd(1, 20), ok = r !== 1 && (r === 20 || r + b >= dc), note = '';
  if (!ok && h.race === 'halfling' && R() < .2) { r = rnd(1, 20); ok = r + b >= dc; if (ok) note = ', повезло со второго раза'; }
  if (!ok && hasFeat('lucky') && R() < .25) { r = rnd(1, 20); ok = r + b >= dc; if (ok) note = ', везунчик'; }
  if (!ok && h.cls === 'bard' && R() < .3) { ok = r + b + rnd(1, 6) >= dc; if (ok) note = ', вдохновение барда'; }
  return { ok, note, label: `проверка ${STAT_GEN[s]}: ${ok ? 'успех' : 'провал'}${note}` };
}

/* ---------- Предметы ---------- */
function rollRarity(boost) {
  boost = boost || 0;
  const w = [60, 26, 10, 3.5, .5].map((x, i) => i ? x * (1 + boost * i * .6) : Math.max(5, x - boost * 25));
  let r = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
function itemValue(it, lvl) { return Math.round((5 + lvl * 4) * RARITY[it.rar].mul * (.8 + R() * .4)); }
function makeItem(slot, lvl, rar) {
  const fixedSlot = !!slot;
  slot = slot || pick(['weapon', 'weapon', 'armor', 'armor', 'amulet', 'ring']);
  if (rar === undefined) rar = rollRarity(0);
  if (rar === 4 && R() < .5) {
    const owned = equipped().concat(S.hero.inv).map(i => i.n);
    const L = LEGENDARY.filter(x => !owned.includes(x.n) && (!fixedSlot || x.slot === slot));
    if (L.length) { const t = pick(L); return { id: 'it' + Math.random().toString(36).slice(2, 9), slot: t.slot, base: t.n, n: t.n, rar: 4, plus: 3, die: t.die || 0, ac: t.ac || 0, props: t.props.map(p => Object.assign({}, p)), curse: null, v: Math.round((5 + lvl * 4) * 15), unique: 1 }; }
  }
  const bases = BASES[slot].filter(b => b[2] <= lvl + 1);
  const base = pick(bases.length > 2 ? bases.slice(-4) : bases.length ? bases : BASES[slot]);
  const it = { id: 'it' + Math.random().toString(36).slice(2, 9), slot, base: base[0], n: '', rar, plus: [0, rnd(0, 1), 1, 2, 3][rar],
    die: slot === 'weapon' ? base[1] : 0, ac: slot === 'armor' ? base[1] : 0, props: [], curse: null, v: 0 };
  let np = [0, 1, 1 + (R() < .5 ? 1 : 0), 2, 3][rar]; if ((slot === 'amulet' || slot === 'ring') && np < 1) np = 1;
  const pool = Object.keys(PROP_DEF).filter(k => PROP_DEF[k].slots === 'all' || PROP_DEF[k].slots.split(' ').includes(slot));
  while (it.props.length < np) {
    const k = pick(pool); if (it.props.some(p => p.k === k)) continue;
    it.props.push(STATS.includes(k) ? { k, v: rar >= 3 ? 2 : 1 } : { k });
  }
  if (rar >= 1 && R() < (S.hero.race === 'tiefling' ? .04 : .08)) { it.curse = { k: pick(Object.keys(CURSES)) }; it.plus = Math.min(5, it.plus + 1); }
  it.n = it.base + (it.plus ? ` +${it.plus}` : '') + (it.props[0] ? ' ' + PROP_DEF[it.props[0].k].n : '');
  it.v = itemValue(it, lvl);
  return it;
}
function itemScore(it) {
  if (!it) return -1;
  const props = it.props.reduce((s, p) => s + (STATS.includes(p.k) ? (p.v || 1) : 1.5), 0);
  if (it.slot === 'weapon') return (it.die + 1) / 2 + it.plus * 1.5 + props * 1.2;
  if (it.slot === 'armor') return it.ac + it.plus + props * 1.2;
  return props + it.plus * .5;
}
/* ---------- Сила снаряжения (ГС) ---------- */
function itemGS(it) {
  if (!it) return 0;
  const base = it.slot === 'weapon' ? 4 + ((it.die || 4) - 4) * 1.5 : it.slot === 'armor' ? 4 + (it.ac || 0) * 2 : 2;
  const pr = (it.props || []).reduce((s, p) => s + (STATS.includes(p.k) ? (p.v || 1) * 2 : 3), 0);
  return Math.max(0, Math.round(base + (it.plus || 0) * 4 + (it.rar || 0) * 3 + pr + (it.curse ? 2 : 0)));
}
const gearScore = h => ['weapon', 'armor', 'amulet', 'ring'].reduce((s, sl) => s + itemGS(h.eq[sl]), 0);
/* Типичный ГС героя уровня L — медиана по прогонам реальной прокачки (7 героев × 200 ч, v6), дальше медленный рост к потолку */
const TYP_GS_T = [0, 20, 33, 62, 92, 120, 138, 150, 157, 162];
function typGS(L) { L = clamp(Math.round(L) || 1, 1, MAX_LVL + 5); return L < TYP_GS_T.length ? TYP_GS_T[L] : Math.min(205, 162 + 4 * (L - 9)); }
const recGS = (L, tier) => Math.round(typGS(L) * (DUN_TIERS[tier] || DUN_TIERS.normal).g);
/* Кузнец: +1 к предмету за золото (до +5) */
const smithCap = it => Math.min(5, (it.rar || 0) + 1 + (it.curse ? 1 : 0)); /* редкость решает, сколько выдержит металл; проклятое — на +1 больше */
function smithCost(it) { return it ? Math.round((20 + 10 * S.hero.lvl) * Math.pow((it.plus || 0) + 1, 2) * priceMul()) : 0; }
function smithOk(it) { return !!it && (it.plus || 0) < smithCap(it) && !it.unique; }
function smithUpgrade(sl, auto) {
  const h = S.hero, it = h.eq[sl];
  if (!smithOk(it)) return auto ? false : toast(`Кузнец: «${it ? `больше +${smithCap(it)} этот металл не выдержит` : 'нечего точить'}». Редкие вещи держат больше.`);
  if (!auto && (S.fight || S.dun || ['duel', 'dungeon', 'dead'].includes(h.state))) return toast('Герой сейчас занят — кузнец подождёт.');
  const c = smithCost(it); if (h.gold < c) return auto ? false : toast(`Нужно ${c} 💰.`);
  h.gold -= c; it.plus = (it.plus || 0) + 1;
  it.n = it.n.replace(/ \+\d+/, '').replace(it.base, it.base + ` +${it.plus}`);
  if (sl === 'armor' || sl === 'amulet' || sl === 'ring') recalcHp();
  diary(auto ? `Заглянул к кузнецу: «${it.n}». Стучал молотком час, звенит до сих пор.` : `Бог послал меня к кузнецу. Теперь у меня «${it.n}»!`, 'loot', `−${c} 💰, ГС ${gearScore(h)}`);
  return true;
}
function itemDesc(it) {
  const p = [];
  if (it.slot === 'weapon') p.push(`урон d${it.die}${it.plus ? '+' + it.plus : ''}`);
  if (it.slot === 'armor') p.push(`КД +${it.ac + it.plus}`);
  for (const pr of it.props) p.push(PROP_DEF[pr.k].d.replace('{v}', pr.v || 1));
  if (it.curse) p.push(`☠ проклятие ${CURSES[it.curse.k].n}: ${CURSES[it.curse.k].d}`);
  return p.join(', ');
}
const liftCost = it => 25 + it.rar * 15;
function equip(it, silentNote) {
  const h = S.hero, cur = h.eq[it.slot];
  if (cur && cur.curse) { addItem(it); return false; }
  if (cur && itemScore(it) <= itemScore(cur)) { addItem(it); return false; }
  h.eq[it.slot] = it; if (cur) addItem(cur);
  recalcHp();
  if (it.curse) diary(`Надел «${it.n}». Ой. Кажется, оно проклято: ${CURSES[it.curse.k].d}. И не снимается!`, 'fight');
  else if (!silentNote) diary(`Надел «${it.n}» (${RARITY[it.rar].n}). Чувствую себя модным.`, it.rar >= 2 ? 'rare' : 'loot');
  return true;
}
function liftCurse(slot) {
  const it = S.hero.eq[slot]; if (!it || !it.curse) return;
  const c = liftCost(it); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; const k = it.curse.k; it.curse = null; addTrust(3); addGxp(c / 3); shiftAlign(1); recalcHp();
  diary(`✨ Бог снял с «${it.n}» проклятие ${CURSES[k].n}. Предмет перестал хихикать по ночам.`, 'god', '+3 доверия');
}
function randJunk() { const tier = Math.max(1, Math.round(S.hero.lvl / 2)); return { n: pick(ITEMS), v: rnd(3, 12) * tier }; }
function addItem(it) { if (S.hero.inv.length >= 12) S.hero.inv.shift(); S.hero.inv.push(it || randJunk()); return S.hero.inv[S.hero.inv.length - 1]; }
function lootDrop(boost, source) {
  const it = makeItem(undefined, S.hero.lvl, rollRarity(boost));
  const worn = equip(it, true);
  const rareCls = it.rar >= 2 ? 'rare' : 'loot';
  diary(`${source || 'Нашёл'}: «${it.n}» — ${RARITY[it.rar].n}${worn ? '. Сразу надел!' : '. Положил в рюкзак.'}`, rareCls, itemDesc(it));
  if (worn && it.curse) diary(`Надел и пожалел: проклятие ${CURSES[it.curse.k].n}! ${CURSES[it.curse.k].d}.`, 'fight');
  if (SILENT && it.rar >= 2) SILENT.c.items.push(it.n);
  return it;
}

/* ---------- Опыт, уровни, черты ---------- */
function gainXp(v) {
  const h = S.hero; if (h.lvl >= MAX_LVL) return;
  if (h.race === 'human') v *= 1.1;
  h.xp += Math.round(v);
  while (h.lvl < MAX_LVL && h.xp >= xpNext(h.lvl)) {
    h.xp -= xpNext(h.lvl); h.lvl++;
    const s = R() < .5 ? CLASSES[h.cls].prim : pick(STATS); h.st[s] = Math.min(20, h.st[s] + 1);
    recalcHp(); h.hp = h.maxHp;
    diary(`🎉 Достиг ${h.lvl}-го уровня! ${STAT_RU[s]} +1, здоровья теперь ${h.maxHp}.`, 'level');
    if (SILENT) SILENT.c.lvls++;
    addGxp(15);
    if (h.lvl % 2 === 0) { S.featQueue++; if (!S.featOffer) offerFeat(); }
  }
  if (h.lvl >= MAX_LVL) h.xp = 0;
}
function offerFeat() {
  if (S.featOffer || S.featQueue < 1) return;
  const free = Object.keys(FEATS).filter(f => !S.hero.feats.includes(f)).sort(() => R() - .5).slice(0, 3);
  S.featOffer = { opts: free, t: PACE.feat, asi: false };
  diary('🎖 Чувствую, что вырос над собой. Боже, подскажи, чему научиться?', 'level');
  toast('🎖 Герой выбирает черту — подскажите ему!');
}
function finishFeat() { S.featOffer = null; S.featQueue = Math.max(0, S.featQueue - 1); if (S.featQueue > 0) offerFeat(); }
function chooseFeat(id, byHero) {
  if (!S.featOffer || !FEATS[id] || S.hero.feats.includes(id)) return;
  S.hero.feats.push(id); if (id === 'tough') recalcHp();
  diary(byHero ? `Не дождался совета и выбрал черту «${FEATS[id].n}». ${pick(['Название красивое.', 'Так сказала ромашка.', 'Звучит солидно.'])}` : `По совету бога освоил черту «${FEATS[id].n}»: ${FEATS[id].d}`, 'level');
  if (!byHero) { addTrust(2); addGxp(10); }
  finishFeat();
}
function chooseAsi(s, byHero) {
  if (!S.featOffer || !STATS.includes(s)) return;
  const h = S.hero, before = h.st[s]; h.st[s] = Math.min(20, h.st[s] + 2);
  if (s === 'con') recalcHp();
  diary(byHero ? `Сам решил прокачать ${STAT_RU[s].toLowerCase()}. Зачем — не знаю, но звучит умно. (${before} → ${h.st[s]})` : `По воле бога тренировался до седьмого пота: ${STAT_RU[s]} ${before} → ${h.st[s]}.`, 'level');
  if (!byHero) { addTrust(2); addGxp(10); }
  finishFeat();
}
function heroPicksFeat() {
  if (!S.featOffer) return;
  if (S.featOffer.opts.length && R() < .6) chooseFeat(pick(S.featOffer.opts), true);
  else { const h = S.hero; const low = STATS.slice().sort((a, b) => h.st[a] - h.st[b]); chooseAsi(R() < .5 ? low[0] : CLASSES[h.cls].prim, true); }
}

/* ---------- Эффекты (развилки и пр.) ---------- */
function applyFx(e) {
  const h = S.hero, out = [];
  if (!e) return '';
  const L = h.lvl;
  if (e.gold) {
    let v = Math.round(e.gold * goldScale(L));
    v = v > 0 ? Math.round(v * (S.buffs.luck > 0 ? 1.5 : 1) * (eqHas('gold') ? 1.25 : 1)) : -Math.min(h.gold, -v);
    h.gold += v; if (v) out.push((v > 0 ? '+' : '') + v + ' 💰');
  }
  if (e.xp) { const v = Math.max(1, Math.round(e.xp * xpUnit(L) * .25)); gainXp(v); out.push('+' + v + ' опыта'); }
  if (e.trust) { addTrust(e.trust); out.push((e.trust > 0 ? '+' : '') + e.trust + ' доверия'); }
  if (e.fol) { const v = e.fol > 0 ? e.fol : -Math.min(Math.floor(S.flock.fol), -e.fol); S.flock.fol += v; if (v) out.push((v > 0 ? '+' : '') + v + ' паствы'); }
  if (e.faith) { addFaith(e.faith); out.push('+' + e.faith + ' веры'); }
  if (e.army) { S.flock.army += e.army; out.push('+' + e.army + ' в армию'); }
  if (e.item) { if (R() < .35) { const it = lootDrop(.3, 'Трофей'); out.push('🎒 ' + it.n); } else { const it = addItem(); out.push('🎒 ' + it.n); } }
  if (e.potion) { h.potions += e.potion; out.push('+' + e.potion + ' ' + plural(e.potion, 'зелье', 'зелья', 'зелий')); }
  if (e.maxhp) { h.st.con = Math.min(20, h.st.con + 1); recalcHp(); out.push('Телосложение +1'); }
  if (e.luck) { S.buffs.luck += e.luck * 10; out.push('🍀 удача'); }
  if (e.clearinv) { h.inv = h.inv.filter(i => i.slot); }
  if (e.quest) { out.push('+' + e.quest + '% задания'); questProgress(e.quest); }
  if (e.hp) {
    const v = Math.max(1, Math.round(Math.abs(e.hp) * h.maxHp / 70));
    if (e.hp > 0) { const a = healHero(v); if (a) out.push('+' + a + ' HP'); }
    else { const d = damageHero(v, 'Погиб, принимая решения.'); out.push('−' + d + ' HP'); }
  }
  return out.join(', ');
}
function healHero(v) {
  const h = S.hero; if (h.state === 'dead') return 0;
  if (curseOn('hunger')) v *= .75;
  const a = clamp(Math.round(v), 0, h.maxHp - h.hp); h.hp += a; return a;
}
function damageHero(v, reason) {
  const h = S.hero; if (h.state === 'dead') return 0;
  if (S.buffs.shield > 0) v = Math.ceil(v / 2);
  v = Math.max(0, Math.round(v));
  h.hp -= v;
  if (h.hp <= 0) killHero(reason || 'Не пережил собственной глупости.');
  return v;
}
function questProgress(v) {
  const h = S.hero; h.quest.p += v;
  if (h.quest.p >= 100) {
    const g = Math.round(25 * goldScale(h.lvl)), x = Math.round(xpUnit(h.lvl) * 12);
    h.gold += g; S.flock.fol += 1;
    diary(`🏆 Выполнил задание «${h.quest.n}»! Слава мне и немного богу.`, 'level', `+${g} 💰, +${x} опыта, +1 паствы`);
    if (SILENT) SILENT.c.quests++;
    gainXp(x); addGxp(5);
    if (R() < .2) lootDrop(.6, 'Награда за задание');
    h.quest = newQuest();
    diary(`Взял новое задание: «${h.quest.n}».`);
  }
}
function killHero(reason) {
  const h = S.hero;
  if (h.race === 'orc' && h.orcCd <= 0) { h.hp = 1; h.orcCd = 10800; diary('Должен был умереть, но я ОРК. Орки так просто не умирают. (Неукротимость)', 'level'); return; }
  h.hp = 0; h.state = 'dead'; h.deadT = PACE.dead; h.monster = null; h.restT = 0;
  if (S.fork) S.fork = null;
  const lost = Math.floor(h.gold * .1); h.gold -= lost;
  if (SILENT) SILENT.c.deaths++;
  diary(`💀 ${reason} Лежу, смотрю в небо. Небо смотрит на меня. Жду, вспомнит ли бог.`, 'death', lost ? `−${lost} 💰` : '');
  toast(`${h.name} погиб! Можно воскресить во вкладке героя.`);
}
function resurrect(byGod) {
  const h = S.hero; if (h.state !== 'dead') return;
  if (byGod) {
    if (S.god.faith < 30) return toast('Нужно 30 веры.');
    S.god.faith -= 30; h.hp = Math.round(h.maxHp * .6); addTrust(6); addGxp(10); shiftAlign(2);
    diary('✨ Божественный свет поднял меня из пыли! Я снова жив и бесконечно благодарен своему богу!', 'god', '+6 доверия');
  } else {
    h.hp = Math.round(h.maxHp * .5); addTrust(SILENT ? -1 : -5);
    diary('Воскрес сам, без божьей помощи. Обидно, {god}. Очень обидно.', 'god', SILENT ? '' : '−5 доверия');
  }
  h.state = 'road'; h.shortRests = Math.max(h.shortRests, 1);
}

/* ---------- Бой ---------- */
const ALL_MONSTERS = MONSTERS.concat(MONSTERS_HI);
function startFight() {
  const h = S.hero;
  const tier = clamp(h.lvl + pick([-2, -1, -1, 0, 0, 0, 0, 1]), 1, 22);
  const near = ALL_MONSTERS.filter(m => Math.abs(m[1] - tier) <= 1);
  const name = pick(near.length ? near : ALL_MONSTERS)[0];
  const vet = h.lvl >= 2 && R() < ROAD_K.vet;
  const hp = Math.round((12 + tier * 15) * (1 + .02 * tier) * ROAD_K.hp * (vet ? 1.5 : 1) * (.85 + R() * .3));
  h.monster = { n: vet ? 'Матёрый ' + name.toLowerCase() : name, tier: tier + (vet ? 1 : 0), hp, max: hp, ac: Math.min(21, 10 + Math.ceil(tier / 2) + (vet ? 1 : 0)), atk: 1 + tier + (vet ? 1 : 0),
    dmg: Math.round((tier * 1.9 + 1) * ROAD_K.d * (vet ? 1.2 : 1)), curse: false, hit: 0, healed: 0, vet };
  h.state = 'fight';
  diary(pick(['На пути возник {m}. Выглядит голодным и нечистоплотным.', 'Из кустов выпрыгнуло нечто под названием «{m}»! Я тоже выпрыгнул. Мы оба испугались.',
    'Встретил противника — {m}. Пытался договориться, но тут не понимают по-человечески.', 'Дорогу преградило существо «{m}» и потребовало «кошелёк или жизнь». Выбрал драку.']).split('{m}').join(name), 'fight');
}
const ATTACK_VERB = { warrior: 'рубанул', mage: 'метнул магическую стрелу', rogue: 'ткнул из-за угла', cleric: 'огрел с молитвой', bard: 'высмеял и стукнул лютней', ranger: 'выстрелил', barbarian: 'с рёвом врезал' };
function heroAttack(sh, m, notes) {
  const h = S.hero; let d = 0;
  if (h.cls === 'mage' && R() < .25) { d = Math.round((rnd(1, 6) + rnd(1, 6) + rnd(1, 6) + mod(statVal('int'))) * sh.scale); notes.add('огненный шар'); }
  else {
    const roll = rnd(1, 20);
    if (roll === 20 || (roll !== 1 && roll + sh.atkB >= m.ac)) {
      d = Math.round((rnd(1, sh.die) + sh.dmgB) * sh.scale);
      if (roll === 20 || (eqHas('crit', 'weapon') && R() < .15)) { d *= 2; notes.add('крит'); }
    }
  }
  if (d > 0 && !m.hit) {
    m.hit = 1;
    if (h.cls === 'rogue') { d += Math.round((rnd(1, 6) + rnd(1, 6)) * sh.scale); notes.add('скрытая атака'); }
    if (hasFeat('brawler')) { d *= 2; notes.add('удар драчуна'); }
  }
  if (d > 0 && h.cls === 'barbarian' && h.hp < h.maxHp / 2) { d = Math.round(d * 1.5); notes.add('ярость'); }
  if (d > 0 && (eqHas('fire', 'weapon') || (h.race === 'tiefling' && R() < .2))) { d += Math.round(rnd(1, 6) * sh.scale * .7); notes.add('огонь'); }
  if (d > 0 && eqHas('vamp', 'weapon')) healHero(d * .15);
  return Math.max(0, d);
}
function fightStep() {
  const h = S.hero, m = h.monster, sh = sheet(), notes = new Set();
  let dealt = 0, taken = 0;
  for (let r = 0; r < 2 && m.hp > 0 && h.hp > 0; r++) {
    let d = heroAttack(sh, m, notes);
    if (h.cls === 'ranger' && R() < .3) { const d2 = heroAttack(sh, m, notes); if (d2) { d += d2; notes.add('меткий выстрел'); } }
    m.hp -= d; dealt += d;
    if (m.hp <= 0) break;
    const mr = rnd(1, 20); let md = 0;
    if (mr === 20 || (mr !== 1 && mr + m.atk - (hasFeat('swift') ? 1 : 0) >= sh.ac)) {
      md = Math.round((rnd(1, 6) + m.dmg) * ((CLASS_BAL[h.cls] || {}).r || 1) * (h.lvl <= 2 ? .7 : h.lvl <= 5 ? .85 : 1));
      if (mr === 20) md += rnd(1, 6);
      if (m.curse) md = Math.ceil(md / 2);
      if (S.buffs.shield > 0) md = Math.ceil(md / 2);
      if (hasFeat('ironskin')) md = Math.ceil(md * .9);
      if (eqHas('thorns', 'armor')) m.hp -= Math.ceil(md * .3);
    }
    h.hp -= md; taken += md;
    if (h.hp > 0 && !m.healed && h.hp < h.maxHp * .4 && (h.cls === 'warrior' || h.cls === 'cleric')) {
      m.healed = 1; const a = healHero((rnd(1, 10) + h.lvl) * sh.scale);
      notes.add(h.cls === 'warrior' ? `второе дыхание +${a}` : `исцеляющее слово +${a}`);
    }
  }
  const nt = notes.size ? ` [${[...notes].join(', ')}]` : '';
  diary(dealt ? `${pick(['Я', 'Я храбро', 'Я не глядя'])} ${ATTACK_VERB[h.cls]} — «${m.n}» теряет ${dealt}${nt}. ${taken ? `Получил сдачи: −${taken} HP.` : 'Сдачи не получил!'}`
    : `Промахнулся по противнику «${m.n}»${nt}. ${taken ? `А он — нет: −${taken} HP.` : 'Он тоже промахнулся. Танцуем.'}`, 'fight');
  if (h.hp <= 0) { h.hp = 0; killHero(`Пал в бою с существом «${m.n}».`); if (h.state === 'dead') return; }
  if (m.hp <= 0) return winFight();
  if (h.hp < h.maxHp * .3 && h.potions > 0) { h.potions--; const a = healHero(h.maxHp * .4 * (hasFeat('gourmet') ? 1.5 : 1)); diary('Выпил зелье здоровья. Вкус как у носка, но помогает.', '', `+${a} HP`); }
  else if (h.hp < h.maxHp * .3 && m.hp > m.max * .3 && R() < .55 + .05 * mod(statVal('dex'))) {
    // бегство: живой трус лучше мёртвого героя
    const lost = Math.floor(h.gold * .05); h.gold -= lost; h.monster = null; h.state = 'road';
    diary(`Сделал стратегическое отступление от «${m.n}». Бегом. Не оглядываясь.`, 'fight', lost ? `−${lost} 💰` : '');
  }
}
function winFight() {
  const h = S.hero, m = h.monster; if (!m) return;
  const rel = clamp(1 + .25 * (m.tier - h.lvl), .4, 2);
  const xp = Math.round(xpUnit(h.lvl) * 3.2 * rel * (m.vet ? 1.6 : 1));
  const gold = Math.round(rnd(2, 6) * m.tier * (S.buffs.luck > 0 ? 1.5 : 1) * (eqHas('gold') ? 1.25 : 1) * (hasFeat('treasure') ? 1.25 : 1));
  h.gold += gold; let fx = `+${gold} 💰, +${xp} опыта`;
  if (SILENT) SILENT.c.wins++;
  diary(pick(['Противник «{m}» побеждён! Забрал трофеи и чувство собственной важности.', 'Победа над противником «{m}»! Победный танец исполнен (зрителей не было).',
    '«{m}» больше не встанет. Сказал напоследок что-то умное. Никто не оценил — некому было.']).split('{m}').join(m.n), 'loot', fx);
  h.monster = null; h.state = 'road';
  gainXp(xp); questProgress(rnd(2, 5));
  const lootP = .35 + (h.race === 'elf' ? .2 : 0) + (hasFeat('treasure') ? .2 : 0) + (S.buffs.luck > 0 ? .2 : 0) + mod(statVal('wis')) * .02;
  if (R() < lootP) { if (R() < .3) lootDrop(clamp((m.tier - h.lvl) * .3, 0, 1) + (S.buffs.luck > 0 ? .4 : 0), 'Трофей'); else { const it = addItem(); diary(`В карманах противника нашёлся «${it.n}».`, 'loot'); } }
}

/* ---------- Отдых ---------- */
function shortRest() {
  const h = S.hero; if (h.shortRests <= 0 || h.state !== 'road') return false;
  h.shortRests--; const a = healHero(h.maxHp * .3 + mod(statVal('con')) * h.lvl);
  diary(pick(['Присел на пенёк перевести дух. Пенёк был не против.', 'Короткий привал: перевязал раны носовым платком.', 'Перекусил сухарём и посидел минутку. Жизнь налаживается.']), '', `+${a} HP (короткий отдых)`);
  return true;
}
function startLongRest(kind) {
  const h = S.hero; h.state = 'rest'; h.restKind = kind; h.restT = kind === 'camp' ? 4 : 3;
  diary(kind === 'camp' ? 'Разбил лагерь прямо у дороги. Буду спать, пока не высплюсь (или пока не съедят).'
    : kind === 'temple' ? 'Остановился на ночлег в храме моего бога. Жрецы ворчат, но кормят.' : `Снял комнату в трактире (${h.loc}). Долгий отдых — святое.`, '');
}
function restStep() {
  const h = S.hero; h.restT--;
  if (h.restKind === 'camp' && R() < .15) { diary('Ночью к лагерю подкрался кто-то голодный. Отдых отменяется!', 'fight'); h.restT = 0; h.state = 'road'; startFight(); return; }
  if (h.restT > 0) { if (R() < .5) diary(pick(['Сплю. Снится, что я король. Король тоже спит.', 'Храплю так, что разбудил соседа. Он вызвал меня на дуэль. Сплю дальше.', 'Ворочаюсь. Под матрасом горошина. Я что, принцесса?'])); return; }
  const cured = healInjuries(h.restKind === 'temple' ? 'temple' : 'rest');
  const a = healHero(h.maxHp); h.shortRests = 2;
  diary('Выспался! Как заново родился, только без мучений.', 'level', `+${a} HP (долгий отдых)${cured ? `, травм вылечено: ${cured}` : ''}`);
  h.state = h.restKind === 'camp' ? 'road' : 'town';
}

/* ---------- Город ---------- */
const priceMul = () => (1 - .04 * mod(statVal('cha'))) * (hasFeat('trader') ? .85 : 1) * (curseOn('magnet') ? 1 : 1);
const sellMul = () => (1 + .04 * mod(statVal('cha'))) * (hasFeat('trader') ? 1.2 : 1) * (S.buffs.trade > 0 ? 1.5 : 1);
function townStep() {
  const h = S.hero, L = h.lvl;
  if (h.townStep === 0) {
    if (h.inv.length) {
      let sum = 0; for (const i of h.inv) sum += i.v * (!i.slot && h.race === 'gnome' ? 1.2 : 1);
      sum = Math.round(sum * sellMul());
      const names = h.inv.slice(0, 3).map(i => i.n).join(', ') + (h.inv.length > 3 ? ' и прочее' : '');
      h.gold += sum; h.inv = [];
      diary(`Пришёл в ${h.loc}. Продал добро (${names}).` + (S.buffs.trade > 0 ? ' Проклятые торговцы переплатили!' : ''), 'loot', `+${sum} 💰`);
    } else diary(`Пришёл в ${h.loc}. Продавать нечего, так что просто поглазел на витрины.`);
    if (curseOn('greed') && h.gold > 10) { const g = Math.ceil(h.gold * .05); h.gold -= g; diary(`Проклятие жадности заставило купить «${pick(ITEMS)}» за ${g} 💰. Зачем?!`, 'fight'); }
  } else if (h.townStep === 1) {
    if (h.hp < h.maxHp) {
      const cost = S.flock.temple >= 1 ? 0 : Math.round((4 + L * 3) * priceMul());
      if (h.gold >= cost) { h.gold -= cost; h.townStep++; startLongRest(cost ? 'inn' : 'temple'); return; }
    }
  } else if (h.townStep === 2) {
    const parts = [];
    const price = Math.max(3, Math.round((10 + 4 * L) * priceMul())); let bought = 0;
    while (h.potions < 3 && h.gold > price * 2) { h.gold -= price; h.potions++; bought++; }
    if (bought) parts.push(`Купил ${bought} ${plural(bought, 'зелье', 'зелья', 'зелий')} у подозрительного алхимика.`);
    { const sl = ['weapon', 'armor', 'amulet', 'ring'].filter(x => smithOk(h.eq[x])).sort((a, b) => smithCost(h.eq[a]) - smithCost(h.eq[b]))[0]; if (sl && h.gold >= smithCost(h.eq[sl]) * 4) smithUpgrade(sl, true); }
    if (R() < .5) {
      const it = makeItem(pick(['weapon', 'armor', 'amulet', 'ring']), L, R() < .25 ? 1 : 0); it.curse = null;
      const cost = Math.round(it.v * 2.5 * priceMul()), cur = h.eq[it.slot];
      if (h.gold >= cost * 1.2 && itemScore(it) > itemScore(cur) && !(cur && cur.curse)) { h.gold -= cost; equip(it, true); parts.push(`Купил «${it.n}» за ${cost} 💰.`); }
    }
    const rich = Math.round(250 * goldScale(L) * L);
    if (h.gold > rich) { const sp = Math.round((h.gold - rich * .5) * (.4 + R() * .3)); h.gold -= sp; parts.push(pick([`Закатил пир на весь ${h.loc} и потратил ${sp} 💰. Друзей стало много, денег — мало.`, `Проиграл в кости ${sp} 💰. Кости были гномьи, с подвохом.`, `Купил титул «Почётный герой квартала» за ${sp} 💰. Табличку повесили криво.`, `Вложил ${sp} 💰 в «гарантированно прибыльную» гильдию. Гильдия исчезла.`])); }
    diary(parts.length ? parts.join(' ') : 'Побродил по рынку. Всё дорого, всё блестит.', parts.length ? 'loot' : '');
  } else {
    if (h.trust < 20) diary('Хотел пожертвовать храму, но передумал: а вдруг бога нет?', 'god');
    else {
      const don = Math.floor(Math.max(0, h.gold - 20 * goldScale(L)) * (h.trust / 100) * .3 * (hasFeat('devout') ? 1.5 : 1));
      if (don > 0) { h.gold -= don; const f = Math.max(1, Math.round(don * .25 / goldScale(L))); addFaith(f); diary(`Пожертвовал ${don} 💰 на храм моего бога. Пусть порадуется.`, 'god', `+${f} веры`); }
      else diary('Помолился у алтаря моего бога. Денег нет, зато искренне.', 'god');
    }
    h.state = 'road'; h.loc = pick(PLACES); h.townStep = 0;
    diary(`Отправляюсь дальше. Следующая цель: ${h.loc}.`);
    return;
  }
  h.townStep++;
}
function preach() {
  const h = S.hero;
  if (curseOn('chatty') && R() < .3) { const n = Math.min(1, Math.floor(S.flock.fol)); S.flock.fol -= n; diary('Проклятие болтливости: три часа рассказывал прохожим про свои мозоли. Один последователь сбежал.', 'god', n ? '−1 паствы' : ''); return; }
  let n = 1 + Math.max(0, mod(statVal('cha'))) + (h.cls === 'cleric' ? Math.max(0, mod(statVal('wis'))) : 0) + (h.trust > 70 ? 1 : 0) + eqCount('preach');
  if (hasFeat('preacher')) n *= 2;
  S.flock.fol += n;
  diary(`Рассказал прохожим о величии моего бога. ${n} ${plural(n, 'человек уверовал', 'человека уверовали', 'человек уверовали')}.`, 'god', `+${n} паствы`);
}
function heroStep() {
  const h = S.hero;
  if (h.state === 'dead' || h.state === 'duel' || h.state === 'dungeon' || S.fight) return;
  if (eqHas('regen') && h.hp < h.maxHp) healHero(h.maxHp * .02);
  if (h.state === 'fight') return fightStep();
  if (h.state === 'rest') return restStep();
  if (h.state === 'town') return townStep();
  if ((h.hp < h.maxHp * .4 && h.shortRests <= 0) || h.inv.length >= 10) {
    h.state = 'town'; h.townStep = 0; h.loc = pick(TOWNS);
    diary(h.hp < h.maxHp * .4 ? `Здоровье на исходе. Иду в ${h.loc} отлежаться.` : `Рюкзак трещит по швам. Пора в ${h.loc} на рынок.`);
    return;
  }
  if (h.hp < h.maxHp * .6 && shortRest()) return;
  const r = R(), fightP = curseOn('magnet') ? .45 : .28;
  if (r < fightP) startFight();
  else if (r < fightP + .10 + (hasFeat('treasure') ? .04 : 0)) { if (R() < .2) lootDrop(0, 'Нашёл в кустах'); else { const it = addItem(); diary(pick(['Нашёл под кустом «{i}». Беру, в хозяйстве пригодится.', 'В канаве лежал «{i}». Теперь он лежит в рюкзаке.', 'Выиграл в напёрстки «{i}». Напёрсточник плакал.']).replace('{i}', it.n), 'loot'); } }
  else if (r < fightP + .14 + (hasFeat('preacher') ? .03 : 0)) preach();
  else if (r < fightP + .22) diary(R() < .5 ? pick(CLASS_ROAD[h.cls]) : pick(h.trust < 35 ? THOUGHTS_LOW : THOUGHTS_HIGH), R() < .5 ? '' : 'god');
  else { if (R() < .3) h.loc = pick(PLACES); diary(pick(ROAD)); questProgress(Math.round(rnd(4, 9) * (h.cls === 'ranger' ? 1.3 : 1) * (hasFeat('swift') ? 1.25 : 1))); return; }
  questProgress(rnd(1, 2));
}

/* ---------- Силы бога вне дуэли ---------- */
function usePower(id) {
  if (S.fight && S.fight.phase === 'turn') return fightPower(id);
  if (S.fight || S.hero.state === 'duel' || S.hero.state === 'dungeon' || duelPending || dunPending) return toast(S.dun && !S.fight ? 'В пещере между комнатами работает только «Лечить отряд» на карте; остальные силы — в бою.' : 'Подождите начала хода — тогда силы сработают в бою.');
  const h = S.hero, p = POWERS[id], L = S.god.skills[id] || 0, mu = pmult(id);
  if (!L) return toast('Эта сила ещё не изучена.');
  if (h.state === 'dead') return toast('Герой мёртв. Сначала воскресите его.');
  const c = powerCost(id); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; shiftAlign(p.al); addGxp(c / 2);
  const m = h.monster, lv = h.lvl;
  switch (id) {
    case 'heal': { const a = healHero(h.maxHp * .3 * mu); addTrust(2); const cu = h.inj.length ? healInjuries('one') : 0; diary('Почувствовал тёплый свет с небес. Раны затянулись. Спасибо, о {god}!', 'god', `+${a} HP, +2 доверия${cu ? ', травма исцелена' : ''}`); break; }
    case 'bless': S.buffs.luck += 300 * mu; addTrust(1); diary('На меня снизошло благословение! Чувствую, что сегодня всё получится.', 'god', '🍀 удача на ' + Math.round(5 * mu) + ' мин'); break;
    case 'shield': S.buffs.shield += 300 * mu; diary('Вокруг меня засиял божий щит. Комары в ярости.', 'god', '🛡 щит на ' + Math.round(5 * mu) + ' мин'); break;
    case 'bolt':
      if (m) { const d = Math.round((10 + 6 * lv) * mu * (S.god.align <= -30 ? 1.3 : 1)); m.hp -= d; addTrust(1); diary(`С небес ударила молния и поджарила противника «${m.n}» (−${d})! Мой бог на моей стороне!`, 'god'); if (m.hp <= 0) winFight(); }
      else { const d = damageHero(h.maxHp * .12, 'Убит молнией собственного бога. Ирония.'); addTrust(-4); diary('В меня ударила молния. Я ничего не сделал! Наверное, это знак. Или бог промахнулся.', 'god', `−${d} HP, −4 доверия`); }
      break;
    case 'curse':
      if (m) { m.curse = true; diary(`Противник «${m.n}» внезапно покрылся прыщами и потерял волю к победе. Проклятие!`, 'god'); }
      else { S.buffs.trade += 1800 * mu; diary('Все торговцы в округе почему-то начали заикаться и переплачивать. Странно.', 'god', 'торговля ×1.5'); }
      break;
    case 'quake':
      if (m) { const d = Math.round((20 + 12 * lv) * mu); m.hp -= d; const hd = damageHero(h.maxHp * .05); diary(`Земля разверзлась под противником «${m.n}» (−${d})! Меня тоже немного тряхнуло.`, 'god', `−${hd} HP`); if (m.hp <= 0 && h.state === 'fight') winFight(); }
      else { const g = Math.round(rnd(20, 60) * mu * goldScale(lv)); h.gold += g; diary('Землетрясение! Из трещины вылез сундук с золотом и, кажется, гном. Гном убежал, сундук остался.', 'loot', `+${g} 💰`); }
      break;
    case 'rain': { const a = healHero(h.maxHp * .12 * mu); const n = rnd(1, 3); S.flock.fol += n; diary('Пошёл тёплый ливень. Я освежился, а крестьяне так обрадовались урожаю, что уверовали.', 'god', `+${a} HP, +${n} паствы`); break; }
    case 'luck': { const g = Math.round(rnd(15, 40) * mu * goldScale(lv)); h.gold += g; if (R() < .4 + .1 * L) lootDrop(.5 * mu, 'Подкова удачи привела к кладу'); else { const it = addItem(); diary(`Споткнулся о подкову и упал лицом в клад! «${it.n}» и монеты — мои.`, 'loot'); } diary('Удача сегодня на моей стороне!', 'god', `+${g} 💰`); break; }
    case 'beast':
      if (m) { if (m.tier <= lv + 1) { diary(`Из леса выбежал божий медведь и разорвал противника «${m.n}» в клочья. Медведь ушёл, не попрощавшись.`, 'god'); m.hp = 0; winFight(); } else { const d = Math.round((15 + 10 * lv) * mu); m.hp -= d; diary(`Божий медведь вцепился в противника «${m.n}» (−${d}), но тот оказался крепким.`, 'god'); if (m.hp <= 0) winFight(); } }
      else { const it = addItem(); diary(`Ко мне вышел медведь, положил к ногам «${it.n}» и ушёл. Бог посылает странные подарки.`, 'god'); }
      break;
  }
}
function learn(id) {
  const g = S.god, p = POWERS[id], L = g.skills[id] || 0;
  if (g.sp < 1 || L >= 3 || g.lvl < p.req || (p.pre && !(g.skills[p.pre] >= 1))) return;
  g.sp--; g.skills[id] = L + 1;
  toast(L ? `«${p.n}» улучшено до ${L + 1} уровня` : `Изучено: «${p.n}»`);
}

/* ---------- Глас божий ---------- */
const VOICE = [
  { re: /отдых|привал|поспи|спать|спи\b|ночлег/i, f: v => { const h = S.hero;
      if (h.state === 'town') { if (h.hp >= h.maxHp) return ['Бог велит отдыхать, но я и так бодр как огурец.', '']; h.townStep = 2; startLongRest(S.flock.temple >= 1 ? 'temple' : 'inn'); return [`Услышал «${v}». Иду спать — бог плохого не посоветует.`, '']; }
      if (h.state === 'road') { if (h.shortRests > 0 && h.hp < h.maxHp) { shortRest(); return [`«${v}» — понял, привал!`, '']; } startLongRest('camp'); return [`«${v}» — разбиваю лагерь прямо здесь.`, '']; }
      return ['Хотел отдохнуть, но сейчас немного занят.', '']; } },
  { re: /леч|здоров|зелье/i, f: v => { const h = S.hero; if (h.potions > 0 && h.hp < h.maxHp * .7) { h.potions--; const a = healHero(h.maxHp * .4); return [`Услышал «${v}». Выпил зелье.`, `+${a} HP`]; } const a = healHero(h.maxHp * .1); return [`Услышал глас: «${v}». Приложил подорожник.`, `+${a} HP`]; } },
  { re: /бей|руби|атак|убей|дерись|сражай|мочи/i, f: v => { const m = S.hero.monster; if (m) { const d = Math.round(sheet().avg * 1.5); m.hp -= d; return [`Глас велит: «${v}»! Ударил противника «${m.n}» в полную силу (−${d}).`, '']; } if (S.hero.state === 'road') { startFight(); return ['Раз бог велит драться — найду с кем!', '']; } return ['Хотел подраться, но вокруг никого подходящего.', '']; } },
  { re: /коп|клад|золот|деньг|сокров/i, f: v => { if (check('wis', 12).ok) { const g = Math.round(rnd(8, 30) * goldScale(S.hero.lvl)); S.hero.gold += g; return [`По велению «${v}» копал землю и нашёл монеты!`, `+${g} 💰`]; } return ['Копал. Выкопал червяка. Назвал его Гошей. Гоша теперь мой друг.', '']; } },
  { re: /моли|верь|храм|пропов|вера|паств/i, f: v => { if (S.hero.state === 'road' || S.hero.state === 'town') { preach(); addFaith(3); return [`Услышав «${v}», произнёс пламенную речь на пеньке.`, '+3 веры']; } return ['Помолился про себя.', '']; } },
  { re: /город|домой|торг|прода|рын/i, f: v => { if (S.hero.state === 'road') { S.hero.state = 'town'; S.hero.townStep = 0; S.hero.loc = pick(TOWNS); return [`Бог сказал «${v}» — разворачиваюсь в ${S.hero.loc}.`, '']; } return ['Хотел в город, но сейчас немного занят.', '']; } },
  { re: /беги|отступ|спаса|удира/i, f: v => { if (S.hero.monster) { S.hero.monster = null; S.hero.state = 'road'; return ['Сбежал с поля боя по божьему велению. Это не трусость, это стратегия.', '']; } return ['Побежал. Бежал долго. От кого — так и не понял.', '']; } },
  { re: /квест|задан|иди|вперёд|вперед|цел/i, f: v => { if (S.hero.state === 'rest') { S.hero.state = 'road'; S.hero.restT = 0; } questProgress(10); return [`«${v}» — бодро зашагал к цели!`, '+10% задания']; } }
];
function voice(text) {
  text = (text || '').trim().slice(0, 80); if (!text) return;
  if (S.god.faith < 5) return toast('Нужно 5 веры.');
  if (S.hero.state === 'dead') return toast('Мёртвые плохо слышат.');
  if (S.hero.state === 'duel' || S.hero.state === 'dungeon') return toast('Герой занят — используйте силы прямо в дуэли или подземелье.');
  if (S.fight) return toast('Идёт бой — командуйте зонами и силами бога.');
  S.god.faith -= 5; addGxp(2);
  if (R() > obeyChance()) { diary(`Услышал что-то вроде «${text}», но сделал вид, что это ветер.`, 'god'); return; }
  const v = VOICE.find(x => x.re.test(text));
  if (!v) { diary(pick([`Услышал глас: «${text}». Долго думал. Решил, что это рецепт борща.`, `С небес донеслось «${text}». Записал в дневник. Перечитал. Ничего не понял.`, `Бог сказал: «${text}». Кивнул с умным видом.`]), 'god', '+1 доверия'); addTrust(1); return; }
  const [t, f] = v.f(text); addTrust(1); diary(t, 'god', f);
  if (S.hero.monster && S.hero.monster.hp <= 0) winFight();
}

/* ---------- Развилки ---------- */
function startFork(idx) {
  if (S.fork || S.fight || S.dun || S.hero.state === 'dead' || S.hero.state === 'duel' || S.hero.state === 'dungeon') return false;
  let i = idx;
  if (i === undefined) { const free = FORKS.map((_, k) => k).filter(k => !S.forkHist.includes(k)); i = pick(free.length ? free : FORKS.map((_, k) => k)); }
  S.forkHist.push(i); if (S.forkHist.length > 10) S.forkHist.shift();
  S.fork = { i, t: 30, T: 30, cls: R() < .4 }; S.timers.fork = Math.max(S.timers.fork, 300);
  S.stats.forks++;
  diary('🙏 Молюсь: ' + FORKS[i].t, 'fork');
  toast('🙏 Герой молится и ждёт вашего решения!');
}
function forkOptions(fk) { const f = FORKS[fk.i], o = f.o.slice(); if (fk.cls) { const c = CLASS_FORK[S.hero.cls]; o.push({ l: c.l, a: 0, clsOpt: true }); } return o; }
function resolveOption(fi, k) {
  const f = FORKS[fi];
  if (k >= f.o.length) { // классовый вариант
    const c = CLASS_FORK[S.hero.cls], chk = check(c.s, 13);
    const e = chk.ok ? { xp: 18, gold: 25, fol: S.hero.cls === 'cleric' || S.hero.cls === 'bard' ? 2 : 0 } : { hp: -15, xp: 6 };
    diary(`${CLASSES[S.hero.cls].ab}! ${chk.ok ? c.ok : c.no}`, 'fork', [chk.label, applyFx(e)].filter(Boolean).join(' · '));
    return;
  }
  const opt = f.o[k], st = (FORK_STATS[fi] || [])[k];
  let res = opt.r[opt.r.length - 1], label = '';
  if (opt.r.length > 1 && st) {
    const p = opt.r[0].p || .5, chk = check(st, clamp(Math.round(23 - p * 20), 5, 22));
    res = chk.ok ? opt.r[0] : opt.r[opt.r.length - 1]; label = chk.label;
  } else if (opt.r.length > 1) {
    const bonus = (S.buffs.luck > 0 ? .2 : 0) + (S.hero.trust > 80 ? .05 : 0);
    for (const r of opt.r) { if (r.p === undefined) { res = r; break; } if (R() < r.p + bonus) { res = r; break; } }
  }
  const fx = applyFx(res.e);
  diary(res.t, 'fork', [label, fx].filter(Boolean).join(' · '));
}
function answerFork(k) {
  if (!S.fork) return;
  const fk = S.fork, opts = forkOptions(fk); if (!opts[k]) return;
  S.fork = null; S.stats.forksAns++;
  const opt = opts[k];
  shiftAlign(opt.a); addGxp(10);
  if (R() < obeyChance()) { addTrust(2); diary(`Услышал волю бога: «${opt.l}». Так и сделаю!`, 'god'); resolveOption(fk.i, k); }
  else {
    const others = opts.map((_, j) => j).filter(j => j !== k); const j = pick(others);
    diary(`Бог сказал «${opt.l}», но я решил, что лучше знаю. Выбираю «${opts[j].l}».`, 'god');
    resolveOption(fk.i, j);
  }
}
function timeoutFork(offline) {
  if (!S.fork) return;
  const fk = S.fork, f = FORKS[fk.i]; S.fork = null;
  if (!offline) addTrust(-2);
  const pen = offline ? '' : '−2 доверия';
  if (R() < .7) diary(f.self.t, 'fork', [applyFx(f.self.e), pen].filter(Boolean).join(', '));
  else { const opts = forkOptions(fk), j = rnd(0, opts.length - 1); diary(`Бог промолчал. Выбрал наугад: «${opts[j].l}».`, 'fork', pen); resolveOption(fk.i, j); }
  if (SILENT) SILENT.c.forks++;
}

/* ---------- Паства и храм ---------- */
const TEMPLE_NAMES = ['часовня-сарай', 'деревянный храм', 'каменный храм', 'храм с колокольней', 'собор', 'великий собор', 'храм-небоскрёб', 'небесный дворец', 'храм с фонтаном из лимонада', 'Обитель Всего'];
function templeGive(n) {
  if (S.flock.temple >= 10) return toast('Храм уже величайший в мире.');
  n = n === 'all' ? Math.floor(S.god.faith) : Math.min(+n, Math.floor(S.god.faith));
  if (n < 1) return toast('Не хватает веры.');
  S.god.faith -= n; S.flock.templeProg += n; addGxp(n / 4);
  while (S.flock.temple < 10 && S.flock.templeProg >= templeCost()) {
    S.flock.templeProg -= templeCost(); S.flock.temple++;
    diary(`⛪ Паства отстроила ${TEMPLE_NAMES[S.flock.temple - 1]} во славу нашего бога! Кадило пахнет величием.`, 'level');
  }
  if (S.flock.temple >= 10) S.flock.templeProg = 0;
}
function miracle(id) {
  const m = MIRACLES.find(x => x.id === id); if (!m) return; if (S.god.faith < m.cost) return toast('Не хватает веры.');
  S.god.faith -= m.cost; const n = rnd(m.fol[0], m.fol[1]); S.flock.fol += n; addTrust(m.trust); addGxp(m.cost / 3); shiftAlign(1);
  diary('🌈 ' + m.t, 'event', `+${n} паствы, +${m.trust} доверия`);
}
function recruit(n) {
  const c = soldierCost();
  n = Math.min(n, Math.floor(S.god.faith / c), Math.floor(S.flock.fol / 2));
  if (n < 1) return toast('Нужно ' + c + ' веры и 2 последователя на одного солдата.');
  S.god.faith -= c * n; S.flock.fol -= 2 * n; S.flock.army += n; shiftAlign(-1 * Math.ceil(n / 3)); addGxp(n * 3);
  diary(`⚔ ${n * 2} ${plural(n * 2, 'последователь сменил', 'последователя сменили', 'последователей сменили')} молитвенники на вилы. В божьей армии +${n}.`, 'god');
}

/* =====================================================================
   СНАРЯЖЕНИЕ v7: слоты, требования, комплекты, авто-экипировка, ГС, кузнец
   ===================================================================== */
const newIid = () => 'it' + Math.random().toString(36).slice(2, 9);
const isShield = it => !!it && it.slot === 'offhand';
const lcFirst = s => s && s[0] !== '«' ? s[0].toLowerCase() + s.slice(1) : s;
const equipped = h => { h = h || S.hero; const o = []; for (const k of EQ_KEYS) if (h.eq[k]) o.push(h.eq[k]); return o; };
/* Комплекты: считаем разные надетые куски */
function setCounts(h) { const c = {}, seen = {}; for (const it of equipped(h)) if (it.set && SETS[it.set] && !seen[it.set + it.base]) { seen[it.set + it.base] = 1; c[it.set] = (c[it.set] || 0) + 1; } return c; }
function setBonusProps(h) { const out = [], c = setCounts(h); for (const id in c) { const B = SETS[id].b; for (const n in B) if (c[id] >= +n) for (const p of B[n]) out.push(p); } return out; }
function allProps(h) { const o = []; for (const it of equipped(h)) for (const p of it.props) o.push(p); return o.concat(setBonusProps(h)); }
const propCnt = (h, k) => { let n = 0; for (const p of allProps(h)) if (p.k === k) n++; return n; };
const eqCount = k => S && S.hero ? propCnt(S.hero, k) : 0;
const eqHas = k => eqCount(k) > 0;
const curseOfH = (h, k) => equipped(h).some(it => it.curse && it.curse.k === k);
const curseOn = k => !!(S && S.hero) && curseOfH(S.hero, k);
function statValOf(h, s) {
  let v = h.st[s];
  for (const p of allProps(h)) if (p.k === s) v += p.v || 1;
  if (s === 'cha' && curseOfH(h, 'chatty')) v -= 1;
  if (s === 'str' && curseOfH(h, 'weak')) v -= 2; if (s === 'dex' && curseOfH(h, 'slowc')) v -= 2; if (s === 'int' && curseOfH(h, 'dull')) v -= 2;
  if (h.inj) for (const j of h.inj) if (j.s === s && INJURIES[j.k]) v -= INJURIES[j.k].pen;
  return clamp(v, 1, 30);
}
const statVal = s => statValOf(S.hero, s);
function calcMaxHp(h) {
  const c = CLASSES[h.cls], cm = mod(statValOf(h, 'con'));
  let hp = 10 + 2 * (c.die + cm) + (h.lvl - 1) * 2 * Math.max(1, c.die / 2 + 1 + cm);
  if (h.race === 'dwarf') hp += h.lvl;
  if (h.feats && h.feats.includes('tough')) hp += 2 * h.lvl;
  hp *= (CLASS_BAL[h.cls] || CLASS_BAL.warrior).h * (1 + .06 * propCnt(h, 'hp')) * (curseOfH(h, 'fragile') ? .9 : 1);
  return Math.max(10, Math.round(hp));
}
function recalcHp() { const h = S.hero, old = h.maxHp; h.maxHp = calcMaxHp(h); if (h.state !== 'dead') h.hp = clamp(h.hp + (h.maxHp - old), 1, h.maxHp); }
/* Особенности оружия и любимое оружие класса */
function wTraits(h) { const w = h.eq.weapon, c = w && WCAT[w.cat]; return { cat: c ? w.cat : null, aff: !!(c && c.cls.includes(h.cls)) }; }
const effAc = it => it ? (it.ac || 0) + (it.plus || 0) : 0;
const secAc = h => effAc(h.eq.helm) + effAc(h.eq.belt) + effAc(h.eq.boots) + (isShield(h.eq.offhand) ? effAc(h.eq.offhand) : 0);
const glovesHit = h => { const g = h.eq.gloves; return g ? (g.hit || 0) + Math.floor((g.plus || 0) / 2) : 0; };
/* Боевой лист: работает и для героя игрока, и для виртуального героя соперника */
function sheetOf(h, temple) {
  const c = CLASSES[h.cls], w = h.eq.weapon, a = h.eq.armor, off = h.eq.offhand, feats = h.feats || [], wt = wTraits(h);
  const am = mod(statValOf(h, c.atk));
  const atkB = profB(h.lvl) + am + (w ? w.plus : 0) + (feats.includes('wmaster') ? 1 : 0) + glovesHit(h) + propCnt(h, 'acc') + (wt.cat === 'sword' ? 1 : 0) + (wt.aff ? 1 : 0);
  const die = w ? w.die || 4 : 4;
  const dmgB = am + (w ? w.plus : 0) + (feats.includes('wmaster') ? 2 : 0);
  const offD = off && off.slot === 'weapon' ? .3 * ((off.die || 4) + 1) / 2 + .3 * (off.plus || 0) : 0;
  const dm = (wt.cat === 'two' ? 1.1 : 1) * (wt.aff ? 1.08 : 1) * (wt.cat === 'staff' && (c.atk === 'int' || c.atk === 'wis') ? 1.12 : 1) * (curseOfH(h, 'pacifist') ? .9 : 1);
  let ac = 10 + effAc(a) + Math.floor(secAc(h) / 4) + Math.min(mod(statValOf(h, 'dex')), 3) + Math.floor((temple || 0) / 2) + (feats.includes('ironskin') ? 1 : 0);
  if (h.cls === 'barbarian') ac += Math.max(0, mod(statValOf(h, 'con')));
  if (curseOfH(h, 'clumsy')) ac -= 2;
  const scale = (1 + 0.2 * (h.lvl - 1)) * (CLASS_BAL[h.cls] || CLASS_BAL.warrior).d;
  return { atkB, die, dmgB, ac, scale, avg: Math.max(1, ((die + 1) / 2 + dmgB + offD) * scale * dm), dm };
}
const sheet = () => sheetOf(S.hero, S.flock.temple);
/* Броня по зонам (как в БК): шлем — голова, броня — грудь/живот, пояс — пояс, сапоги — ноги, щит — понемногу везде */
const ZONE_BODY = { head: .2, chest: 1, belly: .85, waist: .4, legs: .25 };
function zoneArmor(h, temple) {
  const b = effAc(h.eq.armor), sh = isShield(h.eq.offhand) ? effAc(h.eq.offhand) * .3 : 0;
  const base = Math.floor((temple || 0) / 2) + (h.feats && h.feats.includes('ironskin') ? 1 : 0) - (curseOfH(h, 'clumsy') ? 1 : 0), o = {};
  for (const z of ZONES) o[z] = b * ZONE_BODY[z] + sh + base;
  o.head += effAc(h.eq.helm); o.waist += effAc(h.eq.belt); o.legs += effAc(h.eq.boots);
  for (const z of ZONES) o[z] = Math.max(0, Math.round(o[z] * 10) / 10);
  return o;
}
/* Особые эффекты снаряжения в бою по зонам */
function gearFx(h) {
  const off = h.eq.offhand, wt = wTraits(h), pc = k => propCnt(h, k), sh = isShield(off);
  return { blk: Math.min(.4, (sh ? (off.blk || 0) + .01 * (off.plus || 0) : 0) + .05 * pc('blockp')), xatk: (wt.cat === 'dagger' ? .12 : 0) + (off && off.slot === 'weapon' ? .25 : 0),
    pierce: Math.min(.6, (wt.cat === 'mace' ? .25 : 0) + (pc('pierce') ? .33 : 0)), dodge: Math.min(.16, .04 * pc('dodge')), acrit: Math.min(.8, .4 * pc('acrit')),
    crit: .06 * pc('crit') + (wt.cat === 'axe' ? .05 : 0) + (wt.cat === 'music' ? .04 : 0) + .01 * glovesHit(h), aim: wt.cat === 'bow' ? .12 : 0, sh: sh ? 1 : 0 };
}
function blkFor(cls, h) { const st = STYLE[cls]; return Math.min(3, st.blk - (st.shield ? 1 : 0) + (isShield(h.eq.offhand) ? 1 : 0)); }
/* Типичное снаряжение и характеристики героя уровня L (для ботов арены/отряда и эталона монстров) */
const typRar = L => L < 3 ? 0 : L < 7 ? 1 : L < 12 ? 2 : 3;
const CLS_WCAT = { warrior: 'sword', mage: 'staff', rogue: 'dagger', cleric: 'mace', bard: 'music', ranger: 'bow', barbarian: 'two' };
function virtualHero(race, cls, lvl) {
  const c = CLASSES[cls], st = genStats(cls, race), L = lvl, rar = typRar(L), plus = [0, L >= 5 ? 1 : 0, 1, 2, 3][rar];
  for (let i = 2; i <= L; i++) { st[c.prim] = Math.min(20, st[c.prim] + 1); if (i % 2 === 0) st.con = Math.min(20, st.con + 1); }
  for (let i = 4; i <= L; i += 4) st[c.prim] = Math.min(20, st[c.prim] + 1); // свойства предметов
  const die = Math.max(c.wpn[1], L < 3 ? 6 : L < 8 ? 8 : L < 12 ? 10 : 11);
  const ac = Math.max(c.arm[1], L < 2 ? 1 : L < 4 ? 3 : L < 6 ? 4 : L < 8 ? 5 : L < 12 ? 6 : 7);
  const sec = L < 3 ? 1 : L < 7 ? 2 : L < 11 ? 3 : 4, sp = Math.max(0, plus - 1), cat = CLS_WCAT[cls];
  const P = (slot, o) => Object.assign({ slot, plus: sp, props: [], rar }, o);
  return { race, cls, lvl, st, feats: [], eq: { weapon: P('weapon', { cat, h2: !!WCAT[cat].h2, die, plus, props: [rar >= 1 && { k: 'crit' }, rar >= 2 && { k: c.prim, v: 1 }, rar >= 3 && { k: 'vamp' }].filter(Boolean) }), armor: P('armor', { ac, plus, props: [rar >= 2 && { k: 'hp' }, rar >= 3 && { k: 'con', v: 1 }].filter(Boolean) }),
    helm: P('helm', { ac: sec }), belt: P('belt', { ac: Math.max(1, sec - 1) }), boots: P('boots', { ac: sec }), gloves: P('gloves', { hit: L < 6 ? 0 : L < 11 ? 1 : 2 }),
    offhand: STYLE[cls].shield ? P('offhand', { ac: L < 6 ? 1 : 2, blk: .1 + .005 * L }) : cls === 'rogue' ? P('weapon', { cat: 'dagger', die: Math.max(4, Math.min(8, die - 2)) }) : null,
    amulet: L >= 4 ? P('amulet', { props: [{ k: 'hp' }] }) : null, ring: L >= 6 ? P('ring', { props: [{ k: c.prim, v: 1 }] }) : null, ring2: L >= 10 ? P('ring', { props: [{ k: 'con', v: 1 }] }) : null } };
}
/* ---------- Требования ---------- */
const reqStatVal = (h, s) => Math.max(...s.split('/').map(k => statValOf(h, k)));
function reqOk(h, it) { const r = it && it.req; if (!r) return true; if (h.lvl < (r.lvl || 1)) return false; return !(r.s && r.v && reqStatVal(h, r.s) < r.v); }
function reqHtml(h, it) {
  const r = it.req; if (!r || ((r.lvl || 1) <= 1 && !r.v)) return '';
  const p = []; if ((r.lvl || 1) > 1) p.push(`<span class="${h.lvl < r.lvl ? 'rqb' : ''}">ур. ${r.lvl}</span>`);
  if (r.s && r.v) p.push(`<span class="${reqStatVal(h, r.s) < r.v ? 'rqb' : ''}">${r.s.split('/').map(k => STAT_SHORT[k]).join(' или ')} ${r.v}</span>`);
  return `Требуется: ${p.join(', ')}`;
}
function mkReq(slot, lv, rar, st) {
  const lvl = Math.max(1, lv - 1 + (rar >= 3 ? 1 : 0));
  if (!st || lv <= 1) return { lvl };
  const off = slot === 'weapon' ? 0 : slot === 'armor' || slot === 'offhand' ? -1 : -2;
  return { lvl, s: st, v: clamp(9 + Math.round(lv * .6) + off + (rar >= 3 ? 1 : 0), 10, 18) };
}
/* ---------- Создание предметов ---------- */
function rollRarity(boost) {
  boost = boost || 0;
  const w = [60, 26, 10, 3.5, .5].map((x, i) => i ? x * (1 + boost * i * .6) : Math.max(5, x - boost * 25));
  let r = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
function itemValue(it, lvl) { return Math.round((5 + lvl * 4) * RARITY[it.rar].mul * (.8 + R() * .4) * (it.set ? 1.5 : 1)); }
const SLOT_W = [['weapon', 2], ['armor', 1.6], ['helm', 1.1], ['boots', 1.1], ['belt', .9], ['gloves', .9], ['offhand', .8], ['amulet', .7], ['ring', 1.1]];
function pickSlot() { let r = R() * SLOT_W.reduce((s, x) => s + x[1], 0); for (const [k, w] of SLOT_W) { r -= w; if (r <= 0) return k; } return 'weapon'; }
const CLS_KIND = { mage: 'c', rogue: 'l', bard: 'l', ranger: 'l', warrior: 'h', cleric: 'h', barbarian: 'h' };
const baseLvl = (slot, b) => slot === 'weapon' || slot === 'offhand' ? b[3] : slot === 'amulet' || slot === 'ring' ? b[1] : b[2];
function fromBase(slot, b, rar) {
  const it = { id: newIid(), slot, base: b[0], n: '', rar, plus: [0, rnd(0, 1), 1, 2, 3][rar], die: 0, ac: 0, props: [], curse: null, v: 0, blvl: baseLvl(slot, b) };
  if (slot === 'weapon') { it.cat = b[1]; it.die = b[2]; if (WCAT[b[1]].h2) it.h2 = 1; }
  else if (slot === 'offhand') { it.ac = b[1]; it.blk = b[2]; it.kind = b[4]; }
  else if (slot === 'gloves') { it.hit = b[1]; it.kind = b[3]; }
  else if (slot !== 'amulet' && slot !== 'ring') { it.ac = b[1]; it.kind = b[3]; }
  return it;
}
const reqStatFor = it => it.slot === 'weapon' ? WCAT[it.cat].st : it.kind && it.kind !== 'c' ? ARM_KIND[it.kind].st : it.kind === 'c' && it.slot === 'armor' ? ARM_KIND.c.st : null;
function addProps(it, n) {
  const pool = Object.keys(PROP_DEF).filter(k => PROP_DEF[k].slots === 'all' || PROP_DEF[k].slots.split(' ').includes(it.slot));
  let guard = 0; while (it.props.length < n && guard++ < 50) { const k = pick(pool); if (it.props.some(p => p.k === k)) continue; it.props.push(STATS.includes(k) ? { k, v: it.rar >= 3 ? 2 : 1 } : { k }); }
}
function nameOf(it) {
  if (it.unique) return it.base;
  return (it.pre ? it.pre + lcFirst(it.base) : it.base) + (it.plus ? ` +${it.plus}` : '') + (it.props[0] && !it.set ? ' ' + PROP_DEF[it.props[0].k].n : '') + (it.suf ? ' ' + it.suf : '');
}
function makeItem(slot, lvl, rar, o) {
  o = o || {}; lvl = Math.max(1, Math.round(lvl || 1));
  const fixedSlot = !!slot; slot = slot || pickSlot();
  if (rar === undefined) rar = rollRarity(0);
  if (o.set && SETS[o.set]) return makeSetItem(o.set, lvl, rar);
  if (rar === 4 && R() < .5) {
    const owned = S && S.hero ? equipped().concat(S.hero.inv).map(i => i.n) : [];
    const L = LEGENDARY.filter(x => !owned.includes(x.n) && x.lv <= lvl + 2 && (!fixedSlot || x.slot === slot));
    if (L.length) return makeLegend(pick(L), lvl);
  }
  const H = S && S.hero, pool = BASES[slot];
  let bases = pool.filter(b => baseLvl(slot, b) <= lvl + 1 && baseLvl(slot, b) >= lvl - 5);
  if (!bases.length) bases = pool.filter(b => baseLvl(slot, b) <= lvl + 1); if (!bases.length) bases = pool;
  if (H && R() < .5) { const f = slot === 'weapon' ? bases.filter(b => WCAT[b[1]].cls.includes(H.cls)) : bases.filter(b => b[b.length - 1] === CLS_KIND[H.cls]); if (f.length) bases = f; }
  const it = fromBase(slot, pick(bases), rar);
  let np = [0, 1, 1 + (R() < .5 ? 1 : 0), 2, 3][rar]; if ((slot === 'amulet' || slot === 'ring') && np < 1) np = 1;
  addProps(it, np);
  if (rar >= 1 && R() < (H && H.race === 'tiefling' ? .04 : .08)) { it.curse = { k: pick(Object.keys(CURSES)) }; it.plus = Math.min(5, it.plus + 1); }
  if (rar >= 2 && R() < .35) it.pre = pick(NAME_PRE); if (rar >= 1 && R() < .25) it.suf = pick(NAME_SUF);
  it.req = mkReq(slot, it.blvl, rar, reqStatFor(it));
  it.n = nameOf(it); it.v = itemValue(it, lvl);
  return it;
}
function makeLegend(t, lvl) {
  const it = { id: newIid(), slot: t.slot, base: t.n, n: t.n, rar: 4, plus: 3, die: t.die || 0, ac: t.ac || 0, props: t.props.map(p => Object.assign({}, p)), curse: null, unique: 1, fl: t.fl, blvl: t.lv };
  if (t.cat) { it.cat = t.cat; if (WCAT[t.cat].h2) it.h2 = 1; } if (t.kind) it.kind = t.kind; if (t.hit) it.hit = t.hit; if (t.blk) it.blk = t.blk;
  it.req = mkReq(t.slot, t.lv, 4, reqStatFor(it)); it.v = Math.round((5 + Math.max(lvl, t.lv) * 4) * 15);
  return it;
}
/* Комплект, подходящий уровню (предпочтение — тот, что уже начат) */
function setFor(lvl, h) {
  const ok = Object.keys(SETS).filter(id => SETS[id].lv[0] <= lvl + 1 && SETS[id].lv[1] >= lvl - 1);
  if (!ok.length) return null;
  if (h) { const own = ok.filter(id => equipped(h).concat(h.inv).some(i => i.set === id)); if (own.length && R() < .65) return pick(own); }
  return pick(ok);
}
function makeSetItem(id, lvl, rar) {
  const S0 = SETS[id], h = S && S.hero, have = h ? equipped(h).concat(h.inv).filter(i => i.set === id).map(i => i.base) : [];
  const missing = S0.pcs.filter(p => !have.includes(p[1])), pc = pick(missing.length && R() < .8 ? missing : S0.pcs);
  const slot = pc[0], sl = clamp(lvl, S0.lv[0], S0.lv[1]); rar = Math.max(2, Math.min(3, rar));
  const pool = BASES[slot].filter(b => baseLvl(slot, b) <= sl && (slot === 'weapon' ? b[1] === pc[2] : slot === 'amulet' || slot === 'ring' || b[b.length - 1] === pc[2]));
  const b = (pool.length ? pool : BASES[slot].filter(x => baseLvl(slot, x) <= sl).concat([BASES[slot][0]])).slice(-1)[0];
  const it = fromBase(slot, b, rar); it.base = pc[1]; it.set = id; it.blvl = sl;
  if (slot === 'weapon') { it.cat = pc[2]; if (WCAT[pc[2]].h2) it.h2 = 1; else delete it.h2; } else if (pc[2]) it.kind = pc[2];
  addProps(it, rar >= 3 ? 2 : 1);
  it.req = mkReq(slot, sl, rar, reqStatFor(it)); it.n = nameOf(it); it.v = itemValue(it, sl);
  return it;
}
/* ---------- Оценка вещей для авто-экипировки ---------- */
function itemScore(it, h) {
  if (!it) return 0; h = h || S.hero; const c = CLASSES[h.cls];
  let s = 0;
  for (const p of it.props) s += STATS.includes(p.k) ? (p.v || 1) * (p.k === c.prim ? 1.6 : p.k === 'con' ? 1.1 : .5) * 1.2 : 1.8;
  const sl = it.slot, pl = it.plus || 0;
  if (sl === 'weapon') { const off = h.eq.offhand === it; s += off ? ((it.die || 4) + 1) / 2 * .4 + pl * .5 : ((it.die || 4) + 1) / 2 + pl * 1.5 + (WCAT[it.cat] && WCAT[it.cat].cls.includes(h.cls) ? 1.5 : 0) + (it.cat === 'two' ? .6 : 0); }
  else if (sl === 'armor') s += effAc(it);
  else if (sl === 'offhand') s += effAc(it) * .5 + (it.blk || 0) * 22;
  else if (sl === 'gloves') s += (it.hit || 0) + pl * .5;
  else if (sl === 'helm' || sl === 'belt' || sl === 'boots') s += effAc(it) * .7;
  else s += pl * .5;
  if (it.curse) s -= 1.5;
  return s;
}
function loadoutScore(h, eq) {
  const hh = { cls: h.cls, eq }, c = CLASSES[h.cls]; let s = 0;
  for (const k of EQ_KEYS) if (eq[k]) s += itemScore(eq[k], hh);
  for (const p of setBonusProps(hh)) s += STATS.includes(p.k) ? (p.v || 1) * (p.k === c.prim ? 1.6 : .6) * 1.2 : 1.8;
  return s;
}
function fitsKey(h, k, it) {
  if (!it || !it.slot) return false;
  if (k === 'ring2') return it.slot === 'ring';
  if (k === 'offhand') return it.slot === 'offhand' || (h.cls === 'rogue' && it.slot === 'weapon' && it.cat === 'dagger');
  return it.slot === k;
}
function placeOptions(h, it) {
  const out = [];
  for (const k of EQ_KEYS) {
    if (!fitsKey(h, k, it)) continue;
    const cur = h.eq[k]; if (cur && cur.curse) continue;
    const eq = Object.assign({}, h.eq); eq[k] = it; const gone = cur ? [cur] : [];
    for (const kk of EQ_KEYS) if (kk !== k && eq[kk] === it) eq[kk] = null;
    if (k === 'weapon' && it.h2 && eq.offhand) { if (eq.offhand.curse) continue; gone.push(eq.offhand); eq.offhand = null; }
    if (k === 'offhand' && eq.weapon && eq.weapon.h2) continue;
    out.push({ k, eq, gone });
  }
  return out;
}
function bestPlace(h, it, force, noReq) {
  if (!noReq && !reqOk(h, it)) return null;
  const base = loadoutScore(h, h.eq); let best = null;
  for (const o of placeOptions(h, it)) { o.sc = loadoutScore(h, o.eq) - base; if ((force || o.sc > .01) && (!best || o.sc > best.sc)) best = o; }
  return best;
}
function applyPlace(h, it, b) {
  for (const k of EQ_KEYS) h.eq[k] = b.eq[k] || null;
  const i = h.inv.indexOf(it); if (i >= 0) h.inv.splice(i, 1);
  for (const g of b.gone) if (g !== it) addItem(g);
}
function equip(it, silentNote, force) {
  const h = S.hero, b = bestPlace(h, it, force);
  if (!b) { if (!h.inv.includes(it)) addItem(it); return false; }
  applyPlace(h, it, b); recalcHp();
  if (it.curse) diary(`Надел «${it.n}». Ой. Кажется, оно проклято: ${CURSES[it.curse.k].d}. И не снимается!`, 'fight');
  else if (!silentNote) diary(`Надел «${it.n}» (${RARITY[it.rar].n}). Чувствую себя модным.`, it.rar >= 2 ? 'rare' : 'loot');
  if (it.set) { const n = setCounts(h)[it.set] || 0; if (SETS[it.set].b[n]) diary(`🧩 Комплект «${SETS[it.set].n}»: надето ${n} из ${SETS[it.set].pcs.length} — заработал бонус!`, 'rare', setBonusText(it.set, n)); }
  return true;
}
/* Ручная экипировка из рюкзака (по совету бога) */
function equipInv(id) {
  const h = S.hero, it = h.inv.find(i => i.id === id); if (!it || !it.slot) return false;
  if (!reqOk(h, it)) { toast('Герой не может это надеть: ' + reqHtml(h, it).replace(/<[^>]+>/g, '')); return false; }
  const b = bestPlace(h, it, true); if (!b) { toast('Слот занят проклятой вещью или нужен одноручный хват.'); return false; }
  applyPlace(h, it, b); recalcHp(); addTrust(.5);
  diary(`Бог посоветовал надеть «${it.n}». Ну раз бог говорит…`, it.rar >= 2 ? 'rare' : 'loot', `ГС ${gearScore(h)}`);
  return true;
}
/* После роста уровня или в городе: надеть то, что раньше было не по силам */
function tryEquipInv() {
  const h = S.hero; let n = 0;
  for (const it of h.inv.slice()) if (it.slot && reqOk(h, it) && bestPlace(h, it)) { if (equip(it, true)) { n++; diary(`Достал из рюкзака «${it.n}» — наконец-то по силам!`, it.rar >= 2 ? 'rare' : 'loot'); } }
  if (trySetCombo(h)) n++;
  return n;
}
/* Комплект целиком: надеть сразу несколько кусков из рюкзака, если вместе с бонусом это лучше */
function trySetCombo(h) {
  const ids = [...new Set(h.inv.filter(i => i.set && reqOk(h, i)).map(i => i.set))];
  for (const id of ids) {
    const pcs = h.inv.filter(i => i.set === id && reqOk(h, i)); if (!pcs.length) continue;
    let eq = Object.assign({}, h.eq); const gone = [], used = [];
    for (const it of pcs) { const o = placeOptions({ cls: h.cls, eq }, it).filter(x => !(x.eq[x.k] === it && used.some(u => u.k === x.k)))[0]; if (!o) continue; eq = o.eq; gone.push(...o.gone); used.push({ it, k: o.k }); }
    if (used.length && loadoutScore(h, eq) > loadoutScore(h, h.eq) + .01) {
      for (const k of EQ_KEYS) h.eq[k] = eq[k] || null;
      for (const u of used) { const i = h.inv.indexOf(u.it); if (i >= 0) h.inv.splice(i, 1); }
      for (const g of gone) if (!used.some(u => u.it === g) && !equipped(h).includes(g)) addItem(g);
      recalcHp(); const n = setCounts(h)[id] || 0;
      diary(`🧩 Собрал комплект «${SETS[id].n}» (${n} из ${SETS[id].pcs.length}): ${used.map(u => '«' + u.it.n + '»').join(', ')}.`, 'rare', setBonusText(id, Object.keys(SETS[id].b).filter(x => n >= +x).pop() || 2));
      return true;
    }
  }
  return false;
}
const keepInInv = (h, it) => !!it.slot && (!!it.set || (!reqOk(h, it) && !!bestPlace(h, it, false, true)));
/* ---------- Сила снаряжения (ГС) ---------- */
function itemGS(it) {
  if (!it) return 0;
  const sl = it.slot;
  const base = sl === 'weapon' ? 4 + ((it.die || 4) - 4) * 1.5 + (it.h2 ? 8 : 0) : sl === 'armor' ? 4 + (it.ac || 0) * 2 : sl === 'offhand' ? 3 + (it.ac || 0) * 2 + Math.round((it.blk || 0) * 30)
    : sl === 'gloves' ? 3 + (it.hit || 0) * 3 : sl === 'helm' || sl === 'belt' || sl === 'boots' ? 3 + (it.ac || 0) * 2 : 2;
  const pr = (it.props || []).reduce((s, p) => s + (STATS.includes(p.k) ? (p.v || 1) * 2 : 3), 0);
  return Math.max(0, Math.round(base + (it.plus || 0) * 4 + (it.rar || 0) * 3 + pr + (it.curse ? 2 : 0) + (it.set ? 3 : 0)));
}
const gearScore = h => EQ_KEYS.reduce((s, k) => s + itemGS(h.eq[k]), 0) + 3 * setBonusProps(h).length;
/* Типичный ГС героя уровня L — медиана прогонов реальной прокачки (pace, v7), дальше медленный рост к потолку */
const TYP_GS_T = [0, 40, 60, 125, 180, 235, 285, 325, 345, 355]; // по прогонам pace7 (21×200 ч, v7)
function typGS(L) { L = clamp(Math.round(L) || 1, 1, MAX_LVL + 5); return L < TYP_GS_T.length ? TYP_GS_T[L] : Math.min(470, TYP_GS_T[9] + 8 * (L - 9)); }
const recGS = (L, tier) => Math.round(typGS(L) * (DUN_TIERS[tier] || DUN_TIERS.normal).g);
/* ---------- Кузнец: +1 к предмету за золото ---------- */
const smithCap = it => Math.min(5, (it.rar || 0) + 1 + (it.curse ? 1 : 0)); /* редкость решает, сколько выдержит металл; проклятое — на +1 больше */
function smithCost(it) { return it ? Math.round((20 + 10 * S.hero.lvl) * Math.pow((it.plus || 0) + 1, 2) * priceMul() * (it.slot === 'weapon' || it.slot === 'armor' ? 1 : .6)) : 0; }
function smithOk(it) { return !!it && (it.plus || 0) < smithCap(it) && !it.unique; }
function smithUpgrade(sl, auto) {
  const h = S.hero, it = h.eq[sl];
  if (!smithOk(it)) return auto ? false : toast(`Кузнец: «${it ? `больше +${smithCap(it)} этот металл не выдержит` : 'нечего точить'}». Редкие вещи держат больше.`);
  if (!auto && (S.fight || S.dun || ['duel', 'dungeon', 'dead'].includes(h.state))) return toast('Герой сейчас занят — кузнец подождёт.');
  const c = smithCost(it); if (h.gold < c) return auto ? false : toast(`Нужно ${c} 💰.`);
  h.gold -= c; it.plus = (it.plus || 0) + 1; it.n = nameOf(it);
  if (sl !== 'weapon') recalcHp();
  diary(auto ? `Заглянул к кузнецу: «${it.n}». Стучал молотком час, звенит до сих пор.` : `Бог послал меня к кузнецу. Теперь у меня «${it.n}»!`, 'loot', `−${c} 💰, ГС ${gearScore(h)}`);
  return true;
}
/* ---------- Описания ---------- */
function itemStats(it) {
  const p = [], pl = it.plus || 0;
  if (it.slot === 'weapon') { const c = WCAT[it.cat]; p.push(`${c ? c.n : 'оружие'}${it.h2 ? ', двуручное' : ''}, урон d${it.die}${pl ? '+' + pl : ''}`); }
  else if (it.slot === 'offhand') p.push(`щит: КД +${effAc(it)}, блок ${Math.round(((it.blk || 0) + .01 * pl) * 100)}%`);
  else if (it.slot === 'gloves') p.push(`точность +${(it.hit || 0) + Math.floor(pl / 2)}`);
  else if (it.slot !== 'amulet' && it.slot !== 'ring') p.push(`КД +${effAc(it)}${it.kind ? ` (${ARM_KIND[it.kind].n})` : ''}`);
  else if (pl) p.push(`+${pl}`);
  return p;
}
const propText = p => PROP_DEF[p.k].d.replace('{v}', p.v || 1);
function itemDesc(it) {
  const p = itemStats(it);
  for (const pr of it.props) p.push(propText(pr));
  if (it.curse) p.push(`☠ проклятие ${CURSES[it.curse.k].n}: ${CURSES[it.curse.k].d}`);
  if (it.set) p.push(`🧩 комплект «${SETS[it.set].n}»`);
  return p.join(', ');
}
const setBonusText = (id, n) => (SETS[id].b[n] || []).map(propText).join(', ');
const liftCost = it => 25 + it.rar * 15;
function liftCurse(slot) {
  const it = S.hero.eq[slot]; if (!it || !it.curse) return;
  const c = liftCost(it); if (S.god.faith < c) return toast('Не хватает веры.');
  S.god.faith -= c; const k = it.curse.k; it.curse = null; addTrust(3); addGxp(c / 3); shiftAlign(1); recalcHp();
  diary(`✨ Бог снял с «${it.n}» проклятие ${CURSES[k].n}. Предмет перестал хихикать по ночам.`, 'god', '+3 доверия');
}
const INV_MAX = 16;
function randJunk() { const tier = Math.max(1, Math.round(S.hero.lvl / 2)); return { n: pick(ITEMS), v: rnd(3, 12) * tier }; }
function addItem(it) {
  const inv = S.hero.inv;
  if (inv.length >= INV_MAX) { let i = inv.findIndex(x => !x.slot); if (i < 0) i = inv.findIndex(x => !x.set); inv.splice(Math.max(0, i), 1); }
  inv.push(it || randJunk()); return inv[inv.length - 1];
}
function lootDrop(boost, source, o) {
  const h = S.hero; o = o || {};
  if (!o.set && R() < (o.setP || .015)) { const id = setFor(h.lvl, h); if (id) o.set = id; }
  const it = makeItem(undefined, h.lvl, rollRarity(boost), o);
  const worn = equip(it, true);
  const rareCls = it.rar >= 2 || it.set ? 'rare' : 'loot';
  diary(`${source || 'Нашёл'}: «${it.n}» — ${RARITY[it.rar].n}${it.set ? ' (комплект!)' : ''}${worn ? '. Сразу надел!' : !reqOk(h, it) ? '. Пока не по силам — в рюкзак.' : '. Положил в рюкзак.'}`, rareCls, itemDesc(it));
  if (worn && it.curse) diary(`Надел и пожалел: проклятие ${CURSES[it.curse.k].n}! ${CURSES[it.curse.k].d}.`, 'fight');
  if (SILENT && (it.rar >= 2 || it.set)) SILENT.c.items.push(it.n);
  return it;
}
/* Предметы из сохранений v6 и старше → структура v7 */
const BASE_IDX = {}; for (const sl in BASES) for (const b of BASES[sl]) BASE_IDX[sl + ':' + b[0]] = b;
function upgradeItem(it) {
  if (it.slot === 'weapon' && !WCAT[it.cat]) { const b = BASE_IDX['weapon:' + it.base]; const L = LEGENDARY.find(x => x.n === it.base); it.cat = b ? b[1] : L && L.cat ? L.cat : /лук|рогат|арбал/i.test(it.base) ? 'bow' : /посох|жезл/i.test(it.base) ? 'staff' : /кинжал|нож|стилет/i.test(it.base) ? 'dagger' : /топор|секир/i.test(it.base) ? 'axe' : /лютн|балалай/i.test(it.base) ? 'music' : /двуруч|алебард|скалк/i.test(it.base) ? 'two' : 'sword'; if (WCAT[it.cat].h2) it.h2 = 1; }
  if (it.slot === 'armor' && !ARM_KIND[it.kind]) { const b = BASE_IDX['armor:' + it.base]; it.kind = b ? b[3] : 'l'; }
  if (it.unique && !it.fl) { const L = LEGENDARY.find(x => x.n === it.base); if (L) it.fl = L.fl; }
  if (!it.req) it.req = { lvl: 1 };
  return it;
}
/* Эффекты снаряжения в бою на дороге */
function roadFx(h) { const g = gearFx(h); return { cat: wTraits(h).cat, xatk: g.xatk, blk: g.blk * .8, dodgeN: propCnt(h, 'dodge'), acrit: g.acrit }; }
/* Лавка в городе: вещи по уровню героя, сначала в пустые слоты */
function shopPick(h, L) {
  if (R() > .6) return null;
  const empty = EQ_KEYS.filter(k => !h.eq[k] && !(k === 'offhand' && h.eq.weapon && h.eq.weapon.h2));
  for (let i = 0; i < 3; i++) {
    const k = empty.length && R() < .7 ? pick(empty) : pick(EQ_KEYS), slot = k === 'ring2' ? 'ring' : k === 'offhand' && h.cls === 'rogue' ? 'weapon' : k;
    const it = makeItem(slot, L, R() < .05 ? 2 : R() < .3 ? 1 : 0); it.curse = null; it.n = nameOf(it);
    if (reqOk(h, it) && bestPlace(h, it)) return it;
  }
  return null;
}

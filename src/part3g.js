/* ---------- v8: путь (билд) героя — выбор, характеристики, передумывание, переучивание ---------- */
const bldId = h => h && h.bld && BUILDS[h.bld.id] ? h.bld.id : null;
const BLD = h => BUILDS[bldId(h)] || null;
const bldName = (id, form) => BUILDS[id] ? `${BUILDS[id].ic} ${(form === 't' ? BUILDS[id].t : BUILDS[id].n).toLowerCase()}` : '';
/* Веса характеристик пути (+ атакующая характеристика класса: бить всё равно надо) */
function bldStatW(h, id) {
  const B = BUILDS[id || bldId(h)], c = CLASSES[h.cls] || CLASSES.warrior, w = {};
  for (const k of STATS) w[k] = .1;
  if (B) for (const k in B.st) w[k === 'prim' ? c.prim : k] += B.st[k]; else { w[c.prim] += 3; w.con += 1.5; }
  w[c.atk] += 1; w.con += .4;
  return w;
}
/* Насколько путь подходит герою: класс, раса, характеристики, характер бога, снаряжение */
function bldFit(h, id) {
  const B = BUILDS[id], w = bldStatW(h, id), st = h.st || {};
  let sw = 0, sf = 0; for (const k of STATS) { sw += w[k]; sf += w[k] * ((st[k] || 10) - 10); }
  let s = (B.cls.includes(h.cls) ? 4 : .4) + (B.race.includes(h.race) ? 1 : 0) + sf / sw * .5;
  const al = typeof S !== 'undefined' && S && S.god ? S.god.align : 0; s += B.al * al / 60;
  if (h.eq) for (const it of Object.values(h.eq)) if (it) { if (it.slot === 'weapon' && B.cats.includes(it.cat)) s += .8; if (it.kind && it.kind === B.kind) s += .3; if (B.sh && isShield(it)) s += .6; for (const p of it.props || []) if (B.props.includes(p.k)) s += .3; }
  return s;
}
function pickBuild(h, excl, rnd0) {
  let best = null, bs = -1e9;
  for (const id in BUILDS) { if (id === excl) continue; const s = bldFit(h, id) + R() * (rnd0 == null ? 2.5 : rnd0); if (s > bs) { bs = s; best = id; } }
  return best;
}
/* Ботам и соперникам — путь по классу (с долей случайности) */
function bldForBot(cls, race) {
  const ids = Object.keys(BUILDS), w = ids.map(id => (BUILDS[id].cls.includes(cls) ? 4 : .35) + (BUILDS[id].race.includes(race) ? .8 : 0));
  let r = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; } return ids[0];
}
const mkBld = (id, why, lvl) => ({ id, age: 0, cd: BLD_K.cd, loss: 0, nolvl: 0, hist: [{ id, why, lvl: lvl || 1 }], re: null });
const bldSay = (why, id, it) => pick(BLD_SAY[why] || BLD_SAY.start).replace('{b}', bldName(id)).replace('{t}', bldName(id, 't')).replace('{i}', it ? it.n : '');
function initBuild(h, why) {
  const id = pickBuild(h, null); h.bld = mkBld(id, why || 'start', h.lvl); h.bld.cd = BLD_K.cd / 2;
  if (why !== 'migr') diary(`🧭 ${bldSay('start', id)}`, 'level', `путь: ${bldName(id)}`);
  return id;
}
/* Какую характеристику качать: по пути + та, что нужна для желанной вещи из рюкзака */
function buildStat(h, n) {
  const w = bldStatW(h);
  for (const it of h.inv || []) if (it.slot && it.req && it.req.s && it.req.v && !reqOk(h, it) && (h.lvl >= (it.req.lvl || 1) - 1)) {
    const ks = it.req.s.split('/'), k = ks.sort((a, b) => h.st[b] - h.st[a])[0]; if (STATS.includes(k) && h.st[k] < it.req.v && h.st[k] < 20) { const top = Math.max(...STATS.map(q => w[q])); w[k] = Math.max(w[k] + 2.5, top * 1.25); }
  }
  let best = null, bs = -1;
  for (const k of STATS) { if (h.st[k] >= 20) continue; const s = w[k] / (1 + Math.max(0, h.st[k] - 15) * .25) * (.85 + R() * .3); if (s > bs) { bs = s; best = k; } }
  return best || CLASSES[h.cls].prim;
}
/* Что сам герой хочет взять на чётном уровне */
function heroFeatPref(h, opts) {
  const B = BLD(h); opts = opts || [];
  if (B) { const f = B.feats.find(x => opts.includes(x) && !h.feats.includes(x)); if (f) return { feat: f }; }
  if (!B && opts.length && R() < .5) return { feat: opts[0] };
  return { asi: buildStat(h) };
}
const STAT_DAT = { str: 'Силе', dex: 'Ловкости', con: 'Телосложению', int: 'Интеллекту', wis: 'Мудрости', cha: 'Харизме' };
const prefText = p => p.feat ? `черту «${FEATS[p.feat].n}»` : `+2 к ${STAT_DAT[p.asi]}`;
/* Послушается ли герой бога, когда тот советует не то, что хочет он сам (мягче, чем в развилках) */
const prefObeyP = () => Math.max(.55, obeyChance());
/* ---------- Передумывание ---------- */
function startRespec(id, why, it) {
  const h = S.hero; if (!BUILDS[id]) return false;
  if (!h.bld) h.bld = mkBld(id, why, h.lvl);
  const from = h.bld.id; if (from === id) return false;
  h.bld.id = id; h.bld.age = 0; h.bld.cd = BLD_K.cd; h.bld.loss = 0; h.bld.nolvl = 0;
  h.bld.hist.push({ id, why, lvl: h.lvl }); if (h.bld.hist.length > 8) h.bld.hist.splice(0, h.bld.hist.length - 8);
  const pts = Math.min(6, Math.max(1, Math.floor(h.lvl / 2)));
  h.bld.re = { from, pts, n: pts, t: BLD_K.respec };
  diary(`🧭 ${bldSay(why, id, it)}`, 'level', `путь: ${bldName(from)} → ${bldName(id)} · переучивание ${pts} очк.`);
  if (!SILENT) toast(`🧭 Герой выбрал путь: ${bldName(id)}`);
  return true;
}
function reconsider(why, id, it) {
  const h = S.hero; if (!h.bld || h.bld.cd > 0) return false;
  return startRespec(id || pickBuild(h, h.bld.id), why, it);
}
/* Итоги боёв: серия поражений заставляет задуматься */
function bldResult(won, kind) {
  const B = S.hero.bld; if (!B) return;
  if (won) { B.loss = Math.max(0, B.loss - .5); return; }
  B.loss += kind === 'dun' ? 2 : 1;
  if (B.loss >= BLD_K.loss && B.cd <= 0) { B.loss = 0; if (R() < .6) reconsider(kind === 'dun' ? 'dun' : 'loss'); }
}
/* Нашёл отличную вещь, которая подходит другому пути */
function bldItem(it) {
  const h = S.hero, B = h.bld; if (!B || B.cd > 0 || !it || !it.slot || (it.rar || 0) < 3) return;
  const fits = id => { const X = BUILDS[id]; return (it.slot === 'weapon' && X.cats.includes(it.cat) ? 2 : 0) + (it.props || []).filter(p => X.props.includes(p.k)).length + (X.sh && isShield(it) ? 1 : 0) + (it.kind && it.kind === X.kind ? .5 : 0); };
  const cur = fits(B.id); let best = null, bs = cur + 1.5;
  for (const id in BUILDS) if (id !== B.id && fits(id) >= bs) { bs = fits(id); best = id; }
  if (best && (BUILDS[best].cls.includes(h.cls) || R() < .2) && R() < .15) reconsider('item', best, it);
}
/* Время: перезарядка, застой, переучивание (по очку за отдых в городе/трактире) */
function bldTick(gdt) {
  const h = S.hero, B = h.bld; if (!B) return;
  B.age += gdt; if (B.cd > 0) B.cd = Math.max(0, B.cd - gdt);
  if (h.lvl < MAX_LVL) B.nolvl += gdt;
  if (B.nolvl > BLD_K.stuck) { B.nolvl = 0; if (B.cd <= 0 && R() < .25) reconsider('stuck'); }
  const re = B.re; if (!re) return;
  if (['dead', 'fight', 'dungeon', 'duel'].includes(h.state)) return;
  re.t -= gdt * (h.state === 'rest' || h.state === 'town' ? 1 : .35);
  if (re.t > 0) return;
  re.t = BLD_K.respec;
  const wo = bldStatW(h, re.from), wn = bldStatW(h);
  let fk = null, fs = 0, tk = null, ts = 0;
  for (const k of STATS) { const d = wo[k] - wn[k]; if (h.st[k] > 9 && d > fs) { fs = d; fk = k; } const e = wn[k] - wo[k]; if (h.st[k] < 20 && e > ts) { ts = e; tk = k; } }
  if (!fk || !tk || fk === tk) { B.re = null; diary('🧭 Переучиваться больше нечему — характеристики и так подходят новому пути.', 'level'); return; }
  const fee = Math.min(h.gold, BLD_K.fee[0] + BLD_K.fee[1] * h.lvl); h.gold -= fee;
  h.st[fk]--; h.st[tk]++; re.pts--; if (fk === 'con' || tk === 'con') recalcHp();
  diary(`🏋 Переучиваюсь у тренера${fee ? ` (за ${fee} 💰)` : ' (в долг, тренер добрый)'}: ${STAT_SHORT[tk]} +1, ${STAT_SHORT[fk]} −1.${re.pts > 0 ? ` Осталось ${re.pts}.` : ' Переучивание закончено!'}`, 'level');
  if (re.pts <= 0) { B.re = null; tryEquipInv(); }
}
/* Бог советует путь (за веру; герой слушается по доверию) */
function suggestBuild(id) {
  const h = S.hero; if (!BUILDS[id] || !h.bld) return false;
  if (id === h.bld.id) { toast('Герой и так идёт этим путём.'); return false; }
  if (S.god.faith < BLD_K.suggest) { toast('Не хватает веры.'); return false; }
  S.god.faith -= BLD_K.suggest; addGxp(5);
  const p = obeyChance() * (h.bld.cd > 0 ? .7 : 1);
  if (R() < p) { h.bld.cd = 0; startRespec(id, 'god'); addTrust(1); return true; }
  diary(`🙄 ${bldSay('no', id)}`, 'god'); return false;
}
/* Боевой бонус пути для бойца в бою по зонам */
function bldFx(id, cls) {
  const B = BUILDS[id]; if (!B) return null;
  const f = Object.assign({}, B.fx), K = BUILD_BAL[id] || { d: 1, r: 1 };
  if (f.spell) { const c = CLASSES[cls]; if (c && (c.atk === 'int' || c.atk === 'wis' || c.atk === 'cha')) f.dmg = (f.dmg || 0) + f.spell; else f.crit = (f.crit || 0) + .04; delete f.spell; }
  f.d = K.d; f.r = K.r; f.id = id; return f;
}
/* Миграция v8: путь угадываем по характеристикам и снаряжению */
function inferBuild(h) { return pickBuild(h, null, .2); }

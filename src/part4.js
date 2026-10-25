
/* =====================================================================
   5) ИНТЕРФЕЙС
   ===================================================================== */
/* Мини-«морфинг» DOM: обновляем только изменившиеся узлы, чтобы кнопки не пересоздавались и клики не терялись */
function syncChildren(a, b) {
  const an = a.childNodes, bn = Array.from(b.childNodes);
  for (let i = 0; i < bn.length; i++) {
    const n = bn[i], o = an[i];
    if (!o) { a.appendChild(n.cloneNode(true)); continue; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { a.replaceChild(n.cloneNode(true), o); continue; }
    if (n.nodeType === 1) {
      for (const at of Array.from(o.attributes)) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
      for (const at of Array.from(n.attributes)) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
      if (o.tagName === 'BUTTON') o.disabled = n.hasAttribute('disabled');
      if (!n.hasAttribute('data-keep')) syncChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  }
  while (an.length > bn.length) a.removeChild(a.lastChild);
}
function setHTML(el, html) {
  if (el._h === html) return; el._h = html;
  const t = document.createElement('template'); t.innerHTML = html; syncChildren(el, t.content);
}
const pct = (a, b) => clamp(b ? a / b * 100 : 0, 0, 100).toFixed(1) + '%';
const bar = (cls, a, b, id) => `<div class="bar ${cls}"><i ${id ? 'id="' + id + '"' : ''} style="width:${pct(a, b)}"></i></div>`;
const faithChip = () => `<span class="faithChip" title="Текущая вера">🔥 ${Math.floor(S.god.faith)} / ${maxFaith()}</span>`;
function olyChip() { const O = S.oly, r = olyRank(); return `<button class="linkbtn olyc" data-act="mtab" data-arg="gods" title="Война за Олимп: ваше место в сезоне ${O.n} и сколько осталось">🏛 #${r}${r <= OLY_K.thrones ? ' ' + THRONES[r - 1][0] : ''} · ${fmtLeft(O.end - olyNow())}</button>`; }
const STATE_RU = { road: 'в пути', fight: 'в бою', town: 'в городе', dead: 'мёртв 💀', duel: 'на арене ⚔', rest: 'отдыхает 💤', dungeon: 'в пещере 🏰' };
/* ---------- Кукла героя (как в БК) и карточка предмета ---------- */
const itemIc = it => it.slot === 'weapon' && WCAT[it.cat] ? WCAT[it.cat].ic : SLOT_IC[it.slot];
function dollCell(h, k) {
  const it = h.eq[k];
  if (!it) { const blocked = k === 'offhand' && h.eq.weapon && h.eq.weapon.h2;
    return `<div class="slotc empty" title="${SLOT_RU[k]}: ${blocked ? 'занято двуручным оружием' : 'пусто'}"><span class="ci">${blocked ? '🚫' : SLOT_IC[k]}</span><span class="cn">${blocked ? 'двуручное' : SLOT_RU[k]}</span></div>`; }
  return `<button class="slotc r${it.rar}" style="border-color:${RARITY[it.rar].c}" data-act="itemD" data-arg="eq:${k}" title="${esc(it.n)}" aria-label="${esc(SLOT_RU[k] + ': ' + it.n)}"><span class="ci">${itemIc(it)}</span><span class="cn">${esc(it.base)}</span><span class="cb">${it.plus ? `<i>+${it.plus}</i>` : ''}${it.set ? '<i>🧩</i>' : ''}${it.curse ? '<i class="cur">☠</i>' : ''}</span></button>`;
}
function setProgress(h) {
  const c = setCounts(h), ids = new Set(Object.keys(c)); for (const i of h.inv) if (i.set) ids.add(i.set);
  return [...ids].map(id => { const n = c[id] || 0, S0 = SETS[id], next = Object.keys(S0.b).map(Number).find(x => x > n);
    return `<span class="setc ${n >= 2 ? 'on' : ''}" title="${esc(Object.keys(S0.b).map(x => `${x}: ${setBonusText(id, x)}`).join(' · '))}">🧩 ${esc(S0.n)} ${n}/${S0.pcs.length}${next ? ` · бонус на ${next}` : ''}</span>`; }).join('');
}
function dollHTML(h) {
  const sh = sheet(), za = zoneArmor(h, S.flock.temple), sp = setProgress(h);
  return `<h3>Снаряжение</h3><div class="doll">
    <div class="dcol">${['helm', 'amulet', 'armor', 'belt', 'boots'].map(k => dollCell(h, k)).join('')}</div>
    <div class="dmid"><div class="dav visav">${visHTML(h, { size: 'lg', tap: false })}</div><div class="dgsv" title="${esc(gsTip(h))}">⚔ ГС <b>${gearScore(h)}</b></div>
      <div class="dst">урон ≈${Math.round(sh.avg)}<br>КД ${sh.ac} · ❤ ${h.maxHp}</div>
      <div class="dza" title="Броня по зонам в бою: шлем — голова, броня — грудь и живот, пояс — пояс, сапоги — ноги">${ZONES.map(z => `<span>${ZONE_RU[z]} <b>${Math.round(za[z])}</b></span>`).join('')}</div></div>
    <div class="dcol">${['weapon', 'offhand', 'gloves', 'ring', 'ring2'].map(k => dollCell(h, k)).join('')}</div>
  </div>${sp ? `<div class="sets">${sp}</div>` : ''}
  <div class="muted">Нажмите на вещь — подробности. Подземелья: ${DUN_TIER_KEYS.map(k => `${DUN_TIERS[k].ic} рек. ГС ${recGS(h.lvl, k)}`).join(' · ')}.</div>`;
}
function findItemRef(ref) {
  const h = S.hero, [t, id] = String(ref || '').split(':');
  if (t === 'eq' && EQ_KEYS.includes(id) && h.eq[id]) return { it: h.eq[id], key: id };
  if (t === 'inv') { const it = h.inv.find(i => i.id === id && i.slot); if (it) return { it, inv: true }; }
  return null;
}
function itemModal(ref) {
  const h = S.hero, f = findItemRef(ref); if (!f) return sheetModal();
  const it = f.it, c = it.slot === 'weapon' ? WCAT[it.cat] : null, rq = reqHtml(h, it);
  let set = '';
  if (it.set) { const S0 = SETS[it.set], n = setCounts(h)[it.set] || 0, eqB = equipped(h).map(i => i.set === it.set && i.base), invB = h.inv.filter(i => i.set === it.set).map(i => i.base);
    set = `<div class="setbox"><b>🧩 Комплект «${esc(S0.n)}» — надето ${n} из ${S0.pcs.length}</b>
      <div class="setp">${S0.pcs.map(p => `<span class="${eqB.includes(p[1]) ? 'on' : invB.includes(p[1]) ? 'bag' : ''}">${eqB.includes(p[1]) ? '✔' : invB.includes(p[1]) ? '🎒' : '·'} ${SLOT_IC[p[0]]} ${esc(p[1])}</span>`).join('')}</div>
      ${Object.keys(S0.b).map(x => `<div class="setb ${n >= +x ? 'on' : ''}">${x} ${plural(+x, 'предмет', 'предмета', 'предметов')}: ${esc(setBonusText(it.set, x))}</div>`).join('')}
      <div class="fl">${esc(S0.fl)}</div></div>`; }
  let cmp = '';
  if (f.inv) { const b = bestPlace(h, it, true, true); if (b) { const cur = h.eq[b.k]; const d = gearScore({ eq: b.eq, cls: h.cls }) - gearScore(h);
    cmp = `<div class="cmp">Вместо: ${cur ? itemSpan(cur) : `<span class="muted">${SLOT_RU[b.k]} пусто</span>`}${b.gone.length > 1 ? ' и щита (двуручное!)' : ''} · ГС <b class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '+' : ''}${d}</b>${b.sc > .01 ? ' · герой считает это улучшением' : ''}</div>`; } }
  const btns = [];
  if (f.inv) btns.push(`<button class="btn green" data-act="equipInv" data-arg="${it.id}" ${reqOk(h, it) ? '' : 'disabled'}>Надеть</button>`);
  if (f.key && smithOk(it)) btns.push(`<button class="btn small" data-act="smith" data-arg="${f.key}" ${h.gold < smithCost(it) || S.fight || S.dun ? 'disabled' : ''}>🔨 +1 · ${smithCost(it)} 💰</button>`);
  if (f.key && it.curse) btns.push(`<button class="btn small red" data-act="liftS" data-arg="${f.key}" ${S.god.faith < liftCost(it) ? 'disabled' : ''}>Снять ☠ · ${liftCost(it)}</button>`);
  modal(`<div class="sheet itemd"><h2 style="color:${RARITY[it.rar].c}">${itemIc(it)} ${esc(it.n)}</h2>
    <div class="muted">${RARITY[it.rar].n} · ${SLOT_RU[f.key || it.slot]} · ГС ${itemGS(it)}${f.key ? ' · надето' : ' · в рюкзаке'}</div>
    <ul class="ist">${itemStats(it).map(x => `<li>${esc(x)}</li>`).join('')}${c ? `<li>${c.ic} ${esc(c.t)}</li>${c.cls.includes(h.cls) ? `<li class="aff">✦ любимое оружие класса «${CLASSES[h.cls].n}»: +1 к попаданию, +8% урона</li>` : ''}` : ''}
    ${it.props.map(p => `<li>${PROP_IC[p.k] || '✧'} ${esc(propText(p))}</li>`).join('')}${it.curse ? `<li class="cur">☠ проклятие ${esc(CURSES[it.curse.k].n)}: ${esc(CURSES[it.curse.k].d)}</li>` : ''}</ul>
    <div class="req">${rq || 'Требований нет'}</div>${it.fl ? `<div class="fl">«${esc(it.fl)}»</div>` : ''}${set}${cmp}
    <div class="btns">${btns.join('')}<button class="btn small" data-act="sheet">← К герою</button></div></div>`);
}
const itemSpan = it => `<span class="r${it.rar}${it.curse ? ' cursed' : ''}" title="${esc(RARITY[it.rar].n + ': ' + itemDesc(it))}">${esc(it.n)}${it.curse ? ' ☠' : ''}</span>`;

/* ---------- v11: верхняя панель, тема по характеру бога ---------- */
const GOD_AV = { 'Всеблагой': '😇', 'Добрый': '☀️', 'Себе на уме': '🌀', 'Суровый': '😠', 'Гневный': '👿' };
const themeOf = a => a >= 25 ? 'good' : a <= -25 ? 'evil' : 'neutral';
function renderHeader() {
  const g = S.god, B = document.body, at = alignTitle(g.align), th = themeOf(g.align);
  if (B.dataset.theme !== th) { B.dataset.theme = th; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'evil' ? '#1e0c10' : th === 'neutral' ? '#121a28' : '#221a3e'; }
  $('hAv').textContent = GOD_AV[at] || '🙂';
  $('hGod').textContent = g.name;
  const rw = S.oly && S.oly.rew;
  $('hTitle').textContent = rw ? `${rw.ic} ${rw.title}` : `${at} · паства ${Math.floor(S.flock.fol)}`;
  const av = $('hAv'), fc = 'gav' + (rw ? ' fr ' + rw.frame : ''); if (av.className !== fc) av.className = fc;
  B.classList.toggle('olyF', !!rw); if (rw) { if (B.dataset.frame !== rw.frame) B.dataset.frame = rw.frame; } else if (B.dataset.frame) delete B.dataset.frame;
  const rate = faithRegen() * 60;
  setHTML($('hFaith'), `🔥 ${Math.floor(g.faith)} / ${maxFaith()}<span class="rate">+${rate >= 10 ? Math.round(rate) : rate.toFixed(1)}/мин</span>`);
  $('hFaithBar').style.width = pct(g.faith, maxFaith());
  $('faithMeter').title = `Вера: ${Math.floor(g.faith)} из ${maxFaith()}, растёт на ${faithRegen().toFixed(2)} в секунду (${Math.round(faithRegen() * 3600)} в час). Тратится на силы, глас, чудеса и храм.`;
  setHTML($('hGxp'), `Ур. ${g.lvl}${g.sp ? `<span class="stars" title="Неизрасходованные очки сил">${'★'.repeat(Math.min(3, g.sp))}${g.sp > 3 ? '+' + (g.sp - 3) : ''}</span>` : ''}`);
  $('hLvl').title = `Уровень бога ${g.lvl}: ${g.xp}/${gxpNext(g.lvl)} опыта. ${g.sp ? `★ ${g.sp} — очки сил, потратьте во вкладке «Силы».` : 'Очки сил ★ дают за новые уровни.'}`;
  $('hGxpBar').style.width = pct(g.xp, gxpNext(g.lvl));
  const vb = $('voiceBtn'), vdis = g.faith < 5 || S.hero.state === 'dead' || S.hero.state === 'duel' || S.hero.state === 'dungeon' || !!S.fight;
  vb.disabled = vdis; document.querySelectorAll('#voiceBar .chip').forEach(c => { if (c.disabled !== vdis) c.disabled = vdis; });
  const h = S.hero, hm = $('hpMeter'), dead = h.state === 'dead', narrow = innerWidth <= 430;
  $('hHp').innerHTML = dead ? `💀 ${narrow ? 'мёртв' : `мёртв · встанет через ${fmtDur(Math.max(60, h.deadT))}`}` : `❤ ${narrow ? '' : 'HP: '}${Math.max(0, h.hp)} / ${h.maxHp}${narrow ? '' : `<small>КД ${sheet().ac}</small>`}`;
  $('hHpBar').style.width = dead ? '100%' : pct(h.hp, h.maxHp);
  hm.classList.toggle('dead', dead); hm.classList.toggle('low', !dead && h.hp < h.maxHp * .25);
  hm.title = dead ? 'Герой мёртв. Воскресить можно в карточке героя (30 веры).' : `Здоровье героя: ${h.hp} из ${h.maxHp}, класс доспеха ${sheet().ac}`;
  if (hm._hp !== undefined && hm._max === h.maxHp && !dead && hm._hp - h.hp >= h.maxHp * .15) { hm.classList.remove('hit'); void hm.offsetWidth; hm.classList.add('hit'); }
  if (hm._hp !== undefined && !hm._dead && dead) { hm.classList.remove('hit'); void hm.offsetWidth; hm.classList.add('hit'); }
  hm._hp = h.hp; hm._max = h.maxHp; hm._dead = dead;
  document.querySelectorAll('.speed [data-act=speed]').forEach(b => b.classList.toggle('on', +b.dataset.arg === S.speed));
  $('pauseBtn').textContent = S.paused ? '▶' : '⏸'; $('pauseBtn').classList.toggle('on', S.paused);
  const hh = document.querySelector('header').offsetHeight; if (hh && hh !== renderHeader._h) { renderHeader._h = hh; document.documentElement.style.setProperty('--hdrH', hh + 'px'); }
}
/* ---------- v11: маршрут Город → Лес → Подземелье → Город (точка — из настоящего состояния героя) ---------- */
const ROUTE = [['🏘', 'Город'], ['🌲', 'Лес'], ['🏰', 'Подземелье'], ['🏘', 'Город']];
function routePos(h) {
  const back = momClock - momDunAt, st = h.state;
  if (S.dun || st === 'dungeon') return { f: 2 / 3, node: 2 };
  if (st === 'town' || (st === 'rest' && h.restKind !== 'camp')) return back < 1800 ? { f: 1, node: 3 } : { f: 0, node: 0 };
  if (back < 900) { const k = clamp(back / 900, 0, 1); return { f: 2 / 3 + k / 3 * .85, node: k < .5 ? 2 : 3 }; }
  const q = clamp((h.quest && h.quest.p || 0) / 100, 0, 1);
  return { f: .12 + .3 * q, node: 1 };
}
function routeHTML(h) {
  const p = routePos(h), L = x => (8 + 84 * x).toFixed(1) + '%';
  const special = h.state === 'dead' ? '💀' : S.fight || h.state === 'fight' ? '⚔' : h.state === 'duel' ? '🤺' : h.state === 'rest' ? '💤' : '';
  const dot = special || visHTML(h, { size: 'sm', tap: false, pose: h.state === 'road' ? 'walk' : 'idle' });
  return `<div class="route" role="img" aria-label="Маршрут: ${ROUTE.map(r => r[1]).join(' → ')}; герой сейчас у точки «${ROUTE[p.node][1]}»">
    <div class="rl"><i style="width:${(p.f * 100).toFixed(1)}%"></i></div>
    ${ROUTE.map((r, i) => `<span class="rn ${i === p.node ? 'on' : ''}" style="left:${L(i / 3)}"><b>${r[0]}</b>${r[1]}</span>`).join('')}
    <span class="rdot ${h.state === 'road' && !special ? 'walk' : ''} ${special ? '' : 'hasvis'}" id="routeDot" data-node="${p.node}" style="left:${L(p.f)}">${dot}</span></div>`;
}
function renderHero() {
  const h = S.hero, m = h.monster, b = S.buffs;
  const buffs = [];
  if (b.luck > 0) buffs.push(`🍀 ${Math.ceil(b.luck)}с`); if (b.shield > 0) buffs.push(`🛡 ${Math.ceil(b.shield)}с`); if (b.trade > 0) buffs.push('☠ торговцы');
  const act = h.state === 'rest' ? `💤 ${h.restKind === 'camp' ? 'спит в лагере' : h.restKind === 'temple' ? 'ночует в храме' : 'отдыхает в трактире'}` : (STATE_RU[h.state] || h.state) + (m ? ': ' + esc(m.n) : '');
  const col = !!S.ui.heroCol;
  let html = `<div class="hc-top"><div class="hc-id"><h2>${esc(h.name)}</h2><div class="hc-sub">${RACES[h.race].n} · ${CLASSES[h.cls].n} · ур. ${h.lvl}</div></div>
    <div class="hc-btns"><button class="btn small ghost" data-act="sheet" title="Характеристики, снаряжение, рюкзак">📋<span class="hideXS"> Герой</span></button><button class="btn small ghost hcol" data-act="heroCol" aria-expanded="${!col}" title="${col ? 'Развернуть карточку' : 'Свернуть карточку'}">${col ? '▾' : '▴'}</button></div></div>
  <div class="hc-scene">${scnHTML(h)}</div>
  <div class="hc-now"><span>📍 ${S.oly && S.oly.reg[h.reg] && S.oly.reg[h.reg].own ? godDot(S.oly.reg[h.reg].own) : ''}${esc(h.loc)}</span><span class="st">${act}</span>${S.oly ? olyChip() : ''}${buffs.length ? `<span>${buffs.join(' ')}</span>` : ''}</div>
  ${routeHTML(h)}
  ${m && !S.fight ? `<div class="stat"><label><span>${esc(m.n)}${m.curse ? ' ☠' : ''}</span><span>${Math.max(0, m.hp)}/${m.max}</span></label>${bar('hp', m.hp, m.max)}</div><div class="btns" style="margin-top:4px"><button class="btn small red" data-act="fmanual">🎯 Взять бой под контроль</button></div>` : ''}
  ${h.state === 'dead' ? `<div class="deadbox">💀 Герой мёртв. Встанет сам через ${fmtDur(Math.max(60, h.deadT))} (и обидится).<div class="btns"><button class="btn" data-act="resurrect" ${S.god.faith < 30 ? 'disabled' : ''}>✨ Воскресить · 30</button></div></div>` : ''}
  <div class="hc-more"><div class="hc-bars">
    <div class="stat"><label><span>❤ Здоровье</span><span><b>${Math.max(0, h.hp)}</b>/${h.maxHp}</span></label>${bar('hp', h.hp, h.maxHp)}</div>
    <div class="stat" title="Доверие: ${esc(trustLabel(h.trust))}. Чем выше, тем чаще слушается."><label><span>🤝 Доверие</span><span><b>${Math.round(h.trust)}</b>/100</span></label>${bar('trust', h.trust, 100)}</div>
    <div class="stat"><label><span>⭐ Опыт</span><span>${h.lvl >= MAX_LVL ? 'максимум' : `<b>${h.xp}</b>/${xpNext(h.lvl)}`}</span></label>${bar('xp', h.xp, h.lvl >= MAX_LVL ? 1 : xpNext(h.lvl))}</div>
    <div class="stat"><label><span>📌 ${esc(h.quest.n)}</span><span><b>${Math.min(100, Math.floor(h.quest.p))}</b>%</span></label>${bar('quest', h.quest.p, 100)}</div>
  </div>
  <div class="hc-mini">${bldChip(h)}<button class="linkbtn gsc" data-act="sheet" title="${esc(gsTip(h))}">⚔ ГС <b>${gearScore(h)}</b>${equipped(h).some(it => it.curse) ? ' <span class="cur" title="Надет проклятый предмет">☠</span>' : ''}</button><span title="Золото"><b>${h.gold}</b> 💰</span><span title="Зелья"><b>${h.potions}</b> 🧪</span><span title="Привалы"><b>${h.shortRests}</b> ⛺</span>
    ${h.inj.length ? `<button class="linkbtn" data-act="sheet" style="color:#8c2e20">🤕 травмы: ${h.inj.length}</button>` : ''}</div></div>`;
  setHTML($('colHero'), html);
  if (typeof visPaintCheck === 'function') visPaintCheck($('colHero'));
  document.body.classList.toggle('heroCol', col);
}
/* ---------- v8: путь героя в интерфейсе ---------- */
const bldPri = (h, id) => { const w = bldStatW(h, id); return STATS.slice().sort((a, b) => w[b] - w[a]).slice(0, 3); };
function bldTip(h) {
  const id = bldId(h), B = BUILDS[id]; if (!B) return '';
  return `${B.n}: ${B.d} Качает ${bldPri(h).map(k => STAT_SHORT[k]).join(' › ')}.${h.bld.re ? ` Переучивается (${h.bld.re.n - h.bld.re.pts}/${h.bld.re.n}).` : ''}`;
}
function bldChip(h) { const B = BLD(h); return B ? `<button class="linkbtn bldc" data-act="sheet" title="${esc(bldTip(h))}" aria-label="Путь: ${esc(B.n)}">${B.ic} ${esc(B.n)}${h.bld.re ? ' <span class="re">⟳</span>' : ''}</button>` : ''; }
function bldLikes(B) {
  const o = []; if (B.sh) o.push('щит'); if (B.h2) o.push('двуручное'); o.push(B.cats.map(c => WCAT[c].n.toLowerCase()).join('/'));
  if (B.kind) o.push({ c: 'тканевую броню', l: 'лёгкую броню', h: 'тяжёлую броню' }[B.kind]); o.push(B.props.filter(k => PROP_DEF[k] && !STATS.includes(k)).slice(0, 3).map(k => PROP_RU[k] || PROP_DEF[k].n.toLowerCase()).join(', '));
  return o.filter(Boolean).join(' · ');
}
function bldHTML(h) {
  const id = bldId(h), B = BUILDS[id]; if (!B) return '';
  const re = h.bld.re, hist = h.bld.hist.slice(-4);
  return `<h3>🧭 Путь: ${B.ic} ${esc(B.n)}</h3><div class="bldbox"><div class="muted">${esc(B.d)}</div>
    <div class="bldp">Качает: <b>${bldPri(h).map(k => STAT_SHORT[k]).join(' › ')}</b> · любит: ${esc(bldLikes(B))}</div>
    ${re ? `<div class="bldre">⟳ Переучивается с пути ${bldName(re.from)}: ${re.n - re.pts}/${re.n} очк. — по очку за отдых у тренера.</div>${bar('xp', re.n - re.pts, re.n)}` : ''}
    ${hist.length > 1 ? `<div class="bldh">История: ${hist.map(x => `<span title="${esc(BLD_WHY[x.why] || '')}">${BUILDS[x.id].ic} ур.${x.lvl}</span>`).join(' → ')} <span class="muted">(${esc(BLD_WHY[hist[hist.length - 1].why] || '')})</span></div>` : ''}
    <div class="btns"><button class="btn small" data-act="bldOpen" ${S.god.faith < BLD_K.suggest ? 'disabled' : ''}>🙏 Посоветовать путь · ${BLD_K.suggest} веры</button>${h.bld.cd > 0 ? `<span class="muted small">ещё не остыл после выбора: послушается реже</span>` : ''}</div></div>`;
}
function bldModal() {
  const h = S.hero, cur = bldId(h), p = Math.round(obeyChance() * (h.bld && h.bld.cd > 0 ? .7 : 1) * 100);
  modal(`<div class="sheet"><h2>🙏 Какой путь посоветовать?</h2><div class="muted">Совет стоит ${BLD_K.suggest} веры. Герой послушается с шансом ~${p}% (доверие${h.bld && h.bld.cd > 0 ? ', и он недавно уже менял путь' : ''}). Переучивание идёт постепенно: по очку характеристики за отдых.</div>
  <div class="opts">${Object.keys(BUILDS).map(id => { const B = BUILDS[id]; return `<button class="btn bldopt ${id === cur ? 'on' : ''}" data-act="bldPick" data-arg="${id}" ${id === cur ? 'disabled' : ''}><b>${B.ic} ${B.n}</b>${B.cls.includes(h.cls) ? ' <span class="tag cls">к лицу</span>' : ''}<br><span class="small">${esc(B.d)} Качает ${bldPri(h, id).map(k => STAT_SHORT[k]).join(' › ')}.</span></button>`; }).join('')}</div>
  <div class="btns"><button class="btn" data-act="sheet">← К герою</button></div></div>`);
}
function sheetModal() { modal(`<div class="sheet">${sheetHTML()}<div class="btns"><button class="btn" data-act="closeModal">Закрыть</button></div></div>`); }
function sheetHTML(inline) {
  const h = S.hero, sh = sheet(), c = CLASSES[h.cls], r = RACES[h.race];
  return (`<${inline ? 'h3' : 'h2'}>📋 ${esc(h.name)} — ${r.n.toLowerCase()}-${c.n.toLowerCase()}, ур. ${h.lvl}</${inline ? 'h3' : 'h2'}>
  <div class="stgrid">${STATS.map(k => `<div class="${c.prim === k ? 'pr' : ''}">${STAT_SHORT[k]}<b>${statVal(k)}</b>${fmtMod(mod(statVal(k)))}</div>`).join('')}</div>
  <div class="muted">Бой: атака ${fmtMod(sh.atkB)} · урон d${sh.die}${sh.dmgB ? fmtMod(sh.dmgB) : ''} (≈${Math.round(sh.avg)}) · КД ${sh.ac} · HP ${h.maxHp}. Владение ★: ${c.prof.map(k => STAT_SHORT[k]).join(', ')} (${fmtMod(profB(h.lvl))}).</div>
  <div class="stat"><label><span>Доверие к богу</span><span>${Math.round(h.trust)} — ${trustLabel(h.trust)}, слушается ~${Math.round(obeyChance() * 100)}%</span></label>${bar('trust', h.trust, 100)}</div>
  ${h.inj.length ? `<h3>🤕 Травмы</h3>${h.inj.map(j => `<div class="injrow">${esc(j.n)}: ${STAT_SHORT[j.s]} −${INJURIES[j.k].pen}, пройдёт за ${fmtDur(j.t)}</div>`).join('')}<div class="muted">Лечат время, долгий отдых, храм и «Исцеление».</div>` : ''}
  ${bldHTML(h)}${dollHTML(h)}
  <h3>🎒 Рюкзак (${h.inv.length}/${INV_MAX})</h3><ul class="inv">${h.inv.length ? h.inv.map(i => i.slot ? `<li><button class="linkbtn invb" data-act="itemD" data-arg="inv:${i.id}">${itemSpan(i)}</button>${!reqOk(h, i) ? ` <span class="rqb small">${esc(reqHtml(h, i).replace(/<[^>]+>/g, ''))}</span>` : bestPlace(h, i) ? ' <span class="upg" title="Лучше надетого">▲</span>' : ''} <span class="muted">~${i.v}💰</span></li>` : `<li>${esc(i.n)} <span class="muted">~${i.v}💰</span></li>`).join('') : '<li class="muted">пусто, как в голове после боя</li>'}</ul>
  <h3>Раса и класс</h3><div class="muted"><b>${r.tr}.</b> ${r.td}</div><div class="muted"><b>${c.ab}.</b> ${c.ad}</div>
  <h3>Черты (${h.feats.length})</h3>${h.feats.length ? h.feats.map(f => `<div class="muted">🎖 <b>${FEATS[f].n}</b> — ${FEATS[f].d}</div>`).join('') : '<div class="muted">Пока никаких. Новые — на каждом чётном уровне.</div>'}`);
}
function renderFeat() {
  const box = $('featBox'), F = S.featOffer;
  if (!F) { setHTML(box, ''); return; }
  const mins = Math.ceil(F.t / 60);
  let body;
  if (F.asi) body = `<div class="muted">Какую характеристику прокачать на +2?</div><div class="opts">${STATS.map(k => `<button class="btn" data-act="asi" data-arg="${k}" ${S.hero.st[k] >= 20 ? 'disabled' : ''}>${STAT_RU[k]}: ${S.hero.st[k]} → ${Math.min(20, S.hero.st[k] + 2)}${CLASSES[S.hero.cls].prim === k ? '<span class="tag cls">основная</span>' : ''}</button>`).join('')}<button class="btn small" data-act="asiBack">← Назад к чертам</button></div>`;
  else body = `<div class="opts">${F.opts.map(id => `<button class="btn" data-act="feat" data-arg="${id}">🎖 <b>${FEATS[id].n}</b> — ${FEATS[id].d}</button>`).join('')}<button class="btn" data-act="asiOpen">💪 +2 к характеристике</button></div>`;
  const pf = F.pref ? `<div class="pref">💭 Сам хочет: <b>${prefText(F.pref)}</b>${BLD(S.hero) ? ` (он же ${bldName(S.hero.bld.id)})` : ''}. Посоветуете другое — послушается с шансом ~${Math.round(prefObeyP() * 100)}%.</div>` : '';
  setHTML(box, `<div class="card feat"><h2>🎖 Герой вырос: выберите черту</h2>
  <div class="muted" style="margin-bottom:6px">Не выберете за ~${mins} мин игрового времени — герой решит сам.${S.featQueue > 1 ? ` В очереди ещё ${S.featQueue - 1}.` : ''}</div>${pf}${body}</div>`);
}
/* ---------- v11: дневник — живая лента. Ключ записи — e.i; DOM ограничен, новые записи добавляются без перерисовки всей ленты ---------- */
const D_BIG = ['level', 'death', 'rare', 'fork', 'event', 'duel'], D_MED = ['fight', 'loot', 'oly'];
const D_IC = { fight: '⚔', loot: '💰', rare: '💎', level: '⭐', death: '💀', fork: '✨', event: '🌍', duel: '🤺', god: '🙏', oly: '🏛' };
const D_PAGE = 40;
let diaryLim = D_PAGE, diaryOpen = new Set(), diaryTopSeen = 0, diaryMoreV = -1;
function fxSplit(f) { return String(f || '').split(/,\s+(?![^()]*\))/).filter(Boolean); }
function diaryNode(e) {
  const chips = fxSplit(e.f), dice = chips.filter(x => x.startsWith('🎲')), nums = chips.filter(x => !x.startsWith('🎲'));
  const can = !!(dice.length || (e.d && e.d.length) || nums.length > 3), open = can && diaryOpen.has(e.i);
  const imp = D_BIG.includes(e.c) ? 'big' : D_MED.includes(e.c) ? 'med' : '';
  const ic = D_IC[e.c] && !/^\p{Extended_Pictographic}/u.test(e.x) ? `<span class="eic">${D_IC[e.c]}</span>` : '';
  const shown = open ? nums : nums.slice(0, 3);
  const more = can ? `<span class="emore">${open ? '▴ свернуть' : `▾ ${dice.length ? '🎲 бросок' : e.d && e.d.length ? `ход боя (${e.d.length})` : 'подробнее'}`}</span>` : '';
  const det = open ? `<div class="edet">${dice.map(x => `<div class="dice">${esc(x)}</div>`).join('')}${(e.d || []).map(x => `<div>${esc(x)}</div>`).join('')}</div>` : '';
  const el = document.createElement('div');
  el.className = `entry ${e.c || ''} ${imp} ${e.u ? 'iv' : ''} ${can ? 'can' : ''}`.replace(/\s+/g, ' ').trim();
  el.dataset.id = e.i; el.dataset.k = (open ? 'o' : 'c') + (e.d ? e.d.length : 0);
  if (can) { el.dataset.act = 'dexp'; el.dataset.arg = e.i; el.setAttribute('role', 'button'); el.setAttribute('aria-expanded', open ? 'true' : 'false'); el.tabIndex = 0; }
  el.innerHTML = `<div class="tm">${esc(e.tm || '')}</div><div>${e.u ? '<span class="ivb" title="Это ваше вмешательство">🙏 вмешательство</span>' : ''}${ic}<span class="tx">${esc(e.x)}</span>${more}${shown.length ? `<div class="fx">${shown.map(x => `<span class="fxc">${esc(x)}</span>`).join('')}${!open && nums.length > 3 ? `<span class="fxc">+${nums.length - 3}</span>` : ''}</div>` : ''}${det}</div>`;
  return el;
}
function renderDiary(force) {
  const el = $('diary');
  if (el._s !== S) { el._s = S; el.innerHTML = ''; el._v = null; diaryTopSeen = 0; diaryOpen.clear(); diaryLim = D_PAGE; }
  const key = diaryVer + ':' + diaryLim + ':' + diaryMoreV;
  if (el._v === key && !force) return; el._v = key;
  const list = S.diary.slice(0, diaryLim), have = new Map();
  for (const n of Array.from(el.children)) { const id = +n.dataset.id; if (have.has(id)) n.remove(); else have.set(id, n); }
  let prev = null;
  for (const e of list) {
    if (!e.i) { S.dseq = (S.dseq || 0) + 1; e.i = S.dseq; }
    let n = have.get(e.i);
    const k = (diaryOpen.has(e.i) ? 'o' : 'c') + (e.d ? e.d.length : 0);
    if (n && n.dataset.k !== k) { const nn = diaryNode(e); n.replaceWith(nn); n = nn; }
    if (!n) n = diaryNode(e);
    have.delete(e.i);
    const want = prev ? prev.nextSibling : el.firstChild;
    if (n !== want) el.insertBefore(n, want);
    prev = n;
  }
  for (const n of have.values()) n.remove();
  setHTML($('diaryEmpty'), S.diary.length < 4 ? `<div class="dempty"><div class="ei">🚶</div><b>Герой пока бродит. Дай ему команду</b>Нажмите кнопку гласа внизу — «бей», «копай клад», «проповедуй»… Это стоит 5 веры. Или загляните во вкладку «✨ Силы».</div>` : '');
  setHTML($('diaryMore'), S.diary.length > diaryLim ? `<button class="btn small ghost" data-act="dmore">Показать ещё (${S.diary.length - diaryLim})</button>` : '');
  setHTML($('dCount'), S.diary.length ? `${S.diary.length} ${plural(S.diary.length, 'запись', 'записи', 'записей')}` : '');
  const top = S.diary[0];
  if (top && top.i !== diaryTopSeen) {
    if (diaryTopSeen) { const fresh = S.diary.slice(0, 6).filter(e => e.i > diaryTopSeen); diaryCue(fresh); }
    diaryTopSeen = top.i;
  }
}
/* звук на важные новые записи */
function diaryCue(fresh) {
  if (!fresh.length) return;
  const c = fresh.map(e => e.c);
  if (c.includes('level')) sfx('level'); else if (c.includes('death')) sfx('death'); else if (c.includes('rare')) sfx('rare');
  else if (fresh.some(e => e.c === 'fork' && /^✨/.test(e.x))) sfx('bell');
}
function fxChips(f) { return String(f).split(/,\s+(?![^()]*\))/).filter(Boolean).map(x => `<span class="fxc">${esc(x)}</span>`).join(''); }
function alignTag(a) { return a >= 2 ? '<span class="tag kind">добро</span>' : a <= -2 ? '<span class="tag wrath">гнев</span>' : ''; }
function renderFork() {
  const box = $('forkBox'), fk = S.fork;
  if (!fk || forkPaused()) { setHTML(box, ''); return; }   // в бою/пещере момент ждёт в очереди
  if (fk.m) {
    const bs = momentButtons(fk);
    setHTML(box, `<div class="card fork mom" id="momCard"><div class="momh"><b>✨ Божественный момент</b><span class="momt" id="forkSec"></span></div>
    <div class="q">${esc(fk.txt)}</div>
    <div class="opts mopts">${bs.map((o, k) => `<button class="btn${o.nothing ? ' none' : ''}" data-act="fork" data-arg="${k}"${o.dis ? ' disabled' : ''}><span class="ml">${esc(o.l)}</span>${o.cost ? `<span class="tag cost" title="Стоит веры">🔥${o.cost}</span>` : ''}${o.st ? `<span class="tag chk" title="Проверка характеристики героя">🎲 ${o.st.map(s => STAT_ABBR[s]).join('/')}</span>` : ''}${alignTag(o.a)}</button>`).join('')}</div>
    <div class="bar time thin"><i id="forkBar"></i></div></div>`);
  } else {
    const f = FORKS[fk.i], opts = forkOptions(fk);
    setHTML(box, `<div class="card fork"><div class="momh"><b>🙏 Герой молится вам!</b><span class="momt" id="forkSec"></span></div>
    <div class="q">${esc(tx(f.t))}</div>
    <div class="opts">${opts.map((o, k) => `<button class="btn${o.nothing ? ' none' : ''}" data-act="fork" data-arg="${k}">${esc(o.l)}${alignTag(o.a)}${o.clsOpt ? `<span class="tag cls">${CLASSES[S.hero.cls].n.toLowerCase()}</span>` : ''}</button>`).join('')}</div>
    <div class="bar time thin"><i id="forkBar"></i></div>
    <div class="muted" style="margin-top:6px">Герой послушается с шансом ~${Math.round(obeyChance() * 100)}% (зависит от доверия). Исход зависит от его характеристик.</div></div>`);
  }
  const sec = Math.ceil(fk.t);
  $('forkSec').textContent = `⏳ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} — потом герой решит сам`;
  $('forkBar').style.width = pct(fk.t, fk.T);
}
function renderEvent() {
  const box = $('eventBox'), ev = S.ev;
  if (!ev) { setHTML(box, ''); return; }
  const def = WEVENTS.find(e => e.id === ev.id);
  const live = ev.phase === 'live';
  let body;
  if (live) body = `<div class="muted" style="margin-top:6px">1) Голосуйте за план (голос весит столько, сколько вы вложили силы):</div>
    <div class="btns">${def.o.map((o, k) => `<button class="btn small blue vote ${ev.my.vote === k ? 'on' : ''}" data-act="evVote" data-arg="${k}">${esc(o.l)}</button>`).join('')}</div>
    <div class="muted" style="margin-top:8px">2) Вложите силу — от доли вклада зависит награда. У вас ${faithChip()}, вложено: <b>${ev.my.power}</b></div>
    <div class="btns"><button class="btn small" data-act="evGive" data-arg="10" ${S.god.faith < 10 ? 'disabled' : ''}>+10 веры</button>
      <button class="btn small" data-act="evGive" data-arg="25" ${S.god.faith < 25 ? 'disabled' : ''}>+25 веры</button>
      <button class="btn small" data-act="evGive" data-arg="50" ${S.god.faith < 50 ? 'disabled' : ''}>+50 веры</button>
      <button class="btn small red" data-act="evArmy" ${S.flock.army < 1 ? 'disabled' : ''}>⚔ Послать армию (${S.flock.army})</button></div>`;
  else body = `<div class="q" style="margin-top:8px"><b>${esc(ev.result.text)}</b></div><div class="muted">Ваш вклад: ${ev.result.share}% · ${esc(ev.result.fx)}</div><div class="btns"><button class="btn small" data-act="closeEv">Закрыть</button></div>`;
  setHTML(box, `<div class="card wevent"><h2>${def.ic} Мировое событие: ${esc(def.n)}</h2><div>${esc(def.t)}</div>
    <div class="stat"><label><span>${live ? 'До развязки' : 'Закроется через'}</span><span id="evSec"></span></label><div class="bar time"><i id="evBar"></i></div></div>
    ${body}<div id="evList" data-keep="1"></div></div>`);
  $('evSec').textContent = Math.max(0, Math.ceil(ev.t)) + ' с';
  $('evBar').style.width = pct(ev.t, ev.T);
  const tally = evTally(ev), tsum = tally.reduce((a, b) => a + b, 0) || 1, lead = evLeader(ev), total = evTotal(ev);
  const rows = [{ name: S.god.name + ' (вы)', vote: ev.my.vote, power: ev.my.power, me: 1 }].concat(ev.parts).sort((a, b) => b.power - a.power);
  setHTML($('evList'), `<div class="stat" style="margin-top:10px"><label><span>Сила пантеона (с учётом плана «${esc(def.o[lead].l)}»)</span><span>${Math.round(total * def.o[lead].m)} / ~${ev.thr}</span></label>${bar('faith', total * def.o[lead].m, ev.thr)}</div>
    <div class="muted">${def.o.map((o, k) => `${esc(o.l)}: ${Math.round(tally[k] / tsum * 100)}%`).join(' · ')}</div>
    <div class="evlist">${rows.map(p => `<div class="r ${p.me ? 'me' : ''}"><span>${esc(p.name)}</span><span class="muted">${p.vote === null ? 'думает…' : esc(def.o[p.vote].l)}</span><span>${p.power}</span></div>`).join('')}</div>`);
}
function powerDisabled(id, c) {
  if (S.god.faith < c || S.hero.state === 'dead') return true;
  const F = S.fight;
  if (F) { if (F.phase !== 'turn' || F.powersLeft < 1 || F.usedTurn >= 1) return true; const me = fMe(F); if (!me || !me.alive) return true; }
  else if (S.dun || S.hero.state === 'duel' || S.hero.state === 'dungeon') return true;
  return false;
}
/* v11: почему силу сейчас нельзя применить — короткая подсказка на карточке */
function powerWhy(id) {
  const p = POWERS[id], g = S.god, L = g.skills[id] || 0, c = powerCost(id), F = S.fight;
  if (!L) { if (g.lvl < p.req) return `🔒 нужен ур. ${p.req}`; if (p.pre && !(g.skills[p.pre] >= 1)) return `🔒 сначала «${POWERS[p.pre].n}»`; return g.sp > 0 ? '★ можно изучить' : '🔒 нужно очко ★'; }
  if (S.hero.state === 'dead') return '💀 герой мёртв';
  if (F) { if (F.phase !== 'turn') return '⏳ дождитесь хода'; if (F.powersLeft < 1) return 'лимит 3 за бой'; if (F.usedTurn >= 1) return 'одна сила за ход'; const me = fMe(F); if (!me || !me.alive) return 'герой выбыл'; }
  else if (S.dun || S.hero.state === 'duel' || S.hero.state === 'dungeon') return '⏳ герой занят';
  if (g.faith < c) return `не хватает веры (${Math.floor(g.faith)}/${c})`;
  return '';
}
/* Что сделает сила прямо сейчас — для предпросмотра перед тратой веры */
function powerEffect(id) {
  const h = S.hero, mu = pmult(id), m = h.monster, F = S.fight, lv = h.lvl, pc = x => Math.round(x * 100) + '%';
  if (F && F.phase === 'turn') {
    const me = fMe(F), en = me ? fEnemies(F, me) : [], tg = en.find(e => e.id === F.my.target) || en[0], tn = tg ? `«${tg.name}»` : 'врага';
    return ({ heal: [`Боец ${me ? '«' + me.name + '»' : ''} получит лечение: +${pc(DUN_K.godHeal * mu)} HP${F.kind === 'dungeon' ? ' (павшего — поднимет)' : ''}`], rain: ['Вся ваша команда подлечится: +' + pc(.12 * mu) + ' HP'], bless: ['Следующий удар героя — критический'],
      shield: ['Урон по герою в этом ходу −70%'], luck: ['Герой скользкий, как угорь: +30% к увороту на ход'], curse: [`${tn} ослаблен на 2 хода: бьёт слабее и без критов`], beast: ['Медведь кусает противника 2 хода подряд'],
      bolt: [`Молния по ${tn}: −${pc(.12 * mu)} его HP`], quake: [`Все противники теряют ${pc(.07 * mu)} HP`] })[id].concat(['Сила в бою: ' + F.powersLeft + '/3 осталось, 1 за ход']);
  }
  const hp = x => Math.max(1, Math.round(h.maxHp * x));
  switch (id) {
    case 'heal': return [`Герой получит лечение: +${hp(.3 * mu)} HP`, '+2 доверия', h.inj.length ? 'Исцелит одну травму' : 'Травм нет — просто приятно'];
    case 'bless': return [`🍀 Удача на ${Math.round(5 * mu)} мин: больше золота, удачнее развилки`, '+1 доверия'];
    case 'shield': return [`🛡 Божий щит на ${Math.round(5 * mu)} мин: урон по герою вдвое меньше`];
    case 'bolt': return m ? [`Молния ударит «${m.n}»: −${Math.round((10 + 6 * lv) * mu * (S.god.align <= -30 ? 1.3 : 1))} HP`, '+1 доверия'] : ['⚠ Врага рядом нет — молния попадёт в героя!', `−${hp(.12)} HP герою, −4 доверия`];
    case 'curse': return m ? [`«${m.n}» покроется прыщами и будет биться вдвое слабее`] : ['Торговцы начнут переплачивать: торговля ×1.5 на ' + Math.round(30 * mu) + ' мин'];
    case 'quake': return m ? [`Земля разверзнется под «${m.n}»: −${Math.round((20 + 12 * lv) * mu)} HP`, `Героя тоже тряхнёт: −${hp(.05)} HP`] : ['Из трещины вылезет сундук с золотом'];
    case 'rain': return [`Освежит героя: +${hp(.12 * mu)} HP`, '+1–3 паствы'];
    case 'luck': return ['Герой найдёт клад: золото и вещь (иногда ценную)'];
    case 'beast': return m ? [m.tier <= lv + 1 ? `Медведь разорвёт «${m.n}»` : `Медведь вцепится в «${m.n}»: −${Math.round((15 + 10 * lv) * mu)} HP`] : ['Медведь принесёт герою вещь'];
  }
  return [];
}
const PV_SHORT = { heal: 'лечение', bless: 'удача', shield: 'защита', bolt: 'удар по врагу', curse: 'ослабит врага', quake: 'огромный урон', rain: 'лечение и паства', luck: 'клад', beast: 'медведь в помощь' };
function powerCard(id) {
  const p = POWERS[id], g = S.god, L = g.skills[id] || 0, c = powerCost(id), why = powerWhy(id), dim = !!why && why !== '★ можно изучить';
  return `<button class="pcard ${L ? '' : 'lock'} ${dim ? 'dim' : ''}" data-act="pprev" data-arg="${id}" aria-label="${esc(p.n)}: ${c} веры${why ? ', ' + esc(why) : ''}">
    <span class="pic">${p.ic}</span><span class="pc">🔥${c}</span><span class="pn">${p.n} <span class="pips">${'●'.repeat(L)}${'○'.repeat(3 - L)}</span></span>
    <span class="pd">${esc(p.d.split(/[.!]\s/)[0].replace(/\.$/, ''))}.</span>${why ? `<span class="pw ${why.startsWith('★') ? 'ok' : ''}">${esc(why)}</span>` : `<span class="pw ok">▶ ${PV_SHORT[id]}</span>`}</button>`;
}
const BR_UI = { light: ['☀️', 'Свет'], wrath: ['⚡', 'Гнев'], nature: ['🌿', 'Стихии'] };
function powersHTML() {
  const g = S.god;
  let html = `<div class="row" style="margin-bottom:4px"><span>${faithChip()}</span><span>${g.sp ? `<b>★ ${g.sp}</b> ${plural(g.sp, 'очко', 'очка', 'очков')} сил` : '<span class="muted">★ 0 — новые с уровнем бога</span>'}</span></div>
    <div class="alignLine" title="Добрые дела сдвигают вправо, кары — влево. Свет дешевле у доброго бога, гнев — у гневного."><span>😠</span><div class="align"><i style="left:${(g.align + 100) / 2}%"></i></div><span>😇</span><b>${alignTitle(g.align)}</b></div>`;
  for (const br in BRANCHES) html += `<div class="pgrp ${br}"><h3>${BR_UI[br][0]} ${BR_UI[br][1]} <small>${BRANCHES[br]}</small></h3><div class="pgrid">${Object.keys(POWERS).filter(id => POWERS[id].br === br).map(powerCard).join('')}</div></div>`;
  return html + '<div class="hint">Нажмите на карточку — покажу, что случится, и попрошу подтвердить.</div>';
}
function powerModal(id) {
  const p = POWERS[id]; if (!p) return;
  const g = S.god, L = g.skills[id] || 0, c = powerCost(id), why = powerWhy(id), canLearn = g.sp > 0 && L < 3 && (!p.pre || g.skills[p.pre] >= 1) && g.lvl >= p.req;
  const fx = powerEffect(id), dis = !L || powerDisabled(id, c);
  modal(`<div class="pprev"><div class="pbig">${p.ic}</div><h2 style="border:none">${p.n} <span class="pips">${'●'.repeat(L)}${'○'.repeat(3 - L)}</span></h2>
    <div class="muted">${BR_UI[p.br][0]} ${BRANCHES[p.br]} · ${p.al > 0 ? 'добрая сила' : p.al < 0 ? 'карающая сила' : 'нейтральная сила'}</div>
    ${L ? `<div class="pq">Потратить ${c} веры? ${esc(fx[0] || '')}</div>` : `<div class="pq">Сила не изучена</div>`}
    <ul class="pfx">${fx.slice(L ? 1 : 0).map(x => `<li>${esc(x)}</li>`).join('')}<li class="muted">${esc(p.d)}</li></ul>
    <div class="muted">У вас ${faithChip()}${why && L ? ` · <b style="color:#8c2e20">${esc(why)}</b>` : ''}</div>
    <div class="btns">${L ? `<button class="btn green" data-act="powerGo" data-arg="${id}" ${dis ? 'disabled' : ''}>✔ Применить · ${c}</button>` : ''}${canLearn ? `<button class="btn" data-act="learnGo" data-arg="${id}">${L ? 'Улучшить ★' : 'Изучить ★'}</button>` : !L ? `<span class="muted">${esc(why)}</span>` : ''}<button class="btn ghost" data-act="closeModal">Отмена</button></div></div>`);
}
const TAB_H = { powers: '✨ Силы', flock: '⛪ Паства', arena: '🤺 Арена', gods: '🏛 Олимп', hero: '🧔 Герой' };
function renderRight() {
  const g = S.god, fl = S.flock, mob = innerWidth <= 760, tab = mob ? S.ui.mtab : S.tab;
  let html = '';
  if (tab === 'powers') html = powersHTML();
  else if (tab === 'flock') {
    const tc = templeCost(), mf = maxFaith();
    html = `<div class="row" style="margin-bottom:6px"><span>Доступно для вложений</span>${faithChip()}</div>
      <div class="box"><h3>👥 Паства</h3><div class="big">${Math.floor(fl.fol)} 👥</div>
      <div class="muted">≈ ${Math.round(faithRegen() * 3600)} веры в час · запас веры ${Math.floor(g.faith)}/${mf}</div>${bar('faith', g.faith, mf)}</div>
      <div class="box"><h3>⛪ Главный храм — ур. ${fl.temple}${fl.temple ? ' (' + TEMPLE_NAMES[fl.temple - 1] + ')' : ''}</h3>
      <div class="muted">Каждый уровень: больше веры и её запас, ночлег героя, +КД.</div>
      ${fl.temple < 10 ? `<div class="stat"><label><span>Стройка до ур. ${fl.temple + 1}</span><span>${Math.floor(fl.templeProg)} / ${tc}</span></label>${bar('faith', fl.templeProg, tc)}</div>
      <div class="btns">${[10, 50].map(n => `<button class="btn small" data-act="temple" data-arg="${n}" ${g.faith < n ? 'disabled' : ''}>Вложить ${n}</button>`).join('')}<button class="btn small" data-act="temple" data-arg="all" ${g.faith < 1 ? 'disabled' : ''}>Вложить всё (${Math.floor(g.faith)})</button></div>` : '<div class="muted"><b>Величайший храм мира построен.</b></div>'}</div>
      <div class="box"><h3>🌈 Чудеса</h3>
      <div class="btns">${MIRACLES.map(m => `<button class="btn small" data-act="miracle" data-arg="${m.id}" ${g.faith < m.cost ? 'disabled' : ''}>${m.n} (${m.cost})</button>`).join('')}</div></div>
      <div class="box"><h3>⚔ Божья армия — ${fl.army} солдат</h3>
      <div class="muted">Солдат: ${soldierCost()} веры и 2 последователя. Штурмует регионы на карте Олимпа, сторожит ваши земли (каждый солдат −1% к чужим штурмам, до 30%), помогает в дуэлях и событиях.</div>
      <div class="btns"><button class="btn small red" data-act="recruit" data-arg="1" ${g.faith < soldierCost() || fl.fol < 2 ? 'disabled' : ''}>Набрать 1 (${soldierCost()})</button><button class="btn small red" data-act="recruit" data-arg="5" ${g.faith < soldierCost() * 5 || fl.fol < 10 ? 'disabled' : ''}>Набрать 5 (${soldierCost() * 5})</button></div></div>`;
  } else if (tab === 'arena') html = arenaTabHTML();
  else if (tab === 'hero') html = `<div class="sheet inl">${sheetHTML(true)}</div>`;
  else html = olyTabHTML();
  setHTML($('rightHead'), mob ? '' : `<h2 class="rph">${TAB_H[tab] || ''}</h2>`);
  if (mob && tab === 'hero') return;
  setHTML($('rightBody'), html);
}
function renderNav() {
  const mt = S.ui.mtab, B = document.body, mob = innerWidth <= 760, cur = mob ? mt : S.tab;
  if (B.dataset.mtab !== mt) B.dataset.mtab = mt;
  B.classList.toggle('chatOpen', !!S.chat.open);
  document.querySelectorAll('#mnav button').forEach(b => { const on = b.dataset.arg === cur; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const busy = S.fight ? '⚔ Идёт бой' : S.dun ? '🏰 Отряд в пещере' : S.fork && !forkPaused() ? (S.fork.m ? '✨ Божественный момент' : '🙏 Герой молится вам') : S.featOffer ? '🎖 Выберите черту' : S.ev ? '🌍 Мировое событие' : '';
  setHTML($('mBanner'), busy && mt !== 'hero' ? `<div class="mban"><span>${busy}</span><button class="btn small" data-act="mtab" data-arg="hero">Открыть</button></div>` : '');
  const heroDot = !!((S.fork && !forkPaused()) || S.featOffer || (S.fight && S.fight.phase !== 'end' && !S.fight.auto) || (S.dun && S.dun.phase === 'explore'));
  const gd = $('godsDot'); if (gd) gd.classList.toggle('on', !!S.chat.unread && !S.chat.open);
  const hb = document.querySelector('#mnav button[data-arg=hero]'); if (hb) hb.classList.toggle('dot', heroDot && mob && mt !== 'hero');
  const sc = $('spdC'); if (sc) { sc.textContent = '×' + S.speed; sc.classList.toggle('on', S.speed > 1); }
  const p2 = $('pauseBtn2'); if (p2) { p2.textContent = S.paused ? '▶' : '⏸'; p2.classList.toggle('on', S.paused); }
  B.classList.toggle('rm', reducedMotion()); B.classList.toggle('busyF', !!(S.fight || S.dun));
}
function render() { renderNav(); renderHeader(); renderHero(); renderOlyBox(); refreshRegion(); renderEvent(); renderFeat(); renderFork(); renderFight(); renderDunMap(); renderRight(); renderDiary(); renderChat(); }

/* ---------- Модальные окна ---------- */
const DUN_TIER_KEYS = ['easy', 'normal', 'hard'];
function gsTip(h) { return `Сила снаряжения: ${EQ_KEYS.filter(k => h.eq[k]).map(sl => `${SLOT_RU[sl]} ${itemGS(h.eq[sl])}`).join(', ')}${setBonusProps(h).length ? `, комплекты +${3 * setBonusProps(h).length}` : ''}. Средний ГС для ур. ${h.lvl}: ${typGS(h.lvl)}. Чем выше — тем легче подземелья.`; }
function gsVerdict(q) { return q >= 1.25 ? ['легко', 'g'] : q >= 1.05 ? ['уверенно', 'g'] : q >= .92 ? ['по силам', 'n'] : q >= .78 ? ['трудно', 'w'] : ['опасно!', 'b']; }
function tierModal() {
  const h = S.hero, gs = gearScore(h), auto = autoTier(h);
  modal(`<div class="sheet"><h2>🏰 Какое подземелье?</h2><div class="muted">Ваш ⚔ ГС <b>${gs}</b>. Недобор ГС — монстры бьют больнее и реже промахиваются; перебор — проще. Награда зависит только от сложности.</div>
  <div class="opts tiers">${DUN_TIER_KEYS.map(k => { const T = DUN_TIERS[k], rec = recGS(h.lvl, k), q = (GS_K.hero * gs + (1 - GS_K.hero) * rec) / rec, m = gsMul(q) * T.m, v = gsVerdict(gs / rec);
    return `<button class="btn tier" data-act="dunTier" data-arg="${k}"><b>${T.ic} ${T.n}</b>${k === auto ? ' <span class="tag cls">сам выбрал бы</span>' : ''}<span class="muted">рек. ГС ${rec} · у вас ${gs} — <span class="gv ${v[1]}">${v[0]}</span></span><span class="muted">монстры ${Math.round(m * 100)}% · награда ×${T.rew}${T.rar > 0 ? ' · вещи лучше' : T.rar < 0 ? ' · вещи попроще' : ''}</span></button>`; }).join('')}</div>
  <div class="muted">Цена: 40 веры. Тяжёлая даёт больше золота и опыта, вещи лучше и выше уровнем.</div>
  <div class="btns"><button class="btn small" data-act="closeModal">Отмена</button></div></div>`);
}
/* v11: на телефоне модалки во весь экран с большой кнопкой «Закрыть» внизу; на компьютере — крестик в углу */
function modal(html, o) { const m = $('modal'), cl = S && !(o && o.noClose); m.innerHTML = `<div class="card${o && o.noBar ? ' nobar' : ''}" role="dialog" aria-modal="true">${cl ? '<button class="mx" data-act="closeModal" aria-label="Закрыть">✕</button>' : ''}${html}${cl ? '<div class="mcbar"><button class="btn" data-act="closeModal">✕ Закрыть</button></div>' : ''}</div>`; m.classList.add('on'); m.scrollTop = 0; const c = m.firstChild; if (c) c.scrollTop = 0; }
function closeModal() { $('modal').classList.remove('on'); $('modal').innerHTML = ''; }
function onboarding() {
  const ro = Object.keys(RACES).map(k => `<option value="${k}">${RACES[k].n}</option>`).join(''), co = Object.keys(CLASSES).map(k => `<option value="${k}">${CLASSES[k].n}</option>`).join('');
  modal(`<h2>⚜ Добро пожаловать в БогоДел</h2>
  <p>Вы — молодой бог. У вас есть один герой, который живёт своей жизнью, и он… не очень умный. Но вы можете вмешиваться: отвечать на молитвы, метать молнии, строить храм, водить отряды в пещеры, драться на арене и воевать с другими богами.</p>
  <label>Имя вашего бога</label><input id="inGod" maxlength="30" value="Великий Пельмень">
  <label>Имя героя</label><input id="inHero" maxlength="30" value="Геннадий Отважный">
  <label>Раса героя</label><select id="inRace" data-keep>${ro}</select><div class="desc" id="raceDesc"></div>
  <label>Класс героя</label><select id="inCls" data-keep>${co}</select><div class="desc" id="clsDesc"></div>
  <div class="btns"><button class="btn blue" data-act="rndHero">🎲 Случайно</button><button class="btn" data-act="newGame">Сотворить мир</button></div>
  <div class="btns"><button class="btn small" data-act="importSave">📥 У меня есть сохранение (импорт)</button></div>`, { noClose: 1 });
  const r = $('inRace'), c = $('inCls');
  r.value = pick(Object.keys(RACES)); c.value = pick(Object.keys(CLASSES));
  r.onchange = c.onchange = obDesc; obDesc();
}
function obDesc() {
  const r = $('inRace'), c = $('inCls'); if (!r || !c) return;
  const R_ = RACES[r.value], C = CLASSES[c.value];
  $('raceDesc').textContent = `${Object.keys(R_.b).map(k => STAT_SHORT[k] + (R_.b[k] > 0 ? '+' : '') + R_.b[k]).join(', ')}. ${R_.tr}: ${R_.td}`;
  $('clsDesc').textContent = `Основная: ${STAT_RU[C.prim]}, кость здоровья d${C.die}. ${C.ab}: ${C.ad}`;
}
function help() {
  modal(`<h2>❔ Как играть</h2>
  <p><b>Герой живёт сам</b>: бродит, дерётся, торгует, отдыхает и пишет дневник. Ваша валюта — <b>вера</b>: копится от паствы и храма, а ещё герой жертвует золото, если доверяет вам. Это неспешная игра: до 10-го уровня — пара недель.</p>
  <p><b>📋 Характеристики.</b> СИЛ, ЛОВ, ТЕЛ, ИНТ, МДР, ХАР — как в настольных ролевых играх. Они влияют на бой, торговлю (Харизма), проповеди и исходы развилок: в дневнике видно «проверка Харизмы: успех». Раса и класс дают бонусы и особые умения.</p>
  <p><b>🎖 Черты.</b> На каждом чётном уровне герой выбирает черту или +2 к характеристике. Подскажите ему, иначе выберет сам.</p>
  <p><b>💎 Предметы</b> бывают обычные, необычные, редкие, эпические и легендарные. Иногда попадаются проклятые — их можно очистить за веру. Слотов 10: оружие, щит (или второй кинжал у плута; двуручное занимает обе руки), шлем, броня, пояс, перчатки, сапоги, амулет и два кольца. Шлем бережёт голову, пояс — пояс, сапоги — ноги, щит даёт шанс блока. У вещей есть требования («ур. 6, СИЛ 14»): пока не выполнены — вещь лежит в рюкзаке. 🧩 Комплекты (в основном из пещер) дают бонусы за 2, 4 и все части. Нажмите на вещь в «📋 Герой» — увидите подробности и сравнение. Герой и снаряжение видны на фигурке в живой нарисованной сцене местности (город, лес, болото, горы, берег, пещера…): в пути фон уезжает назад, в бою — тот же пейзаж. Нажмите на сцену — откроется снаряжение.</p>
  <p><b>✨ Божественные моменты.</b> Раз в 5–10 минут (на ×1) случается что-то, где решаете вы: 2–3 кнопки, одна всегда «Ничего не делать». Кнопки с 🔥 тратят веру и срабатывают наверняка, с 🎲 — проверка характеристики героя (бросок d20 и числа видны в дневнике). Не ответили за 2,5 мин — герой решит сам. В бою и в пещере момент ждёт, пока вы освободитесь.</p>
  <p><b>🙏 Развилки.</b> Иногда вместо момента герой молится и просит совета. Не ответили — решит сам (обычно глупо). Послушается ли он — зависит от <b>доверия</b>.</p>
  <p><b>📣 Глас.</b> Ключевые слова: «лечись», «бей», «копай», «проповедуй», «в город», «беги», «вперёд», «отдыхай».</p>
  <p><b>⛪ Паства.</b> Вера растёт с корнем из паствы. Паству приносят проповеди героя (Харизма!), ливни, развилки, дуэли и чудеса. Храм строится по частям: каждый уровень даёт веру, её запас, бесплатный ночлег и +1 КД на каждые 2 уровня. Солдаты армии стоят веры и 2 последователей, но помогают в дуэлях и событиях.</p>
  <p><b>😇 Характер бога.</b> Добрые поступки и силы света сдвигают его к «доброму» (силы света на 20% дешевле, паства растёт сама), кары — к «гневному» (кары дешевле, молния сильнее, солдаты дешевле).</p>
  <p><b>🏛 Война за Олимп.</b> Мир поделён на 14 регионов (лес, города, горы, болота, берег…), в каждом свои души. Регион принадлежит богу, у которого там больше всего верующих (не меньше 12% жителей), и даёт ему <b>+9 веры в час</b> и <b>свой бонус</b> (лес — добыча чаще, Годград — покупки дешевле, Понты — продажа дороже и т. д.). Ваши души растут, когда <b>герой ходит и проповедует в регионе</b> и побеждает там врагов; ещё помогают <b>храмы региона</b> (обращают сами и защищают), <b>штурм армией</b> (солдаты из «Паствы») и <b>дуэль богов за регион</b>. Отправить героя: кнопка на регионе или глас «иди в лес». Восемь богов-соперников тоже обращают души и иногда штурмуют ваши земли — в дневнике будет «⚠ Бог … обращает души в …». Без присмотра души остывают медленно (около 6% в сутки), так что день отсутствия не страшен. <b>Сезон — 4 недели</b>: каждый час вы получаете очки влияния (ОВ) за свои регионы и всех своих душ. В конце <b>топ-7 занимают троны Олимпа</b>: титул, рамка и «⚡ Олимпийский дар» на весь следующий сезон; затем карта сбрасывается, а герой, вещи, главный храм и армия остаются. Карта, таблица и хроника — во вкладке «🏛 Олимп».</p>
  <p><b>🧭 Где что.</b> Главный экран — «сцена бога»: сверху вера, уровень бога и скорость, в центре живая сцена местности с фигуркой героя и маршрутом Город → Лес → Подземелье → Город и дневник. Внизу — вкладки <b>Силы | Паства | Арена | Олимп | Герой</b>. Ваши вмешательства подсвечены в дневнике синим 🙏; важные события крупнее; запись с ▾ можно развернуть (броски кубиков, ход боя). Карта мира, таблица сезона, чат, пещеры и соперники — в «Олимпе», храм, чудеса и армия — в «Пастве», характеристики, снаряжение и рюкзак — в «Герое» (и по кнопке «📋»). Настройки (звук, сохранение, имена) — ⚙ сверху.</p>
  <p><b>⚔ Бой по зонам</b> (как в старом добром «Бойцовском клубе»). Каждый ход выберите <b>одну зону удара</b> (голова, грудь, живот, пояс, ноги) и <b>блок</b> (обычно 2 соседние зоны; воин и жрец закрывают 3, плут бьёт дважды, но закрывает 1). Противник выбирает одновременно. Кнопка «👁 Подсказать» (6 веры, раз за ход) подсмотрит, бьёт ли самый опасный враг в верх или в низ. Попал в блок — промах; ЛОВ даёт уворот, ИНТ/МДР — криты, сила и оружие — урон, доспех защищает (лучше всего грудь). 30 секунд на ход, потом герой решит сам по привычке. «🤖 Автобой» — пусть дерётся сам. До 3 сил бога за бой, 1 за ход.</p>
  <p><b>🤺 Арена</b> — вкладка с заявками: дуэли 1нс1, группы 3нс3 и 5нс5, хаотичные бои. Принимайте чужие или подавайте свои. За бои — опыт, золото и рейтинг; после поражения — травмы (штраф к характеристике, лечатся временем, отдыхом и храмом). <b>⚜ Дуэль богов</b> — тот же бой, но соперничающий бог тоже колдует.</p>
  <p><b>🏰 Пещеры</b> — карта 5×5: ведите отряд по комнатам, ищите 🗝 ключ и бейте 👑 босса. Это испытание: бесплатного лечения почти нет (один ⛲ источник и жрец), чем глубже — тем злее, 💀 элита на половине здоровья звереет. Боссы <b>объявляют</b> страшный удар по зоне — поставьте туда блок, иначе удар в 2,5 раза сильнее. Можно лечить отряд силой «Исцеление» между комнатами (раз за пещеру) и <b>отступить с добычей</b> (60% золота и опыта, все вещи). Если отряд разбит — героя вынесут, оставив 30%. Награда за босса — гарантированная редкая вещь и много опыта. Пещера не чаще раза в 4 часа. <b>💬 Чат</b> — пока с ботами, но они стараются. <b>🌍 Мировые события</b> — общий босс для всех богов.</p>
  <p>Обычные стычки с монстрами герой решает сам, но кнопкой «🎯 Бой под контроль» можно взять любой бой в свои руки.</p>
  <p class="muted">Пока вас нет, герой живёт сам (примерно в 0,75 темпа, до 24 часов за раз), а по возвращении вас ждёт сводка. Скорость ×1–×10 ускоряет жизнь героя; таймеры решений ускоряются не больше чем в 2 раза.</p>
  <div class="btns"><button class="btn" data-act="closeModal">Понятно!</button></div>`);
}
function settings() {
  modal(`<div class="settings"><h2>⚙ Настройки</h2>
  <label>Имя бога</label><input id="inGod" maxlength="30" value="${esc(S.god.name)}">
  <label>Имя героя</label><input id="inHero" maxlength="30" value="${esc(S.hero.name)}">
  <div class="btns"><button class="btn" data-act="rename">Сохранить</button><button class="btn" data-act="closeModal">Закрыть</button></div>
  <h3 style="margin-top:14px">🔊 Звук</h3>
  <div class="snd"><button class="btn tgl ${S.ui.snd ? 'on' : ''}" data-act="sndToggle" id="sndBtn" aria-pressed="${S.ui.snd ? 'true' : 'false'}">${S.ui.snd ? '🔊 Звуки: вкл' : '🔇 Звуки: выкл'}</button><span class="muted">Короткие сигналы без файлов: силы, удары, уровни, моменты. По умолчанию выключены; включаются только после вашего нажатия.</span></div>
  ${pwaSettingsHTML()}
  <h3 style="margin-top:14px">Для тестирования</h3>
  <div class="btns"><button class="btn small blue" data-act="dbg" data-arg="fork">✨ Момент сейчас</button><button class="btn small blue" data-act="dbg" data-arg="duel">⚜ Дуэль богов</button><button class="btn small blue" data-act="dbg" data-arg="arena">🤺 Бой 1нс1</button><button class="btn small blue" data-act="dbg" data-arg="group">👥 Бой 3нс3</button><button class="btn small blue" data-act="dbg" data-arg="monster">🎯 Ручной бой с монстром</button>
  <button class="btn small blue" data-act="dbg" data-arg="event">🌍 Событие сейчас</button><button class="btn small blue" data-act="dbg" data-arg="dun">🏰 Пещера сейчас</button>
  <button class="btn small blue" data-act="dbg" data-arg="feat">🎖 Черта сейчас</button><button class="btn small blue" data-act="dbg" data-arg="faith">+100 веры</button>
  <button class="btn small blue" data-act="dbg" data-arg="h1">⏩ +1 час</button><button class="btn small blue" data-act="dbg" data-arg="h8">⏩ +8 часов</button><button class="btn small blue" data-act="dbg" data-arg="d3">⏩ +3 дня</button><button class="btn small blue" data-act="dbg" data-arg="season">🏛 Конец сезона</button></div>
  <h3 style="margin-top:14px">Опасная зона</h3>
  <div class="btns"><button class="btn small red" data-act="reset">Начать заново (стереть сохранение)</button></div></div>`);
}
function newGame() {
  const g = ($('inGod').value || '').trim() || 'Великий Пельмень', hn = ($('inHero').value || '').trim() || 'Геннадий Отважный';
  const race = RACES[$('inRace').value] ? $('inRace').value : 'human', cls = CLASSES[$('inCls').value] ? $('inCls').value : 'warrior';
  S = defaultState(g, hn, race, cls); S.hero.maxHp = calcMaxHp(S.hero); S.hero.hp = S.hero.maxHp;
  diary(`Очнулся в канаве у Годграда. Помню только своё имя, что я ${RACES[race].n.toLowerCase()}-${CLASSES[cls].n.toLowerCase()} и что у меня есть бог — {god}. Пора совершать подвиги!`, 'god');
  diary(`Взял первое задание: «${S.hero.quest.n}».`); initBuild(S.hero); S.oly = olyNewState(Date.now()); S.hero.loc = REG_BY[S.hero.reg].n; closeModal(); save();
}

/* ---------- Действия ---------- */
const ACT = {
  speed: a => { S.speed = +a; S.paused = false; },
  pause: () => { S.paused = !S.paused; },
  help, settings, closeModal, sheet: () => sheetModal(),
  tab: a => ACT.mtab(a),
  mtab: a => { a = a === 'diary' ? 'hero' : a === 'more' ? 'flock' : a; if (!NAV_TABS.includes(a)) return; const was = innerWidth <= 760 ? S.ui.mtab : S.tab; S.ui.mtab = a; S.tab = a;
    if (innerWidth <= 760) { if (was !== a || a !== 'hero') window.scrollTo(0, 0); } else { const r = $('rightBody'); if (r) r.parentNode.scrollTop = 0; } },
  heroCol: () => { S.ui.heroCol = !S.ui.heroCol; },
  dexp: a => { const id = +a; if (diaryOpen.has(id)) diaryOpen.delete(id); else diaryOpen.add(id); diaryMoreV++; },
  dmore: () => { diaryLim = Math.min(150, diaryLim + D_PAGE); diaryMoreV++; },
  pprev: a => powerModal(a),
  powerGo: a => { if (!POWERS[a]) return; const f0 = S.god.faith; closeModal(); usePower(a); if (S.god.faith < f0) powerFx(a, lastBtnRect); },
  learnGo: a => { learn(a); powerModal(a); },
  fhint: () => { const f0 = S.god.faith; fightHint(); if (S.god.faith < f0) sfx('hint'); },
  sndToggle: () => { S.ui.snd = !S.ui.snd; save(); if (S.ui.snd) { sndUnlock(); sfx('power'); } const b = $('sndBtn'); if (b) { b.classList.toggle('on', S.ui.snd); b.textContent = S.ui.snd ? '🔊 Звуки: вкл' : '🔇 Звуки: выкл'; b.setAttribute('aria-pressed', S.ui.snd ? 'true' : 'false'); } },
  speedCycle: () => { const L = [1, 2, 5, 10]; S.speed = L[(L.indexOf(S.speed) + 1) % L.length]; S.paused = false; },
  liftS: a => { if (!EQ_KEYS.includes(a)) return; liftCurse(a); itemModal('eq:' + a); },
  itemD: a => itemModal(a),
  equipInv: id => { if (equipInv(id)) { render(); sheetModal(); } },
  voice: () => { const i = $('voiceIn'); voice(i.value); i.value = ''; },
  voiceq: a => voice(a),
  fork: a => answerFork(+a),
  power: a => { const f0 = S.god.faith; usePower(a); if (S.god.faith < f0) powerFx(a, lastBtnRect); },
  learn: a => learn(a),
  closeEv: () => { if (S.ev && S.ev.phase === 'done') S.ev = null; },
  evVote: a => evVote(a), evGive: a => evGive(a), evArmy: () => evArmy(),
  resurrect: () => resurrect(true),
  temple: a => templeGive(a === 'all' ? 'all' : +a), miracle: a => miracle(a), recruit: a => recruit(+a),
  lift: a => liftCurse(a),
  feat: a => chooseFeat(a, false), asi: a => chooseAsi(a, false),
  bldOpen: () => bldModal(), bldPick: a => { if (!BUILDS[a]) return; const ok = suggestBuild(a); sheetModal(); if (!ok && S.hero.bld.id !== a) toast('Герой не послушался — см. дневник.'); },
  asiOpen: () => { if (S.featOffer) S.featOffer.asi = true; }, asiBack: () => { if (S.featOffer) S.featOffer.asi = false; },
  challenge: a => { if (S.god.faith < 10) return toast('Нужно 10 веры.'); if (S.fight || S.dun || S.hero.state !== 'road' || duelPending) return toast('Герой сейчас занят.'); S.god.faith -= 10; startGodDuel(a).then(ok => { if (!ok && S) addFaith(10); }); },
  callDun: () => { if (S.god.faith < 40) return toast('Нужно 40 веры.'); if (S.dun || S.fight || !['road', 'town'].includes(S.hero.state) || dunPending) return toast('Герой сейчас занят.'); tierModal(); },
  dunTier: t => { closeModal(); if (!DUN_TIERS[t]) return; if (S.god.faith < 40) return toast('Нужно 40 веры.'); if (S.dun || S.fight || !['road', 'town'].includes(S.hero.state) || dunPending) return toast('Герой сейчас занят.'); S.god.faith -= 40; addGxp(10); startDungeon(true, t).then(ok => { if (!ok && S) addFaith(40); }); },
  smith: sl => { if (!EQ_KEYS.includes(sl)) return; if (smithUpgrade(sl) === true) { render(); itemModal('eq:' + sl); } },
  rndHero: () => { $('inRace').value = pick(Object.keys(RACES)); $('inCls').value = pick(Object.keys(CLASSES)); obDesc(); },
  newGame,
  rename: () => { S.god.name = ($('inGod').value || '').trim() || S.god.name; S.hero.name = ($('inHero').value || '').trim() || S.hero.name; closeModal(); save(); },
  reset: () => { if (!confirm('Точно стереть мир и начать заново?')) return; localStorage.removeItem(SAVE_KEY); S = null; onboarding(); },
  dbg: a => { closeModal(); const h = S.hero;
    const free = () => { if (h.state === 'dead') resurrect(false); if (h.state === 'fight' || h.state === 'town' || h.state === 'rest') { h.state = 'road'; h.monster = null; h.restT = 0; } };
    const busy = S.fight || S.dun || h.state === 'duel' || h.state === 'dungeon' || duelPending || dunPending;
    if (a === 'fork') { if (busy) return toast('Сначала закончите бой/пещеру.'); if (h.state === 'dead') resurrect(true); if (!S.fork) startFork(); }
    else if (a === 'duel') { if (busy) return toast('Герой уже занят.'); S.fork = null; free(); startGodDuel(); }
    else if (a === 'arena' || a === 'group') { if (busy) return toast('Герой уже занят.'); S.fork = null; free(); h.hp = Math.max(h.hp, Math.ceil(h.maxHp * .5)); S.arena.apps = S.arena.apps.filter(x => x.joined === null); arenaPost(a === 'arena' ? 'duel' : 'group:3'); const ap = S.arena.apps.find(x => x.mine); if (ap) { while (!appFull(ap)) appAddBot(ap, fightProv.makeBot(h.lvl)); startArenaFight(ap); } }
    else if (a === 'monster') { if (busy) return toast('Герой уже занят.'); S.fork = null; free(); startFight(); startMonsterFight(); }
    else if (a === 'dun') { if (busy) return toast('Герой уже занят.'); S.fork = null; free(); startDungeon(true); }
    else if (a === 'feat') { S.featQueue++; offerFeat(); }
    else if (a === 'h1' || a === 'h8' || a === 'd3') { if (simulateAway(a === 'h1' ? 3600 : a === 'h8' ? 8 * 3600 : 3 * 86400, 'перемотка времени')) awayModal(); }
    else if (a === 'season') { S.oly.end = Date.now() - 1; olySeasonCheck(); }
    else if (a === 'event') startEvent(); else if (a === 'faith') addFaith(100); }
};
/* v11: какие действия игрока считаются «вмешательством бога» — их записи в дневнике подсвечиваются */
const USER_ACTS = new Set(['voice', 'voiceq', 'fork', 'power', 'powerGo', 'resurrect', 'miracle', 'temple', 'recruit', 'challenge', 'dunTier', 'dheal', 'lift', 'liftS', 'bldPick', 'feat', 'asi', 'evGive', 'evArmy', 'fmanual', 'smith']);
let lastBtnRect = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.act]; if (!f) return;
  if (!S && !['newGame', 'rndHero', 'importSave', 'doImport', 'backOnb'].includes(b.dataset.act)) return;
  lastBtnRect = b.getBoundingClientRect(); sndUnlock();
  userActing = USER_ACTS.has(b.dataset.act) ? 1 : 0;
  try { f(b.dataset.arg); } finally { userActing = 0; }
  if (S) render();
});
document.addEventListener('keydown', e => { const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.dataset && t.dataset.act && t.tagName !== 'BUTTON') { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); } if (e.key === 'Escape' && $('modal').classList.contains('on') && S) closeModal(); });
$('voiceIn').addEventListener('keydown', e => { if (e.key === 'Enter' && S) { userActing = 1; try { ACT.voice(); } finally { userActing = 0; } render(); } });
window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });



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
    <div class="dmid"><div class="dav">${CLS_IC[h.cls] || '🧔'}</div><div class="dgsv" title="${esc(gsTip(h))}">⚔ ГС <b>${gearScore(h)}</b></div>
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

function renderHeader() {
  const g = S.god;
  $('hGod').textContent = g.name;
  $('hTitle').textContent = `Характер: ${alignTitle(g.align).toLowerCase()} · паства ${Math.floor(S.flock.fol)}`;
  $('hFaith').textContent = `🔥 Вера: ${Math.floor(g.faith)} / ${maxFaith()}  (+${faithRegen().toFixed(2)}/с)`;
  $('hFaithBar').style.width = pct(g.faith, maxFaith());
  $('hGxp').textContent = `${innerWidth <= 360 ? 'Бог' : 'Ур. бога'} ${g.lvl} · ${g.xp}/${gxpNext(g.lvl)}` + (g.sp ? ` · ★${g.sp}` : '');
  const vb = $('voiceBtn'); vb.disabled = g.faith < 5 || S.hero.state === 'dead' || S.hero.state === 'duel' || S.hero.state === 'dungeon' || !!S.fight;
  $('hGxpBar').style.width = pct(g.xp, gxpNext(g.lvl));
  const h = S.hero, hm = $('hpMeter'), dead = h.state === 'dead', narrow = innerWidth <= 430;
  $('hHp').innerHTML = dead ? `💀 мёртв${narrow ? '' : ` · встанет через ${fmtDur(Math.max(60, h.deadT))}`}` : `❤ HP: ${Math.max(0, h.hp)} / ${h.maxHp}<small>КД ${sheet().ac}</small>`;
  $('hHpBar').style.width = dead ? '100%' : pct(h.hp, h.maxHp);
  hm.classList.toggle('dead', dead); hm.classList.toggle('low', !dead && h.hp < h.maxHp * .25);
  hm.title = dead ? 'Герой мёртв. Воскресить можно на панели героя (30 веры).' : `Здоровье героя: ${h.hp} из ${h.maxHp}, класс доспеха ${sheet().ac}`;
  if (hm._hp !== undefined && hm._max === h.maxHp && !dead && hm._hp - h.hp >= h.maxHp * .15) { hm.classList.remove('hit'); void hm.offsetWidth; hm.classList.add('hit'); }
  if (hm._hp !== undefined && !hm._dead && dead) { hm.classList.remove('hit'); void hm.offsetWidth; hm.classList.add('hit'); }
  hm._hp = h.hp; hm._max = h.maxHp; hm._dead = dead;
  document.querySelectorAll('.speed [data-act=speed]').forEach(b => b.classList.toggle('on', +b.dataset.arg === S.speed));
  $('pauseBtn').textContent = S.paused ? '▶' : '⏸'; $('pauseBtn').classList.toggle('on', S.paused);
}
function renderHero() {
  const h = S.hero, m = h.monster, b = S.buffs;
  const buffs = [];
  if (b.luck > 0) buffs.push(`🍀 ${Math.ceil(b.luck)}с`); if (b.shield > 0) buffs.push(`🛡 ${Math.ceil(b.shield)}с`); if (b.trade > 0) buffs.push('☠ торговцы');
  const act = h.state === 'rest' ? `💤 ${h.restKind === 'camp' ? 'спит в лагере' : h.restKind === 'temple' ? 'ночует в храме' : 'отдыхает в трактире'}` : (STATE_RU[h.state] || h.state) + (m ? ': ' + esc(m.n) : '');
  let html = `<div class="hc-top"><div class="hc-av">${CLS_IC[h.cls] || '🧔'}</div><div class="hc-id"><h2>${esc(h.name)}</h2><div class="hc-sub">${RACES[h.race].n} · ${CLASSES[h.cls].n} · ур. ${h.lvl}</div></div>
    <button class="btn small ghost" data-act="sheet" title="Характеристики, снаряжение, рюкзак">📋 Герой</button></div>
  <div class="hc-now"><span>📍 ${esc(h.loc)}</span><span class="st">${act}</span>${buffs.length ? `<span>${buffs.join(' ')}</span>` : ''}</div>
  ${m && !S.fight ? `<div class="stat"><label><span>${esc(m.n)}${m.curse ? ' ☠' : ''}</span><span>${Math.max(0, m.hp)}/${m.max}</span></label>${bar('hp', m.hp, m.max)}</div><div class="btns" style="margin-top:4px"><button class="btn small red" data-act="fmanual">🎯 Взять бой под контроль</button></div>` : ''}
  ${h.state === 'dead' ? `<div class="deadbox">💀 Герой мёртв. Встанет сам через ${fmtDur(Math.max(60, h.deadT))} (и обидится).<div class="btns"><button class="btn" data-act="resurrect" ${S.god.faith < 30 ? 'disabled' : ''}>✨ Воскресить · 30</button></div></div>` : ''}
  <div class="hc-grid">
    <div class="stat"><label><span>📌 ${esc(h.quest.n)}</span><span>${Math.min(100, Math.floor(h.quest.p))}%</span></label>${bar('quest', h.quest.p, 100)}</div>
    <div class="stat"><label><span>Опыт</span><span>${h.lvl >= MAX_LVL ? 'максимум' : h.xp + '/' + xpNext(h.lvl)}</span></label>${bar('xp', h.xp, h.lvl >= MAX_LVL ? 1 : xpNext(h.lvl))}</div>
  </div>
  <div class="hc-mini"><button class="linkbtn gsc" data-act="sheet" title="${esc(gsTip(h))}">⚔ ГС <b>${gearScore(h)}</b>${equipped(h).some(it => it.curse) ? ' <span class="cur" title="Надет проклятый предмет">☠</span>' : ''}</button><span title="Золото"><b>${h.gold}</b> 💰</span><span title="Зелья"><b>${h.potions}</b> 🧪</span><span title="Привалы"><b>${h.shortRests}</b> ⛺</span><span title="Доверие к вам: ${trustLabel(h.trust)}">🤝 <b>${Math.round(h.trust)}</b></span>
    ${h.inj.length ? `<button class="linkbtn" data-act="sheet" style="color:#8c2e20">🤕 травмы: ${h.inj.length}</button>` : ''}</div>`;
  setHTML($('colHero'), html);
}
function sheetModal() {
  const h = S.hero, sh = sheet(), c = CLASSES[h.cls], r = RACES[h.race];
  modal(`<div class="sheet"><h2>📋 ${esc(h.name)} — ${r.n.toLowerCase()}-${c.n.toLowerCase()}, ур. ${h.lvl}</h2>
  <div class="stgrid">${STATS.map(k => `<div class="${c.prim === k ? 'pr' : ''}">${STAT_SHORT[k]}<b>${statVal(k)}</b>${fmtMod(mod(statVal(k)))}</div>`).join('')}</div>
  <div class="muted">Бой: атака ${fmtMod(sh.atkB)} · урон d${sh.die}${sh.dmgB ? fmtMod(sh.dmgB) : ''} (≈${Math.round(sh.avg)}) · КД ${sh.ac} · HP ${h.maxHp}. Владение ★: ${c.prof.map(k => STAT_SHORT[k]).join(', ')} (${fmtMod(profB(h.lvl))}).</div>
  <div class="stat"><label><span>Доверие к богу</span><span>${Math.round(h.trust)} — ${trustLabel(h.trust)}, слушается ~${Math.round(obeyChance() * 100)}%</span></label>${bar('trust', h.trust, 100)}</div>
  ${h.inj.length ? `<h3>🤕 Травмы</h3>${h.inj.map(j => `<div class="injrow">${esc(j.n)}: ${STAT_SHORT[j.s]} −${INJURIES[j.k].pen}, пройдёт за ${fmtDur(j.t)}</div>`).join('')}<div class="muted">Лечат время, долгий отдых, храм и «Исцеление».</div>` : ''}
  ${dollHTML(h)}
  <h3>🎒 Рюкзак (${h.inv.length}/${INV_MAX})</h3><ul class="inv">${h.inv.length ? h.inv.map(i => i.slot ? `<li><button class="linkbtn invb" data-act="itemD" data-arg="inv:${i.id}">${itemSpan(i)}</button>${!reqOk(h, i) ? ` <span class="rqb small">${esc(reqHtml(h, i).replace(/<[^>]+>/g, ''))}</span>` : bestPlace(h, i) ? ' <span class="upg" title="Лучше надетого">▲</span>' : ''} <span class="muted">~${i.v}💰</span></li>` : `<li>${esc(i.n)} <span class="muted">~${i.v}💰</span></li>`).join('') : '<li class="muted">пусто, как в голове после боя</li>'}</ul>
  <h3>Раса и класс</h3><div class="muted"><b>${r.tr}.</b> ${r.td}</div><div class="muted"><b>${c.ab}.</b> ${c.ad}</div>
  <h3>Черты (${h.feats.length})</h3>${h.feats.length ? h.feats.map(f => `<div class="muted">🎖 <b>${FEATS[f].n}</b> — ${FEATS[f].d}</div>`).join('') : '<div class="muted">Пока никаких. Новые — на каждом чётном уровне.</div>'}
  <div class="btns"><button class="btn" data-act="closeModal">Закрыть</button></div></div>`);
}
function renderFeat() {
  const box = $('featBox'), F = S.featOffer;
  if (!F) { setHTML(box, ''); return; }
  const mins = Math.ceil(F.t / 60);
  let body;
  if (F.asi) body = `<div class="muted">Какую характеристику прокачать на +2?</div><div class="opts">${STATS.map(k => `<button class="btn" data-act="asi" data-arg="${k}" ${S.hero.st[k] >= 20 ? 'disabled' : ''}>${STAT_RU[k]}: ${S.hero.st[k]} → ${Math.min(20, S.hero.st[k] + 2)}${CLASSES[S.hero.cls].prim === k ? '<span class="tag cls">основная</span>' : ''}</button>`).join('')}<button class="btn small" data-act="asiBack">← Назад к чертам</button></div>`;
  else body = `<div class="opts">${F.opts.map(id => `<button class="btn" data-act="feat" data-arg="${id}">🎖 <b>${FEATS[id].n}</b> — ${FEATS[id].d}</button>`).join('')}<button class="btn" data-act="asiOpen">💪 +2 к характеристике</button></div>`;
  setHTML(box, `<div class="card feat"><h2>🎖 Герой вырос: выберите черту</h2>
  <div class="muted" style="margin-bottom:6px">Не выберете за ~${mins} мин игрового времени — герой решит сам (и вам не понравится его логика).${S.featQueue > 1 ? ` В очереди ещё ${S.featQueue - 1}.` : ''}</div>${body}</div>`);
}
function renderDiary() {
  const el = $('diary');
  if (el._v === diaryVer) return; el._v = diaryVer;
  const row = e => `<div class="entry ${e.c}"><div class="tm">${e.tm}</div><div><span class="tx">${esc(e.x)}</span>${e.f ? `<div class="fx">${fxChips(e.f)}</div>` : ''}</div></div>`;
  el.innerHTML = S.diary.map(row).join('');
  const mini = $('diaryMini'); if (mini) mini.innerHTML = `<h2>📜 Последнее</h2>${S.diary.slice(0, 4).map(row).join('')}<div class="btns"><button class="btn small ghost" data-act="mtab" data-arg="diary">Весь дневник и глас →</button></div>`;
}
function fxChips(f) { return String(f).split(/,\s+(?![^()]*\))/).filter(Boolean).map(x => `<span class="fxc">${esc(x)}</span>`).join(''); }
function alignTag(a) { return a >= 2 ? '<span class="tag kind">добро</span>' : a <= -2 ? '<span class="tag wrath">гнев</span>' : ''; }
function renderFork() {
  const box = $('forkBox');
  if (!S.fork) { setHTML(box, ''); return; }
  const f = FORKS[S.fork.i], opts = forkOptions(S.fork);
  setHTML(box, `<div class="card fork"><h2>🙏 Герой молится вам!</h2>
    <div class="q">${esc(tx(f.t))}</div>
    <div class="stat"><label><span>Ответьте, пока он не решил сам</span><span id="forkSec"></span></label><div class="bar time"><i id="forkBar"></i></div></div>
    <div class="opts">${opts.map((o, k) => `<button class="btn" data-act="fork" data-arg="${k}">${esc(o.l)}${alignTag(o.a)}${o.clsOpt ? `<span class="tag cls">${CLASSES[S.hero.cls].n.toLowerCase()}</span>` : ''}</button>`).join('')}</div>
    <div class="muted" style="margin-top:6px">Герой послушается с шансом ~${Math.round(obeyChance() * 100)}% (зависит от доверия). Исход зависит от его характеристик.</div></div>`);
  $('forkSec').textContent = Math.ceil(S.fork.t) + ' с';
  $('forkBar').style.width = pct(S.fork.t, S.fork.T);
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
let openSkill = null;
function skillHTML(id) {
  const p = POWERS[id], g = S.god, L = g.skills[id] || 0, c = powerCost(id);
  const preOk = !p.pre || g.skills[p.pre] >= 1, lvlOk = g.lvl >= p.req;
  const canLearn = g.sp > 0 && L < 3 && preOk && lvlOk;
  let why = '';
  if (!L && !lvlOk) why = `Нужен ур. бога ${p.req}`; else if (!L && !preOk) why = `Сначала: ${POWERS[p.pre].n}`;
  return `<div class="skill ${L ? '' : 'locked'} ${openSkill === id ? 'open' : ''}"><div class="ic">${p.ic}</div>
    <div><div class="nm" data-act="skillInfo" data-arg="${id}" role="button" tabindex="0">${p.n} <span class="pips">${'●'.repeat(L)}${'○'.repeat(3 - L)}</span><span class="i">${openSkill === id ? '▴' : 'ⓘ'}</span></div>${why ? `<div class="hint">${why}</div>` : ''}<div class="ds">${p.d}</div></div>
    <div class="sb">${L ? `<button class="btn small" data-act="power" data-arg="${id}" ${powerDisabled(id, c) ? 'disabled' : ''}>${S.fight && S.fight.phase === 'turn' ? 'В бой' : 'Применить'} (${c})</button>` : ''}
    ${canLearn ? `<button class="btn small green" data-act="learn" data-arg="${id}">${L ? 'Улучшить ★' : 'Изучить ★'}</button>` : ''}</div></div>`;
}
function renderRight() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.arg === S.tab));
  const g = S.god, fl = S.flock;
  let html = '';
  if (S.tab === 'powers') {
    html = `<div class="row" style="margin-bottom:4px"><span>${faithChip()}</span><span>${g.sp ? `<b>★ ${g.sp}</b> ${plural(g.sp, 'очко', 'очка', 'очков')} сил` : '<span class="muted">★ 0 — новые с уровнем бога</span>'}</span></div>
      <div class="alignLine" title="Добрые дела сдвигают вправо, кары — влево. Подробнее — в «Как играть»."><span>😠</span><div class="align"><i style="left:${(g.align + 100) / 2}%"></i></div><span>😇</span><b>${alignTitle(g.align)}</b></div>
      <div class="hint" style="margin-bottom:6px">Нажмите на название силы — покажу описание.</div>`;
    for (const br in BRANCHES) html += `<div class="branch ${br}"><h3>${BRANCHES[br]}</h3>${Object.keys(POWERS).filter(id => POWERS[id].br === br).map(skillHTML).join('')}</div>`;
  } else if (S.tab === 'flock') {
    const tc = templeCost();
    html = `<div class="row" style="margin-bottom:6px"><span>Доступно для вложений</span>${faithChip()}</div>
      <div class="box"><h3>Паства</h3><div class="big">${Math.floor(fl.fol)} 👥</div>
      <div class="muted">≈ ${Math.round(faithRegen() * 3600)} веры в час</div></div>
      <div class="box"><h3>⛪ Храм — ур. ${fl.temple}${fl.temple ? ' (' + TEMPLE_NAMES[fl.temple - 1] + ')' : ''}</h3>
      <div class="muted">Каждый уровень: больше веры и её запас, ночлег героя, +КД.</div>
      ${fl.temple < 10 ? `<div class="stat"><label><span>Стройка до ур. ${fl.temple + 1}</span><span>${Math.floor(fl.templeProg)} / ${tc}</span></label>${bar('faith', fl.templeProg, tc)}</div>
      <div class="btns">${[10, 50].map(n => `<button class="btn small" data-act="temple" data-arg="${n}" ${g.faith < n ? 'disabled' : ''}>Вложить ${n}</button>`).join('')}<button class="btn small" data-act="temple" data-arg="all" ${g.faith < 1 ? 'disabled' : ''}>Вложить всё (${Math.floor(g.faith)})</button></div>` : '<div class="muted"><b>Величайший храм мира построен.</b></div>'}</div>
      <div class="box"><h3>🌈 Чудеса</h3>
      <div class="btns">${MIRACLES.map(m => `<button class="btn small" data-act="miracle" data-arg="${m.id}" ${g.faith < m.cost ? 'disabled' : ''}>${m.n} (${m.cost})</button>`).join('')}</div></div>
      <div class="box"><h3>⚔ Божья армия — ${fl.army} солдат</h3>
      <div class="muted">Солдат: ${soldierCost()} веры и 2 последователя. Помогает в дуэлях и событиях.</div>
      <div class="btns"><button class="btn small red" data-act="recruit" data-arg="1" ${g.faith < soldierCost() || fl.fol < 2 ? 'disabled' : ''}>Набрать 1 (${soldierCost()})</button><button class="btn small red" data-act="recruit" data-arg="5" ${g.faith < soldierCost() * 5 || fl.fol < 10 ? 'disabled' : ''}>Набрать 5 (${soldierCost() * 5})</button></div></div>
`;
  } else if (S.tab === 'arena') html = arenaTabHTML();
  else {
    const st = S.stats;
    html = `<div class="box"><h3>Ваши подвиги</h3><div class="muted">Развилок: ${st.forks} (отвечено ${st.forksAns}) · Дуэлей богов: ${st.duels} (побед ${st.dwins}) · Арена: ${st.arenaW}:${st.arenaL} · Событий: ${st.events} (успешных ${st.evwins})</div></div>
      ${godsDunHTML()}
      ${rivals.listGods().slice().sort((a, b) => b.lvl - a.lvl).map(r => `<div class="rival"><div><b>${esc(r.name)}</b> · ур. ${r.lvl}<div class="muted">${PERS[r.pers]} · герой ${esc(r.hero)} (${RACES[r.race].n.toLowerCase()}-${CLASSES[r.cls].n.toLowerCase()}, ур. ${r.hlvl}) · армия ${r.army} · против вас ${r.w}:${r.l}</div></div>
        <div><button class="btn small red" data-act="challenge" data-arg="${r.id}" ${S.fight || S.dun || S.fork || S.hero.state !== 'road' || g.faith < 10 || duelPending ? 'disabled' : ''}>⚔ Вызвать (10)</button></div></div>`).join('')}`;
  }
  setHTML($('rightBody'), html);
}
function renderNav() {
  const mt = S.ui.mtab, B = document.body; if (B.dataset.mtab !== mt) B.dataset.mtab = mt;
  B.classList.toggle('chatOpen', !!S.chat.open);
  document.querySelectorAll('#mnav button').forEach(b => b.classList.toggle('on', b.dataset.arg === mt));
  const busy = S.fight ? '⚔ Идёт бой' : S.dun ? '🏰 Отряд в пещере' : S.fork ? '🙏 Герой молится вам' : S.featOffer ? '🎖 Выберите черту' : S.ev ? '🌍 Мировое событие' : '';
  setHTML($('mBanner'), busy && ['powers', 'arena', 'more'].includes(mt) ? `<div class="mban"><span>${busy}</span><button class="btn small" data-act="mtab" data-arg="hero">Открыть</button></div>` : '');
  const heroDot = !!(S.fork || S.featOffer || (S.fight && S.fight.phase === 'turn' && !S.fight.auto) || (S.dun && S.dun.phase === 'explore'));
  const md = $('moreDot'); if (md) md.classList.toggle('on', !!S.chat.unread);
  const cd = $('chatDot2'); if (cd) cd.classList.toggle('on', !!S.chat.unread);
  const hb = document.querySelector('#mnav button[data-arg=hero]'); if (hb) hb.classList.toggle('dot', heroDot && mt !== 'hero');
  const sc = $('spdC'); if (sc) { sc.textContent = '×' + S.speed; sc.classList.toggle('on', S.speed > 1); }
  const p2 = $('pauseBtn2'); if (p2) { p2.textContent = S.paused ? '▶' : '⏸'; p2.classList.toggle('on', S.paused); }
}
function render() { renderNav(); renderHeader(); renderHero(); renderEvent(); renderFeat(); renderFork(); renderFight(); renderDunMap(); renderRight(); renderDiary(); renderChat(); }

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
function modal(html) { const m = $('modal'); m.innerHTML = `<div class="card">${html}</div>`; m.classList.add('on'); }
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
  <div class="btns"><button class="btn small" data-act="importSave">📥 У меня есть сохранение (импорт)</button></div>`);
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
  <p><b>💎 Предметы</b> бывают обычные, необычные, редкие, эпические и легендарные. Иногда попадаются проклятые — их можно очистить за веру. Слотов 10: оружие, щит (или второй кинжал у плута; двуручное занимает обе руки), шлем, броня, пояс, перчатки, сапоги, амулет и два кольца. Шлем бережёт голову, пояс — пояс, сапоги — ноги, щит даёт шанс блока. У вещей есть требования («ур. 6, СИЛ 14»): пока не выполнены — вещь лежит в рюкзаке. 🧩 Комплекты (в основном из пещер) дают бонусы за 2, 4 и все части. Нажмите на вещь в «📋 Герой» — увидите подробности и сравнение.</p>
  <p><b>🙏 Развилки.</b> Герой молится и просит совета. Не ответили — решит сам (обычно глупо). Послушается ли он — зависит от <b>доверия</b>.</p>
  <p><b>📣 Глас.</b> Ключевые слова: «лечись», «бей», «копай», «проповедуй», «в город», «беги», «вперёд», «отдыхай».</p>
  <p><b>⛪ Паства.</b> Вера растёт с корнем из паствы. Паству приносят проповеди героя (Харизма!), ливни, развилки, дуэли и чудеса. Храм строится по частям: каждый уровень даёт веру, её запас, бесплатный ночлег и +1 КД на каждые 2 уровня. Солдаты армии стоят веры и 2 последователей, но помогают в дуэлях и событиях.</p>
  <p><b>😇 Характер бога.</b> Добрые поступки и силы света сдвигают его к «доброму» (силы света на 20% дешевле, паства растёт сама), кары — к «гневному» (кары дешевле, молния сильнее, солдаты дешевле).</p>
  <p><b>📋 Герой.</b> На главном экране — только главное. Характеристики, снаряжение, рюкзак, травмы и черты — по кнопке «📋 Герой». На телефоне разделы — во вкладках внизу.</p>
  <p><b>⚔ Бой по зонам</b> (как в старом добром «Бойцовском клубе»). Каждый ход выберите <b>одну зону удара</b> (голова, грудь, живот, пояс, ноги) и <b>блок</b> (обычно 2 соседние зоны; воин и жрец закрывают 3, плут бьёт дважды, но закрывает 1). Противник выбирает одновременно. Попал в блок — промах; ЛОВ даёт уворот, ИНТ/МДР — криты, сила и оружие — урон, доспех защищает (лучше всего грудь). 30 секунд на ход, потом герой решит сам по привычке. «🤖 Автобой» — пусть дерётся сам. До 3 сил бога за бой, 1 за ход.</p>
  <p><b>🤺 Арена</b> — вкладка с заявками: дуэли 1нс1, группы 3нс3 и 5нс5, хаотичные бои. Принимайте чужие или подавайте свои. За бои — опыт, золото и рейтинг; после поражения — травмы (штраф к характеристике, лечатся временем, отдыхом и храмом). <b>⚜ Дуэль богов</b> — тот же бой, но соперничающий бог тоже колдует.</p>
  <p><b>🏰 Пещеры</b> — карта 5×5: ведите отряд по комнатам, ищите 🗝 ключ и бейте 👑 босса. Это испытание: бесплатного лечения почти нет (один ⛲ источник и жрец), чем глубже — тем злее, 💀 элита на половине здоровья звереет. Боссы <b>объявляют</b> страшный удар по зоне — поставьте туда блок, иначе удар в 2,5 раза сильнее. Можно лечить отряд силой «Исцеление» между комнатами (раз за пещеру) и <b>отступить с добычей</b> (60% золота и опыта, все вещи). Если отряд разбит — героя вынесут, оставив 30%. Награда за босса — гарантированная редкая вещь и много опыта. Пещера не чаще раза в 4 часа. <b>💬 Чат</b> — пока с ботами, но они стараются. <b>🌍 Мировые события</b> — общий босс для всех богов.</p>
  <p>Обычные стычки с монстрами герой решает сам, но кнопкой «🎯 Бой под контроль» можно взять любой бой в свои руки.</p>
  <p class="muted">Пока вас нет, герой живёт сам (примерно в 0,75 темпа, до 24 часов за раз), а по возвращении вас ждёт сводка. Скорость ×1–×10 ускоряет жизнь героя; таймеры решений ускоряются не больше чем в 2 раза.</p>
  <div class="btns"><button class="btn" data-act="closeModal">Понятно!</button></div>`);
}
function settings() {
  modal(`<h2>⚙ Настройки</h2>
  <label>Имя бога</label><input id="inGod" maxlength="30" value="${esc(S.god.name)}">
  <label>Имя героя</label><input id="inHero" maxlength="30" value="${esc(S.hero.name)}">
  <div class="btns"><button class="btn" data-act="rename">Сохранить</button><button class="btn" data-act="closeModal">Закрыть</button></div>
  ${pwaSettingsHTML()}
  <h3 style="margin-top:14px">Для тестирования</h3>
  <div class="btns"><button class="btn small blue" data-act="dbg" data-arg="fork">🙏 Развилка сейчас</button><button class="btn small blue" data-act="dbg" data-arg="duel">⚜ Дуэль богов</button><button class="btn small blue" data-act="dbg" data-arg="arena">🤺 Бой 1нс1</button><button class="btn small blue" data-act="dbg" data-arg="group">👥 Бой 3нс3</button><button class="btn small blue" data-act="dbg" data-arg="monster">🎯 Ручной бой с монстром</button>
  <button class="btn small blue" data-act="dbg" data-arg="event">🌍 Событие сейчас</button><button class="btn small blue" data-act="dbg" data-arg="dun">🏰 Пещера сейчас</button>
  <button class="btn small blue" data-act="dbg" data-arg="feat">🎖 Черта сейчас</button><button class="btn small blue" data-act="dbg" data-arg="faith">+100 веры</button>
  <button class="btn small blue" data-act="dbg" data-arg="h1">⏩ +1 час</button><button class="btn small blue" data-act="dbg" data-arg="h8">⏩ +8 часов</button></div>
  <h3 style="margin-top:14px">Опасная зона</h3>
  <div class="btns"><button class="btn small red" data-act="reset">Начать заново (стереть сохранение)</button></div>`);
}
function newGame() {
  const g = ($('inGod').value || '').trim() || 'Великий Пельмень', hn = ($('inHero').value || '').trim() || 'Геннадий Отважный';
  const race = RACES[$('inRace').value] ? $('inRace').value : 'human', cls = CLASSES[$('inCls').value] ? $('inCls').value : 'warrior';
  S = defaultState(g, hn, race, cls); S.hero.maxHp = calcMaxHp(S.hero); S.hero.hp = S.hero.maxHp;
  diary(`Очнулся в канаве у Годграда. Помню только своё имя, что я ${RACES[race].n.toLowerCase()}-${CLASSES[cls].n.toLowerCase()} и что у меня есть бог — {god}. Пора совершать подвиги!`, 'god');
  diary(`Взял первое задание: «${S.hero.quest.n}».`); closeModal(); save();
}

/* ---------- Действия ---------- */
const ACT = {
  speed: a => { S.speed = +a; S.paused = false; },
  pause: () => { S.paused = !S.paused; },
  help, settings, closeModal, sheet: () => sheetModal(),
  tab: a => { S.tab = a; },
  mtab: a => { if (!['hero', 'diary', 'powers', 'arena', 'more'].includes(a)) return; S.ui.mtab = a; if (a === 'powers' || a === 'arena') S.tab = a; else if (a === 'more' && !['flock', 'gods'].includes(S.tab)) S.tab = 'flock'; window.scrollTo(0, 0); },
  speedCycle: () => { const L = [1, 2, 5, 10]; S.speed = L[(L.indexOf(S.speed) + 1) % L.length]; S.paused = false; },
  skillInfo: a => { openSkill = openSkill === a ? null : a; },
  liftS: a => { if (!EQ_KEYS.includes(a)) return; liftCurse(a); itemModal('eq:' + a); },
  itemD: a => itemModal(a),
  equipInv: id => { if (equipInv(id)) { render(); sheetModal(); } },
  voice: () => { const i = $('voiceIn'); voice(i.value); i.value = ''; },
  voiceq: a => voice(a),
  fork: a => answerFork(+a),
  power: a => usePower(a),
  learn: a => learn(a),
  closeEv: () => { if (S.ev && S.ev.phase === 'done') S.ev = null; },
  evVote: a => evVote(a), evGive: a => evGive(a), evArmy: () => evArmy(),
  resurrect: () => resurrect(true),
  temple: a => templeGive(a === 'all' ? 'all' : +a), miracle: a => miracle(a), recruit: a => recruit(+a),
  lift: a => liftCurse(a),
  feat: a => chooseFeat(a, false), asi: a => chooseAsi(a, false),
  asiOpen: () => { if (S.featOffer) S.featOffer.asi = true; }, asiBack: () => { if (S.featOffer) S.featOffer.asi = false; },
  challenge: a => { if (S.god.faith < 10) return toast('Нужно 10 веры.'); if (S.fight || S.dun || S.fork || S.hero.state !== 'road' || duelPending) return toast('Герой сейчас занят.'); S.god.faith -= 10; startGodDuel(a).then(ok => { if (!ok && S) addFaith(10); }); },
  callDun: () => { if (S.god.faith < 40) return toast('Нужно 40 веры.'); if (S.dun || S.fight || S.fork || !['road', 'town'].includes(S.hero.state) || dunPending) return toast('Герой сейчас занят.'); tierModal(); },
  dunTier: t => { closeModal(); if (!DUN_TIERS[t]) return; if (S.god.faith < 40) return toast('Нужно 40 веры.'); if (S.dun || S.fight || S.fork || !['road', 'town'].includes(S.hero.state) || dunPending) return toast('Герой сейчас занят.'); S.god.faith -= 40; addGxp(10); startDungeon(true, t).then(ok => { if (!ok && S) addFaith(40); }); },
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
    else if (a === 'h1' || a === 'h8') simulateAway(a === 'h1' ? 3600 : 8 * 3600, 'перемотка времени');
    else if (a === 'event') startEvent(); else if (a === 'faith') addFaith(100); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.act]; if (!f) return;
  if (!S && !['newGame', 'rndHero', 'importSave', 'doImport', 'backOnb'].includes(b.dataset.act)) return;
  f(b.dataset.arg); if (S) render();
});
$('voiceIn').addEventListener('keydown', e => { if (e.key === 'Enter' && S) { ACT.voice(); render(); } });
window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });


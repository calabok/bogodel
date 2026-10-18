
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
const STATE_RU = { road: 'в пути', fight: 'в бою', town: 'в городе', dead: 'мёртв 💀', duel: 'на арене богов', rest: 'отдыхает 💤', dungeon: 'в подземелье 🏰' };
const SLOT_IC = { weapon: '⚔', armor: '🛡', amulet: '📿', ring: '💍' };
const itemSpan = it => `<span class="r${it.rar}${it.curse ? ' cursed' : ''}" title="${esc(RARITY[it.rar].n + ': ' + itemDesc(it))}">${esc(it.n)}${it.curse ? ' ☠' : ''}</span>`;

function renderHeader() {
  const g = S.god;
  $('hGod').textContent = g.name;
  $('hTitle').textContent = `Характер: ${alignTitle(g.align).toLowerCase()} · паства ${Math.floor(S.flock.fol)}`;
  $('hFaith').textContent = `🔥 Вера: ${Math.floor(g.faith)} / ${maxFaith()}  (+${faithRegen().toFixed(2)}/с)`;
  $('hFaithBar').style.width = pct(g.faith, maxFaith());
  $('hGxp').textContent = `${innerWidth <= 360 ? 'Бог' : 'Ур. бога'} ${g.lvl} · ${g.xp}/${gxpNext(g.lvl)}` + (g.sp ? ` · ★${g.sp}` : '');
  const vb = $('voiceBtn'); vb.disabled = g.faith < 5 || S.hero.state === 'dead' || S.hero.state === 'duel' || S.hero.state === 'dungeon';
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
  const h = S.hero, m = h.monster, b = S.buffs, sh = sheet();
  const buffs = [];
  if (b.luck > 0) buffs.push(`🍀 удача ${Math.ceil(b.luck)}с`); if (b.shield > 0) buffs.push(`🛡 щит ${Math.ceil(b.shield)}с`); if (b.trade > 0) buffs.push(`☠ торговцы прокляты`);
  let html = `<h2>🧔 ${esc(h.name)} <span class="muted">ур. ${h.lvl}</span></h2>
  <div class="row"><span>${RACES[h.race].n} · ${CLASSES[h.cls].n}</span><button class="btn small" data-act="sheet">📋 Лист героя</button></div>
  <div class="stgrid">${STATS.map(k => `<div class="${CLASSES[h.cls].prim === k ? 'pr' : ''}">${STAT_SHORT[k]}<b>${statVal(k)}</b>${fmtMod(mod(statVal(k)))}</div>`).join('')}</div>
  <div class="row"><span>Состояние</span><b>${STATE_RU[h.state] || h.state}${m ? ': ' + esc(m.n) : ''}</b></div>
  ${m ? `<div class="stat"><label><span>${esc(m.n)}${m.curse ? ' ☠' : ''}</span><span>${Math.max(0, m.hp)}/${m.max}</span></label>${bar('hp', m.hp, m.max)}</div>` : ''}
  <div class="row"><span>Защита (КД) · атака</span><b>${sh.ac} · ${fmtMod(sh.atkB)}</b></div>
  <div class="stat"><label><span>Опыт</span><span>${h.lvl >= MAX_LVL ? 'максимум' : h.xp + '/' + xpNext(h.lvl)}</span></label>${bar('xp', h.xp, h.lvl >= MAX_LVL ? 1 : xpNext(h.lvl))}</div>
  <div class="stat"><label><span>Доверие к богу</span><span>${Math.round(h.trust)} — ${trustLabel(h.trust)}</span></label>${bar('trust', h.trust, 100)}</div>
  <div class="muted">Слушается вас с шансом ~${Math.round(obeyChance() * 100)}%</div>`;
  if (h.state === 'dead') html += `<div class="deadbox">Герой мёртв и лежит в канаве. Воскреснет сам через ${Math.ceil(h.deadT)} с (и обидится), или…<div class="btns"><button class="btn" data-act="resurrect" ${S.god.faith < 30 ? 'disabled' : ''}>✨ Воскресить (30 веры)</button></div></div>`;
  if (h.state === 'rest') html += `<div class="restbox">💤 ${h.restKind === 'camp' ? 'Спит в лагере у дороги' : h.restKind === 'temple' ? 'Ночует в храме' : 'Отдыхает в трактире'} — долгий отдых (ещё ~${h.restT} ${plural(h.restT, 'ход', 'хода', 'ходов')}).</div>`;
  html += `<div class="row"><span>Золото</span><b>${h.gold} 💰</b></div>
  <div class="row"><span>Зелья · привалы</span><b>${h.potions} 🧪 · ${h.shortRests} ⛺</b></div>
  <div class="row"><span>Где</span><b>${esc(h.loc)}</b></div>
  ${buffs.length ? `<div class="row"><span>Эффекты</span><b>${buffs.join(' · ')}</b></div>` : ''}
  <div class="muted" style="margin-top:6px">Снаряжение</div>
  <ul class="eq">${['weapon', 'armor', 'amulet', 'ring'].map(sl => { const it = h.eq[sl]; return `<li><span>${SLOT_IC[sl]}</span><span class="nm">${it ? itemSpan(it) : `<span class="muted">${SLOT_RU[sl]}: пусто</span>`}</span>${it && it.curse ? `<button class="btn small red" data-act="lift" data-arg="${sl}" ${S.god.faith < liftCost(it) ? 'disabled' : ''}>Снять проклятие (${liftCost(it)})</button>` : '<span></span>'}</li>`; }).join('')}</ul>
  <div class="stat" style="margin-top:10px"><label><span>📌 ${esc(h.quest.n)}</span><span>${Math.min(100, Math.floor(h.quest.p))}%</span></label>${bar('quest', h.quest.p, 100)}</div>
  <div class="muted" style="margin-top:8px">🎒 Рюкзак (${h.inv.length}/12)</div>
  <ul class="inv">${h.inv.length ? h.inv.map(i => `<li>${i.slot ? itemSpan(i) : esc(i.n)} <span class="muted">~${i.v}💰</span></li>`).join('') : '<li class="muted">пусто, как в голове после боя</li>'}</ul>`;
  setHTML($('colHero'), html);
}
function sheetModal() {
  const h = S.hero, sh = sheet(), c = CLASSES[h.cls], r = RACES[h.race];
  modal(`<div class="sheet"><h2>📋 ${esc(h.name)} — ${r.n.toLowerCase()}-${c.n.toLowerCase()}, ур. ${h.lvl}</h2>
  <table>${STATS.map(k => { const base = h.st[k], v = statVal(k); return `<tr><td>${STAT_RU[k]}${c.prof.includes(k) ? ' ★' : ''}</td><td><b>${v}</b>${v !== base ? ` <span class="muted">(${base}${v > base ? '+' : ''}${v - base})</span>` : ''}</td><td>${fmtMod(mod(v))}</td></tr>`; }).join('')}</table>
  <div class="muted">★ — владение (бонус мастерства ${fmtMod(profB(h.lvl))} к проверкам)</div>
  <h3>Бой</h3><div class="muted">Атака ${fmtMod(sh.atkB)} · урон d${sh.die}${sh.dmgB ? fmtMod(sh.dmgB) : ''} ×${sh.scale.toFixed(1)} (в среднем ~${Math.round(sh.avg)}) · КД ${sh.ac} · HP ${h.maxHp} (кость d${c.die})</div>
  <h3>Раса: ${r.n}</h3><div class="muted"><b>${r.tr}.</b> ${r.td}</div>
  <h3>Класс: ${c.n}</h3><div class="muted"><b>${c.ab}.</b> ${c.ad}</div>
  <h3>Черты (${h.feats.length})</h3>${h.feats.length ? h.feats.map(f => `<div class="muted">🎖 <b>${FEATS[f].n}</b> — ${FEATS[f].d}</div>`).join('') : '<div class="muted">Пока никаких. Новые — на каждом чётном уровне.</div>'}
  <h3>Снаряжение</h3>${['weapon', 'armor', 'amulet', 'ring'].map(sl => { const it = h.eq[sl]; return `<div class="itm">${SLOT_IC[sl]} ${SLOT_RU[sl]}: ${it ? `${itemSpan(it)} <span class="muted">— ${RARITY[it.rar].n}</span><div class="muted">${esc(itemDesc(it))}</div>` : '<span class="muted">пусто</span>'}</div>`; }).join('')}
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
const DUN_IC = { fight: '⚔', trap: '🪤', puzzle: '🧩', path: '🚪', treasure: '💎', boss: '👑' };
function renderDun() {
  const box = $('dunBox'), U = S.dun;
  if (!U) { setHTML(box, ''); return; }
  const party = `<div class="party">${U.party.map(p => `<div class="pm ${p.isMe ? 'me' : ''}"><b>${esc(p.hero)}</b><div class="muted">${RACES[p.race].n.toLowerCase()}-${CLASSES[p.cls].n.toLowerCase()}, ур. ${p.lvl}</div><div class="muted">${p.isMe ? 'ваш герой · ' + Math.max(0, S.hero.hp) + '/' + S.hero.maxHp + ' HP' : 'бог: ' + esc(p.god) + ' · ' + p.hp + '%'}</div></div>`).join('')}</div>`;
  const rooms = `<div class="rooms">${U.rooms.map((t, i) => `<span class="${i < U.idx ? 'done' : i === U.idx && U.phase === 'room' ? 'cur' : ''}" title="${DUN_ROOMS[t].n}">${DUN_IC[t]}</span>`).join('')}</div>`;
  let mid = '';
  if (U.phase === 'intro') mid = '<div class="q">Отряд зажигает факелы у входа…</div>';
  else if (U.phase === 'room') {
    const rm = U.room, t = dunTally(U), ch = dunChoice(U);
    const powOk = rm.type !== 'treasure' && rm.type !== 'path';
    const ids = Object.keys(POWERS).filter(id => S.god.skills[id] && DUN_POW[id]);
    mid = `<div class="q"><b>${DUN_IC[rm.type]} ${DUN_ROOMS[rm.type].n}.</b> ${esc(rm.text)}</div>
    <div class="muted">Голосуйте за план. Ваш голос весит больше, если вы тратите веру на силы. Сейчас побеждает: «${esc(rm.opts[ch].l)}»</div>
    <div class="opts">${rm.opts.map((o, k) => `<button class="btn ${rm.myVote === k ? 'on' : ''}" data-act="dvote" data-arg="${k}">${esc(o.l)}${o.s ? `<span class="tag chk">${STAT_SHORT[o.s]}</span>` : ''}${o.cls ? `<span class="tag cls">${o.cls.map(c => CLASSES[c].n.toLowerCase()).join('/')}${o.has ? ' ✓' : ' — нет в отряде'}</span>` : ''} <span class="muted">· голосов ${Math.round(t[k] * 10) / 10}</span></button>`).join('')}</div>
    ${powOk ? `<div class="muted" style="margin-top:6px">Помочь силой (до 2 на комнату): ${faithChip()}</div>
    <div class="acts">${ids.map(id => `<button class="btn small" data-act="power" data-arg="${id}" ${S.god.faith < powerCost(id) || rm.myActs.includes(id) || rm.myActs.length >= 2 ? 'disabled' : ''}>${DUEL_NAMES[id]} (${powerCost(id)})</button>`).join('') || '<span class="muted">Нет подходящих изученных сил.</span>'}</div>
    <div class="queued">${rm.bonus ? `Бонус к проверке: +${rm.bonus}. ` : ''}${rm.shield ? 'Щит: урон вдвое меньше. ' : ''}${rm.heal ? 'Лечение после комнаты. ' : ''}</div>` : ''}`;
  } else if (U.phase === 'resolve') mid = `<div class="q">${esc(U.log[0] ? U.log[0].t : '')}</div>`;
  else mid = `<div class="q"><b>${esc(U.result || '')}</b></div><div class="btns"><button class="btn" data-act="closeDun">Закрыть</button></div>`;
  setHTML(box, `<div class="card dun"><h2>🏰 ${esc(U.name)}</h2>${party}${rooms}
  <div class="stat"><label><span>${U.phase === 'room' ? 'До решения отряда' : U.phase === 'end' ? 'Закроется через' : 'Дальше через'}</span><span id="dunSec"></span></label><div class="bar time"><i id="dunBar"></i></div></div>
  ${mid}<div class="dlog">${U.log.map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
  $('dunSec').textContent = Math.max(0, Math.ceil(U.t)) + ' с';
  $('dunBar').style.width = pct(U.t, U.T);
}
function renderDiary() {
  const el = $('diary');
  if (el._v === diaryVer) return; el._v = diaryVer;
  el.innerHTML = S.diary.map(e => `<div class="entry ${e.c}"><div class="tm">${e.tm}</div><div><span class="tx">${esc(e.x)}</span>${e.f ? ` <span class="fx">(${esc(e.f)})</span>` : ''}</div></div>`).join('');
}
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
function fighterHTML(f, title) {
  return `<div class="fighter"><b>${esc(f.name)}</b><div class="muted">${title}</div>
    <div class="stat"><label><span>HP</span><span>${Math.max(0, f.hp)}/${f.max}</span></label>${bar('hp', f.hp, f.max)}</div>
    <div class="muted">Атака ${f.atk} · защита ${f.def}${f.beast > 0 ? ' · 🐻 медведь' : ''}</div></div>`;
}
function renderDuel() {
  const box = $('duelBox'), D = S.duel;
  if (!D) { setHTML(box, ''); return; }
  let mid = '';
  if (D.phase === 'intro') mid = `<div class="q">Герои сходятся на арене богов…</div>`;
  else if (D.phase === 'fight') {
    const ids = Object.keys(POWERS).filter(id => S.god.skills[id]);
    mid = `<div class="muted">Вмешивайтесь до конца раунда (не более 2 сил + подбадривание). Соперник тоже действует в реальном времени — можно отвечать на его ходы!</div>
      <div class="muted" style="margin-top:4px">Ваша вера: ${faithChip()}</div>
      <div class="acts">${ids.map(id => `<button class="btn small ${POWERS[id].br === 'wrath' ? 'red' : POWERS[id].br === 'nature' ? 'green' : ''}" data-act="dact" data-arg="${id}" ${S.god.faith < powerCost(id) || D.myActs.includes(id) || D.myActs.filter(a => a !== 'cheer').length >= 2 ? 'disabled' : ''}>${DUEL_NAMES[id]} (${powerCost(id)})</button>`).join('')}
      <button class="btn small blue" data-act="dact" data-arg="cheer" ${D.myActs.includes('cheer') ? 'disabled' : ''}>📣 Подбодрить (0)</button></div>
      <div class="queued">${D.myActs.length ? 'В этом раунде: ' + D.myActs.map(a => DUEL_NAMES[a]).join(', ') : 'Вы пока не вмешались.'}${D.foeActs.length ? ' · Соперник: ' + D.foeActs.map(a => DUEL_NAMES[a]).join(', ') : ''}</div>`;
  } else mid = `<div class="q"><b>${esc(D.result || '')}</b></div><div class="btns"><button class="btn" data-act="closeDuel">Закрыть</button></div>`;
  setHTML(box, `<div class="card duel"><h2>⚔ Дуэль богов: ${esc(S.god.name)} против ${esc(D.opp.god)}</h2>
    <div class="muted">${D.phase === 'fight' ? `Раунд ${D.round} из ${DUEL_ROUNDS}` : D.phase === 'intro' ? 'Подготовка' : 'Итог'} · характер соперника: ${PERS[D.opp.pers]}, ур. ${D.opp.lvl} · вера соперника: ${D.phase === 'fight' ? '~' + Math.round(D.foeFaith / 10) * 10 : '?'}</div>
    <div class="stat"><label><span>${D.phase === 'fight' ? 'До конца раунда' : D.phase === 'intro' ? 'Бой начнётся через' : 'Закроется через'}</span><span id="duelSec"></span></label><div class="bar time"><i id="duelBar"></i></div></div>
    <div class="vs">${fighterHTML(D.me, 'ваш герой' + (S.flock.army ? ` · армия ${S.flock.army}` : ''))}<div class="vsx">VS</div>${fighterHTML(D.foe, 'герой ' + esc(D.opp.god) + (D.opp.army ? ` · армия ${D.opp.army}` : ''))}</div>
    ${mid}
    <div class="dlog">${D.log.map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
  $('duelSec').textContent = Math.max(0, Math.ceil(D.t)) + ' с';
  $('duelBar').style.width = pct(D.t, D.T);
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
  const D = S.duel, U = S.dun;
  if (D) { if (D.phase !== 'fight') return true; if (D.myActs.includes(id) || D.myActs.filter(a => a !== 'cheer').length >= 2) return true; }
  else if (U) { if (U.phase !== 'room' || !DUN_POW[id] || U.room.type === 'treasure' || U.room.type === 'path') return true; if (U.room.myActs.includes(id) || U.room.myActs.length >= 2) return true; }
  else if (S.hero.state === 'duel' || S.hero.state === 'dungeon') return true;
  return false;
}
function skillHTML(id) {
  const p = POWERS[id], g = S.god, L = g.skills[id] || 0, c = powerCost(id);
  const preOk = !p.pre || g.skills[p.pre] >= 1, lvlOk = g.lvl >= p.req;
  const canLearn = g.sp > 0 && L < 3 && preOk && lvlOk;
  let why = '';
  if (!L && !lvlOk) why = `Нужен ур. бога ${p.req}`; else if (!L && !preOk) why = `Сначала: ${POWERS[p.pre].n}`;
  return `<div class="skill ${L ? '' : 'locked'}"><div class="ic">${p.ic}</div>
    <div><div class="nm">${p.n} <span class="pips">${'●'.repeat(L)}${'○'.repeat(3 - L)}</span></div><div class="ds">${p.d}${why ? ` <b>${why}</b>` : ''}</div></div>
    <div class="sb">${L ? `<button class="btn small" data-act="power" data-arg="${id}" ${powerDisabled(id, c) ? 'disabled' : ''}>${S.duel && S.duel.phase === 'fight' ? 'В дуэль' : S.dun ? 'В подземелье' : 'Применить'} (${c})</button>` : ''}
    ${canLearn ? `<button class="btn small green" data-act="learn" data-arg="${id}">${L ? 'Улучшить ★' : 'Изучить ★'}</button>` : ''}</div></div>`;
}
function renderRight() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.arg === S.tab));
  const g = S.god, fl = S.flock;
  let html = '';
  if (S.tab === 'powers') {
    html = `<div class="box"><h3>Характер бога: ${alignTitle(g.align)} (${g.align > 0 ? '+' : ''}${Math.round(g.align)})</h3>
      <div class="align"><i style="left:${(g.align + 100) / 2}%"></i></div><div class="alignLbl"><span>гневный</span><span>добрый</span></div>
      <div class="muted" style="margin-top:4px">Добрые поступки и силы света смещают вправо, кары — влево. Добрый бог: силы света дешевле на 20%, паства растёт сама. Гневный: кары дешевле, молния сильнее, солдаты дешевле.</div></div>
      <div class="row" style="margin-bottom:6px"><span>${esc(g.name)}</span>${faithChip()}</div>
      <div class="muted" style="margin-bottom:8px">Очки сил: <b>${g.sp}</b> (по 1 за уровень бога). Уровень силы усиливает эффект на 50%.</div>`;
    for (const br in BRANCHES) html += `<div class="branch ${br}"><h3>${BRANCHES[br]}</h3>${Object.keys(POWERS).filter(id => POWERS[id].br === br).map(skillHTML).join('')}</div>`;
  } else if (S.tab === 'flock') {
    const tc = templeCost();
    html = `<div class="row" style="margin-bottom:6px"><span>Доступно для вложений</span>${faithChip()}</div>
      <div class="box"><h3>Паства</h3><div class="big">${Math.floor(fl.fol)} 👥</div>
      <div class="muted">Вера/с растёт с корнем из паствы (сейчас +${faithRegen().toFixed(3)}/с ≈ ${Math.round(faithRegen() * 3600)} в час). Паству приносят проповеди героя (Харизма!), ливни, развилки, дуэли и чудеса.</div></div>
      <div class="box"><h3>⛪ Храм — ур. ${fl.temple}${fl.temple ? ' (' + TEMPLE_NAMES[fl.temple - 1] + ')' : ''}</h3>
      <div class="muted">Паства строит храм на пожертвованную веру — вкладывайте понемногу. Каждый уровень: +0.006 веры/с, +20 к максимуму веры, паства прирастает сама; с 1 ур. герой ночует в храме бесплатно; каждые 2 ур. +1 к КД героя.</div>
      ${fl.temple < 10 ? `<div class="stat"><label><span>Стройка до ур. ${fl.temple + 1}</span><span>${Math.floor(fl.templeProg)} / ${tc}</span></label>${bar('faith', fl.templeProg, tc)}</div>
      <div class="btns">${[10, 50].map(n => `<button class="btn small" data-act="temple" data-arg="${n}" ${g.faith < n ? 'disabled' : ''}>Вложить ${n}</button>`).join('')}<button class="btn small" data-act="temple" data-arg="all" ${g.faith < 1 ? 'disabled' : ''}>Вложить всё (${Math.floor(g.faith)})</button></div>` : '<div class="muted"><b>Величайший храм мира построен.</b></div>'}</div>
      <div class="box"><h3>🌈 Чудеса</h3><div class="muted">Разовая вспышка: много паствы и доверия героя.</div>
      <div class="btns">${MIRACLES.map(m => `<button class="btn small" data-act="miracle" data-arg="${m.id}" ${g.faith < m.cost ? 'disabled' : ''}>${m.n} (${m.cost})</button>`).join('')}</div></div>
      <div class="box"><h3>⚔ Божья армия — ${fl.army} солдат</h3>
      <div class="muted">Солдат = ${soldierCost()} веры + 2 последователя (они больше не молятся, а маршируют). В дуэли каждый солдат даёт +1.2 урона за раунд (до 10), в мировых событиях — +10 силы.</div>
      <div class="btns"><button class="btn small red" data-act="recruit" data-arg="1" ${g.faith < soldierCost() || fl.fol < 2 ? 'disabled' : ''}>Набрать 1 (${soldierCost()})</button><button class="btn small red" data-act="recruit" data-arg="5" ${g.faith < soldierCost() * 5 || fl.fol < 10 ? 'disabled' : ''}>Набрать 5 (${soldierCost() * 5})</button></div></div>
      <div class="muted">Стратегия: паства — это доход, храм — вложение на будущее, чудо — быстрый рост, армия — сила в дуэлях и событиях, но съедает паству.</div>`;
  } else {
    const st = S.stats;
    html = `<div class="box"><h3>Ваши подвиги</h3><div class="muted">Развилок: ${st.forks} (отвечено ${st.forksAns}) · Дуэлей: ${st.duels} (побед ${st.dwins}) · Событий: ${st.events} (успешных ${st.evwins})</div></div>
      <div class="muted" style="margin-bottom:6px">Другие боги этого мира. Сейчас ими управляет ИИ с характером; архитектура готова к настоящему серверу.</div>
      <div class="box"><h3>🏰 Подземелья</h3><div class="muted">Герой иногда сам примыкает к отряду из 2–3 героев других богов. Можно собрать отряд и вручную. Пройдено: ${st.dwinsD} из ${st.duns}.</div><div class="btns"><button class="btn small" data-act="callDun" ${S.dun || S.duel || S.fork || S.hero.state !== 'road' || g.faith < 40 ? 'disabled' : ''}>🏰 Собрать отряд (40)</button></div></div>
      ${rivals.listGods().slice().sort((a, b) => b.lvl - a.lvl).map(r => `<div class="rival"><div><b>${esc(r.name)}</b> · ур. ${r.lvl}<div class="muted">${PERS[r.pers]} · герой ${esc(r.hero)} (${RACES[r.race].n.toLowerCase()}-${CLASSES[r.cls].n.toLowerCase()}, ур. ${r.hlvl}) · армия ${r.army} · против вас ${r.w}:${r.l}</div></div>
        <div><button class="btn small red" data-act="challenge" data-arg="${r.id}" ${S.duel || S.dun || S.fork || S.hero.state !== 'road' || g.faith < 10 ? 'disabled' : ''}>Вызвать (10)</button></div></div>`).join('')}`;
  }
  setHTML($('rightBody'), html);
}
function render() { renderHeader(); renderHero(); renderEvent(); renderFeat(); renderFork(); renderDun(); renderDuel(); renderRight(); renderDiary(); }

/* ---------- Модальные окна ---------- */
function modal(html) { const m = $('modal'); m.innerHTML = `<div class="card">${html}</div>`; m.classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); $('modal').innerHTML = ''; }
function onboarding() {
  const ro = Object.keys(RACES).map(k => `<option value="${k}">${RACES[k].n}</option>`).join(''), co = Object.keys(CLASSES).map(k => `<option value="${k}">${CLASSES[k].n}</option>`).join('');
  modal(`<h2>⚜ Добро пожаловать в БогоДел</h2>
  <p>Вы — молодой бог. У вас есть один герой, который живёт своей жизнью, и он… не очень умный. Но вы можете вмешиваться: отвечать на молитвы, метать молнии, строить храм, водить отряды в подземелья и воевать с другими богами.</p>
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
  <p><b>💎 Предметы</b> бывают обычные, необычные, редкие, эпические и легендарные. Иногда попадаются проклятые — их можно очистить за веру.</p>
  <p><b>🙏 Развилки.</b> Герой молится и просит совета. Не ответили — решит сам (обычно глупо). Послушается ли он — зависит от <b>доверия</b>.</p>
  <p><b>📣 Глас.</b> Ключевые слова: «лечись», «бей», «копай», «проповедуй», «в город», «беги», «вперёд», «отдыхай».</p>
  <p><b>⛪ Паства.</b> Вкладывайте веру в храм по частям, в чудеса или в армию.</p>
  <p><b>⚔ Дуэли богов</b> — 5 раундов по 10 секунд, оба бога вмешиваются в реальном времени. <b>🏰 Подземелья</b> — отряд героев разных богов, комнаты с голосованием и силами. <b>🌍 Мировые события</b> — общий босс для всех богов.</p>
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
  <div class="btns"><button class="btn small blue" data-act="dbg" data-arg="fork">🙏 Развилка сейчас</button><button class="btn small blue" data-act="dbg" data-arg="duel">⚔ Дуэль сейчас</button>
  <button class="btn small blue" data-act="dbg" data-arg="event">🌍 Событие сейчас</button><button class="btn small blue" data-act="dbg" data-arg="dun">🏰 Подземелье сейчас</button>
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
  voice: () => { const i = $('voiceIn'); voice(i.value); i.value = ''; },
  voiceq: a => voice(a),
  fork: a => answerFork(+a),
  power: a => usePower(a),
  learn: a => learn(a),
  dact: a => duelAct(a),
  dvote: a => dunVote(+a),
  closeDuel: () => { if (S.duel && S.duel.phase === 'end') S.duel = null; },
  closeDun: () => { if (S.dun && S.dun.phase === 'end') S.dun = null; },
  closeEv: () => { if (S.ev && S.ev.phase === 'done') S.ev = null; },
  evVote: a => evVote(a), evGive: a => evGive(a), evArmy: () => evArmy(),
  resurrect: () => resurrect(true),
  temple: a => templeGive(a === 'all' ? 'all' : +a), miracle: a => miracle(a), recruit: a => recruit(+a),
  lift: a => liftCurse(a),
  feat: a => chooseFeat(a, false), asi: a => chooseAsi(a, false),
  asiOpen: () => { if (S.featOffer) S.featOffer.asi = true; }, asiBack: () => { if (S.featOffer) S.featOffer.asi = false; },
  challenge: a => { if (S.god.faith < 10) return toast('Нужно 10 веры.'); if (S.duel || S.dun || S.fork || S.hero.state !== 'road') return toast('Герой сейчас занят.'); S.god.faith -= 10; startDuel(a).then(ok => { if (!ok && S) addFaith(10); }); },
  callDun: () => { if (S.god.faith < 40) return toast('Нужно 40 веры.'); if (S.dun || S.duel || S.fork || S.hero.state !== 'road') return toast('Герой сейчас занят.'); S.god.faith -= 40; addGxp(10); startDungeon(true).then(ok => { if (!ok && S) addFaith(40); }); },
  rndHero: () => { $('inRace').value = pick(Object.keys(RACES)); $('inCls').value = pick(Object.keys(CLASSES)); obDesc(); },
  newGame,
  rename: () => { S.god.name = ($('inGod').value || '').trim() || S.god.name; S.hero.name = ($('inHero').value || '').trim() || S.hero.name; closeModal(); save(); },
  reset: () => { if (!confirm('Точно стереть мир и начать заново?')) return; localStorage.removeItem(SAVE_KEY); S = null; onboarding(); },
  dbg: a => { closeModal(); const h = S.hero;
    const free = () => { if (h.state === 'dead') resurrect(false); if (h.state === 'fight' || h.state === 'town' || h.state === 'rest') { h.state = 'road'; h.monster = null; h.restT = 0; } };
    if (a === 'fork') { if (S.duel || S.dun || h.state === 'duel' || h.state === 'dungeon') return toast('Сначала закончите дуэль/подземелье.'); if (h.state === 'dead') resurrect(true); if (!S.fork) startFork(); }
    else if (a === 'duel') { if (S.duel || S.dun || h.state === 'duel' || h.state === 'dungeon') return toast('Герой уже занят.'); S.fork = null; free(); startDuel(); }
    else if (a === 'dun') { if (S.duel || S.dun || h.state === 'duel' || h.state === 'dungeon') return toast('Герой уже занят.'); S.fork = null; free(); startDungeon(true); }
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

/* ---------- Запуск ---------- */
let lastT = performance.now();
function loop() {
  const now = performance.now(); let dt = (now - lastT) / 1000; lastT = now; if (dt > 1) dt = 1;
  if (!S) return;
  if (!S.paused) { try { step(dt); } catch (err) { console.error(err); } }
  render();
}
S = load();
if (S) { if (S.dun && S.dun.room) S.dun.room.planned = S.dun.room.plan.length > 0; offlineCatchUp(); if (S.ev && S.ev.phase === 'live' && !S.ev.joined) joinEvent(S.ev); save(); render(); } else onboarding();
setInterval(loop, 250);
/* Отладочный доступ из консоли / тестов */
window.GAME = { get S() { return S; }, render: () => render(), set S(v) { S = v; }, maxFaith: () => maxFaith(), FORKS, WEVENTS, SAVE_KEY, save, load, startFork, startDuel, startEvent, startDungeon, answerFork, usePower, duelAct, dunAct, dunVote, evGive, evVote, step, heroStep, simulateAway, offlineCatchUp, chooseFeat, chooseAsi, offerFeat, liftCurse, makeItem, equip, check, sheet, calcMaxHp, xpNext, xpUnit, defaultState, gainXp, RACES, CLASSES, FEATS, MAX_LVL, PACE, get dunPending() { return dunPending; }, get duelPending() { return duelPending; } };

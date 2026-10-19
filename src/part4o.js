
/* =====================================================================
   13б) ВОЙНА ЗА ОЛИМП — интерфейс: вкладка «Олимп», карта, лист региона, итоги сезона, вступление
   ===================================================================== */
const RKIND_RU = { forest: 'лес', village: 'деревня', swamp: 'болото', mount: 'горы', city: 'город', valley: 'долина', field: 'поля', castle: 'замок', waste: 'пустошь', coast: 'побережье', ravine: 'овраг' };
const KIND_COL = { forest: '#cfe3b4', village: '#efe2bd', swamp: '#c9d7b0', mount: '#dcd6cc', city: '#e9dcc8', valley: '#d9ebc4', field: '#f1e6a8', castle: '#e2d5c4', waste: '#ecdab0', coast: '#c4e0ea', ravine: '#d6ccbd' };
let olyListOpen = false;
const fmtInf = v => v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace('.', ',') + ' тыс.' : String(Math.round(v));
function fmtLeft(ms) { const s = Math.max(0, ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`; }
const godDot = g => `<i class="gdot" style="background:${GOD_COL[g] || '#999'}"></i>`;
function hexPts(x, y, r) { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; p.push((x + r * Math.cos(a)).toFixed(1) + ',' + (y + r * Math.sin(a)).toFixed(1)); } return p.join(' '); }
function regThreat(id) { const O = S.oly, X = O.reg[id]; if (!(X.own === 'me' || myShare(id) >= .15)) return null; for (const g in O.bots) if (O.bots[g].r === id && X.own !== g) return g; return null; }
function heroGoalTxt() {
  const O = S.oly, h = S.hero, g = olyGoal();
  if (O.dest && O.dest !== h.reg) { const d = regDist(h.reg, O.dest); return `идёт ${REG_BY[O.dest].to} (${d} ${plural(d, 'переход', 'перехода', 'переходов')})`; }
  if (O.hold && O.hold.r === h.reg) return `держит ${REG_BY[h.reg].s} ещё ${fmtDur(Math.max(60, O.hold.t))}`;
  return g ? '' : 'бродит сам';
}
/* ---------- Карта (SVG): шестиугольники, цвет — владелец, полоска — ваша доля ---------- */
function olyMapSVG() {
  const O = S.oly, h = S.hero, r = OLY_HEX - 2;
  const parts = REGIONS.map(R0 => {
    const X = O.reg[R0.id], own = X.own, sh = myShare(R0.id), th = regThreat(R0.id), here = h.reg === R0.id, goal = O.dest === R0.id;
    const lbl = `${R0.n}: ${own ? (own === 'me' ? 'ваш регион' : 'владелец ' + godName(own)) : 'ничей'}, ваших душ ${Math.round(sh * 100)}%${here ? ', здесь герой' : ''}${th ? ', здесь проповедует ' + godName(th) : ''}`;
    return `<g class="rg${own === 'me' ? ' mine' : ''}${X.hot > 0 ? ' hot' : ''}${goal ? ' goal' : ''}${th ? ' thr' : ''}" data-act="reg" data-arg="${R0.id}" role="button" tabindex="0" aria-label="${esc(lbl)}">
      <polygon class="rb" points="${hexPts(R0.x, R0.y, r)}" fill="${KIND_COL[R0.k]}"/>
      ${own ? `<polygon class="ro" points="${hexPts(R0.x, R0.y, r)}" fill="${GOD_COL[own]}" fill-opacity="${own === 'me' ? .62 : .5}"/>` : ''}
      <polygon class="rs" points="${hexPts(R0.x, R0.y, r)}" fill="none" stroke="${own ? GOD_COL[own] : '#a89a7a'}"/>
      <text class="ri" x="${R0.x}" y="${R0.y - 6}">${R0.ic}</text>
      <text class="rn" x="${R0.x}" y="${R0.y + 15}">${esc(R0.s)}</text>
      <rect class="rbar" x="${R0.x - 26}" y="${R0.y + 22}" width="52" height="6" rx="3"/><rect class="rbarf" x="${R0.x - 26}" y="${R0.y + 22}" width="${(52 * Math.min(1, sh)).toFixed(1)}" height="6" rx="3"/>
      ${X.tp.me ? `<text class="rt" x="${R0.x - 31}" y="${R0.y - 20}">⛪</text>` : ''}
      ${th ? `<text class="rw" x="${R0.x - 28}" y="${R0.y + 2}">⚠</text>` : ''}
      ${here ? `<g class="rh"><circle cx="${R0.x + 27}" cy="${R0.y - 22}" r="12"/><text x="${R0.x + 27}" y="${R0.y - 18}">${S.hero.state === 'dead' ? '💀' : CLS_IC[h.cls] || '🧔'}</text></g>` : goal ? `<text class="rg2" x="${R0.x + 27}" y="${R0.y - 18}">🚩</text>` : ''}
    </g>`;
  }).join('');
  const C = OLY_CEN;
  return `<svg class="omap" viewBox="0 0 404 308" role="group" aria-label="Карта мира: 14 регионов вокруг Олимпа">
    <defs><linearGradient id="olyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e2b84a"/></linearGradient></defs>
    <g class="olc" data-act="olyInfo" role="button" tabindex="0" aria-label="Олимп: таблица сезона"><polygon points="${hexPts(C.x, C.y, r)}" fill="url(#olyG)" stroke="#b88a1c" stroke-width="2"/><text class="ri" x="${C.x}" y="${C.y - 4}">🏛</text><text class="rn" x="${C.x}" y="${C.y + 18}">Олимп</text></g>
    ${parts}</svg>`;
}
function olyLegend() {
  return `<div class="olegend"><span>${godDot('me')} вы</span><span><i class="gdot" style="background:${KIND_COL.field};border:1px solid #a89a7a"></i> ничей</span><span><i class="lbar"><i></i></i> ваша доля</span><span>⛪ ваш храм</span><span>⚠ соперник обращает ваши души</span><span>🚩 цель героя</span></div>`;
}
/* ---------- Таблица сезона ---------- */
function olyBoardHTML(full) {
  const rk = olyRanking(), g = S.god, busy = S.fight || S.dun || S.hero.state !== 'road' || g.faith < 10 || duelPending;
  return `<div class="oboard">${rk.map((x, i) => {
    const r = x.g === 'me' ? null : rivalOf(x.g), th = i < OLY_K.thrones ? THRONES[i][0] : '';
    return `${i === OLY_K.thrones ? '<div class="othr">— выше черты: троны Олимпа —</div>' : ''}<div class="orow ${x.g === 'me' ? 'me' : ''}">
      <span class="ork">${i + 1}</span>${godDot(x.g)}<div class="onm"><b>${esc(x.g === 'me' ? g.name + ' (вы)' : godName(x.g))}</b> ${th ? `<span class="othi" title="Трон «${THRONES[i][1]}»">${th}</span>` : ''}
      <div class="muted small">${x.regs} ${plural(x.regs, 'регион', 'региона', 'регионов')} · ${fmtInf(x.souls)} душ${r ? ` · ${PERS[r.pers]}: ${esc(GOD_MOTTO[x.g] || '')}` : ''}</div>
      ${r && full ? `<div class="muted small">герой ${esc(r.hero)} (ур. ${r.hlvl}) · армия ${Math.floor(r.army)} · против вас ${r.w}:${r.l}</div>` : ''}</div>
      <span class="oinf"><b>${fmtInf(x.inf)}</b><small>+${Math.round(x.rate)}/ч</small></span>
      ${r ? `<button class="btn small red" data-act="challenge" data-arg="${x.g}" ${busy ? 'disabled' : ''} title="Дуэль богов (10 веры)" aria-label="Вызвать на дуэль: ${esc(godName(x.g))}">⚔</button>` : '<span class="obsp"></span>'}</div>`;
  }).join('')}</div>`;
}
function olySeasonBox() {
  const O = S.oly, now = olyNow(), rank = olyRank(), me = olyRanking()[rank - 1], left = O.end - now;
  return `<div class="box osea"><div class="row"><h3>🏛 Сезон ${O.n} · Война за Олимп</h3><span class="muted small">до конца ${fmtLeft(left)}</span></div>
    ${bar('season', now - O.start, O.end - O.start)}
    <div class="ostat"><span><b>#${rank}</b> из ${GOD_IDS.length}</span><span><b>${fmtInf(me.inf)}</b> ОВ <small>(+${Math.round(me.rate)}/ч)</small></span><span><b>${me.regs}</b> ${plural(me.regs, 'регион', 'региона', 'регионов')}</span><span><b>${fmtInf(me.souls)}</b> душ</span></div>
    <div class="muted small">${rank <= OLY_K.thrones ? `Сейчас вы на троне «${THRONES[rank - 1][1]}».` : `До трона: обойти ${rank - OLY_K.thrones} ${plural(rank - OLY_K.thrones, 'бога', 'богов', 'богов')}.`} Очки влияния (ОВ) капают каждый час: за свои регионы и за всех ваших душ.</div>
    ${O.rew ? `<div class="orew ${O.rew.frame}">${O.rew.ic} Ваш титул прошлого сезона: <b>${esc(O.rew.title)}</b><div class="btns"><button class="btn small green" data-act="ogift" ${O.gift > 0 ? 'disabled' : ''}>⚡ Олимпийский дар${O.gift > 0 ? ' · через ' + fmtDur(O.gift) : ''}</button><span class="muted small">+${Math.round(OLY_K.giftShare * 160)}% душ региона, где герой, и +25 веры; раз в 6 ч</span></div></div>` : ''}
    ${O.last ? `<div class="muted small">Прошлый сезон ${O.last.n}: вы ${O.last.rank}-й. <button class="linkbtn" data-act="seasonShow">итоги</button></div>` : ''}</div>`;
}
function olyTabHTML() {
  const O = S.oly, h = S.hero, g = S.god, C = S.chat, last = C.msgs.slice(-3), st = S.stats, here = REG_BY[h.reg];
  const hx = heroGoalTxt();
  return `${olySeasonBox()}
  <div class="box omapbox"><div class="row"><h3>🗺 Карта мира</h3><span class="muted small">нажмите на регион</span></div>${olyMapSVG()}${olyLegend()}
    <div class="ohero">${CLS_IC[h.cls] || '🧔'} ${esc(h.name)} ${esc(here.v)}${hx ? ' · ' + esc(hx) : ''} <button class="btn small ghost" data-act="reg" data-arg="${h.reg}">Регион героя</button></div>
    <div class="btns"><button class="btn small ghost" data-act="olyList" aria-expanded="${olyListOpen}">${olyListOpen ? '▴ Скрыть список' : '▾ Список регионов'}</button></div>
    ${olyListOpen ? `<div class="olist">${REGIONS.map(R0 => { const X = O.reg[R0.id]; return `<button class="btn small ghost oli" data-act="reg" data-arg="${R0.id}">${R0.ic} ${esc(R0.s)} ${X.own ? godDot(X.own) : '<i class="gdot nil"></i>'}<span>${Math.round(myShare(R0.id) * 100)}%</span></button>`; }).join('')}</div>` : ''}</div>
  <div class="box"><h3>🏆 Таблица сезона</h3>${olyBoardHTML(true)}<div class="muted small">⚔ — дуэль богов (10 веры). Дуэль за души конкретного региона — в листе региона.</div></div>
  <div class="box"><h3>📜 Хроника войны</h3>${O.log.length ? `<ul class="olog">${O.log.slice(0, 7).map(e => `<li class="${e.c}"><span class="tm">${esc(e.tm)}</span> ${esc(e.x)}</li>`).join('')}</ul>` : '<div class="muted">Пока тихо. Боги точат кадила.</div>'}</div>
  <div class="box"><h3>${GOD_AV[alignTitle(g.align)] || ''} ${esc(g.name)} — ${alignTitle(g.align).toLowerCase()}</h3><div class="stat"><label><span>Уровень бога ${g.lvl}</span><span>${g.xp}/${gxpNext(g.lvl)}</span></label>${bar('gxp', g.xp, gxpNext(g.lvl))}</div>
    <div class="muted">Развилок: ${st.forks} (отвечено ${st.forksAns}) · Дуэлей богов: ${st.duels} (побед ${st.dwins}) · Арена: ${st.arenaW}:${st.arenaL} · Событий: ${st.events} (успешных ${st.evwins})${O.hist.length ? ` · Сезоны: ${O.hist.map(x => '#' + x.rank).join(', ')}` : ''}</div>
    <div class="btns"><button class="btn small ghost" data-act="help">❔ Как играть</button><button class="btn small ghost" data-act="settings">⚙ Настройки и сохранение</button></div></div>
  <div class="box"><h3>💬 Чат богов${C.unread ? ` <span class="faithChip" style="background:#b8412f">${C.unread} новых</span>` : ''}</h3>${last.map(m => `<div class="cm ${m.c}"><span class="tm">${esc(m.tm)}</span>${m.c === 'sys' ? esc(m.x) : `<b>${esc(m.from)}:</b> ${esc(m.x)}`}</div>`).join('') || '<div class="muted">Тихо.</div>'}
    <div class="btns"><button class="btn small" data-act="chatToggle">${C.open ? '✕ Закрыть чат' : '💬 Открыть чат'}</button></div></div>
  ${godsDunHTML()}`;
}
/* ---------- Лист региона ---------- */
let regOpen = null;
function regionHTML(id) {
  const R0 = REG_BY[id], O = S.oly, X = O.reg[id], h = S.hero, g = S.god; if (!R0) return '';
  const pop = R0.pop, sum = regSum(X), un = Math.max(0, pop - sum), own = X.own, mine = own === 'me';
  const gods = Object.keys(X.s).filter(k => X.s[k] >= 1).sort((a, b) => X.s[b] - X.s[a]);
  const seg = gods.map(k => `<i style="width:${(X.s[k] / pop * 100).toFixed(2)}%;background:${GOD_COL[k]}" title="${esc(godName(k))}: ${Math.round(X.s[k])}"></i>`).join('');
  const thr = Object.keys(O.bots).filter(k => O.bots[k].r === id);
  const here = h.reg === id, going = O.dest === id, holding = O.hold && O.hold.r === id;
  const tL = X.tp.me || 0, tc = regTempleCost(id), canT = tL < OLY_K.tMax && (myShare(id) >= OLY_K.tReq || here);
  const tg = stormTarget(id, 'me'), army = S.flock.army, sc = n => olyStormCalc(id, 'me', Math.min(n, army, OLY_K.stormMax));
  const stormable = (tg || un > 1) && !(mine && !tg);
  const duelG = own && !mine ? own : tg && tg !== 'me' ? tg : null;
  const busy = S.fight || S.dun || h.state !== 'road' || duelPending;
  const need = Math.round(pop * OLY_K.minShare), next = own && !mine ? Math.max(need, Math.round((X.s[own] || 0) * OLY_K.hyst + 3)) : need;
  const rate = Math.round(OLY_K.infBase + pop / OLY_K.infPop);
  const st5 = sc(5), stA = sc(army);
  return `<div class="rsheet"><h2>${R0.ic} ${esc(R0.n)}</h2>
    <div class="muted">${RKIND_RU[R0.k]}${R0.town ? ' · есть город' : ''} · ${pop} душ · соседи: ${R0.nb.map(n => REG_BY[n].s).join(', ')}</div>
    <div class="rown">${own ? `${godDot(own)} Владелец: <b>${esc(mine ? 'вы' : godName(own))}</b>` : `<i class="gdot nil"></i> <b>Ничей регион</b> — нужно от ${need} душ (12%)`}</div>
    <div class="rbonus ${mine ? 'on' : ''}">🎁 Бонус владельцу: <b>${esc(R0.bt)}</b>${mine ? ' — <b>ваш!</b>' : ''}<br><span class="small">а ещё +${Math.round(OLY_K.regFaith * 3600)} веры в час и +${rate} ОВ в час</span></div>
    <div class="rseg" role="img" aria-label="Доли богов в регионе">${seg}<i class="un" style="width:${(un / pop * 100).toFixed(2)}%"></i></div>
    <ul class="rgods">${gods.slice(0, 6).map(k => `<li class="${k === 'me' ? 'me' : ''}">${godDot(k)} ${esc(k === 'me' ? 'Вы' : godName(k))}<span>${Math.round(X.s[k])} · ${Math.round(X.s[k] / pop * 100)}%${X.tp[k] ? ` · ⛪${X.tp[k]}` : ''}</span></li>`).join('')}<li class="un"><i class="gdot nil"></i> Ничьи души<span>${Math.round(un)} · ${Math.round(un / pop * 100)}%</span></li></ul>
    ${!mine ? `<div class="muted small">Чтобы забрать регион, нужно ${next} ваших душ (сейчас ${Math.round(X.s.me || 0)}).</div>` : ''}
    ${thr.length ? `<div class="rthr">${thr.map(k => `⚠ Бог ${esc(godName(k))} сейчас обращает здесь души`).join('<br>')}</div>` : ''}
    <h3>🧔 Герой</h3><div class="muted">${here ? (holding ? `Герой здесь и держит регион ещё ${fmtDur(Math.max(60, O.hold.t))}: ходит, проповедует, защищает ваших прихожан (соперники переманивают их на 40% хуже).` : 'Герой здесь: каждый его шаг, проповедь и победа приносят души.') : going ? `Герой идёт сюда: ещё ${regDist(h.reg, id)} ${plural(regDist(h.reg, id), 'переход', 'перехода', 'переходов')} (≈ ${Math.max(3, regDist(h.reg, id) * 3)} мин при ×1).` : `Герой сейчас ${esc(REG_BY[h.reg].v)}, отсюда ${regDist(h.reg, id)} ${plural(regDist(h.reg, id), 'переход', 'перехода', 'переходов')}.`}</div>
    <div class="btns"><button class="btn" data-act="rsend" data-arg="${id}" ${going || (here && holding) || h.state === 'dead' ? 'disabled' : ''}>${here ? '🛡 Держать регион (2 ч)' : going ? '🚶 Уже идёт' : '🚶 Отправить героя'}</button></div>
    <h3>⛪ Храм региона${tL ? ` — ${TEMPLE_R[tL - 1]} (ур. ${tL})` : ''}</h3><div class="muted small">Храм сам обращает ${OLY_K.tConv} душ в час за уровень и защищает ваших прихожан (−${Math.round(OLY_K.tDef * 100)}% к чужим проповедям и штурмам за уровень).${!canT && tL < OLY_K.tMax ? ` Строить можно, где у вас от ${Math.round(OLY_K.tReq * 100)}% душ или где сейчас герой.` : ''}</div>
    <div class="btns">${tL < OLY_K.tMax ? `<button class="btn" data-act="rtemple" data-arg="${id}" ${!canT || g.faith < tc ? 'disabled' : ''}>${tL ? `⛪ Улучшить до ур. ${tL + 1}` : '⛪ Построить часовню'} · ${tc} веры</button>` : '<span class="muted">Храм здесь — величайший (ур. 5).</span>'}</div>
    <h3>⚔ Штурм армией</h3><div class="muted small">${tg ? `Солдаты переманят прихожан бога ${esc(godName(tg))} (его храм и армия мешают). ` : stormable ? 'Солдаты убедят ничьи души (вилами). ' : 'Здесь некого штурмовать. '}У вас ${army} ${plural(army, 'солдат', 'солдата', 'солдат')}${X.cdS > 0 ? ` · армия оправится через ${fmtDur(X.cdS)}` : ''}. Набор — во вкладке «Паства».</div>
    ${stormable && army ? `<div class="muted small">5 солдат: ≈ +${Math.round(st5.gain)} душ, потери ~${st5.loss} · все (${Math.min(army, OLY_K.stormMax)}): ≈ +${Math.round(stA.gain)}, потери ~${stA.loss}</div>` : ''}
    <div class="btns"><button class="btn red" data-act="rstorm" data-arg="${id}:5" ${!stormable || army < 1 || X.cdS > 0 ? 'disabled' : ''}>⚔ Штурм · 5</button><button class="btn red" data-act="rstorm" data-arg="${id}:all" ${!stormable || army < 1 || X.cdS > 0 ? 'disabled' : ''}>⚔ Все силы (${Math.min(army, OLY_K.stormMax)})</button></div>
    <h3>🤺 Дуэль богов за регион</h3><div class="muted small">${duelG ? `Бой по зонам с героем бога ${esc(godName(duelG))}. Победа: +${Math.round(OLY_K.duelWin * 100)}% душ региона от него, поражение: −${Math.round(OLY_K.duelLose * 100)}% ваших.` : 'Вызывать здесь некого.'}${X.cdD > 0 ? ` Следующая дуэль через ${fmtDur(X.cdD)}.` : ''}</div>
    <div class="btns"><button class="btn red" data-act="rduel" data-arg="${id}" ${!duelG || X.cdD > 0 || busy || g.faith < 10 ? 'disabled' : ''}>🤺 На дуэль${duelG ? ': ' + esc(godName(duelG)) : ''} · 10 веры</button></div>
    ${O.rew && here ? `<div class="btns"><button class="btn green" data-act="ogift" ${O.gift > 0 ? 'disabled' : ''}>⚡ Олимпийский дар${O.gift > 0 ? ' · ' + fmtDur(O.gift) : ''}</button></div>` : ''}
    <div class="muted small" style="margin-top:8px">Души растут от шагов и проповедей героя, побед в регионе, храмов, штурмов, дуэлей и божественных моментов. Без вашего присутствия они понемногу остывают (около 6% в сутки, храм замедляет).</div></div>`;
}
function regionModal(id) { if (!REG_BY[id]) return; regOpen = id; modal(regionHTML(id)); }
function refreshRegion() { const m = $('modal'); if (!regOpen || !m.classList.contains('on')) { regOpen = null; return; } const c = m.querySelector('.rsheet'); if (!c) { regOpen = null; return; } setHTML(c.parentNode, `<button class="mx" data-act="closeModal" aria-label="Закрыть">✕</button>${regionHTML(regOpen)}<div class="mcbar"><button class="btn" data-act="closeModal">✕ Закрыть</button></div>`); }
/* ---------- Итоги сезона ---------- */
function seasonHTML(L) {
  const th = L.rank <= OLY_K.thrones ? THRONES[L.rank - 1] : null;
  return `<div class="season"><h2>🏛 Сезон ${L.n} окончен</h2>
    <div class="sres ${th ? frameOf(L.rank) : ''}">${th ? `<div class="sbig">${th[0]}</div><b>${L.rank}-е место — трон «${esc(th[1])}»!</b><div class="small">Весь следующий сезон: титул, ${L.rank === 1 ? 'золотая' : L.rank <= 3 ? 'серебряная' : 'бронзовая'} рамка и «⚡ Олимпийский дар».</div>` : `<div class="sbig">🏛</div><b>${L.rank}-е место из ${L.top.length}</b><div class="small">Трона нет — нужно войти в семёрку. В новом сезоне всё сначала!</div>`}</div>
    <h3>Троны Олимпа</h3><ol class="sthr">${L.top.slice(0, OLY_K.thrones).map((t, i) => `<li class="${t.g === 'me' ? 'me' : ''}">${THRONES[i][0]} ${godDot(t.g)} <b>${esc(t.g === 'me' ? S.god.name + ' (вы)' : godName(t.g))}</b> — ${esc(THRONES[i][1])}<span>${fmtInf(t.inf)} ОВ</span></li>`).join('')}</ol>
    <div class="muted">Новый сезон начался: карта снова поделена поровну, храмы в регионах и очки влияния обнулены. Уровень героя, вещи, главный храм и армия — на месте.</div>
    <div class="btns"><button class="btn green mcbig" data-act="seasonOk">В новый сезон ▶</button></div></div>`;
}
function seasonModal() { const L = S.oly.last; if (!L) return; modal(seasonHTML(L), { noBar: 1 }); }
/* ---------- Вступление (один раз; и для старых сохранений после обновления) ---------- */
function renderOlyBox() {
  const box = $('olyBox'); if (!box) return;
  setHTML(box, S.oly && !S.oly.intro ? `<div class="card olyintro"><h2>🏛 Война за Олимп</h2>
    <p>Мир поделён на <b>14 регионов</b>. Регион принадлежит богу с самой большой паствой и даёт <b>веру и бонус</b>. Боги-соперники тоже обращают души — защищайте свои земли и забирайте чужие: <b>отправьте героя</b>, <b>постройте храм</b>, пошлите <b>армию на штурм</b> или вызовите бога на <b>дуэль</b>.</p>
    <p>Сезон длится <b>4 недели</b>. <b>Топ-7</b> богов по очкам влияния займут троны Олимпа: титул, рамка и особая сила на весь следующий сезон.</p>
    <div class="btns"><button class="btn green" data-act="olyGo">🗺 Открыть карту</button><button class="btn ghost" data-act="olyIntro">Понятно</button></div></div>` : '');
}
/* ---------- В сводке «Пока вас не было» ---------- */
function awayOlyHTML(o) {
  if (!o) return '';
  const se = o.seasons && o.seasons.length ? o.seasons[o.seasons.length - 1] : null;
  return `<div class="awoly"><h3>🏛 Война за Олимп</h3>${se ? `<div class="fhint sres ${se.rank <= OLY_K.thrones ? frameOf(se.rank) : ''}">🏛 Сезон ${se.n} завершился, пока вас не было: вы <b>${se.rank}-й</b>${se.title ? ` — трон «${esc(se.title)}»!` : '.'} Уже идёт сезон ${o.n}.</div>` : ''}
    <div class="awgrid"><div class="awt ${o.r1 < o.r0 ? 'good' : o.r1 > o.r0 ? 'bad' : ''}"><b>#${o.r0} → #${o.r1}</b>место</div><div class="awt ${o.n1 > o.n0 ? 'good' : o.n1 < o.n0 ? 'bad' : ''}"><b>${o.n0} → ${o.n1}</b>регионов</div></div>
    ${o.got.length ? `<div class="muted">🏛 Заняли: ${o.got.map(x => REG_BY[x].n).join(', ')}</div>` : ''}${o.lost.length ? `<div class="muted">💔 Потеряли: ${o.lost.map(x => REG_BY[x].n).join(', ')}</div>` : ''}</div>`;
}
Object.assign(ACT, {
  reg: a => regionModal(a),
  rsend: a => { if (!REG_BY[a]) return; olySend(a); toast(S.hero.reg === a ? `🛡 Герой держит ${REG_BY[a].s}` : `🚶 Герой идёт ${REG_BY[a].to}`); },
  rtemple: a => { if (REG_BY[a]) olyTemple(a); },
  rstorm: a => { const [id, n] = String(a).split(':'); if (REG_BY[id]) olyStormMe(id, n === 'all' ? 'all' : +n); },
  rduel: a => { if (REG_BY[a] && olyDuel(a)) closeModal(); },
  ogift: () => olyGift(),
  olyList: () => { olyListOpen = !olyListOpen; },
  olyInfo: () => { const b = document.querySelector('.osea'); if (b) b.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }); },
  olyIntro: () => { S.oly.intro = 1; save(); },
  olyGo: () => { S.oly.intro = 1; ACT.mtab('gods'); save(); },
  seasonShow: () => seasonModal(),
  awayOk: () => { closeModal(); if (S.oly.last && !S.oly.last.seen) seasonModal(); },
  seasonOk: () => { if (S.oly.last) S.oly.last.seen = 1; closeModal(); save(); }
});
['rsend', 'rtemple', 'rstorm', 'rduel', 'ogift'].forEach(k => USER_ACTS.add(k));
const OLY_EXPORTS = ({ olyApply, olyConvert, regOwner, OLY_K, REGIONS, REG_BY, GOD_IDS, PERS_OLY, olyTick, olyStep, olySend, olyTemple, olyStormMe, olyStormCalc, olyDuel, olyDuelResult, olyGift, olyRanking, olyRank, myShare, mySouls, olyOwned, olySouls, olyRate,
  olySeasonEnd, olySeasonCheck, olyNewState, sanitizeOly, olyFastForward, olyView, olyHero, regDist, regTempleCost, regionModal, seasonModal, recruit, soldierCost, regThreat,
  setOlyNow: v => { OLY_NOW = v; }, getLastAway: () => lastAway, awayModal: () => awayModal() });

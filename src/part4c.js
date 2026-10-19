
/* =====================================================================
   14) ИНТЕРФЕЙС v4: бой по зонам, арена, пещера-карта, чат
   ===================================================================== */
const CLS_IC = { warrior: '🛡', mage: '🔮', rogue: '🗡', cleric: '✚', bard: '🎻', ranger: '🏹', barbarian: '🪓' };
const ZONE_IC = { head: '🙂', chest: '👕', belly: '🍔', waist: '🩲', legs: '🦵' };
const KIND_RU = { monster: 'Ручной бой', dungeon: 'Бой в пещере', duel: 'Дуэль', group: 'Групповой бой', chaos: 'Хаотичный бой', godduel: 'Дуэль богов' };
function fighterRow(F, f, me, canTarget) {
  const tg = canTarget && f.alive && me && f.team !== me.team, sel = F.my.target === f.id && f.team !== (me ? me.team : 0);
  const tele = F.tele && F.tele.fid === f.id ? `<div class="tl">⚠ замах ${ZONE_ACC[F.tele.zone]}</div>` : '';
  const sub = f.kind === 'boss' ? '👑 босс' : f.cls ? `${CLS_IC[f.cls] || ''} ${CLASSES[f.cls].n.toLowerCase()}` : 'чудище';
  const inner = `<span class="nm"><b>${f.isMe ? '⭐ ' : ''}${esc(f.name)}</b><span class="muted">${sub} · ${f.lvl}</span></span>${bar('hp', f.hp, f.max)}<span class="nm"><span class="muted">${Math.max(0, f.hp)}/${f.max}${f.bear > 0 ? ' 🐻' : ''}${f.debuf > 0 ? ' ☠' : ''}${f.buf && f.buf.shield ? ' 🛡' : ''}</span>${sel ? '<span class="tl">🎯 цель</span>' : ''}</span>${tele}`;
  return tg ? `<button class="fr tg ${sel ? 'sel' : ''}" data-act="ftarget" data-arg="${f.id}" data-fid="${esc(f.id)}">${inner}</button>`
    : `<div class="fr ${f.isMe ? 'me' : ''} ${f.alive ? '' : 'dead'} ${sel ? 'sel' : ''}" data-fid="${esc(f.id)}">${inner}</div>`;
}
function zoneBody(F, me, k) {
  const sel = k === 'a' ? F.my.atk : F.my.blk, dis = F.auto || F.phase === 'end' || !me.alive;
  const n = k === 'a' ? me.atkN : me.blkN, hz = F.hint && F.hint.turn === F.turn && F.phase === 'turn' ? F.hint.zones : [];
  const lbl = k === 'a' ? `⚔ Удар${n > 1 ? ` (${n} зоны)` : ''}` : `🛡 Блок (${n} ${plural(n, 'зона', 'зоны', 'зон')})`;
  return `<div class="body ${k === 'a' ? 'atk' : 'blk'}"><h4>${lbl}</h4>${ZONES.map(z => `<button class="zb ${z} ${sel.includes(z) ? 'on' : ''} ${k === 'b' && F.tele && F.tele.zone === z ? 'tele' : ''} ${k === 'b' && hz.includes(z) ? 'hintz' : ''}" data-act="fz" data-arg="${k}:${z}" ${dis ? 'disabled' : ''} aria-pressed="${sel.includes(z) ? 'true' : 'false'}" aria-label="${k === 'a' ? 'Удар' : 'Блок'}: ${ZONE_RU[z]}"><span class="zi">${ZONE_IC[z]}</span>${ZONE_RU[z]}</button>`).join('')}</div>`;
}
let fightSeenId = null;
function renderFight() {
  const box = $('fightBox'), F = S.fight;
  if (!F) { setHTML(box, ''); return; }
  const me = fMe(F), turn = F.phase === 'turn', mine = me && me.alive;
  const t0 = F.fighters.filter(f => f.team === 0), t1 = F.fighters.filter(f => f.team === 1);
  const multi = t0.length > 1 || t1.length > 1;
  const foeT = F.fighters.find(f => f.id === F.my.target && f.alive) || t1.find(f => f.alive) || t1[0], meU = me || t0[0];
  const vsU = (f, cls) => f ? `<div class="vsu ${cls} ${f.alive && f.hp < f.max * .3 ? 'low' : ''}" data-fid="${esc(f.id)}"><div class="vn">${f.isMe ? '⭐ ' : ''}${esc(f.name)}</div><div class="vs2">${f.kind === 'boss' ? '👑 босс' : f.cls ? `${CLS_IC[f.cls] || ''} ${CLASSES[f.cls].n.toLowerCase()}` : 'чудище'} · ур. ${f.lvl}${f.buf && f.buf.shield ? ' · 🛡' : ''}${f.debuf > 0 ? ' · ☠' : ''}</div>${bar('hp', f.hp, f.max)}<div class="vh">${f.alive ? `❤ ${Math.max(0, f.hp)} / ${f.max}` : '😵 выбыл'}</div></div>` : '<div></div>';
  const vs = `<div class="vsbar">${vsU(meU, 'me')}<div class="vsx">⚔</div>${vsU(foeT, 'foe')}</div>`;
  const teams = !multi ? '' : `<div class="teams"><div class="team"><h4>${t0.length > 1 ? 'Наши' : 'Вы'}</h4>${t0.map(f => fighterRow(F, f, me, false)).join('')}</div>
    <div class="team"><h4>${t1.length > 1 ? `Противники${turn && mine ? ' · нажмите — цель' : ''}` : 'Противник'}</h4>${t1.map(f => fighterRow(F, f, me, turn && mine && fAlive(F, 1).length > 1)).join('')}</div></div>`;
  let mid = '';
  const acts = FIGHT_ACT_KINDS.includes(F.kind) && mine && !F.auto ? `<div class="facts"><button class="btn small ${F.my.act === 'potion' ? 'on green' : ''}" data-act="fpot" ${S.hero.potions < 1 ? 'disabled' : ''} title="Вместо удара: +35% HP, блок остаётся">🧪 Зелье вместо удара (${S.hero.potions})</button><button class="btn small ${F.my.act === 'flee' ? 'on red' : ''}" data-act="fflee" title="${F.kind === 'dungeon' ? 'Отряд уходит из пещеры с добычей' : 'Сбежать с поля боя'}">🏃 Сбежать (${Math.round(fleeChance(F, me) * 100)}%)</button></div>${F.my.act ? `<div class="muted">${F.my.act === 'potion' ? '🧪 В этот ход герой пьёт зелье вместо удара.' : '🏃 В этот ход герой попробует сбежать вместо удара.'}</div>` : ''}` : '';
  const low = mine && me.hp < me.max * .3 ? `<div class="lowhp">⚠ ${esc(me.name)} еле жив: ${me.hp}/${me.max} HP! ${FIGHT_ACT_KINDS.includes(F.kind) ? 'Поставьте блок, выпейте зелье, призовите силу бога или попробуйте сбежать.' : 'Поставьте блок или призовите силу бога.'}</div>` : '';
  const pIds = Object.keys(POWERS).filter(id => S.god.skills[id]);
  const powRow = `<div class="muted" style="margin-top:6px">Силы бога в бою: ${F.powersLeft}/3 (1 за ход) · ${faithChip()}${F.rivalGod ? ` · у бога ${esc(F.rivalGod.name)} осталось ${F.rivalGod.left}` : ''}</div>
      <div class="acts">${pIds.map(id => `<button class="btn small ${POWERS[id].br === 'wrath' ? 'red' : POWERS[id].br === 'nature' ? 'green' : ''}" data-act="fpow" data-arg="${id}" ${S.god.faith < powerCost(id) || F.powersLeft < 1 || F.usedTurn >= 1 || F.phase !== 'turn' ? 'disabled' : ''}>${DUEL_NAMES[id]} (${powerCost(id)})</button>`).join('') || '<span class="muted">Нет изученных сил.</span>'}</div>`;
  if (F.phase === 'intro') {
    const U = S.dun, en = F.fighters.filter(f => f.team === 1);
    const tr = en.map(e => { const t = []; if (e.boss) t.push(`👑 ${esc(U && U.boss ? U.boss.d : 'босс')}`); if (e.elite) t.push('💀 элита: на половине HP звереет'); const w = e.weak || e.boss && e.boss.weak, r = e.res || e.boss && e.boss.res; if (w) t.push(`боится ${PROP_IC[w]} ${PROP_RU[w]}`); if (r) t.push(`не берёт ${PROP_IC[r]} ${PROP_RU[r]}`); if (e.cls) t.push(`${CLS_IC[e.cls] || ''} ${CLASSES[e.cls].n.toLowerCase()}${e.bld && BUILDS[e.bld] ? ' · ' + BUILDS[e.bld].ic + ' ' + BUILDS[e.bld].n : ''}`); return t.length ? `<li><b>${esc(e.name)}</b> (${e.hp}/${e.max}): ${t.join(' · ')}</li>` : ''; }).join('');
    const pa = F.fighters.filter(f => f.team === 0).map(f => `${f.isMe ? '⭐' : ''}${esc(f.name)} ${f.alive ? `${f.hp}/${f.max}` : '😵 без сознания'}`).join(' · ');
    mid = `<div class="fprep"><b>⚔ Бой начинается!</b> ${F.prep ? 'Осмотритесь и выберите зоны — первый ход начнётся, когда нажмёте «В бой» или кончится время.' : 'Бога рядом нет — герой начнёт сам и будет осторожен.'}
      <div class="muted">Отряд: ${pa} · 🧪 зелий: ${S.hero.potions}</div>${tr ? `<ul class="ftraits">${tr}</ul>` : ''}</div>${low}
      ${mine ? `<div class="zpick">${zoneBody(F, me, 'a')}${zoneBody(F, me, 'b')}</div>` : ''}${acts}
      <div class="fctl"><button class="btn go" data-act="fgo">⚔ В бой!</button><button class="btn small ${F.auto ? 'on green' : ''}" data-act="fauto">🤖 Автобой: ${F.auto ? 'вкл' : 'выкл'}</button></div>`;
  }
  else if (turn) {
    const tele = F.tele ? `<div class="telewarn">⚠ ${esc(F.fighters.find(f => f.id === F.tele.fid).name)} ударит ${ZONE_ACC[F.tele.zone]} всех! Поставьте блок на «${ZONE_RU[F.tele.zone]}».</div>` : '';
    const ok = mine && (F.my.atk.length >= me.atkN || F.my.act) && F.my.blk.length === me.blkN;
    const ids = pIds, hNow = F.hint && F.hint.turn === F.turn;
    const hintBtn = F.auto ? '' : `<button class="btn small hintb" data-act="fhint" ${hNow || S.god.faith < HINT_COST ? 'disabled' : ''} title="Бог подсмотрит, куда целит самый опасный противник: в верх или в низ. Раз за ход.">👁 Подсказать · ${HINT_COST}</button>`;
    const hintLine = hNow ? `<div class="fhint">${esc(F.hint.txt)}${F.hint.zones.length ? ' Синие пунктирные зоны — где ждать удара.' : ''}</div>` : '';
    mid = mine ? `${tele}${low}${F.absent ? '<div class="muted">🙏 Бога нет рядом — герой бьётся сам: осторожно, без сил. Нажмите что-нибудь, чтобы взять бой под контроль.</div>' : ''}<div class="zpick">${zoneBody(F, me, 'a')}${zoneBody(F, me, 'b')}</div>
      ${hintLine}<div class="fctl"><button class="btn go ${ok ? '' : 'blue'}" data-act="fgo" ${F.auto ? 'disabled' : ''}>${F.auto ? '🤖 Герой бьётся сам…' : ok ? '⚔ Ход!' : `⚔ Ход — выберите ${F.my.atk.length < me.atkN && !F.my.act ? (me.atkN > 1 ? `${me.atkN} зоны удара` : 'удар') : ''}${F.my.atk.length < me.atkN && !F.my.act && F.my.blk.length !== me.blkN ? ' и ' : ''}${F.my.blk.length !== me.blkN ? 'блок' : ''}`}</button>${hintBtn}
      <button class="btn small ${F.auto ? 'on green' : ''}" data-act="fauto">🤖 Автобой: ${F.auto ? 'вкл' : 'выкл'}</button></div>${acts}
      <div class="muted" style="margin-top:6px">Силы бога в бою: ${F.powersLeft}/3 (1 за ход) · ${faithChip()}${F.rivalGod ? ` · у бога ${esc(F.rivalGod.name)} осталось ${F.rivalGod.left}` : ''}</div>
      <div class="acts">${ids.map(id => `<button class="btn small ${POWERS[id].br === 'wrath' ? 'red' : POWERS[id].br === 'nature' ? 'green' : ''}" data-act="fpow" data-arg="${id}" ${S.god.faith < powerCost(id) || F.powersLeft < 1 || F.usedTurn >= 1 ? 'disabled' : ''}>${DUEL_NAMES[id]} (${powerCost(id)})</button>`).join('') || '<span class="muted">Нет изученных сил.</span>'}</div>`
      : `<div class="q">😵 ${F.kind === 'dungeon' ? 'Герой без сознания — союзники бьются дальше и прикрывают его.' : 'Ваш герой выбыл из боя. Союзники бьются дальше…'}</div>${F.kind === 'dungeon' && S.god.skills.heal ? `<div class="acts"><button class="btn small green" data-act="fpow" data-arg="heal" ${S.god.faith < powerCost('heal') || F.powersLeft < 1 || F.usedTurn >= 1 ? 'disabled' : ''}>✚ Поднять героя (${powerCost('heal')})</button></div>` : ''}`;
  } else mid = `<div class="fend"><b>${esc(F.result || '')}</b>${F.rew ? `<div class="muted">${esc(F.rew)}</div>` : ''}</div><div class="btns"><button class="btn" data-act="fclose">Закрыть</button></div>`;
  setHTML(box, `<div class="card zf"><h2>⚔ ${esc(F.title)} <span class="muted">${F.phase === 'turn' ? `ход ${F.turn}` : F.phase === 'intro' ? 'подготовка' : 'итог'}</span></h2>
    ${vs}${teams}
    <div class="stat"><label><span>${turn ? (F.auto ? 'Следующий ход через' : 'До конца хода (потом герой решит сам)') : F.phase === 'intro' ? (F.prep ? 'Подготовка — бой начнётся через' : 'Бой начнётся через') : 'Закроется через'}</span><span id="fSec"></span></label><div class="bar time"><i id="fBar"></i></div></div>
    ${mid}
    <div class="flog">${F.log.slice(0, 40).map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
  { const r = box.getBoundingClientRect(); fightVis = !!box.offsetParent && r.height > 0 && r.top < innerHeight && r.bottom > 0;
    if (fightSeenId !== F.id) { fightSeenId = F.id; if (!fightVis || r.top > innerHeight * .35 || r.top < 0) { const hd = document.querySelector('header'), hh = hd && getComputedStyle(hd).position !== 'static' ? hd.getBoundingClientRect().height : 0; window.scrollTo(0, Math.max(0, r.top + scrollY - hh - 6)); const r2 = box.getBoundingClientRect(); fightVis = !!box.offsetParent && r2.height > 0 && r2.top < innerHeight && r2.bottom > 0; } } }
  $('fSec').textContent = Math.max(0, Math.ceil(F.t)) + ' с';
  $('fBar').style.width = pct(F.t, F.T);
  fightFx(F);
}
/* ---------- Пещера ---------- */
function dunGsRow(U) {
  const T = DUN_TIERS[U.diff] || DUN_TIERS.normal, g = dunGearMul(U), v = gsVerdict(g.q), B = BOSSES.find(b => U.boss && b.n === U.boss.n);
  const br = B && (B.weak || B.res) ? `👑 ${esc(B.n)}: ${B.weak ? `боится ${PROP_IC[B.weak]} ${PROP_RU[B.weak]}` : ''}${B.weak && B.res ? ', ' : ''}${B.res ? `не берёт ${PROP_IC[B.res]} ${PROP_RU[B.res]}` : ''}` : '';
  return `<div class="row dgs"><span>${T.ic} ${T.n} · ⚔ ГС отряда <b>${Math.round(g.q * (U.rec || 1))}</b> / рек. ${U.rec} — <span class="gv ${v[1]}">${v[0]}</span> · монстры ${Math.round(dunMonMul(U) * 100)}%</span>${br ? `<span class="hint">${br}</span>` : ''}</div>`;
}
function renderDunMap() {
  const box = $('dunBox'), U = S.dun;
  if (!U || (S.fight && S.fight.kind === 'dungeon' && innerWidth <= 760)) { setHTML(box, U ? `<div class="card dmap"><h2>🏰 ${esc(U.name)}</h2><div class="muted">Отряд в бою — см. выше. Ключей: ${U.keys} 🗝</div></div>` : ''); return; }
  const ex = U.phase === 'explore';
  let cells = '';
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    const t = tileAt(U, x, y), cur = U.pos.x === x && U.pos.y === y, adj = ex && t && Math.abs(x - U.pos.x) + Math.abs(y - U.pos.y) === 1;
    if (!t) { cells += '<span class="dc"></span>'; continue; }
    const seen = t.seen || t.done, ic = cur ? '🧔' : !seen ? '?' : t.done && t.t !== 'start' ? (t.t === 'boss' ? '✔' : '·') : DTILE[t.t].ic;
    const lock = t.t === 'boss' && !t.done && U.keys < 1;
    const title = seen ? DTILE[t.t].n + (t.done ? ' (пройдено)' : '') + (lock ? ' — нужен ключ' : '') : 'Неизвестно';
    const el = seen && !t.done && t.t === 'elite' ? 'elite' : '';
    cells += adj ? `<button class="dc room adj ${el} ${t.done ? 'done' : ''} ${seen ? '' : 'fog'} ${lock && seen ? 'lock' : ''}" data-act="dgo" data-arg="${x},${y}" title="${title}" aria-label="Идти: ${title}">${ic}</button>`
      : `<span class="dc room ${el} ${cur ? 'cur' : ''} ${t.done ? 'done' : ''} ${seen ? '' : 'fog'}" title="${title}">${ic}</span>`;
  }
  const party = `<div class="party2">${U.party.map(p => { const hp = p.isMe ? Math.round(S.hero.hp / S.hero.maxHp * 100) : p.hp; return `<div class="pm ${p.isMe ? 'me' : ''} ${hp <= 0 ? 'down' : ''}"><b>${CLS_IC[p.cls]} ${esc(p.hero)}</b> <span class="muted">${CLASSES[p.cls].n.toLowerCase()} ${p.lvl}</span>${bar('hp', hp, 100)}</div>`; }).join('')}</div>`;
  const roles = [dunHas(U, 'rogue') && '🗡 ловушки, замок', dunHas(U, 'cleric') && '✚ лечит после боя', dunHas(U, 'mage') && '🔮 огонь в начале боя', dunHas(U, 'ranger') && '🏹 видит дальше', dunHas(U, 'bard') && '🎻 +крит'].filter(Boolean);
  const hc = dunHealCost(), hl = DUN_K.heals - (U.heals || 0);
  const mid = U.phase === 'end' ? `<div class="q"><b>${esc(U.result || '')}</b></div><div class="btns"><button class="btn" data-act="dclose">Закрыть</button></div>`
    : U.phase === 'fight' ? '<div class="q">⚔ Отряд сражается!</div>'
    : `${U.out ? `<div class="dwarn">😵 ${esc(S.hero.name)} без сознания — друзья несут его. Поднять: зелье, лечение бога, жрец или источник. Иначе отряд идёт без него (его доля добычи — половина) или отступает.</div>` : dunLowHp(U) ? `<div class="dwarn">⚠ Отряд еле жив — лучше отступить или подлечиться (у героя ${S.hero.hp}/${S.hero.maxHp} HP).</div>` : `<div class="hint">Ходите по соседним комнатам (жёлтая рамка). Лечения почти нет — берегите отряд.</div>`}
      <div class="btns">${S.hero.potions > 0 && S.hero.hp < S.hero.maxHp ? `<button class="btn small" data-act="dpotion" title="+35% HP">🧪 ${U.out ? 'Влить зелье' : 'Зелье'} (${S.hero.potions})</button>` : ''}${S.god.skills.heal ? `<button class="btn small green" data-act="dheal" ${hl < 1 || S.god.faith < hc ? 'disabled' : ''} title="Герой +30% HP, отряд +20%">✚ Лечить отряд · ${hc} (${hl})</button>` : ''}<button class="btn small ${U.auto ? 'on green' : ''}" data-act="dauto">🧭 Авто: ${U.auto ? 'вкл' : 'выкл'}</button><button class="btn small red" data-act="dleave" title="Унесёте ${Math.round(DUN_K.left * 100)}% золота и опыта и все найденные вещи">🚪 ${U.out ? 'Унести героя и отступить' : 'Отступить с добычей'}</button></div>`;
  setHTML(box, `<div class="card dmap"><h2>🏰 ${esc(U.name)}</h2>
    <div class="row"><span>🗝 <b>${U.keys}</b> · ${U.gold} 💰 · ${U.loot.length} 🎁</span>${roles.length ? `<span class="hint">${roles.join(' · ')}</span>` : ''}</div>
    ${dunGsRow(U)}${party}<div class="dgrid">${cells}</div><div class="dleg">⚔ логово · 💀 элита · 🪤 ловушка · 💎 сундук · 🗝 ключ · ⛲ источник · 👑 босс</div>
    <div class="bossInfo">👑 <b>${esc(U.boss.n)}</b>: ${esc((BOSSES.find(b => b.n === U.boss.n) || U.boss).d)}</div>
    ${mid}${U.lastFight && U.phase !== 'fight' ? `<details class="dlast"><summary>📜 Последний бой: ${U.lastFight.won ? 'победа' : 'поражение'}, ходов ${U.lastFight.turns}</summary>${U.lastFight.log.map(l => `<div class="${esc(l.c)}">${esc(l.t)}</div>`).join('')}</details>` : ''}<div class="dlog">${U.log.slice(0, 12).map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
}
/* ---------- Арена ---------- */
function appSide(list, cap) { return list.map(m => m.me ? `<b>⭐ ${esc(m.name)}</b>` : `${CLS_IC[m.cls] || ''}${BUILDS[m.bld] ? `<span title="${esc(BUILDS[m.bld].n)}">${BUILDS[m.bld].ic}</span>` : ''} ${esc(m.name)} <span class="muted">${m.lvl || ''}</span>`).join('<br>') + (list.length < cap ? `<br><span class="muted">${'· '.repeat(cap - list.length)}свободно ${cap - list.length}</span>` : ''); }
function arenaTabHTML() {
  const A = S.arena, h = S.hero, inApp = A.apps.find(a => a.joined !== null), can = arenaCanJoin(true);
  const busy = !can ? (h.state === 'dead' ? 'Герой мёртв.' : S.fight ? 'Герой уже в бою.' : inApp ? 'Вы уже в заявке — ждём бойцов.' : h.hp < h.maxHp * .3 ? 'Герою нужно хотя бы 30% HP.' : 'Герой занят (развилка, пещера или дуэль).') : '';
  const apps = A.apps.slice().sort((a, b) => (b.joined !== null) - (a.joined !== null) || b.mine - a.mine);
  return `<div class="box"><h3>🤺 Арена · рейтинг ${A.rating}</h3><div class="muted">Побед ${A.w}, поражений ${A.l}${A.fat ? ` · усталость ${A.fat} (награды ×${Math.max(.25, 1 - .15 * A.fat).toFixed(2)})` : ''}. Бой по зонам: каждый ход выберите, куда бить и что закрывать. На арене не умирают, но можно получить травму.</div>
    ${h.inj.length ? `<div class="injrow">🤕 ${h.inj.map(j => `${esc(j.n)} (${STAT_SHORT[j.s]} −${INJURIES[j.k].pen}, ${fmtDur(j.t)})`).join('; ')}</div>` : ''}</div>
    <div class="box"><h3>📜 Подать заявку</h3><div class="btns">
      <button class="btn small" data-act="apost" data-arg="duel" ${can ? '' : 'disabled'}>🤺 1нс1</button><button class="btn small" data-act="apost" data-arg="group:3" ${can ? '' : 'disabled'}>👥 3нс3</button>
      <button class="btn small" data-act="apost" data-arg="group:5" ${can ? '' : 'disabled'}>👥 5нс5</button><button class="btn small" data-act="apost" data-arg="chaos:6" ${can ? '' : 'disabled'}>🌀 Хаот на 6</button></div>
      ${busy ? `<div class="muted">${busy}</div>` : ''}</div>
    <div class="box"><h3>⚔ Заявки на бой (${A.apps.length})</h3><div class="apps">${apps.length ? apps.map(a => {
      const ty = ARENA_TYPES[a.type], me = a.joined !== null, full = appFull(a);
      let sides, btn = '';
      if (a.type === 'chaos') sides = `<div>${appSide(a.members, a.size)}</div>`;
      else sides = `<div class="sides"><div>${appSide(a.teams[0], a.size)}</div><div class="vsx">VS</div><div>${appSide(a.teams[1], a.size)}</div></div>`;
      if (me) btn = `<button class="btn small red" data-act="aleave" data-arg="${a.id}">${a.mine ? 'Отозвать заявку' : 'Выйти'}</button>`;
      else if (!full && can) btn = a.type === 'duel' ? `<button class="btn small green" data-act="ajoin" data-arg="${a.id}:1">Принять вызов</button>`
        : a.type === 'chaos' ? `<button class="btn small green" data-act="ajoin" data-arg="${a.id}:0">Вступить в хаот</button>`
        : `<button class="btn small" data-act="ajoin" data-arg="${a.id}:0" ${a.teams[0].length >= a.size ? 'disabled' : ''}>За команду A</button><button class="btn small" data-act="ajoin" data-arg="${a.id}:1" ${a.teams[1].length >= a.size ? 'disabled' : ''}>За команду B</button>`;
      return `<div class="app ${me ? 'mine' : ''}"><div class="at"><b>${ty.ic} ${ty.n} ${appTitle(a)}</b><span class="tm">${me ? 'старт' : 'исчезнет'} через ${Math.max(0, Math.ceil(a.t))} с · ур. ${a.lvl[0]}–${a.lvl[1]}</span></div>
        <div class="muted">${a.mine ? 'Ваша заявка' : 'Автор: ' + esc(a.author)} · ${appCount(a)}/${appCap(a)}</div>${sides}${btn ? `<div class="btns">${btn}</div>` : ''}</div>`;
    }).join('') : '<div class="muted">Пока пусто. Боты скоро набегут — или подайте свою заявку.</div>'}</div></div>`;
}
function godsDunHTML() {
  const st = S.stats, g = S.god, cd = S.timers.dunCd;
  const dis = S.dun || S.fight || !['road', 'town'].includes(S.hero.state) || g.faith < 40 || dunPending;
  return `<div class="box"><h3>🏰 Пещеры</h3><div class="muted">Отряд из героя и 2–3 бойцов других богов идёт по карте комнат: ловушки, сундуки, ключ и босс. Классы важны: плут, жрец, маг, следопыт и бард помогают по-своему. Пройдено: ${st.dwinsD} из ${st.duns}, боссов: ${st.bosses}.</div>
    <div class="muted">${cd > 0 ? `Сам герой полезет в пещеру не раньше чем через ${fmtDur(cd)}.` : 'Герой готов к пещере — может забрести сам.'}</div>
    <div class="muted">⚔ Ваш ГС: <b>${gearScore(S.hero)}</b> (рек.: ${DUN_TIER_KEYS.map(k => `${DUN_TIERS[k].ic} ${recGS(S.hero.lvl, k)}`).join(' · ')}).</div>
    <div class="btns"><button class="btn small" data-act="callDun" ${dis ? 'disabled' : ''}>🏰 Собрать отряд (40)</button></div></div>`;
}
/* ---------- Чат ---------- */
let chatSeen = -1;
function renderChat() {
  const C = S.chat, dock = $('chatDock');
  dock.classList.toggle('open', C.open); dock.classList.toggle('closed', !C.open);
  if (C.open && C.unread) C.unread = 0;
  setHTML($('chatPill'), `💬 Чат${C.unread ? `<i>${C.unread}</i>` : ''}`);
  $('chatOnline').textContent = `в сети ${12 + (Math.floor(Date.now() / 60000) % 9)} богов (боты)`;
  if (chatSeen !== chatVer && C.open) {
    chatSeen = chatVer; const el = $('chatLog'), stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.innerHTML = C.msgs.map(m => `<div class="cm ${m.c}"><span class="tm">${esc(m.tm)}</span>${m.c === 'sys' ? esc(m.x) : `<b>${esc(m.from)}:</b> ${esc(m.x)}`}</div>`).join('') || '<div class="muted">Тихо. Слышно, как где-то точат топор.</div>';
    if (stick) el.scrollTop = el.scrollHeight;
  }
  const dot = S.arena.apps.filter(a => !a.mine && a.joined === null).length;
  const ad = $('arenaDot'); if (ad) ad.textContent = S.tab !== 'arena' && dot ? String(dot) : '';
  const ad2 = $('arenaDot2'); if (ad2) ad2.classList.toggle('on', !!dot && S.ui.mtab !== 'arena');
}
Object.assign(ACT, {
  fz: a => fightZone(a), ftarget: a => fightTarget(a), fgo: () => fightGo(), fauto: () => fightAuto(), fpow: a => { const f0 = S.god.faith; fightPower(a); if (S.god.faith < f0) powerFx(a, lastBtnRect); }, fpot: () => fightAct('potion'), fflee: () => fightAct('flee'),
  fclose: () => { if (S.fight && S.fight.phase === 'end') closeFight(); },
  fmanual: () => { if (!startMonsterFight()) toast('Сейчас нечего брать под контроль.'); },
  dgo: a => dunMove(a), dheal: () => dunHeal(), dpotion: () => dunPotion(false), dauto: () => dunToggleAuto(), dleave: () => { if (confirm(`Отступить? Унесёте ${Math.round(DUN_K.left * 100)}% золота и опыта и все найденные вещи. Босс останется непобеждённым.`)) dunLeave(); },
  dclose: () => { if (S.dun && S.dun.phase === 'end') S.dun = null; },
  apost: a => arenaPost(a), ajoin: a => arenaJoin(a), aleave: a => arenaLeave(a),
  chatToggle: () => { S.chat.open = !S.chat.open; chatSeen = -1; if (S.chat.open) { S.chat.unread = 0; setTimeout(() => { const i = $('chatIn'); if (i && innerWidth > 760) i.focus(); const l = $('chatLog'); if (l) l.scrollTop = l.scrollHeight; }, 0); } },
  chatSend: () => { const i = $('chatIn'); chatSend(i.value); i.value = ''; chatSeen = -1; }
});
$('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter' && S) { ACT.chatSend(); render(); } });

/* ---------- Запуск ---------- */
let lastT = performance.now();
function loop() {
  const now = performance.now(); let dt = (now - lastT) / 1000; lastT = now; if (dt > 1) dt = 1;
  if (!S) return;
  if (!S.paused) { try { step(dt); } catch (err) { console.error(err); } }
  render();
}
S = load();
if (S) { offlineCatchUp(); if (S.ev && S.ev.phase === 'live' && !S.ev.joined) joinEvent(S.ev); save(); render(); } else onboarding();
setInterval(loop, 250);
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => setLastInput(), { capture: true, passive: true });
/* Отладочный доступ из консоли / тестов */
window.GAME = { heroPicksFeat, chooseAsi, BUILDS, BUILD_BAL, BLD_K, bldId, bldStatW, bldFit, pickBuild, bldForBot, mkBld, initBuild, buildStat, heroFeatPref, startRespec, reconsider, bldResult, bldItem, bldTick, suggestBuild, bldFx, inferBuild, bldModal, itemScore, offerFeat, EQ_KEYS, BASES, WCAT, SETS, LEGENDARY, PROP_DEF, CURSES, makeSetItem, makeLegend, reqOk, reqHtml, equip, equipInv, tryEquipInv, bestPlace, setCounts, setBonusProps, allProps, zoneArmor, gearFx, itemModal, sheetModal, virtualHero, nameOf, keepInInv, shopPick, gearScore, itemGS, typGS, recGS, DUN_TIERS, GS_K, smithUpgrade, smithCost, smithOk, autoTier, dunGearMul, dunMonMul, startDungeon, tierModal, gearProps, monsterUnit, closeModal, dunHeal, dunHealCost, DUN_K, CLASS_BAL, ROAD_K, MON_K, BOSSES, monsterRef, get S() { return S; }, render: () => render(), set S(v) { S = v; }, maxFaith: () => maxFaith(), FORKS, WEVENTS, SAVE_KEY, save, load, startFork, startDuel, startGodDuel, startEvent, startDungeon, answerFork, usePower, evGive, evVote, step, heroStep, simulateAway, offlineCatchUp, chooseFeat, chooseAsi, offerFeat, liftCurse, makeItem, equip, check, sheet, calcMaxHp, xpNext, xpUnit, defaultState, gainXp, RACES, CLASSES, FEATS, MAX_LVL, PACE, migrate, sanitize,
  heroBrain, fleeChance, fightAct, endFled, godPresent, setLastInput, dunWake, partyWeak, dunPotion, dunHeal, dunAutoStep, renderFight, nextTurn, resolveTurn, hitOne, botBrain,
  startFight, fightZone, fightTarget, fightGo, fightAuto, fightPower, closeFight, autoResolveBattle, startMonsterFight, beginBattle, heroUnit, botUnit, monsterUnit, injure, healInjuries, statVal,
  arenaPost, arenaJoin, arenaLeave, arenaStep, newBotApp, fightProv, chat, chatSend, dunMove, dunAutoStep, dunAutoFinish, dunLeave, dunToggleAuto, endDungeon, genDungeon, validFight, validDun, ZONES,
  get dunPending() { return dunPending; }, get duelPending() { return duelPending; },
  MOMENTS, MOM_BY, MOM_T, startMoment, answerMoment, timeoutMoment, forkPaused, momentButtons, momCtx, forkOptions, get momClock() { return momClock; },
  PWA, parseSave, checkUpdate, APP_BUILD,
  fightHint, HINT_COST, powerModal, powerEffect, powerWhy, routePos, themeOf, awayModal, get lastAway() { return lastAway; }, sfx, get audioCtx() { return audioCtx; }, diaryDetail, diary, NAV_TABS, renderDiary, get diaryLim() { return diaryLim; } };

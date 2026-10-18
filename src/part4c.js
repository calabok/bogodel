
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
  return tg ? `<button class="fr tg ${sel ? 'sel' : ''}" data-act="ftarget" data-arg="${f.id}">${inner}</button>`
    : `<div class="fr ${f.isMe ? 'me' : ''} ${f.alive ? '' : 'dead'} ${sel ? 'sel' : ''}">${inner}</div>`;
}
function zoneBody(F, me, k) {
  const sel = k === 'a' ? F.my.atk : F.my.blk, dis = F.auto || F.phase !== 'turn' || !me.alive;
  const n = k === 'a' ? me.atkN : me.blkN;
  const lbl = k === 'a' ? `⚔ Удар${n > 1 ? ` (${n} зоны)` : ''}` : `🛡 Блок (${n} ${plural(n, 'зона', 'зоны', 'зон')})`;
  return `<div class="body ${k === 'a' ? 'atk' : 'blk'}"><h4>${lbl}</h4>${ZONES.map(z => `<button class="zb ${z} ${sel.includes(z) ? 'on' : ''} ${k === 'b' && F.tele && F.tele.zone === z ? 'tele' : ''}" data-act="fz" data-arg="${k}:${z}" ${dis ? 'disabled' : ''} aria-label="${k === 'a' ? 'Удар' : 'Блок'}: ${ZONE_RU[z]}">${ZONE_RU[z]}</button>`).join('')}</div>`;
}
function renderFight() {
  const box = $('fightBox'), F = S.fight;
  if (!F) { setHTML(box, ''); return; }
  const me = fMe(F), turn = F.phase === 'turn', mine = me && me.alive;
  const t0 = F.fighters.filter(f => f.team === 0), t1 = F.fighters.filter(f => f.team === 1);
  const teams = `<div class="teams"><div class="team"><h4>${t0.length > 1 ? 'Наши' : 'Вы'}</h4>${t0.map(f => fighterRow(F, f, me, false)).join('')}</div>
    <div class="team"><h4>${t1.length > 1 ? `Противники${turn && mine ? ' · нажмите — цель' : ''}` : 'Противник'}</h4>${t1.map(f => fighterRow(F, f, me, turn && mine && fAlive(F, 1).length > 1)).join('')}</div></div>`;
  let mid = '';
  if (F.phase === 'intro') mid = `<div class="q">Бойцы выходят на арену и разминают шеи…</div>`;
  else if (turn) {
    const tele = F.tele ? `<div class="telewarn">⚠ ${esc(F.fighters.find(f => f.id === F.tele.fid).name)} ударит ${ZONE_ACC[F.tele.zone]} всех! Поставьте блок на «${ZONE_RU[F.tele.zone]}».</div>` : '';
    const ok = mine && F.my.atk.length >= me.atkN && F.my.blk.length === me.blkN;
    const ids = Object.keys(POWERS).filter(id => S.god.skills[id]);
    mid = mine ? `${tele}<div class="zpick">${zoneBody(F, me, 'a')}${zoneBody(F, me, 'b')}</div>
      <div class="fctl"><button class="btn go ${ok ? '' : 'blue'}" data-act="fgo" ${F.auto ? 'disabled' : ''}>${F.auto ? '🤖 Герой бьётся сам…' : ok ? '⚔ Ход!' : '⚔ Ход (герой доберёт сам)'}</button>
      <button class="btn small ${F.auto ? 'on green' : ''}" data-act="fauto">🤖 Автобой: ${F.auto ? 'вкл' : 'выкл'}</button></div>
      <div class="muted" style="margin-top:6px">Силы бога в бою: ${F.powersLeft}/3 (1 за ход) · ${faithChip()}${F.rivalGod ? ` · у бога ${esc(F.rivalGod.name)} осталось ${F.rivalGod.left}` : ''}</div>
      <div class="acts">${ids.map(id => `<button class="btn small ${POWERS[id].br === 'wrath' ? 'red' : POWERS[id].br === 'nature' ? 'green' : ''}" data-act="fpow" data-arg="${id}" ${S.god.faith < powerCost(id) || F.powersLeft < 1 || F.usedTurn >= 1 ? 'disabled' : ''}>${DUEL_NAMES[id]} (${powerCost(id)})</button>`).join('') || '<span class="muted">Нет изученных сил.</span>'}</div>`
      : `<div class="q">Ваш герой выбыл из боя. Союзники бьются дальше…</div>`;
  } else mid = `<div class="fend"><b>${esc(F.result || '')}</b>${F.rew ? `<div class="muted">${esc(F.rew)}</div>` : ''}</div><div class="btns"><button class="btn" data-act="fclose">Закрыть</button></div>`;
  setHTML(box, `<div class="card zf"><h2>⚔ ${esc(F.title)} <span class="muted">${F.phase === 'turn' ? `ход ${F.turn}` : F.phase === 'intro' ? 'подготовка' : 'итог'}</span></h2>
    ${teams}
    <div class="stat"><label><span>${turn ? (F.auto ? 'Следующий ход через' : 'До конца хода (потом герой решит сам)') : F.phase === 'intro' ? 'Бой начнётся через' : 'Закроется через'}</span><span id="fSec"></span></label><div class="bar time"><i id="fBar"></i></div></div>
    ${mid}
    <div class="flog">${F.log.slice(0, 40).map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
  $('fSec').textContent = Math.max(0, Math.ceil(F.t)) + ' с';
  $('fBar').style.width = pct(F.t, F.T);
}
/* ---------- Пещера ---------- */
function renderDunMap() {
  const box = $('dunBox'), U = S.dun;
  if (!U || (S.fight && S.fight.kind === 'dungeon' && innerWidth <= 760)) { setHTML(box, U ? `<div class="card dmap"><h2>🏰 ${esc(U.name)}</h2><div class="muted">Отряд в бою — см. выше. Ключей: ${U.keys} 🗝</div></div>` : ''); return; }
  const ex = U.phase === 'explore';
  let cells = '';
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    const t = tileAt(U, x, y), cur = U.pos.x === x && U.pos.y === y, adj = ex && t && Math.abs(x - U.pos.x) + Math.abs(y - U.pos.y) === 1;
    if (!t) { cells += '<span class="dc"></span>'; continue; }
    const seen = t.seen || t.done, ic = cur ? '🧔' : !seen ? '?' : t.done && t.t !== 'start' ? (t.t === 'boss' ? '💀' : '·') : DTILE[t.t].ic;
    const lock = t.t === 'boss' && !t.done && U.keys < 1;
    const title = seen ? DTILE[t.t].n + (t.done ? ' (пройдено)' : '') + (lock ? ' — нужен ключ' : '') : 'Неизвестно';
    cells += adj ? `<button class="dc room adj ${t.done ? 'done' : ''} ${seen ? '' : 'fog'} ${lock && seen ? 'lock' : ''}" data-act="dgo" data-arg="${x},${y}" title="${title}" aria-label="Идти: ${title}">${ic}</button>`
      : `<span class="dc room ${cur ? 'cur' : ''} ${t.done ? 'done' : ''} ${seen ? '' : 'fog'}" title="${title}">${ic}</span>`;
  }
  const party = `<div class="party2">${U.party.map(p => { const hp = p.isMe ? Math.round(S.hero.hp / S.hero.maxHp * 100) : p.hp; return `<div class="pm ${p.isMe ? 'me' : ''} ${hp <= 0 ? 'down' : ''}"><b>${CLS_IC[p.cls]} ${esc(p.hero)}</b> <span class="muted">${CLASSES[p.cls].n.toLowerCase()} ${p.lvl}</span>${bar('hp', hp, 100)}</div>`; }).join('')}</div>`;
  const roles = [dunHas(U, 'rogue') && '🗡 плут обезвредит ловушки и вскроет замок', dunHas(U, 'cleric') && '✚ жрец лечит после боя', dunHas(U, 'mage') && '🔮 маг начинает бой огненным шаром', dunHas(U, 'ranger') && '🏹 следопыт видит дальше', dunHas(U, 'bard') && '🎻 бард: +крит отряду'].filter(Boolean);
  const mid = U.phase === 'end' ? `<div class="q"><b>${esc(U.result || '')}</b></div><div class="btns"><button class="btn" data-act="dclose">Закрыть</button></div>`
    : U.phase === 'fight' ? '<div class="q">⚔ Отряд сражается!</div>'
    : `<div class="muted">Нажмите на соседнюю комнату (жёлтая рамка). Найдите 🗝 и одолейте 👑. Бог задумается дольше 25 с — отряд пойдёт сам.</div>
      <div class="btns"><button class="btn small ${U.auto ? 'on green' : ''}" data-act="dauto">🧭 Автопроход: ${U.auto ? 'вкл' : 'выкл'}</button><button class="btn small red" data-act="dleave">🚪 Уйти из пещеры</button></div>`;
  setHTML(box, `<div class="card dmap"><h2>🏰 ${esc(U.name)}</h2>
    <div class="row"><span>Ключей: <b>${U.keys} 🗝</b> · добыча: ${U.gold} 💰, ${U.loot.length} 🎁</span><span class="muted">босс: ${esc(U.boss.n)}</span></div>
    ${party}<div class="dgrid">${cells}</div><div class="dleg">🚪 вход · ⚔ логово · 🪤 ловушка · 💎 сундук · 🗝 ключ · ⛲ источник · 👑 босс · ? туман</div>
    ${roles.length ? `<div class="muted">${roles.join(' · ')}</div>` : ''}
    ${mid}<div class="dlog">${U.log.slice(0, 12).map(l => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div></div>`);
}
/* ---------- Арена ---------- */
function appSide(list, cap) { return list.map(m => m.me ? `<b>⭐ ${esc(m.name)}</b>` : `${CLS_IC[m.cls] || ''} ${esc(m.name)} <span class="muted">${m.lvl || ''}</span>`).join('<br>') + (list.length < cap ? `<br><span class="muted">${'· '.repeat(cap - list.length)}свободно ${cap - list.length}</span>` : ''); }
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
  const dis = S.dun || S.fight || S.fork || !['road', 'town'].includes(S.hero.state) || g.faith < 40 || dunPending;
  return `<div class="box"><h3>🏰 Пещеры</h3><div class="muted">Отряд из героя и 2–3 бойцов других богов идёт по карте комнат: ловушки, сундуки, ключ и босс. Классы важны: плут, жрец, маг, следопыт и бард помогают по-своему. Пройдено: ${st.dwinsD} из ${st.duns}, боссов: ${st.bosses}.</div>
    <div class="muted">${cd > 0 ? `Сам герой полезет в пещеру не раньше чем через ${fmtDur(cd)}.` : 'Герой готов к пещере — может забрести сам.'}</div>
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
}
Object.assign(ACT, {
  fz: a => fightZone(a), ftarget: a => fightTarget(a), fgo: () => fightGo(), fauto: () => fightAuto(), fpow: a => fightPower(a),
  fclose: () => { if (S.fight && S.fight.phase === 'end') closeFight(); },
  fmanual: () => { if (!startMonsterFight()) toast('Сейчас нечего брать под контроль.'); },
  dgo: a => dunMove(a), dauto: () => dunToggleAuto(), dleave: () => { if (confirm('Увести отряд из пещеры? Добыча будет урезана.')) dunLeave(); },
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
/* Отладочный доступ из консоли / тестов */
window.GAME = { get S() { return S; }, render: () => render(), set S(v) { S = v; }, maxFaith: () => maxFaith(), FORKS, WEVENTS, SAVE_KEY, save, load, startFork, startDuel, startGodDuel, startEvent, startDungeon, answerFork, usePower, evGive, evVote, step, heroStep, simulateAway, offlineCatchUp, chooseFeat, chooseAsi, offerFeat, liftCurse, makeItem, equip, check, sheet, calcMaxHp, xpNext, xpUnit, defaultState, gainXp, RACES, CLASSES, FEATS, MAX_LVL, PACE, migrate, sanitize,
  fightZone, fightTarget, fightGo, fightAuto, fightPower, closeFight, autoResolveBattle, startMonsterFight, beginBattle, heroUnit, botUnit, monsterUnit, injure, healInjuries, statVal,
  arenaPost, arenaJoin, arenaLeave, arenaStep, newBotApp, fightProv, chat, chatSend, dunMove, dunAutoStep, dunAutoFinish, dunLeave, dunToggleAuto, endDungeon, genDungeon, validFight, validDun, ZONES,
  get dunPending() { return dunPending; }, get duelPending() { return duelPending; },
  PWA, parseSave, checkUpdate, APP_BUILD };

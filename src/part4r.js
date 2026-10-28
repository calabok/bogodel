/* =====================================================================
   5е) Runner HUD + living stage (v21/v22)
   Dota/Desk-Rival strip: diary → stage scenes + world interactables.
   ===================================================================== */
const RHUD_FEED_MAX = 6;
const RHUD_DOCK_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'amulet'];
const RHUD_POWERS = ['heal', 'bless', 'shield', 'bolt'];

/* kind → default pose + prop recipe for the runner stage */
const RHUD_SCENE = {
  dig:       { pose: 'attack', dur: 2800, label: 'Копает' },
  preach:    { pose: 'idle',   dur: 3000, label: 'Проповедь' },
  rest:      { pose: 'idle',   dur: 3200, label: 'Привал' },
  loot:      { pose: 'idle',   dur: 2600, label: 'Добыча' },
  rare:      { pose: 'idle',   dur: 2600, label: 'Редкость' },
  pray:      { pose: 'idle',   dur: 2600, label: 'Молитва' },
  heal:      { pose: 'idle',   dur: 2400, label: 'Лечение' },
  shop:      { pose: 'idle',   dur: 2400, label: 'Лавка' },
  smith:     { pose: 'attack', dur: 2600, label: 'Кузнец' },
  temple:    { pose: 'idle',   dur: 2600, label: 'Храм' },
  town:      { pose: 'walk',   dur: 2200, label: 'Город' },
  dungeon:   { pose: 'walk',   dur: 2400, label: 'Пещера' },
  fight:     { pose: 'attack', dur: 2000, label: 'Бой' },
  duel:      { pose: 'attack', dur: 2400, label: 'Дуэль' },
  death:     { pose: 'dead',   dur: 3200, label: 'Падение' },
  resurrect: { pose: 'idle',   dur: 2800, label: 'Воскрешение' },
  cheer:     { pose: 'idle',   dur: 2200, label: 'Ура!' },
  quest:     { pose: 'idle',   dur: 2200, label: 'Задание' },
  army:      { pose: 'attack', dur: 2400, label: 'Армия' },
  oly:       { pose: 'idle',   dur: 2400, label: 'Олимп' },
  travel:    { pose: 'walk',   dur: 1600, label: 'В пути' },
  talk:      { pose: 'idle',   dur: 1800, label: 'Разговор' },
  event:     { pose: 'idle',   dur: 2000, label: 'Событие' },
  steal:     { pose: 'idle',   dur: 2400, label: 'Кража' },
  flee:      { pose: 'walk',   dur: 2000, label: 'Бегство' },
  ill:       { pose: 'hurt',   dur: 2600, label: 'Болезнь' },
  fest:      { pose: 'idle',   dur: 2800, label: 'Праздник' },
  meet:      { pose: 'idle',   dur: 2400, label: 'Встреча' },
  rain:      { pose: 'idle',   dur: 2400, label: 'Дождь' },
  storm:     { pose: 'hurt',   dur: 2600, label: 'Гроза' },
  bless:     { pose: 'idle',   dur: 2400, label: 'Благословение' },
  curse:     { pose: 'hurt',   dur: 2400, label: 'Проклятие' },
  divine:    { pose: 'idle',   dur: 2600, label: 'Чудо' },
  equip:     { pose: 'idle',   dur: 2200, label: 'Снаряжение' },
  injury:    { pose: 'hurt',   dur: 2400, label: 'Травма' },
  offline:   { pose: 'idle',   dur: 1800, label: 'Сводка' }
};

let rhudVis = {
  feed: [],
  floats: [],
  floatSeq: 0,
  lastFightId: null,
  lastFxN: 0,
  biome: null,
  suppress: false,
  /* living stage */
  scene: null,       /* {kind, pose, t0, dur, phase, interact} */
  sceneQ: [],
  world: [],         /* interactables: {id, kind, state, x} */
  worldSeq: 0,
  heroX: 18,         /* % along stage floor */
  slash: null,       /* fight slash pulse */
  pausedWalk: false
};

function rhudNow() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now());
}

function rhudShort(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

function rhudIc(e) {
  if (e && e.c && typeof D_IC === 'object' && D_IC[e.c]) return D_IC[e.c];
  if (typeof amapClassifyDiary === 'function') {
    const fx = amapClassifyDiary(e || {});
    if (fx && fx.icon) return fx.icon;
  }
  return '📜';
}

function rhudPushFeed(e) {
  if (!e || rhudVis.suppress) return;
  const line = {
    i: e.i || (++rhudVis.floatSeq),
    tm: e.tm || '',
    x: rhudShort(e.x, 72),
    c: e.c || '',
    ic: rhudIc(e),
    t0: rhudNow()
  };
  rhudVis.feed = [line].concat(rhudVis.feed.filter(f => f.i !== line.i)).slice(0, RHUD_FEED_MAX);
}

/* ---------- Stage scene catalog (HTML props) ---------- */
function rhudScenePropsHTML(kind) {
  const weather = (kind === 'rain')
    ? `<div class="rhud-weather rhud-rain" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>`
    : (kind === 'storm')
    ? `<div class="rhud-weather rhud-storm" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span class="rhud-bolt">⚡</span></div>`
    : '';
  let body = '';
  switch (kind) {
    case 'dig':
      body = `<div class="rhud-prop rhud-dig"><span class="rhud-dig-hole"></span><span class="rhud-dig-pile rhud-dig-pile-a"></span><span class="rhud-dig-pile rhud-dig-pile-b"></span><span class="rhud-dig-shovel">⛏️</span><span class="rhud-dig-spark">✨</span></div>`; break;
    case 'preach':
      body = `<div class="rhud-prop rhud-preach"><span class="rhud-crowd"><i>🙂</i><i>😮</i><i>🙏</i><i>🧒</i></span><span class="rhud-preach-aura">📣</span></div>`; break;
    case 'rest':
      body = `<div class="rhud-prop rhud-rest"><span class="rhud-campfire"><i class="rhud-flame">🔥</i><i class="rhud-log">🪵</i></span><span class="rhud-tent">⛺</span><span class="rhud-smoke"></span></div>`; break;
    case 'loot': case 'rare':
      body = `<div class="rhud-prop rhud-loot"><span class="rhud-chest" data-open="0">📦</span><span class="rhud-sparkle">✨</span><span class="rhud-sparkle rhud-sparkle-b">💫</span></div>`; break;
    case 'pray': case 'temple':
      body = `<div class="rhud-prop rhud-shrine"><span class="rhud-shrine-stone">🛕</span><span class="rhud-shrine-glow"></span><span class="rhud-shrine-hands">🙏</span></div>`; break;
    case 'heal':
      body = `<div class="rhud-prop rhud-heal"><span class="rhud-well">🚰</span><span class="rhud-heal-plus">✚</span><span class="rhud-potion">🧪</span></div>`; break;
    case 'shop':
      body = `<div class="rhud-prop rhud-shop"><span class="rhud-stall">🏪</span><span class="rhud-coin">💰</span><span class="rhud-merchant">🧑‍🌾</span></div>`; break;
    case 'smith':
      body = `<div class="rhud-prop rhud-smith"><span class="rhud-anvil">⚒</span><span class="rhud-hammer">🔨</span><span class="rhud-sparks">✨</span></div>`; break;
    case 'town':
      body = `<div class="rhud-prop rhud-gate"><span class="rhud-gate-arch">🏘</span><span class="rhud-gate-door">🚪</span></div>`; break;
    case 'dungeon':
      body = `<div class="rhud-prop rhud-cave"><span class="rhud-cave-mouth">🕳</span><span class="rhud-cave-torch">🔦</span></div>`; break;
    case 'death':
      body = `<div class="rhud-prop rhud-death"><span class="rhud-tomb">🪦</span><span class="rhud-death-aura">💀</span></div>`; break;
    case 'resurrect':
      body = `<div class="rhud-prop rhud-resurrect"><span class="rhud-angel">👼</span><span class="rhud-lightbeam"></span></div>`; break;
    case 'cheer':
      body = `<div class="rhud-prop rhud-cheer"><span class="rhud-stars">⭐✨⭐</span><span class="rhud-confetti">🎊</span></div>`; break;
    case 'quest':
      body = `<div class="rhud-prop rhud-quest"><span class="rhud-quest-board">📌</span><span class="rhud-scroll">📜</span></div>`; break;
    case 'army':
      body = `<div class="rhud-prop rhud-army"><span class="rhud-banners">⚔🛡⚔</span><span class="rhud-soldiers"><i>🪖</i><i>🪖</i><i>🪖</i></span></div>`; break;
    case 'oly':
      body = `<div class="rhud-prop rhud-oly"><span class="rhud-crown">👑</span><span class="rhud-columns">🏛</span></div>`; break;
    case 'fight':
      body = `<div class="rhud-prop rhud-fightsc"><span class="rhud-clash">💥</span></div>`; break;
    case 'duel':
      body = `<div class="rhud-prop rhud-duel"><span class="rhud-arena">🏟</span><span class="rhud-clash">💥</span><span class="rhud-crowd-small"><i>😮</i><i>👏</i></span></div>`; break;
    case 'steal':
      body = `<div class="rhud-prop rhud-steal"><span class="rhud-bag">👜</span><span class="rhud-shadow">🥷</span><span class="rhud-sparkle">✨</span></div>`; break;
    case 'flee':
      body = `<div class="rhud-prop rhud-flee"><span class="rhud-dust">💨</span><span class="rhud-trail">····</span></div>`; break;
    case 'ill':
      body = `<div class="rhud-prop rhud-ill"><span class="rhud-sick">🤒</span><span class="rhud-bed">🛏</span></div>`; break;
    case 'fest':
      body = `<div class="rhud-prop rhud-fest"><span class="rhud-banner">🎏</span><span class="rhud-crowd"><i>🥳</i><i>🎉</i><i>🧒</i></span><span class="rhud-confetti">🎊</span></div>`; break;
    case 'meet':
      body = `<div class="rhud-prop rhud-meet"><span class="rhud-npc">🗣️</span><span class="rhud-handshake">🤝</span></div>`; break;
    case 'rain':
      body = `<div class="rhud-prop rhud-rainsc"><span class="rhud-puddle"></span><span class="rhud-umbrella">☂️</span></div>`; break;
    case 'storm':
      body = `<div class="rhud-prop rhud-stormsc"><span class="rhud-bolt-big">⚡</span><span class="rhud-crack"></span></div>`; break;
    case 'bless':
      body = `<div class="rhud-prop rhud-bless"><span class="rhud-halo">😇</span><span class="rhud-sparkle">✨</span><span class="rhud-clover">🍀</span></div>`; break;
    case 'curse':
      body = `<div class="rhud-prop rhud-curse"><span class="rhud-skull">😈</span><span class="rhud-gloom"></span></div>`; break;
    case 'divine':
      body = `<div class="rhud-prop rhud-divine"><span class="rhud-lightbeam"></span><span class="rhud-godhand">✋</span><span class="rhud-sparkle">✨</span></div>`; break;
    case 'equip':
      body = `<div class="rhud-prop rhud-equip"><span class="rhud-gear-pop">🧥</span><span class="rhud-sparkle">✨</span></div>`; break;
    case 'injury':
      body = `<div class="rhud-prop rhud-injury"><span class="rhud-bandage">🩹</span><span class="rhud-ouch">🤕</span></div>`; break;
    case 'offline':
      body = `<div class="rhud-prop rhud-offline"><span class="rhud-moon">🌙</span><span class="rhud-scroll">📜</span></div>`; break;
    case 'travel':
      body = `<div class="rhud-prop rhud-travel"><span class="rhud-road-sign">🛣</span></div>`; break;
    case 'event':
      body = `<div class="rhud-prop rhud-event"><span class="rhud-globe">🌍</span><span class="rhud-scroll">📰</span></div>`; break;
    default:
      body = `<div class="rhud-prop rhud-talk"><span class="rhud-bubble">💬</span></div>`;
  }
  return weather + body;
}

function rhudWorldHTML() {
  if (!rhudVis.world.length) return '';
  const ic = w => {
    if (w.kind === 'chest') return w.state === 'open' ? '📭' : '📦';
    return ({
      sparkle: '✨', shrine: '🛕', digspot: '🪨', camp: '🔥', well: '🚰', gate: '🚪',
      stall: '🏪', anvil: '⚒', cave: '🕳', bag: '👜', board: '📌', npc: '🗣️', banner: '🎏'
    })[w.kind] || '•';
  };
  return `<div class="rhud-world" aria-hidden="true">${rhudVis.world.map(w =>
    `<span class="rhud-obj rhud-obj-${w.kind} st-${w.state}" data-id="${w.id}" style="--ox:${w.x}%">${ic(w)}</span>`
  ).join('')}</div>`;
}

function rhudSceneOverlayHTML() {
  const sc = rhudVis.scene;
  if (!sc) return '';
  const age = rhudNow() - sc.t0;
  const left = Math.max(0, sc.dur - age);
  return `<div class="rhud-scene rhud-scene-${sc.kind} ph-${sc.phase || 'act'}" data-kind="${sc.kind}" style="--scene-t:${Math.min(1, age / Math.max(1, sc.dur))}">
    ${rhudScenePropsHTML(sc.kind)}
    <span class="rhud-scene-tag">${esc(sc.label || '')}</span>
  </div>`;
}

/* ---------- Interactable spawning + choreography ---------- */
function rhudSpawnWorld(kind, x) {
  const id = ++rhudVis.worldSeq;
  const obj = { id, kind, state: 'idle', x: x == null ? (55 + (id % 5) * 6) : x };
  rhudVis.world.push(obj);
  if (rhudVis.world.length > 5) rhudVis.world.shift();
  return obj;
}

function rhudKindToObj(kind) {
  const M = {
    loot: 'chest', rare: 'chest', dig: 'digspot', rest: 'camp',
    pray: 'shrine', temple: 'shrine', bless: 'shrine', divine: 'shrine',
    heal: 'well', shop: 'stall', smith: 'anvil', town: 'gate',
    dungeon: 'cave', steal: 'bag', quest: 'board', meet: 'npc',
    fest: 'banner', equip: 'sparkle'
  };
  return M[kind] || null;
}

function rhudStartScene(kind, meta) {
  meta = meta || {};
  const def = RHUD_SCENE[kind] || RHUD_SCENE.event;
  const scene = {
    kind,
    pose: meta.pose || def.pose,
    label: meta.label || def.label,
    t0: rhudNow(),
    dur: meta.dur || def.dur,
    phase: 'approach',
    interact: !!meta.interact,
    objId: meta.objId || null
  };
  /* queue if busy with a long scene */
  if (rhudVis.scene && (rhudNow() - rhudVis.scene.t0) < rhudVis.scene.dur * 0.55) {
    if (rhudVis.sceneQ.length >= 3) rhudVis.sceneQ.shift();
    rhudVis.sceneQ.push(scene);
    return scene;
  }
  rhudVis.scene = scene;
  rhudVis.pausedWalk = true;
  /* spawn matching world object for interaction */
  const okind = rhudKindToObj(kind);
  if (okind && meta.interact !== false) {
    const obj = rhudSpawnWorld(okind, kind === 'rest' ? 48 : 62);
    scene.objId = obj.id;
    scene.interact = true;
  }
  rhudPumpScene();
  return scene;
}

function rhudClearSceneDomSoft() {
  /* live DOM update without full render */
  const stage = document.querySelector('#colHero .rhud-stage-inner');
  if (!stage) return;
  let ov = stage.querySelector('.rhud-scene');
  const sc = rhudVis.scene;
  if (!sc) {
    if (ov) ov.remove();
    stage.querySelectorAll('.rhud-world').forEach(el => el.remove());
    return;
  }
  const html = rhudSceneOverlayHTML() + rhudWorldHTML();
  let wrap = stage.querySelector('.rhud-live');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'rhud-live';
    stage.appendChild(wrap);
  }
  wrap.innerHTML = html;
  /* open chest mid-scene */
  if (sc.kind === 'loot' && sc.phase === 'act') {
    const chest = wrap.querySelector('.rhud-chest');
    if (chest) { chest.dataset.open = '1'; chest.textContent = '📭'; }
  }
  if (sc.objId) {
    const obj = rhudVis.world.find(w => w.id === sc.objId);
    if (obj && sc.phase === 'act') obj.state = (obj.kind === 'chest' ? 'open' : 'used');
  }
  /* hero slide toward object */
  const hero = stage.querySelector('.rhud-hero');
  if (hero) {
    const target = sc.phase === 'approach' ? 42 : (sc.phase === 'act' ? 50 : 22);
    rhudVis.heroX = target;
    hero.style.setProperty('--hx', target + '%');
    hero.classList.toggle('rhud-hero-act', sc.phase === 'act');
  }
  /* pose — only interactive scenes stamp a pose (ambient leave runner pose alone) */
  const AMBIENT = { talk:1, travel:1, quest:1, cheer:1, offline:1, event:1, rare:1, oly:1, town:1, meet:1, pray:1, divine:1, bless:1, equip:1 };
  if (typeof visSetPoseOn === 'function' && sc.pose && !AMBIENT[sc.kind]) {
    document.querySelectorAll('#colHero .rhud-hero .vwrap, #colHero .rhud-doll').forEach(el => {
      try { visSetPoseOn(el, sc.phase === 'done' ? 'walk' : sc.pose); } catch (e) {}
    });
  }
  const root = document.querySelector('#colHero .rhud');
  if (root) {
    root.dataset.scene = sc.kind;
    root.classList.toggle('rhud-busy', sc.phase !== 'done');
  }
}

function rhudPumpScene() {
  const sc = rhudVis.scene;
  if (!sc) {
    rhudVis.pausedWalk = false;
    if (rhudVis.sceneQ.length) {
      rhudVis.scene = rhudVis.sceneQ.shift();
      rhudVis.scene.t0 = rhudNow();
      rhudVis.pausedWalk = true;
      rhudPumpScene();
    }
    return;
  }
  const age = rhudNow() - sc.t0;
  const d = sc.dur || 2400;
  if (age < d * 0.22) sc.phase = 'approach';
  else if (age < d * 0.78) sc.phase = 'act';
  else sc.phase = 'done';

  rhudClearSceneDomSoft();

  if (age >= d) {
    /* finish interactable */
    if (sc.objId) {
      rhudVis.world = rhudVis.world.filter(w => w.id !== sc.objId || w.state === 'open');
      /* keep open chest briefly then drop */
      setTimeout(() => {
        rhudVis.world = rhudVis.world.filter(w => w.id !== sc.objId);
        rhudClearSceneDomSoft();
      }, 900);
    }
    rhudVis.scene = null;
    rhudVis.pausedWalk = false;
    rhudVis.heroX = 18;
    const hero = document.querySelector('#colHero .rhud-hero');
    if (hero) { hero.style.setProperty('--hx', '18%'); hero.classList.remove('rhud-hero-act'); }
    const root = document.querySelector('#colHero .rhud');
    if (root) { delete root.dataset.scene; root.classList.remove('rhud-busy'); }
    if (typeof visSetPoseOn === 'function' && S && S.hero && S.hero.state === 'road' && !S.fight) {
      document.querySelectorAll('#colHero .rhud-hero .vwrap').forEach(el => { try { visSetPoseOn(el, 'walk'); } catch (e) {} });
    }
    if (rhudVis.sceneQ.length) {
      setTimeout(rhudPumpScene, 80);
      rhudVis.scene = rhudVis.sceneQ.shift();
      rhudVis.scene.t0 = rhudNow();
      rhudVis.pausedWalk = true;
    }
    return;
  }
  const next = sc.phase === 'approach' ? d * 0.22 - age : (sc.phase === 'act' ? d * 0.78 - age : d - age);
  setTimeout(rhudPumpScene, Math.max(60, Math.min(220, next + 20)));
}

/* ---------- Diary → feed + stage ---------- */
function rhudOnDiary(e) {
  try {
    if (rhudVis.suppress) return;
    if (typeof SILENT !== 'undefined' && SILENT) return;
    rhudPushFeed(e);
    const box = document.querySelector('#colHero .rhud-feed-list');
    if (box) {
      box.innerHTML = rhudFeedListHTML();
      const first = box.firstElementChild;
      if (first) first.classList.add('rhud-feed-new');
    }
    /* drive living stage from same classification as map FX */
    let kind = 'talk';
    if (typeof amapClassifyDiary === 'function') {
      const fx = amapClassifyDiary(e);
      kind = (fx && fx.kind) || kind;
      if (kind === 'level') kind = 'cheer';
    }
    /* every classified diary line drives a stage scene (no feed-only path) */
    rhudStartScene(kind, { interact: true, pose: (RHUD_SCENE[kind] || {}).pose });
  } catch (err) { /* never break diary */ }
}

function rhudSeedFeed() {
  if (!S || !S.diary) return;
  if (rhudVis.feed.length) return;
  const src = S.diary.slice(0, RHUD_FEED_MAX);
  rhudVis.feed = src.map(e => ({
    i: e.i, tm: e.tm || '', x: rhudShort(e.x, 72), c: e.c || '', ic: rhudIc(e), t0: 0
  }));
}

function rhudFeedListHTML() {
  if (!rhudVis.feed.length) {
    return `<li class="rhud-feed-empty">История появится, как только герой что-то сделает…</li>`;
  }
  return rhudVis.feed.map(f =>
    `<li class="rhud-feed-item" data-c="${esc(f.c || '')}"><span class="rhud-feed-ic">${f.ic}</span><span class="rhud-feed-tx">${esc(f.x)}</span></li>`
  ).join('');
}

function rhudBarsHTML(h) {
  h = h || S.hero;
  const xpNeed = (typeof xpNext === 'function' && h.lvl < (MAX_LVL || 20)) ? xpNext(h.lvl) : 1;
  const xpPct = h.lvl >= (MAX_LVL || 20) ? 100 : Math.max(0, Math.min(100, Math.round(100 * h.xp / Math.max(1, xpNeed))));
  const hpPct = Math.max(0, Math.min(100, Math.round(100 * Math.max(0, h.hp) / Math.max(1, h.maxHp))));
  const dead = h.state === 'dead';
  return `<div class="rhud-bars" aria-label="Уровень ${h.lvl}, HP ${h.hp}/${h.maxHp}">
    <div class="rhud-lvl"><b>Ур. ${h.lvl}</b></div>
    <div class="rhud-bar rhud-hp ${dead ? 'dead' : hpPct < 25 ? 'low' : ''}" title="HP ${h.hp}/${h.maxHp}">
      <i style="width:${dead ? 100 : hpPct}%"></i>
      <span>❤ ${dead ? 'мёртв' : `${Math.max(0, h.hp)}/${h.maxHp}`}</span>
    </div>
    <div class="rhud-bar rhud-xp" title="Опыт ${h.xp}/${xpNeed}">
      <i style="width:${xpPct}%"></i>
      <span>⭐ ${h.lvl >= (MAX_LVL || 20) ? 'макс' : `${h.xp}/${xpNeed}`}</span>
    </div>
  </div>`;
}

function rhudDockHTML(h) {
  h = h || S.hero;
  const slots = RHUD_DOCK_SLOTS.map(k => {
    const it = h.eq && h.eq[k];
    if (it) {
      const ic = (typeof itemIc === 'function') ? itemIc(it) : (SLOT_IC[k] || '•');
      const col = (RARITY && RARITY[it.rar]) ? RARITY[it.rar].c : '#8a9';
      return `<button type="button" class="rhud-slot r${it.rar || 0}" data-act="itemD" data-arg="eq:${k}"
        style="--rcol:${col}" title="${esc(SLOT_RU[k] + ': ' + it.n)}" aria-label="${esc(SLOT_RU[k] + ': ' + it.n)}">
        <span class="rhud-slot-ic">${ic}</span>${it.plus ? `<em>+${it.plus}</em>` : ''}${it.curse ? '<i class="cur">☠</i>' : ''}
      </button>`;
    }
    return `<button type="button" class="rhud-slot empty" data-act="sheet" title="${esc(SLOT_RU[k] || k)}" aria-label="${esc(SLOT_RU[k] || k)}">
      <span class="rhud-slot-ic">${SLOT_IC[k] || '·'}</span>
    </button>`;
  }).join('');
  const powers = RHUD_POWERS.map(id => {
    const P = POWERS && POWERS[id]; if (!P) return '';
    const sk = (S.god && S.god.skills && S.god.skills[id]) || 0;
    const dis = !sk || (S.god && S.god.faith < P.cost) || h.state === 'dead';
    return `<button type="button" class="rhud-pow ${dis ? 'off' : ''}" data-act="power" data-arg="${id}"
      ${dis ? 'disabled' : ''} title="${esc(P.n)} · ${P.cost} веры" aria-label="${esc(P.n)}">
      <span>${P.ic}</span>
    </button>`;
  }).join('');
  return `<div class="rhud-dock">
    <div class="rhud-eq" role="group" aria-label="Снаряжение">${slots}</div>
    <div class="rhud-pows" role="group" aria-label="Силы">${powers}</div>
  </div>`;
}

function rhudStageActors(h, mode, pose) {
  h = h || S.hero;
  const sc = rhudVis.scene;
  let usePose = pose;
  const AMBIENT = { talk:1, travel:1, quest:1, cheer:1, offline:1, event:1, rare:1, oly:1, town:1, meet:1, pray:1, divine:1, bless:1, equip:1 };
  /* interactive scenes may override; ambient never fights the stage pose */
  if (sc && sc.phase !== 'done' && !AMBIENT[sc.kind]) usePose = sc.pose || pose;
  if (mode === 'fight' && !sc) usePose = 'idle';
  const doll = visHTML(h, { size: 'md', pose: usePose, tap: false, cls: 'scn-doll rhud-doll' });
  let foe = '';
  if (mode === 'fight') {
    const F = S.fight;
    if (F && typeof visFoeSVG === 'function') {
      const enemy = (F.fighters || []).find(f => f.team === 1 && f.alive) || (F.fighters || []).find(f => f.team === 1);
      if (enemy) foe = `<div class="rhud-foe" data-fid="${esc(enemy.id || '')}">${visFoeSVG(enemy, { size: 'md' })}</div>`;
      else if (h.monster) foe = `<div class="rhud-foe"><div class="vfoe" aria-hidden="true">🐺</div></div>`;
    } else if (h.monster) {
      foe = `<div class="rhud-foe"><div class="vfoe" aria-hidden="true">🐺</div></div>`;
    }
  }
  const floats = rhudVis.floats.slice(-6).map(f =>
    `<span class="rhud-ftx ${esc(f.cls)}" data-side="${f.side}" style="--d:${f.delay || 0}ms">${esc(f.txt)}</span>`
  ).join('');
  const slash = rhudVis.slash ? `<span class="rhud-slash" aria-hidden="true"></span>` : '';
  const hx = rhudVis.heroX || 18;
  return `<div class="rhud-actors">
    <div class="rhud-hero ${sc && sc.phase === 'act' ? 'rhud-hero-act' : ''}" style="--hx:${hx}%">${doll}</div>
    ${foe}
    <div class="rhud-floats" aria-hidden="true">${floats}${slash}</div>
    <div class="rhud-live">${rhudSceneOverlayHTML()}${rhudWorldHTML()}</div>
  </div>`;
}

function rhudMiniMap(h) {
  if (typeof amapHTML !== 'function') return '';
  return `<div class="rhud-mini" aria-hidden="true">${amapHTML(h, { fightPose: 'walk' })}</div>`;
}

function rhudStageHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  const biome = opt.biome || scnBiome(h);
  const tod = opt.tod || scnTod();
  const mode = opt.mode || scnMode(h);
  const label = opt.label || scnLabel(h);
  const sc = rhudVis.scene;
  const AMBIENT = { talk:1, travel:1, quest:1, cheer:1, offline:1, event:1, rare:1, oly:1, town:1, meet:1, pray:1, divine:1, bless:1, equip:1 };
  const sceneBlocksWalk = sc && sc.phase !== 'done' && !AMBIENT[sc.kind] && sc.pose !== 'walk';
  const walk = mode === 'walk' && !sceneBlocksWalk;
  const pose = sceneBlocksWalk ? (sc.pose || 'idle')
    : walk ? 'walk' : mode === 'dead' ? 'dead' : 'idle';
  const xfade = (rhudVis.biome && rhudVis.biome !== biome);
  const beat = typeof scnJourneyBeat === 'function' ? scnJourneyBeat(h, biome, mode) : '';
  rhudVis.biome = biome;
  const sceneCls = sc ? ` rhud-has-scene rhud-sc-${sc.kind}` : '';
  const cls = `rhud-stage scn scn-${biome} scn-${tod}${walk ? ' scn-walk' : ''}${mode === 'fight' ? ' scn-fight rhud-fight' : ''}${xfade ? ' scn-xfade' : ''}${beat ? ' scn-beat-' + beat : ''}${sceneCls}`;
  return `<div class="${cls}" data-biome="${biome}" data-tod="${tod}" data-mode="${mode}" data-scene="${sc ? sc.kind : ''}" role="img" aria-label="${esc(label)}">
    <div class="scn-bg">
      <div class="scn-svg-fallback">${scnSkySVG(biome, tod)}${scnFarSVG(biome)}${scnMidSVG(biome)}${scnGroundSVG(biome)}</div>
      ${scnPlateHTML(biome)}
      ${walk ? scnDustHTML() : ''}
    </div>
    <div class="rhud-stage-inner">
      ${rhudStageActors(h, mode, pose)}
    </div>
    <div class="scn-label"><span class="scn-ic">${(REG_BY[h.reg] && REG_BY[h.reg].ic) || '📍'}</span> ${esc(label)}</div>
    ${xfade ? `<div class="scn-transit" aria-hidden="true"><span>${esc(SCN_RU[biome] || label)}</span></div>` : ''}
    ${beat ? `<div class="scn-beat" aria-hidden="true">${beat === 'arrive' ? '🏘' : beat === 'enter' ? '🕳' : beat === 'camp' ? '🔥' : beat === 'leave' ? '🛣' : '✨'}</div>` : ''}
    ${rhudMiniMap(h)}
  </div>`;
}

function rhudHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  rhudSeedFeed();
  const now = rhudNow();
  rhudVis.floats = rhudVis.floats.filter(f => now - f.t0 < 1400);
  if (rhudVis.scene && now - rhudVis.scene.t0 > rhudVis.scene.dur + 500) {
    rhudVis.scene = null;
    rhudVis.pausedWalk = false;
  }
  return `<div class="rhud" data-mode="${scnMode(h)}" data-biome="${scnBiome(h)}"${rhudVis.scene ? ` data-scene="${rhudVis.scene.kind}"` : ''}>
    ${rhudBarsHTML(h)}
    <div class="rhud-body">
      ${rhudStageHTML(h, opt)}
      <aside class="rhud-feed" aria-label="Лента приключений">
        <div class="rhud-feed-hd">⚔ История</div>
        <ul class="rhud-feed-list">${rhudFeedListHTML()}</ul>
      </aside>
    </div>
    ${rhudDockHTML(h)}
  </div>`;
}

function rhudFightFx(F) {
  if (!F || !F.fx) return;
  if (rhudVis.lastFightId !== F.id) { rhudVis.lastFightId = F.id; rhudVis.lastFxN = F.fx.n || 0; return; }
  if (F.fx.n === rhudVis.lastFxN) return;
  rhudVis.lastFxN = F.fx.n;
  const me = typeof fMe === 'function' ? fMe(F) : null;
  const now = rhudNow();
  let delay = 0;
  let dealt = false, meHit = false, blk = false;
  for (const a of (F.fx.a || []).slice(0, 6)) {
    const txt = a.k === 'crit' ? `Крит! −${a.v}` : a.k === 'blk' ? 'Блок' : a.k === 'dodge' ? 'Уворот' : a.k === 'heal' ? 'Лечение' : `−${a.v}`;
    const cls = a.k === 'crit' ? 'crit' : a.k === 'blk' ? 'blk' : a.k === 'dodge' ? 'dodge' : a.k === 'heal' ? 'heal' : 'hit';
    const side = (me && a.id === me.id) ? 'hero' : 'foe';
    rhudVis.floats.push({ id: ++rhudVis.floatSeq, txt, cls, side, t0: now, delay });
    delay += 180;
    if (me && a.id === me.id && a.v > 0) meHit = true;
    if (me && a.id !== me.id && a.v > 0) dealt = true;
    if (a.k === 'blk' || a.k === 'dodge') blk = true;
  }
  const box = document.querySelector('#colHero .rhud-floats');
  if (box) {
    const slash = dealt ? `<span class="rhud-slash" aria-hidden="true"></span>` : '';
    box.innerHTML = rhudVis.floats.slice(-6).map(f =>
      `<span class="rhud-ftx ${esc(f.cls)}" data-side="${f.side}" style="--d:${f.delay || 0}ms">${esc(f.txt)}</span>`
    ).join('') + slash;
  }
  if (dealt) {
    rhudVis.slash = { t0: now };
    const foe = document.querySelector('#colHero .rhud-foe');
    if (foe) {
      foe.classList.remove('rhud-flinch');
      void foe.offsetWidth;
      foe.classList.add('rhud-flinch');
      setTimeout(() => foe.classList.remove('rhud-flinch'), 420);
    }
    setTimeout(() => { rhudVis.slash = null; }, 450);
  }
  if (typeof visSetPoseOn === 'function') {
    const pose = meHit ? 'hurt' : dealt ? 'attack' : blk ? 'block' : 'idle';
    document.querySelectorAll('#colHero .rhud-hero .vwrap, #colHero .rhud-doll').forEach(el => visSetPoseOn(el, pose));
  }
}

function rhudAfterRender() {
  const root = document.querySelector('#colHero .rhud');
  if (!root) return;
  if (document.body.classList.contains('rm') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    root.classList.add('rhud-rm');
  }
  if (rhudVis.scene) rhudClearSceneDomSoft();
}

/* test/helper: force a scene (used by targeted22) */
function rhudForceScene(kind, opts) {
  rhudVis.sceneQ = [];
  rhudVis.scene = null;
  return rhudStartScene(kind, opts || { interact: true });
}

/* =====================================================================
   5е) Runner HUD — тёмная Dota/Desk-Rival плашка приключения на «Герой».
   Боковой раннер (parallax) + лента истории + бой в полосе + XP/HP/слоты.
   Логика amap/oly/fight не ломается; top-down карта — мини-карта в углу.
   ===================================================================== */
const RHUD_FEED_MAX = 6;
const RHUD_DOCK_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'amulet'];
const RHUD_POWERS = ['heal', 'bless', 'shield', 'bolt'];

let rhudVis = {
  feed: [],          /* {i, tm, x, c, ic, t0} */
  floats: [],        /* {id, txt, cls, side, t0} */
  floatSeq: 0,
  lastFightId: null,
  lastFxN: 0,
  biome: null,
  suppress: false
};

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
    t0: (typeof performance !== 'undefined' ? performance.now() : Date.now())
  };
  rhudVis.feed = [line].concat(rhudVis.feed.filter(f => f.i !== line.i)).slice(0, RHUD_FEED_MAX);
}

function rhudOnDiary(e) {
  try {
    if (rhudVis.suppress) return;
    if (typeof SILENT !== 'undefined' && SILENT) return;
    rhudPushFeed(e);
    /* soft-live update if HUD already in DOM */
    const box = document.querySelector('#colHero .rhud-feed-list');
    if (box) {
      const html = rhudFeedListHTML();
      box.innerHTML = html;
      const first = box.firstElementChild;
      if (first) { first.classList.add('rhud-feed-new'); }
    }
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
  const doll = visHTML(h, { size: 'md', pose, tap: false, cls: 'scn-doll rhud-doll' });
  let foe = '';
  if (mode === 'fight') {
    const F = S.fight;
    if (F && typeof visPairHTML === 'function') {
      /* compact pair: hero already shown — only foe portrait */
      const enemy = (F.fighters || []).find(f => f.team === 1 && f.alive) || (F.fighters || []).find(f => f.team === 1);
      if (enemy && typeof visFoeSVG === 'function') {
        foe = `<div class="rhud-foe" data-fid="${esc(enemy.id || '')}">${visFoeSVG(enemy, { size: 'md' })}</div>`;
      } else if (h.monster) {
        foe = `<div class="rhud-foe"><div class="vfoe painted" data-pose="idle"><span class="foe-fallback">🐺</span></div></div>`;
      }
    } else if (h.monster) {
      foe = `<div class="rhud-foe"><div class="vfoe" aria-hidden="true">🐺</div></div>`;
    }
  }
  const floats = rhudVis.floats.slice(-6).map(f =>
    `<span class="rhud-ftx ${esc(f.cls)}" data-side="${f.side}" style="--d:${f.delay || 0}ms">${esc(f.txt)}</span>`
  ).join('');
  return `<div class="rhud-actors">
    <div class="rhud-hero">${doll}</div>
    ${foe}
    <div class="rhud-floats" aria-hidden="true">${floats}</div>
  </div>`;
}

function rhudMiniMap(h) {
  /* keep top-down world for travel continuity + targeted regression; compact corner */
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
  const walk = mode === 'walk';
  const pose = walk ? 'walk' : mode === 'dead' ? 'dead' : mode === 'fight' ? 'idle' : 'idle';
  const xfade = (rhudVis.biome && rhudVis.biome !== biome);
  const beat = typeof scnJourneyBeat === 'function' ? scnJourneyBeat(h, biome, mode) : '';
  rhudVis.biome = biome;
  const cls = `rhud-stage scn scn-${biome} scn-${tod}${walk ? ' scn-walk' : ''}${mode === 'fight' ? ' scn-fight rhud-fight' : ''}${xfade ? ' scn-xfade' : ''}${beat ? ' scn-beat-' + beat : ''} scn-amap`;
  return `<div class="${cls}" data-biome="${biome}" data-tod="${tod}" data-mode="${mode}" role="img" aria-label="${esc(label)}">
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
  /* prune expired floats */
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  rhudVis.floats = rhudVis.floats.filter(f => now - f.t0 < 1400);
  return `<div class="rhud" data-mode="${scnMode(h)}" data-biome="${scnBiome(h)}">
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

/* Fight damage floats inside the strip (also keeps global fightFx) */
function rhudFightFx(F) {
  if (!F || !F.fx) return;
  if (rhudVis.lastFightId !== F.id) { rhudVis.lastFightId = F.id; rhudVis.lastFxN = F.fx.n || 0; return; }
  if (F.fx.n === rhudVis.lastFxN) return;
  rhudVis.lastFxN = F.fx.n;
  const me = typeof fMe === 'function' ? fMe(F) : null;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let delay = 0;
  for (const a of (F.fx.a || []).slice(0, 6)) {
    const txt = a.k === 'crit' ? `Крит! −${a.v}` : a.k === 'blk' ? 'Блок' : a.k === 'dodge' ? 'Уворот' : a.k === 'heal' ? 'Лечение' : `−${a.v}`;
    const cls = a.k === 'crit' ? 'crit' : a.k === 'blk' ? 'blk' : a.k === 'dodge' ? 'dodge' : a.k === 'heal' ? 'heal' : 'hit';
    const side = (me && a.id === me.id) ? 'hero' : 'foe';
    rhudVis.floats.push({ id: ++rhudVis.floatSeq, txt, cls, side, t0: now, delay });
    delay += 180;
  }
  /* live paint floats without full re-render if possible */
  const box = document.querySelector('#colHero .rhud-floats');
  if (box) {
    box.innerHTML = rhudVis.floats.slice(-6).map(f =>
      `<span class="rhud-ftx ${esc(f.cls)}" data-side="${f.side}" style="--d:${f.delay || 0}ms">${esc(f.txt)}</span>`
    ).join('');
  }
  /* pose on strip doll */
  if (typeof visSetPoseOn === 'function') {
    const meHit = (F.fx.a || []).some(a => me && a.id === me.id && a.v > 0);
    const dealt = (F.fx.a || []).some(a => me && a.id !== me.id && a.v > 0);
    const blk = (F.fx.a || []).some(a => a.k === 'blk' || a.k === 'dodge');
    const pose = meHit ? 'hurt' : dealt ? 'attack' : blk ? 'block' : 'idle';
    document.querySelectorAll('#colHero .rhud-hero .vwrap, #colHero .rhud-doll').forEach(el => visSetPoseOn(el, pose));
  }
}

function rhudAfterRender() {
  /* diary FX still paint on minimap via amapAfterRender; strip gets feed from rhudVis */
  const root = document.querySelector('#colHero .rhud');
  if (!root) return;
  if (document.body.classList.contains('rm') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    root.classList.add('rhud-rm');
  }
}

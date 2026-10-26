/* =====================================================================
   5д) Карта приключений (Deskrawl-style): герой идёт по 2D-карте регионов
   Визуал гоняется от S.hero.reg / oly.dest / fight / dun — без переписки сима.
   ===================================================================== */
const AMAP_PAD = 48;
const AMAP_VB = (() => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const R0 of REGIONS) {
    const x = R0.x + 27, y = R0.y + 18;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x: x0 - AMAP_PAD, y: y0 - AMAP_PAD, w: (x1 - x0) + AMAP_PAD * 2, h: (y1 - y0) + AMAP_PAD * 2 };
})();

const AMAP_BIOME_FILL = {
  forest: '#2e6a38', swamp: '#2a4838', mount: '#5a6070', valley: '#4a8a48',
  field: '#6aaa40', city: '#6a5a50', village: '#7a6a55', castle: '#4a4858',
  coast: '#c8b078', waste: '#8a7060', ravine: '#3a3848', dungeon: '#221830',
  arena: '#8a6a48', camp: '#3a4a30'
};

/* Soft visual state (not saved) */
let amapVis = {
  x: 0, y: 0, facing: 1, from: null, to: null, t0: 0, dur: 5000,
  mode: 'idle', edgeKey: '', snap: true, raf: 0, lastReg: null, lastFight: false
};

function amapNodeXY(id) {
  const R0 = REG_BY[id];
  if (!R0) return { x: AMAP_VB.x + AMAP_VB.w / 2, y: AMAP_VB.y + AMAP_VB.h / 2 };
  return { x: R0.x + 27, y: R0.y + 18 };
}

function amapRm() {
  return !!(typeof document !== 'undefined' && document.body && document.body.classList.contains('rm'))
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function amapWalkDur() {
  const sp = (S && S.speed) || 1;
  return Math.max(900, 7000 / Math.max(1, sp));
}

function amapEdgeProgress() {
  /* 0..1 along current edge; offline/snap → 1 (at node) */
  if (amapVis.snap || amapRm()) return 1;
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - amapVis.t0;
  return Math.max(0, Math.min(1, elapsed / Math.max(1, amapVis.dur)));
}

function amapLerp(a, b, t) { return a + (b - a) * t; }

function amapSetEdge(from, to, restart) {
  const key = from + '>' + to;
  if (!restart && amapVis.edgeKey === key && amapVis.from === from) return;
  amapVis.from = from;
  amapVis.to = to;
  amapVis.edgeKey = key;
  amapVis.t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  amapVis.dur = amapWalkDur();
  amapVis.snap = false;
  const A = amapNodeXY(from), B = amapNodeXY(to);
  amapVis.facing = B.x >= A.x ? 1 : -1;
}

function amapSyncLogic(h) {
  h = h || (S && S.hero);
  if (!h || !REG_BY[h.reg]) return;
  const fight = !!(S && S.fight);
  const dun = !!(S && S.dun) || h.state === 'dungeon';
  const dest = (S && S.oly && S.oly.dest) || null;

  /* Region changed (arrived) → snap to node, then maybe start next edge */
  if (amapVis.lastReg && amapVis.lastReg !== h.reg) {
    const p = amapNodeXY(h.reg);
    amapVis.x = p.x; amapVis.y = p.y;
    amapVis.edgeKey = '';
    amapVis.snap = true;
  }
  amapVis.lastReg = h.reg;

  if (fight) {
    amapVis.mode = 'fight';
    /* freeze: keep x,y; if first frame of fight and no pos yet, use node */
    if (!amapVis.lastFight) {
      if (!amapVis.x && !amapVis.y) {
        const p = amapNodeXY(h.reg);
        amapVis.x = p.x; amapVis.y = p.y;
      }
      /* slight offset so fight reads as «на дороге» */
      amapVis.fightAt = { x: amapVis.x, y: amapVis.y };
    }
    amapVis.lastFight = true;
    return;
  }

  /* Fight just ended → resume from freeze point */
  if (amapVis.lastFight && !fight) {
    amapVis.lastFight = false;
    amapVis.edgeKey = '';
  }

  if (dun) {
    amapVis.mode = 'dungeon';
    const base = amapNodeXY(h.reg);
    /* dungeon rooms as local offset path driven by dungeon progress */
    const room = (S.dun && (S.dun.room || S.dun.step || 0)) || 0;
    const n = Math.max(3, (S.dun && S.dun.rooms) || 4);
    const t = Math.min(1, (room % n) / Math.max(1, n - 1));
    amapVis.x = base.x + (t - .5) * 70;
    amapVis.y = base.y + 28 + Math.sin(t * Math.PI) * 18;
    amapVis.facing = 1;
    amapVis.snap = true;
    return;
  }

  if (h.state === 'road') {
    amapVis.mode = 'walk';
    let next = null;
    if (dest && dest !== h.reg) {
      const path = typeof regPath === 'function' ? regPath(h.reg, dest) : null;
      next = (path && path[0]) || dest;
    } else {
      /* idle wander toward a stable neighbor (hash by clock minute) */
      const nbs = REG_BY[h.reg].nb || [];
      if (nbs.length) {
        const tick = Math.floor(((typeof momClock === 'number' ? momClock : Date.now() / 1000)) / 45);
        next = nbs[tick % nbs.length];
      }
    }
    if (next && REG_BY[next]) {
      amapSetEdge(h.reg, next, false);
      const A = amapNodeXY(h.reg), B = amapNodeXY(next);
      const t = amapEdgeProgress();
      amapVis.x = amapLerp(A.x, B.x, t);
      amapVis.y = amapLerp(A.y, B.y, t);
      amapVis.facing = B.x >= A.x ? 1 : -1;
      /* when edge completes visually and no dest change, loop reverse wander */
      if (t >= 1 && !dest) {
        amapSetEdge(next, h.reg, true);
      }
    } else {
      const p = amapNodeXY(h.reg);
      amapVis.x = p.x; amapVis.y = p.y;
    }
    return;
  }

  /* town / rest / dead / idle — stand on node */
  amapVis.mode = h.state === 'dead' ? 'dead' : (h.state === 'rest' ? 'rest' : 'idle');
  const p = amapNodeXY(h.reg);
  if (amapRm() || amapVis.snap || !amapVis.x) {
    amapVis.x = p.x; amapVis.y = p.y;
  } else {
    /* ease toward node */
    amapVis.x = amapLerp(amapVis.x, p.x, .35);
    amapVis.y = amapLerp(amapVis.y, p.y, .35);
  }
  amapVis.snap = true;
  amapVis.edgeKey = '';
}

function amapCamTransform() {
  const vb = AMAP_VB;
  /* camera centers on hero; CSS % based on viewBox */
  const cx = amapVis.x, cy = amapVis.y;
  const px = ((cx - vb.x) / vb.w) * 100;
  const py = ((cy - vb.y) / vb.h) * 100;
  return { px, py, cx, cy };
}

function amapPathsSVG() {
  const seen = new Set();
  let d = '';
  for (const A of REGIONS) {
    for (const nid of A.nb) {
      const key = A.id < nid ? A.id + '|' + nid : nid + '|' + A.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const B = REG_BY[nid], P = amapNodeXY(A.id), Q = amapNodeXY(nid);
      const active = (amapVis.from === A.id && amapVis.to === nid) || (amapVis.from === nid && amapVis.to === A.id);
      d += `<line class="amap-path${active ? ' on' : ''}" x1="${P.x.toFixed(1)}" y1="${P.y.toFixed(1)}" x2="${Q.x.toFixed(1)}" y2="${Q.y.toFixed(1)}"/>`;
    }
  }
  return d;
}

function amapNodesSVG(h) {
  const here = h && h.reg;
  const dest = S && S.oly && S.oly.dest;
  return REGIONS.map(R0 => {
    const p = amapNodeXY(R0.id);
    const fill = AMAP_BIOME_FILL[R0.k] || '#4a6840';
    const on = R0.id === here ? ' here' : '';
    const goal = R0.id === dest ? ' goal' : '';
    const town = R0.town ? ' town' : '';
    return `<g class="amap-node${on}${goal}${town}" data-reg="${R0.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
      <circle class="amap-blob" r="22" fill="${fill}" opacity=".55"/>
      <circle class="amap-ring" r="14" fill="${fill}" stroke="#fff8" stroke-width="1.5"/>
      <text class="amap-ic" text-anchor="middle" dominant-baseline="central" font-size="13">${R0.ic}</text>
      <text class="amap-name" text-anchor="middle" y="26" font-size="7.5">${esc(R0.s)}</text>
    </g>`;
  }).join('');
}

function amapDungeonOverlay(h) {
  if (!(S && S.dun) && !(h && h.state === 'dungeon')) return '';
  const base = amapNodeXY(h.reg);
  const n = Math.max(3, (S.dun && S.dun.rooms) || 4);
  const room = (S.dun && (S.dun.room || S.dun.step || 0)) || 0;
  let g = `<g class="amap-dun" transform="translate(${base.x},${base.y + 28})">`;
  g += `<rect x="-40" y="-8" width="80" height="40" rx="6" fill="#1a1428" opacity=".75" stroke="#c8a04055" stroke-width="1"/>`;
  for (let i = 0; i < n; i++) {
    const x = -28 + i * (56 / Math.max(1, n - 1));
    const on = (i === (room % n)) ? ' on' : '';
    g += `<circle class="amap-dun-room${on}" cx="${x}" cy="12" r="5"/>`;
    if (i < n - 1) g += `<line x1="${x}" y1="12" x2="${x + 56 / Math.max(1, n - 1)}" y2="12" stroke="#c8a04055" stroke-width="1.5"/>`;
  }
  g += `<text x="0" y="-1" text-anchor="middle" font-size="7" fill="#e8c060">🕳 пещера</text></g>`;
  return g;
}

function amapFoeKey() {
  if (!S || !S.fight) return null;
  const F = S.fight;
  let foe = null;
  if (F.fighters) foe = F.fighters.find(f => f.team === 1) || F.fighters[1];
  if (!foe && S.hero && S.hero.monster) foe = { n: S.hero.monster.n, name: S.hero.monster.n };
  return foe;
}

function amapHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  amapSyncLogic(h);
  const vb = AMAP_VB;
  const cam = amapCamTransform();
  const mode = amapVis.mode;
  const walk = mode === 'walk';
  const pose = mode === 'fight' ? (opt.fightPose || 'idle') : walk ? 'walk' : mode === 'dead' ? 'dead' : 'idle';
  const doll = visHTML(h, { size: 'sm', pose, tap: false, cls: 'amap-doll' });
  const foe = mode === 'fight' ? amapFoeKey() : null;
  const foeHTML = foe ? visFoeSVG(foe, { size: 'sm' }) : '';
  const pctX = ((amapVis.x - vb.x) / vb.w) * 100;
  const pctY = ((amapVis.y - vb.y) / vb.h) * 100;
  const foeX = pctX + (amapVis.facing > 0 ? 7 : -7);
  const foeY = pctY - 1;
  const rm = amapRm() ? ' amap-rm' : '';

  return `<div class="amap${walk ? ' amap-walk' : ''}${mode === 'fight' ? ' amap-fight' : ''}${mode === 'dungeon' ? ' amap-dungeon' : ''}${rm}"
    data-mode="${mode}" data-reg="${h.reg || ''}" data-facing="${amapVis.facing}"
    style="--amap-hx:${pctX.toFixed(2)}%;--amap-hy:${pctY.toFixed(2)}%;--amap-cam-x:${(50 - pctX).toFixed(2)}%;--amap-cam-y:${(52 - pctY).toFixed(2)}%;--amap-face:${amapVis.facing}">
    <div class="amap-cam">
      <svg class="amap-svg" viewBox="${vb.x.toFixed(0)} ${vb.y.toFixed(0)} ${vb.w.toFixed(0)} ${vb.h.toFixed(0)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <radialGradient id="amapGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe08a44"/><stop offset="100%" stop-color="#0000"/></radialGradient>
          <filter id="amapSoft"><feGaussianBlur stdDeviation="1.2"/></filter>
        </defs>
        <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" class="amap-ground" fill="#1e2830"/>
        ${amapPathsSVG()}
        ${amapNodesSVG(h)}
        ${amapDungeonOverlay(h)}
        ${mode === 'fight' ? `<circle class="amap-enc" cx="${amapVis.x}" cy="${amapVis.y}" r="28" fill="url(#amapGlow)"/>` : ''}
      </svg>
      <div class="amap-actors" aria-hidden="true">
        <div class="amap-hero" style="left:${pctX.toFixed(2)}%;top:${pctY.toFixed(2)}%">
          <div class="amap-hero-inner">${doll}</div>
        </div>
        ${foeHTML ? `<div class="amap-foe" style="left:${foeX.toFixed(2)}%;top:${foeY.toFixed(2)}%">${foeHTML}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function amapApplyDomPose(pose) {
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  const wrap = root.querySelector('.amap-hero .vwrap');
  if (wrap && typeof visSetPoseOn === 'function') visSetPoseOn(wrap, pose);
}

function amapTick() {
  if (!S || !S.hero) return;
  if (S.fight) return; /* freeze during fight */
  if (amapRm()) return;
  if (S.hero.state !== 'road') return;
  amapSyncLogic(S.hero);
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  const vb = AMAP_VB;
  const pctX = ((amapVis.x - vb.x) / vb.w) * 100;
  const pctY = ((amapVis.y - vb.y) / vb.h) * 100;
  root.style.setProperty('--amap-hx', pctX.toFixed(2) + '%');
  root.style.setProperty('--amap-hy', pctY.toFixed(2) + '%');
  root.style.setProperty('--amap-cam-x', (50 - pctX).toFixed(2) + '%');
  root.style.setProperty('--amap-cam-y', (52 - pctY).toFixed(2) + '%');
  root.style.setProperty('--amap-face', String(amapVis.facing));
  root.dataset.facing = String(amapVis.facing);
  const hero = root.querySelector('.amap-hero');
  if (hero) { hero.style.left = pctX.toFixed(2) + '%'; hero.style.top = pctY.toFixed(2) + '%'; }
  /* highlight active path */
  root.querySelectorAll('.amap-path.on').forEach(el => el.classList.remove('on'));
  if (amapVis.from && amapVis.to) {
    /* rebuild is heavy — toggle via data on root */
    root.dataset.edge = amapVis.from + '>' + amapVis.to;
  }
}

function amapStartLoop() {
  if (amapVis.raf) return;
  const loop = () => {
    amapVis.raf = 0;
    try { amapTick(); } catch (e) {}
    if (S && S.hero && S.hero.state === 'road' && !S.fight && !amapRm()) {
      amapVis.raf = requestAnimationFrame(loop);
    }
  };
  amapVis.raf = requestAnimationFrame(loop);
}

function amapAfterRender() {
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  if (typeof visPaintCheck === 'function') visPaintCheck(root);
  if (S && S.fight && typeof visApplyFightPose === 'function') {
    const pose = visApplyFightPose(S.fight);
    if (pose) amapApplyDomPose(pose);
  }
  if (S && S.hero && S.hero.state === 'road' && !S.fight && !amapRm()) amapStartLoop();
}

/* Hook fight poses onto map hero too */
const _amapPrevFightPose = typeof visApplyFightPose === 'function' ? visApplyFightPose : null;
if (_amapPrevFightPose) {
  /* wrapped after both defined — see amapWireFight at end of file load via part4c */
}
function amapWireFight() {
  if (typeof visApplyFightPose !== 'function') return;
  const orig = visApplyFightPose;
  if (orig._amap) return;
  function wrapped(F, forcePose) {
    const pose = orig(F, forcePose);
    try { amapApplyDomPose(forcePose || pose || 'idle'); } catch (e) {}
    return pose;
  }
  wrapped._amap = 1;
  visApplyFightPose = wrapped;
  if (typeof window !== 'undefined' && window.GAME) window.GAME.visApplyFightPose = wrapped;
}

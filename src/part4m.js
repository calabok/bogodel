/* =====================================================================
   5д) Карта-мир (Deskrawl): непрерывный 2D-террейн, герой идёт по местности.
   Логика регионов/dest/fight/dun — та же; визуал — свободное движение по миру.
   ===================================================================== */
const WMAP_SCALE = 3.35;
const WMAP_PAD = 140;
const WMAP_TILE = {
  forest: 'world_forest', swamp: 'world_swamp', mount: 'world_mount', valley: 'world_grass',
  field: 'world_grass', city: 'world_city', village: 'world_city', castle: 'world_city',
  coast: 'world_coast', waste: 'world_waste', ravine: 'world_mount', dungeon: 'world_dungeon',
  arena: 'world_dirt', camp: 'world_grass'
};
const WMAP_TINT = {
  forest: '#1a4a28', swamp: '#1a3830', mount: '#3a4050', valley: '#2a6030',
  field: '#3a7028', city: '#4a4038', village: '#4a4030', castle: '#383848',
  coast: '#2a6070', waste: '#6a5038', ravine: '#2a2838', dungeon: '#181028',
  arena: '#5a4830', camp: '#2a4028'
};

const AMAP_VB = (() => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const R0 of REGIONS) {
    const x = (R0.x + 27) * WMAP_SCALE, y = (R0.y + 18) * WMAP_SCALE;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x: x0 - WMAP_PAD, y: y0 - WMAP_PAD, w: (x1 - x0) + WMAP_PAD * 2, h: (y1 - y0) + WMAP_PAD * 2 };
})();

let amapVis = {
  x: 0, y: 0, facing: 1, from: null, to: null, t0: 0, dur: 5000,
  mode: 'idle', edgeKey: '', snap: true, raf: 0, lastReg: null, lastFight: false,
  path: null, pathLen: 0, biome: 'field', fightAt: null,
  /* journey continuity */
  holdHop: false, journeyId: 0,
  /* diary → map FX */
  fxQ: [], fxLive: null, fxSeq: 0, lastDiaryI: 0, fxSuppress: false
};

function amapNodeXY(id) {
  const R0 = REG_BY[id];
  if (!R0) return { x: AMAP_VB.x + AMAP_VB.w / 2, y: AMAP_VB.y + AMAP_VB.h / 2 };
  return { x: (R0.x + 27) * WMAP_SCALE, y: (R0.y + 18) * WMAP_SCALE };
}

function amapRm() {
  return !!(typeof document !== 'undefined' && document.body && document.body.classList.contains('rm'))
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function amapWalkDur() {
  const sp = (S && S.speed) || 1;
  return Math.max(700, 8200 / Math.max(1, sp));
}

function amapLerp(a, b, t) { return a + (b - a) * t; }

function amapHash(a, b) {
  let h = 0;
  const s = String(a) + '>' + String(b);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h % 1000) / 1000;
}

/* Curved dirt-road polyline between two region centers (world px) */
function amapBuildRoad(from, to) {
  const A = amapNodeXY(from), B = amapNodeXY(to);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bend = (amapHash(from, to) - .5) * Math.min(90, len * .28);
  const C = { x: (A.x + B.x) / 2 + nx * bend, y: (A.y + B.y) / 2 + ny * bend };
  const pts = [];
  const N = Math.max(12, Math.round(len / 18));
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    pts.push({
      x: u * u * A.x + 2 * u * t * C.x + t * t * B.x,
      y: u * u * A.y + 2 * u * t * C.y + t * t * B.y
    });
  }
  let plen = 0;
  const seg = [0];
  for (let i = 1; i < pts.length; i++) {
    plen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(plen);
  }
  return { pts, plen: plen || 1, seg, from, to, C };
}

function amapPointOnRoad(road, t) {
  t = Math.max(0, Math.min(1, t));
  const dist = t * road.plen;
  const seg = road.seg, pts = road.pts;
  let i = 1;
  while (i < seg.length && seg[i] < dist) i++;
  const i0 = Math.max(1, i) - 1, i1 = Math.min(pts.length - 1, i0 + 1);
  const d0 = seg[i0], d1 = seg[i1] || (d0 + 1);
  const u = (dist - d0) / Math.max(1e-3, d1 - d0);
  const x = amapLerp(pts[i0].x, pts[i1].x, u);
  const y = amapLerp(pts[i0].y, pts[i1].y, u);
  const facing = (pts[i1].x - pts[i0].x) >= 0 ? 1 : -1;
  return { x, y, facing };
}

function amapNearestRoadT(road, x, y) {
  if (!road || !road.pts || !road.pts.length) return 0;
  let best = 0, bd = 1e15;
  for (let i = 0; i < road.pts.length; i++) {
    const p = road.pts[i];
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bd) { bd = d; best = i; }
  }
  return road.seg[best] / Math.max(1e-3, road.plen);
}
function amapSetEdge(from, to, restart) {
  const key = from + '>' + to;
  if (!restart && amapVis.edgeKey === key && amapVis.from === from && amapVis.path) return;
  amapVis.from = from;
  amapVis.to = to;
  amapVis.edgeKey = key;
  amapVis.dur = amapWalkDur();
  amapVis.snap = false;
  amapVis.holdHop = false;
  amapVis.path = amapBuildRoad(from, to);
  amapVis.pathLen = amapVis.path.plen;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /* Resume from current world pos if already along this road (no snap-back) */
  let t0prog = 0;
  if (!restart && amapVis.x && amapVis.y) {
    t0prog = Math.max(0, Math.min(0.92, amapNearestRoadT(amapVis.path, amapVis.x, amapVis.y)));
  }
  amapVis.t0 = now - t0prog * amapVis.dur;
  const A = amapNodeXY(from), B = amapNodeXY(to);
  amapVis.facing = B.x >= A.x ? 1 : -1;
}

function amapEdgeProgress() {
  if (amapVis.snap || amapRm()) return 1;
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - amapVis.t0;
  return Math.max(0, Math.min(1, elapsed / Math.max(1, amapVis.dur)));
}

function amapNearestBiome(x, y) {
  let best = 'field', bd = 1e12;
  for (const R0 of REGIONS) {
    const p = amapNodeXY(R0.id);
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bd) { bd = d; best = R0.k || 'field'; }
  }
  return best;
}

function amapSyncLogic(h) {
  h = h || (S && S.hero);
  if (!h || !REG_BY[h.reg]) return;
  const fight = !!(S && S.fight);
  const dun = !!(S && S.dun) || h.state === 'dungeon';
  const dest = (S && S.oly && S.oly.dest) || null;

  /* Region arrived: snap forward to new node (never rewind). Clear finished edge. */
  if (amapVis.lastReg && amapVis.lastReg !== h.reg) {
    const p = amapNodeXY(h.reg);
    amapVis.x = p.x; amapVis.y = p.y;
    amapVis.edgeKey = '';
    amapVis.path = null;
    amapVis.holdHop = false;
    amapVis.snap = true;
    amapVis.journeyId++;
  }
  amapVis.lastReg = h.reg;

  if (fight) {
    amapVis.mode = 'fight';
    if (!amapVis.lastFight) {
      if (!amapVis.x && !amapVis.y) {
        const p = amapNodeXY(h.reg);
        amapVis.x = p.x; amapVis.y = p.y;
      }
      amapVis.fightAt = { x: amapVis.x, y: amapVis.y };
    }
    amapVis.lastFight = true;
    amapVis.biome = amapNearestBiome(amapVis.x, amapVis.y);
    return;
  }

  if (amapVis.lastFight && !fight) {
    amapVis.lastFight = false;
    /* resume from freeze point — do not teleport to node */
    amapVis.edgeKey = '';
    amapVis.path = null;
    amapVis.holdHop = false;
  }

  if (dun) {
    amapVis.mode = 'dungeon';
    const base = amapNodeXY(h.reg);
    const room = (S.dun && (S.dun.room || S.dun.step || 0)) || 0;
    const n = Math.max(3, (S.dun && S.dun.rooms) || 4);
    const t = Math.min(1, (room % n) / Math.max(1, n - 1));
    amapVis.x = base.x - 40 + t * 160;
    amapVis.y = base.y + 70;
    amapVis.facing = 1;
    amapVis.snap = true;
    amapVis.biome = 'dungeon';
    return;
  }

  if (h.state === 'road') {
    /* Pick next hop from sim dest only — never invent reversing wander */
    let next = null;
    if (dest && dest !== h.reg) {
      const path = typeof regPath === 'function' ? regPath(h.reg, dest) : null;
      next = (path && path[0]) || dest;
    }

    /* Sticky mid-edge: finish current hop even if dest flickers briefly */
    const mid = amapVis.path && amapVis.from === h.reg && amapVis.to && !amapVis.holdHop
      && amapEdgeProgress() < 1;
    if (mid) next = amapVis.to;

    if (next && REG_BY[next] && next !== h.reg) {
      amapSetEdge(h.reg, next, false);
      const t = amapEdgeProgress();
      const pt = amapPointOnRoad(amapVis.path, Math.min(1, t));
      amapVis.x = pt.x; amapVis.y = pt.y; amapVis.facing = pt.facing;
      if (t >= 1) {
        /* Arrived at hop end — HOLD here until sim updates h.reg. No reverse ping-pong. */
        amapVis.holdHop = true;
        amapVis.mode = 'walk';
        amapVis.snap = true;
      } else {
        amapVis.holdHop = false;
        amapVis.mode = 'walk';
      }
    } else if (amapVis.holdHop && amapVis.path && amapVis.to) {
      const pt = amapPointOnRoad(amapVis.path, 1);
      amapVis.x = pt.x; amapVis.y = pt.y;
      amapVis.mode = 'walk'; /* wait at hop — walk-in-place, no reverse */
    } else {
      /* No dest: patrol in place at region (walk pose) — never invent reverse edges */
      const p = amapNodeXY(h.reg);
      if (!amapVis.x && !amapVis.y) { amapVis.x = p.x; amapVis.y = p.y; }
      else {
        amapVis.x = amapLerp(amapVis.x, p.x, amapRm() ? 1 : .2);
        amapVis.y = amapLerp(amapVis.y, p.y, amapRm() ? 1 : .2);
      }
      amapVis.mode = 'walk';
      amapVis.edgeKey = '';
      amapVis.path = null;
      amapVis.holdHop = false;
    }
    amapVis.biome = amapNearestBiome(amapVis.x, amapVis.y);
    return;
  }

  amapVis.mode = h.state === 'dead' ? 'dead' : (h.state === 'rest' ? 'rest' : 'idle');
  const p = amapNodeXY(h.reg);
  if (amapRm() || amapVis.snap || !amapVis.x) {
    amapVis.x = p.x; amapVis.y = p.y;
  } else {
    amapVis.x = amapLerp(amapVis.x, p.x, .28);
    amapVis.y = amapLerp(amapVis.y, p.y, .28);
  }
  amapVis.snap = true;
  amapVis.edgeKey = '';
  amapVis.path = null;
  amapVis.holdHop = false;
  amapVis.biome = amapNearestBiome(amapVis.x, amapVis.y);
}

function amapCamTransform() {
  return { cx: amapVis.x, cy: amapVis.y };
}

function amapArt(key) {
  return 'art/' + key + '.webp';
}

function amapPropsFor(R0, p) {
  const seed = amapHash(R0.id, 'props');
  const items = [];
  const k = R0.k;
  const count = k === 'city' || k === 'village' || k === 'castle' ? 5 : (k === 'forest' || k === 'swamp' ? 9 : 6);
  for (let i = 0; i < count; i++) {
    const a = amapHash(R0.id, 'a' + i);
    const b = amapHash(R0.id, 'b' + i);
    const ang = a * Math.PI * 2;
    const rad = 28 + b * 78;
    const x = p.x + Math.cos(ang) * rad;
    const y = p.y + Math.sin(ang) * rad * .72;
    let ch = '🌳';
    if (k === 'forest') ch = i % 3 === 0 ? '🌲' : '🌳';
    else if (k === 'swamp') ch = i % 2 ? '🌿' : '🪨';
    else if (k === 'mount' || k === 'ravine') ch = i % 2 ? '🪨' : '⛰';
    else if (k === 'coast') ch = i % 2 ? '🐚' : '🪨';
    else if (k === 'waste') ch = '🦴';
    else if (k === 'field' || k === 'valley') ch = i % 3 ? '🌾' : '🌻';
    else if (k === 'city' || k === 'village') ch = i % 3 === 0 ? '🏠' : (i % 3 === 1 ? '🏛' : '🪵');
    else if (k === 'castle') ch = i % 2 ? '🏯' : '🧱';
    const sz = 14 + (a * 10);
    items.push(`<span class="wmap-prop" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;font-size:${sz.toFixed(0)}px;opacity:${(.55 + b * .35).toFixed(2)}">${ch}</span>`);
  }
  if (R0.town) {
    items.push(`<span class="wmap-prop wmap-townmark" style="left:${p.x.toFixed(1)}px;top:${(p.y - 8).toFixed(1)}px">🏘</span>`);
  }
  return items.join('');
}

function amapLocal(p) {
  return { x: p.x - AMAP_VB.x, y: p.y - AMAP_VB.y };
}
function amapPatchesHTML() {
  return REGIONS.map(R0 => {
    const p = amapLocal(amapNodeXY(R0.id));
    const tile = WMAP_TILE[R0.k] || 'world_grass';
    const tint = WMAP_TINT[R0.k] || '#2a5030';
    const here = (S && S.hero && S.hero.reg === R0.id) ? ' here' : '';
    const goal = (S && S.oly && S.oly.dest === R0.id) ? ' goal' : '';
    return `<div class="wmap-patch${here}${goal}${R0.town ? ' town' : ''}" data-reg="${R0.id}" data-biome="${R0.k}"
      style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--tint:${tint};background-image:url('${amapArt(tile)}')">
      <span class="wmap-label">${R0.ic} ${esc(R0.s)}</span>
    </div>`;
  }).join('');
}

function amapRoadsSVG() {
  const seen = new Set();
  const vb = AMAP_VB;
  let d = '';
  for (const A of REGIONS) {
    for (const nid of A.nb) {
      const key = A.id < nid ? A.id + '|' + nid : nid + '|' + A.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const road = amapBuildRoad(A.id, nid);
      const active = (amapVis.from === A.id && amapVis.to === nid) || (amapVis.from === nid && amapVis.to === A.id);
      const pts = road.pts.map((p, i) => {
        const L = amapLocal(p);
        return (i ? 'L' : 'M') + L.x.toFixed(1) + ' ' + L.y.toFixed(1);
      }).join(' ');
      d += `<path class="wmap-road-bed" d="${pts}" />`;
      d += `<path class="wmap-road${active ? ' on' : ''}" d="${pts}" />`;
    }
  }
  return `<svg class="wmap-roads" viewBox="0 0 ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="wmapDirt" patternUnits="userSpaceOnUse" width="64" height="64">
        <image href="${amapArt('world_dirt')}" width="64" height="64"/>
      </pattern>
    </defs>
    ${d}
  </svg>`;
}

function amapDungeonFloorHTML(h) {
  if (!(S && S.dun) && !(h && h.state === 'dungeon')) return '';
  const base = amapNodeXY(h.reg);
  const room = (S.dun && (S.dun.room || S.dun.step || 0)) || 0;
  const n = Math.max(3, (S.dun && S.dun.rooms) || 4);
  let rooms = '';
  for (let i = 0; i < n; i++) {
    const on = (i === (room % n)) ? ' on' : '';
    rooms += `<span class="amap-dun-room${on}" style="left:${(24 + i * 42)}px"></span>`;
  }
  const L = amapLocal({ x: base.x - 50, y: base.y + 28 });
  return `<div class="amap-dun wmap-dun" style="left:${L.x.toFixed(1)}px;top:${L.y.toFixed(1)}px;background-image:url('${amapArt('world_dungeon')}')">
    <div class="wmap-dun-label">🕳 пещера</div>
    <div class="wmap-dun-rooms">${rooms}</div>
  </div>`;
}

function amapFoeKey() {
  if (!S || !S.fight) return null;
  const F = S.fight;
  let foe = null;
  if (F.fighters) foe = F.fighters.find(f => f.team === 1) || F.fighters[1];
  if (!foe && S.hero && S.hero.monster) foe = { n: S.hero.monster.n, name: S.hero.monster.n };
  return foe;
}

function amapPropsHTML() {
  return REGIONS.map(R0 => amapPropsFor(R0, amapLocal(amapNodeXY(R0.id)))).join('');
}

function amapHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  amapSyncLogic(h);
  const vb = AMAP_VB;
  const mode = amapVis.mode;
  const walk = mode === 'walk';
  const pose = mode === 'fight' ? (opt.fightPose || 'idle') : walk ? 'walk' : mode === 'dead' ? 'dead' : 'idle';
  const doll = visHTML(h, { size: 'sm', pose, tap: false, cls: 'amap-doll' });
  const foe = mode === 'fight' ? amapFoeKey() : null;
  const foeHTML = foe ? visFoeSVG(foe, { size: 'sm' }) : '';
  const rm = amapRm() ? ' amap-rm' : '';
  const biome = amapVis.biome || (REG_BY[h.reg] && REG_BY[h.reg].k) || 'field';
  const hx = amapVis.x - vb.x, hy = amapVis.y - vb.y;

  /* Keep .amap-node markers (invisible) for targeted18 compatibility */
  const ghostNodes = REGIONS.map(R0 => {
    const p = amapLocal(amapNodeXY(R0.id));
    const on = R0.id === h.reg ? ' here' : '';
    return `<div class="amap-node${on}" data-reg="${R0.id}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:1px;height:1px;opacity:0"></div>`;
  }).join('');

  return `<div class="amap wmap${walk ? ' amap-walk' : ''}${mode === 'fight' ? ' amap-fight' : ''}${mode === 'dungeon' ? ' amap-dungeon' : ''}${rm}"
    data-mode="${mode}" data-reg="${h.reg || ''}" data-facing="${amapVis.facing}" data-biome="${biome}"
    style="--amap-hx:${hx.toFixed(1)}px;--amap-hy:${hy.toFixed(1)}px;--wmap-w:${vb.w}px;--wmap-h:${vb.h}px;--amap-face:${amapVis.facing}">
    <div class="wmap-cam amap-cam">
      <div class="wmap-world" style="width:${vb.w}px;height:${vb.h}px">
        <div class="wmap-base" style="background-image:url('${amapArt('world_grass')}')"></div>
        <div class="wmap-patches">${amapPatchesHTML()}</div>
        ${amapRoadsSVG()}
        <div class="wmap-props">${amapPropsHTML()}</div>
        ${amapDungeonFloorHTML(h)}
        <div class="wmap-ghost" aria-hidden="true">${ghostNodes}</div>
        <div class="amap-actors" aria-hidden="true">
          <div class="amap-hero" style="left:${hx.toFixed(1)}px;top:${hy.toFixed(1)}px">
            <div class="amap-hero-inner">${doll}</div>
          </div>
          ${foeHTML ? `<div class="amap-foe" style="left:${(hx + (amapVis.facing > 0 ? 36 : -36)).toFixed(1)}px;top:${(hy - 4).toFixed(1)}px">${foeHTML}</div>` : ''}
          ${amapFxHTML()}
        </div>
        ${mode === 'fight' ? `<div class="wmap-enc" style="left:${hx.toFixed(1)}px;top:${hy.toFixed(1)}px"></div>` : ''}
      </div>
    </div>
    <div class="wmap-fog" aria-hidden="true"></div>
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
  if (S.fight) return;
  if (amapRm()) return;
  if (S.hero.state !== 'road') return;
  amapSyncLogic(S.hero);
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  const world = root.querySelector('.wmap-world');
  const vb = AMAP_VB;
  const hx = amapVis.x - vb.x, hy = amapVis.y - vb.y;
  root.style.setProperty('--amap-hx', hx.toFixed(1) + 'px');
  root.style.setProperty('--amap-hy', hy.toFixed(1) + 'px');
  root.dataset.facing = String(amapVis.facing);
  root.dataset.biome = amapVis.biome || '';
  root.style.setProperty('--amap-face', String(amapVis.facing));
  /* camera via CSS vars --amap-hx/hy on .amap */
  const hero = root.querySelector('.amap-hero');
  if (hero) { hero.style.left = hx.toFixed(1) + 'px'; hero.style.top = hy.toFixed(1) + 'px'; }
  if (amapVis.from && amapVis.to) root.dataset.edge = amapVis.from + '>' + amapVis.to;
  /* highlight active road */
  root.querySelectorAll('.wmap-road.on').forEach(el => el.classList.remove('on'));
  /* roads rebuilt on render; tick only moves hero */
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
  if (amapVis.fxLive) amapPaintFx(amapVis.fxLive);
  else amapPumpFx();
}


/* ---------- Diary → map action visuals ---------- */
const AMAP_FX_BY_CLS = {
  fight: { icon: '⚔️', pose: 'attack', prop: '', kind: 'fight' },
  loot: { icon: '💎', pose: 'idle', prop: '📦', kind: 'loot' },
  god: { icon: '✨', pose: 'idle', prop: '', kind: 'pray' },
  level: { icon: '⭐', pose: 'idle', prop: '', kind: 'cheer' },
  death: { icon: '💀', pose: 'dead', prop: '', kind: 'death' },
  oly: { icon: '🧭', pose: 'walk', prop: '', kind: 'travel' },
  fork: { icon: '🙏', pose: 'idle', prop: '', kind: 'pray' },
  event: { icon: '📜', pose: 'idle', prop: '', kind: 'event' },
  rare: { icon: '✨', pose: 'idle', prop: '💎', kind: 'loot' }
};

function amapClassifyDiary(e) {
  const cls = (e && e.c) || '';
  const text = ((e && e.x) || '') + ' ' + ((e && e.f) || '');
  const low = text.toLowerCase();
  let fx = Object.assign({}, AMAP_FX_BY_CLS[cls] || { icon: '💬', pose: 'idle', prop: '', kind: 'talk' });
  if (/лагер|выспался|привал|пенёк|сплю|храп|отдых|перевязал|короткий привал/i.test(text)) {
    fx = { icon: '⛺', pose: 'idle', prop: '🔥', kind: 'rest' };
  } else if (/проповед|рассказал прохож|уверовал|несу.*слово|паств/i.test(text)) {
    fx = { icon: '📣', pose: 'idle', prop: '', kind: 'preach' };
  } else if (/копа|рудник|шахт|под кустом|в канаве|из трещины вылез сундук|копаю|выкопа/i.test(text)) {
    fx = { icon: '⛏️', pose: 'idle', prop: '📦', kind: 'dig' };
  } else if (/храм|алтар|молил|пожертв|благослов|божий щит|молни|ливень/i.test(text)) {
    fx = { icon: '🙏', pose: 'idle', prop: '', kind: 'pray' };
  } else if (/пришёл в |в город|на рынок|торгов|прода/i.test(text)) {
    fx = { icon: '🏘', pose: 'idle', prop: '🏪', kind: 'town' };
  } else if (/пещер|подземел|данж|🕳/i.test(text)) {
    fx = { icon: '🕳', pose: 'walk', prop: '', kind: 'dungeon' };
  } else if (/побед|побеждён|танц/i.test(text)) {
    fx = { icon: '🏆', pose: 'idle', prop: '', kind: 'cheer' };
  } else if (/умер|палъ|💀|лежу/i.test(text) || cls === 'death') {
    fx = { icon: '💀', pose: 'dead', prop: '', kind: 'death' };
  } else if (/бой|волк|противник|выпрыгнул|сдачи|атак/i.test(text) || cls === 'fight') {
    if (!AMAP_FX_BY_CLS[cls]) fx = { icon: '⚔️', pose: 'attack', prop: '', kind: 'fight' };
  } else if (/уровень|черту|прокач/i.test(text) || cls === 'level') {
    fx = { icon: '⭐', pose: 'idle', prop: '', kind: 'cheer' };
  }
  /* explicit diary class wins over weak keyword collisions (e.g. «Щит» item ≠ pray) */
  if (cls === 'loot' && fx.kind !== 'dig') fx = { icon: '💎', pose: 'idle', prop: '📦', kind: 'loot' };
  if (cls === 'fight' && fx.kind !== 'death') fx = Object.assign({}, AMAP_FX_BY_CLS.fight);
  if (cls === 'death') fx = Object.assign({}, AMAP_FX_BY_CLS.death);
  if (cls === 'level') fx = Object.assign({}, AMAP_FX_BY_CLS.level);
  fx.dur = fx.kind === 'death' ? 2800 : (fx.kind === 'fight' ? 2000 : 1600);
  fx.text = text.slice(0, 48);
  return fx;
}

function amapOnDiary(e) {
  if (!e || amapVis.fxSuppress) return;
  if (typeof SILENT !== 'undefined' && SILENT) return; /* offline batch — skip VFX storm */
  const fx = amapClassifyDiary(e);
  fx.id = ++amapVis.fxSeq;
  fx.diaryI = e.i || 0;
  fx.t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /* queue if flooded */
  if (amapVis.fxQ.length >= 4) amapVis.fxQ.shift();
  amapVis.fxQ.push(fx);
  amapPumpFx();
}

function amapPumpFx() {
  if (amapVis.fxLive) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - amapVis.fxLive.t0 < amapVis.fxLive.dur) return;
    amapVis.fxLive = null;
  }
  if (!amapVis.fxQ.length) return;
  const fx = amapVis.fxQ.shift();
  fx.t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  amapVis.fxLive = fx;
  amapPaintFx(fx);
  if (fx.pose && fx.pose !== 'idle') {
    try { amapApplyDomPose(fx.pose); } catch (err) {}
  }
  const wait = fx.dur || 1600;
  setTimeout(() => {
    if (amapVis.fxLive && amapVis.fxLive.id === fx.id) {
      amapVis.fxLive = null;
      amapClearFxDom();
      if (S && S.hero && S.hero.state === 'road' && !S.fight) {
        try { amapApplyDomPose('walk'); } catch (err) {}
      }
    }
    amapPumpFx();
  }, wait);
}

function amapClearFxDom() {
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  root.querySelectorAll('.wmap-fx').forEach(el => el.remove());
  root.classList.remove('amap-fx-act');
  if (root.dataset) delete root.dataset.fx;
}

function amapPaintFx(fx) {
  const root = document.querySelector('#colHero .amap');
  if (!root) return;
  amapClearFxDom();
  const actors = root.querySelector('.amap-actors');
  if (!actors) return;
  root.classList.add('amap-fx-act');
  root.dataset.fx = fx.kind;
  const vb = AMAP_VB;
  const hx = amapVis.x - vb.x, hy = amapVis.y - vb.y;
  const el = document.createElement('div');
  el.className = 'wmap-fx wmap-fx-' + fx.kind;
  el.style.left = hx.toFixed(1) + 'px';
  el.style.top = hy.toFixed(1) + 'px';
  el.innerHTML = `<span class="wmap-fx-ico">${fx.icon || ''}</span>`
    + (fx.prop ? `<span class="wmap-fx-prop">${fx.prop}</span>` : '')
    + `<span class="wmap-fx-burst"></span>`;
  actors.appendChild(el);
}

function amapFxHTML() {
  const fx = amapVis.fxLive;
  if (!fx) return '';
  const vb = AMAP_VB;
  const hx = amapVis.x - vb.x, hy = amapVis.y - vb.y;
  return `<div class="wmap-fx wmap-fx-${fx.kind}" style="left:${hx.toFixed(1)}px;top:${hy.toFixed(1)}px">
    <span class="wmap-fx-ico">${fx.icon || ''}</span>
    ${fx.prop ? `<span class="wmap-fx-prop">${fx.prop}</span>` : ''}
    <span class="wmap-fx-burst"></span>
  </div>`;
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

/* =====================================================================
   5в) Визуал героя: нарисованные позы + worn-kit пластины (одето, не наклеено)
   ===================================================================== */
const VIS_SKIN = { human: '#e8b896', elf: '#d4e8b8', dwarf: '#c9966e', halfling: '#f0c9a0', orc: '#7a9a5a', gnome: '#e0b070', tiefling: '#c07070' };
const VIS_HAIR = { human: '#5a3a28', elf: '#d4c878', dwarf: '#8a4a20', halfling: '#c87838', orc: '#2a3820', gnome: '#c04040', tiefling: '#1a1018' };
const VIS_EYE = { human: '#3a5a88', elf: '#5a9888', dwarf: '#4a3a28', halfling: '#5868a0', orc: '#c8d840', gnome: '#3868a8', tiefling: '#d04040' };
const VIS_GLOW = ['none', '0 0 4px #2e8b3a88', '0 0 6px #2a64c488', '0 0 8px #8a3cc4aa', '0 0 10px #d9731acc,0 0 18px #d9731a66'];
/* Нарисованные позы героя (webp/jpg в art/) */
const VIS_POSES = ['idle', 'walk1', 'walk2', 'attack', 'block', 'hurt', 'dead'];
const VIS_ART = { idle:1, walk1:1, walk2:1, attack:1, block:1, hurt:1, dead:1 };
const FOE_ART = { beast:1, bandit:1, undead:1 };
/* Worn kits: pose-matched painted plates (gear integrated into silhouette) */
const KIT_POSES = ['idle', 'walk1', 'walk2', 'attack', 'block', 'hurt'];
const KIT_ART = { h:1, l:1, c:1 }; /* h=plate full poses; l/c have idle + filtered h for other poses */

function visSkin(h) { return VIS_SKIN[h.race] || VIS_SKIN.human; }
function visHair(h) { return VIS_HAIR[h.race] || VIS_HAIR.human; }
function visEye(h) { return VIS_EYE[h.race] || VIS_EYE.human; }
function visScale(h) {
  if (h.race === 'halfling' || h.race === 'gnome') return { y: 1.08, s: .88 };
  if (h.race === 'dwarf' || h.race === 'orc') return { y: 1.04, s: .94 };
  if (h.cls === 'barbarian' || h.cls === 'warrior') return { y: 1, s: 1.04 };
  if (h.cls === 'mage' || h.cls === 'bard') return { y: 1, s: .96 };
  return { y: 1, s: 1 };
}
function visPose(h) {
  if (!h) return 'idle';
  if (h.state === 'dead') return 'dead';
  if (S.fight && fMe(S.fight)) {
    const F = S.fight, me = fMe(F);
    if (!me || !me.alive) return 'dead';
    if (F.fx && F.fx.a) {
      const hit = F.fx.a.find(a => a.id === me.id && a.v > 0);
      if (hit && (hit.k === 'hit' || hit.k === 'crit')) return 'hurt';
    }
    if (F.my && F.my.act === 'flee') return 'hurt';
    if (F.phase === 'turn' && F.my && F.my.blk && F.my.blk.length) return 'block';
    if (F.phase === 'turn' || F.phase === 'intro') return 'idle';
    return 'idle';
  }
  if (h.state === 'road') return 'walk';
  if (h.state === 'rest') return 'idle';
  if (h.state === 'fight' || h.state === 'duel' || h.state === 'dungeon') return 'idle';
  return 'idle';
}
function visItem(h, k) { return h && h.eq && h.eq[k] ? h.eq[k] : null; }
/** Body slots that change silhouette when worn (rings/amulet stay subtle overlays). */
const VIS_WORN_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'belt', 'gloves', 'boots'];
function visHasWorn(h) {
  if (!h || !h.eq) return false;
  for (const k of VIS_WORN_SLOTS) if (h.eq[k]) return true;
  return false;
}
/** Armor weight → kit kind: h plate / l leather / c cloth. Fallback from weapon cat. */
function visKitKind(h) {
  if (!visHasWorn(h)) return '';
  const ar = visItem(h, 'armor');
  if (ar && (ar.kind === 'h' || ar.kind === 'l' || ar.kind === 'c')) return ar.kind;
  const hm = visItem(h, 'helm');
  if (hm && (hm.kind === 'h' || hm.kind === 'l' || hm.kind === 'c')) return hm.kind;
  const w = visItem(h, 'weapon');
  if (w && (w.cat === 'staff' || w.cat === 'music')) return 'c';
  if (w && (w.cat === 'bow' || w.cat === 'dagger')) return 'l';
  const bt = visItem(h, 'boots') || visItem(h, 'gloves') || visItem(h, 'belt');
  if (bt && bt.kind) return bt.kind === 'c' ? 'c' : bt.kind === 'l' ? 'l' : 'h';
  return 'h';
}
function visTopRar(h) {
  let t = 0;
  for (const k of EQ_KEYS) { const it = visItem(h, k); if (it && (it.rar || 0) > t) t = it.rar; }
  return t;
}
function visTint(it) {
  if (!it) return '';
  const c = it.curse ? 'filter:brightness(.72) saturate(.7);' : '';
  const g = VIS_GLOW[it.rar] || 'none';
  return `style="${c}${g !== 'none' ? 'filter:' + (it.curse ? 'brightness(.72) saturate(.7) ' : '') + 'drop-shadow(' + g.replace(/,/g, ') drop-shadow(') + ');' : c}"`;
}
function visMetal(kind) { return kind === 'h' ? '#8a96a8' : kind === 'l' ? '#8a6a48' : '#6a5a88'; }
function visCloth(kind) { return kind === 'h' ? '#5a6878' : kind === 'l' ? '#6a5038' : '#4a3a68'; }
function visShade(id, c1, c2) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
}
function visRad(id, c1, c2) {
  return `<radialGradient id="${id}" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></radialGradient>`;
}

/* ---------- Оружие / щит (SVG поверх краски) ---------- */
function visWeaponPath(cat, x, y) {
  if (cat === 'bow') return `<g class="vw bow" transform="translate(${x},${y})"><path d="M0,-18 Q-14,0 0,18" fill="none" stroke="#6a4020" stroke-width="2.2"/><path d="M0,-18 L0,18" fill="none" stroke="#c8b898" stroke-width="1"/><line x1="0" y1="0" x2="16" y2="-2" stroke="#8a7050" stroke-width="1.4"/></g>`;
  if (cat === 'staff') return `<g class="vw staff" transform="translate(${x},${y})"><line x1="2" y1="-28" x2="2" y2="22" stroke="#6a4828" stroke-width="2.6" stroke-linecap="round"/><circle cx="2" cy="-30" r="5" fill="#7ec8e8" opacity=".9"/><circle cx="2" cy="-30" r="2.5" fill="#fff8"/></g>`;
  if (cat === 'axe') return `<g class="vw axe" transform="translate(${x},${y})"><line x1="1" y1="-8" x2="1" y2="18" stroke="#5a3a20" stroke-width="2.2"/><path d="M1,-6 L14,-10 L14,2 Z" fill="#9aa4b0" stroke="#3a4050" stroke-width=".6"/></g>`;
  if (cat === 'mace') return `<g class="vw mace" transform="translate(${x},${y})"><line x1="1" y1="-4" x2="1" y2="18" stroke="#5a3a20" stroke-width="2.2"/><circle cx="1" cy="-8" r="6" fill="#8a9098" stroke="#3a4050" stroke-width=".6"/><circle cx="-2" cy="-10" r="1.4" fill="#c0c4c8"/><circle cx="4" cy="-6" r="1.4" fill="#c0c4c8"/></g>`;
  if (cat === 'dagger') return `<g class="vw dagger" transform="translate(${x},${y})"><line x1="1" y1="-14" x2="1" y2="10" stroke="#b0b8c0" stroke-width="1.8" stroke-linecap="round"/><line x1="-3" y1="2" x2="5" y2="2" stroke="#6a4828" stroke-width="1.6"/><path d="M1,-14 L3,-8 L-1,-8 Z" fill="#d0d6dc"/></g>`;
  if (cat === 'two') return `<g class="vw two" transform="translate(${x},${y})"><line x1="2" y1="-26" x2="2" y2="20" stroke="#5a3a20" stroke-width="2.8" stroke-linecap="round"/><path d="M2,-24 L10,-18 L10,-6 L2,-2 Z" fill="#9aa4b0" stroke="#3a4050" stroke-width=".6"/><path d="M2,-24 L-6,-18 L-6,-6 L2,-2 Z" fill="#8a949e" stroke="#3a4050" stroke-width=".6"/></g>`;
  if (cat === 'music') return `<g class="vw music" transform="translate(${x},${y})"><ellipse cx="2" cy="6" rx="7" ry="10" fill="#8a5a30" stroke="#4a3020" stroke-width=".8"/><rect x="-1" y="-16" width="6" height="14" rx="1" fill="#6a4020"/><circle cx="2" cy="4" r="2.5" fill="#f0d8a0"/><path d="M8,-10 Q14,-4 8,2" fill="none" stroke="#c8a060" stroke-width="1.2"/></g>`;
  return `<g class="vw sword" transform="translate(${x},${y})"><line x1="1" y1="-20" x2="1" y2="12" stroke="#c0c8d0" stroke-width="2.2" stroke-linecap="round"/><line x1="-5" y1="0" x2="7" y2="0" stroke="#6a4828" stroke-width="2"/><rect x="-1" y="12" width="4" height="6" rx="1" fill="#5a3a20"/><path d="M1,-20 L3,-12 L-1,-12 Z" fill="#e8eef4"/></g>`;
}
function visShield(x, y, kind) {
  const fill = kind === 'h' ? '#6a7888' : kind === 'c' ? '#5a4a78' : '#8a6a48';
  return `<g class="vsh" transform="translate(${x},${y})"><path d="M0,-12 L12,-6 L10,10 L0,16 L-10,10 L-12,-6 Z" fill="${fill}" stroke="#2a3038" stroke-width="1.2"/><path d="M0,-6 L6,-2 L5,6 L0,9 L-5,6 L-6,-2 Z" fill="#00000022"/></g>`;
}

/* Полный SVG-кукла (fallback, если краска не загрузилась) */
function visSVG(h, opt) {
  opt = opt || {};
  h = h || (S && S.hero);
  if (!h) return '';
  const skin = visSkin(h), hair = visHair(h), eye = visEye(h), sc = visScale(h);
  const pose = opt.pose || visPose(h);
  const sz = opt.size || 'md';
  const w = visItem(h, 'weapon'), oh = visItem(h, 'offhand'), hm = visItem(h, 'helm');
  const ar = visItem(h, 'armor'), bt = visItem(h, 'boots'), bl = visItem(h, 'belt');
  const gl = visItem(h, 'gloves'), am = visItem(h, 'amulet'), r1 = visItem(h, 'ring'), r2 = visItem(h, 'ring2');
  const h2 = w && w.h2;
  const bodyW = h.cls === 'barbarian' || h.cls === 'warrior' ? 18 : h.cls === 'mage' ? 14 : 16;
  const bootC = bt ? visMetal(bt.kind) : '#3a2a20';
  const legC = ar && ar.kind === 'h' ? '#4a5560' : ar && ar.kind === 'l' ? '#5a4030' : '#3a2a48';
  let armorG = '';
  if (ar) {
    const fill = visCloth(ar.kind), stroke = visMetal(ar.kind);
    if (ar.kind === 'c') armorG = `<path class="vl armor" d="M42,48 Q50,44 58,48 L62,78 Q50,84 38,78 Z" fill="${fill}" stroke="${stroke}" stroke-width="1" ${visTint(ar)}/>
      <path d="M40,48 L36,72 L42,76" fill="${fill}" opacity=".9"/><path d="M60,48 L64,72 L58,76" fill="${fill}" opacity=".9"/>`;
    else if (ar.kind === 'l') armorG = `<path class="vl armor" d="M40,48 L60,48 L63,76 L50,82 L37,76 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" ${visTint(ar)}/>
      <path d="M44,52 L48,74 M56,52 L52,74" stroke="#0003" stroke-width="1"/>`;
    else armorG = `<path class="vl armor" d="M38,47 L62,47 L66,55 L64,78 L50,84 L36,78 L34,55 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" ${visTint(ar)}/>
      <rect x="44" y="52" width="12" height="10" rx="1" fill="#0002"/><path d="M40,56 L36,74 M60,56 L64,74" stroke="#fff3" stroke-width="1"/>`;
  } else {
    armorG = `<path class="vl bodyt" d="M42,48 L58,48 L60,76 L50,80 L40,76 Z" fill="url(#sk)" stroke="#0003" stroke-width=".6"/>
      <path d="M42,48 L38,70 L42,74" fill="url(#sk)"/><path d="M58,48 L62,70 L58,74" fill="url(#sk)"/>
      <path d="M44,52 L48,72 M56,52 L52,72" stroke="#0001" stroke-width="1"/>`;
  }
  const beltG = bl ? `<rect class="vl belt" x="38" y="72" width="24" height="5" rx="1.5" fill="${visMetal(bl.kind)}" stroke="#2a2018" stroke-width=".6" ${visTint(bl)}/><circle cx="50" cy="74.5" r="1.8" fill="#d4b060"/>` : '';
  const legs = `<g class="vl legs">
    <path d="M42,78 L40,108 L46,108 L48,80 Z" fill="${legC}" stroke="#0003" stroke-width=".5"/><path d="M58,78 L60,108 L54,108 L52,80 Z" fill="${legC}" stroke="#0003" stroke-width=".5"/>
    ${bt ? `<path class="vl boots" d="M38,106 L40,118 L48,118 L47,106 Z" fill="${bootC}" ${visTint(bt)}/><path class="vl boots" d="M62,106 L60,118 L52,118 L53,106 Z" fill="${bootC}" ${visTint(bt)}/><ellipse cx="43" cy="118" rx="6" ry="2.2" fill="${bootC}"/><ellipse cx="57" cy="118" rx="6" ry="2.2" fill="${bootC}"/>`
      : `<path d="M39,108 L40,116 L47,116 L46,108" fill="${skin}"/><path d="M61,108 L60,116 L53,116 L54,108" fill="${skin}"/>`}
  </g>`;
  const headR = h.race === 'orc' ? 13 : 12;
  const ear = h.race === 'elf' ? `<path d="M38,28 L34,22 L38,32 Z" fill="${skin}"/><path d="M62,28 L66,22 L62,32 Z" fill="${skin}"/>`
    : h.race === 'tiefling' ? `<path d="M40,22 L36,10 L42,24 M60,22 L64,10 L58,24" fill="none" stroke="${skin}" stroke-width="2.2"/>` : '';
  const beard = (h.race === 'dwarf' || h.cls === 'barbarian') ? `<path d="M42,40 Q50,52 58,40" fill="${hair}" opacity=".85"/>` : '';
  const helmG = hm ? (hm.kind === 'c'
    ? `<path class="vl helm" d="M38,18 Q50,8 62,18 L60,34 Q50,38 40,34 Z" fill="${visCloth('c')}" stroke="${visMetal('c')}" stroke-width="1" ${visTint(hm)}/><path d="M36,22 L30,40 L36,38" fill="${visCloth('c')}"/><path d="M64,22 L70,40 L64,38" fill="${visCloth('c')}"/>`
    : `<path class="vl helm" d="M37,20 Q50,6 63,20 L62,36 Q50,40 38,36 Z" fill="${visMetal(hm.kind)}" stroke="#2a3038" stroke-width="1.2" ${visTint(hm)}/><rect x="42" y="26" width="16" height="6" rx="1" fill="#1a2030aa"/>`)
    : '';
  const face = `<g class="vl head">
    <circle cx="50" cy="30" r="${headR}" fill="url(#sk)" stroke="#0002" stroke-width=".6"/>${ear}
    <path d="M40,22 Q50,10 60,22" fill="${hair}"/>
    <ellipse cx="44" cy="30" rx="1.6" ry="2" fill="${eye}"/><ellipse cx="56" cy="30" rx="1.6" ry="2" fill="${eye}"/>
    <path d="M46,38 Q50,41 54,38" fill="none" stroke="#0004" stroke-width="1"/>${beard}${helmG}
  </g>`;
  const glC = gl ? visMetal(gl.kind) : skin;
  const arms = `<g class="vl arms">
    <g class="armL"><path d="M42,52 L28,78 L34,80 L44,56 Z" fill="url(#sk)"/><circle cx="30" cy="80" r="4" fill="${glC}" ${gl ? visTint(gl) : ''}/></g>
    <g class="armR"><path d="M58,52 L72,78 L66,80 L56,56 Z" fill="url(#sk)"/><circle cx="70" cy="80" r="4" fill="${glC}" ${gl ? visTint(gl) : ''}/></g>
  </g>`;
  const weapG = w ? `<g class="vl weapon" ${visTint(w)}>${visWeaponPath(w.cat || 'sword', h2 ? 74 : 72, 70)}</g>` : '';
  const offG = oh ? (oh.slot === 'offhand' || oh.base ? `<g class="vl offhand" ${visTint(oh)}>${/щит|бакл|тарч/i.test(oh.n || oh.base || '') || oh.kind === 'h' || oh.kind === 'l' ? visShield(26, 72, oh.kind) : visWeaponPath(oh.cat || 'dagger', 24, 72)}</g>` : '') : '';
  const amG = am ? `<circle class="vl amulet" cx="50" cy="58" r="3.5" fill="${RARITY[am.rar].c}" stroke="#fff8" stroke-width=".8" ${visTint(am)}/>` : '';
  const ringG = `${r1 ? `<circle class="vl ring" cx="74" cy="70" r="2.2" fill="none" stroke="${RARITY[r1.rar].c}" stroke-width="1.4" ${visTint(r1)}/>` : ''}
    ${r2 ? `<circle class="vl ring2" cx="26" cy="70" r="2.2" fill="none" stroke="${RARITY[r2.rar].c}" stroke-width="1.4" ${visTint(r2)}/>` : ''}`;
  const topRar = Math.max(w ? w.rar : 0, ar ? ar.rar : 0, hm ? hm.rar : 0, oh ? oh.rar : 0);
  const aura = topRar >= 3 ? `<ellipse class="vaura r${topRar}" cx="50" cy="70" rx="36" ry="48" fill="${RARITY[topRar].c}" opacity=".12"/>` : '';
  const cursed = equipped(h).some(it => it.curse);
  const tf = `translate(50 ${sc.y * 70}) scale(${sc.s}) translate(-50 ${-70})`;
  const skin2 = (() => { const n = parseInt((skin||'#e8b896').slice(1), 16); const r=Math.max(0,(n>>16)-28), g=Math.max(0,((n>>8)&255)-32), b=Math.max(0,(n&255)-28); return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`; })();
  return `<svg class="vis ${sz} p-${pose}${cursed ? ' cursed' : ''}${topRar >= 4 ? ' leg' : topRar >= 3 ? ' epi' : ''}" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>${visRad('sk', skin, skin2)}${visShade('mt', '#c8d0d8', '#6a7480')}${visShade('wd', '#a07840', '#5a3a18')}</defs>
    <ellipse cx="50" cy="128" rx="18" ry="3.5" fill="#0003"/>
    <g class="vroot" transform="${tf}">${aura}${legs}${armorG}${beltG}${amG}${arms}${offG}${weapG}${ringG}${face}</g>
  </svg>`;
}

/* Тонкий SVG: только кольца/амулет/аура. Оружие/броня/шлем — в worn-kit пластинах, не стикеры. */
function visGearSVG(h, opt) {
  opt = opt || {};
  h = h || (S && S.hero);
  if (!h) return '';
  const pose = opt.pose || visPose(h);
  const sz = opt.size || 'md';
  const kit = visKitKind(h);
  const am = visItem(h, 'amulet'), r1 = visItem(h, 'ring'), r2 = visItem(h, 'ring2');
  const w = visItem(h, 'weapon'), oh = visItem(h, 'offhand'), hm = visItem(h, 'helm'), ar = visItem(h, 'armor');
  const sc = visScale(h);
  const topRar = visTopRar(h);
  const aura = topRar >= 3 ? `<ellipse class="vaura r${topRar}" cx="50" cy="70" rx="38" ry="52" fill="${RARITY[topRar].c}" opacity=".14"/>` : '';
  const amG = am ? `<circle class="vl amulet" cx="50" cy="56" r="3.2" fill="${RARITY[am.rar].c}" stroke="#fff8" stroke-width=".9" ${visTint(am)}/>` : '';
  const ringG = `${r1 ? `<circle class="vl ring" cx="74" cy="96" r="2.2" fill="none" stroke="${RARITY[r1.rar].c}" stroke-width="1.4" ${visTint(r1)}/>` : ''}
    ${r2 ? `<circle class="vl ring2" cx="26" cy="96" r="2.2" fill="none" stroke="${RARITY[r2.rar].c}" stroke-width="1.4" ${visTint(r2)}/>` : ''}`;
  /* Если kit не загрузился / нет краски — оставим лёгкие маркеры слотов для тестов (скрыты CSS при has-paint+kit) */
  let stick = '';
  if (!kit) {
    /* unequipped: nothing */
  } else {
    /* data markers so tests/a11y can see slots without floating clip-art */
    stick = `<g class="vl worn-mark" opacity="0" aria-hidden="true">
      ${w ? `<circle class="vl weapon" cx="1" cy="1" r="0.1"/>` : ''}
      ${hm ? `<circle class="vl helm" cx="2" cy="1" r="0.1"/>` : ''}
      ${ar ? `<circle class="vl armor" cx="3" cy="1" r="0.1"/>` : ''}
      ${oh ? `<circle class="vl offhand" cx="4" cy="1" r="0.1"/>` : ''}
    </g>`;
  }
  const cursed = equipped(h).some(it => it.curse);
  const tf = `translate(50 ${sc.y * 70}) scale(${sc.s}) translate(-50 ${-70})`;
  return `<svg class="vis vgear ${sz} p-${pose}${kit ? ' kit' : ''}${cursed ? ' cursed' : ''}${topRar >= 4 ? ' leg' : topRar >= 3 ? ' epi' : ''}" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-kit="${kit || ''}">
    <g class="vroot" transform="${tf}">${aura}${amG}${ringG}${stick}</g>
  </svg>`;
}

/* Картинка позы: bare + worn-kit; onerror → paint-fail → SVG fallback */
function visPaintFrame(key, prefix) {
  prefix = prefix || 'hero';
  const cls = prefix === 'hero' ? `vp-fr vp-bare vp-${key}` : `vp-fr vp-worn vp-${key}`;
  const src = prefix === 'hero' ? `hero_${key}` : `${prefix}_${key}`;
  return `<picture class="${cls}" data-fr="${key}" data-src="${src}">
    <source type="image/webp" srcset="art/${src}.webp"/>
    <img src="art/${src}.jpg" alt="" width="251" height="360" decoding="async" draggable="false"
      onload="const w=this.closest('.vwrap');if(w){w.classList.add('has-paint');w.classList.remove('paint-fail')}"
      onerror="const w=this.closest('.vwrap');if(w&&!w.classList.contains('has-paint'))w.classList.add('paint-fail')"/>
  </picture>`;
}
function visPaintCheck(root) {
  root = root || document;
  root.querySelectorAll('.vwrap.painted').forEach(w => {
    const kit = w.getAttribute('data-kit') || '';
    const sel = kit ? `.vp-worn img` : `.vp-bare img`;
    const imgs = w.querySelectorAll(sel);
    let ok = false, bad = 0, n = 0;
    imgs.forEach(img => {
      n++;
      if (img.complete && img.naturalWidth > 0) ok = true;
      else if (img.complete && img.naturalWidth === 0) bad++;
    });
    /* also accept any loaded paint */
    if (!ok) {
      w.querySelectorAll('.vpaint img').forEach(img => {
        if (img.complete && img.naturalWidth > 0) ok = true;
      });
    }
    if (ok) { w.classList.add('has-paint'); w.classList.remove('paint-fail'); }
    else if (n && bad >= n) w.classList.add('paint-fail');
  });
  root.querySelectorAll('.vfoe').forEach(w => {
    const img = w.querySelector('.fpaint img');
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) { w.classList.add('has-paint'); w.classList.remove('paint-fail'); }
    else if (img.complete && img.naturalWidth === 0) w.classList.add('paint-fail');
  });
}
function visPaintHTML(h, pose) {
  const race = (h && h.race) || 'human';
  const cls = (h && h.cls) || 'warrior';
  const kit = visKitKind(h);
  const bare = VIS_POSES.map(k => visPaintFrame(k, 'hero')).join('');
  /* plate kits for all combat/walk poses; leather/cloth unique idle + reuse plate for motion via CSS filter */
  const kitH = KIT_POSES.map(k => visPaintFrame(k, 'kit_h')).join('');
  const kitL = visPaintFrame('idle', 'kit_l');
  const kitC = visPaintFrame('idle', 'kit_c');
  return `<div class="vpaint race-${race} cls-${cls}" data-race="${race}" data-cls="${cls}" data-kit="${kit}">${bare}<div class="vp-kit vp-kit-h">${kitH}</div><div class="vp-kit vp-kit-l">${kitL}</div><div class="vp-kit vp-kit-c">${kitC}</div></div>`;
}

function visFoeKey(f) {
  const n = ((f && (f.n || f.name || f.id)) || '') + '';
  if (/скелет|некромант|труп|кость|мертв|лих|вампир|призрак|undead/i.test(n)) return 'undead';
  if (/волк|звер|крыс|тролл|голем|дракон|змей|бегемот|кракозябр|паук|медвед|орёл|змей|гolem|beast/i.test(n)) return 'beast';
  return 'bandit';
}
function visFoeSVG(f, opt) {
  opt = opt || {};
  const key = visFoeKey(f);
  const boss = f && (f.kind === 'boss' || f.boss);
  const elite = f && (f.kind === 'elite' || f.elite);
  const sz = opt.size || 'md';
  /* painted foe + SVG silhouette fallback */
  const paint = `<div class="fpaint foe-${key}${boss ? ' boss' : ''}${elite ? ' elite' : ''}">
    <picture>
      <source type="image/webp" srcset="art/foe_${key}.webp"/>
      <img class="fpaint-img" src="art/foe_${key}.jpg" alt="" width="251" height="360" decoding="async" draggable="false"
        onload="this.closest('.vfoe')&&this.closest('.vfoe').classList.add('has-paint')"
        onerror="const w=this.closest('.vfoe');if(w){w.classList.add('paint-fail');w.classList.remove('has-paint')}"/>
    </picture>
  </div>`;
  const fill = boss ? '#6a2030' : elite ? '#4a3050' : '#3a4050';
  const horn = boss ? `<path d="M38,24 L34,10 L42,26 M62,24 L66,10 L58,26" fill="none" stroke="#c04040" stroke-width="2.5"/>` : '';
  const svg = `<svg class="vis foe ${sz} foe-svg" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="50" cy="128" rx="22" ry="4" fill="#0003"/>
    <path d="M40,50 L60,50 L64,90 L50,100 L36,90 Z" fill="${fill}"/>
    <circle cx="50" cy="32" r="14" fill="${fill}"/>${horn}
    <circle cx="44" cy="30" r="2" fill="#e04040"/><circle cx="56" cy="30" r="2" fill="#e04040"/>
    <path d="M42,40 Q50,46 58,40" fill="none" stroke="#0006" stroke-width="1.5"/>
    <path d="M38,55 L24,80 L30,82 L42,60 M62,55 L76,80 L70,82 L58,60" fill="${fill}"/>
  </svg>`;
  return `<div class="vfoe" data-foe="${key}">${paint}${svg}</div>`;
}

function visHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  const pose = opt.pose || visPose(h);
  const kit = visKitKind(h);
  const topRar = visTopRar(h);
  const cursed = equipped(h).some(it => it.curse);
  const label = `${h.name}: ${RACES[h.race].n}-${CLASSES[h.cls].n}, ГС ${gearScore(h)}`;
  const cls = `vwrap painted ${opt.cls || ''} ${opt.tap === false ? '' : 'vtap'}${cursed ? ' cursed' : ''}${topRar >= 4 ? ' leg' : topRar >= 3 ? ' epi' : ''}`;
  const act = opt.tap === false ? '' : ` role="button" tabindex="0" data-act="sheet" aria-label="${esc(label)}. Открыть снаряжение"`;
  /* worn-kit paint (одето) + subtle rings/amulet + full SVG fallback */
  return `<div class="${cls}" data-pose="${pose}" data-kit="${kit}"${act}>
    ${visPaintHTML(h, pose)}
    ${visGearSVG(h, opt)}
    <div class="vfb">${visSVG(h, opt)}</div>
  </div>`;
}
function visPairHTML(h, foe, opt) {
  opt = opt || {};
  return `<div class="vpair" aria-hidden="true">${visHTML(h, Object.assign({}, opt, { tap: false, cls: 'me' }))}<span class="vvs">⚔</span>${visFoeSVG(foe, opt)}</div>`;
}

function visSetPoseOn(el, pose) {
  if (!el) return;
  el.setAttribute('data-pose', pose);
  el.querySelectorAll('.vis').forEach(v => {
    v.classList.remove('p-idle', 'p-walk', 'p-attack', 'p-block', 'p-hurt', 'p-dead');
    v.classList.add('p-' + pose);
  });
}
function visApplyFightPose(F, forcePose) {
  const targets = () => document.querySelectorAll('.vwrap.me, #fightBox .vwrap, #colHero .vwrap.painted, #colHero .scn-doll');
  if (forcePose) {
    targets().forEach(el => visSetPoseOn(el, forcePose));
    return forcePose;
  }
  if (!F) return;
  let me = null;
  try { me = typeof fMe === 'function' ? fMe(F) : null; } catch (e) { me = null; }
  if (!me && F.units) me = F.units.find(u => u && u.isMe) || F.units[0];
  if (!me) return;
  let pose = 'idle';
  if (!me.alive) pose = 'dead';
  else if (F.fx && F.fx.a) {
    const hit = F.fx.a.some(a => a.id === me.id && a.v > 0 && a.k !== 'heal');
    const dealt = F.fx.a.some(a => a.id !== me.id && a.v > 0 && (a.k === 'crit' || a.k === 'hit'));
    if (hit) pose = 'hurt';
    else if (dealt) pose = 'attack';
    else if (F.my && F.my.blk && F.my.blk.length) pose = 'block';
  } else if (F.my && F.my.blk && F.my.blk.length && F.phase === 'turn') pose = 'block';
  targets().forEach(el => visSetPoseOn(el, pose));
  /* slash FX toward zone */
  if (pose === 'attack' && typeof scnFightSlash === 'function') scnFightSlash(F);
  if (pose === 'attack' || pose === 'hurt') {
    setTimeout(() => {
      if (!S.fight) return;
      targets().forEach(el => {
        if (el.getAttribute('data-pose') === 'attack' || el.getAttribute('data-pose') === 'hurt')
          visSetPoseOn(el, 'idle');
      });
    }, 520);
  }
  return pose;
}

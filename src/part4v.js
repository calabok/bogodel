/* =====================================================================
   5в) Визуал героя: бумажная кукла (слои SVG ↔ слоты снаряжения)
   ===================================================================== */
/* Цвета кожи и волос по расе; силуэт слегка меняется классом */
const VIS_SKIN = { human: '#e8b896', elf: '#d4e8b8', dwarf: '#c9966e', halfling: '#f0c9a0', orc: '#7a9a5a', gnome: '#e0b070', tiefling: '#c07070' };
const VIS_HAIR = { human: '#5a3a28', elf: '#d4c878', dwarf: '#8a4a20', halfling: '#c87838', orc: '#2a3820', gnome: '#c04040', tiefling: '#1a1018' };
const VIS_EYE = { human: '#3a5a88', elf: '#5a9888', dwarf: '#4a3a28', halfling: '#5868a0', orc: '#c8d840', gnome: '#3868a8', tiefling: '#d04040' };
/* Редкость: подсветка контура; проклятие — тёмный фильтр */
const VIS_GLOW = ['none', '0 0 4px #2e8b3a88', '0 0 6px #2a64c488', '0 0 8px #8a3cc4aa', '0 0 10px #d9731acc,0 0 18px #d9731a66'];

function visSkin(h) { return VIS_SKIN[h.race] || VIS_SKIN.human; }
function visHair(h) { return VIS_HAIR[h.race] || VIS_HAIR.human; }
function visEye(h) { return VIS_EYE[h.race] || VIS_EYE.human; }
/* Класс → лёгкий силуэт (плечи / рост) */
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
      const atk = F.fx.a.find(a => a.aid === me.id || (a.from === me.id));
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
/* Слот → видимый слой: пустой слот не рисуем (кроме тела) */
function visItem(h, k) { return h && h.eq && h.eq[k] ? h.eq[k] : null; }
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

/* ---------- Оружие по категории ---------- */
function visWeaponPath(cat, x, y) {
  /* правая рука roughly (x,y); пути относительно viewBox 100×140 */
  if (cat === 'bow') return `<g class="vw bow" transform="translate(${x},${y})"><path d="M0,-18 Q-14,0 0,18" fill="none" stroke="#6a4020" stroke-width="2.2"/><path d="M0,-18 L0,18" fill="none" stroke="#c8b898" stroke-width="1"/><line x1="0" y1="0" x2="16" y2="-2" stroke="#8a7050" stroke-width="1.4"/></g>`;
  if (cat === 'staff') return `<g class="vw staff" transform="translate(${x},${y})"><line x1="2" y1="-28" x2="2" y2="22" stroke="#6a4828" stroke-width="2.6" stroke-linecap="round"/><circle cx="2" cy="-30" r="5" fill="#7ec8e8" opacity=".9"/><circle cx="2" cy="-30" r="2.5" fill="#fff8"/></g>`;
  if (cat === 'axe') return `<g class="vw axe" transform="translate(${x},${y})"><line x1="1" y1="-8" x2="1" y2="18" stroke="#5a3a20" stroke-width="2.2"/><path d="M1,-6 L14,-10 L14,2 Z" fill="#9aa4b0" stroke="#3a4050" stroke-width=".6"/></g>`;
  if (cat === 'mace') return `<g class="vw mace" transform="translate(${x},${y})"><line x1="1" y1="-4" x2="1" y2="18" stroke="#5a3a20" stroke-width="2.2"/><circle cx="1" cy="-8" r="6" fill="#8a9098" stroke="#3a4050" stroke-width=".6"/><circle cx="-2" cy="-10" r="1.4" fill="#c0c4c8"/><circle cx="4" cy="-6" r="1.4" fill="#c0c4c8"/></g>`;
  if (cat === 'dagger') return `<g class="vw dagger" transform="translate(${x},${y})"><line x1="1" y1="-14" x2="1" y2="10" stroke="#b0b8c0" stroke-width="1.8" stroke-linecap="round"/><line x1="-3" y1="2" x2="5" y2="2" stroke="#6a4828" stroke-width="1.6"/><path d="M1,-14 L3,-8 L-1,-8 Z" fill="#d0d6dc"/></g>`;
  if (cat === 'two') return `<g class="vw two" transform="translate(${x},${y})"><line x1="2" y1="-26" x2="2" y2="20" stroke="#5a3a20" stroke-width="2.8" stroke-linecap="round"/><path d="M2,-24 L10,-18 L10,-6 L2,-2 Z" fill="#9aa4b0" stroke="#3a4050" stroke-width=".6"/><path d="M2,-24 L-6,-18 L-6,-6 L2,-2 Z" fill="#8a949e" stroke="#3a4050" stroke-width=".6"/></g>`;
  if (cat === 'music') return `<g class="vw music" transform="translate(${x},${y})"><ellipse cx="2" cy="6" rx="7" ry="10" fill="#8a5a30" stroke="#4a3020" stroke-width=".8"/><rect x="-1" y="-16" width="6" height="14" rx="1" fill="#6a4020"/><circle cx="2" cy="4" r="2.5" fill="#f0d8a0"/><path d="M8,-10 Q14,-4 8,2" fill="none" stroke="#c8a060" stroke-width="1.2"/></g>`;
  /* sword default */
  return `<g class="vw sword" transform="translate(${x},${y})"><line x1="1" y1="-20" x2="1" y2="12" stroke="#c0c8d0" stroke-width="2.2" stroke-linecap="round"/><line x1="-5" y1="0" x2="7" y2="0" stroke="#6a4828" stroke-width="2"/><rect x="-1" y="12" width="4" height="6" rx="1" fill="#5a3a20"/><path d="M1,-20 L3,-12 L-1,-12 Z" fill="#e8eef4"/></g>`;
}
function visShield(x, y, kind) {
  const fill = kind === 'h' ? '#6a7888' : kind === 'c' ? '#5a4a78' : '#8a6a48';
  return `<g class="vsh" transform="translate(${x},${y})"><path d="M0,-12 L12,-6 L10,10 L0,16 L-10,10 L-12,-6 Z" fill="${fill}" stroke="#2a3038" stroke-width="1.2"/><path d="M0,-6 L6,-2 L5,6 L0,9 L-5,6 L-6,-2 Z" fill="#00000022"/></g>`;
}

/* ---------- Основной SVG ---------- */
function visSVG(h, opt) {
  opt = opt || {};
  h = h || (S && S.hero);
  if (!h) return '';
  const skin = visSkin(h), hair = visHair(h), eye = visEye(h), sc = visScale(h);
  const pose = opt.pose || visPose(h);
  const sz = opt.size || 'md'; /* sm | md | lg */
  const w = visItem(h, 'weapon'), oh = visItem(h, 'offhand'), hm = visItem(h, 'helm');
  const ar = visItem(h, 'armor'), bt = visItem(h, 'boots'), bl = visItem(h, 'belt');
  const gl = visItem(h, 'gloves'), am = visItem(h, 'amulet'), r1 = visItem(h, 'ring'), r2 = visItem(h, 'ring2');
  const h2 = w && w.h2;
  const bodyW = h.cls === 'barbarian' || h.cls === 'warrior' ? 18 : h.cls === 'mage' ? 14 : 16;
  /* ноги / сапоги */
  const bootC = bt ? visMetal(bt.kind) : '#3a2a20';
  const legC = ar && ar.kind === 'h' ? '#4a5560' : ar && ar.kind === 'l' ? '#5a4030' : '#3a2a48';
  /* броня */
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
    /* голое тело / рубаха */
    armorG = `<path class="vl bodyt" d="M42,48 L58,48 L60,76 L50,80 L40,76 Z" fill="url(#sk)" stroke="#0003" stroke-width=".6"/>
      <path d="M42,48 L38,70 L42,74" fill="url(#sk)"/><path d="M58,48 L62,70 L58,74" fill="url(#sk)"/>
      <path d="M44,52 L48,72 M56,52 L52,72" stroke="#0001" stroke-width="1"/>`;
  }
  /* пояс */
  const beltG = bl ? `<rect class="vl belt" x="38" y="72" width="24" height="5" rx="1.5" fill="${visMetal(bl.kind)}" stroke="#2a2018" stroke-width=".6" ${visTint(bl)}/><circle cx="50" cy="74.5" r="1.8" fill="#d4b060"/>` : '';
  /* сапоги / ноги */
  const legs = `<g class="vl legs">
    <path d="M42,78 L40,108 L46,108 L48,80 Z" fill="${legC}" stroke="#0003" stroke-width=".5"/><path d="M58,78 L60,108 L54,108 L52,80 Z" fill="${legC}" stroke="#0003" stroke-width=".5"/>
    ${bt ? `<path class="vl boots" d="M38,106 L40,118 L48,118 L47,106 Z" fill="${bootC}" ${visTint(bt)}/><path class="vl boots" d="M62,106 L60,118 L52,118 L53,106 Z" fill="${bootC}" ${visTint(bt)}/><ellipse cx="43" cy="118" rx="6" ry="2.2" fill="${bootC}"/><ellipse cx="57" cy="118" rx="6" ry="2.2" fill="${bootC}"/>`
      : `<path d="M39,108 L40,116 L47,116 L46,108" fill="${skin}"/><path d="M61,108 L60,116 L53,116 L54,108" fill="${skin}"/>`}
  </g>`;
  /* голова */
  const headR = h.race === 'orc' ? 13 : 12;
  const ear = h.race === 'elf' ? `<path d="M38,28 L34,22 L38,32 Z" fill="${skin}"/><path d="M62,28 L66,22 L62,32 Z" fill="${skin}"/>`
    : h.race === 'tiefling' ? `<path d="M40,22 L36,12 L42,24" fill="none" stroke="${hair}" stroke-width="2"/><path d="M60,22 L64,12 L58,24" fill="none" stroke="${hair}" stroke-width="2"/>` : '';
  const beard = (h.race === 'dwarf' || h.cls === 'barbarian') && !hm ? `<path d="M44,40 Q50,50 56,40 Q50,46 44,40" fill="${hair}"/>` : '';
  const hairG = hm ? '' : (h.race === 'orc' ? `<path d="M40,22 Q50,16 60,22" fill="none" stroke="${hair}" stroke-width="3"/>`
    : `<path d="M38,30 Q40,16 50,14 Q60,16 62,30" fill="${hair}"/><path d="M40,28 Q42,22 50,20 Q58,22 60,28" fill="${hair}" opacity=".85"/>`);
  /* шлем */
  let helmG = '';
  if (hm) {
    const fill = visMetal(hm.kind), soft = hm.kind === 'c';
    if (soft) helmG = `<path class="vl helm" d="M37,30 Q50,12 63,30 L60,36 Q50,32 40,36 Z" fill="${visCloth('c')}" stroke="#2a2038" stroke-width="1" ${visTint(hm)}/><path d="M36,30 Q50,38 64,30" fill="${visCloth('c')}" opacity=".9"/>`;
    else helmG = `<path class="vl helm" d="M36,32 Q38,14 50,12 Q62,14 64,32 L60,36 Q50,30 40,36 Z" fill="${fill}" stroke="#2a3038" stroke-width="1.2" ${visTint(hm)}/>
      <rect x="46" y="20" width="8" height="4" rx="1" fill="#0003"/>${hm.kind === 'h' ? `<path d="M42,14 L40,6 M58,14 L60,6" stroke="${fill}" stroke-width="2"/>` : ''}`;
  }
  const face = `<g class="vl head">
    <circle cx="50" cy="30" r="${headR}" fill="url(#sk)" stroke="#0003" stroke-width=".7"/>
    <ellipse cx="46" cy="28" rx="4" ry="3" fill="#fff3"/>
    ${ear}${hairG}${helmG}${beard}
    <ellipse cx="45" cy="29.2" rx="2.1" ry="2.3" fill="#fff"/><ellipse cx="55" cy="29.2" rx="2.1" ry="2.3" fill="#fff"/>
    <circle cx="45.3" cy="29.4" r="1.35" fill="${eye}"/><circle cx="55.3" cy="29.4" r="1.35" fill="${eye}"/>
    <circle cx="45.7" cy="28.9" r=".45" fill="#fff"/><circle cx="55.7" cy="28.9" r=".45" fill="#fff"/>
    <path d="M46.5,36.2 Q50,39.5 53.5,36.2" fill="none" stroke="#0005" stroke-width="1.1" stroke-linecap="round"/>
    <ellipse cx="50" cy="33" rx="3.5" ry="1.6" fill="#0001"/>
  </g>`;
  /* руки + перчатки */
  const handC = gl ? visMetal(gl.kind) : skin;
  const armFill = ar ? visCloth(ar.kind) : 'url(#sk)';
  const arms = `<g class="vl arms">
    <path class="armL" d="M40,50 L28,66 L30,70 L42,56 Z" fill="${armFill}" stroke="#0003" stroke-width=".5"/>
    <path class="armR" d="M60,50 L72,66 L70,70 L58,56 Z" fill="${armFill}" stroke="#0003" stroke-width=".5"/>
    <circle class="vl gloves handL" cx="28" cy="70" r="4.4" fill="${gl ? handC : 'url(#sk)'}" stroke="#0003" stroke-width=".4" ${gl ? visTint(gl) : ''}/>
    <circle class="vl gloves handR" cx="72" cy="70" r="4.4" fill="${gl ? handC : 'url(#sk)'}" stroke="#0003" stroke-width=".4" ${gl ? visTint(gl) : ''}/>
  </g>`;
  /* оружие / щит — слои поверх рук */
  const weapG = w ? `<g class="vl weapon" ${visTint(w)}>${visWeaponPath(w.cat || 'sword', 74, 62)}</g>` : '';
  const offG = oh ? (oh.slot === 'weapon' || oh.cat ? `<g class="vl offhand" ${visTint(oh)}>${visWeaponPath(oh.cat || 'dagger', 24, 64)}</g>`
    : `<g class="vl offhand" ${visTint(oh)}>${visShield(24, 64, oh.kind)}</g>`)
    : (h2 ? '' : '');
  /* амулет и кольца — мелкие акценты */
  const amG = am ? `<g class="vl amulet" ${visTint(am)}><line x1="50" y1="42" x2="50" y2="52" stroke="#d4b060" stroke-width="1.2"/><circle cx="50" cy="54" r="3.2" fill="${RARITY[am.rar] ? RARITY[am.rar].c : '#d4b060'}" stroke="#2a2010" stroke-width=".6"/></g>` : '';
  const ringG = `${r1 ? `<circle class="vl ring" cx="74" cy="70" r="2.2" fill="none" stroke="${RARITY[r1.rar].c}" stroke-width="1.4" ${visTint(r1)}/>` : ''}
    ${r2 ? `<circle class="vl ring2" cx="26" cy="70" r="2.2" fill="none" stroke="${RARITY[r2.rar].c}" stroke-width="1.4" ${visTint(r2)}/>` : ''}`;
  /* легендарное / эпическое свечение за спиной */
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

/* Простой силуэт врага для prefight / vs */
function visFoeSVG(f, opt) {
  opt = opt || {};
  const boss = f && (f.kind === 'boss' || f.boss);
  const elite = f && (f.kind === 'elite' || f.elite);
  const fill = boss ? '#6a2030' : elite ? '#4a3050' : '#3a4050';
  const horn = boss ? `<path d="M38,24 L34,10 L42,26 M62,24 L66,10 L58,26" fill="none" stroke="#c04040" stroke-width="2.5"/>` : '';
  return `<svg class="vis foe ${opt.size || 'md'}" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="50" cy="128" rx="22" ry="4" fill="#0003"/>
    <path d="M40,50 L60,50 L64,90 L50,100 L36,90 Z" fill="${fill}"/>
    <circle cx="50" cy="32" r="14" fill="${fill}"/>${horn}
    <circle cx="44" cy="30" r="2" fill="#e04040"/><circle cx="56" cy="30" r="2" fill="#e04040"/>
    <path d="M42,40 Q50,46 58,40" fill="none" stroke="#0006" stroke-width="1.5"/>
    <path d="M38,55 L24,80 L30,82 L42,60 M62,55 L76,80 L70,82 L58,60" fill="${fill}"/>
  </svg>`;
}

/* Обёртка: кнопка-кукла → лист снаряжения */
function visHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  const pose = opt.pose || visPose(h);
  const label = `${h.name}: ${RACES[h.race].n}-${CLASSES[h.cls].n}, ГС ${gearScore(h)}`;
  const cls = `vwrap ${opt.cls || ''} ${opt.tap === false ? '' : 'vtap'}`;
  const act = opt.tap === false ? '' : ` role="button" tabindex="0" data-act="sheet" aria-label="${esc(label)}. Открыть снаряжение"`;
  return `<div class="${cls}" data-pose="${pose}"${act}>${visSVG(h, opt)}</div>`;
}
function visPairHTML(h, foe, opt) {
  opt = opt || {};
  return `<div class="vpair" aria-hidden="true">${visHTML(h, Object.assign({}, opt, { tap: false, cls: 'me' }))}<span class="vvs">⚔</span>${visFoeSVG(foe, opt)}</div>`;
}

/* Обновить позу куклы в бою без полной перерисовки (дёшево) */
function visApplyFightPose(F, forcePose) {
  if (forcePose) {
    document.querySelectorAll('.vwrap.me .vis, #fightBox .vwrap .vis, #colHero .vis').forEach(el => {
      el.classList.remove('p-idle', 'p-walk', 'p-attack', 'p-block', 'p-hurt', 'p-dead');
      el.classList.add('p-' + forcePose);
    });
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
  document.querySelectorAll('.vwrap.me .vis, #fightBox .vwrap .vis, #colHero .vis').forEach(el => {
    el.classList.remove('p-idle', 'p-walk', 'p-attack', 'p-block', 'p-hurt', 'p-dead');
    el.classList.add('p-' + pose);
  });
  if (pose === 'attack' || pose === 'hurt') {
    setTimeout(() => {
      document.querySelectorAll('.vis.p-attack, .vis.p-hurt').forEach(el => {
        if (!S.fight) return;
        el.classList.remove('p-attack', 'p-hurt');
        el.classList.add(S.hero.state === 'road' ? 'p-walk' : 'p-idle');
      });
    }, 480);
  }
  return pose;
}


/* =====================================================================
   5г) Живая сцена: местность + кукла героя (биомы ↔ регион / состояние)
   ===================================================================== */
/* Биом из региона Olympus (k) + особые состояния героя */
const SCN_BIOME = {
  city: 'city', village: 'village', forest: 'forest', swamp: 'swamp',
  mount: 'mount', valley: 'valley', field: 'field', castle: 'castle',
  coast: 'coast', waste: 'waste', ravine: 'ravine'
};
const SCN_RU = {
  city: 'Город', village: 'Деревня', forest: 'Лес', swamp: 'Болото',
  mount: 'Горы', valley: 'Долина', field: 'Поля', castle: 'Замок',
  coast: 'Берег', waste: 'Пустошь', ravine: 'Овраг', dungeon: 'Пещера',
  arena: 'Арена', camp: 'Лагерь', road: 'Дорога'
};

function scnBiome(h) {
  h = h || (S && S.hero);
  if (!h) return 'forest';
  if (S.dun || h.state === 'dungeon') return 'dungeon';
  if (S.fight && (S.fight.kind === 'duel' || S.fight.kind === 'godduel' || S.fight.kind === 'group')) return 'arena';
  if (h.state === 'rest' && h.restKind === 'camp') return 'camp';
  const R0 = S.oly && REG_BY[h.reg] ? REG_BY[h.reg] : null;
  if (R0 && SCN_BIOME[R0.k]) return SCN_BIOME[R0.k];
  /* fallback по строке локации */
  const L = (h.loc || '').toLowerCase();
  if (/пещер|подзем/.test(L)) return 'dungeon';
  if (/болот|туман/.test(L)) return 'swamp';
  if (/лес/.test(L)) return 'forest';
  if (/берег|моря|русалок/.test(L)) return 'coast';
  if (/гор|перевал/.test(L)) return 'mount';
  if (/город|годград|понты/.test(L)) return 'city';
  if (/замок/.test(L)) return 'castle';
  if (/долин/.test(L)) return 'valley';
  if (/капуст|пол/.test(L)) return 'field';
  if (/овраг/.test(L)) return 'ravine';
  if (/пустош/.test(L)) return 'waste';
  if (/пинк|деревн/.test(L)) return 'village';
  return h.state === 'town' ? 'city' : 'forest';
}
function scnTod() {
  const hr = (typeof momClock === 'number' ? (momClock / 3600) : (Date.now() / 3600e3)) % 24;
  if (hr < 5 || hr >= 21) return 'night';
  if (hr < 8 || hr >= 18) return 'dusk';
  return 'day';
}
function scnMode(h) {
  h = h || S.hero;
  if (S.fight) return 'fight';
  if (h.state === 'road') return 'walk';
  if (h.state === 'dead') return 'dead';
  if (h.state === 'rest') return 'rest';
  return 'idle';
}
function scnLabel(h) {
  h = h || S.hero;
  const R0 = S.oly && REG_BY[h.reg] ? REG_BY[h.reg] : null;
  const place = R0 ? R0.n : (h.loc || 'Дорога');
  let st = 'на месте';
  if (S.fight) st = 'бой';
  else if (S.dun || h.state === 'dungeon') st = 'в пещере';
  else if (h.state === 'road') st = 'в пути';
  else if (h.state === 'town') st = 'в городе';
  else if (h.state === 'rest') st = h.restKind === 'camp' ? 'лагерь' : 'отдых';
  else if (h.state === 'dead') st = 'мертв';
  else if (h.state === 'duel') st = 'дуэль';
  return `${place} · ${st}`;
}

/* ---------- SVG-слои биомов (компактные, без PNG) ---------- */
function scnSkySVG(biome, tod) {
  const sun = tod === 'night' ? '' : tod === 'dusk'
    ? `<circle class="scn-sun" cx="210" cy="36" r="14" fill="#e89050" opacity=".9"/>`
    : `<circle class="scn-sun" cx="230" cy="28" r="12" fill="#ffe08a"/><circle cx="230" cy="28" r="18" fill="#ffe08a" opacity=".25"/>`;
  const moon = tod === 'night' || tod === 'dusk'
    ? `<circle class="scn-moon" cx="40" cy="30" r="10" fill="#e8eef8"/><circle cx="44" cy="28" r="9" fill="currentColor" class="scn-moongap" opacity=".55"/>`
    : '';
  const stars = tod === 'night'
    ? `<g class="scn-stars" fill="#fff" opacity=".85"><circle cx="70" cy="18" r="1.2"/><circle cx="110" cy="28" r="1"/><circle cx="150" cy="14" r="1.4"/><circle cx="190" cy="22" r="1"/><circle cx="250" cy="16" r="1.2"/><circle cx="280" cy="32" r="1"/></g>`
    : '';
  if (biome === 'dungeon') {
    return `<svg class="scn-layer scn-sky" viewBox="0 0 320 160" preserveAspectRatio="none" aria-hidden="true">
      <rect width="320" height="160" fill="#1a1428"/>
      <ellipse cx="160" cy="20" rx="40" ry="12" fill="#3a3050" opacity=".4"/>
    </svg>`;
  }
  return `<svg class="scn-layer scn-sky" viewBox="0 0 320 160" preserveAspectRatio="none" aria-hidden="true">
    <rect class="scn-skyfill" width="320" height="160" fill="currentColor"/>
    ${sun}${moon}${stars}
    <g class="scn-clouds" fill="#fff" opacity="${tod === 'night' ? .08 : tod === 'dusk' ? .2 : .35}">
      <ellipse cx="60" cy="40" rx="28" ry="10"/><ellipse cx="80" cy="40" rx="18" ry="8"/>
      <ellipse cx="180" cy="28" rx="32" ry="11"/><ellipse cx="205" cy="28" rx="16" ry="7"/>
    </g>
  </svg>`;
}
function scnFarSVG(biome) {
  /* дальние силуэты — сдвиг при walk */
  let shapes = '';
  if (biome === 'forest' || biome === 'valley') {
    shapes = `<g fill="#2a4a30"><path d="M0,110 L20,60 L40,110 Z"/><path d="M30,110 L55,40 L80,110 Z"/><path d="M70,110 L95,55 L120,110 Z"/><path d="M110,110 L140,35 L170,110 Z"/><path d="M160,110 L185,50 L210,110 Z"/><path d="M200,110 L230,42 L260,110 Z"/><path d="M250,110 L280,58 L310,110 Z"/><path d="M290,110 L320,48 L340,110 Z"/></g>`;
  } else if (biome === 'mount' || biome === 'ravine') {
    shapes = `<g fill="#4a5060"><path d="M-20,120 L40,30 L100,120 Z"/><path d="M70,120 L140,20 L210,120 Z" fill="#3a4050"/><path d="M180,120 L250,40 L320,120 Z"/><path d="M280,120 L340,50 L380,120 Z" fill="#505868"/><path d="M100,55 L140,20 L155,55" fill="#e8eef4" opacity=".55"/></g>`;
  } else if (biome === 'swamp') {
    shapes = `<g fill="#3a5040" opacity=".7"><path d="M10,100 Q40,70 70,100"/><path d="M50,105 Q90,60 130,105"/><path d="M120,100 Q160,55 200,100"/><path d="M190,105 Q230,65 270,105"/><path d="M250,100 Q290,70 330,100"/><circle cx="80" cy="88" r="3" fill="#6a8a40"/><circle cx="180" cy="82" r="2.5" fill="#6a8a40"/></g>`;
  } else if (biome === 'coast') {
    shapes = `<g fill="#4a7088"><path d="M0,90 Q40,70 80,88 T160,90 T240,86 T320,90 L320,120 L0,120 Z"/><path d="M0,100 Q50,85 100,100 T200,98 T320,100" fill="#5a88a0" opacity=".5"/></g>`;
  } else if (biome === 'city' || biome === 'village' || biome === 'castle') {
    const tall = biome === 'castle';
    shapes = `<g fill="#3a3548">${tall
      ? `<path d="M40,120 L40,35 L55,20 L70,35 L70,120 Z"/><path d="M55,20 L55,8"/><rect x="100" y="50" width="50" height="70"/><rect x="170" y="40" width="40" height="80"/><path d="M230,120 L230,30 L250,15 L270,30 L270,120 Z"/>`
      : `<rect x="20" y="55" width="36" height="65"/><polygon points="20,55 38,35 56,55"/><rect x="70" y="45" width="44" height="75"/><polygon points="70,45 92,22 114,45"/><rect x="130" y="60" width="30" height="60"/><rect x="175" y="40" width="55" height="80"/><polygon points="175,40 202,18 230,40"/><rect x="250" y="55" width="40" height="65"/><polygon points="250,55 270,38 290,55"/>`}</g>`;
  } else if (biome === 'waste') {
    shapes = `<g fill="#6a5848"><path d="M0,110 L30,90 L60,110 L100,85 L140,110 L180,88 L220,110 L260,80 L300,110 L340,95 L340,130 L0,130 Z"/><circle cx="90" cy="95" r="4" fill="#8a7058"/><circle cx="210" cy="92" r="5" fill="#8a7058"/></g>`;
  } else if (biome === 'field') {
    shapes = `<g fill="#6a9a40" opacity=".55"><path d="M0,100 Q80,85 160,100 T320,100 L320,120 L0,120 Z"/><path d="M20,95 L25,70 M40,98 L44,68 M60,96 L66,72 M90,94 L95,65 M120,97 L124,70" stroke="#5a8030" stroke-width="2"/></g>`;
  } else if (biome === 'dungeon') {
    shapes = `<g fill="#2a2038"><rect x="0" y="0" width="50" height="160"/><rect x="270" y="0" width="50" height="160"/><path d="M50,0 L50,160 M270,0 L270,160" stroke="#1a1020" stroke-width="4"/><ellipse cx="160" cy="40" rx="30" ry="8" fill="#c8a040" opacity=".15"/></g>`;
  } else if (biome === 'arena') {
    shapes = `<g fill="#5a4030"><path d="M20,40 L300,40 L280,120 L40,120 Z" opacity=".35"/><path d="M40,50 L280,50" stroke="#8a6a40" stroke-width="2"/><circle cx="160" cy="90" r="50" fill="none" stroke="#8a6a40" stroke-width="3" opacity=".5"/></g>`;
  } else {
    shapes = `<g fill="#3a5540"><path d="M0,110 L40,70 L80,110 L120,60 L160,110 L200,65 L240,110 L280,55 L320,110 L360,70 L360,130 L0,130 Z"/></g>`;
  }
  return `<svg class="scn-layer scn-far" viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g class="scn-parallax" data-spd="0.3">${shapes}</g></svg>`;
}
function scnMidSVG(biome) {
  let shapes = '';
  if (biome === 'forest') {
    shapes = `<g class="scn-trees">
      <g transform="translate(30,0)"><rect x="14" y="90" width="6" height="40" fill="#5a3a20"/><path d="M17,50 L0,95 L34,95 Z" fill="#2e6a38"/><path d="M17,65 L4,100 L30,100 Z" fill="#3a8048"/></g>
      <g transform="translate(90,0)"><rect x="16" y="85" width="7" height="45" fill="#5a3a20"/><path d="M19,40 L-5,100 L43,100 Z" fill="#246030"/><path d="M19,58 L2,102 L36,102 Z" fill="#358040"/></g>
      <g transform="translate(200,0)"><rect x="14" y="88" width="6" height="42" fill="#5a3a20"/><path d="M17,48 L-2,98 L36,98 Z" fill="#2a6838"/></g>
      <g transform="translate(260,0)"><rect x="12" y="95" width="5" height="35" fill="#5a3a20"/><path d="M14,60 L0,105 L28,105 Z" fill="#3a7840"/></g>
    </g>`;
  } else if (biome === 'swamp') {
    shapes = `<g><ellipse cx="60" cy="130" rx="40" ry="8" fill="#2a4838" opacity=".5"/><ellipse cx="180" cy="135" rx="55" ry="10" fill="#2a4838" opacity=".45"/>
      <path d="M40,120 Q45,90 50,120" stroke="#4a6840" stroke-width="3" fill="none"/><path d="M140,125 Q148,85 155,125" stroke="#4a6840" stroke-width="3" fill="none"/>
      <circle cx="100" cy="118" r="4" fill="#6a9050" opacity=".6"/><circle cx="220" cy="122" r="5" fill="#6a9050" opacity=".5"/>
      <circle cx="70" cy="128" r="2" fill="#a0d060" class="scn-bub"/><circle cx="200" cy="132" r="1.5" fill="#a0d060" class="scn-bub"/></g>`;
  } else if (biome === 'coast') {
    shapes = `<g><path d="M0,115 Q40,105 80,115 T160,112 T240,118 T320,114 L320,160 L0,160 Z" fill="#d8c090"/>
      <path d="M0,108 Q50,100 100,110 T220,108 T320,112" fill="#6ab0c8" opacity=".55" class="scn-wave"/>
      <path d="M0,100 Q60,92 120,102 T260,98 T320,104" fill="#5a9cb8" opacity=".35" class="scn-wave2"/>
      <g fill="#2a6a40"><path d="M250,100 L255,70 L260,100 Z"/><path d="M270,105 L278,60 L286,105 Z"/></g></g>`;
  } else if (biome === 'city' || biome === 'village') {
    shapes = `<g fill="#6a5a48"><rect x="25" y="95" width="22" height="35" rx="1"/><rect x="70" y="88" width="28" height="42"/><rect x="130" y="100" width="18" height="30"/>
      <rect x="200" y="90" width="32" height="40"/><rect x="260" y="98" width="24" height="32"/>
      <g fill="#c8a050" opacity=".7"><rect x="30" y="105" width="5" height="6"/><rect x="78" y="100" width="5" height="6"/><rect x="210" y="102" width="5" height="6"/></g>
      <path d="M0,130 L320,130" stroke="#5a4a40" stroke-width="2" opacity=".4"/></g>`;
  } else if (biome === 'castle') {
    shapes = `<g fill="#4a4858"><rect x="100" y="50" width="120" height="80"/><path d="M100,50 L100,30 L115,30 L115,50 M130,50 L130,25 L145,25 L145,50 M160,50 L160,20 L180,20 L180,50 M195,50 L195,25 L210,25 L210,50"/><rect x="145" y="90" width="30" height="40" fill="#2a2030"/><circle cx="160" cy="70" r="8" fill="#c8a040" opacity=".25"/></g>`;
  } else if (biome === 'mount') {
    shapes = `<g fill="#6a7080"><path d="M-10,140 L50,70 L110,140 Z"/><path d="M80,140 L160,50 L240,140 Z" fill="#5a6070"/><path d="M200,140 L280,65 L350,140 Z"/><path d="M140,80 L160,50 L175,80" fill="#eef2f8" opacity=".5"/></g>`;
  } else if (biome === 'dungeon') {
    shapes = `<g><rect x="55" y="0" width="210" height="160" fill="#221830"/>
      <path d="M55,0 L55,160 M265,0 L265,160" stroke="#0e0a18" stroke-width="8"/>
      <g stroke="#3a3050" stroke-width="2"><line x1="80" y1="40" x2="240" y2="40"/><line x1="80" y1="80" x2="240" y2="80"/><line x1="80" y1="120" x2="240" y2="120"/></g>
      <ellipse cx="160" cy="50" rx="18" ry="6" fill="#e8c060" opacity=".2" class="scn-torch"/>
      <rect x="70" y="30" width="6" height="14" fill="#c08030" opacity=".6"/><rect x="244" y="30" width="6" height="14" fill="#c08030" opacity=".6"/></g>`;
  } else if (biome === 'arena') {
    shapes = `<g><ellipse cx="160" cy="130" rx="120" ry="22" fill="#8a6a48"/><ellipse cx="160" cy="128" rx="100" ry="16" fill="#a08058" opacity=".6"/>
      <path d="M40,100 L60,40 L80,100 M240,100 L260,40 L280,100" fill="#6a5040" opacity=".5"/></g>`;
  } else if (biome === 'field' || biome === 'valley') {
    shapes = `<g><path d="M0,120 Q80,110 160,122 T320,118 L320,160 L0,160 Z" fill="${biome === 'valley' ? '#5a8a48' : '#7aaa40'}"/>
      <g stroke="#c8b050" stroke-width="1.5" opacity=".5"><path d="M20,125 L20,145 M40,123 L40,148 M60,126 L60,146 M100,124 L100,150 M140,125 L140,148 M180,123 L180,150 M220,126 L220,147 M260,124 L260,149 M300,125 L300,148"/></g></g>`;
  } else if (biome === 'waste') {
    shapes = `<g fill="#8a7060"><ellipse cx="80" cy="125" rx="30" ry="8"/><ellipse cx="200" cy="130" rx="40" ry="9"/><path d="M120,120 L125,90 L130,120" stroke="#6a5040" stroke-width="3"/><circle cx="250" cy="118" r="6" fill="#9a8070"/></g>`;
  } else if (biome === 'ravine') {
    shapes = `<g fill="#3a3848"><path d="M0,60 L80,140 L0,160 Z"/><path d="M320,55 L240,140 L320,160 Z"/><path d="M90,140 Q160,150 230,140 L230,160 L90,160 Z" fill="#4a4858"/></g>`;
  } else if (biome === 'camp') {
    shapes = `<g><path d="M120,130 L160,70 L200,130 Z" fill="#6a4a30"/><path d="M160,70 L160,130" stroke="#3a2818" stroke-width="2"/>
      <circle cx="100" cy="128" r="8" fill="#e07030" class="scn-fire"/><circle cx="100" cy="124" r="4" fill="#f0c040" class="scn-fire"/></g>`;
  } else {
    shapes = `<g fill="#4a6840"><path d="M0,120 L320,120 L320,160 L0,160 Z"/></g>`;
  }
  return `<svg class="scn-layer scn-mid" viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g class="scn-parallax" data-spd="0.6">${shapes}</g></svg>`;
}
function scnGroundSVG(biome) {
  let fill = '#3a5a38', stripe = '#2a4a28';
  if (biome === 'city' || biome === 'village' || biome === 'castle' || biome === 'arena') { fill = '#6a5a50'; stripe = '#5a4a40'; }
  else if (biome === 'swamp') { fill = '#2a4030'; stripe = '#1a3020'; }
  else if (biome === 'coast') { fill = '#c8b078'; stripe = '#b0a068'; }
  else if (biome === 'mount' || biome === 'ravine' || biome === 'waste') { fill = '#6a6870'; stripe = '#5a5860'; }
  else if (biome === 'dungeon') { fill = '#1a1424'; stripe = '#120e1c'; }
  else if (biome === 'field' || biome === 'valley') { fill = '#5a8a38'; stripe = '#4a7a28'; }
  const path = biome === 'dungeon'
    ? `<rect y="120" width="640" height="40" fill="${fill}"/><g stroke="${stripe}" stroke-width="2"><line x1="0" y1="130" x2="640" y2="130"/><line x1="0" y1="145" x2="640" y2="145"/></g>`
    : `<path d="M0,125 L640,125 L640,160 L0,160 Z" fill="${fill}"/>
       <g stroke="${stripe}" stroke-width="1.5" opacity=".5"><path d="M0,135 Q40,132 80,136 T160,134 T240,137 T320,133 T400,136 T480,134 T560,137 T640,135"/><path d="M0,148 Q50,145 100,149 T200,147 T320,150 T440,146 T560,149 T640,147"/></g>`;
  return `<svg class="scn-layer scn-ground" viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g class="scn-parallax scn-tile" data-spd="1">${path}</g></svg>`;
}

function scnHTML(h, opt) {
  opt = opt || {};
  h = h || S.hero;
  const biome = opt.biome || scnBiome(h);
  const tod = opt.tod || scnTod();
  const mode = opt.mode || scnMode(h);
  const label = opt.label || scnLabel(h);
  const walk = mode === 'walk';
  const pose = walk ? 'walk' : mode === 'dead' ? 'dead' : mode === 'rest' ? 'idle' : (mode === 'fight' ? 'idle' : 'idle');
  const doll = visHTML(h, { size: opt.size || 'md', pose, tap: false, cls: 'scn-doll' });
  const cls = `scn scn-${biome} scn-${tod}${walk ? ' scn-walk' : ''}${mode === 'fight' ? ' scn-fight' : ''}${opt.cls ? ' ' + opt.cls : ''}`;
  return `<div class="${cls}" data-biome="${biome}" data-tod="${tod}" data-mode="${mode}" role="button" tabindex="0" data-act="sheet" aria-label="${esc(label)}. Открыть снаряжение">
    <div class="scn-bg">${scnSkySVG(biome, tod)}${scnFarSVG(biome)}${scnMidSVG(biome)}${scnGroundSVG(biome)}</div>
    <div class="scn-stage">${doll}</div>
    <div class="scn-label"><span class="scn-ic">${(REG_BY[h.reg] && REG_BY[h.reg].ic) || '📍'}</span> ${esc(label)}</div>
  </div>`;
}
/* Фон боя: тот же биом, без куклы (куклы уже в vpair) */
function scnFightWrap(inner, h) {
  const biome = scnBiome(h || S.hero);
  const tod = scnTod();
  return `<div class="scn scn-${biome} scn-${tod} scn-fight scn-mini" data-biome="${biome}" aria-hidden="true">
    <div class="scn-bg">${scnSkySVG(biome, tod)}${scnFarSVG(biome)}${scnMidSVG(biome)}${scnGroundSVG(biome)}</div>
    <div class="scn-stage scn-stage-fight">${inner}</div>
  </div>`;
}


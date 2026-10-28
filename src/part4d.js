
/* =====================================================================
   v11: звуки (WebAudio, без файлов), анимации сил и боя, сводка «Пока вас не было»
   ===================================================================== */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Звук выключен по умолчанию; AudioContext создаётся только после жеста пользователя и только если звук включён */
let audioCtx = null, userGestured = false;
function sndUnlock() {
  userGestured = true;
  if (!S || !S.ui || !S.ui.snd) return;
  try { if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; }
}
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { userGestured = true; }, { capture: true, passive: true });
const SFX = {
  power: [[660, .07, 'triangle'], [880, .09, 'triangle'], [1320, .14, 'sine']],
  hint: [[520, .06, 'sine'], [780, .1, 'sine']],
  hit: [[140, .09, 'square', .05]], crit: [[220, .05, 'sawtooth', .06], [110, .14, 'square', .06]],
  blk: [[900, .04, 'square', .03]], level: [[523, .1, 'triangle'], [659, .1, 'triangle'], [784, .1, 'triangle'], [1047, .22, 'triangle']],
  death: [[220, .2, 'sine'], [165, .3, 'sine']], rare: [[988, .08, 'sine'], [1319, .16, 'sine']], bell: [[784, .12, 'sine'], [1175, .28, 'sine']]
};
let sfxLast = 0;
function sfx(name) {
  if (!S || !S.ui || !S.ui.snd || !userGestured || SILENT) return;
  const seq = SFX[name]; if (!seq) return;
  const now0 = performance.now(); if (now0 - sfxLast < 60) return; sfxLast = now0;
  try {
    sndUnlock(); const A = audioCtx; if (!A || A.state !== 'running') return;
    let t = A.currentTime + .01;
    for (const [f, d, type, vol] of seq) {
      const o = A.createOscillator(), g = A.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .08, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + d + .02); t += d * .8;
    }
  } catch (e) { }
}
/* ---------- слой эффектов поверх страницы ---------- */
function fxEl(cls, html, x, y) {
  const L = $('fxLayer'); if (!L) return null;
  const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html;
  if (x !== undefined) { e.style.left = x + 'px'; e.style.top = y + 'px'; }
  L.appendChild(e); while (L.children.length > 30) L.firstChild.remove();
  setTimeout(() => e.remove(), 1500); return e;
}
function flashRect(r, cls) {
  if (reducedMotion() || !r) return;
  const e = fxEl('fflash ' + cls); if (!e) return;
  Object.assign(e.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
function floatText(x, y, txt, cls) { fxEl('ftx ' + cls, esc(txt), x, y); }
/* Сила: вспышка + иконка летит в дневник (или на «Герой» в нижнем меню, если дневник скрыт) */
function powerFx(id, from) {
  sfx('power');
  const p = POWERS[id]; if (!p) return;
  const vw = innerWidth, vh = innerHeight;
  flashRect({ left: 0, top: 0, width: vw, height: vh }, p.br + ' screen');
  if (reducedMotion()) return;
  const d = $('diary'), dr = d && d.offsetParent ? d.getBoundingClientRect() : null;
  const tgt = dr && dr.top < vh && dr.bottom > 0 ? { x: dr.left + 40, y: Math.max(dr.top + 20, 80) } : (() => { const hb = document.querySelector('#mnav button[data-arg=hero]'); const r = hb ? hb.getBoundingClientRect() : { left: vw / 2, top: vh - 40, width: 0, height: 0 }; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
  const sx = from ? from.left + from.width / 2 : vw / 2, sy = from ? from.top + from.height / 2 : vh / 2;
  const e = fxEl('fly', p.ic, sx, sy); if (!e) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { e.style.left = tgt.x + 'px'; e.style.top = tgt.y + 'px'; e.style.opacity = '.2'; e.style.transform = 'translate(-50%,-50%) scale(.5)'; }));
  setTimeout(() => { const n = d && d.firstChild; if (n) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); } }, 760);
}
/* Бой: после каждого хода — вспышка и всплывающие «Крит!», «Блок», «Уворот», «−12» над полосками здоровья */
let fxSeenFight = null, fxSeenN = 0;
function fightFx(F) {
  if (!F) return;
  if (fxSeenFight !== F.id) { fxSeenFight = F.id; fxSeenN = F.fx ? F.fx.n : 0; return; }
  if (!F.fx) return;   // старые ходы (после загрузки) не показываем
  if (F.fx.n === fxSeenN) return; fxSeenN = F.fx.n;
  const me = fMe(F), by = {};
  for (const a of F.fx.a) (by[a.id] = by[a.id] || []).push(a);
  let meHit = 0, crit = 0, blk = 0;
  for (const id in by) {
    const el = document.querySelector(`#fightBox [data-fid="${CSS.escape(id)}"]`); if (!el) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    by[id].slice(0, 4).forEach((a, k) => {
      const t = a.k === 'crit' ? `Крит! −${a.v}` : a.k === 'blk' ? 'Блок' : a.k === 'dodge' ? 'Уворот' : a.k === 'heal' ? 'Лечение' : `−${a.v}`;
      const cls = a.k === 'crit' ? 'crit' : a.k === 'blk' ? 'blk' : a.k === 'dodge' ? 'dodge' : a.k === 'heal' ? 'heal' : 'hit';
      setTimeout(() => floatText(r.left + r.width / 2 + (k % 2 ? 26 : -26) * (k > 0), r.top + r.height / 2 - k * 6, t, cls), k * 220);
      if (me && id === me.id && a.v > 0) meHit += a.v; if (a.k === 'crit') crit++; if (a.k === 'blk' || a.k === 'dodge') blk++;
    });
  }
  const card = document.querySelector('#fightBox .card');
  if (card) flashRect(card.getBoundingClientRect(), meHit ? 'hit' : 'good');
  sfx(crit ? 'crit' : meHit ? 'hit' : blk ? 'blk' : 'hit');
  /* поза куклы: удар / блок / боль */
  if (typeof visApplyFightPose === 'function') {
    const dealt = F.fx.a.some(a => me && a.id !== me.id && a.v > 0);
    const pose = meHit ? 'hurt' : dealt ? 'attack' : blk ? 'block' : 'idle';
    document.querySelectorAll('#fightBox .vwrap, #colHero .vwrap.painted, #colHero .scn-doll').forEach(el => {
      if (typeof visSetPoseOn === 'function') visSetPoseOn(el, pose);
      else {
        el.setAttribute('data-pose', pose);
        el.querySelectorAll('.vis').forEach(v => {
          v.classList.remove('p-idle', 'p-walk', 'p-attack', 'p-block', 'p-hurt', 'p-dead');
          v.classList.add('p-' + pose);
        });
      }
    });
    if (pose === 'attack' && typeof scnFightSlash === 'function') scnFightSlash(F);
    if (meHit || dealt) setTimeout(() => { if (S && S.fight) visApplyFightPose(S.fight); }, 500);
  }

  try { if (typeof rhudFightFx === 'function') rhudFightFx(F); } catch (err) {}
}
/* ---------- Сводка «Пока вас не было» — отдельная карточка при входе ---------- */
function awayModal() {
  const a = lastAway; if (!a || !S) return;
  const sg = v => (v >= 0 ? '+' : '') + v, mf = maxFaith();
  const tiles = [['⚔', 'побед в боях', a.wins, a.wins ? 'good' : ''], ['💀', 'смертей', a.deaths, a.deaths ? 'bad' : ''], ['📌', 'заданий', a.quests, a.quests ? 'good' : ''], ['🙏', 'развилок решил сам', a.forks, ''],
    ['💰', 'золото', sg(a.gold), a.gold >= 0 ? 'good' : 'bad'], ['👥', 'паства', sg(a.fol), a.fol >= 0 ? 'good' : 'bad']];
  modal(`<div class="away"><h2>🌙 Пока вас не было</h2><div class="awsub">${fmtDur(a.sec)}${a.slept ? ', дальше герой спал' : ''}${a.why ? ' — ' + esc(a.why) : ''}. ${esc(S.hero.name)} жил сам и вёл дневник.</div>
    ${a.l1 > a.l0 ? `<div class="fhint" style="background:#eaf8e2;border-color:#9fd08a;color:#2f6b20">⭐ Уровень героя: ${a.l0} → ${a.l1}!</div>` : ''}
    <div class="awgrid">${tiles.map(t => `<div class="awt ${t[3]}"><b>${t[0]} ${t[2]}</b>${t[1]}</div>`).join('')}</div>
    <div class="stat"><label><span>🔥 Вера: ${a.fa0} → ${a.fa1}</span><span>${a.fa1}/${mf}</span></label>${bar('faith', a.fa1, mf)}</div>
    ${a.items.length ? `<div class="muted" style="margin-top:6px">💎 Ценные находки: ${a.items.map(esc).join(', ')}</div>` : ''}
    ${a.hl.length ? `<h3 style="margin-top:10px">Главное из дневника</h3><ul class="awhl">${a.hl.map(e => `<li>${D_IC[e.c] ? D_IC[e.c] + ' ' : ''}${esc(e.x)}</li>`).join('')}</ul>` : ''}
    ${awayOlyHTML(a.oly)}
    <div class="btns"><button class="btn green mcbig" data-act="awayOk">Продолжить ▶</button></div></div>`, { noBar: 1 });
}


/* =====================================================================
   10) ПРИЛОЖЕНИЕ (PWA): установка, обновления, перенос сохранений
   ===================================================================== */
const APP_BUILD = '__BUILD__';
const IS_HTTP = /^https?:$/.test(location.protocol);
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
let swReg = null, waitingSW = null, installEvt = null, updating = false, updFallback = null;
const PWA = { get waiting() { return !!waitingSW; }, get build() { return APP_BUILD; }, get reg() { return swReg; }, get installable() { return !!installEvt; }, updateShown: false };
function showUpdateBar() { PWA.updateShown = true; const b = $('updBar'); if (b) b.classList.add('on'); }
function calmMoment() { return !S || (!S.fork && !S.fight && !S.dun && !(S.arena && S.arena.apps.some(a => a.joined !== null)) && !(S.ev && S.ev.phase === 'live') && !S.featOffer); }
function applyUpdate() {
  if (S) save();
  if (waitingSW) { updating = true; waitingSW.postMessage({ type: 'SKIP_WAITING' }); setTimeout(() => location.reload(), 3000); }
  else location.reload();
}
function onWaiting(w) { waitingSW = w; showUpdateBar(); if (updFallback) { clearTimeout(updFallback); updFallback = null; } }
async function checkUpdate() {
  if (!IS_HTTP) return;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json();
    if (j.build && j.build !== APP_BUILD) {
      if (swReg) await swReg.update();
      if (!waitingSW && !updFallback) updFallback = setTimeout(() => { if (!waitingSW) showUpdateBar(); }, 15000);
    }
  } catch (e) { }
}
if (IS_HTTP && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating || hadController) { if (S) save(); location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) onWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) onWaiting(w); }); });
    setTimeout(checkUpdate, 3000);
  }).catch(e => console.warn('SW не зарегистрирован', e));
  setInterval(checkUpdate, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkUpdate();
    else if (waitingSW && calmMoment()) applyUpdate(); // свернули приложение — тихо обновляемся
  });
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  if (S && !localStorage.getItem('bogodel_install_hint')) { localStorage.setItem('bogodel_install_hint', '1'); toast('📲 БогоДел можно установить как приложение: ⚙ Настройки → «Установить».'); }
});
window.addEventListener('appinstalled', () => { installEvt = null; toast('📲 Установлено! Ищите ⚜ на экране.'); });
function pwaSettingsHTML() {
  let inst;
  if (IS_STANDALONE) inst = '<div class="pwaNote">✅ Игра запущена как приложение. Обновления приходят сами.</div>';
  else if (installEvt) inst = '<div class="btns"><button class="btn green" data-act="install">📲 Установить приложение</button></div>';
  else if (IS_IOS) inst = '<div class="pwaNote">На iPhone/iPad: откройте сайт в Safari → кнопка «Поделиться» (□↑) → «На экран „Домой“».</div>';
  else if (IS_HTTP) inst = '<div class="pwaNote">Если кнопки нет: в Chrome/Edge — меню ⋮ → «Установить приложение» (или значок установки в адресной строке). На iPhone — «Поделиться» → «На экран „Домой“».</div>';
  else inst = '<div class="pwaNote">Это локальный файл. Установить игру можно с сайта; прогресс перенесите через экспорт/импорт ниже.</div>';
  return `<h3 style="margin-top:14px">📲 Приложение</h3>${inst}
  <div class="pwaNote">Версия: ${APP_BUILD === 'local' ? 'локальная' : esc(APP_BUILD)}${PWA.updateShown ? ' · <b>есть обновление</b> <button class="btn small" data-act="applyUpdate">Обновить</button>' : ''}</div>
  <h3 style="margin-top:14px">💾 Перенос сохранения</h3>
  <div class="pwaNote">Экспорт даёт код (или файл) с вашим миром; импорт в другой копии игры (сайт, приложение, другой браузер) восстановит прогресс.</div>
  <div class="btns"><button class="btn small" data-act="exportSave">📤 Экспорт сохранения</button><button class="btn small" data-act="importSave">📥 Импорт сохранения</button></div>`;
}
function exportText() { save(); return JSON.stringify(S); }
function exportModal() {
  modal(`<h2>📤 Экспорт сохранения</h2>
  <div class="pwaNote">Скопируйте этот код или скачайте файл, затем откройте игру в нужном месте: ⚙ Настройки → «Импорт сохранения».</div>
  <textarea id="expText" readonly>${esc(exportText())}</textarea>
  <div class="btns"><button class="btn" data-act="copySave">📋 Скопировать</button><button class="btn" data-act="downloadSave">💾 Скачать файл</button><button class="btn" data-act="closeModal">Закрыть</button></div>`);
}
function importModal() {
  modal(`<h2>📥 Импорт сохранения</h2>
  <div class="pwaNote">Вставьте код сохранения или выберите файл .json. <b>Текущий мир будет заменён.</b></div>
  <textarea id="impText" placeholder="Вставьте сюда код сохранения…"></textarea>
  <input type="file" id="impFile" accept=".json,application/json,text/plain">
  <div class="btns"><button class="btn green" data-act="doImport">Загрузить</button><button class="btn" data-act="${S ? 'closeModal' : 'backOnb'}">Отмена</button></div>
  <div class="pwaNote" id="impMsg"></div>`);
  $('impFile').onchange = ev => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('impText').value = String(rd.result || ''); $('impMsg').textContent = `Файл «${f.name}» прочитан — нажмите «Загрузить».`; }; rd.readAsText(f); };
}
/* Проверка и загрузка через ту же миграцию/санацию, что и обычное сохранение */
function parseSave(text) {
  text = String(text || '').trim();
  if (!text) throw new Error('Пусто. Вставьте код сохранения.');
  let o;
  try { o = JSON.parse(text); } catch (e) { try { o = JSON.parse(decodeURIComponent(escape(atob(text)))); } catch (e2) { throw new Error('Это не похоже на код сохранения БогоДела.'); } }
  if (!o || typeof o !== 'object' || !o.god || !o.hero || typeof o.god !== 'object' || typeof o.hero !== 'object') throw new Error('В коде нет бога и героя — это не сохранение БогоДела.');
  const m = migrate(o);
  return sanitize(deepMerge(defaultState(String(m.god.name || 'Бог'), String(m.hero.name || 'Герой'), m.hero.race, m.hero.cls), m));
}
function doImport() {
  const msg = $('impMsg');
  let ns;
  try { ns = parseSave($('impText').value); } catch (e) { msg.textContent = '❌ ' + e.message; return; }
  if (S && !confirm(`Заменить текущий мир на сохранение «${ns.god.name}» (герой ${ns.hero.name}, ур. ${ns.hero.lvl})?`)) return;
  try { if (S) localStorage.setItem(SAVE_KEY + '_before_import', JSON.stringify(S)); } catch (e) { }
  S = ns; duelPending = false; dunPending = false;
  offlineCatchUp();
  if (S.ev && S.ev.phase === 'live' && !S.ev.joined) joinEvent(S.ev);
  diary('📥 Мир перенесён в новое место. Герой огляделся, почесал затылок и пошёл дальше.', 'god');
  save(); closeModal(); $('diary')._v = -1; render(); toast(`📥 Сохранение загружено: ${S.hero.name}, ур. ${S.hero.lvl}.`);
}
Object.assign(ACT, {
  backOnb: () => onboarding(), applyUpdate, exportSave: exportModal, importSave: importModal, doImport,
  install: async () => { if (!installEvt) return toast('Установка из браузера сейчас недоступна — см. подсказку в настройках.'); installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { } installEvt = null; closeModal(); },
  copySave: async () => { const t = $('expText'); try { await navigator.clipboard.writeText(t.value); toast('📋 Код скопирован.'); } catch (e) { t.select(); try { document.execCommand('copy'); toast('📋 Код скопирован.'); } catch (e2) { toast('Выделите код и скопируйте вручную.'); } } },
  downloadSave: () => { const d = new Date(), name = `bogodel-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('💾 Файл ' + name + ' скачан.'); }
});
/* Импорт доступен и без существующего мира (с экрана создания) */

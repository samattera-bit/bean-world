// Pinto's World — the 2D storybook renderer + page UI.
// All character logic lives in mind.js; all character data lives in world.json.
import { stateAt, duskAmount, positionOnSegment, NEEDS } from './mind.js';
import { beanSVG } from './bean.js';
import { nowClock } from './clock.js';
import { initGame } from './game.js?v=14';
import { initGamepad } from './gamepad.js?v=14';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- time (shared with the 3D view; see clock.js) ----------
const params = new URLSearchParams(location.search);

// ---------- app state (in memory only) ----------
const app = {
  world: null,
  view: 'world',
  still: false,
  state: null,
  diaryIndex: 0,
  speaking: false,
};

// Still mode: default on for people who ask their device for less motion.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
app.still = reduceMotion.matches || params.get('still') === '1';
if (params.get('still') === '0') app.still = false;

// ---------- boot ----------
const beanEl = $('#bean');
beanEl.innerHTML = `<div class="flip">${beanSVG()}</div>`;

async function boot() {
  try {
    const res = await fetch('world.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    app.world = await res.json();
  } catch (e) {
    $('#main').innerHTML = `<div class="load-error"><p>Pinto's meadow is still waking up. Please try again in a little while.</p></div>`;
    return;
  }
  app.diaryIndex = Math.max(0, (app.world.diary || []).length - 1);
  applyStill();
  renderThings();
  renderDiary();
  tick();
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('has-booted')));
  setInterval(tick, 60 * 1000); // Bean re-thinks once a minute
  requestAnimationFrame(frame);
  const startView = params.get('view');
  if (['world', '3d', 'diary', 'things'].includes(startView)) showView(startView, true);
}

// ---------- the scene ----------
function isInside(s) {
  if (!s) return false;
  if (s.sleeping) return true;
  return s.activity?.place === 'home' && !s.walking;
}
function houseView() {
  const s = app.state;
  const night = document.body.dataset.time === 'night';
  if (!s) return 'home';
  if (s.sleeping) return 'sleep';
  if (isInside(s)) return s.activity?.id === 'nap_in_bed' ? (night ? 'sleep' : 'nap') : 'home';
  return night ? 'out_dusk' : 'out_day';
}
function depthFor(y) {
  return 0.62 + 0.42 * y; // farther away (higher up) = a little smaller
}

function placeBean(x, y) {
  beanEl.style.left = (x * 100).toFixed(3) + '%';
  beanEl.style.top = (y * 100).toFixed(3) + '%';
  beanEl.style.setProperty('--depth', depthFor(y).toFixed(3));
}

function tick() {
  const clock = nowClock();
  const s = stateAt(app.world, clock);
  game.applyState(s, clock);
  const prev = app.state;
  app.state = s;

  // day / dusk
  const dusk = duskAmount(clock);
  $('.bg-dusk').style.opacity = dusk.toFixed(3);
  document.body.dataset.time = dusk > 0.5 ? 'night' : 'day';

  // caption (only update when it changes, so screen readers stay calm)
  const cap = $('#caption');
  if (cap.textContent !== s.caption) cap.textContent = s.caption;
  $('#scene').setAttribute('aria-label', `Pinto's meadow. ${s.caption}`);

  // things Bean has built (like the swing) appear once he's finished making them
  for (const f of app.world.features || []) {
    let el = document.getElementById('feature-' + f.id);
    if (!el) {
      const place = (app.world.places || []).find((p) => p.id === f.id) || { x: 0.5, y: 0.5 };
      el = document.createElement('img');
      el.id = 'feature-' + f.id; el.className = 'feature feature-' + f.id; el.alt = ''; el.src = f.image;
      el.style.left = (place.x * 100) + '%'; el.style.top = ((place.y + 0.02) * 100) + '%';
      $('#scene').insertBefore(el, beanEl);
    }
    let built = clock.date > f.built_on;
    if (clock.date === f.built_on) {
      const segs = s.plan.segments.filter((g) => g.activity.id === f.built_by_activity);
      built = segs.length ? clock.minutes >= segs[segs.length - 1].end : clock.date >= f.built_on;
    }
    el.classList.toggle('is-built', built);
  }

  // indoors: asleep, or doing a home activity (nap, tidying) -> Bean is inside, not on the doorstep
  const inside = isInside(s);
  beanEl.classList.toggle('is-sleeping', s.sleeping);
  beanEl.classList.toggle('is-inside', inside);
  const z = $('#zzz');
  const dozing = s.sleeping || (inside && s.activity?.id === 'nap_in_bed');
  z.classList.toggle('is-on', dozing);
  $('#scene').classList.toggle('bean-home', inside);
  $('#house-spot').setAttribute('aria-label', inside ? "Peek inside Pinto's house. Pinto is inside." : "Peek inside Pinto's house");

  renderNeeds(s.needs);
  if (!prev) placeBean(s.position.x, s.position.y);
  updateBeanPosition(clock);
  game.syncScene(s, clock);
  updateReadButtons();
}

// Position is recomputed every frame while walking; pose gently turns to show Pinto's back-left cutout.
const TURN_CYCLE_MS = 14000;
const TURN_SHOW_MS = 5000;
function computeBeanPose(s, walking) {
  if (!s || s.sleeping) return 'front';
  const dx = s.dx ?? 0;
  const dy = s.dy ?? 0;
  if (walking) {
    if (s.facing < 0 || dx < -0.02) return 'turn';
    if (dy < -0.08 && Math.abs(dx) < Math.abs(dy) * 0.7) return 'back';
    return 'front';
  }
  if (app.still) return s.facing < 0 ? 'turn' : 'front';
  const phase = performance.now() % TURN_CYCLE_MS;
  return phase >= (TURN_CYCLE_MS - TURN_SHOW_MS) ? 'turn' : 'front';
}

function updateBeanPosition(clock = nowClock()) {
  const s = app.state;
  if (!s) return;
  let x = s.position.x, y = s.position.y, walking = false;
  if (!s.sleeping && s.segment) {
    if (app.still) {
      x = s.segment.place.x; y = s.segment.place.y; // jump straight there
    } else {
      const p = positionOnSegment(s.segment, clock.minutes);
      x = p.x; y = p.y; walking = p.walking;
    }
  }
  const pose = computeBeanPose(s, walking);
  if (beanEl.dataset.pose !== pose) beanEl.dataset.pose = pose;
  beanEl.classList.toggle('is-walking', walking && !app.still);
  placeBean(x, y);
  return walking;
}

function frame() {
  if (app.state && app.state.segment && !app.still && !app.state.sleeping) {
    const p = positionOnSegment(app.state.segment, nowClock().minutes);
    if (p.walking || beanEl.classList.contains('is-walking')) {
      updateBeanPosition();
    } else {
      const pose = computeBeanPose(app.state, false);
      if (beanEl.dataset.pose !== pose) beanEl.dataset.pose = pose;
    }
  }
  requestAnimationFrame(frame);
}

// ---------- needs as soft leaves ----------
const NEED_INFO = {
  rest: { label: 'Rest', color: 'var(--need-rest)' },
  tummy: { label: 'Tummy', color: 'var(--need-tummy)' },
  play: { label: 'Play', color: 'var(--need-play)' },
  wonder: { label: 'Wonder', color: 'var(--need-wonder)' },
};
const LEAF = '<path d="M4 20C4 11 10 4 20 4c0 10-7 16-16 16z"/>';
function renderNeeds(needs) {
  const list = $('#needs');
  const html = NEEDS.map((n) => {
    const v = Math.max(0, Math.min(1, needs[n] ?? 0));
    const on = Math.max(1, Math.round(v * 5));
    const leaves = Array.from({ length: 5 }, (_, i) =>
      `<svg class="leaf${i < on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${LEAF}</svg>`).join('');
    return `<li class="need" style="--c:${NEED_INFO[n].color}">
      <span class="need-name">${NEED_INFO[n].label}</span>
      <span class="leaves" role="img" aria-label="${NEED_INFO[n].label}: ${on} of 5 leaves">${leaves}</span>
    </li>`;
  }).join('');
  if (list.innerHTML !== html) list.innerHTML = html;
}

// ---------- Still toggle ----------
function applyStill() {
  document.body.classList.toggle('is-still', app.still);
  const btn = $('#still-btn');
  btn.setAttribute('aria-pressed', String(app.still));
  $('#still-label').textContent = app.still ? 'Still is on' : 'Still';
  updateBeanPosition();
  document.dispatchEvent(new CustomEvent('bean:still', { detail: app.still }));
}
$('#still-btn').addEventListener('click', () => {
  app.still = !app.still;
  applyStill();
});

// ---------- tabs ----------
// The 3D tab shares the World section (same caption, buttons and needs); only the picture swaps.
function showView(name, instant = false) {
  if (name === app.view && !instant) return;
  stopSpeaking();
  if (game?.isPlaceOpen()) game.closePlace();
  app.view = name;
  const section = name === '3d' ? 'world' : name;
  $$('.tab').forEach((t) => {
    if (t.dataset.view === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  $$('.view').forEach((v) => {
    const on = v.dataset.view === section;
    const wasHidden = v.hidden;
    v.hidden = !on;
    v.classList.toggle('is-active', on);
    if (on && wasHidden && !app.still && !instant) {
      v.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('is-entering')));
    }
  });
  const is3d = name === '3d';
  $('#scene').hidden = is3d;
  $('#scene3d').hidden = !is3d;
  $('.view-world').classList.toggle('is-3d', is3d);
  if (is3d) open3D();
  else if (world3d) world3d.setActive(false);
  updateReadButtons();
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

// ---------- the 3D meadow (loaded only when its tab is opened) ----------
let world3d = null;
let loading3d = null;
function open3D() {
  if (world3d) { world3d.setActive(true); return; }
  if (loading3d) return;
  const stage = $('#stage3d');
  stage.dataset.state = 'loading';
  loading3d = import('./world3d.js?v=14')
    .then((m) => m.mount3D({
      root: $('#scene3d'),
      world: app.world,
      nowClock,
      isStill: () => app.still,
      openHouse,
      openPlace: (placeId) => {
        game.openPlace(placeId);
        requestAnimationFrame(() => gamepad.focusFirstInDialog());
      },
      getGamepad: () => gamepad.getState(),
      backToStorybook: () => showView('world'),
    }))
    .then((w) => {
      world3d = w;
      stage.dataset.state = w.ok ? 'ready' : 'failed';
      if (w.ok) {
        w.setActive(app.view === '3d');
        if (params.get('play') === '1') w.setMode('play');
      }
    })
    .catch((err) => {
      console.warn('3D view could not start', err);
      stage.dataset.state = 'failed';
    });
}
$('#back-to-storybook').addEventListener('click', () => showView('world'));

// ---------- diary ----------
function friendlyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
function renderDiary() {
  const entries = app.world.diary || [];
  const page = $('#diary-page');
  if (!entries.length) {
    $('#diary-heading').textContent = 'No pages yet';
    $('#diary-text').textContent = "Pinto hasn't written in the diary yet.";
    $('#diary-date').textContent = '';
    $('#prev-btn').disabled = true; $('#next-btn').disabled = true;
    return;
  }
  const e = entries[app.diaryIndex];
  $('#diary-date').textContent = `Page ${app.diaryIndex + 1} of ${entries.length} · ${friendlyDate(e.date)}`;
  $('#diary-heading').textContent = e.title;
  $('#diary-text').textContent = e.text;
  const fig = $('.page-picture');
  fig.innerHTML = '';
  if (e.image) {
    const img = new Image();
    img.src = e.image; img.alt = e.image_alt || `A picture for "${e.title}"`;
    img.width = 1200; img.height = 800; img.decoding = 'async';
    img.addEventListener('error', () => { fig.innerHTML = `<div class="img-fallback" role="img" aria-label="${img.alt}">Pinto is still painting this picture.</div>`; });
    fig.appendChild(img);
  } else {
    fig.innerHTML = `<div class="img-fallback">Pinto is still painting this picture.</div>`;
  }
  $('#prev-btn').disabled = app.diaryIndex === 0;
  $('#next-btn').disabled = app.diaryIndex >= entries.length - 1;
  page.setAttribute('aria-label', `Diary page ${app.diaryIndex + 1}`);
  updateReadButtons();
}
$('#prev-btn').addEventListener('click', () => { if (app.diaryIndex > 0) { stopSpeaking(); app.diaryIndex--; renderDiary(); } });
$('#next-btn').addEventListener('click', () => { if (app.diaryIndex < (app.world.diary || []).length - 1) { stopSpeaking(); app.diaryIndex++; renderDiary(); } });

// ---------- Bean's things ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  bean: '<path d="M13 3c5 0 7 4 7 9 0 5-3 9-8 9s-8-3-8-7c0-3 2-4 2-6 0-3 3-5 7-5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-2 6 6-2"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1A4.5 4.5 0 0 0 7 18z"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/>',
  memory: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  frame: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 16l5-5 4 4 2-2 5 5"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  letter: '<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

function listOrEmpty(items, emptyText, chips = true) {
  if (!items || !items.length) return `<p class="soft">${esc(emptyText)}</p>`;
  return `<ul class="${chips ? 'chips' : ''}" role="list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function renderThings() {
  const w = app.world, b = w.bean;
  const name = b.name || b.placeholder_name || 'Pinto';
  const nameLine = b.name
    ? (b.name_story ? esc(b.name_story) : `Pinto's name is ${esc(b.name)}.`)
    : `Pinto hasn't picked a name yet. For now, everyone just says "Pinto".`;
  const intention = w.today && w.today.intention;
  const memories = (b.memories || []).slice().reverse();
  const gifts = (w.gifts || []).filter((g) => g.kept !== false);
  const paintings = (w.paintings || []).map((p, i) => ({ ...p, i })).reverse();
  const letters = (w.letters || []).map((l, i) => ({ ...l, i })).reverse();

  $('#things').innerHTML = `
    ${intention ? `<article class="card full intention"><h3>${icon('sun')} Today ${esc(name)} hopes…</h3><p>${esc(intention)}</p></article>` : ''}
    <article class="card full">
      <h3>${icon('frame')} ${esc(name)}'s paintings</h3>
      ${paintings.length
        ? `<ul class="paintings" role="list">${paintings.map((p) => `<li><button class="painting" data-painting="${p.i}"><img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" /><span class="painting-title">${esc(p.title)}</span><span class="memory-date">${esc(friendlyDate(p.date))}</span></button></li>`).join('')}</ul>`
        : '<p class="soft">No paintings yet.</p>'}
    </article>
    <article class="card wide">
      <h3>${icon('bean')} About ${esc(name)}</h3>
      <p>${nameLine}</p>
      ${listOrEmpty(b.traits, 'Pinto is still getting to know himself.')}
    </article>
    <article class="card wide">
      <h3>${icon('heart')} Things ${esc(name)} loves</h3>
      ${listOrEmpty(b.loves, 'Pinto is still finding out what he loves.')}
    </article>
    <article class="card">
      <h3>${icon('brush')} Hobbies</h3>
      ${listOrEmpty(b.hobbies, 'Pinto is trying lots of little things to see what feels right.')}
    </article>
    <article class="card">
      <h3>${icon('cloud')} Not so keen on</h3>
      ${listOrEmpty(b.dislikes, 'Nothing yet. Pinto likes almost everything so far.')}
    </article>
    <article class="card">
      <h3>${icon('memory')} Memories</h3>
      ${memories.length ? `<ul role="list">${memories.map((m) => `<li><span class="memory-date">${esc(friendlyDate(m.date))}</span>${esc(m.text)}</li>`).join('')}</ul>` : '<p class="soft">No memories yet.</p>'}
    </article>
    ${letters.length ? `<article class="card full">
      <h3>${icon('letter')} Letters from ${esc(name)}</h3>
      <ul role="list">${letters.map((l) => `<li><button class="letter" data-letter="${l.i}"><span class="memory-date">To ${esc(l.to)} · ${esc(friendlyDate(l.date))}</span>${esc(l.text.split('. ').slice(0, 2).join('. '))}…</button></li>`).join('')}</ul>
    </article>` : ''}
    <article class="card full">
      <h3>${icon('gift')} Gifts ${esc(name)} has kept</h3>
      ${gifts.length
        ? `<ul role="list">${gifts.map((g) => `<li><span class="memory-date">From ${esc(g.from)} · ${esc(friendlyDate(g.date))}</span>${esc(g.text)}${g.where ? ` <span class="soft">(kept ${esc(g.where)})</span>` : ''}</li>`).join('')}</ul>`
        : `<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.gift}</svg><p class="soft">No gifts yet. You can leave Pinto a note by telling Pinto's helper.</p></div>`}
    </article>`;
}

function thingsSpeech() {
  const w = app.world, b = w.bean;
  const name = b.name || b.placeholder_name || 'Pinto';
  const parts = [];
  if (w.today?.intention) parts.push(w.today.intention);
  if (b.traits?.length) parts.push(`${name} is ${b.traits.join(', ')}.`);
  if (b.loves?.length) parts.push(`${name} loves ${b.loves.join(', and ')}.`);
  parts.push((w.gifts || []).length ? `${name} has kept ${(w.gifts || []).length === 1 ? "one gift" : (w.gifts || []).length + " gifts"}.` : `${name} has no gifts yet.`);
  return parts.join(' ');
}

// ---------- Read to me ----------
// Pre-recorded lines in the ElevenLabs narrator voice (audio/manifest.json maps exact text -> mp3).
// Never fall back to browser device speech synthesis.
let voiceMap = {};
let voiceMapLoaded = false;
fetch('audio/manifest.json?v=15', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : {}))
  .then((m) => { voiceMap = m || {}; voiceMapLoaded = true; updateReadButtons(); })
  .catch(() => { voiceMapLoaded = true; updateReadButtons(); });
const activePlayers = new Set();
let speakSeq = 0;
function setReadButtons(speaking) {
  app.speaking = speaking;
  $$('.read-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(speaking));
    b.querySelector('.read-label').textContent = speaking ? 'Stop reading' : 'Read to me';
  });
}
function resolveVoice(text) {
  if (!text) return undefined;
  return voiceMap[text]
    || voiceMap[text.replaceAll('Pinto', 'Pinto Bean')]
    || voiceMap[text.replaceAll('Pinto', 'Bean')]
    || voiceMap[text.replaceAll('Pinto Bean', 'Bean')];
}
function updateReadButtons() {
  const text = currentReadText();
  const hasAudio = app.speaking || !voiceMapLoaded || Boolean(resolveVoice(text));
  $$('.read-btn').forEach((b) => {
    b.disabled = !hasAudio;
    b.hidden = !hasAudio;
  });
}
function stopSpeaking() {
  speakSeq++;
  try { window.speechSynthesis?.cancel(); } catch {}
  for (const a of new Set([...activePlayers, ...document.querySelectorAll('audio')])) {
    a.onended = null;
    a.onerror = null;
    try { a.pause(); a.currentTime = 0; } catch {}
    a.removeAttribute('src');
    try { a.load(); } catch {}
  }
  activePlayers.clear();
  setReadButtons(false);
}
function speak(text) {
  stopSpeaking();
  const file = resolveVoice(text);
  if (!file) return;
  const seq = ++speakSeq;
  const a = new Audio(file);
  a.volume = 0.9;
  activePlayers.add(a);
  a.onended = () => {
    activePlayers.delete(a);
    if (seq === speakSeq) setReadButtons(false);
  };
  a.onerror = () => {
    activePlayers.delete(a);
    if (seq === speakSeq) setReadButtons(false);
  };
  setReadButtons(true);
  a.play().catch(() => {
    activePlayers.delete(a);
    if (seq === speakSeq) setReadButtons(false);
  });
}
function currentReadText() {
  if (game?.isPlaceOpen()) return game.getPlaceReadText();
  if (houseDlg.open) return readerText;
  if (app.view === 'diary') {
    const e = (app.world?.diary || [])[app.diaryIndex];
    return e ? `${e.title}. ${e.text}` : '';
  }
  if (app.view === 'things') return app.world ? thingsSpeech() : '';
  return app.state ? app.state.caption : '';
}
$$('.read-btn').forEach((b) => {
  b.addEventListener('click', () => { if (app.speaking) stopSpeaking(); else speak(currentReadText()); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.speaking) stopSpeaking();
});

// ---------- the reader: inside the house, paintings, letters ----------
const houseDlg = $('#house');
let readerText = '';
function openReader({ title, image, alt, text, shown, closeLabel = 'Close' }) {
  stopSpeaking();
  readerText = text || '';
  $('#house-items').innerHTML = '';
  const img = $('#house-img');
  houseDlg.classList.toggle('no-pic', !image);
  if (image) { img.src = image; img.alt = alt || ''; } else { img.removeAttribute('src'); img.alt = ''; }
  $('#house-title').textContent = title || '';
  $('#house-text').textContent = shown ?? text ?? '';
  $('#house-close span').textContent = closeLabel;
  houseDlg.showModal();
  updateReadButtons();
}
function openHouse() {
  const h = app.world?.home_inside;
  if (!h) return;
  const v = (h.views && h.views[houseView()]) || h;
  openReader({ title: "Inside Pinto's house", image: v.image, alt: v.image_alt, text: v.text, closeLabel: 'Back outside' });
  game.renderHouseItems();
  requestAnimationFrame(() => gamepad.focusFirstInDialog());
}
function closeHouse() { stopSpeaking(); houseDlg.close(); }
$('#house-btn').addEventListener('click', openHouse);
$('#house-spot').addEventListener('click', openHouse);
$('#house-close').addEventListener('click', closeHouse);
houseDlg.addEventListener('click', (e) => { if (e.target === houseDlg) closeHouse(); });
houseDlg.addEventListener('close', () => { stopSpeaking(); updateReadButtons(); });
$('#things').addEventListener('click', (e) => {
  const p = e.target.closest('[data-painting]');
  if (p) {
    const x = (app.world.paintings || [])[Number(p.dataset.painting)];
    if (x) openReader({ title: x.title, image: x.image, alt: x.image_alt, text: x.note ? `${x.title}. ${x.note}` : x.title, shown: x.note || '' });
    return;
  }
  const l = e.target.closest('[data-letter]');
  if (l) {
    const x = (app.world.letters || [])[Number(l.dataset.letter)];
    if (x) openReader({ title: 'A letter from Pinto', text: x.text });
  }
});

const game = initGame({
  getWorld: () => app.world,
  getState: () => app.state,
  isStill: () => app.still,
  nowClock,
  stopSpeaking,
  openHouse,
  houseView,
  onStateChanged: () => tick(),
  onReadTextChanged: () => updateReadButtons(),
  setHouseText: (text) => {
    stopSpeaking();
    readerText = text;
    $('#house-text').textContent = text;
    updateReadButtons();
  },
});

// ---------- controller support (Steam Machine / SteamOS / Xbox / DualSense / Switch) ----------
const VIEW_ORDER = ['world', '3d', 'diary', 'things'];
const padStatusEl = $('#pad-status');
const gamepad = initGamepad({
  isDirect3DControl: () => app.view === '3d' && world3d && (world3d.getMode() === 'play' || world3d.getMode() === 'explore' || world3d.getMode() === 'overview'),
  onConnectionChange: (connected) => {
    if (padStatusEl) padStatusEl.hidden = !connected;
    if (connected && app.view === '3d' && world3d) world3d.wake();
  },
  on3DInput: () => {
    if (app.view === '3d' && world3d) world3d.wake();
  },
  onConfirm: () => {
    if (document.querySelector('dialog[open]')) return false;
    if (app.view === '3d' && world3d) {
      if (world3d.getMode() === 'play') {
        return world3d.interact() || world3d.hop();
      }
      if (world3d.getMode() === 'overview') {
        world3d.setMode('play');
        return true;
      }
    }
    return false;
  },
  onCancel: () => {
    if (game?.isPlaceOpen()) { game.closePlace(); return; }
    if (houseDlg.open) { closeHouse(); return; }
    if (app.view === '3d' && world3d && world3d.getMode() !== 'overview') {
      world3d.setMode('overview');
    }
  },
  onRead: () => {
    if (app.speaking) stopSpeaking();
    else speak(currentReadText());
  },
  onAction: () => {
    if (document.querySelector('dialog[open]')) return;
    if (app.view === '3d' && world3d) {
      if (world3d.getMode() === 'play') world3d.hop();
      else world3d.findBean();
    } else if (app.view === 'world') {
      game.petBean();
    }
  },
  onMenu: () => {
    if (document.querySelector('dialog[open]')) {
      if (game?.isPlaceOpen()) game.closePlace();
      if (houseDlg.open) closeHouse();
      return;
    }
    if (app.view === '3d' && world3d) {
      world3d.setMode(world3d.getMode() === 'play' ? 'overview' : 'play');
    } else {
      game.openGuide();
      requestAnimationFrame(() => gamepad.focusFirstInDialog());
    }
  },
  onPrevTab: () => {
    if (document.querySelector('dialog[open]')) return;
    const i = VIEW_ORDER.indexOf(app.view);
    showView(VIEW_ORDER[(i - 1 + VIEW_ORDER.length) % VIEW_ORDER.length]);
  },
  onNextTab: () => {
    if (document.querySelector('dialog[open]')) return;
    const i = VIEW_ORDER.indexOf(app.view);
    showView(VIEW_ORDER[(i + 1) % VIEW_ORDER.length]);
  },
  onNavigate: (dx) => {
    if (document.querySelector('dialog[open]')) return false;
    if (app.view === 'diary' && dx !== 0) {
      if (dx < 0 && !$('#prev-btn').disabled) { $('#prev-btn').click(); return true; }
      if (dx > 0 && !$('#next-btn').disabled) { $('#next-btn').click(); return true; }
    }
    return false;
  },
});

// Testing hook (read-only peek at the mind).
window.__bean = { get state() { return app.state; }, get world() { return app.world; }, get gamepad() { return gamepad.getState(); } };

boot();

// Bean's World — the 2D storybook renderer + page UI.
// All character logic lives in mind.js; all character data lives in world.json.
import { easternClock, stateAt, duskAmount, positionOnSegment, NEEDS } from './mind.js';
import { beanSVG } from './bean.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- time (real US/Eastern, or mocked with ?time=YYYY-MM-DDTHH:MM for testing) ----------
const params = new URLSearchParams(location.search);
const mock = params.get('time');
const loadedAt = Date.now();
function nowClock() {
  if (mock && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(mock)) {
    const [date, t] = mock.split('T');
    const [h, m, sec = 0] = t.split(':').map(Number);
    return { date, month: Number(date.slice(5, 7)), minutes: h * 60 + m + sec / 60 + (Date.now() - loadedAt) / 60000 };
  }
  return easternClock(new Date());
}

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
    $('#main').innerHTML = `<div class="load-error"><p>Bean's meadow is still waking up. Please try again in a little while.</p></div>`;
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
  if (['world', 'diary', 'things'].includes(startView)) showView(startView, true);
}

// ---------- the scene ----------
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
  const prev = app.state;
  app.state = s;

  // day / dusk
  const dusk = duskAmount(clock);
  $('.bg-dusk').style.opacity = dusk.toFixed(3);
  document.body.dataset.time = dusk > 0.5 ? 'night' : 'day';

  // caption (only update when it changes, so screen readers stay calm)
  const cap = $('#caption');
  if (cap.textContent !== s.caption) cap.textContent = s.caption;
  $('#scene').setAttribute('aria-label', `Bean's meadow. ${s.caption}`);

  // sleeping
  beanEl.classList.toggle('is-sleeping', s.sleeping);
  const z = $('#zzz');
  z.classList.toggle('is-on', s.sleeping);
  if (s.sleeping) {
    z.style.left = (s.position.x * 100 + 2) + '%';
    z.style.top = (s.position.y * 100 - 8) + '%';
  }

  renderNeeds(s.needs);
  if (!prev) placeBean(s.position.x, s.position.y);
  updateBeanPosition(clock);
}

// Position is recomputed every frame only while walking; otherwise Bean stays put.
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
    beanEl.querySelector('.flip').style.setProperty('--face', String(s.facing));
  }
  beanEl.classList.toggle('is-walking', walking && !app.still);
  placeBean(x, y);
  return walking;
}

function frame() {
  if (app.state && app.state.segment && !app.still && !app.state.sleeping) {
    const p = positionOnSegment(app.state.segment, nowClock().minutes);
    if (p.walking || beanEl.classList.contains('is-walking')) updateBeanPosition();
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
}
$('#still-btn').addEventListener('click', () => {
  app.still = !app.still;
  applyStill();
});

// ---------- tabs ----------
function showView(name, instant = false) {
  if (name === app.view && !instant) return;
  stopSpeaking();
  app.view = name;
  $$('.tab').forEach((t) => {
    if (t.dataset.view === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  $$('.view').forEach((v) => {
    const on = v.dataset.view === name;
    v.hidden = !on;
    v.classList.toggle('is-active', on);
    if (on && !app.still && !instant) {
      v.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('is-entering')));
    }
  });
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

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
    $('#diary-text').textContent = "Bean hasn't written in the diary yet.";
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
    img.addEventListener('error', () => { fig.innerHTML = `<div class="img-fallback" role="img" aria-label="${img.alt}">Bean is still painting this picture.</div>`; });
    fig.appendChild(img);
  } else {
    fig.innerHTML = `<div class="img-fallback">Bean is still painting this picture.</div>`;
  }
  $('#prev-btn').disabled = app.diaryIndex === 0;
  $('#next-btn').disabled = app.diaryIndex >= entries.length - 1;
  page.setAttribute('aria-label', `Diary page ${app.diaryIndex + 1}`);
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
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

function listOrEmpty(items, emptyText, chips = true) {
  if (!items || !items.length) return `<p class="soft">${esc(emptyText)}</p>`;
  return `<ul class="${chips ? 'chips' : ''}" role="list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function renderThings() {
  const w = app.world, b = w.bean;
  const name = b.name || b.placeholder_name || 'Bean';
  const nameLine = b.name
    ? `Bean's name is ${esc(b.name)}.`
    : `Bean hasn't picked a name yet. For now, everyone just says "Bean".`;
  const intention = w.today && w.today.intention;
  const memories = (b.memories || []).slice().reverse();
  const gifts = (w.gifts || []).filter((g) => g.kept !== false);

  $('#things').innerHTML = `
    ${intention ? `<article class="card full intention"><h3>${icon('sun')} Today ${esc(name)} hopes…</h3><p>${esc(intention)}</p></article>` : ''}
    <article class="card wide">
      <h3>${icon('bean')} About ${esc(name)}</h3>
      <p>${nameLine}</p>
      ${listOrEmpty(b.traits, 'Bean is still getting to know themself.')}
    </article>
    <article class="card wide">
      <h3>${icon('heart')} Things ${esc(name)} loves</h3>
      ${listOrEmpty(b.loves, 'Bean is still finding out what he loves.')}
    </article>
    <article class="card">
      <h3>${icon('brush')} Hobbies</h3>
      ${listOrEmpty(b.hobbies, 'Bean is trying lots of little things to see what feels right.')}
    </article>
    <article class="card">
      <h3>${icon('cloud')} Not so keen on</h3>
      ${listOrEmpty(b.dislikes, 'Nothing yet. Bean likes almost everything so far.')}
    </article>
    <article class="card">
      <h3>${icon('memory')} Memories</h3>
      ${memories.length ? `<ul role="list">${memories.map((m) => `<li><span class="memory-date">${esc(friendlyDate(m.date))}</span>${esc(m.text)}</li>`).join('')}</ul>` : '<p class="soft">No memories yet.</p>'}
    </article>
    <article class="card full">
      <h3>${icon('gift')} Gifts ${esc(name)} has kept</h3>
      ${gifts.length
        ? `<ul role="list">${gifts.map((g) => `<li><span class="memory-date">From ${esc(g.from)} · ${esc(friendlyDate(g.date))}</span>${esc(g.text)}${g.where ? ` <span class="soft">(kept ${esc(g.where)})</span>` : ''}</li>`).join('')}</ul>`
        : `<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.gift}</svg><p class="soft">No gifts yet. You can leave Bean a note by telling Bean's helper.</p></div>`}
    </article>`;
}

function thingsSpeech() {
  const w = app.world, b = w.bean;
  const name = b.name || b.placeholder_name || 'Bean';
  const parts = [];
  if (w.today?.intention) parts.push(w.today.intention);
  if (b.traits?.length) parts.push(`${name} is ${b.traits.join(', ')}.`);
  if (b.loves?.length) parts.push(`${name} loves ${b.loves.join(', and ')}.`);
  parts.push((w.gifts || []).length ? `${name} has kept ${(w.gifts || []).length} gifts.` : `${name} has no gifts yet.`);
  return parts.join(' ');
}

// ---------- Read to me ----------
// Pre-recorded lines in Bean's voice (audio/manifest.json maps exact text -> mp3).
// Falls back to the device voice for anything not recorded yet.
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voiceMap = {};
fetch('audio/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((m) => { voiceMap = m || {}; }).catch(() => {});
let player = null;
function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
  return voices.find((v) => /samantha|karen|moira|serena|google us english|female/i.test(v.name)) || voices[0] || null;
}
function setReadButtons(speaking) {
  app.speaking = speaking;
  $$('.read-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(speaking));
    b.querySelector('.read-label').textContent = speaking ? 'Stop reading' : 'Read to me';
  });
}
function stopSpeaking() {
  if (player) { player.pause(); player.src = ''; player = null; }
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
  setReadButtons(false);
}
function speakWithDevice(text) {
  if (!synth) { setReadButtons(false); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85; u.pitch = 1.05; u.lang = 'en-US';
  const v = pickVoice(); if (v) u.voice = v;
  u.onend = () => setReadButtons(false);
  u.onerror = () => setReadButtons(false);
  setReadButtons(true);
  synth.speak(u);
}
function speak(text) {
  stopSpeaking();
  const file = voiceMap[text];
  if (!file) { speakWithDevice(text); return; }
  player = new Audio(file);
  player.volume = 0.9;
  player.onended = () => { player = null; setReadButtons(false); };
  player.onerror = () => { player = null; speakWithDevice(text); };
  setReadButtons(true);
  player.play().catch(() => { player = null; speakWithDevice(text); });
}
function currentReadText() {
  if (app.view === 'diary') {
    const e = (app.world.diary || [])[app.diaryIndex];
    return e ? `${e.title}. ${e.text}` : '';
  }
  if (app.view === 'things') return thingsSpeech();
  return app.state ? app.state.caption : '';
}
$$('.read-btn').forEach((b) => {
  b.addEventListener('click', () => { if (app.speaking) stopSpeaking(); else speak(currentReadText()); });
});

// Testing hook (read-only peek at the mind).
window.__bean = { get state() { return app.state; }, get world() { return app.world; } };

boot();

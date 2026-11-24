// Pinto's World — interactive 00s Flash-style point-and-click meadow, pet care, and calm mini-games.
// Keeps everything low-stimulation, kid-safe, and responsive to the Still toggle.
import { NEEDS, WALK_SPEED_PER_MIN, hashString, positionOnSegment } from './mind.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STORAGE_KEY_PREFIX = 'bean-world-care:';

// Everyday descriptions + fallback daily happenings (used deterministically if world.json hasn't refreshed for a new date).
const PLACE_INFO = {
  tree: {
    name: 'The reading nook',
    desc: 'A soft patch of moss sits beneath the shady branches of the big tree. Pinto keeps his favorite picture books here.',
    happenings: [
      { title: 'A bookmark of clover', text: 'Pinto pressed a soft clover leaf inside his picture book to save his page.' },
      { title: 'A mossy reading cushion', text: 'Two dappled sunbeams rest right on the mossy root where Pinto likes to read.' },
    ],
  },
  swing: {
    name: 'The tree swing',
    desc: 'A smooth wooden plank hangs from two soft ropes on the big tree branch, ready for slow swinging.',
    happenings: [
      { title: 'A gentle breeze on the ropes', text: 'The wooden swing sways just an inch in the soft meadow wind, waiting for Pinto.' },
      { title: 'A smooth oak acorn', text: 'Pinto left one shiny acorn on the swing seat like a tiny passenger.' },
    ],
  },
  hill: {
    name: 'The stargazing hill',
    desc: 'From the quiet grassy hilltop, Pinto can watch clouds drift by day and count early stars at dusk.',
    happenings: [
      { title: 'Cloud shapes above the hill', text: 'A long puffy cloud looks just like a sleepy snail gliding across the sky.' },
      { title: 'Early evening stillness', text: 'A small cricket tuned up in the tall grass at the edge of the hilltop.' },
    ],
  },
  pond: {
    name: 'The quiet pond',
    desc: 'Cool water reflects the sky between three broad lily pads. Dropping a single leaf makes calm rings.',
    happenings: [
      { title: 'A resting dragonfly', text: 'A pale dusty-blue dragonfly is resting quietly on the largest lily pad.' },
      { title: 'Smooth skipping pebbles', text: 'Pinto stacked three flat pebbles beside the bank where the water is still.' },
    ],
  },
  bakery: {
    name: 'The bakery window',
    desc: 'Warm smells of tiny bread loaves, honey waffles, and chamomile tea float out from the little round window.',
    happenings: [
      { title: 'Cooling cinnamon buns', text: 'Two miniature buns are cooling on a linen cloth right on the bakery ledge.' },
      { title: 'A fresh pot of tea', text: 'Steaming chamomile tea in a tiny speckled cup sits ready by the window.' },
    ],
  },
  garden: {
    name: 'The vegetable garden',
    desc: 'Neat rows of tender lettuce and sweet peas grow here, visited daily by slow, polite garden snails.',
    happenings: [
      { title: 'Dewdrops on the lettuce', text: 'Big round dewdrops sit like tiny marbles on the crinkled lettuce leaves.' },
      { title: 'A snail tea party', text: 'Two snails met halfway up a pea vine and touched antennae very slowly.' },
    ],
  },
  easel: {
    name: 'The art easel',
    desc: 'Pinto stands his wooden easel on the grass here, with his box of soft muted watercolors close at hand.',
    happenings: [
      { title: 'Fresh paper clipped up', text: 'A clean sheet of thick cream watercolor paper is clipped onto the easel.' },
      { title: 'Painted pebbles drying', text: 'Three smooth stones with tiny sage dots are drying on the paint tray.' },
    ],
  },
  music: {
    name: 'The music corner',
    desc: 'A little wooden xylophone rests in a patch of clover, tuned to five soft notes that never sound too loud.',
    happenings: [
      { title: 'A snail in the front row', text: 'A small striped snail settled right next to the wooden xylophone to listen.' },
      { title: 'Soft notes in the clover', text: 'Pinto left his two little felt mallets neatly crossed beside the keys.' },
    ],
  },
};

const HOUSE_ITEMS = [
  {
    id: 'bed',
    label: 'Patchwork quilt bed',
    text: 'The wooden bed has a soft patchwork quilt stitched in muted sage, cream, and terracotta squares.',
  },
  {
    id: 'window',
    label: 'Round window',
    text: 'Through the round window, Pinto can watch soft light move slowly across his quiet meadow.',
  },
  {
    id: 'shelf',
    label: 'Bookshelf & pebble',
    text: 'On the small wooden shelf sit Pinto\'s picture books and one smooth pebble painted with tiny dots.',
  },
  {
    id: 'tea',
    label: 'Chamomile tea',
    text: 'A small cup of warm chamomile tea smells gently of apples and honey.',
    care: { label: 'Fluff pillow & warm tea', needs: { rest: 0.12, tummy: 0.06 }, reply: 'You fluffed the patchwork pillow and warmed the chamomile tea. Pinto feels extra cozy.' },
  },
  {
    id: 'paints',
    label: 'Paints on windowsill',
    text: 'Pinto keeps his little box of soft watercolor paints neatly on the sunny windowsill.',
  },
  {
    id: 'note',
    label: 'The "duh" note',
    text: 'Tucked safely under his pillow is the gentle note from his little friend with the soothing bedtime sound, duh.',
  },
];

const PET_LINES = [
  'wiggles his tiny stubby feet and feels happy.',
  'hums one soft little note just for you.',
  'blinks slowly and gives a cozy little nod.',
  'leans into your gentle pat, and his two-leaf sprout perks up.',
];

const STORY_PAGES = [
  'One quiet morning, a small gray snail looked up at a slow white cloud.',
  'Where are you going today, asked the snail. Nowhere in a hurry, said the cloud.',
  'So they both rested in the warm meadow until teatime. The end.',
];

const CONSTELLATIONS = [
  {
    name: 'The Kind Snail',
    stars: [
      { x: 95, y: 175 },
      { x: 165, y: 145 },
      { x: 240, y: 120 },
      { x: 300, y: 155 },
      { x: 235, y: 190 },
    ],
  },
  {
    name: 'The Little Teacup',
    stars: [
      { x: 115, y: 120 },
      { x: 145, y: 195 },
      { x: 255, y: 195 },
      { x: 285, y: 120 },
      { x: 335, y: 148 },
    ],
  },
];

const PAINT_COLORS = [
  { name: 'Dusty Blue', hex: '#6f8ca3' },
  { name: 'Sage', hex: '#6f8a62' },
  { name: 'Terracotta', hex: '#b8704f' },
  { name: 'Muted Honey', hex: '#c9a959' },
  { name: 'Oatmeal', hex: '#8c7a65' },
];

const XYLOPHONE_KEYS = [
  { note: 'C', freq: 261.63, color: '#b8704f' },
  { note: 'D', freq: 293.66, color: '#c9a959' },
  { note: 'E', freq: 329.63, color: '#6f8a62' },
  { note: 'G', freq: 392.0, color: '#6f8ca3' },
  { note: 'A', freq: 440.0, color: '#8c7a65' },
];

function loadDayCare(date) {
  const empty = { date, needs: { rest: 0, tummy: 0, play: 0, wonder: 0 }, found: [], guest: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + date);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      date,
      needs: { ...empty.needs, ...(parsed.needs || {}) },
      found: Array.isArray(parsed.found) ? parsed.found : [],
      guest: parsed.guest || null,
    };
  } catch {
    return empty;
  }
}

function saveDayCare(care) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + care.date, JSON.stringify(care));
  } catch {
    // Private browsing or disabled storage: keep state in memory.
  }
}

export function initGame(api) {
  const sceneEl = $('#scene');
  const beanEl = $('#bean');
  const placeDlg = $('#place-dialog');
  const placeStage = $('#place-stage');
  const placeKicker = $('#place-kicker');
  const placeTitle = $('#place-title');
  const placeText = $('#place-text');
  const placeActions = $('#place-actions');
  const placeClose = $('#place-close');
  const petBtn = $('#pet-btn');
  const snackBtn = $('#snack-btn');
  const guideBtn = $('#guide-btn');
  const guideLabel = $('#guide-label');

  let care = null;
  let petCount = 0;
  let reaction = null; // { text, untilMs }
  let reactionTimer = null;
  let happyTimer = null;
  let placeReadText = '';
  let activeMode = null; // { type: 'place', placeId } | { type: 'guide' }
  let soundMuted = false;
  let audioCtx = null;
  let melodyTimers = [];
  let swingTimer = null;

  // Per-session mini-game state so kids don't lose progress on reopen.
  const miniState = {
    watered: [false, false, false],
    ripples: [],
    rippleCount: 0,
    bookPage: 0,
    swingStep: 0,
    swingCount: 0,
    constellationLit: [],
    wishPicked: '',
    paintColor: PAINT_COLORS[0].hex,
    paintSize: 10,
    easelImage: null,
    treatServed: '',
  };

  function ensureCare(date) {
    if (!care || care.date !== date) care = loadDayCare(date);
    return care;
  }

  function boostNeeds(delta, date) {
    const c = ensureCare(date);
    for (const n of NEEDS) {
      if (delta[n]) c.needs[n] = Math.min(0.65, (c.needs[n] || 0) + delta[n]);
    }
    saveDayCare(c);
  }

  function showReaction(text, ms = 7000) {
    reaction = { text, untilMs: Date.now() + ms };
    if (reactionTimer) clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => {
      reaction = null;
      api.onStateChanged();
    }, ms);
    api.onStateChanged();
  }

  function isFeatureBuilt(featureId, world, state, clock) {
    const f = (world.features || []).find((x) => x.id === featureId);
    if (!f) return true;
    if (clock.date > f.built_on) return true;
    if (clock.date < f.built_on) return false;
    const segs = (state?.plan?.segments || []).filter((g) => g.activity.id === f.built_by_activity);
    return segs.length ? clock.minutes >= segs[segs.length - 1].end : true;
  }

  // Returns a map of placeId -> { id, place, title, text } for today's happenings.
  function happeningsForDate(world, date) {
    const explicit = (world.happenings || []).filter((h) => !h.date || h.date === date);
    if (explicit.length) {
      return Object.fromEntries(explicit.map((h) => [h.place, h]));
    }
    // Deterministic fallback across 4 meadow spots if world.json hasn't had a morning run for this date yet.
    const candidates = Object.keys(PLACE_INFO);
    const ranked = candidates
      .map((id) => ({ id, score: hashString(`${date}:happening:${id}`) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);
    const out = {};
    for (const { id } of ranked) {
      const pool = PLACE_INFO[id].happenings;
      const pick = pool[hashString(`${date}:${id}`) % pool.length];
      out[id] = { id: `${date}-${id}`, date, place: id, title: pick.title, text: pick.text };
    }
    return out;
  }

  function markFound(happeningId, date) {
    if (!happeningId) return;
    const c = ensureCare(date);
    if (!c.found.includes(happeningId)) {
      c.found.push(happeningId);
      boostNeeds({ wonder: 0.05 }, date);
    }
  }

  function applyState(s, clock) {
    const world = api.getWorld();
    if (!world) return;
    const c = ensureCare(clock.date);

    if (!s.sleeping && c.guest && c.guest.date === clock.date && clock.minutes >= c.guest.startMin && clock.minutes < c.guest.endMin) {
      const act = (world.activities || []).find((a) => a.id === c.guest.activityId);
      const place = (world.places || []).find((p) => p.id === c.guest.placeId);
      if (act && place) {
        const seg = {
          activity: act,
          place,
          from: c.guest.from,
          start: c.guest.startMin,
          walkMinutes: c.guest.walkMinutes,
          end: c.guest.endMin,
        };
        const pos = positionOnSegment(seg, clock.minutes);
        s.activity = act;
        s.place = place;
        s.from = c.guest.from;
        s.segment = seg;
        s.position = { x: pos.x, y: pos.y };
        s.walking = pos.walking;
        s.facing = place.x >= c.guest.from.x ? 1 : -1;
        s.feeling = act.feeling || world.bean.mood_word || 'peaceful';
        s.caption = `${s.name} is ${act.verb_phrase}, and feels ${s.feeling}.`;
      }
    }

    for (const n of NEEDS) {
      s.needs[n] = Math.max(0, Math.min(1, (s.needs[n] ?? 0) + (c.needs[n] || 0)));
    }
    if (!s.sleeping && s.activity && s.needs.rest >= 0.2 && s.needs.tummy >= 0.2) {
      s.feeling = s.activity.feeling || world.bean.mood_word || 'peaceful';
      s.caption = `${s.name} is ${s.activity.verb_phrase}, and feels ${s.feeling}.`;
    }

    if (reaction && Date.now() < reaction.untilMs) {
      s.caption = reaction.text;
    }
  }

  function syncScene(s, clock) {
    const world = api.getWorld();
    if (!world || !clock) return;
    const c = ensureCare(clock.date);
    const todayHappenings = happeningsForDate(world, clock.date);

    // Update guide counter
    const total = Object.keys(todayHappenings).length;
    const foundCount = Object.values(todayHappenings).filter((h) => c.found.includes(h.id)).length;
    if (guideLabel) {
      guideLabel.textContent = total ? `Today's happenings (${foundCount} of ${total})` : "Today's happenings";
    }

    // Update Bean clickability
    const inside = s ? (s.sleeping || (s.activity?.place === 'home' && !s.walking)) : true;
    beanEl.classList.toggle('is-clickable', !inside);
    if (!inside) {
      beanEl.setAttribute('role', 'button');
      beanEl.setAttribute('tabindex', '0');
      beanEl.setAttribute('aria-label', `Say hello to ${s?.name || 'Pinto'}`);
    } else {
      beanEl.removeAttribute('role');
      beanEl.setAttribute('tabindex', '-1');
      beanEl.removeAttribute('aria-label');
    }

    // Render / update place hotspots on the meadow
    for (const place of world.places || []) {
      if (place.id === 'home' || !PLACE_INFO[place.id]) continue;
      const built = place.id === 'swing' ? isFeatureBuilt('swing', world, s, clock) : true;
      let spot = sceneEl.querySelector(`.place-spot[data-place="${place.id}"]`);
      if (!spot) {
        spot = document.createElement('button');
        spot.type = 'button';
        spot.className = `place-spot place-spot-${place.id}`;
        spot.dataset.place = place.id;
        spot.innerHTML = `<span class="happening-dot" aria-hidden="true"></span><span class="place-tip" aria-hidden="true">${esc(PLACE_INFO[place.id].name)}</span>`;
        spot.style.left = `${(place.x * 100).toFixed(2)}%`;
        spot.style.top = `${(place.y * 100).toFixed(2)}%`;
        spot.addEventListener('click', () => openPlace(place.id));
        sceneEl.insertBefore(spot, beanEl);
      }
      spot.hidden = !built;
      const hap = todayHappenings[place.id];
      const undiscovered = Boolean(hap && !c.found.includes(hap.id));
      spot.classList.toggle('has-happening', undiscovered);
      spot.setAttribute(
        'aria-label',
        undiscovered
          ? `Explore ${PLACE_INFO[place.id].name}. Something new today: ${hap.title}`
          : `Explore ${PLACE_INFO[place.id].name}`
      );
    }
  }

  // ---------- Direct Pet Care ----------
  function petBean() {
    const s = api.getState();
    const clock = api.nowClock();
    const name = s?.name || 'Pinto';
    if (s?.sleeping) {
      showReaction(`Shh. ${name} is fast asleep in his bed right now.`, 5000);
      return;
    }
    const line = PET_LINES[petCount % PET_LINES.length];
    petCount += 1;
    boostNeeds({ play: 0.07, wonder: 0.04 }, clock.date);
    if (!api.isStill()) {
      beanEl.classList.remove('is-happy');
      void beanEl.offsetWidth;
      beanEl.classList.add('is-happy');
      if (happyTimer) clearTimeout(happyTimer);
      happyTimer = setTimeout(() => beanEl.classList.remove('is-happy'), 900);
    }
    showReaction(`${name} ${line}`);
  }

  function giveSnack() {
    const s = api.getState();
    const clock = api.nowClock();
    const name = s?.name || 'Pinto';
    if (s?.sleeping) {
      showReaction(`Shh. ${name} is sleeping now, so we will save a warm snack for morning.`, 5000);
      return;
    }
    boostNeeds({ tummy: 0.14, rest: 0.03 }, clock.date);
    showReaction(`${name} nibbles a warm honey crumb and smiles quietly.`);
  }

  beanEl.addEventListener('click', (e) => {
    if (!beanEl.classList.contains('is-clickable')) return;
    e.stopPropagation();
    petBean();
  });
  beanEl.addEventListener('keydown', (e) => {
    if (!beanEl.classList.contains('is-clickable')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      petBean();
    }
  });
  petBtn?.addEventListener('click', petBean);
  snackBtn?.addEventListener('click', giveSnack);

  // ---------- Invite Bean to a Place ----------
  function inviteBeanToActivity(act) {
    const world = api.getWorld();
    const s = api.getState();
    const clock = api.nowClock();
    if (!world || !s || s.sleeping) return;
    const place = (world.places || []).find((p) => p.id === act.place);
    if (!place) return;
    const from = s.position ? { x: s.position.x, y: s.position.y } : { x: place.x, y: place.y };
    const dist = Math.hypot(place.x - from.x, (place.y - from.y) * 0.5625);
    const walkMinutes = api.isStill() ? 0 : dist / WALK_SPEED_PER_MIN;
    const c = ensureCare(clock.date);
    c.guest = {
      date: clock.date,
      activityId: act.id,
      placeId: place.id,
      from,
      startMin: clock.minutes,
      walkMinutes,
      endMin: clock.minutes + Math.max(12, walkMinutes + 10),
    };
    saveDayCare(c);
    reaction = null;
    const bonus = {};
    for (const n of NEEDS) {
      if (act.needs?.[n]) bonus[n] = Number((act.needs[n] * 0.15).toFixed(3));
    }
    boostNeeds(bonus, clock.date);
    api.onStateChanged();
    closePlace();
  }

  // ---------- Soft Web Audio Chime (for Music Corner) ----------
  function playChime(freq) {
    if (soundMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    } catch {
      // AudioContext unavailable; visual feedback still works.
    }
  }

  function clearPlaceTimers() {
    melodyTimers.forEach((t) => clearTimeout(t));
    melodyTimers = [];
    if (swingTimer) {
      clearTimeout(swingTimer);
      swingTimer = null;
    }
  }

  // ---------- Place Mini-Games ----------
  function setPlaceNarrative(text) {
    placeText.textContent = text;
    placeReadText = text;
    api.onReadTextChanged?.();
  }

  function renderGardenGame(clock) {
    const done = miniState.watered.every(Boolean);
    placeStage.innerHTML = `
      <div class="mg mg-garden">
        <p class="mg-hint">Tap each little lettuce to give it cool water.</p>
        <div class="garden-row">
          ${[0, 1, 2].map((i) => `
            <button type="button" class="garden-plot ${miniState.watered[i] ? 'is-watered' : ''}" data-lettuce="${i}">
              <svg viewBox="0 0 120 110" aria-hidden="true">
                <ellipse cx="60" cy="92" rx="44" ry="12" fill="#9a8268" opacity="0.45"/>
                <g class="lettuce-head">
                  <circle cx="46" cy="68" r="${miniState.watered[i] ? 21 : 15}" fill="#7f9b6f"/>
                  <circle cx="74" cy="68" r="${miniState.watered[i] ? 21 : 15}" fill="#738f63"/>
                  <circle cx="60" cy="56" r="${miniState.watered[i] ? 23 : 16}" fill="#93ae81"/>
                </g>
                ${miniState.watered[i] ? `
                  <g class="snail-buddy">
                    <ellipse cx="86" cy="84" rx="13" ry="6" fill="#d9c6a5"/>
                    <circle cx="82" cy="76" r="9" fill="#b88463"/>
                    <circle cx="82" cy="76" r="4.5" fill="#9a6849"/>
                    <circle cx="96" cy="79" r="2" fill="#3a3127"/>
                  </g>
                ` : ''}
              </svg>
              <span class="mg-btn-label">${miniState.watered[i] ? 'Watered' : `Water lettuce ${i + 1}`}</span>
            </button>
          `).join('')}
        </div>
        <p class="mg-status" id="garden-status">${done ? 'All three lettuces are watered. The snails look very pleased.' : 'The snails are waiting slowly in the shade.'}</p>
      </div>`;

    placeStage.querySelectorAll('[data-lettuce]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.lettuce);
        if (!miniState.watered[idx]) {
          miniState.watered[idx] = true;
          boostNeeds({ play: 0.04, wonder: 0.04 }, clock.date);
          api.onStateChanged();
        }
        renderGardenGame(clock);
        const count = miniState.watered.filter(Boolean).length;
        setPlaceNarrative(
          count === 3
            ? 'All three lettuces are fresh and dewy. Two friendly snails peeked out to say thank you.'
            : 'Cool droplets fell on the lettuce leaf. A garden snail slowly wiggled hello.'
        );
      });
    });
  }

  function renderEaselGame(clock) {
    const paintings = (api.getWorld()?.paintings || []).map((p, i) => ({ ...p, i })).reverse();
    placeStage.innerHTML = `
      <div class="mg mg-easel">
        <div class="easel-toolbar">
          <div class="paint-pots" role="group" aria-label="Soft paint colors">
            ${PAINT_COLORS.map((c) => `
              <button type="button" class="paint-pot ${miniState.paintColor === c.hex ? 'is-picked' : ''}" data-color="${c.hex}" aria-label="${esc(c.name)}" style="--pot:${c.hex}"></button>
            `).join('')}
          </div>
          <div class="easel-tools">
            <button type="button" class="mini-btn" data-size="8" aria-pressed="${miniState.paintSize === 8}">Little brush</button>
            <button type="button" class="mini-btn" data-size="18" aria-pressed="${miniState.paintSize === 18}">Big brush</button>
          </div>
        </div>
        <div class="easel-preview" id="easel-preview" hidden>
          <img id="easel-preview-img" src="" alt="" />
          <div class="easel-preview-bar">
            <strong id="easel-preview-title"></strong>
            <button type="button" class="mini-btn" id="easel-back">Back to my canvas</button>
          </div>
        </div>
        <canvas class="easel-canvas" id="easel-canvas" width="480" height="300" aria-label="Pinto's soft watercolor paper"></canvas>
        <div class="easel-stamps">
          <button type="button" class="mini-btn" data-stamp="cloud">Stamp cloud</button>
          <button type="button" class="mini-btn" data-stamp="snail">Stamp snail</button>
          <button type="button" class="mini-btn" data-stamp="star">Stamp star</button>
          <button type="button" class="mini-btn" data-stamp="sprout">Stamp sprout</button>
          <button type="button" class="mini-btn" id="easel-clear">Clear paper</button>
          <button type="button" class="mini-btn is-primary" id="easel-show">Show Pinto</button>
        </div>
        ${paintings.length ? `
          <div class="easel-gallery">
            <p class="mg-hint">Pinto's paintings (tap one to look closely):</p>
            <div class="easel-paintings" role="list">
              ${paintings.map((p) => `
                <button type="button" class="easel-thumb" data-bean-painting="${p.i}">
                  <img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" />
                  <span>${esc(p.title)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;

    const canvas = $('#easel-canvas', placeStage);
    const preview = $('#easel-preview', placeStage);
    const previewImg = $('#easel-preview-img', placeStage);
    const previewTitle = $('#easel-preview-title', placeStage);
    const ctx = canvas.getContext('2d');
    const showCanvas = () => {
      preview.hidden = true;
      canvas.hidden = false;
      placeStage.querySelectorAll('[data-bean-painting]').forEach((b) => b.classList.remove('is-picked'));
    };
    const resetPaper = () => {
      ctx.fillStyle = '#f8f2e4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resetPaper();
    if (miniState.easelImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = miniState.easelImage;
    }

    const saveCanvas = () => {
      try {
        miniState.easelImage = canvas.toDataURL('image/png');
      } catch {
        // Ignore canvas export errors.
      }
    };

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    let drawing = false;
    let last = null;
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      last = getPos(e);
      ctx.fillStyle = miniState.paintColor;
      ctx.beginPath();
      ctx.arc(last.x, last.y, miniState.paintSize / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !last) return;
      const p = getPos(e);
      ctx.strokeStyle = miniState.paintColor;
      ctx.lineWidth = miniState.paintSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    });
    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      last = null;
      saveCanvas();
    };
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);

    placeStage.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        showCanvas();
        miniState.paintColor = btn.dataset.color;
        placeStage.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('is-picked', b === btn));
      });
    });

    placeStage.querySelectorAll('[data-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        showCanvas();
        miniState.paintSize = Number(btn.dataset.size);
        placeStage.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      });
    });

    placeStage.querySelectorAll('[data-stamp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        showCanvas();
        const kind = btn.dataset.stamp;
        const cx = 70 + Math.random() * (canvas.width - 140);
        const cy = 60 + Math.random() * (canvas.height - 120);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = miniState.paintColor;
        ctx.strokeStyle = miniState.paintColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        if (kind === 'cloud') {
          ctx.beginPath();
          ctx.arc(-16, 4, 14, 0, Math.PI * 2);
          ctx.arc(0, -4, 18, 0, Math.PI * 2);
          ctx.arc(18, 4, 14, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'snail') {
          ctx.beginPath();
          ctx.ellipse(2, 12, 22, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-2, -2, 14, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'star') {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = 18;
            ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
        } else if (kind === 'sprout') {
          ctx.beginPath();
          ctx.moveTo(0, 18);
          ctx.lineTo(0, -6);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(-10, -8, 10, 6, -0.5, 0, Math.PI * 2);
          ctx.ellipse(10, -8, 10, 6, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        saveCanvas();
      });
    });

    $('#easel-clear', placeStage).addEventListener('click', () => {
      showCanvas();
      miniState.easelImage = null;
      resetPaper();
      setPlaceNarrative('A fresh sheet of cream watercolor paper is ready on the easel.');
    });

    $('#easel-show', placeStage).addEventListener('click', () => {
      showCanvas();
      boostNeeds({ wonder: 0.08, play: 0.08 }, clock.date);
      api.onStateChanged();
      setPlaceNarrative('Pinto tilts his head and smiles at your painting. He loves the soft colors you chose.');
    });

    $('#easel-back', placeStage)?.addEventListener('click', () => {
      showCanvas();
      setPlaceNarrative(PLACE_INFO.easel.desc);
    });

    placeStage.querySelectorAll('[data-bean-painting]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.beanPainting);
        const p = (api.getWorld()?.paintings || [])[idx];
        if (!p) return;
        previewImg.src = p.image;
        previewImg.alt = p.image_alt || p.title;
        previewTitle.textContent = p.title;
        canvas.hidden = true;
        preview.hidden = false;
        placeStage.querySelectorAll('[data-bean-painting]').forEach((b) => b.classList.toggle('is-picked', b === btn));
        setPlaceNarrative(p.note ? `${p.title}. ${p.note}` : p.title);
      });
    });
  }

  function renderMusicGame(clock) {
    placeStage.innerHTML = `
      <div class="mg mg-music">
        <p class="mg-hint">Tap the wooden keys to play soft notes.</p>
        <div class="xylo-row">
          ${XYLOPHONE_KEYS.map((k, i) => `
            <button type="button" class="xylo-key" data-note="${esc(k.note)}" data-freq="${k.freq}" style="--k:${k.color}; --kh:${100 - i * 8}%">
              <span>${esc(k.note)}</span>
            </button>
          `).join('')}
        </div>
        <div class="easel-stamps">
          <button type="button" class="mini-btn is-primary" id="xylo-song">Play Snail Song</button>
          <button type="button" class="mini-btn" id="xylo-mute" aria-pressed="${soundMuted}">${soundMuted ? 'Sound is off' : 'Quiet (no sound)'}</button>
        </div>
        <p class="mg-status" id="music-status">A little snail is listening nearby.</p>
      </div>`;

    const status = $('#music-status', placeStage);
    placeStage.querySelectorAll('.xylo-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = btn.dataset.note;
        const freq = Number(btn.dataset.freq);
        playChime(freq);
        boostNeeds({ play: 0.02 }, clock.date);
        api.onStateChanged();
        status.textContent = soundMuted
          ? `Soft note ${note} played quietly.`
          : `You played a soft ${note} note. The snail nodded slowly.`;
      });
    });

    $('#xylo-mute', placeStage).addEventListener('click', (e) => {
      soundMuted = !soundMuted;
      e.currentTarget.setAttribute('aria-pressed', String(soundMuted));
      e.currentTarget.textContent = soundMuted ? 'Sound is off' : 'Quiet (no sound)';
    });

    $('#xylo-song', placeStage).addEventListener('click', () => {
      clearPlaceTimers();
      const seq = [0, 1, 2, 3, 2, 0];
      const keys = [...placeStage.querySelectorAll('.xylo-key')];
      status.textContent = 'Playing the slow Snail Song: C, D, E, G, E, C.';
      boostNeeds({ play: 0.06, wonder: 0.05 }, clock.date);
      api.onStateChanged();
      setPlaceNarrative('The soft five-note Snail Song floated across the clover.');
      seq.forEach((keyIdx, step) => {
        const t = setTimeout(() => {
          const k = XYLOPHONE_KEYS[keyIdx];
          playChime(k.freq);
          keys.forEach((b) => b.classList.remove('is-active'));
          if (keys[keyIdx] && !api.isStill()) keys[keyIdx].classList.add('is-active');
        }, step * 550);
        melodyTimers.push(t);
      });
      melodyTimers.push(setTimeout(() => keys.forEach((b) => b.classList.remove('is-active')), seq.length * 550 + 250));
    });
  }

  function renderPondGame(clock) {
    const still = api.isStill();
    placeStage.innerHTML = `
      <div class="mg mg-pond">
        <p class="mg-hint">Tap the water to drop a soft leaf and count the ripples.</p>
        <svg class="pond-svg ${still ? 'is-still' : ''}" id="pond-svg" viewBox="0 0 440 260" role="button" tabindex="0" aria-label="Quiet pond water. Tap to drop a leaf.">
          <rect width="440" height="260" rx="22" fill="#89a392"/>
          <ellipse cx="220" cy="136" rx="188" ry="102" fill="#7d9ab0"/>
          <ellipse cx="220" cy="136" rx="176" ry="92" fill="#8aa7bc"/>
          <g fill="#738f63">
            <path d="M128 112a24 18 0 1 0 18 10l-18-4z"/>
            <path d="M306 160a28 20 0 1 0 14 14l-14-6z"/>
            <path d="M276 86a18 13 0 1 0 12 8l-12-4z"/>
          </g>
          <g id="pond-drops">
            ${miniState.ripples.map((r) => `
              <g transform="translate(${r.x}, ${r.y})">
                <circle class="ripple-ring r1" r="14" fill="none" stroke="#efe7d6" stroke-width="2" opacity="0.55"/>
                <circle class="ripple-ring r2" r="28" fill="none" stroke="#efe7d6" stroke-width="1.5" opacity="0.35"/>
                <ellipse rx="9" ry="5" transform="rotate(${r.rot})" fill="${r.color}"/>
              </g>
            `).join('')}
          </g>
        </svg>
        <div class="easel-stamps">
          <button type="button" class="mini-btn is-primary" id="pond-drop-btn">Drop a leaf</button>
          <span class="mg-status" id="pond-status">${miniState.rippleCount ? `${miniState.rippleCount} gentle ${miniState.rippleCount === 1 ? 'ripple' : 'ripples'}.` : 'The pond water is calm and glassy.'}</span>
        </div>
      </div>`;

    const dropLeaf = (x, y) => {
      miniState.rippleCount += 1;
      const colors = ['#9eb48c', '#d4a66a', '#c48f6e'];
      miniState.ripples.push({
        x: Math.round(x),
        y: Math.round(y),
        rot: (miniState.rippleCount * 37) % 180,
        color: colors[miniState.rippleCount % colors.length],
      });
      if (miniState.ripples.length > 6) miniState.ripples.shift();
      boostNeeds({ wonder: 0.04, rest: 0.03 }, clock.date);
      api.onStateChanged();
      renderPondGame(clock);
      setPlaceNarrative('Plip. One soft leaf landed on the pond, sending gentle ripples across the water.');
    };

    const svg = $('#pond-svg', placeStage);
    svg.addEventListener('click', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = Math.max(70, Math.min(370, ((e.clientX - rect.left) / rect.width) * 440));
      const y = Math.max(60, Math.min(205, ((e.clientY - rect.top) / rect.height) * 260));
      dropLeaf(x, y);
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dropLeaf(140 + ((miniState.rippleCount * 47) % 160), 95 + ((miniState.rippleCount * 31) % 80));
      }
    });
    $('#pond-drop-btn', placeStage).addEventListener('click', () => {
      dropLeaf(140 + ((miniState.rippleCount * 47) % 160), 95 + ((miniState.rippleCount * 31) % 80));
    });
  }

  function renderBakeryGame(clock) {
    const treats = [
      { id: 'croissant', label: 'Warm croissant', desc: 'flaky and warm from the little oven' },
      { id: 'roll', label: 'Sweet pea roll', desc: 'soft bread with a tiny pat of butter' },
      { id: 'waffle', label: 'Honey waffle', desc: 'golden squares with clover honey' },
      { id: 'tea', label: 'Chamomile tea', desc: 'warm and soothing in a speckled cup' },
    ];
    placeStage.innerHTML = `
      <div class="mg mg-bakery">
        <p class="mg-hint">Pick a warm treat from the windowsill to share with Pinto.</p>
        <div class="bakery-shelf">
          ${treats.map((t) => `
            <button type="button" class="treat-btn ${miniState.treatServed === t.id ? 'is-served' : ''}" data-treat="${t.id}">
              <strong>${esc(t.label)}</strong>
              <span>${esc(t.desc)}</span>
            </button>
          `).join('')}
        </div>
        <p class="mg-status">${miniState.treatServed ? 'A warm plate sits neatly on the windowsill.' : 'Everything smells warm and gentle here.'}</p>
      </div>`;

    placeStage.querySelectorAll('[data-treat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = treats.find((x) => x.id === btn.dataset.treat);
        if (!t) return;
        miniState.treatServed = t.id;
        boostNeeds({ tummy: 0.14, rest: 0.04 }, clock.date);
        api.onStateChanged();
        renderBakeryGame(clock);
        const name = api.getState()?.name || 'Pinto';
        setPlaceNarrative(`${name} enjoys the ${t.label.toLowerCase()}. His tummy feels warm and satisfied.`);
      });
    });
  }

  function renderSwingGame(clock) {
    const still = api.isStill();
    const angles = [0, -14, 12];
    const angle = still ? angles[miniState.swingStep % angles.length] : miniState.swingStep;
    placeStage.innerHTML = `
      <div class="mg mg-swing">
        <svg class="swing-svg" viewBox="0 0 360 260" aria-hidden="true">
          <rect width="360" height="260" rx="22" fill="#e8ddc8"/>
          <path d="M0 44 Q180 28 360 50 L360 0 L0 0 Z" fill="#6f8a62" opacity="0.45"/>
          <path d="M20 42 Q180 34 340 48" stroke="#7d644c" stroke-width="16" stroke-linecap="round" fill="none"/>
          <g class="swing-rig" style="transform: rotate(${angle}deg)">
            <line x1="145" y1="42" x2="145" y2="178" stroke="#9e8264" stroke-width="4"/>
            <line x1="215" y1="44" x2="215" y2="178" stroke="#9e8264" stroke-width="4"/>
            <rect x="132" y="176" width="96" height="14" rx="6" fill="#a87c55"/>
          </g>
        </svg>
        <div class="easel-stamps">
          <button type="button" class="mini-btn is-primary" id="swing-push-btn">Give a soft push</button>
          <span class="mg-status">${miniState.swingCount ? `Swung gently ${miniState.swingCount} ${miniState.swingCount === 1 ? 'time' : 'times'}.` : 'Nice and slow.'}</span>
        </div>
      </div>`;

    $('#swing-push-btn', placeStage).addEventListener('click', () => {
      miniState.swingCount += 1;
      boostNeeds({ play: 0.08, wonder: 0.03 }, clock.date);
      api.onStateChanged();
      if (api.isStill()) {
        miniState.swingStep = (miniState.swingStep + 1) % 3;
        renderSwingGame(clock);
        setPlaceNarrative(
          miniState.swingStep === 1
            ? 'The wooden swing moves gently forward toward the clouds.'
            : 'The wooden swing glides slowly back toward the big tree.'
        );
      } else {
        if (swingTimer) clearTimeout(swingTimer);
        miniState.swingStep = -12;
        renderSwingGame(clock);
        const rig = $('.swing-rig', placeStage);
        if (rig) {
          swingTimer = setTimeout(() => {
            miniState.swingStep = 9;
            rig.style.transform = 'rotate(9deg)';
            swingTimer = setTimeout(() => {
              miniState.swingStep = 0;
              rig.style.transform = 'rotate(0deg)';
            }, 1400);
          }, 1400);
        }
        setPlaceNarrative('The wooden swing rocks softly in a slow, calming arc.');
      }
    });
  }

  function renderTreeGame(clock) {
    const p = miniState.bookPage;
    placeStage.innerHTML = `
      <div class="mg mg-tree">
        <div class="mini-book">
          <p class="page-date">Picture book · Page ${p + 1} of ${STORY_PAGES.length}</p>
          <h3 class="mini-book-title">The Snail and the Cloud</h3>
          <p class="mini-book-text">${esc(STORY_PAGES[p])}</p>
        </div>
        <div class="easel-stamps">
          <button type="button" class="mini-btn" id="book-prev" ${p === 0 ? 'disabled' : ''}>Previous page</button>
          <button type="button" class="mini-btn" id="book-next" ${p >= STORY_PAGES.length - 1 ? 'disabled' : ''}>Next page</button>
          <button type="button" class="mini-btn is-primary" id="tree-rest">Rest in shade</button>
        </div>
      </div>`;

    $('#book-prev', placeStage).addEventListener('click', () => {
      if (miniState.bookPage > 0) {
        miniState.bookPage -= 1;
        renderTreeGame(clock);
        setPlaceNarrative(STORY_PAGES[miniState.bookPage]);
      }
    });
    $('#book-next', placeStage).addEventListener('click', () => {
      if (miniState.bookPage < STORY_PAGES.length - 1) {
        miniState.bookPage += 1;
        boostNeeds({ wonder: 0.04 }, clock.date);
        api.onStateChanged();
        renderTreeGame(clock);
        setPlaceNarrative(STORY_PAGES[miniState.bookPage]);
      }
    });
    $('#tree-rest', placeStage).addEventListener('click', () => {
      boostNeeds({ rest: 0.12 }, clock.date);
      api.onStateChanged();
      setPlaceNarrative('A cool breeze drifts through the leaves. Pinto rests peacefully in the shade.');
    });
  }

  function renderHillGame(clock) {
    const cIdx = hashString(clock.date) % CONSTELLATIONS.length;
    const cons = CONSTELLATIONS[cIdx];
    const lit = miniState.constellationLit;
    const complete = lit.length >= cons.stars.length;

    const lines = [];
    for (let i = 1; i < lit.length; i++) {
      const a = cons.stars[lit[i - 1]];
      const b = cons.stars[lit[i]];
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#e8ddc8" stroke-width="2.5" stroke-dasharray="4 4" opacity="0.8"/>`);
    }

    placeStage.innerHTML = `
      <div class="mg mg-hill">
        <p class="mg-hint">${complete ? `You connected ${esc(cons.name)}.` : 'Tap each quiet star to connect the picture in the sky.'}</p>
        <div class="star-sky">
          <svg viewBox="0 0 400 240" aria-hidden="true">${lines.join('')}</svg>
          ${cons.stars.map((st, idx) => {
            const on = lit.includes(idx);
            return `<button type="button" class="star-btn ${on ? 'is-lit' : ''}" data-star="${idx}" style="left:${(st.x / 400) * 100}%; top:${(st.y / 240) * 100}%" aria-label="Star ${idx + 1}">${idx + 1}</button>`;
          }).join('')}
        </div>
        <div class="easel-stamps">
          <button type="button" class="mini-btn" data-wish="Soft rain tonight">Wish: Soft rain</button>
          <button type="button" class="mini-btn" data-wish="Warm bread tomorrow">Wish: Warm bread</button>
          <button type="button" class="mini-btn" id="star-reset">Clear stars</button>
        </div>
      </div>`;

    placeStage.querySelectorAll('[data-star]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.star);
        if (!miniState.constellationLit.includes(idx)) {
          miniState.constellationLit.push(idx);
          boostNeeds({ wonder: 0.05 }, clock.date);
          api.onStateChanged();
          renderHillGame(clock);
          if (miniState.constellationLit.length >= cons.stars.length) {
            setPlaceNarrative(`You connected all five stars to see ${cons.name}.`);
          }
        }
      });
    });

    placeStage.querySelectorAll('[data-wish]').forEach((btn) => {
      btn.addEventListener('click', () => {
        miniState.wishPicked = btn.dataset.wish;
        boostNeeds({ wonder: 0.08, rest: 0.04 }, clock.date);
        api.onStateChanged();
        setPlaceNarrative(`You made a quiet wish for ${miniState.wishPicked.toLowerCase()}.`);
      });
    });

    $('#star-reset', placeStage).addEventListener('click', () => {
      miniState.constellationLit = [];
      renderHillGame(clock);
    });
  }

  function renderPlaceMiniGame(placeId, clock) {
    if (placeId === 'garden') renderGardenGame(clock);
    else if (placeId === 'easel') renderEaselGame(clock);
    else if (placeId === 'music') renderMusicGame(clock);
    else if (placeId === 'pond') renderPondGame(clock);
    else if (placeId === 'bakery') renderBakeryGame(clock);
    else if (placeId === 'swing') renderSwingGame(clock);
    else if (placeId === 'tree') renderTreeGame(clock);
    else if (placeId === 'hill') renderHillGame(clock);
  }

  // ---------- Open Place Explorer / Meadow Guide ----------
  function openPlace(placeId) {
    const world = api.getWorld();
    const s = api.getState();
    const clock = api.nowClock();
    const info = PLACE_INFO[placeId];
    if (!world || !info) return;

    api.stopSpeaking();
    clearPlaceTimers();
    activeMode = { type: 'place', placeId };

    const todayHappenings = happeningsForDate(world, clock.date);
    const hap = todayHappenings[placeId];
    if (hap) markFound(hap.id, clock.date);

    placeKicker.textContent = hap ? `Today's happening · ${hap.title}` : 'In the meadow';
    placeTitle.textContent = info.name;
    setPlaceNarrative(hap ? hap.text : info.desc);

    const acts = (world.activities || []).filter(
      (a) => a.place === placeId && (!a.only_dates || a.only_dates.includes(clock.date)) && (!a.from_date || clock.date >= a.from_date)
    );
    const name = s?.name || 'Pinto';
    if (s && !s.sleeping && acts.length) {
      placeActions.innerHTML = acts
        .map((a) => `<button type="button" class="big-btn invite-btn" data-act="${esc(a.id)}">Invite ${esc(name)}: ${esc(a.label)}</button>`)
        .join('');
      placeActions.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = acts.find((x) => x.id === btn.dataset.act);
          if (act) inviteBeanToActivity(act);
        });
      });
    } else if (s?.sleeping) {
      placeActions.innerHTML = `<p class="soft">${esc(name)} is tucked in for the night, so he can visit here in the morning.</p>`;
    } else {
      placeActions.innerHTML = '';
    }

    renderPlaceMiniGame(placeId, clock);
    placeDlg.classList.remove('no-pic');
    if (!placeDlg.open) placeDlg.showModal();
    api.onStateChanged();
  }

  function openGuide() {
    const world = api.getWorld();
    const s = api.getState();
    const clock = api.nowClock();
    if (!world) return;

    api.stopSpeaking();
    clearPlaceTimers();
    activeMode = { type: 'guide' };

    const c = ensureCare(clock.date);
    const todayHappenings = happeningsForDate(world, clock.date);
    const allPlaces = (world.places || []).filter(
      (p) => (p.id === 'home' || PLACE_INFO[p.id]) && (p.id !== 'swing' || isFeatureBuilt('swing', world, s, clock))
    );

    placeKicker.textContent = 'Meadow map';
    placeTitle.textContent = "Today's happenings";
    const hapCount = Object.keys(todayHappenings).length;
    setPlaceNarrative(`There are ${hapCount} gentle new things happening across the meadow today. Pick any place to explore or play.`);
    placeActions.innerHTML = '';

    placeStage.innerHTML = `
      <div class="mg mg-guide">
        <ul class="guide-list" role="list">
          ${allPlaces.map((p) => {
            if (p.id === 'home') {
              return `<li><button type="button" class="guide-item" data-go="home"><strong>Pinto's little home</strong><span>Peek inside the house and touch Pinto's cozy things</span></button></li>`;
            }
            const hap = todayHappenings[p.id];
            const isFound = hap && c.found.includes(hap.id);
            const title = PLACE_INFO[p.id].name;
            return `
              <li>
                <button type="button" class="guide-item ${hap ? 'is-new' : ''}" data-go="${esc(p.id)}">
                  <strong>${esc(title)}${hap ? (isFound ? ' · Seen' : ' · New today') : ''}</strong>
                  <span>${esc(hap ? hap.title : PLACE_INFO[p.id].desc)}</span>
                </button>
              </li>`;
          }).join('')}
        </ul>
      </div>`;

    placeStage.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.go;
        if (target === 'home') {
          closePlace();
          api.openHouse();
        } else {
          openPlace(target);
        }
      });
    });

    placeDlg.classList.remove('no-pic');
    if (!placeDlg.open) placeDlg.showModal();
    api.onReadTextChanged?.();
  }

  function closePlace() {
    clearPlaceTimers();
    api.stopSpeaking();
    activeMode = null;
    if (placeDlg.open) placeDlg.close();
    api.onReadTextChanged?.();
  }

  placeClose.addEventListener('click', closePlace);
  placeDlg.addEventListener('click', (e) => { if (e.target === placeDlg) closePlace(); });
  placeDlg.addEventListener('close', () => {
    clearPlaceTimers();
    api.stopSpeaking();
    activeMode = null;
    api.onReadTextChanged?.();
  });
  guideBtn?.addEventListener('click', openGuide);

  document.addEventListener('bean:still', () => {
    if (placeDlg.open && activeMode?.type === 'place') {
      renderPlaceMiniGame(activeMode.placeId, api.nowClock());
    }
  });

  // ---------- Inside Bean's House Items ----------
  function renderHouseItems() {
    const wrap = $('#house-items');
    if (!wrap) return;
    const s = api.getState();
    const clock = api.nowClock();
    wrap.innerHTML = `
      <p class="house-items-label">Tap anything in Pinto's room to look closer:</p>
      <div class="house-items-row">
        ${HOUSE_ITEMS.map((item) => `<button type="button" class="mini-btn" data-house-item="${esc(item.id)}">${esc(item.label)}</button>`).join('')}
        ${!s?.sleeping ? `<button type="button" class="mini-btn is-primary" id="house-care-btn">${esc(HOUSE_ITEMS[3].care.label)}</button>` : ''}
      </div>`;

    wrap.querySelectorAll('[data-house-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = HOUSE_ITEMS.find((x) => x.id === btn.dataset.houseItem);
        if (!item) return;
        wrap.querySelectorAll('[data-house-item]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        api.setHouseText(item.text);
      });
    });

    const careBtn = $('#house-care-btn', wrap);
    if (careBtn) {
      careBtn.addEventListener('click', () => {
        boostNeeds(HOUSE_ITEMS[3].care.needs, clock.date);
        api.onStateChanged();
        api.setHouseText(HOUSE_ITEMS[3].care.reply);
      });
    }
  }

  return {
    applyState,
    syncScene,
    getPlaceReadText: () => placeReadText,
    isPlaceOpen: () => placeDlg.open,
    renderHouseItems,
    closePlace,
    openPlace,
    openGuide,
    petBean,
  };
}

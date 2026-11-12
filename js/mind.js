// Bean's mind: pure, deterministic simulation. No DOM, no rendering.
// Given world.json + a wall-clock time in US/Eastern, returns what Bean is doing.
// A future 3D renderer can reuse this file unchanged.

export const TZ = 'America/New_York';
export const NEEDS = ['rest', 'tummy', 'play', 'wonder'];

// How much each need drops per hour (needs are 0..1, 1 = fully satisfied).
const DRIFT_PER_HOUR = { rest: 0.08, tummy: 0.09, play: 0.08, wonder: 0.07 };
const START_NEEDS = { rest: 0.95, tummy: 0.45, play: 0.6, wonder: 0.65 };
const MIN_MINUTES = 20;
const MAX_MINUTES = 45;
// Walking speed in scene-widths per real minute. Crossing the meadow takes about a minute and a half.
export const WALK_SPEED_PER_MIN = 0.4;
// Activity need values in world.json are 'per hour'; this softens them so needs hover in the middle.
const GAIN_SCALE = 0.45;

// ---------- small utilities ----------
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hm(str) {
  const [h, m] = String(str).split(':').map(Number);
  return h * 60 + (m || 0);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Current wall-clock time in US/Eastern as {date:'YYYY-MM-DD', minutes, month}
export function easternClock(dateObj) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(dateObj);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const minutes = Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes, month: Number(p.month) };
}

// Rough sunrise / sunset for the US East Coast (local clock, minutes), by month.
const SUN = {
  1: [7.3, 16.9], 2: [6.9, 17.5], 3: [7.1, 19.0], 4: [6.4, 19.6], 5: [5.8, 20.1], 6: [5.4, 20.5],
  7: [5.6, 20.4], 8: [6.1, 19.9], 9: [6.6, 19.1], 10: [7.1, 18.3], 11: [6.7, 16.7], 12: [7.1, 16.5],
};

// 0 = full day, 1 = full dusk/night. Changes gently over an hour around sunrise and sunset.
export function duskAmount(clock) {
  const [rise, set] = SUN[clock.month] || [7, 17];
  const h = clock.minutes / 60;
  const ramp = (x, a, b) => clamp01((x - a) / (b - a));
  if (h < 12) return 1 - ramp(h, rise - 0.5, rise + 0.5);
  return ramp(h, set - 0.5, set + 0.5);
}

// ---------- the day plan ----------
function inWindow(act, minute) {
  if (!act.hours) return true;
  return minute >= hm(act.hours[0]) && minute < hm(act.hours[1]);
}

function utility(act, needs, prefs, rng, history, minute, sleep) {
  let u = 0;
  for (const n of NEEDS) {
    const gain = Math.max(0, (act.needs && act.needs[n]) || 0);
    const urgency = 1 - needs[n];
    u += gain * (urgency * urgency * 2 + 0.15);
  }
  u *= act.preference_weight ?? 1;
  if (prefs.favorites.has(act.id)) u *= 1.25;
  if (act.hours && inWindow(act, minute)) u *= 3; // special-time activities (like stargazing) are rare treats
  if (act.hours && inWindow(act, minute) && minute >= sleep - 45) u *= 5; // a calm bedtime ritual
  // Bean likes variety: avoid repeating what was just done, and things done many times today.
  const recent = history.slice(-3);
  if (recent[recent.length - 1] === act.id) u *= 0.1;
  else if (recent.includes(act.id)) u *= 0.45;
  const timesToday = history.filter((h) => h === act.id).length;
  u /= 1 + 0.35 * timesToday;
  return u * (0.5 + rng()); // seeded wobble so days feel different
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 0.5625);
}

/**
 * Build the whole day's plan for a date. Deterministic: same date + same world = same day.
 * Returns segments: [{activity, place, from(place), start, walkMinutes, end, needsStart, needsEnd}]
 */
export function planDay(world, date) {
  const wake = hm(world.schedule?.wake || '07:00');
  const sleep = hm(world.schedule?.sleep || '20:30');
  const rng = mulberry32(hashString('bean:' + date));
  const places = Object.fromEntries(world.places.map((p) => [p.id, p]));
  const acts = world.activities.filter((a) => places[a.place] && (!a.only_dates || a.only_dates.includes(date)));
  const favs = world.today && world.today.date === date ? world.today.favorite_activity_ids || [] : [];
  const prefs = { favorites: new Set(favs) };

  let needs = { ...START_NEEDS };
  let t = wake;
  let here = places.home || world.places[0];
  const history = [];
  const segments = [];

  while (t < sleep) {
    const eligible = acts.filter((a) => inWindow(a, t));
    const pool = eligible.length ? eligible : acts;
    let best = pool[0];
    let bestU = -1;
    // A special one-day treat (like a breakfast gift) happens first thing that morning.
    const treat = t === wake && segments.length === 0 ? pool.find((a) => a.only_dates && a.first_thing) : null;
    if (treat) { best = treat; bestU = Infinity; }
    for (const a of treat ? [] : pool) {
      const u = utility(a, needs, prefs, rng, history, t, sleep);
      if (u > bestU) { bestU = u; best = a; }
    }
    const dest = places[best.place];
    const walkMinutes = distance(here, dest) / WALK_SPEED_PER_MIN;
    let dur = MIN_MINUTES + rng() * (MAX_MINUTES - MIN_MINUTES);
    let end = Math.min(sleep, t + dur);
    if (sleep - end < 15) end = sleep; // no tiny leftover bits before bed
    dur = end - t;
    const needsStart = { ...needs };
    for (const n of NEEDS) {
      const gain = (best.needs && best.needs[n]) || 0;
      needs[n] = clamp01(needs[n] + ((gain * GAIN_SCALE - DRIFT_PER_HOUR[n]) * dur) / 60);
    }
    segments.push({ activity: best, place: dest, from: here, start: t, walkMinutes, end, needsStart, needsEnd: { ...needs } });
    here = dest;
    history.push(best.id);
    t = end;
  }
  return { date, wake, sleep, segments, places };
}

function lerp(a, b, k) { return a + (b - a) * k; }

// The bit of the mind the renderer cares about, at a given moment.
const planCache = new WeakMap();
export function cachedPlan(world, date) {
  let byDate = planCache.get(world);
  if (!byDate) { byDate = new Map(); planCache.set(world, byDate); }
  if (!byDate.has(date)) byDate.set(date, planDay(world, date));
  return byDate.get(date);
}

// Where Bean is along a segment at a given minute (used for smooth walking).
export function positionOnSegment(seg, minutes) {
  const walked = minutes - seg.start;
  const k = seg.walkMinutes > 0 ? Math.min(1, Math.max(0, walked / seg.walkMinutes)) : 1;
  return { x: lerp(seg.from.x, seg.place.x, k), y: lerp(seg.from.y, seg.place.y, k), walking: k < 1 };
}

export function stateAt(world, clock) {
  const plan = cachedPlan(world, clock.date);
  const name = world.bean.name || world.bean.placeholder_name || 'Bean';
  const home = plan.places.home || world.places[0];
  const m = clock.minutes;

  if (m < plan.wake || m >= plan.sleep) {
    const morning = m < plan.wake;
    // Rest refills overnight.
    const rest = morning ? clamp01(0.55 + (0.4 * (m + 210)) / (plan.wake + 210)) : 0.5;
    const last = plan.segments[plan.segments.length - 1];
    const base = morning ? START_NEEDS : last ? last.needsEnd : START_NEEDS;
    return {
      name, sleeping: true, activity: null, place: home,
      position: { x: home.x, y: home.y }, walking: false, facing: 1,
      feeling: 'sleepy',
      caption: `${name} is fast asleep at home, dreaming soft dreams.`,
      needs: { ...base, rest },
      plan,
    };
  }

  const seg = plan.segments.find((s) => m >= s.start && m < s.end) || plan.segments[plan.segments.length - 1];
  const k = Math.min(1, Math.max(0, (m - seg.start) / Math.max(1, seg.end - seg.start)));
  const needs = {};
  for (const n of NEEDS) needs[n] = lerp(seg.needsStart[n], seg.needsEnd[n], k);

  const walked = m - seg.start;
  const walking = walked < seg.walkMinutes;
  const wk = walking ? walked / seg.walkMinutes : 1;
  const position = { x: lerp(seg.from.x, seg.place.x, wk), y: lerp(seg.from.y, seg.place.y, wk) };
  const facing = seg.place.x >= seg.from.x ? 1 : -1;

  let feeling = seg.activity.feeling || world.bean.mood_word || 'peaceful';
  if (needs.rest < 0.2) feeling = 'a little sleepy';
  else if (needs.tummy < 0.2) feeling = 'a little hungry';

  const caption = `${name} is ${seg.activity.verb_phrase}, and feels ${feeling}.`;
  return {
    name, sleeping: false, activity: seg.activity, place: seg.place, from: seg.from,
    segment: seg, position, walking, facing, feeling, caption, needs, plan,
  };
}

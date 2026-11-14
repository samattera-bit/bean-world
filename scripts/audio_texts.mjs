// Lists every sentence "Read to me" can say, so each can be pre-recorded in Bean's voice.
// Usage: node scripts/audio_texts.mjs  -> writes /tmp/audio_todo/<id>.txt for missing ones and prints a summary.
import fs from 'fs';
import crypto from 'crypto';
const root = new URL('..', import.meta.url).pathname;
const w = JSON.parse(fs.readFileSync(root + 'world.json', 'utf8'));
const b = w.bean;
const name = b.name || b.placeholder_name || 'Bean';
const texts = new Set();
for (const a of w.activities) {
  const base = a.feeling || b.mood_word || 'peaceful';
  for (const f of [base, 'a little sleepy', 'a little hungry']) texts.add(`${name} is ${a.verb_phrase}, and feels ${f}.`);
}
texts.add(`${name} is fast asleep at home, dreaming soft dreams.`);
texts.add(`${name} is waking up…`);
for (const e of w.diary || []) texts.add(`${e.title}. ${e.text}`);
// Mirror of thingsSpeech() in js/app.js
const parts = [];
if (w.today?.intention) parts.push(w.today.intention);
if (b.traits?.length) parts.push(`${name} is ${b.traits.join(', ')}.`);
if (b.loves?.length) parts.push(`${name} loves ${b.loves.join(', and ')}.`);
parts.push((w.gifts || []).length ? `${name} has kept ${(w.gifts || []).length === 1 ? "one gift" : (w.gifts || []).length + " gifts"}.` : `${name} has no gifts yet.`);
texts.add(parts.join(' '));
if (w.home_inside?.text) texts.add(w.home_inside.text);
for (const v of Object.values(w.home_inside?.views || {})) if (v.text) texts.add(v.text);
for (const p of w.paintings || []) texts.add(p.note ? `${p.title}. ${p.note}` : p.title);
for (const l of w.letters || []) texts.add(l.text);
for (const h of w.happenings || []) if (h.text) texts.add(h.text);
texts.add(`There are ${(w.happenings || []).length || 4} gentle new things happening across the meadow today. Pick any place to explore or play.`);

const manPath = root + 'audio/manifest.json';
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
const todo = '/tmp/audio_todo';
fs.rmSync(todo, { recursive: true, force: true }); fs.mkdirSync(todo, { recursive: true });
let missing = 0;
for (const t of texts) {
  const id = crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);
  if (man[t] && fs.existsSync(root + man[t])) continue;
  fs.writeFileSync(`${todo}/${id}.txt`, t.replace('…', '.') + '\n');
  missing++;
}
console.log(JSON.stringify({ total: texts.size, missing, todo }));

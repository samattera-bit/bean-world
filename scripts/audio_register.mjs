// After TTS: converts /home/user/workspace/<id>.wav (or /tmp/audio_todo/<id>.wav) to audio/<id>.mp3 and records it in audio/manifest.json.
import fs from 'fs';
import { execSync } from 'child_process';
const root = new URL('..', import.meta.url).pathname;
const todo = '/tmp/audio_todo';
const manPath = root + 'audio/manifest.json';
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
let added = 0, missing = [];
for (const f of fs.readdirSync(todo).filter((f) => f.endsWith('.txt'))) {
  const id = f.slice(0, -4);
  const text = fs.readFileSync(`${todo}/${f}`, 'utf8').trim();
  const wav = [`/home/user/workspace/${id}.wav`, `${todo}/${id}.wav`].find((p) => fs.existsSync(p));
  if (!wav) { missing.push(id); continue; }
  execSync(`ffmpeg -loglevel error -y -i ${wav} -ac 1 -b:a 64k ${root}audio/${id}.mp3`);
  fs.rmSync(wav);
  // key by the exact on-screen text (restore the ellipsis variant if used)
  const key = text === `${text.split(' is waking up')[0]} is waking up.` ? text.replace(/\.$/, '…') : text;
  man[key] = `audio/${id}.mp3`; added++;
}
fs.writeFileSync(manPath, JSON.stringify(man, null, 1));
console.log(JSON.stringify({ added, missing }));

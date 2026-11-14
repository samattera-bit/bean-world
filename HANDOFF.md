# Bean's World: Handoff Guide

This is everything a new AI needs to take over **Bean**, a gentle virtual companion built for Stephanie Mattera and her 6-year-old daughter. Read all of it before changing anything.

Written 2026-11-13. State: **paused**. Stephanie asked to pause it on 2026-11-13. The last full update was the morning of 2026-11-13.

---

## 1. Who this is for (read first)

- **Stephanie** has been disabled since a stroke. She tires easily. Too much movement, too much focus, or too many lights make her brain tired in a particular way.
- She wanted something like [Pino's World](https://pinos.world), a small autonomous bird living its own little life, so she could enjoy it too. Bean is her version.
- Her **6-year-old daughter** watches too. In Bean's world she is called **"my little friend"**. Never use her real name in the world.
- In Stephanie's words:
  - "I like the idea of storybook style but want 3D ultimately."
  - "I enjoy the innocence to Pino's world, heavy internet grossness isn't involved. I want my 6 year old to be able to see it and enjoy it."
  - "just keep it consistent please". This is about how Bean looks.
  - "I think bean is he. his little legs make me laugh."

### How to talk to Stephanie

- Keep messages very short (2-3 sentences) and calm.
- Use **no exclamation points** and no emojis.
- Cover one topic at a time, with at most one question.
- **No email.** She said: "i'd prefer no email. i'll be here." Reply only in the chat she uses.
- If you aren't sure about something, say so. Don't guess.

### Rules for the world (never break these)

- **Low stimulation.** Use muted colors and slow or no motion. Nothing flashes. There is always a **Still** toggle that stops all motion.
- **Short sentences and big text.**
- **Kid-safe and innocent.** There are no screens, phones or internet in Bean's world. Nothing is scary, sad, violent, romantic or grown-up. There is no illness, loss or loneliness. Small gentle problems that turn out fine are okay.
- **Bean is a he** (he/him/his).
- **Bean always looks the same.** Use the same art in the world, the house, the diary and 3D.

---

## 2. What Bean is

Bean is a small, round, plump, apricot-tan bean. He has dot eyes, rosy cheeks, a two-leaf green sprout on top, and two tiny stubby feet. He lives in a soft storybook meadow. During the day he gardens, talks to snails, bakes, paints, reads, hums and watches the stars. He sleeps from 20:30 to 07:00 US/Eastern.

- **Name:** He chose "Bean" himself on 2026-11-11. Never rename him.
  - Name story: "He listened to the soft sounds of the meadow for a whole day, and chose Bean for himself. It felt just right."
- **Traits:** curious, gentle, a little shy.
- **Loves:** the sound of rain on the roof, the slow kind garden snails, and a warm croissant in the morning.
- **Hobby:** painting with soft colors.
- **Dislikes:** none yet.
- **Mood word (11-13):** content.
- **Voice:** Gemini TTS voice **`achird`**. Stephanie picked "voice 3" out of three samples.

### The "living" part

There are two halves.

1. **The website** simulates Bean's day live in the browser. The simulation is deterministic: the same date and the same `world.json` always give the same day.
2. **A "sleeping brain"** runs every morning. Until it was paused, this was an automated AI run at 7:00 AM Eastern. Each morning it:
   1. Looks back at what Bean did yesterday.
   2. Adds any gifts.
   3. Writes a diary page with a picture.
   4. Adds one painting by Bean.
   5. Sometimes writes a letter back.
   6. Records audio.
   7. Updates his intention for today.
   8. Redeploys the site.
   9. Sends Stephanie a 2-3 sentence message.

---

## 3. Package contents

```
bean-handoff/
  HANDOFF.md                  <- this file
  bean-world/                 <- THE APP (a static website + git repo with full history)
    index.html, styles.css
    world.json                <- Bean's whole state; the only file edited daily
    MIND.md                   <- the detailed daily-routine rules (authoritative; read it)
    js/
      app.js                  <- storybook renderer + UI (tabs, diary, things, house, reader, audio)
      mind.js                 <- the deterministic day simulation (planDay, stateAt, duskAmount)
      clock.js                <- shared clock; supports ?time= mocking
      bean.js                 <- Bean sprite markup (uses bean-open/closed.webp?v=3)
      world3d.js              <- 3D meadow tab (three.js)
      vendor/                 <- three.module.min.js, three.core.min.js, OrbitControls.js, LICENSE
    assets/
      bean-open.webp          <- CANONICAL Bean art, eyes open (394x500, transparent)
      bean-closed.webp        <- same, eyes closed (sleeping / blinking)
      meadow-day.webp         <- storybook scene, day
      meadow-dusk.webp        <- storybook scene, dusk/night
      swing.webp              <- swing sprite (built feature)
      home-inside.webp        <- inside the house, Bean awake  (view "home")
      home-inside-nap.webp    <- Bean napping in bed (view "nap")
      home-inside-sleep.webp  <- Bean asleep at night (view "sleep")
      home-inside-out-day.webp, home-inside-out-dusk.webp <- empty room while he's outside
      diary/YYYY-MM-DD.webp   <- one picture per diary page
      paintings/YYYY-MM-DD.webp <- Bean's own paintings
      bean-v1-peanut/, bean-v2-kidney/ <- retired looks (do not use)
      old-peanut-art/         <- retired house/diary art with the old peanut Bean (do not use)
    audio/
      manifest.json           <- maps each exact on-screen sentence -> mp3
      <id>.mp3                <- ~100 pre-recorded lines in voice achird
    scripts/
      audio_texts.mjs         <- lists sentences missing audio -> /tmp/audio_todo/<id>.txt
      audio_register.mjs      <- converts WAVs to mp3 + updates manifest
  extras/
    voice-samples/            <- the 3 voice auditions (Stephanie chose Voice 3 = achird)
    bean-options/             <- the 3 redesign options shown on 11-12 (she chose option 2, round)
    art-source/               <- original PNGs of the meadow scenes and first diary picture
    screenshots/              <- QA screenshots of the storybook and the 3D meadow
    automation-prompt.md      <- the exact daily prompt the sleeping brain used
```

`bean-world/MIND.md` is the most detailed rulebook for the daily routine. This file gives the overview. If the two ever disagree, MIND.md wins on details of the routine.

---

## 4. The website, feature by feature

It is a static site with no build step and no server code. To run it locally:

```
cd bean-world && python3 -m http.server 8765
# open http://127.0.0.1:8765
```

Useful URL options:

| Option | What it does |
| --- | --- |
| `?time=2026-11-13T15:00` | Pretend it's that Eastern time. The clock keeps ticking from there. |
| `&still=1` | Turn motion off. |
| `&view=world` | Open the storybook page. |
| `&view=3d` | Open the 3D meadow. |
| `&view=diary` | Open the diary. |
| `&view=things` | Open Bean's Things. |

### Tabs

The tabs are **Bean's World** (storybook, opens first), **3D Meadow**, **Diary** and **Bean's Things**. On narrow phones the tab icons are hidden so all four labels fit.

### Storybook (Bean's World tab)

- **The scene.** A painted meadow (`meadow-day.webp`). It fades to `meadow-dusk.webp` slowly, over about an hour around sunset. Sunrise and sunset times by month are in `mind.js` (the `SUN` table).
- **Bean.** The painted sprite stands at the current activity's place and walks slowly between places. He blinks slowly. CSS width is **4.6%** of the scene on desktop and **6%** on mobile. Stephanie said this size is "perfect"; don't enlarge him.
- **Bean indoors.** When he is asleep or doing a home activity, he is **hidden outdoors**. At night the house window glows softly and soft "z z" appears over the roof.
- **Caption.** A thought bubble reads: "Bean is <verb_phrase>, and feels <feeling>." The small gray dots between the picture and the caption are thought-bubble dots. Stephanie asked about them and said to leave them.
- **Buttons.**
  - **Still** stops all motion.
  - **Read to me** plays the recorded achird mp3, or falls back to the device voice.
  - **Peek inside his house** opens a dialog. You can also tap the house itself.
- **"How Bean is feeling inside".** Four soft bars: Rest, Tummy, Play and Wonder.
- **Built features.** These sprites appear after being built. So far there is the swing on the big tree.

### Inside the house (dialog)

The house dialog picks one of five views from what Bean is doing right now, so the inside always matches the meadow. You can't see him asleep outside and awake inside.

| View | Shown when |
| --- | --- |
| `home` | He is awake indoors (`tidy_home`). |
| `nap` | `nap_in_bed`. |
| `sleep` | Night. |
| `out_day` / `out_dusk` | He is outside. The room is empty and the bed is made. |

Stephanie asked whether the house was comfy or "just a pile of dirt". It is comfy:

- a wooden bed with a patchwork quilt
- a round window onto the meadow
- a book shelf with a painted pebble
- chamomile tea
- a braided rug and dried flowers
- his paints on the windowsill
- the duh note under his pillow

### Diary tab

The diary is a picture book. There is one page per day, with Previous and Next buttons and Read to me.

### Bean's Things tab

This page shows:

- Today Bean hopes... (his intention)
- About Bean (name story and traits)
- Things Bean loves
- Hobbies
- Not so keen on
- Memories
- Gifts
- **Paintings** (cards that open in a reader)
- **Letters** (cards that open in a reader)

### 3D Meadow tab

- **The island.** A small, calm, soft diorama made with three.js. three.js is vendored in the project and loads only when the tab opens. The island has:
  - the cottage
  - the big tree with the swing
  - the pond
  - the bakery with its striped awning
  - the vegetable garden
  - the easel
  - the music corner
  - the stargazing hill
- **Bean in 3D.** The same painted Bean art, shown as a small standing billboard. He uses the same simulation and clock, so he does the same thing in 2D and 3D.
- **Buttons.**
  - **Explore** lets you walk slowly at a small visitor's eye height, using the on-screen arrow pad or the arrow keys.
  - **Where's Bean?** turns you toward him.
  - **Follow Bean**.
  - **Reset view**.
  - **Still**.
- **If 3D fails**, it shows "Back to the storybook".
- **Size.** Bean is tiny in the overview, so Explore or Where's Bean is the way to see him up close.
- **New places or built features** need a simple model in `world3d.js`:
  - Add the model in the `PLACE MODELS` section.
  - Add built features to `FEATURE_MODELS`.
  - Add a bump circle to `OBST` if the thing is big enough to walk into.
  - Keep models soft, rounded and muted, with no glow or moving effects.

---

## 5. The simulation (`js/mind.js`)

`planDay(world, date)` builds the whole day from wake to sleep. It returns segments: `{activity, place, from, start, walkMinutes, end, needsStart, needsEnd}`. Times are in minutes after midnight, Eastern.

### Inputs

- The random number generator is `mulberry32(hashString('bean:' + date))`. It is deterministic.
- **Needs** are rest, tummy, play and wonder, each 0-1.
  - Starting values: rest .95, tummy .45, play .6, wonder .65.
  - Each need drifts down about 0.07-0.09 per hour.

### How an activity is chosen

1. Each activity lasts 20-45 minutes.
2. The score is need urgency × `preference_weight` × a favorite boost (only if `today.date` equals that date) × a little seeded randomness.
3. Recently done activities are penalized, so Bean doesn't repeat himself.

### Activity filters

| Field | Effect |
| --- | --- |
| `hours: [from, to]` | Time window, used for evening stargazing. |
| `only_dates: [...]` | One-day treats. |
| `first_thing: true` | Only eligible in the very first slot of the day. A one-day `first_thing` treat always wins that slot. |
| `from_date` | Starts from that day. Used for things he has built. |

### Other details

- Bean walks between places at 0.4 scene-units per minute.
- `stateAt` and `cachedPlan` give the renderer Bean's state at any moment.
- `duskAmount(clock)` is 0 for full day and 1 for full night.

To see what Bean did on a given day, which the morning routine needs:

```
cd bean-world && node --input-type=module -e "
import fs from 'fs'; import {planDay} from './js/mind.js';
const w=JSON.parse(fs.readFileSync('world.json'));
for (const s of planDay(w,'2026-11-13').segments) console.log(Math.floor(s.start/60)+':'+String(Math.floor(s.start%60)).padStart(2,'0'), s.activity.id);"
```

### Places

The x and y values are 0-1 positions in the painting, at Bean's feet. They match the art; don't move them.

| id | label | x | y |
| --- | --- | --- | --- |
| home | Bean's little home | .149 | .434 |
| tree | the reading nook under the big tree | .366 | .403 |
| hill | the stargazing hill | .594 | .211 |
| pond | the pond | .655 | .538 |
| bakery | the bakery window | .876 | .509 |
| garden | the vegetable garden | .283 | .85 |
| easel | the art easel | .526 | .85 |
| music | the music corner | .83 | .885 |
| swing | the swing on the big tree | .465 | .385 |

### Current activities (23)

| Place | Activities (feeling, preference_weight) |
| --- | --- |
| Home | `nap_in_bed` (cozy, 1.0), `tidy_home` (proud, 0.7) |
| Garden | `water_lettuce` (1.0), `talk_to_snails` (1.2), `pick_peas` (0.9) |
| Pond | `watch_lily_pads` (1.0), `count_ripples` (1.0) |
| Tree | `read_books` (1.1), `cloud_watching` (1.0), `shade_rest` (0.9) |
| Bakery | `bake_tiny_bread` (1.2), `little_snack` (1.0), `warm_tea` (0.9) |
| Music | `hum_tunes`, `play_xylophone` (1.0 each), `snail_song` (0.9) |
| Easel | `paint_pebbles` (1.1), `paint_the_sky` (1.1), `try_new_paints` (delighted, 1.3) |
| Hill | `look_far_away` (0.8), `first_stars` (1.2, 18:30-20:30), `star_wish` (1.1, 19:15-20:30) |
| Swing | `swing_gently` ("free and happy", 1.2, from 2026-11-13) |

---

## 6. `world.json` schema (current state, 2026-11-13)

Top-level keys: `schema_version` (1), `last_updated`, `bean`, `schedule`, `places`, `activities`, `gifts`, `diary`, `today`, `home_inside`, `paintings`, `letters`, `features`.

- `bean`: name, placeholder_name, pronoun ("he"), traits, loves, dislikes, hobbies, mood_word, memories `[{date,text}]`, name_story.
- `today`:
  - Current value: `{date:"2026-11-13", intention:"Bean wants to try his new swing, nice and slow.", favorite_activity_ids:["swing_gently","bake_tiny_bread","first_stars"]}`.
  - The favorites only count when `today.date` equals the current date. While paused, Bean still lives his day, just without favorites.
- `gifts` (all kept):
  1. 11-11, from "a little friend": a note with the sound "duh", said quietly and softly. It is a soothing sound. Kept under his pillow, for sleepy times.
  2. 11-11, from Stephanie: a little box of soft paints, for the easel.
  3. 11-11, from Stephanie: a breakfast feast (croissant, berries, pear, waffle with honey, warm cocoa), with `for_date` 2026-11-12.
     - Stephanie originally said coffee, but it was made cocoa to keep it kid-friendly.
  4. 11-12, from Stephanie: tools to build a swing (soft rope, a wooden plank, a little hand drill).
- `features`: `[{id:"swing", label, built_on:"2026-11-12", built_by_activity:"build_swing", image:"assets/swing.webp"}]`.
  - The sprite fades in after the last `build_swing` segment on its build day.
  - The one-day `build_swing` activity has now been removed. The feature stays, so it shows from then on.
- `diary`: 11-10 (two pages), 11-11 "My new paints, and my name", 11-12 "Breakfast, and a swing".
- `paintings`: 11-11 "The sky, with my new paints" and 11-12 "My breakfast feast".
- `letters`:
  - 11-11 to my little friend, about the duh note.
  - 11-12 to Stephanie, about the paints.
  - 11-13 to Stephanie, about the breakfast and the swing tools.
- `memories`:
  - 11-10: woke up in the meadow.
  - 11-10: made a song for the snails.
  - 11-11: chose his name.
  - 11-12: built the swing with Stephanie's tools.

---

## 7. The daily "sleeping brain" routine

The exact prompt is in `extras/automation-prompt.md`. It ran daily at **7:00 AM America/New_York** and is now paused. Each morning it does the following.

1. **Read** `world.json` and `MIND.md`. Run `planDay` for **yesterday** to see what Bean actually did.
2. **Gifts.** Add any notes, drawings or gifts Stephanie or her daughter sent since the last run.
   - Use no full names.
   - Bean keeps them, and they can shape a memory or a love.
   - A gift with `for_date` is enjoyed on that date. Write about it, and thank for it, only after that date.
   - One-day treat activities use `only_dates` (plus `first_thing` for breakfast-type gifts). Delete these activities once their date has passed, but keep the gift.
3. **Diary page** for yesterday: 4-6 short, kid-safe sentences in Bean's first-person voice, and a matching picture saved to `assets/diary/YYYY-MM-DD.webp` (about 1200 px wide, webp quality about 84).
   - Then update `mood_word`, `today` (an intention written in third person, dated **today**, with 1-3 favorite activity ids), and 0-1 new love, hobby or memory.
   - Nudge `preference_weight` by about ±0.1, staying within 0.5-1.5.
4. **Painting.** Add one naive painting **by** Bean of something from yesterday to `assets/paintings/YYYY-MM-DD.webp` (about 900 px). Give it a short title and a 1-2 sentence note in his voice. Skip it if image generation fails.
5. **Letter back**, only when there is a new note or gift. Use 3-5 short sentences.
   - Start with "Dear Stephanie." or "Dear little friend."
   - End with "Love, Bean."
   - Use no quote marks inside the text.
6. **Audio:**
   1. Run `node scripts/audio_texts.mjs`.
   2. Run TTS (voice achird) on each `/tmp/audio_todo/<id>.txt`, writing `<id>.wav`.
   3. Run `node scripts/audio_register.mjs`. It needs ffmpeg and looks for WAVs in `/home/user/workspace/` or `/tmp/audio_todo/`. Edit the paths in the script if your environment differs.
   4. Rerun step 1 and confirm `missing` is 0.
7. **Validate and deploy.** Run `python3 -m json.tool world.json`, then git commit and redeploy the folder.
8. **Message Stephanie** in 2-3 calm sentences: what Bean did yesterday, his intention today, and whether there is a new letter. Include the link.

### Image prompts (this keeps Bean consistent)

**Diary picture.** Always pass `assets/bean-open.webp` as a reference image. Use this prompt pattern:

> Image 1 is Bean; draw this exact character (same short, plump, round little apricot-tan bean shape, dot eyes, rosy cheeks, tiny feet, two-leaf green sprout on top), only smaller and placed in the scene. Scene: <what happened>. Children's picture-book illustration in soft muted gouache and watercolor, warm cream paper texture, muted sage, dusty blue, soft terracotta and oatmeal tones, low contrast, no saturated colors, no text, calm and cozy, landscape.

Check every result before using it:

- Bean must look identical: round, apricot-tan, two-leaf sprout, tiny feet.
- There must be no text and no strong colors.
- If he looks different, regenerate. Stephanie asked for him to stay consistent.

**Bean's painting.** No reference image is needed. Use this prompt pattern:

> a small, simple, naive painting made by a tiny gentle creature with a little box of soft paints: <subject>, big soft wobbly brushstrokes on cream watercolor paper, charming and childlike, a little uneven, a few drips, muted dusty blue, sage, oatmeal, soft yellow and soft terracotta only, low contrast, no text, the paper fills the frame, flat, seen straight on.

Don't put Bean in his own paintings. Vary the subject from day to day.

---

## 8. Hosting and deployment

- **Live host (current):** Render Static Site connected to `https://github.com/samattera-bit/bean-world` (`master` branch): https://beans-world.onrender.com/
  - Local project path: `/Users/stephaniemattera/.gemini/antigravity/scratch/bean-handoff/bean-world`
  - Every `git commit` + `git push origin master` automatically redeploys https://beans-world.onrender.com/.
- **Previous host (archived):** a Perplexity Computer hosted page, at `https://www.perplexity.ai/computer/a/bean-s-world-_eY_zQ1aRFqcsPTUsn9exg` (frozen at the 2026-11-13 version).
- **For local preview:** run `python3 -m http.server 8765` inside `bean-world`.
- Give Stephanie the new link once, then keep it stable.
- **Cache busting.** Images are referenced with `?v=3` where they were redrawn. If you replace an image file in place, bump the query string in `world.json` or `bean.js` so browsers fetch the new one.

---

## 9. History of decisions (so you don't undo them)

| Date | Decision |
| --- | --- |
| 11-10 | Built the v1 storybook meadow, the deterministic simulation, the diary, the Things page, the Still toggle, and Read to me. Stephanie asked for no email. |
| 11-10/11 | She asked why Bean looked different in the world and the diary. Unified the art into one painted Bean used everywhere. She wanted a more whimsical voice, heard three samples, and picked **voice 3 (achird)**. The leaf became a two-leaf **sprout**. |
| 11-11 | Bean is a **he**. Her daughter left the **duh note**. Stephanie gave **paints**, which added the `try_new_paints` activity. Bean chose the name **Bean**. |
| 11-11 | Built the house interior and made it openable, with views that match his state. |
| 11-11 | "How can you expand this?" She chose **Bean's paintings** and **occasional letters back**. |
| 11-11 | Improved the graphics. Fixed Bean showing asleep outside while awake inside; he is now hidden outdoors when indoors. |
| 11-11 | Gave a breakfast feast as a first-thing treat on 11-12. Fixed a bug where breakfast repeated all day; `first_thing` now applies only to the first slot. |
| 11-12 | Gave swing tools. Bean built the swing, and `swing_gently` runs from 11-13. |
| 11-12 | Redesign. She didn't like the peanut. Tried the kidney (she said "yikes", rejected). Settled on **round** (option 2), then made him smaller because he looked "ginormous". She said **"perfect"**. Redrew all house and diary art with round Bean. |
| 11-12 | Added the **3D Meadow** tab with **Explore** and **Where's Bean?**. The storybook stays the default. |
| 11-13 | Morning run: diary "Breakfast, and a swing", painting "My breakfast feast", thank-you letter to Stephanie. Then she asked to **pause**. |

---

## 10. How to resume

1. Get her OK before restarting the daily routine.
2. When resuming after a gap, write one diary page for the day before the resume date. Don't backfill every missed day; keep it calm.
   - The simulation still ran in her browser during the pause, using his activities, so `swing_gently` happened on those days.
3. Set `today` to the resume date.
4. Ideas Stephanie liked, to bring out slowly:
   - more gifts from her or her daughter
   - built things such as the swing
   - seasonal touches like rain or snow, but slow and muted
5. Every new place needs four things:
   - painted art in the meadow
   - a `places` entry
   - a sprite or feature entry
   - a 3D model

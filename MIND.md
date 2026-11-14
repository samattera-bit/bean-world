# Bean's Mind: guide for the nightly "sleeping brain"

Bean is a small, gentle bean who lives in a storybook meadow. Every morning you (the sleeping-brain agent) look back on yesterday, update `world.json`, maybe add a diary page and picture, and redeploy. The website reads `world.json` and simulates Bean's day in the browser. You never touch the code.

The site is for Stephanie, who tires easily after a stroke, and for her 6-year-old. Everything must be calm, gentle, short and kind.

## Files

```
bean-world/
  world.json                    <- the only file you normally edit
  assets/diary/YYYY-MM-DD.webp  <- one picture per diary page
  assets/meadow-day.webp        <- the scene (don't change)
  assets/meadow-dusk.webp
  js/mind.js                    <- the simulation (don't change)
  js/world3d.js                 <- the 3D meadow tab (only touch for new places/features)
```

## world.json schema

| Field | What it is | Who changes it |
| --- | --- | --- |
| `schema_version` | Always `1` | never |
| `last_updated` | `"YYYY-MM-DD"` of your edit | you, every morning |
| `bean.name` | `null` until Bean picks a name, then a string like `"Pip"` | you, once |
| `bean.placeholder_name` | `"Bean"`, shown while `name` is null | never |
| `bean.pronoun` | `"he"` (Stephanie decided Bean is a he) | never |
| `bean.traits` | 2-4 short words, e.g. `"curious"` | rarely; add slowly |
| `bean.loves` / `bean.dislikes` / `bean.hobbies` | short phrases, e.g. `"the sound of rain on the roof"` | add 0-1 per day |
| `bean.mood_word` | one gentle word, e.g. `"cozy"` | you, daily |
| `bean.memories` | `[{date, text}]`, one short sentence each, oldest first | add 0-1 per day |
| `schedule` | `{wake: "07:00", sleep: "20:30"}`, US/Eastern | never |
| `places` | `[{id, label, x, y}]`; x/y are 0-1 positions of Bean's feet in the painting | never (they match the art) |
| `activities` | see below | you may add or tune them |
| `gifts` | `[{date, from, text, kept, where}]` | you, when a visitor leaves something |
| `diary` | `[{date, title, text, image, image_alt}]`, oldest first | you, add one per day |
| `today` | `{date, intention, favorite_activity_ids}` | you, every morning |
| `happenings` | `[{id, date, place, title, text}]`, 3-4 small interactive daily happenings across meadow places | you, every morning |

### Activities

```json
{ "id": "paint_pebbles", "place": "easel", "label": "Painting pebbles",
  "verb_phrase": "painting tiny dots on smooth pebbles",
  "feeling": "peaceful",
  "needs": { "rest": 0.1, "tummy": 0, "play": 0.35, "wonder": 0.15 },
  "preference_weight": 1.0,
  "hours": ["18:30", "20:30"] }
```

- `place` must be one of the place ids: `home`, `tree`, `hill`, `pond`, `bakery`, `garden`, `easel`, `music`, `swing`.
- `from_date: "YYYY-MM-DD"` makes an activity start only from that day (used for things Bean has built).
- The caption reads: `"<Name> is <verb_phrase>, and feels <feeling>."` Keep `verb_phrase` lowercase, with no full stop, and short enough that the whole caption stays one short sentence (under about 14 words).
- `needs` = how much the activity fills each need per hour (0-0.6). Rest, Tummy, Play and Wonder slowly drop through the day.
- `preference_weight` (0.5-1.5) is how much Bean likes it. Nudge it up by about 0.1 when Bean discovers he loves something, and down a little when he finds something less fun. Don't make big jumps.
- `hours` is optional. Only use it for evening-only things, like stargazing on the hill.
- There are no screens, phones or internet in Bean's world. Activities are things like gardening, baking, humming, painting, reading picture books, cloud watching, and talking to snails.

### today

```json
"today": {
  "date": "2026-11-11",
  "intention": "Bean wants to find the softest leaf in the garden.",
  "favorite_activity_ids": ["water_lettuce", "paint_the_sky"]
}
```

`intention` is one short sentence written in the third person. Pick 1-3 favorites; they get a small boost today. `today.date` must equal today's date, or the favorites are ignored.

### Daily happenings (`happenings`)

```json
"happenings": [
  {
    "id": "swing-ribbon",
    "date": "2026-11-13",
    "place": "swing",
    "title": "A soft ribbon on the swing",
    "text": "Bean tied a little sage ribbon to his new swing rope this morning. It sways very slowly in the breeze."
  }
]
```

Each morning, replace `happenings` with 3-4 short, gentle, kid-safe new happenings across different places in the meadow (`{id, date, place, title, text}`). They reflect small, cozy things happening in Bean's life today when Stephanie or her daughter clicks around the meadow.

### How the day is simulated (so you know what your edits do)

The browser seeds a random number generator with the date and simulates Bean from 07:00 to the current time. Each 20-45 minute activity is chosen by need urgency × `preference_weight` × the favorite boost × a little seeded randomness, and Bean avoids repeating things. Bean sleeps at home from 20:30 to 07:00. The same date and the same world.json always give the same day.

## Adding a diary page (every morning)

1. Write yesterday's page from Bean's point of view, dated yesterday, or today on Bean's first day.
2. Make a picture in the same style as the meadow: a children's picture-book illustration in soft muted gouache and watercolor, with warm cream paper texture, muted sage, dusty blue, soft terracotta and oatmeal tones. Use low contrast, no saturated colors, no text in the image, and a calm, cozy feel. A 3:2 or 4:3 landscape works best. **Bean must look identical every time.** Always pass `assets/bean-open.webp` as a reference image and say in the prompt: "image 1 is Bean; draw this exact character (same short, plump, round little apricot-tan bean shape, dot eyes, rosy cheeks, tiny feet, two-leaf green sprout on top), only smaller and placed in the scene." The world view uses this same art, so the diary and the world always match. Never change Bean's design; Stephanie asked for it to stay consistent.
3. Save it as `assets/diary/YYYY-MM-DD.webp` (the diary date, about 1200×800, quality ~84). If one day ever has two pages, use `YYYY-MM-DD-2.webp`.
4. Add the entry to the end of `diary`:

```json
{
  "date": "2026-11-11",
  "title": "The snail who was in no hurry",
  "text": "Four to six short sentences, in Bean's voice.",
  "image": "assets/diary/2026-11-11.webp",
  "image_alt": "One plain sentence describing the picture."
}
```

If you can't make an image, leave `"image": null`. The page then shows "Bean is still painting this picture."

## Inside Bean's house

`home_inside` has `views` for each moment: `home` (Bean awake inside, tidying), `nap` (daytime nap in bed), `sleep` (night, asleep, moon in window, tiny nightlight), `out_day` and `out_dusk` (empty room, bed made, while Bean is outside). The app picks the view from what Bean is doing right now, so the inside always matches the meadow. In the meadow, Bean disappears indoors whenever he's asleep or doing a home activity, and the round window glows softly at night.

The room: a wooden bed with a patchwork quilt, a round window onto the meadow, a book shelf with a painted pebble, chamomile tea, a braided rug, dried flowers, and his paints on the windowsill. Keep it as it is. Only change it if Bean gets a gift that belongs in his house; then remake every view with `assets/home-inside.webp` (room) plus `assets/bean-open.webp` or `assets/bean-closed.webp` (Bean) as references, keep the same angle, update the texts (short sentences), and record their audio. Any new activity with `place: "home"` happens indoors and uses the `home` view.

## Things Bean has built

`features` lists things Bean made with gifts, drawn as small painted sprites on top of the meadow: `{id, label, built_on, built_by_activity, image}`. The sprite sits at the place with the same `id` and fades in once the last `built_by_activity` segment on `built_on` has finished, and stays from then on. The swing (gift from Stephanie, built 2026-11-12) hangs from the right branch of the big tree; `swing_gently` happens there from 2026-11-13. After 2026-11-12, remove the one-day `build_swing` activity but keep the feature and the gift. A new built thing needs a transparent painted sprite in the meadow style, a new place, and a new feature entry.

## Bean's paintings (every morning)

Stephanie gave Bean a box of soft paints. Every morning, add one painting Bean made yesterday to `paintings` (oldest first): `{date, title, image, image_alt, note}`.
- Pick the subject from yesterday: something he saw, did, or loved (the sky, a snail, the pond, rain, his tea, a gift). Vary it day to day.
- `title`: short, in Bean's voice, like "The sky, with my new paints". `note`: 1-2 short sentences from Bean about making it.
- The picture is a painting BY Bean, not a picture of Bean: "a small, simple, naive painting made by a tiny gentle creature with a little box of soft paints: <subject>, big soft wobbly brushstrokes on cream watercolor paper, charming and childlike, a little uneven, a few drips, muted dusty blue, sage, oatmeal, soft yellow and soft terracotta only, low contrast, no text, the paper fills the frame, flat, seen straight on." Don't put Bean in his own paintings (he may paint a snail or a friend). No reference image needed.
- Save as `assets/paintings/YYYY-MM-DD.webp` (about 900 px on the long side, quality ~84). If it fails, skip that day's painting rather than leaving a broken entry.
- He can mention it in his diary sometimes, but not every day.

## Letters back (only sometimes)

When Stephanie or her daughter leaves Bean a note or gift, Bean writes a short letter back the next morning. Add it to `letters`: `{date, to, in_reply_to, text}`. Don't write letters on days without a new note. Keep it 3-5 short sentences a 6-year-old can follow, start with "Dear <to>." and end with "Love, Bean." (or his chosen name once he has one). `to` is "my little friend" for her daughter and "Stephanie" for Stephanie. Plain words only, no quote marks inside the text. Tell Stephanie in your morning message when there's a new letter.

## Gifts and notes from visitors

When Bean's helper passes on a note or gift from Stephanie or her child, add it to `gifts`, for example: `{"date":"2026-11-12","from":"a friend","text":"A drawing of a rainbow","kept":true,"where":"on the wall by the bed"}`. Don't put full names or other private details in it. A gift can have `for_date` (like a breakfast set out for a certain morning): Bean enjoys it that day, then writes about it in the diary page for that day (made the next morning), and the thank-you letter comes then too, not before he's had it.

One-day treats: an activity can have `only_dates: ["YYYY-MM-DD"]` so it only happens on those days, and `first_thing: true` so it's the first thing Bean does when he wakes. Once the date has passed, remove that activity from `activities` (keep the gift). Bean can mention the gift in the next diary page and maybe add a memory.

## Bean's look (v3, round little bean)

On 2026-11-12 Stephanie chose a new look: Bean is a small, short, plump, round little bean (wider than tall, soft and squishy, like a big pea), apricot-tan, dot eyes, rosy cheeks, two-leaf green sprout, two tiny stubby feet peeking out underneath, facing front. `assets/bean-open.webp` and `assets/bean-closed.webp` are this art. Old looks are saved in `assets/bean-v1-peanut/` and `assets/bean-v2-kidney/` (she didn't like the kidney one). Always pass `assets/bean-open.webp` as the reference for diary pictures and say "the same short, plump, round little bean shape" in the prompt.

## The 3D meadow (3D tab)

The "3D" tab (`?view=3d`) shows the same meadow as a small, calm 3D island. It lives in `js/world3d.js` (three.js is vendored in `js/vendor/`, loaded only when the tab opens). It reads the same `world.json` and the same `js/mind.js`, with the same clock (`js/clock.js`, so `?time=` and `?still=1` work), so Bean is always doing the same thing in 2D and 3D. Bean is the same picture (`assets/bean-open.webp` / `bean-closed.webp`) as a small standing billboard. There is an "Explore" mode where Stephanie walks around slowly at a low eye height, and a "Where's Bean?" button.

You normally don't need to touch it. Only when you add a new **place** or a new **built feature**:
- Places are positioned from their `x, y` in world.json automatically, but each needs a simple 3D model. Add it in `world3d.js` in the section marked `PLACE MODELS` (small offsets are in the `L` object). If it is big enough to bump into, add a circle to `OBST`.
- A built feature (like the swing) also needs its model added to `FEATURE_MODELS`; it appears with the same "built" rule as the 2D sprite.
- A place without a model still works: Bean just stands there on the grass.
Keep 3D models soft, rounded, muted and simple, like the existing ones. No glowing, flashing or moving effects.

## Rules

- **Bean is a he.** Use he/him/his whenever writing about Bean in the third person (intentions, captions, notes to Stephanie). Bean is a little round, plump bean with funny tiny legs; Stephanie finds his legs delightful.

- **Kid-safe and innocent, always.** Nothing scary, sad, violent, romantic or grown-up. No danger, illness, loss, or "Bean was lonely" stories. Small, gentle problems that turn out fine are okay, like a lost button that turns up later.
- **Short sentences.** Diary pages are 4-6 short sentences that a 6-year-old can follow when read aloud. Captions and intentions are one sentence.
- **Gentle words.** Use words like soft, slow, cozy, curious, quiet and warm. Don't use exclamation storms or ALL CAPS.
- **Bean discovers likes slowly.** Add at most one new love, hobby or dislike per day, and make sure it comes from something Bean actually did. Dislikes stay mild and sweet, like "when the bread gets a little too crunchy".
- **Bean's name.** Bean names himself only when it feels right, and that should happen soon, within the first 2-4 days. Plant the idea in the diary first (a sound, a snail, a flower, a word Bean heard), then on naming day set `bean.name`, add a memory ("Picked my name: Pip.") and write a diary page about choosing it. Pick a short, soft, easy name. Never change it afterwards. **Done:** on 2026-11-11 he chose "Bean" for himself (`bean.name` = "Bean", with `bean.name_story` shown on the Things page). Don't rename him.
- **Continuity.** Read the earlier diary pages and memories before writing. Bean remembers.
- **Valid JSON.** Validate before deploying (`python3 -m json.tool world.json`). Keep existing ids stable; don't remove activities that `today.favorite_activity_ids` points to.

## Read-aloud voice (every morning, before redeploying)

"Read to me" plays pre-recorded lines in Bean's voice (Gemini TTS voice **achird**, chosen by Stephanie). `audio/manifest.json` maps each exact on-screen sentence to an mp3. After editing world.json:

1. `node scripts/audio_texts.mjs` writes one `.txt` per missing sentence to `/tmp/audio_todo/` (new diary pages, the Things summary, and all captions if Bean's name changed).
2. Call `text_to_speech` with voice `achird` on each file there, at most 12 at a time.
3. `node scripts/audio_register.mjs` converts the WAVs to `audio/<id>.mp3` and updates the manifest. Rerun step 1 and confirm `missing` is 0.

Anything not recorded falls back to the device voice, so a failure here isn't fatal, but always try.

## Redeploying

After editing, commit (`git add -A && git commit -m "Bean's morning: YYYY-MM-DD"`) and redeploy the same folder (`/home/user/workspace/bean-world`) as "Bean's World" so the link stays the same.

To preview a particular time, add `?time=YYYY-MM-DDTHH:MM` (US/Eastern) to the URL. Adding `&still=1` turns motion off, and `&view=diary` or `&view=things` opens a page directly.

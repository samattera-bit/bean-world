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
```

## world.json schema

| Field | What it is | Who changes it |
| --- | --- | --- |
| `schema_version` | Always `1` | never |
| `last_updated` | `"YYYY-MM-DD"` of your edit | you, every morning |
| `bean.name` | `null` until Bean picks a name, then a string like `"Pip"` | you, once |
| `bean.placeholder_name` | `"Bean"`, shown while `name` is null | never |
| `bean.pronoun` | `"they"` | never |
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

### Activities

```json
{ "id": "paint_pebbles", "place": "easel", "label": "Painting pebbles",
  "verb_phrase": "painting tiny dots on smooth pebbles",
  "feeling": "peaceful",
  "needs": { "rest": 0.1, "tummy": 0, "play": 0.35, "wonder": 0.15 },
  "preference_weight": 1.0,
  "hours": ["18:30", "20:30"] }
```

- `place` must be one of the place ids: `home`, `tree`, `hill`, `pond`, `bakery`, `garden`, `easel`, `music`.
- The caption reads: `"<Name> is <verb_phrase>, and feels <feeling>."` Keep `verb_phrase` lowercase, with no full stop, and short enough that the whole caption stays one short sentence (under about 14 words).
- `needs` = how much the activity fills each need per hour (0-0.6). Rest, Tummy, Play and Wonder slowly drop through the day.
- `preference_weight` (0.5-1.5) is how much Bean likes it. Nudge it up by about 0.1 when Bean discovers they love something, and down a little when they find something less fun. Don't make big jumps.
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

### How the day is simulated (so you know what your edits do)

The browser seeds a random number generator with the date and simulates Bean from 07:00 to the current time. Each 20-45 minute activity is chosen by need urgency × `preference_weight` × the favorite boost × a little seeded randomness, and Bean avoids repeating things. Bean sleeps at home from 20:30 to 07:00. The same date and the same world.json always give the same day.

## Adding a diary page (every morning)

1. Write yesterday's page from Bean's point of view, dated yesterday, or today on Bean's first day.
2. Make a picture in the same style as the meadow: a children's picture-book illustration in soft muted gouache and watercolor, with warm cream paper texture, muted sage, dusty blue, soft terracotta and oatmeal tones. Use low contrast, no saturated colors, no text in the image, and a calm, cozy feel. A 3:2 or 4:3 landscape works best. **Bean must look identical every time.** Always pass `assets/bean-open.webp` as a reference image and say in the prompt: "image 1 is Bean; draw this exact character (same apricot-tan peanut shape, dot eyes, rosy cheeks, tiny feet, two-leaf green sprout on top), only smaller and placed in the scene." The world view uses this same art, so the diary and the world always match. Never change Bean's design; Stephanie asked for it to stay consistent.
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

## Gifts and notes from visitors

When Bean's helper passes on a note or gift from Stephanie or her child, add it to `gifts`, for example: `{"date":"2026-11-12","from":"a friend","text":"A drawing of a rainbow","kept":true,"where":"on the wall by the bed"}`. Don't put full names or other private details in it. Bean can mention the gift in the next diary page and maybe add a memory.

## Rules

- **Kid-safe and innocent, always.** Nothing scary, sad, violent, romantic or grown-up. No danger, illness, loss, or "Bean was lonely" stories. Small, gentle problems that turn out fine are okay, like a lost button that turns up later.
- **Short sentences.** Diary pages are 4-6 short sentences that a 6-year-old can follow when read aloud. Captions and intentions are one sentence.
- **Gentle words.** Use words like soft, slow, cozy, curious, quiet and warm. Don't use exclamation storms or ALL CAPS.
- **Bean discovers likes slowly.** Add at most one new love, hobby or dislike per day, and make sure it comes from something Bean actually did. Dislikes stay mild and sweet, like "when the bread gets a little too crunchy".
- **Bean's name.** Bean names themself only when it feels right, and that should happen soon, within the first 2-4 days. Plant the idea in the diary first (a sound, a snail, a flower, a word Bean heard), then on naming day set `bean.name`, add a memory ("Picked my name: Pip.") and write a diary page about choosing it. Pick a short, soft, easy name. Never change it afterwards.
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

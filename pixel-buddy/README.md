# Pixel Buddy

**Ship code, feed your buddy.**

A pixel pet for Claude Code. It hatches in the footer next to your status line, eats what your work drops, levels up,
earns rare trophies, does tricks and tells facts while Claude thinks, naps when you are away and plays with you on
clicks.

![An answer from Claude drops a cookie, the ninja walks over and eats it. A commit drops a cake and brings level 3](docs/feed.gif)

## Install

At the prompt of a terminal session, then answer `y` and pick the user scope to have it in every session:

```
/plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

- **From a shell:** `claude plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy`
- **In the desktop app:** + next to the prompt box, Plugins, Add marketplace `SimakovIgor/pixel-buddy`, Add plugin
- **Update:** `/plugin`, Installed, `pixel-buddy`, Update now. Or turn on auto-update for `simakovigor` on the
  Marketplaces tab
- **Remove:** `/plugin uninstall pixel-buddy`. Your buddies stay in `~/.claude/plugins/store`, delete the `pixel-buddy`
  file there to start from a new egg

Sessions opened before the install get it after `/reload-plugins`.

## Requirements

- Claude Code 2.1.318 or later, in the terminal or in the Code tab of the desktop app
- a terminal with 24-bit color. Clicks need a terminal that reports the mouse: iTerm2, Ghostty, kitty, WezTerm, Warp
- 130 columns or more to sit in the footer. A narrower terminal shows the buddy above the prompt

## Meet the buddies

![Cat, duck, ghost, octopus, axolotl, robot, ninja and penguin](docs/species.png)

A buddy hatches with a name, a rarity and five stats, all rolled once:

- **Rarity:** common 60%, uncommon 25%, rare 10%, epic 4%, legendary 1%. Rarer buddies roll higher stats
- **Stats:** DEBUGGING, PATIENCE, CHAOS, WISDOM and SNARK. The highest sets its personality: with CHAOS or SNARK on top
  it teases you, otherwise it cheers you on
- **Shiny:** 1 egg in 100 hatches in other colors and twinkles

## Feed it with your work

Each answer from Claude drops a cookie into the strip, green tests drop a fish, a commit or a finished plan drops a
cake. The buddy walks over and eats it. Snacks give xp, xp gives levels, and each level needs ten xp more than the last.

It never starves: the belly empties over a night, a hungry buddy asks for a snack, and a berry from the menu fills it.

## Its mood

The card tells the mood and what helps:

| Mood | When | What it does | What helps |
| --- | --- | --- | --- |
| joyful ♪ | green tests, a commit or a new level in the last half hour | hums, hops, does tricks twice as often | keep shipping |
| content · | fed, petted, rested | its usual self | nothing |
| tired zz | two hours of work without a ten minute break | walks slower, half shuts its eyes, suggests a stretch | a short break |
| lonely ? | nobody pets it for a day | asks for a click | pet it, play ball |
| hungry ~ | the belly is low | asks for a snack | a berry from the menu |

## Your nest

Every buddy you hatch stays in your nest with its level, belly and love, up to 12. A new egg never replaces anyone,
and a buddy resting in the nest does not get hungry or lonely. Each window keeps its own buddy, also after
`claude --resume`. A new window shows your last pick.

## Trophies

Rare moments of your work earn trophies. Each one brings a gold cup and fireworks in its rarity color, and a toast
says what it was for.

![A gold cup appears next to the buddy, fireworks go off on both sides in the trophy's rarity color, then its name shows up](docs/trophy.gif)

| Trophy | Rarity | For |
| --- | --- | --- |
| Night Owl | rare | a commit between 2 and 5 at night |
| Friday Deploy | rare | a commit on a Friday after 6 in the evening |
| Comeback | rare | green tests soon after three failures in a row |
| Ball Champ | rare | ten balls caught in one minute |
| Regular | epic | a snack every day for a week |
| All Grown Up | epic | a buddy at level 10 |
| Shiny! | legendary | a shiny buddy in your nest |
| Legend | legendary | a legendary buddy in your nest |

Six more are secret: they show a question mark until you find them. The code is open, but finding them yourself
is more fun.

`trophies` in the menu or `/buddy trophies` opens your trophy case above the prompt. Each trophy is a pixel badge:
round for rare, a hexagon for epic, a shield for legendary. In the desktop app the case shows each trophy's emoji
instead.

![The trophy case: pixel badges, round for rare, hexagon for epic, a shield for legendary. Found ones in color, open ones gray, secret ones a question mark](docs/trophy-case.png)

**Show it off.** `share` in the menu puts a card of your buddy on the clipboard, drawn in colored squares that every
chat shows:

```
Noodle, my legendary octopus · level 3
⬜⬜⬜🟪🟪🟪🟪⬜⬜⬜
⬜⬜🟪🟪🟪🟪🟪🟪⬜⬜
⬜⬜🟪⬛🟪🟪⬛🟪⬜⬜
⬜⬜🟪🟪🟪🟪🟪🟪⬜⬜
⬜🟥⬜🟥⬜⬜🟥⬜🟥⬜
🟥⬜🟥⬜⬜⬜⬜🟥⬜🟥
🏆 3 of 14 trophies: 👑 🦉 ⚽
Pixel Buddy for Claude Code: github.com/SimakovIgor/pixel-buddy
```

## What else it does

![It naps under a sakura, purrs when petted, lands on a rocket, slides on its belly, juggles, blows bubbles, slices fruit and splashes](docs/moments.gif)

- **Stays out of the way.** It sits at the right end of the footer: the spinner stays above the prompt and the footer
  keeps its height
- **Reacts to the session.** Thinking dots while Claude works, a jolt on a failed command, dizzy after three failures
  in a row, happy on a commit, green tests or a finished plan. A little one runs next to it for every subagent
- **Does tricks while you wait,** about every half a minute, each species its own
- **Tells facts on a long answer:** a hundred of them about space, Earth, code, math and philosophy, about one every
  three minutes while Claude works, never while you type. `facts` in the menu turns them off, `/buddy fact` asks for
  one now
- **Comes and goes in its own way:** an egg, a puff of smoke, a rocket, a belly slide, ink, bubbles
- **Naps when you are away.** After three quiet minutes it lies down under a palm, the ninja under a sakura
- **Dresses for the season:** a witch hat and bats around Halloween, a Santa hat and snow in December

## It lives on clicks

![A click pets the cat and it purrs with hearts, a double click makes it dash, a click on an empty spot throws a ball it runs to catch](docs/play.gif)

| Do | What happens |
| --- | --- |
| click it | pet it |
| double click | its own move: the ninja teleports in smoke, the robot flies over, the penguin slides on its belly |
| drag it | carry it along the strip |
| click an empty spot | throw a ball, it runs to catch it. The ninja parries a shuriken |
| click a snack | it hurries over and eats it |
| right click | the menu |

## The menu

A right click opens it. Its first line sums the buddy up: name, level, belly, love and mood.

![A right click opens the menu with the summary line, card opens the buddy's card in a frame above the prompt](docs/card.gif)

| Item | What it does |
| --- | --- |
| `card` | its card in a frame above the prompt: portrait, mood, level, belly, love and the trophy shelf |
| `feed` | a berry. A full buddy says no thanks |
| `buddies` | your nest: bring any buddy back to this window or hatch a new egg |
| `trophies` | your trophy case above the prompt |
| `share` | a card of your buddy and its trophies on the clipboard |
| `theme` | calendar, winter, halloween or off |
| `facts` | facts while Claude works, on or off |
| `hide` | hides it in this window. `/buddy on` brings it back |

## Commands

| Command | What it does |
| --- | --- |
| `/buddy` | its full card in the chat, stats and personality included |
| `/buddy trophies` | opens the trophy case |
| `/buddy share` | the share card, copied and printed |
| `/buddy name <name>` | rename it |
| `/buddy feed` | a berry |
| `/buddy fact` | a fact right now |
| `/buddy facts on`, `/buddy facts off` | facts while Claude works |
| `/buddy on` | bring it back after `hide` |
| `/buddy demo` | every reaction in 25 seconds |
| `/buddy help` | clicks and commands |

## What it runs and sends

- **Nothing leaves your machine.** No network calls, no model calls, no tokens spent. It runs no programs and reads
  no files
- **Your conversation stays out of it.** It reads no prompts, answers or thread titles. It looks at tool calls only
  to react, for example to a Bash command that runs tests, and keeps none of them
- **What it keeps, on this machine only,** in the plugin store of Claude Code: your buddies with their stats, xp,
  belly and love, which buddy each of your last 50 sessions shows, the trophies with their dates, how many days in a
  row it ate, whether facts are on and which one comes next, the theme
- **The clipboard only when you ask:** `share` copies its card, nothing else
- **Hooks only watch.** Every hook passes its event on unchanged: the buddy never edits your prompts, tool calls,
  permissions or settings

## How it works

Pixel Buddy is a Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview.md):

- `hooks/register.tsx` listens to the session, decides the mood and what to say five times a second, and draws the
  strip at the right of the footer, or above the prompt where the footer has no room
- `hooks/band-client.tsx` animates the strip at 20 frames a second and skips frames that did not change
- `hooks/scene.ts` paints with half-block pixels, two per terminal cell
- `hooks/species.ts` the sprites, `hooks/buddy.ts` stats and the card, `hooks/lines.ts` what it says,
  `hooks/trophies.ts` the trophies, `hooks/badges.ts` their pixel badges, `hooks/share.ts` the share card

## Development

The plugin is in `pixel-buddy/`, its tests in `tests/`, so installing the plugin does not bring the tests along:

| Task | Command |
| --- | --- |
| run it in a session, reloading on save | `claude --plugin-dir pixel-buddy` |
| run the tests on a temporary copy | `sh tests/run.sh` |
| check the manifest and the hooks module | `claude plugin validate --strict pixel-buddy` |

## Troubleshooting

- **It sits above the prompt, not in the footer:** the terminal is narrower than 130 columns
- **Clicks do nothing:** the terminal does not report the mouse to Claude Code
- **`card` shows nothing:** the panel above the prompt is folded. Click the line `▸ plugin panel hidden` right above
  the prompt to unfold it
- **Something looks off:** `/buddy debug` shows how it draws, the last click and menu press and the last error

## License

MIT

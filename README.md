# Pixel Buddy

**Ship code, feed your buddy.**

A pixel pet for Claude Code. It hatches tiny in the footer next to your status line and grows up over three weeks,
eats what your work drops, levels up, earns rare trophies, does tricks and tells facts while Claude thinks, naps when
you are away and plays with you on clicks. Every buddy you hatch stays in your nest, and nothing leaves your machine.

![An answer from Claude drops a cookie, the ninja walks over and eats it. A commit drops a cake and brings level 3](pixel-buddy/docs/feed.gif)

## Install

1. Open Claude Code 2.1.318 or later in a terminal. Older one? Run `claude update`
2. Paste this at the prompt:

   ```
   /plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
   ```

3. Answer `y` and pick the user scope, so it hatches in every session

The egg hatches in the footer right away. In the desktop app: + next to the prompt box, Plugins, Add marketplace
`SimakovIgor/pixel-buddy`, Add plugin. Update and removal are in the plugin's [README](pixel-buddy/README.md#install).

It speaks English or Russian: pick the language when you install it, or later with a right click → settings.

If your buddy made you smile, a ⭐ helps other people find it

## A quick look

Click it to pet it, double click for its own move, click an empty spot to throw a ball:

![A click pets the cat and it purrs with hearts, a double click makes it dash, a click on an empty spot throws a ball it runs to catch](pixel-buddy/docs/play.gif)

A right click opens the menu with a summary line. `card` shows its card in a frame above the prompt:

![A right click opens the menu with the summary line, card opens the buddy's card in a frame above the prompt](pixel-buddy/docs/card.gif)

Rare moments of your work earn trophies: a commit deep in the night, a snack every day for a week, a legendary egg.
Six are secret. Each one brings a gold cup and fireworks, and `share` copies a card to show it off in any chat:

![A gold cup appears next to the buddy, fireworks go off on both sides in the trophy's rarity color, then its name shows up](pixel-buddy/docs/trophy.gif)

Your trophy case opens from the menu, a pixel badge for each trophy. All fourteen and how to earn them, the secret
ones behind a spoiler, are in [TROPHIES.md](TROPHIES.md) ([по-русски](TROPHIES.ru.md)):

![The trophy case: pixel badges, round for rare, hexagon for epic, a shield for legendary. Found ones in color, open ones gray, secret ones a question mark](pixel-buddy/docs/trophy-case.png)

In VS Code and Cursor the buddy sits right above the prompt and lives the same life as in the terminal: it strolls,
walks off to the right corner to think while Claude works, naps under its palm and walks over to eat what your work
drops. The editor does not let a click land on a picture, so four small buttons sit next to it: ❤️ pets it, 🍪 hands
it a berry, ⚾ throws a ball it runs after, `⋯` opens the same menu as a right click. `/buddy panel` puts it on the
right:

![In VS Code the octopus sits above the prompt: the ball button throws a ball and it catches it, the cookie button gets a polite no from a full belly, the heart button makes hearts](pixel-buddy/docs/vscode.gif)

Eight species, and each one comes and goes in its own way:

![Cat, duck, ghost, octopus, axolotl, robot, ninja and penguin arrive and leave: running, hatching, fading, ink, bubbles, a rocket, smoke and a belly slide](pixel-buddy/docs/arrivals.gif)

Feeding, moods, the nest, trophies, clicks, commands, what the buddy runs and sends, and troubleshooting are in the
plugin's [README](pixel-buddy/README.md).

## In this repository

- `pixel-buddy/`: the plugin, the folder people install
- `tests/`: its tests, kept outside the plugin. Run them with `sh tests/run.sh`
- `.claude-plugin/marketplace.json`: the marketplace `simakovigor` that lists the plugin

## License

MIT

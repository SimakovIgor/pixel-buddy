# Pixel Buddy

**Ship code, feed your buddy.**

A pixel pet for Claude Code. It hatches in the footer next to your status line, eats what your work drops, levels up,
earns rare trophies, does tricks while Claude thinks, naps when you are away and plays with you on clicks. Every buddy
you hatch stays in your nest, and nothing leaves your machine.

![An answer from Claude drops a cookie, the ninja walks over and eats it. A commit drops a cake and brings level 3](pixel-buddy/docs/feed.gif)

## Install

At the prompt of a terminal session:

```
/plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

Answer `y` and pick the user scope to have it in every session. Update and removal are in the plugin's
[README](pixel-buddy/README.md#install).

## A quick look

Click it to pet it, double click for its own move, click an empty spot to throw a ball:

![A click pets the cat and it purrs with hearts, a double click makes it dash, a click on an empty spot throws a ball it runs to catch](pixel-buddy/docs/play.gif)

A right click opens the menu with a summary line. `card` shows its card in a frame above the prompt:

![A right click opens the menu with the summary line, card opens the buddy's card in a frame above the prompt](pixel-buddy/docs/card.gif)

Rare moments of your work earn trophies: a commit deep in the night, a snack every day for a week, a legendary egg.
Six are secret. Each one brings a gold cup and fireworks, and `share` copies a card to show it off in any chat:

![A gold cup appears next to the buddy, fireworks go off on both sides in the trophy's rarity color, then its name shows up](pixel-buddy/docs/trophy.gif)

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

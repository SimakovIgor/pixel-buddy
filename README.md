# Pixel Buddy

**Ship code, feed your buddy.**

A pixel pet for Claude Code. It hatches in the footer next to your status line, eats what your work drops, grows a
level at a time, shows its mood, does tricks while Claude thinks, naps when you are away and plays with you on clicks.
Every buddy you hatch stays in your nest, and nothing leaves your machine.

![An answer from Claude drops a cookie, the ninja walks over and eats it. A commit drops a cake and brings level 3](pixel-buddy/docs/feed.gif)

## Install

At the prompt of a terminal session:

```
/plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

Answer `y` to add the marketplace, then pick a scope. From a shell it is
`claude plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy`. To update it:
`claude plugin update pixel-buddy@simakovigor`. To remove it: `/plugin uninstall pixel-buddy`.

## A quick look

Click it to pet it, double click for its own move, click an empty spot to throw a ball:

![A click pets the cat and it purrs with hearts, a double click makes it dash, a click on an empty spot throws a ball it runs to catch](pixel-buddy/docs/play.gif)

A right click opens the menu with a summary line. `card` shows its card in a frame above the prompt:

![A right click opens the menu with the summary line, card opens the buddy's card in a frame above the prompt](pixel-buddy/docs/card.gif)

Eight species, and each one comes and goes in its own way:

![Cat, duck, ghost, octopus, axolotl, robot, ninja and penguin arrive and leave: running, hatching, fading, ink, bubbles, a rocket, smoke and a belly slide](pixel-buddy/docs/arrivals.gif)

Feeding, moods, the nest, clicks, commands, what the buddy runs and sends, and troubleshooting are in the plugin's
[README](pixel-buddy/README.md).

## In this repository

- `pixel-buddy/`: the plugin, the folder people install
- `tests/`: its tests, kept outside the plugin. Run them with `sh tests/run.sh`
- `.claude-plugin/marketplace.json`: the marketplace `simakovigor` that lists the plugin

## License

MIT

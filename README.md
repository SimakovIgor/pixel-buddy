# Pixel Buddy

A pixel pet for Claude Code. It lives in the footer next to your status line, hatches from an egg, reacts to what
Claude does, shows tricks while you wait, naps when you are away and plays with you on clicks.

![Pixel Buddy in the Claude Code footer: the spinner stays right above the prompt, the ninja slices fruit next to the status line](pixel-buddy/docs/footer.png)

## Install

At the prompt of a terminal session:

```
/plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

Answer `y` to add the marketplace, then pick a scope. From a shell it is
`claude plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy`. To update it:
`claude plugin update pixel-buddy@simakovigor`. To remove it: `/plugin uninstall pixel-buddy`.

![Cat, duck, ghost, octopus, axolotl, robot, ninja and penguin](pixel-buddy/docs/species.png)

Clicks, commands, what the buddy runs and sends, and troubleshooting are in the plugin's
[README](pixel-buddy/README.md).

## In this repository

- `pixel-buddy/`: the plugin, the folder people install
- `tests/`: its tests, kept outside the plugin. Run them with `sh tests/run.sh`
- `.claude-plugin/marketplace.json`: the marketplace `simakovigor` that lists the plugin

## License

MIT

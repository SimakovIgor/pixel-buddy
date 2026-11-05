# Pixel Buddy

A pixel pet for Claude Code. It lives in the footer next to your status line, hatches from an egg, reacts to what
Claude does, shows tricks while you wait, naps when you are away and plays with you on clicks.

![Pixel Buddy in the Claude Code footer: the spinner stays right above the prompt, the ninja slices fruit next to the status line](docs/footer.png)

## Install

At the prompt of a terminal session:

```
/plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

Answer `y` to add the marketplace, then pick a scope: the user scope keeps the buddy in every session. It shows up in
the current session right away, other open sessions get it after `/reload-plugins`.

From a shell:

```
claude plugin install pixel-buddy --marketplace SimakovIgor/pixel-buddy
```

In the desktop app, click + next to the prompt box, then Plugins, Add marketplace with `SimakovIgor/pixel-buddy`, then
Add plugin.

## Update

Each release raises the version in `plugin.json`. A plugin from this marketplace does not update by itself until you
turn that on: in `/plugin`, open the Marketplaces tab, select `simakovigor` and choose Enable auto-update. To update now,
open `pixel-buddy` on the Installed tab of `/plugin` and choose Update now, or run
`claude plugin update pixel-buddy@simakovigor` from a shell. The new version loads after `/reload-plugins` or in the next
session.

## Uninstall

At the prompt of a terminal session, or with `claude plugin uninstall pixel-buddy` from a shell:

```
/plugin uninstall pixel-buddy
```

To drop the marketplace as well: `/plugin marketplace remove simakovigor`. The buddy itself stays in Claude Code's
plugin store under `~/.claude/plugins/store`: delete its `pixel-buddy` file there to start again from a new egg.

## Requirements

- Claude Code 2.1.318 or later, in the terminal or in the Code tab of the desktop app
- a terminal with 24-bit color. Clicks need a terminal that reports the mouse: iTerm2, Ghostty, kitty, WezTerm, Warp
- 130 columns or more to sit in the footer. A narrower terminal shows the buddy above the prompt

## Meet the buddies

![Cat, duck, ghost, octopus, axolotl, robot, ninja and penguin](docs/species.png)

Eight species, five rarities, a name and stats of its own. One buddy per machine, shared by all your sessions.

## What it does

![It naps under a sakura, purrs when petted, lands on a rocket flame, slides on its belly, juggles and blows bubbles](docs/moments.png)

- **Stays out of the way.** It sits at the right end of the footer, so Claude's spinner stays right above the prompt and
  the footer keeps its height
- **Comes and goes in its own way.** The duck and the penguin hatch from an egg and waddle away, the ninja appears and
  vanishes in a puff of smoke, the robot lands on a rocket flame and flies off, the cat runs in and out, the ghost
  fades in and out, the octopus uses ink and the axolotl bubbles
- **Reacts to the session.** Thinking dots while Claude works, a jolt on a failed command, dizzy when the same thing
  fails three times in a row, happy on a commit, green tests or a finished plan. A little one runs next to it for
  every subagent
- **Does tricks while you wait.** About every half a minute: the ninja slices flying fruit, the octopus juggles, the
  axolotl blows bubbles, the penguin sings, the cat chases a butterfly, the duck splashes, the ghost says boo and the
  robot scans the floor with a laser
- **Naps when you are away.** After three quiet minutes it lies down under a palm, the ninja under a sakura. When you
  come back or Claude starts working, it hops up and the tree fades away
- **Tells you who waits.** Buddies of your other sessions on this machine visit your strip. When one of those sessions
  waits for your answer or permission, its buddy waves with a `!` next to the task key from its branch, or its folder.
  Click it to see when Claude finished there or what it needs permission for. A session still working in the background
  does not count as waiting
- **Dresses for the season.** A witch hat and bats around Halloween, a Santa hat and snow in December. The ninja slices
  pumpkins or tangerines then

## It lives on clicks

| Do | What happens |
| --- | --- |
| click it | pet it, or close the note it shows |
| double click | its own move: the ninja teleports in smoke, the robot flies over, the duck dives, the penguin slides on its belly, the cat dashes, the ghost fades over, the octopus goes through ink, the axolotl through bubbles |
| drag it | carry it along the strip, a light trail of fading copies follows it |
| click an empty spot | throw a ball, it runs to catch it. The ninja parries a shuriken |
| right click | the menu: `card` with stats and personality, `change buddy`, `theme`, `hide` |
| click the `!` buddies on the left | which of your sessions wait for you and what Claude asked there |

## Commands

Only for what a click cannot do:

| Command | What it does |
| --- | --- |
| `/buddy` | its card: portrait, stats, personality |
| `/buddy name <name>` | rename it |
| `/buddy on` | bring it back after `hide`, which hides it in the current session only |
| `/buddy help` | the list of clicks and commands |
| `/buddy demo` | every reaction in 25 seconds |

## What it runs and sends

- **Nothing leaves your machine.** No network calls, no model calls, no tokens spent
- **It runs no programs.** To show the branch and its task key it reads the `.git/HEAD` file of the session's
  repository, or for a worktree the `.git` file and the `HEAD` it points to
- **What it keeps, on this machine only,** in the plugin store of Claude Code: the buddy, the theme, and a short status
  of each open session so your other sessions can show who waits for you. That status holds the folder, the branch, the
  task key from the branch name, whether the session works or waits, and Claude Code's permission notice such as
  `Claude needs your permission to use Bash`. The entry of a closed session is removed after a day
- **Your conversation stays out of it.** It reads no prompts, answers or thread titles. It looks at tool calls only to
  react, for example to a Bash command that runs tests, and keeps none of them
- **Hooks only watch.** Every hook passes its event on unchanged: the buddy never edits your prompts, tool calls,
  permissions or settings. The `/buddy` command is the one it adds

## How it works

Pixel Buddy is a Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview.md): a hooks module and a
`Client` module that animates in the terminal.

- `hooks/register.tsx` listens to the session: turns, tool calls, the end of a turn with its background work,
  permission prompts, clicks. It draws the strip in the `SessionMode` render site at the right of the footer and falls
  back to the band above the prompt where the footer has no room
- `hooks/band-client.tsx` runs the strip at 20 frames a second: walking, chasing the cursor, catching the ball,
  dragging
- `hooks/scene.ts` paints everything with half-block pixels, two pixels per terminal cell
- `hooks/species.ts` holds the sprites, `hooks/buddy.ts` the stats and the card, `hooks/lines.ts` what it says

## Development

The repository holds the plugin in `pixel-buddy/` and its tests in `tests/`, outside the plugin, so installing the
plugin does not bring the tests along. From the root of a clone:

| Task | Command |
| --- | --- |
| run the plugin in a session, reloading on save | `claude --plugin-dir pixel-buddy` |
| run the tests on a temporary copy of the plugin | `sh tests/run.sh` |
| check the manifest and the hooks module | `claude plugin validate --strict pixel-buddy` |

## Troubleshooting

- **It sits above the prompt, not in the footer:** the terminal is narrower than 130 columns
- **Clicks do nothing:** the terminal does not report the mouse to Claude Code
- **A session opened before the install has no buddy:** run `/reload-plugins` there
- **Something looks off:** `/buddy debug` shows how it draws and the last error it met

## License

MIT

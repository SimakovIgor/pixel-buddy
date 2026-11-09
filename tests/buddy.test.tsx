import { expect, mock, test } from 'claude-code/testing'

import { BABY_DAYS, GROWTH_SINCE, YOUNG_DAYS, cardOf, fullnessOf, growthOf, hatch, levelOf, vibeOf } from './buddy'
import type { Buddy } from './buddy'
import { isTestRun } from './register'
import { BUBBLE_MS, DEFAULT, colorsOf as speciesColorsOf, paint } from './scene'
import { SPECIES, SPRITE_W } from './species'
import { cellsSvgOf } from './vscode'
import { commitTrophiesAt, nextTally } from './trophies'
import { FACTS, FACT_PART_MAX, factOf, sayingMsOf } from './facts'
import { setLanguage } from './i18n'
import { shareOf } from './share'
import { trophyCaseOf } from './badges'
import BuddyBand from './band-client'
import type { BandProps } from './band-client'
import type { View } from './scene'

const BAND = {
    plugin: 'pixel-buddy',
    component: 'SessionMode',
    surface: 'terminal',
    props: { modes: [] },
    viewport: { columns: 164, rows: 40, isFullscreen: true },
} as const

const ABOVE = {
    plugin: 'pixel-buddy',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const realPause = (ms: number): Promise<void> =>
    new Promise(resolve => (globalThis as unknown as { setTimeout: (done: () => void, ms: number) => unknown }).setTimeout(resolve, ms))

type On = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]

const stubEngine = (on: On, clock = () => Date.now(), hasFrames = false) => {
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('clock.every', () => (hasFrames ? { value: undefined } : { deny: 'no frames in this test' }))
    on('clock.now', () => ({ value: clock() }))
    on('clock.sleep', () => ({ value: undefined }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
}

const spansOf = (svg: string, fill: string): Array<{ x: number; w: number }> =>
    [...svg.matchAll(new RegExp(`<path(?: class="pale")? fill="${fill}" d="([^"]*)"`, 'g'))]
        .flatMap(found => [...(found[1] ?? '').matchAll(/M(\d+) \d+h(\d+)/g)].map(run => ({ x: Number(run[1]), w: Number(run[2]) })))

test('a new session hatches a buddy above the prompt and keeps it', async ($, on) => {
    stubEngine(on)
    let stored: unknown
    on('store.get', () => ({ value: stored }))
    on('store.set', (_, e) => {
        stored = (e as { value: unknown }).value

        return { value: undefined }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)

    expect(await ui.find({ type: 'Client', key: 'buddy-band' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', in: 'buddy-band' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /others/ })).toBeTruthy()
    expect(stored).toBeTruthy()
    await ui.unmount()
})

test('/buddy prints the card of the stored buddy in the chat and opens no side panel', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({
        value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 },
    }))

    let panes = 0
    on('ui.open', () => {
        panes += 1

        return { value: { isPlaced: true } }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toContain('Mochi · cat · ★★★☆☆ rare')
    expect(result.text).toContain('stars are rarity, rolled at hatching: common 60% · uncommon 25% · rare 10% · epic 4% · legendary 1%')
    expect(result.text).toContain('DEBUGGING █████████░  90  ← highest, sets the personality')
    expect(panes).toBe(0)
})

test('a click on the buddy pets him and he answers in a bubble', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.pointer({ type: 'down', x: 56, y: 1, button: 'left', in: 'buddy-band' })
    await ui.pointer({ type: 'up', x: 56, y: 1, button: 'left', in: 'buddy-band' })

    expect(await ui.find({ type: 'Text', text: /╭/, in: 'buddy-band' })).toBeTruthy()
    await ui.unmount()
})

test('/buddy off plays the way out, then the buddy is gone', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'duck', rarity: 'common', stats: { DEBUGGING: 9, PATIENCE: 9, CHAOS: 9, WISDOM: 9, SNARK: 90 }, hatchedAt: 0 } }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.command.run({ command: 'buddy', args: 'off' } as Parameters<typeof $.command.run>[0])
    const leaving = await $.ui.mount(BAND)
    const onTheWay = await leaving.find({ type: 'Client' })
    await leaving.unmount()
    now += 2000
    const gone = await $.ui.mount(BAND)

    expect(JSON.stringify(onTheWay)).toContain('"leave":{"species":"duck"')
    expect(await gone.find({ type: 'Raster' })).toBeFalsy()
    expect(await gone.find({ type: 'Client' })).toBeFalsy()
    await gone.unmount()
})

test('/buddy hatch with an unknown species lists the species', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'hatch dog' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('No such species. There are: cat, duck, ghost, octopus, axolotl, robot, ninja, penguin')
})

test('/buddy jump waits for the band and then jumps inside it', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const before = await $.command.run({ command: 'buddy', args: 'jump' } as Parameters<typeof $.command.run>[0])
    const ui = await $.ui.mount(BAND)
    const after = await $.command.run({ command: 'buddy', args: 'jump' } as Parameters<typeof $.command.run>[0])

    expect(before.text).toBe('Not enough room to jump')
    expect(after.text).toBe('Jump!')
    await ui.unmount()
})

test('the buddy turns to the cursor and runs after it along the band', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const before = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.pointer({ type: 'move', x: 5, y: 1, in: 'buddy-band' })
    await realPause(300)
    await ui.advance(1500)
    const after = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(after).not.toBe(before)
    await ui.unmount()
})

test('/buddy theme with a capital and a comma still runs the command', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'Theme, winter' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('Santa hat on, snow is falling')
})

test('a caught ball makes the buddy answer in a bubble', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'duck', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'caught', kind: 'ball' }, { in: 'buddy-band' })

    expect(await ui.find({ type: 'Text', text: /╭/, in: 'buddy-band' })).toBeTruthy()
    await ui.unmount()
})

test('/buddy theme goes around calendar, winter, halloween and off', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const replies = []
    for (const step of [1, 2, 3, 4]) {
        replies.push((await $.command.run({ command: 'buddy', args: 'theme' } as Parameters<typeof $.command.run>[0])).text)
        void step
    }

    expect(replies).toEqual(['Santa hat on, snow is falling', 'Boo! Witch hat on', 'No theme', 'Theme follows the calendar'])
})

test('a new egg from the menu keeps the old buddy in the nest with its level, and it can come back', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    const mochi = { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 1, xp: 42, belly: { value: 70, at: now }, affection: { value: 80, at: now } }
    const store: Record<string, unknown> = { buddy: mochi }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    const main = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'nest' }, { in: 'buddy-band' })
    const nestPage = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'new' }, { in: 'buddy-band' })
    const species = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'hatch:octopus' }, { in: 'buddy-band' })
    await ui.redraw()
    const swap = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    const afterHatch = { buddy: petIn(store), mochi: store['pet:1'] }
    now += 5 * 3600000
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'nest' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'pick:1' }, { in: 'buddy-band' })
    await ui.unmount()

    expect(main).toContain('"buddies"')
    expect(nestPage).toContain('"Mochi"')
    expect(nestPage).toContain('"lv3"')
    expect(nestPage).toContain('"egg"')
    expect(species).toContain('"octopus"')
    expect(afterHatch.buddy).toMatchObject({ species: 'octopus', xp: 0 })
    expect(afterHatch.mochi).toMatchObject({ name: 'Mochi', xp: 42 })
    expect(swap).toContain('"leave":{"species":"cat"')
    expect(petIn(store)).toMatchObject({ name: 'Mochi', xp: 42, belly: { value: 70, at: now }, affection: { value: 80, at: now } })
    expect(Object.keys(store).filter(key => key.startsWith('pet:'))).toHaveLength(2)
})

test('if the chosen buddy cannot be read, the latest one comes back instead of a new egg', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { main: 999, 'pet:3': { ...NOODLE, hatchedAt: 3, name: 'Old' }, 'pet:7': { ...NOODLE, hatchedAt: 7, xp: 90 } }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])

    expect(card.text).toContain('Noodle · ninja')
    expect(card.text).toContain('level 4')
    expect(Object.keys(store).filter(key => key.startsWith('pet:'))).toEqual(['pet:3', 'pet:7'])
})

test('the nest holds twelve buddies, then it asks to pick one instead of hatching', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE, nest: Array.from({ length: 11 }, (_, i) => ({ ...NOODLE, hatchedAt: i + 10 })) }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'hatch cat' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('Your nest is full: 12 buddies')
    expect(Object.keys(store).filter(key => key.startsWith('pet:'))).toHaveLength(12)
})

test('a random egg hatches a species you do not have yet, one of each species', async ($, on) => {
    stubEngine(on)
    const others = ['cat', 'duck', 'ghost', 'octopus', 'axolotl', 'robot'].map((species, i) => ({ ...NOODLE, species, hatchedAt: i + 10 }))
    const store: Record<string, unknown> = { buddy: NOODLE, nest: others }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'hatch' } as Parameters<typeof $.command.run>[0])
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('Hatching… Noodle waits in your nest')
    expect(card.text).toContain('· penguin')
})

test('asking for a species you have brings that buddy back from the nest instead of a second one', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE, nest: [{ ...NOODLE, name: 'Mochi', species: 'cat', hatchedAt: 10 }] }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const again = await $.command.run({ command: 'buddy', args: 'hatch ninja' } as Parameters<typeof $.command.run>[0])
    const back = await $.command.run({ command: 'buddy', args: 'hatch cat' } as Parameters<typeof $.command.run>[0])
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])

    expect(again.text).toBe('Noodle is your ninja already, one of each species')
    expect(back.text).toBe('You have a cat already: Mochi comes back from the nest')
    expect(card.text).toContain('Mochi · cat')
    expect(Object.keys(store).filter(key => key.startsWith('pet:'))).toHaveLength(2)
})

test('with every species in the nest a new egg does not hatch', async ($, on) => {
    stubEngine(on)
    const others = ['cat', 'duck', 'ghost', 'octopus', 'axolotl', 'robot', 'penguin'].map((species, i) => ({ ...NOODLE, species, hatchedAt: i + 10 }))
    const store: Record<string, unknown> = { buddy: NOODLE, nest: others }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'hatch' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('You have one of every species already. Menu → buddies brings any of them back')
    expect(Object.keys(store).filter(key => key.startsWith('pet:'))).toHaveLength(8)
})

test('a right click anywhere on the band opens the menu, a second one closes it', async ($, on) => {
    stubEngine(on)
    on('store.get', (_, e) => ({ value: (e as { key: string }).key === 'buddy' ? { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } : undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.pointer({ type: 'down', x: 20, y: 1, button: 'right', in: 'buddy-band' })
    await ui.pointer({ type: 'up', x: 20, y: 1, button: 'right', in: 'buddy-band' })
    const opened = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.pointer({ type: 'down', x: 20, y: 1, button: 'right', in: 'buddy-band' })
    const closed = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(opened).toContain('"trophies"')
    expect(closed).not.toContain('"trophies"')
    await ui.unmount()
})

test('left alone, the buddy lies down under its tree with closed eyes and gets up when you come back', async ($, on) => {
    let now = Date.now() - 10000
    stubEngine(on, () => now)
    on('store.get', () => ({ value: { name: 'Noodle', species: 'ninja', rarity: 'common', stats: { DEBUGGING: 20, PATIENCE: 23, CHAOS: 89, WISDOM: 13, SNARK: 63 }, hatchedAt: 0 } }))
    on('store.set', () => ({ value: undefined }))
    on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))
    const closedEyes = '#b98a66'

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    now += 4 * 60 * 1000
    await ui.redraw()
    await ui.advance(100)
    const asleep = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await $.prompt.submit({ text: "I'm back" } as Parameters<typeof $.prompt.submit>[0])
    await ui.redraw()
    await ui.advance(100)
    const awake = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(asleep).toContain(closedEyes)
    expect(awake).not.toContain(closedEyes)
    await ui.unmount()
})

const NOODLE = { name: 'Noodle', species: 'ninja', rarity: 'common', stats: { DEBUGGING: 20, PATIENCE: 23, CHAOS: 89, WISDOM: 13, SNARK: 63 }, hatchedAt: 0 } as const

test('in VS Code the bubble text takes the editor theme color and a pale buddy gets a faint outline, so both read on a light theme', () => {
    const view: View = {
        t: 1000, cols: 40, species: 'ghost', rarity: 'common', mood: 'idle', moodAge: 0,
        pose: { x: 24, isFacingLeft: false, isWalking: false, lookX: 0, lift: 0 },
        bubble: { text: 'hi there', age: 3000 }, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null,
        action: null, toy: null, spark: null, season: null, menu: null,
        nap: null, trail: [], leave: null, food: null, isShiny: false, vibe: 'content', trophy: null, isEditor: true,
    }
    const editor = cellsSvgOf(paint(view), 40, 3, 8)
    const terminal = cellsSvgOf(paint({ ...view, isEditor: false }), 40, 3, 8)

    expect(editor).toContain('fill="currentColor">there</text>')
    expect(terminal).not.toContain('fill="currentColor">there</text>')
    expect(editor).toContain('<path class="pale" fill="')
})

test('a bubble said on waking up is drawn over the fading tree, its frame whole', () => {
    const view: View = {
        t: 1000, cols: 64, species: 'ninja', rarity: 'common', mood: 'idle', moodAge: 0,
        pose: { x: 40, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 },
        bubble: { text: 'hi there', age: 2000 }, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null,
        action: null, toy: null, spark: null, season: null, menu: null,
        nap: { x: 40, age: 9000, wokeAge: 100 }, trail: [], leave: null, food: null, isShiny: false, vibe: 'content', trophy: null,
    }
    const cells = paint(view)
    const middleRow = Array.from({ length: 64 }, (_, x) => String.fromCodePoint(cells[(64 + x) * 3] ?? 0x20)).join('')

    expect(middleRow).toContain('│ hi there ├─')
})

test('every species does its own trick beside it while it works', () => {
    const working = (species: View['species'], action: View['action']): string => {
        const view: View = {
            t: 2000, cols: 64, species, rarity: 'common', mood: 'tool', moodAge: 0,
            pose: { x: 34, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 },
            bubble: null, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null,
            action, toy: null, spark: null, season: null, menu: null, nap: null, trail: [], leave: null, food: null, isShiny: false, vibe: 'content', trophy: null,
        }

        return [...paint(view)].join(',')
    }
    const plain = SPECIES.filter(one => one.id !== 'ninja').map(one => working(one.id, null))
    const tricked = SPECIES.filter(one => one.id !== 'ninja').map(one => working(one.id, { kind: 'trick', age: 1500 }))

    expect(tricked.filter((frame, i) => frame === plain[i])).toEqual([])
    expect(tricked).toHaveLength(7)
})


type DrawnNode = { type?: string; props?: { width?: number }; children?: unknown[]; part?: { plugin?: string } }

const isSizedAboveEngine = (node: DrawnNode, isSized = false): boolean =>
    node.part?.plugin === 'test'
        ? isSized
        : (node.children ?? []).some(child =>
            typeof child === 'object' && child !== null && isSizedAboveEngine(child as DrawnNode, isSized || (node.type === 'Box' && node.props?.width !== undefined)))

test('the buddy runs at the right of the footer, so the spinner line stays right above the prompt', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const under = await $.ui.mount(BAND)
    now += 2000
    const above = await $.ui.mount(ABOVE)

    expect(await under.find({ type: 'Client', key: 'buddy-band' })).toBeTruthy()
    expect(await under.find({ type: 'Text', text: /others/ })).toBeTruthy()
    expect(isSizedAboveEngine(await under.drawn() as DrawnNode)).toBe(false)
    expect(await above.find({ type: 'Client', key: 'buddy-band' })).toBeUndefined()
    await above.unmount()
    await under.unmount()
})

test('where the footer is not drawn, the buddy stays above the prompt', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const above = await $.ui.mount(ABOVE)
    const early = await above.find({ type: 'Client', key: 'buddy-band' })
    now += 2000
    await above.redraw()
    const late = await above.find({ type: 'Client', key: 'buddy-band' })

    expect(early).toBeUndefined()
    expect(late).toBeTruthy()
    await above.unmount()
})

test('in a narrow terminal the footer has no room, so the buddy stays above the prompt', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const footer = await $.ui.mount({ ...BAND, viewport: { columns: 110, rows: 40, isFullscreen: true } })
    now += 2000
    const above = await $.ui.mount(ABOVE)

    expect(await footer.find({ type: 'Client', key: 'buddy-band' })).toBeUndefined()
    expect(await above.find({ type: 'Client', key: 'buddy-band' })).toBeTruthy()
    await above.unmount()
    await footer.unmount()
})

const footerView = (overrides: Partial<View>): View => ({
    t: 1000, cols: 49, species: 'ninja', rarity: 'common', mood: 'idle', moodAge: 0,
    pose: { x: 38, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 },
    bubble: null, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null, action: null, toy: null,
    spark: null, season: null, menu: null, nap: null, trail: [], leave: null, food: null, isShiny: false, vibe: 'content', trophy: null,
    ...overrides,
})

const rowOf = (view: View, row: number): string => {
    const cells = paint(view)

    return Array.from({ length: view.cols }, (_, x) => String.fromCodePoint(cells[(row * view.cols + x) * 3] ?? 0x20)).join('')
}

test('a buddy hatched after growth came out is a baby for a week, young until three weeks, then grown up; older buddies stay grown up', () => {
    const born = GROWTH_SINCE + 1000
    const day = 24 * 3600000

    expect([0, BABY_DAYS - 0.1, BABY_DAYS, YOUNG_DAYS - 0.1, YOUNG_DAYS].map(days => growthOf({ hatchedAt: born }, born + days * day))).toEqual(['baby', 'baby', 'young', 'young', 'adult'])
    expect(growthOf({ hatchedAt: GROWTH_SINCE - 1000 }, GROWTH_SINCE)).toBe('adult')
})

test('a baby is drawn smaller than a young buddy, a young one smaller than a grown up, and the card says when it grows', () => {
    const pixels = (growth: 'baby' | 'young' | 'adult') => {
        const cells = paint(footerView({ species: 'cat', growth }))

        return Array.from({ length: cells.length / 3 }, (_, at) => cells[at * 3 + 1]).filter(color => color !== DEFAULT).length
    }
    const born = GROWTH_SINCE + 1000
    const card = cardOf({ ...NOODLE, species: 'cat', hatchedAt: born }, born + 2 * 24 * 3600000)

    expect(pixels('baby')).toBeLessThan(pixels('young'))
    expect(pixels('young')).toBeLessThan(pixels('adult'))
    expect(card).toContain('a baby, grows up a bit in 5 d')
})

test('the octopus juggles around itself: the balls on the far half of the circle pass behind it and never cover its head', () => {
    const headOf = (cells: Uint32Array) => Array.from({ length: SPRITE_W }, (_, dx) => (38 + dx) * 3).flatMap(at => {
        const glyph = cells[at]
        const fg = cells[at + 1]
        const bg = cells[at + 2]

        return glyph === 0x2584 ? [bg, fg] : glyph === 0x2588 ? [fg, fg] : glyph === 0x2580 ? [fg, bg] : [bg, bg]
    })
    const plain = headOf(paint(footerView({ species: 'octopus' })))
    const frames = Array.from({ length: 26 }, (_, k) => paint(footerView({ species: 'octopus', action: { kind: 'trick', age: 200 + k * 90 } })))
    const covered = frames.map(cells => headOf(cells).filter((color, at) => plain[at] !== DEFAULT && color !== plain[at]).length)

    expect(covered).toEqual(Array.from({ length: 26 }, () => 0))
    expect(frames.filter(cells => cells.some((value, at) => value !== paint(footerView({ species: 'octopus' }))[at]))).not.toHaveLength(0)
})

test('in the desktop app the bubble is plain text on a fill, the terminal keeps the frame', () => {
    const view = footerView({ cols: 64, species: 'ghost', pose: { x: 40, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: { text: 'boo~', age: 2000 } })
    const plain = { ...view, isDesktop: true }
    const cells = paint(plain)
    const text = rowOf(plain, 1).indexOf('boo~')
    const backAt = (x: number) => cells[(1 * plain.cols + x) * 3 + 2]

    expect([0, 1, 2].map(row => rowOf(plain, row)).join('')).not.toMatch(/[╭╮╰╯│├┤]/)
    expect(text).toBeGreaterThan(0)
    expect(backAt(text)).not.toBe(backAt(0))
    expect(rowOf(view, 1)).toContain('│ boo~')
})

const paletteIn = (view: View): Set<number> => {
    const cells = paint(view)

    return new Set(Array.from({ length: cells.length / 3 }, (_, at) => [cells[at * 3 + 1] ?? 0, cells[at * 3 + 2] ?? 0]).flat())
}

test('in the desktop app a happy bounce moves the buddy by whole rows, so no gap opens between its pixel rows', () => {
    const at = (t: number, isDesktop: boolean) => paint(footerView({ cols: 64, species: 'octopus', mood: 'love', moodAge: 800, t, isDesktop }))

    expect(at(1400, true)).toEqual(at(1540, true))
    expect(at(1400, false)).not.toEqual(at(1540, false))
})

test('crumbs keep the snack color while they fly and then vanish, instead of turning dark', () => {
    const snack = footerView({ cols: 64, species: 'cat', food: { kind: 'cookie', x: 20, y: 5, eatenAge: null } })
    const flying = footerView({ cols: 64, species: 'cat', food: { kind: 'cookie', x: 20, y: 5, eatenAge: 300 } })
    const known = paletteIn(snack)

    expect([...paletteIn(flying)].filter(color => !known.has(color))).toEqual([])
})

test('in the desktop app a fading buddy melts away pixel by pixel instead of turning dark on the light panel', () => {
    const idle = paletteIn(footerView({ cols: 64, species: 'ghost', isDesktop: true }))
    const leaving = paletteIn(footerView({ cols: 64, species: 'ghost', isDesktop: true, leave: { species: 'ghost', age: 300 } }))
    const leavingInTerminal = paletteIn(footerView({ cols: 64, species: 'ghost', leave: { species: 'ghost', age: 300 } }))

    expect([...leaving].filter(color => !idle.has(color))).toEqual([])
    expect([...leavingInTerminal].filter(color => !idle.has(color)).length).toBeGreaterThan(0)
})

test('in the desktop app the bubble keeps its fill to the end instead of darkening', () => {
    const backOf = (age: number) => {
        const view = footerView({ cols: 64, species: 'ghost', isDesktop: true, bubble: { text: 'boo~', age } })
        const x = rowOf(view, 1).indexOf('boo~')

        return paint(view)[(view.cols + x) * 3 + 2]
    }

    expect(backOf(BUBBLE_MS - 300)).toBe(backOf(2000))
})

test('the band tells the client to drop the bubble frame on the desktop and keep it in the terminal', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const desktop = await $.ui.mount({ ...ABOVE, surface: 'desktop' })
    const onDesktop = JSON.stringify(await desktop.find({ type: 'Client', key: 'buddy-band' }) ?? null)
    await desktop.unmount()
    const terminal = await $.ui.mount(BAND)
    const inTerminal = JSON.stringify(await terminal.find({ type: 'Client', key: 'buddy-band' }) ?? null)
    await terminal.unmount()

    expect(onDesktop).toContain('"isDesktop":true')
    expect(inTerminal).toContain('"isDesktop":false')
})

test('a bubble waits out the jump instead of covering the buddy where it lands', () => {
    const said = { text: 'blub', age: 2000 }
    const landed = footerView({ cols: 64, species: 'octopus', pose: { x: 40, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: said, jump: { age: 1200, fromX: 40, toX: 26 } })
    const after = footerView({ cols: 64, species: 'octopus', pose: { x: 26, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: said })

    expect([0, 1, 2].map(row => rowOf(landed, row)).join('\n')).not.toContain('blub')
    expect([0, 1, 2].map(row => rowOf(after, row)).join('\n')).toContain('blub')
})

test('a bubble keeps clear of the subagents running behind the buddy', () => {
    const view = footerView({ cols: 64, pose: { x: 4, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, agents: 2, bubble: { text: 'minions deployed', age: 5000 } })

    expect(rowOf(view, 1)).toContain('─┤ minions deployed')
})

test('dragging leaves a light trail of fading copies behind the buddy, gone after half a second', () => {
    const still = footerView({ cols: 64, pose: { x: 34, isFacingLeft: false, isWalking: true, lookX: 0, lift: -1 } })
    const frame = (view: View): string => [...paint(view)].join(',')

    expect(frame({ ...still, trail: [{ x: 31, age: 60 }, { x: 28, age: 160 }] })).not.toBe(frame(still))
    expect(frame({ ...still, trail: [{ x: 31, age: 500 }] })).toBe(frame(still))
})

test('every species comes in and goes away its own way, not as a plain frame and not as nothing', () => {
    const ids = SPECIES.map(one => one.id)
    const frame = (view: View): string => [...paint(view)].join(',')
    const here = (species: View['species']): View => footerView({ cols: 64, species, pose: { x: 30, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 } })
    const empty = frame({ ...here('cat'), leave: { species: 'cat', age: 99999 }, hatchAge: -1 })
    const shown = (view: View, still: View): boolean => frame(view) !== frame(still) && frame(view) !== empty

    expect(ids.filter(id => shown({ ...here(id), hatchAge: 450 }, here(id)))).toEqual(ids)
    expect(ids.filter(id => shown({ ...here(id), leave: { species: id, age: 500 } }, here(id)))).toEqual(ids)
})

test('on session start the buddy arrives when the band is first drawn, not before anyone can see it', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    now += 5000
    const ui = await $.ui.mount(BAND)

    expect(JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))).toContain(`"hatchAt":${now}`)
    await ui.unmount()
})

const colorsOf = (view: View, row: number): number[] => {
    const cells = paint(view)

    return Array.from({ length: view.cols }, (_, x) => [cells[(row * view.cols + x) * 3 + 1] ?? 0, cells[(row * view.cols + x) * 3 + 2] ?? 0]).flat()
}

test('a bubble on the right of the buddy has its frame in one line: the corner and the joint share a column', () => {
    const view = footerView({ cols: 64, pose: { x: 4, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: { text: 'hai!', age: 5000 } })

    expect(rowOf(view, 1)).toContain('─┤ hai! │')
    expect(rowOf(view, 0).indexOf('╭')).toBe(rowOf(view, 1).indexOf('┤'))
})

test('petting shows clear hearts and the happy bounce keeps the top of the buddy, the ninja hood stays', () => {
    const loved = footerView({ cols: 64, mood: 'love', t: 1120, hearts: [300] })
    const hood = 0x2b2d42

    const overHead = (paint(loved)[(0 * 64 + 38 + 3) * 3 + 1] ?? 0)

    expect(rowOf(loved, 0) + rowOf(loved, 1) + rowOf(loved, 2)).toContain('♥')
    expect(overHead).toBe(hood)
})

test('a double click is the own move of each species: the robot rides a flame, the ninja goes in smoke', () => {
    const jumping = (species: View['species'], age: number): View => footerView({ cols: 64, species, jump: { age, fromX: 10, toX: 30 } })
    const flame = 0xff7a1a

    expect([0, 1, 2].flatMap(row => colorsOf(jumping('robot', 300), row))).toContain(flame)
    expect([0, 1, 2].flatMap(row => colorsOf(jumping('ninja', 300), row))).not.toContain(flame)
})

test('after a double click every species stands at its new spot and is gone from the old one', () => {
    const ids = SPECIES.map(one => one.id)
    const isThere = (view: View, x: number): boolean => [0, 1, 2].some(row => /[▀▄]/.test(rowOf(view, row).slice(x, x + 10)))
    const landed = ids.filter(id => {
        const view = footerView({ cols: 64, species: id, jump: { age: 1590, fromX: 10, toX: 30 } })

        return isThere(view, 30) && !isThere(view, 10)
    })

    expect(landed).toEqual(ids)
})

test('the frame of a bubble stays whole while the buddy sparkles with joy next to it', () => {
    const frames = Array.from({ length: 40 }, (_, i) => footerView({
        cols: 64, mood: 'happy', t: 1000 + i * 160, pose: { x: 4, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: { text: 'hai!', age: 5000 },
    }))
    const broken = frames.filter(view => !rowOf(view, 0).includes('╭──────╮') || !rowOf(view, 1).includes('─┤ hai! │') || !rowOf(view, 2).includes('╰──────╯'))

    expect(broken).toHaveLength(0)
})

test('a ball thrown at the very edge of the strip is caught too, the buddy does not freeze next to it', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { ...NOODLE, species: 'penguin' } }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.pointer({ type: 'down', x: 63, y: 1, button: 'left', in: 'buddy-band' })
    await ui.pointer({ type: 'up', x: 63, y: 1, button: 'left', in: 'buddy-band' })
    await realPause(450)
    await ui.advance(100)

    expect(await ui.find({ type: 'Text', text: /╭/, in: 'buddy-band' })).toBeTruthy()
    await ui.unmount()
})

const storeOn = (on: On, store: Record<string, unknown>) => {
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', (_, e) => {
        const { key, value } = e as { key: string; value: unknown }
        store[key] = value

        return { value: undefined }
    })
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('store.delete', (_, e) => {
        delete store[(e as { key: string }).key]

        return { value: undefined }
    })
}

const petIn = (store: Record<string, unknown>): Buddy | undefined => store[`pet:${String(store.main)}`] as Buddy | undefined

test('test runs are told apart from builds, excluded tests and pipes that hide the exit code', () => {
    const runs = ['./gradlew test', 'cd service && ./gradlew functionalTest', 'go test ./...', 'cargo test', 'pytest -q', 'npx jest', 'vitest run', 'npm run test', 'mvn -q verify']
    const notRuns = ['npm run build', './gradlew build -x test', './gradlew test | tail -50', 'git commit -m test', 'ls tests']

    expect(runs.filter(command => !isTestRun(command))).toEqual([])
    expect(notRuns.filter(isTestRun)).toEqual([])
})

test('keys older versions kept, session entries among them, are removed from the store at start', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE, theme: 'off', lang: 'ru', tropic: true, 'session:old': { status: 'waiting', title: 'Refunds for Jane Doe' } }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    expect(Object.keys(store).sort()).toEqual(['main', 'pet:0', 'theme'])
})

test('a long turn the person interrupted is not celebrated, a long answered one is', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))
    const turn = async (reason: 'aborted' | 'answer') => {
        await $.turn.start({ text: 'go', turnId: reason } as Parameters<typeof $.turn.start>[0])
        now += 120000
        await $.turn.complete({ turnId: reason, reason } as unknown as Parameters<typeof $.turn.complete>[0])
    }

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await turn('aborted')
    await ui.redraw()
    const interrupted = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await turn('answer')
    await ui.redraw()
    const answered = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))

    expect(interrupted).not.toContain('"mood":"happy"')
    expect(answered).toContain('"mood":"happy"')
    await ui.unmount()
})

test('a buddy stored as the removed bali bird comes back as a penguin, not as a crash', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { ...NOODLE, species: 'bird' } }))
    on('store.set', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)

    expect(JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))).toContain('"species":"penguin"')
    await ui.unmount()
})

test('a bubble wipes trick glyphs under it', () => {
    const bubbled = footerView({ cols: 64, species: 'axolotl', mood: 'tool', pose: { x: 4, isFacingLeft: false, isWalking: false, lookX: 0, lift: 0 }, action: { kind: 'trick', age: 400 }, bubble: { text: 'hi there', age: 5000 } })

    expect(rowOf(bubbled, 1)).toContain('─┤ hi there │')
})

test('an open menu redraws the strip once, not on every frame', async ($, on) => {
    let now = Date.now()
    let redraws = 0
    stubEngine(on, () => now, true)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => {
        redraws += 1

        return { value: undefined }
    })
    const frame = async () => {
        now += 2000
        await $.prompt.submit({ text: 'next' } as Parameters<typeof $.prompt.submit>[0])
    }
    on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await frame()
    await frame()
    const settled = redraws
    await frame()
    await frame()

    expect(settled).toBeGreaterThan(0)
    expect(redraws).toBe(settled)
    await ui.unmount()
})

test('levels need ten xp more each time, and the card shows how far the next one is', () => {
    expect([0, 9, 10, 29, 30, 100].map(xp => levelOf(xp))).toEqual([
        { level: 1, into: 0, need: 10 },
        { level: 1, into: 9, need: 10 },
        { level: 2, into: 0, need: 20 },
        { level: 2, into: 19, need: 20 },
        { level: 3, into: 0, need: 30 },
        { level: 5, into: 0, need: 50 },
    ])
    const card = cardOf({ ...NOODLE, xp: 33, belly: { value: 20, at: 0 } } as Buddy, 0)
    expect(card).toContain('level 3   ▰▱▱▱▱▱▱▱▱▱ 3/30 xp, earned from your work')
    expect(card).toContain('belly     ██░░░░░░░░ 20%, hungry: /buddy feed')
    expect(card.split('\n').at(-1)).toBe('like your buddy? a ⭐ on github.com/SimakovIgor/pixel-buddy helps others find it')
})

test('the belly empties slowly over hours, never below zero, and a new egg starts full', () => {
    const hour = 3600000
    const fed = { ...NOODLE, belly: { value: 100, at: 0 } } as Buddy

    expect(fullnessOf(fed, 5 * hour)).toBe(60)
    expect(fullnessOf(fed, 48 * hour)).toBe(0)
    expect(fullnessOf(NOODLE as Buddy, 0)).toBe(60)
    expect(hatch(() => 0.5, 0)).toMatchObject({ xp: 0, belly: { value: 100, at: 0 }, isShiny: false })
    expect(hatch(() => 0.001, 0).isShiny).toBe(true)
})

const snackOf = async (ui: { find: (query: object) => Promise<unknown> }): Promise<{ kind: string; at: number } | null> => {
    const found = /"snack":\{"kind":"(\w+)","at":(\d+)\}/.exec(JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' })))

    return found === null ? null : { kind: found[1] ?? '', at: Number(found[2]) }
}

test('an answer from Claude drops a cookie, and eating it gives xp and fills the belly in the store', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, xp: 9, belly: { value: 50, at: now } } }
    storeOn(on, store)
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    now += 5000
    await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', text: 'done' } as unknown as Parameters<typeof $.turn.complete>[0])
    await ui.redraw()
    const snack = await snackOf(ui)
    await ui.post({ type: 'ate', at: snack?.at ?? 0, kind: 'cookie', isHanded: false }, { in: 'buddy-band' })
    await ui.redraw()

    expect(snack?.kind).toBe('cookie')
    expect(petIn(store)).toMatchObject({ xp: 10, belly: { value: 56, at: now } })
    expect(await snackOf(ui)).toBeNull()
    expect(JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))).toContain('"text":"level 2!"')
    await ui.unmount()
})

test('the buddy walks to a fallen snack and eats it by itself', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, xp: 0, belly: { value: 10, at: Date.now() } } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.command.run({ command: 'buddy', args: 'feed' } as Parameters<typeof $.command.run>[0])
    await ui.redraw()
    for (let elapsed = 0; elapsed < 3500 && petIn(store)?.xp === 0; elapsed += 50) {
        await realPause(50)
        await ui.advance(50)
    }

    expect(petIn(store)?.belly?.value).toBeGreaterThan(20)
    expect(petIn(store)?.xp).toBe(1)
    await ui.unmount()
})

test('/buddy feed gives a berry to a hungry buddy, a full one says no thanks', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, belly: { value: 95, at: now } } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.command.run({ command: 'buddy', args: 'feed' } as Parameters<typeof $.command.run>[0])
    await ui.redraw()
    const full = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    store.buddy = { ...NOODLE, belly: { value: 10, at: now } }
    await $.command.run({ command: 'buddy', args: 'hatch ninja' } as Parameters<typeof $.command.run>[0])
    await ui.unmount()

    expect(full).toContain('so full')
    expect(full).toContain('"snack":null')
})

test('a hungry buddy asks for a snack once, not every few minutes', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now, true)
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 10, at: now } } })
    on('ui.invalidate', () => ({ value: undefined }))
    const asks: number[] = []

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    for (const minutes of [0, 2, 2, 2, 2, 2]) {
        now += minutes * 60000 + 3000
        await ui.post({ type: 'jump' }, { in: 'buddy-band' })
        await ui.advance(300)
        await ui.redraw()
        const band = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
        asks.push(/eat a whole build|review your PR/.test(band) ? 1 : 0)
    }
    await ui.unmount()

    expect(asks[0] + (asks[1] ?? 0)).toBe(1)
    expect(asks.slice(2)).toEqual([0, 0, 0, 0])
})

test('a shiny buddy wears other colors and twinkles, and its card says so', () => {
    const plain = footerView({ cols: 64, species: 'cat', t: 1000 })
    const shiny = { ...plain, isShiny: true }

    expect([...paint(shiny)].join(',')).not.toBe([...paint(plain)].join(','))
    expect(cardOf({ ...NOODLE, isShiny: true } as Buddy, 0)).toContain('✦ shiny, 1 in 100')
})


test('the mood says what matters most first: hunger, then tiredness, then loneliness, then joy', () => {
    const fine = { fullness: 80, affection: 50, workedMs: 0, joy: null }

    expect(vibeOf({ ...fine, fullness: 10, workedMs: 3 * 3600000 })).toEqual({ vibe: 'hungry', why: 'belly 10%, work or /buddy feed fills it' })
    expect(vibeOf({ ...fine, workedMs: 2 * 3600000 + 600000, affection: 10 })).toEqual({ vibe: 'tired', why: '2h 10m of work without a break, a short walk helps' })
    expect(vibeOf({ ...fine, affection: 10, joy: { what: 'a commit', agoMs: 1000 } }).vibe).toBe('lonely')
    expect(vibeOf({ ...fine, joy: { what: 'green tests', agoMs: 12 * 60000 } })).toEqual({ vibe: 'joyful', why: 'green tests 12 min ago' })
    expect(vibeOf({ ...fine, joy: { what: 'green tests', agoMs: 31 * 60000 } }).vibe).toBe('content')
    expect(vibeOf({ ...fine, affection: 90 })).toEqual({ vibe: 'joyful', why: 'well fed and loved' })
})

test('the card has a little portrait, the mood with its reason and how loved the buddy is', () => {
    const card = cardOf({ ...NOODLE, species: 'ghost', affection: { value: 40, at: 0 } } as Buddy, 0, { vibe: 'tired', why: '2h 5m of work without a break, a short walk helps' }).split('\n')

    expect(card.slice(0, 3).every(line => /^[ ▀▄█]{10}   /.test(line))).toBe(true)
    expect(card[2]).toContain('mood: tired zz 2h 5m of work without a break, a short walk helps')
    expect(card).toContain('love      ████░░░░░░ 40%, grows when you pet it or play ball')
})

test('petting and playing ball make the buddy feel loved, and the store keeps it', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, affection: { value: 20, at: now } } }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'pet' }, { in: 'buddy-band' })
    await ui.post({ type: 'caught', kind: 'ball' }, { in: 'buddy-band' })
    await ui.unmount()

    expect(petIn(store)).toMatchObject({ affection: { value: 33, at: now } })
})

test('two hours of work without a break make it tired, a break of ten minutes rests it', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 90, at: now }, affection: { value: 50, at: now } } })
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))
    const vibe = async (ui: { find: (query: object) => Promise<unknown> }) => /"vibe":"(\w+)"/.exec(JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' })))?.[1]
    const work = async (minutes: number) => {
        for (let done = 0; done < minutes; done += 5) {
            await $.turn.start({ text: 'go', turnId: `t${now}` } as Parameters<typeof $.turn.start>[0])
            now += 5 * 60000
            await $.turn.complete({ turnId: `t${now}`, reason: 'aborted' } as unknown as Parameters<typeof $.turn.complete>[0])
        }
    }

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await work(115)
    await ui.redraw()
    const fresh = await vibe(ui)
    await work(10)
    await ui.redraw()
    const tired = await vibe(ui)
    now += 12 * 60000
    await work(5)
    await ui.redraw()
    const rested = await vibe(ui)
    await ui.unmount()

    expect([fresh, tired, rested]).toEqual(['content', 'tired', 'content'])
})

test('a commit makes it joyful: it hums and does tricks more often', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 60, at: now }, affection: { value: 50, at: now } } })
    on('tool.call', () => ({ result: 'ok', isError: false }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' } as unknown as Parameters<typeof $.tool.call>[0])
    await ui.redraw()
    const band = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.unmount()
    const idle = footerView({ cols: 64, species: 'cat', t: 100 })

    expect(band).toContain('"vibe":"joyful"')
    expect(rowOf({ ...idle, vibe: 'joyful' }, 0)).toContain('♪')
    expect(rowOf(idle, 0)).not.toContain('♪')
})

test('a tired buddy keeps its eyes half shut', () => {
    const idle = footerView({ cols: 64, species: 'cat', t: 1500 })

    expect([...paint({ ...idle, vibe: 'tired' })].join(',')).not.toBe([...paint(idle)].join(','))
})

test('the right click menu starts with a summary line, card opens one framed card with the trophy shelf above the prompt, pressing it again keeps it, hide card closes it', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const toasts: string[] = []
    on('ui.toast', (_, e) => {
        toasts.push((e as { text: string }).text)

        return { value: undefined }
    })
    storeOn(on, { buddy: { ...NOODLE, xp: 12, belly: { value: 80, at: now }, affection: { value: 60, at: now } }, trophies: { 'night-owl': now } })
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const above = await $.ui.mount(ABOVE)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const menu = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
    await above.redraw()
    const card = JSON.stringify(await above.find({ key: 'buddy-card' }) ?? null)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
    await above.redraw()
    const again = await above.find({ key: 'buddy-card' })
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const menuOpen = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'card-close' }, { in: 'buddy-band' })
    await above.redraw()
    const closed = await above.find({ key: 'buddy-card' })
    await ui.unmount()
    await above.unmount()

    expect(menu).toContain('"header":"Noodle · lv 2 ▰▱▱▱▱ · belly 80% · love 60% · content ·"')
    expect(card).toContain('Noodle')
    expect(card).toContain('content: fed, petted, rested')
    expect(card).toContain('"borderStyle":"round"')
    expect(card).toContain('trophies 🦉 ')
    expect(card).toContain('menu → trophies')
    expect(card).toContain('a ⭐ on github.com/SimakovIgor/pixel-buddy helps others find it')
    expect(toasts[0]).toBe('Card opened above the prompt. Don\'t see it? Click the "▸ plugin panel hidden" line right above the prompt')
    expect(again).toBeTruthy()
    expect(menuOpen).toContain('"label":"hide card"')
    expect(closed).toBeUndefined()
})

test('a new window shows the last pick, a pick in a window stays with that window after resume', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = {
        main: 1,
        homes: { '/work/api': 2 },
        'pet:1': { ...NOODLE, hatchedAt: 1, name: 'Pixel', species: 'cat' },
        'pet:2': { ...NOODLE, hatchedAt: 2, name: 'Byte', species: 'robot' },
    }
    storeOn(on, store)
    let session = 'window-a'
    on('session.id', () => ({ value: session }))
    on('ui.invalidate', () => ({ value: undefined }))
    const cardNow = async () => (await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])).text

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const fresh = await cardNow()
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'nest' }, { in: 'buddy-band' })
    const nestPage = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'pick:2' }, { in: 'buddy-band' })
    await ui.unmount()
    session = 'window-b'
    store.main = 1
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const other = await cardNow()
    session = 'window-a'
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const resumed = await cardNow()

    expect(fresh).toContain('Pixel · cat')
    expect(nestPage).toContain('"window"')
    expect(other).toContain('Pixel · cat')
    expect(resumed).toContain('Byte · robot')
    expect(store.seats).toEqual({ 'window-a': 2, 'window-b': 1 })
    expect(store.homes).toBeUndefined()
})

test('if nothing draws above the prompt, the card goes to the chat instead, and a drawn card does not', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now, true)
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: now }, affection: { value: 60, at: now } } })
    on('ui.invalidate', () => ({ value: undefined }))
    const lines: string[] = []
    on('ui.log', (_, e) => {
        lines.push((e as { text: string }).text)

        return { value: undefined }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const above = await $.ui.mount(ABOVE)
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
    await above.redraw()
    now += 2000
    await ui.advance(400)
    const whenDrawn = lines.length
    await above.unmount()
    now += 100
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
    now += 2000
    await ui.advance(400)
    await ui.redraw()
    const band = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.unmount()

    expect(whenDrawn).toBe(0)
    expect(lines).toHaveLength(6)
    expect(lines[0]).toContain('Noodle · ninja')
    expect(band).toContain('here is my card, in the chat')
})

test('hiding the buddy says how to bring it back', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: NOODLE })
    const toasts: string[] = []
    on('ui.toast', (_, e) => {
        toasts.push((e as { text: string }).text)

        return { value: undefined }
    })
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'off' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('Noodle is hiding. /buddy on brings it back')
    expect(toasts).toEqual(['Noodle is hiding in this window. /buddy on brings it back'])
})

const trophiesIn = (store: Record<string, unknown>): string[] => Object.keys((store.trophies ?? {}) as object)

const toastsOn = (on: On): string[] => {
    const toasts: string[] = []
    on('ui.toast', (_, e) => {
        toasts.push((e as { text: string }).text)

        return { value: undefined }
    })

    return toasts
}

test('a commit earns a trophy only at its own hour: deep night, Friday evening, 13:37, Halloween, New Year\'s Eve', () => {
    expect(commitTrophiesAt(new Date(2026, 10, 3, 3, 10))).toEqual(['night-owl'])
    expect(commitTrophiesAt(new Date(2026, 10, 6, 19, 0))).toEqual(['friday'])
    expect(commitTrophiesAt(new Date(2026, 10, 3, 13, 37))).toEqual(['leet'])
    expect(commitTrophiesAt(new Date(2026, 9, 31, 11, 0))).toEqual(['spooky'])
    expect(commitTrophiesAt(new Date(2026, 11, 31, 23, 50))).toEqual(['new-year'])
    expect(commitTrophiesAt(new Date(2027, 0, 1, 0, 20))).toEqual(['new-year'])
    expect(commitTrophiesAt(new Date(2026, 10, 3, 12, 0))).toEqual([])
    expect(commitTrophiesAt(new Date(2026, 10, 3, 5, 0))).toEqual([])
})

test('the streak of days with a snack grows day by day, stays the same within a day and starts over after a gap', () => {
    const monday = new Date(2026, 10, 2, 10, 0).getTime()
    const day = 24 * 3600000
    const first = nextTally({ day: '', streak: 0 }, monday)
    const second = nextTally(first, monday + day)

    expect(first).toEqual({ day: '2026-11-02', streak: 1 })
    expect(nextTally(first, monday + 3600000)).toEqual(first)
    expect(second.streak).toBe(2)
    expect(nextTally(second, monday + 3 * day).streak).toBe(1)
})

test('a commit deep in the night earns Night Owl once: a toast, fireworks, then its name, and the store keeps it', async ($, on) => {
    let now = new Date(2026, 10, 4, 3, 12).getTime()
    stubEngine(on, () => now, true)
    const store: Record<string, unknown> = { buddy: { ...NOODLE } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))
    on('tool.call', () => ({ result: 'ok', isError: false }))
    const toasts = toastsOn(on)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    now += 5000
    await ui.advance(200)
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' } as unknown as Parameters<typeof $.tool.call>[0])
    now += 200
    await ui.advance(200)
    await ui.redraw()
    const fireworks = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    now += 2000
    await ui.advance(200)
    await ui.redraw()
    const named = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "y"' } as unknown as Parameters<typeof $.tool.call>[0])
    now += 5000
    await ui.advance(200)
    await ui.unmount()

    expect(trophiesIn(store)).toEqual(['night-owl'])
    expect(toasts).toEqual(['🦉 Trophy: Night Owl, rare, for a commit between 2 and 5 at night. 1 of 14 found. Menu → share to show it off'])
    expect(fireworks).toContain('"trophy":{"rarity":"rare"')
    expect(named).toContain('"text":"Night Owl!"')
})

test('a legendary and a shiny buddy already in the nest earn Legend and Shiny! on the next start, a plain one earns nothing', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = {
        'pet:1': { ...NOODLE, hatchedAt: 1 }, 'pet:2': { ...NOODLE, rarity: 'legendary', hatchedAt: 2 }, 'pet:3': { ...NOODLE, isShiny: true, hatchedAt: 3 }, main: 1,
    }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'trophies' } as Parameters<typeof $.command.run>[0])

    expect(trophiesIn(store)).toEqual(['shiny', 'legend'])
    expect(result.text).toBe('2 of 14 trophies, the case is open above the prompt. Don\'t see it? Click "▸ plugin panel hidden" there')
})

test('green tests soon after three failures in a row earn Comeback, a duck petted then earns Rubber Duck', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, species: 'duck' } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))
    on('tool.call', (_, e) => ({ result: 'x', isError: (e as { command: string }).command === 'false' }))
    const run = (command: string) => $.tool.call({ tool: 'Bash', command } as unknown as Parameters<typeof $.tool.call>[0])

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await run('npm test')
    const before = trophiesIn(store)
    await run('false')
    await run('false')
    await run('false')
    await run('npm test')
    await ui.post({ type: 'pet' }, { in: 'buddy-band' })
    await ui.unmount()

    expect(before).toEqual([])
    expect(trophiesIn(store)).toEqual(['comeback', 'rubber-duck'])
})

test('a ninja earns Ball Champ with ten shurikens caught within a minute', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    for (let k = 0; k < 10; k++) {
        await ui.post({ type: 'caught', kind: 'shuriken' }, { in: 'buddy-band' })
    }
    await ui.unmount()

    expect(trophiesIn(store)).toEqual(['ball'])
})

test('ten balls caught within a minute earn Ball Champ, nine do not', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, species: 'cat' } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    for (let k = 0; k < 9; k++) {
        await ui.post({ type: 'caught', kind: 'ball' }, { in: 'buddy-band' })
    }
    const nine = trophiesIn(store)
    await ui.post({ type: 'caught', kind: 'ball' }, { in: 'buddy-band' })
    await ui.unmount()

    expect(nine).toEqual([])
    expect(trophiesIn(store)).toEqual(['ball'])
})

test('the 42nd answer of a session earns Deep Thought', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE } }
    storeOn(on, store)
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))
    const answer = async (k: number) => {
        await $.turn.start({ text: 'go', turnId: `t${k}` } as Parameters<typeof $.turn.start>[0])
        await $.turn.complete({ turnId: `t${k}`, reason: 'answer', answer: 'ok', text: 'ok' } as unknown as Parameters<typeof $.turn.complete>[0])
    }

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    for (let k = 1; k < 42; k++) {
        await answer(k)
    }
    const before = trophiesIn(store)
    await answer(42)

    expect(before).toEqual([])
    expect(trophiesIn(store)).toEqual(['deep-thought'])
})

test('a snack on the seventh day in a row earns Regular', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const yesterday = new Date(now - 24 * 3600000)
    const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const store: Record<string, unknown> = { buddy: { ...NOODLE, belly: { value: 50, at: now } }, tally: { day, streak: 6 } }
    storeOn(on, store)
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', text: 'done' } as unknown as Parameters<typeof $.turn.complete>[0])
    await ui.redraw()
    const snack = await snackOf(ui)
    await ui.post({ type: 'ate', at: snack?.at ?? 0, kind: 'cookie', isHanded: false }, { in: 'buddy-band' })
    await realPause(50)
    await ui.unmount()

    expect(store.tally).toMatchObject({ streak: 7 })
    expect(trophiesIn(store)).toEqual(['regular'])
})

test('a trophy brings a gold cup and fireworks on both sides of the buddy, and leaves nothing behind', () => {
    const quiet = footerView({ cols: 64, pose: { x: 27, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 } })
    const still = paint(quiet)
    const changedColumns = (view: View): number[] => {
        const cells = paint(view)

        return Array.from({ length: cells.length / 3 }, (_, i) => i)
            .filter(i => cells[i * 3] !== still[i * 3] || cells[i * 3 + 1] !== still[i * 3 + 1] || cells[i * 3 + 2] !== still[i * 3 + 2])
            .map(i => i % view.cols)
    }
    const party = { ...quiet, trophy: { rarity: 'rare' as const, age: 900 } }
    const changed = changedColumns(party)

    expect([...paint(party)]).toContain(0xffcf3f)
    expect([...still]).not.toContain(0xffcf3f)
    expect(changed.some(x => x < 25)).toBe(true)
    expect(changed.some(x => x > 47)).toBe(true)
    expect(changedColumns({ ...quiet, trophy: { rarity: 'rare', age: 3700 } })).toEqual([])
})

test('eight subagents running at once earn Hive Mind, seven do not', async ($, on) => {
    let now = Date.now()
    let running = 7
    stubEngine(on, () => now, true)
    const store: Record<string, unknown> = { buddy: { ...NOODLE } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))
    on('agent.list', () => ({ value: Array.from({ length: running }, (_, k) => ({ id: `a${k}`, status: 'running' })) }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    now += 1000
    await ui.advance(1000)
    const seven = trophiesIn(store)
    running = 8
    now += 1000
    await ui.advance(1000)
    await ui.unmount()

    expect(seven).toEqual([])
    expect(trophiesIn(store)).toEqual(['hive'])
})

test('the snack that brings a buddy to level 10 earns All Grown Up', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, xp: 449, belly: { value: 50, at: now } } }
    storeOn(on, store)
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const before = trophiesIn(store)
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', text: 'done' } as unknown as Parameters<typeof $.turn.complete>[0])
    await ui.redraw()
    const snack = await snackOf(ui)
    await ui.post({ type: 'ate', at: snack?.at ?? 0, kind: 'cookie', isHanded: false }, { in: 'buddy-band' })
    await realPause(50)
    await ui.unmount()

    expect(before).toEqual([])
    expect(trophiesIn(store)).toEqual(['grown'])
})

test('the share card draws the buddy in colored squares, says its rarity, level and trophies, and links the repo', () => {
    const lines = shareOf({ ...NOODLE, name: 'Mochi', species: 'cat', rarity: 'rare', xp: 12 } as Buddy, { 'night-owl': 5, legend: 2 }).split('\n')
    const grid = lines.slice(1, 7)

    expect(lines[0]).toBe('Mochi, my rare cat · level 2')
    expect(grid.map(row => [...row].length)).toEqual([10, 10, 10, 10, 10, 10])
    expect(grid[3]).toBe('🟫⬜🟧⬛🟧🟧🟧⬛🟧⬜')
    expect(grid[5]).toBe('⬜⬜⬜🟫🟧🟧🟧🟫⬜⬜')
    expect(lines[7]).toBe('🏆 2 of 14 trophies: 👑 🦉')
    expect(lines[8]).toBe('Pixel Buddy for Claude Code: github.com/SimakovIgor/pixel-buddy')
    expect(shareOf({ ...NOODLE, species: 'ghost' } as Buddy, {}).split('\n')[2]).toBe('🟦🟦⬜⬜⬜⬜⬜⬜🟦🟦')
})

test('share in the menu puts the card on the clipboard and says so, /buddy share prints it when nothing could be copied', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))
    const toasts = toastsOn(on)
    const copies: string[] = []
    let isCopying = true
    on('ui.copy', (_, e) => {
        copies.push((e as { text: string }).text)

        return { value: isCopying ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'share' }, { in: 'buddy-band' })
    isCopying = false
    const printed = await $.command.run({ command: 'buddy', args: 'share' } as Parameters<typeof $.command.run>[0])
    await ui.unmount()

    expect(copies).toHaveLength(2)
    expect(copies[0]).toContain('Noodle, my common ninja · level 1')
    expect(toasts).toEqual(['A card of Noodle is on your clipboard: paste it in any chat to show it off'])
    expect(printed.text).toBe(`Copy it from here:\n\n${copies[1]}`)
})

test('the trophy case paints found badges in their rarity color with their picture, open ones gray, and fits the width', () => {
    const colorsOf = (cells: Uint32Array) => new Set(Array.from({ length: cells.length / 3 }, (_, i) => [cells[i * 3 + 1], cells[i * 3 + 2]]).flat())
    const textOf = (made: { cells: Uint32Array; columns: number; rows: number }) => Array.from({ length: made.rows }, (_, row) =>
        Array.from({ length: made.columns }, (_, x) => String.fromCodePoint(made.cells[(row * made.columns + x) * 3] ?? 0x20)).join('')).join('\n')
    const none = trophyCaseOf({}, 84)
    const owl = trophyCaseOf({ 'night-owl': 1 }, 84)
    const narrow = trophyCaseOf({}, 40)

    expect([none.columns, none.rows]).toEqual([82, 13])
    expect([...colorsOf(none.cells)]).not.toContain(0x4aa8ff)
    expect([...colorsOf(owl.cells)]).toContain(0x4aa8ff)
    expect([...colorsOf(owl.cells)]).toContain(0x9a6a46)
    expect([owl.cells[6 * 3 + 1], none.cells[6 * 3 + 1]]).toEqual([0x4aa8ff, 0x4a4d5e])
    expect(textOf(none)).toContain('Night Owl')
    expect(textOf(none)).toContain('???')
    expect(textOf(none)).not.toContain('1337')
    expect(narrow.columns).toBeLessThanOrEqual(40)
})

test('/buddy trophies and trophies in the menu open the case above the prompt, a sent prompt closes it', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE }, trophies: { 'night-owl': 1 } })
    on('ui.invalidate', () => ({ value: undefined }))
    on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))
    const toasts = toastsOn(on)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const above = await $.ui.mount(ABOVE)
    await $.command.run({ command: 'buddy', args: 'trophies' } as Parameters<typeof $.command.run>[0])
    await above.redraw()
    const fromCommand = JSON.stringify(await above.find({ key: 'trophy-case' }) ?? null)
    await $.prompt.submit({ text: 'next' } as Parameters<typeof $.prompt.submit>[0])
    await above.redraw()
    const afterPrompt = await above.find({ key: 'trophy-case' })
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const menu = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'trophies' }, { in: 'buddy-band' })
    await above.redraw()
    const fromMenu = await above.find({ type: 'Raster', key: 'trophy-badges' })
    await ui.unmount()
    await above.unmount()

    expect(fromCommand).toContain('"key":"trophy-badges"')
    expect(fromCommand).toContain('the latest: Night Owl')
    expect(afterPrompt).toBeUndefined()
    expect(menu).toContain('"label":"trophies"')
    expect(fromMenu).toBeTruthy()
    expect(toasts[0]).toBe('Trophy case opened above the prompt. Don\'t see it? Click the "▸ plugin panel hidden" line right above the prompt')
})

test('on the desktop the trophy case is a grid of emoji and names, found ones in color, open ones gray, secret ones a question mark', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE }, trophies: { 'night-owl': 1 } })
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'desktop' })
    await $.command.run({ command: 'buddy', args: 'trophies' } as Parameters<typeof $.command.run>[0])
    await above.redraw()
    const shown = JSON.stringify(await above.find({ key: 'trophy-case' }) ?? null)
    await above.unmount()

    expect(shown).toContain('🦉 Night Owl')
    expect(shown).toContain('"color":"#4aa8ff"')
    expect(shown).toContain('○  Friday')
    expect(shown).toContain('?  ???')
    expect(shown).not.toContain('1337')
    expect(shown).not.toContain('"type":"Raster"')
})

test('on the desktop the band is drawn in the monospaced face and the bubble without a frame', () => {
    const band: BandProps = {
        cols: 64, rows: 3, species: 'octopus', rarity: 'common', mood: 'idle', moodAt: 0, isWorking: false, typingAt: 0,
        bubble: { text: 'crunch!', at: Date.now() - 2000 }, hearts: [], agents: 0, hatchAt: null, leave: null, jumpAt: null, action: null,
        season: null, menu: null, snack: null, isShiny: false, vibe: 'content', trophy: null, isDesktop: true,
    }
    const texts: { mono?: boolean; children?: unknown }[] = []
    const elements = {
        Box: (props: object) => ({ type: 'Box', props }),
        Text: (props: { mono?: boolean; children?: unknown }) => {
            texts.push(props)

            return { type: 'Text', props }
        },
    }
    const surface = { state: undefined, setState: () => undefined, every: () => undefined, onPointer: () => undefined, post: () => undefined, elements }

    BuddyBand(band, surface as unknown as Parameters<typeof BuddyBand>[1])

    expect(texts.length).toBeGreaterThan(3)
    expect(texts.filter(text => text.mono !== true)).toEqual([])
    expect(texts.map(text => String(text.children)).join('')).toContain('crunch!')
    expect(texts.map(text => String(text.children)).join('')).not.toMatch(/[╭╮╰╯│├┤]/)
})

test('the band drawing says it is alive when it has sent nothing else for a while, never on top of a click', () => {
    const band: BandProps = {
        cols: 64, rows: 3, species: 'octopus', rarity: 'common', mood: 'idle', moodAt: 0, isWorking: false, typingAt: 0,
        bubble: null, hearts: [], agents: 0, hatchAt: null, leave: null, jumpAt: null, action: null,
        season: null, menu: null, snack: null, isShiny: false, vibe: 'content', trophy: null, isDesktop: false,
    }
    const posts: unknown[] = []
    let tickFn = () => undefined as void
    let pointerFn = (_: object) => undefined as void
    const elements = { Box: (props: object) => ({ type: 'Box', props }), Text: (props: object) => ({ type: 'Text', props }) }
    const surface = {
        state: undefined,
        setState: () => undefined,
        every: (_: number, fn: () => void) => {
            tickFn = fn
        },
        onPointer: (fn: (event: object) => void) => {
            pointerFn = fn
        },
        post: (data: unknown) => posts.push(data),
        elements,
    }

    BuddyBand(band, surface as unknown as Parameters<typeof BuddyBand>[1])
    tickFn()
    tickFn()
    const quiet = [...posts]
    posts.length = 0
    const fresh = { ...surface, state: undefined }
    BuddyBand(band, fresh as unknown as Parameters<typeof BuddyBand>[1])
    pointerFn({ type: 'down', button: 'right', x: 60, y: 1 })
    tickFn()

    expect(quiet).toEqual([{ type: 'alive' }])
    expect(posts).toEqual([{ type: 'menu', key: 'open' }])
})

test('a band drawing that stops answering for 15 seconds is started again under a new key', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: clock.now() }, affection: { value: 60, at: clock.now() } } })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'alive' }, { in: 'buddy-band' })
    await clock.advance(10000)
    await ui.post({ type: 'alive' }, { in: 'buddy-band' })
    await clock.advance(10000)
    await ui.redraw()
    const answering = (await ui.find({ type: 'Client' }))?.key
    await clock.advance(6000)
    await ui.redraw()
    const restarted = (await ui.find({ type: 'Client' }))?.key
    const debug = await $.command.run({ command: 'buddy', args: 'debug' } as Parameters<typeof $.command.run>[0])
    await ui.unmount()

    expect(answering).toBe('buddy-band')
    expect(restarted).toBe('buddy-band-1')
    expect(JSON.stringify(debug)).toContain('restarted 1 times after it stopped answering')
    expect(JSON.stringify(debug)).toContain('clicks heard: 0')
})

test('a band drawing that never answers is started again 15 seconds after it was drawn, three times at most', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: clock.now() }, affection: { value: 60, at: clock.now() } } })
    const keyAfter = async (ms: number) => {
        await clock.advance(ms)
        await ui.redraw()

        return (await ui.find({ type: 'Client' }))?.key
    }

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const first = await keyAfter(14000)
    const second = await keyAfter(2000)
    const third = await keyAfter(16000)
    const fourth = await keyAfter(16000)
    const last = await keyAfter(16000)
    const debug = await $.command.run({ command: 'buddy', args: 'debug' } as Parameters<typeof $.command.run>[0])
    await ui.unmount()

    expect([first, second, third, fourth, last]).toEqual(['buddy-band', 'buddy-band-1', 'buddy-band-2', 'buddy-band-3', 'buddy-band-3'])
    expect(JSON.stringify(debug)).toContain('restarted 3 times after it stopped answering, gave up')
})

test('a buddy hidden for a while is not taken for a drawing that stopped answering', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.toast', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: clock.now() }, affection: { value: 60, at: clock.now() } } })
    const buddy = (args: string) => $.command.run({ command: 'buddy', args } as Parameters<typeof $.command.run>[0])

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'alive' }, { in: 'buddy-band' })
    await buddy('off')
    await clock.advance(70000)
    await buddy('on')
    await clock.advance(1000)
    await ui.redraw()
    const shown = (await ui.find({ type: 'Client' }))?.key
    await ui.unmount()

    expect(shown).toBe('buddy-band')
})

test('every fact fits the bubble in parts of 30 characters, and all of them come once before any repeats', () => {
    const tooLong = FACTS.flat().filter(part => [...part].length > FACT_PART_MAX)
    const round = new Set(Array.from({ length: FACTS.length }, (_, step) => factOf(step)))

    expect(tooLong).toEqual([])
    expect(round.size).toBe(FACTS.length)
})

test('a line longer than the room by the buddy slides along to its end instead of being cut', () => {
    const at = (age: number) => rowOf(footerView({ cols: 64, pose: { x: 27, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, bubble: { text: 'Olympus Mons on Mars is about', age } }), 1)

    expect(at(400)).toContain('│ Olympus Mons')
    expect(at(6000)).toContain('│ Mons on Mars is about ├─')
    expect(at(6000)).not.toContain('…')
})

const turnOn = (on: On) => {
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('ui.invalidate', () => ({ value: undefined }))
}

type Band = { advance: (ms: number) => Promise<unknown>; redraw: () => Promise<unknown>; find: (query: { type: string; key: string }) => Promise<unknown> }

const bandAt = async (ui: Band) => {
    await ui.advance(300)
    await ui.redraw()

    return JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
}

test('half a minute into a long answer the buddy tells a fact part by part, then waits two minutes before the next one', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now, true)
    const store: Record<string, unknown> = { buddy: { ...NOODLE }, facts: { next: 4 } }
    storeOn(on, store)
    turnOn(on)
    const [first = '', second = ''] = factOf(4)
    const [next = ''] = factOf(5)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await $.turn.start({ text: 'go', turnId: 'long' } as Parameters<typeof $.turn.start>[0])
    now += 25000
    const early = await bandAt(ui)
    now += 10000
    const told = await bandAt(ui)
    now += sayingMsOf(first) + 100
    const followed = await bandAt(ui)
    now += 60000
    const later = await bandAt(ui)
    await ui.unmount()

    expect(early).not.toContain(first)
    expect(told).toContain(first)
    expect(followed).toContain(second)
    expect(later).not.toContain(next)
    expect(store.facts).toEqual({ next: 5, isOff: false })
})

test('facts in the settings menu turn them off for good, the store keeps it, and a long answer then passes in silence', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now, true)
    const store: Record<string, unknown> = { buddy: { ...NOODLE }, facts: { next: 0 } }
    storeOn(on, store)
    turnOn(on)
    const [first = ''] = factOf(0)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'settings' }, { in: 'buddy-band' })
    const menu = await bandAt(ui)
    await ui.post({ type: 'menu', key: 'facts' }, { in: 'buddy-band' })
    const off = await bandAt(ui)
    await $.turn.start({ text: 'go', turnId: 'long' } as Parameters<typeof $.turn.start>[0])
    now += 120000
    const silent = await bandAt(ui)
    await ui.unmount()

    expect(menu).toContain('"label":"facts","isOn":true')
    expect(off).toContain('ok, no more facts')
    expect(silent).not.toContain(first)
    expect(store.facts).toEqual({ next: 0, isOff: true })
})

test('/buddy fact tells one right away, in the chat and in the bubble, and /buddy facts on brings them back', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE }, facts: { next: 7, isOff: true } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))
    const [first = ''] = factOf(7)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const fact = await $.command.run({ command: 'buddy', args: 'fact' } as Parameters<typeof $.command.run>[0])
    await ui.redraw()
    const band = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    const back = await $.command.run({ command: 'buddy', args: 'facts on' } as Parameters<typeof $.command.run>[0])
    await ui.unmount()

    expect(fact.text).toBe(`Did you know? ${factOf(7).join(' ')}`)
    expect(band).toContain(first)
    expect(back.text).toContain('tells a fact now and then')
    expect(store.facts).toEqual({ next: 8, isOff: false })
})

const menuKeysOf = (band: string): string[] => [...band.matchAll(/"key":"([^"]+)","label"/g)].map(found => found[1] ?? '')

test('the menu keeps the basics, settings holds language, theme, facts and hide, and the language switch is saved in /config', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))
    const saved: Array<{ key: string; value: unknown }> = []
    on('config.list', () => ({ value: [{ key: 'pixel-buddy.language', label: 'Language · Язык', kind: 'choice' as const, value: 'English', options: ['English', 'Русский'], provider: { plugin: 'pixel-buddy', tier: 'user' as const }, isLocked: false }] }))
    on('config.set', (_$, e) => {
        saved.push({ key: e.key, value: e.value })

        return { value: e.value }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const main = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'settings' }, { in: 'buddy-band' })
    await ui.redraw()
    const settings = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'language' }, { in: 'buddy-band' })
    await ui.redraw()
    const switched = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const russian = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.unmount()

    expect(menuKeysOf(main)).toEqual(['card', 'nest', 'trophies', 'share', 'settings', 'close'])
    expect(menuKeysOf(settings)).toEqual(['language', 'theme', 'facts', 'hide', 'back'])
    expect(settings).toContain('"label":"Русский"')
    expect(switched).toContain('привет! теперь я говорю по-русски')
    expect(saved).toEqual([{ key: 'pixel-buddy.language', value: 'Русский' }])
    expect(menuKeysOf(russian)).toEqual(['card', 'nest', 'trophies', 'share', 'settings', 'close'])
    expect(russian).toContain('"label":"карточка"')
})

const PANE = (surface: 'vscode' | 'desktop') => ({
    plugin: 'pixel-buddy',
    surface,
    component: 'Pane',
    requestId: 'pixel-buddy',
    props: { title: 'Pixel Buddy', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const)

test('in VS Code the buddy sits above the prompt next to ❤️ 🍪 ✦ ⋯, /buddy answers in one line and /buddy panel opens it on the right', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))
    on('session.attach', (_, e) => ({ clientId: (e as { clientId: string }).clientId }))
    const opened: string[] = []
    on('ui.open', (_$, e) => {
        opened.push(e.id)

        return { value: { isPlaced: true } }
    })

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    await $.session.attach({ surface: 'vscode', clientId: 'vscode:default' })
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])
    const panel = await $.command.run({ command: 'buddy', args: 'panel' } as Parameters<typeof $.command.run>[0])
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    const drawn = JSON.stringify(await above.drawn())
    await above.unmount()

    expect(JSON.stringify(card)).toContain('⋯')
    expect(JSON.stringify(card)).not.toContain('DEBUGGING')
    expect(opened).toEqual(['pixel-buddy'])
    expect(panel.text).toBe('In VS Code and Cursor the buddy panel opens on the right')
    expect(drawn).toContain('<svg')
    expect(drawn).toContain('"❤️"')
    expect(drawn).toContain('"🍪"')
    expect(drawn).toContain('"✦"')
    expect(drawn).toContain('"⋯"')
    expect(drawn).not.toContain('"settings"')
})

test('in VS Code the buddy is drawn frame by frame from the terminal scene with 600 ms of frames ahead, a new film only as the playing one runs out, the same moment twice gives the same picture', async ($, on) => {
    const clock = mock.clock(on, { now: Date.UTC(2026, 4, 12, 7, 0, 0) })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    let asked = 0
    on('ui.invalidate', () => {
        asked += 1

        return { value: undefined }
    })
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: clock.now() }, affection: { value: 80, at: clock.now() } } })
    const pictureOf = (drawn: unknown) => /"source":"((?:[^"\\]|\\.)*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pane = await $.ui.mount(PANE('vscode'))
    const first = pictureOf(await pane.drawn())
    await pane.redraw()
    const again = pictureOf(await pane.drawn())
    const seen = new Set<string>([first])
    const askedBefore = asked
    for (let step = 0; step < 100; step++) {
        await clock.advance(100)
        await pane.redraw()
        seen.add(pictureOf(await pane.drawn()))
    }
    const askedWhileAlive = asked - askedBefore
    await pane.unmount()

    expect(first).toContain('</svg>')
    expect(again).toBe(first)
    expect([...seen].filter(picture => picture.includes('@keyframes s4'))).not.toHaveLength(0)
    expect(new Set([...seen].map(picture => Math.min(...spansOf(JSON.parse(`"${picture}"`) as string, '#2b2d42').map(span => span.x)))).size).toBeGreaterThan(3)
    expect(seen.size).toBeGreaterThan(15)
    expect(seen.size).toBeLessThan(35)
    expect(askedWhileAlive).toBeGreaterThan(12)
})

test('in VS Code, while Claude works, the buddy walks to the right corner and thinks there, as in the terminal', async ($, on) => {
    const clock = mock.clock(on, { now: Date.UTC(2026, 4, 12, 7, 0, 0) })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, belly: { value: 80, at: clock.now() }, affection: { value: 80, at: clock.now() } } })
    const leftmostOf = (drawn: unknown) => Math.min(...spansOf(JSON.stringify(drawn).replace(/\\"/g, '"'), '#2b2d42').map(span => span.x))
    const wait = async (ms: number) => {
        for (let spent = 0; spent < ms; spent += 100) {
            await clock.advance(100)
            await pane.redraw()
        }
    }

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pane = await $.ui.mount(PANE('vscode'))
    await wait(1000)
    const resting = leftmostOf(await pane.drawn())
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    await wait(10000)
    const working = leftmostOf(await pane.drawn())
    await wait(3000)
    const stillWorking = leftmostOf(await pane.drawn())
    await pane.unmount()

    expect(working).toBeGreaterThan(resting)
    expect(stillWorking).toBe(working)
})

const SURFACE_PLAY = {
    terminal: { mount: BAND, pet: { post: { type: 'pet' } }, ball: { post: { type: 'caught', kind: 'ball' } } },
    desktop: { mount: { ...ABOVE, surface: 'desktop' }, pet: { post: { type: 'pet' } }, ball: { post: { type: 'caught', kind: 'ball' } } },
    vscode: { mount: { ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } }, pet: { press: 'editor-heart' }, ball: { press: 'editor-ball' } },
} as const

for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    test(`on ${surface} petting and a caught ball give the same love as on every other surface`, async ($, on) => {
        const clock = mock.clock(on, { now: Date.now() })
        on('session.start', (_, e) => ({ cwd: e.cwd }))
        on('env.get', () => ({ value: 'en_US.UTF-8' }))
        on('command.register', () => ({ value: { command: 'buddy' } }))
        on('agent.list', () => ({ value: [] }))
        on('ui.invalidate', () => ({ value: undefined }))
        on('ui.render', ($, e) => {
            const { Text } = $.ui.resolve(e)

            return <Text>others</Text>
        })
        const store: Record<string, unknown> = { buddy: { ...NOODLE, species: 'octopus', belly: { value: 80, at: clock.now() }, affection: { value: 40, at: clock.now() } } }
        storeOn(on, store)
        const play = SURFACE_PLAY[surface]
        const act = async (ui: Awaited<ReturnType<typeof $.ui.mount>>, step: { post?: object; press?: string }) => {
            await (step.post === undefined ? ui.press({ key: step.press ?? '' }) : ui.post(step.post as never, { in: 'buddy-band' }))
            for (let spent = 0; spent < 3000; spent += 100) {
                await clock.advance(100)
                await ui.redraw()
            }
        }

        await $.session.start({ cwd: '/', surface, isInteractive: true })
        const ui = await $.ui.mount(play.mount as never)
        await act(ui, play.pet)
        const loved = petIn(store)?.affection?.value
        await act(ui, play.ball)
        await ui.unmount()

        expect(loved).toBe(48)
        expect(petIn(store)?.affection?.value).toBe(53)
    })
}

test('in VS Code a ball thrown while the buddy works in the right corner flies in from the left and never over the buddy', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, species: 'octopus', belly: { value: 80, at: clock.now() }, affection: { value: 40, at: clock.now() } } })
    const body = `#${((speciesColorsOf('octopus', false).b ?? 0) & 0xffffff).toString(16).padStart(6, '0')}`
    const firstShotOf = (drawn: unknown) => {
        const svg = JSON.parse(`"${/"source":"((?:[^"\\]|\\.)*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''}"`) as string

        return /<g class="s0">(.*?)<\/g><g class="s1">/.exec(svg)?.[1] ?? svg
    }
    const leftmost = (shot: string, fill: string) => Math.min(...spansOf(shot, fill).map(span => span.x))
    const rightmost = (shot: string, fill: string) => Math.max(...spansOf(shot, fill).map(span => span.x + span.w))
    const wait = async (ms: number) => {
        for (let spent = 0; spent < ms; spent += 50) {
            await clock.advance(50)
            await above.redraw()
        }
    }

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    await wait(7000)
    await above.press({ key: 'editor-ball' })
    const flight: string[] = []
    for (let step = 0; step < 6; step++) {
        await wait(50)
        flight.push(firstShotOf(await above.drawn()))
    }
    await above.unmount()

    expect(flight.filter(shot => shot.includes('fill="#ff5a3c"'))).not.toHaveLength(0)
    expect(flight.filter(shot => shot.includes('fill="#ff5a3c"') && rightmost(shot, '#ff5a3c') > leftmost(shot, body))).toEqual([])
})

test('in VS Code a newborn buddy hatches and introduces itself the way it does in the terminal', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, {})
    const altOf = (drawn: unknown) => /"alt":"([^"]*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''

    const started = $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    await clock.advance(200)
    await started
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    const alts: string[] = []
    for (let spent = 0; spent < 7000; spent += 350) {
        await clock.advance(350)
        await above.redraw()
        alts.push(altOf(await above.drawn()))
    }
    await above.unmount()

    expect(alts.filter(alt => alt.includes(': '))).not.toHaveLength(0)
})

test('in VS Code a hidden buddy leaves a button to bring it back, and the card takes the width of the chat', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE } })

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 100 } })
    await above.press({ key: 'editor-menu' })
    await above.redraw()
    await above.press({ key: 'editor-card' })
    await above.redraw()
    const card = JSON.stringify(await above.find({ key: 'buddy-card' }))
    await $.command.run({ command: 'buddy', args: 'off' } as Parameters<typeof $.command.run>[0])
    await clock.advance(10000)
    await above.redraw()
    const hidden = JSON.stringify(await above.drawn())
    await above.press({ key: 'editor-unhide' })
    await above.redraw()
    const back = JSON.stringify(await above.drawn())
    await above.unmount()

    expect(card).toContain('"width":72')
    expect(hidden).toContain('editor-unhide')
    expect(hidden).not.toContain('<svg')
    expect(back).toContain('<svg')
})

test('in VS Code the pane and the row above the prompt draw the same strip, whatever their widths', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))
    const widthOf = (drawn: unknown) => /"type":"Svg","props":\{"source":"(?:[^"\\]|\\.)*","alt":"[^"]*","width":(\d+)/.exec(JSON.stringify(drawn))?.[1]

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pane = await $.ui.mount({ ...PANE('vscode'), props: { ...PANE('vscode').props, bodyColumns: 30 } })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    const widths = [widthOf(await pane.drawn()), widthOf(await above.drawn())]
    await pane.unmount()
    await above.unmount()

    expect(widths).toEqual(['320', '320'])
})

test('/buddy in a terminal shows the card even after a VS Code window was attached to the same session', async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE } })
    on('session.attach', (_, e) => ({ clientId: (e as { clientId: string }).clientId }))
    on('session.surfaces', () => ({ value: ['terminal', 'vscode'] }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.session.attach({ surface: 'vscode', clientId: 'vscode:default' })
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])
    const panel = await $.command.run({ command: 'buddy', args: 'panel' } as Parameters<typeof $.command.run>[0])

    expect(JSON.stringify(card)).toContain('DEBUGGING')
    expect(panel.text).toContain('VS Code and Cursor')
    expect(panel.text).not.toBe('In VS Code and Cursor the buddy panel opens on the right')
})

test('a buddy that grew up while you were away says so and shows its new size in the terminal and in VS Code alike', async ($, on) => {
    const now = GROWTH_SINCE + 30 * 24 * 3600000
    const clock = mock.clock(on, { now })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    const store: Record<string, unknown> = { buddy: { ...NOODLE, species: 'octopus', hatchedAt: now - 8 * 24 * 3600000, growth: 'baby', belly: { value: 80, at: now }, affection: { value: 80, at: now } } }
    storeOn(on, store)
    const altOf = (drawn: unknown) => /"alt":"([^"]*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    const alts: string[] = []
    for (let spent = 0; spent < 1000; spent += 200) {
        await clock.advance(200)
        await above.redraw()
        alts.push(altOf(await above.drawn()))
    }
    await above.unmount()
    const band = await $.ui.mount(BAND)
    const props = JSON.stringify(await band.find({ type: 'Client', key: 'buddy-band' }))
    await band.unmount()

    expect(alts.filter(alt => alt.includes('look, I grew up a bit!'))).not.toHaveLength(0)
    expect(petIn(store)).toMatchObject({ growth: 'young' })
    expect(props).toContain('"growth":"young"')
})

test('in VS Code the buddy greets you back in a bubble written in the editor theme color', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, species: 'octopus', belly: { value: 80, at: clock.now() }, affection: { value: 80, at: clock.now() } } })
    const wait = async (ms: number) => {
        for (let spent = 0; spent < ms; spent += 500) {
            await clock.advance(500)
            await above.redraw()
        }
    }

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    await wait(4 * 60000)
    await $.prompt.submit({ text: "I'm back" } as Parameters<typeof $.prompt.submit>[0])
    await wait(2000)
    const drawn = JSON.stringify(await above.drawn())
    await above.unmount()

    expect(drawn).toContain('fill=\\"currentColor\\"')
})

test('in VS Code the buddy sleeps in one picture that never changes while you are away, so a window in the background has nothing new to draw, and wakes on your next press', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    let asked = 0
    on('ui.invalidate', () => {
        asked += 1

        return { value: undefined }
    })
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, species: 'octopus', belly: { value: 80, at: clock.now() }, affection: { value: 80, at: clock.now() } } })
    const wait = async (ms: number) => {
        for (let spent = 0; spent < ms; spent += 500) {
            await clock.advance(500)
            await above.redraw()
        }
    }

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    await wait(4 * 60000)
    const beforeQuiet = asked
    const awayPictures = new Set<string>()
    for (let spent = 0; spent < 20000; spent += 500) {
        await clock.advance(500)
        await above.redraw()
        awayPictures.add(JSON.stringify(await above.drawn()))
    }
    const whileAway = asked - beforeQuiet
    const awayPicture = JSON.stringify(await above.drawn())
    await above.press({ key: 'editor-heart' })
    const beforeBack = asked
    await wait(5000)
    const afterBack = asked - beforeBack
    await above.unmount()

    expect(whileAway).toBeLessThanOrEqual(2)
    expect(awayPicture).toContain('</svg>')
    expect(awayPicture).not.toContain('animation')
    expect(awayPictures.size).toBe(1)
    expect(afterBack).toBeGreaterThan(5)
})

test('in VS Code the ball button throws a ball, the buddy runs after it and catches it, the way a click does in the terminal', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    storeOn(on, { buddy: { ...NOODLE, species: 'octopus', belly: { value: 80, at: clock.now() }, affection: { value: 40, at: clock.now() } } })
    const altOf = (drawn: unknown) => /"alt":"([^"]*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    const resting = JSON.stringify(await above.drawn())
    await above.press({ key: 'editor-ball' })
    await clock.advance(100)
    await above.redraw()
    const thrown = JSON.stringify(await above.drawn())
    for (let spent = 0; spent < 3000; spent += 100) {
        await clock.advance(100)
        await above.redraw()
    }
    const after = await above.drawn()
    await above.unmount()

    expect(resting).toContain('"⚾"')
    expect(thrown).not.toBe(resting)
    expect(altOf(after)).toContain('got it!')
})

test('in the editor 🍪 drops a berry by the buddy, it eats it and its belly fills', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'en_US.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    const store: Record<string, unknown> = { buddy: { ...NOODLE, belly: { value: 40, at: clock.now() }, affection: { value: 40, at: clock.now() } } }
    storeOn(on, store)
    const pictureOf = (drawn: unknown) => /"source":"((?:[^"\\]|\\.)*)"/.exec(JSON.stringify(drawn))?.[1] ?? ''

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pane = await $.ui.mount(PANE('vscode'))
    await clock.advance(100)
    await pane.redraw()
    const before = pictureOf(await pane.drawn())
    await pane.press({ key: 'editor-snack' })
    await clock.advance(100)
    await pane.redraw()
    const dropped = pictureOf(await pane.drawn())
    for (let step = 0; step < 40; step++) {
        await clock.advance(100)
        await pane.redraw()
    }
    await pane.unmount()

    expect(dropped).not.toBe(before)
    expect(Object.entries(store).filter(([key]) => key.startsWith('pet:')).map(([, saved]) => (saved as { belly: { value: number } }).belly.value)).toEqual([expect.any(Number)])
    expect(Object.entries(store).filter(([key]) => key.startsWith('pet:')).map(([, saved]) => (saved as { belly: { value: number } }).belly.value)[0]).toBeGreaterThan(40)
    expect(Object.entries(store).filter(([key]) => key.startsWith('pet:')).map(([, saved]) => (saved as { affection: { value: number } }).affection.value)[0]).toBe(46)
})

test('in the pane a press pets the buddy, the card button shows its card with a link to the repository, and a terminal never gets the pane', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: { ...NOODLE } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const pane = await $.ui.mount(PANE('desktop'))
    const resting = JSON.stringify(await pane.drawn())
    await pane.press({ key: 'editor-heart' })
    await pane.redraw()
    const petted = JSON.stringify(await pane.drawn())
    await pane.press({ key: 'editor-menu' })
    await pane.redraw()
    const menu = JSON.stringify(await pane.drawn())
    await pane.press({ key: 'editor-card' })
    await pane.redraw()
    const card = JSON.stringify(await pane.drawn())
    await pane.unmount()
    const terminal = await $.ui.mount(PANE('terminal' as 'desktop'))
    const nothing = JSON.stringify(await terminal.drawn())
    await terminal.unmount()

    expect(resting).toContain('"❤️"')
    expect(resting).toContain('"🍪"')
    expect(menu).toContain('"Noodle · lv 1 ')
    expect(menu).toContain('"card"')
    expect(menu).toContain('"settings"')
    expect(petted).toContain('hai!')
    expect(petted).toContain('♥')
    expect(card).toContain('"buddy-card"')
    expect(card).toContain('a ⭐ on github.com/SimakovIgor/pixel-buddy helps others find it')
    expect(nothing).not.toContain('buddy-stage')
})

test('in VS Code an answer drops a cookie above the prompt and the buddy eats it', async ($, on) => {
    const clock = mock.clock(on, { now: Date.now() })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)

        return <Text>others</Text>
    })
    const store: Record<string, unknown> = { buddy: { ...NOODLE, xp: 0, belly: { value: 40, at: clock.now() }, affection: { value: 60, at: clock.now() } } }
    storeOn(on, store)
    on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
    on('turn.complete', () => ({ text: '' }))

    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const above = await $.ui.mount({ ...ABOVE, surface: 'vscode', props: { ...ABOVE.props, bodyColumns: 50 } })
    await $.turn.start({ text: 'go', turnId: 't1' } as Parameters<typeof $.turn.start>[0])
    await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', text: 'done' } as unknown as Parameters<typeof $.turn.complete>[0])
    await above.redraw()
    const falling = JSON.stringify(await above.drawn())
    for (let spent = 0; spent < 6000; spent += 100) {
        await clock.advance(100)
        await above.redraw()
    }
    await above.unmount()

    expect(falling).toContain('<svg')
    expect(petIn(store)).toMatchObject({ xp: 1 })
})

test('a buddy set to Русский speaks Russian: the card, the menu, a fact and the help', { options: { language: 'Русский' } }, async ($, on) => {
    stubEngine(on)
    storeOn(on, { buddy: { ...NOODLE }, facts: { next: 7, isOff: true } })
    on('ui.invalidate', () => ({ value: undefined }))
    setLanguage('Русский')
    const told = factOf(7).join(' ')
    setLanguage('English')

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const card = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])
    const fact = await $.command.run({ command: 'buddy', args: 'fact' } as Parameters<typeof $.command.run>[0])
    const help = await $.command.run({ command: 'buddy', args: 'help' } as Parameters<typeof $.command.run>[0])
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.redraw()
    const menu = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.unmount()

    expect(card.text).toContain('Noodle · ниндзя · ★☆☆☆☆ обычный')
    expect(card.text).toContain('характер: непредсказуемый, любит красную сборку')
    expect(card.text).toContain('нравится питомец? ⭐ на github.com/SimakovIgor/pixel-buddy поможет другим найти мод')
    expect(fact.text).toBe(`А знаешь? ${told}`)
    expect(help.text).toContain('Питомец живет на кликах:')
    expect(menu).toContain('"label":"карточка"')
    expect(menu).toContain('"header":"Noodle · ур 1 ')
})

test('in Russian every fact part fits the bubble, each English fact has its own Russian one, and a duck is a she', () => {
    setLanguage('Русский')
    const parts = Array.from({ length: FACTS.length }, (_, step) => factOf(step)).flat()
    const distinct = new Set(Array.from({ length: FACTS.length }, (_, step) => factOf(step).join(' '))).size
    const duck = cardOf({ ...NOODLE, species: 'duck', rarity: 'rare' } as Buddy, 0).split('\n')[0]
    setLanguage('English')

    expect(parts.filter(part => [...part].length > FACT_PART_MAX)).toEqual([])
    expect(distinct).toBe(FACTS.length)
    expect(duck).toContain('Noodle · утка · ★★★☆☆ редкая')
})

test('a subagent that starts makes the buddy say so, and the same helpers still running say nothing more', async ($, on) => {
    let now = Date.now()
    let running = 0
    stubEngine(on, () => now, true)
    storeOn(on, { buddy: { ...NOODLE } })
    on('ui.invalidate', () => ({ value: undefined }))
    on('agent.list', () => ({ value: Array.from({ length: running }, (_, k) => ({ id: `a${k}`, status: 'running', description: 'help', type: 'general' })) }))
    const said = /minions deployed|sending the interns/

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    now += 30000
    running = 1
    const started = await bandAt(ui)
    now += 30000
    const still = await bandAt(ui)
    await ui.unmount()

    expect(said.test(started)).toBe(true)
    expect(said.test(still)).toBe(false)
})

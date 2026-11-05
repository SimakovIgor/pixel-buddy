import { expect, test } from 'claude-code/testing'

import { cardOf, fullnessOf, hatch, levelOf, vibeOf } from './buddy'
import type { Buddy } from './buddy'
import { isTestRun } from './register'
import { paint } from './scene'
import { SPECIES } from './species'
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

test('/buddy fruit, with a comma still runs the command', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'ninja', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: 'Fruit,' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toBe('Hai!')
})

test('/buddy hat puts the Santa hat on now and takes it off', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const put = await $.command.run({ command: 'buddy', args: 'hat on' } as Parameters<typeof $.command.run>[0])
    const off = await $.command.run({ command: 'buddy', args: 'hat' } as Parameters<typeof $.command.run>[0])

    expect(put.text).toBe('Santa hat on, snow is falling')
    expect(off.text).toBe('Theme follows the calendar')
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

    expect(opened).toContain('"theme:"')
    expect(closed).not.toContain('"theme:"')
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

test('a bubble said on waking up is drawn over the fading tree, its frame whole', () => {
    const view: View = {
        t: 1000, cols: 64, species: 'ninja', rarity: 'common', mood: 'idle', moodAge: 0,
        pose: { x: 40, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 },
        bubble: { text: 'hi there', age: 2000 }, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null,
        action: null, toy: null, spark: null, season: null, menu: null,
        nap: { x: 40, age: 9000, wokeAge: 100 }, trail: [], leave: null, food: null, isShiny: false, vibe: 'content',
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
            action, toy: null, spark: null, season: null, menu: null, nap: null, trail: [], leave: null, food: null, isShiny: false, vibe: 'content',
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
    spark: null, season: null, menu: null, nap: null, trail: [], leave: null, food: null, isShiny: false, vibe: 'content',
    ...overrides,
})

const rowOf = (view: View, row: number): string => {
    const cells = paint(view)

    return Array.from({ length: view.cols }, (_, x) => String.fromCodePoint(cells[(row * view.cols + x) * 3] ?? 0x20)).join('')
}

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
    expect(card).toContain('belly     ██░░░░░░░░ 20%, hungry: right click → feed')
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

test('feeding from the menu gives a berry to a hungry buddy, a full one says no thanks', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { ...NOODLE, belly: { value: 95, at: now } } }
    storeOn(on, store)
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'feed' }, { in: 'buddy-band' })
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

    expect(vibeOf({ ...fine, fullness: 10, workedMs: 3 * 3600000 })).toEqual({ vibe: 'hungry', why: 'belly 10%, a berry from the menu helps' })
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

test('the right click menu starts with a summary line, and card opens one framed card above the prompt, a second press closes it', async ($, on) => {
    const now = Date.now()
    stubEngine(on, () => now)
    storeOn(on, { buddy: { ...NOODLE, xp: 12, belly: { value: 80, at: now }, affection: { value: 60, at: now } } })
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
    const closed = await above.find({ key: 'buddy-card' })
    await ui.unmount()
    await above.unmount()

    expect(menu).toContain('"header":"Noodle · lv 2 ▰▱▱▱▱ · belly 80% · love 60% · content ·"')
    expect(card).toContain('Noodle')
    expect(card).toContain('content: fed, petted, rested')
    expect(card).toContain('"borderStyle":"round"')
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
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
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

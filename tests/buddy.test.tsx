import { expect, test } from 'claude-code/testing'

import { cardOf } from './buddy'
import { isTestRun } from './register'
import { noteLinesOf, paint, petMinXOf } from './scene'
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
    on('env.get', () => ({ value: 'ru_RU.UTF-8' }))
    on('command.register', () => ({ value: { command: 'buddy' } }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
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

test('/buddy shows the card of the stored buddy', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({
        value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 },
    }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const result = await $.command.run({ command: 'buddy', args: '' } as Parameters<typeof $.command.run>[0])

    expect(result.text).toContain('Mochi · cat · ★★★☆☆ rare')
    expect(result.text).toContain('DEBUGGING █████████░ 90')
})

test('a click on the buddy pets him and he answers in a bubble', async ($, on) => {
    stubEngine(on)
    on('ui.selection', () => ({ value: undefined }))
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

test('/buddy opens a card pane with the portrait and stats', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'robot', rarity: 'legendary', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.command.run({ command: 'buddy', args: 'card' } as Parameters<typeof $.command.run>[0])
    const ui = await $.ui.mount({
        plugin: 'pixel-buddy',
        component: 'Pane',
        requestId: 'buddy-card',
        surface: 'terminal',
        props: { title: 'Mochi', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })

    expect(await ui.find({ type: 'Raster' })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /Mochi/ }))?.text).toBe('Mochi')
    expect(await ui.find({ type: 'Text', text: /DEBUGGING/ })).toBeTruthy()
    await ui.unmount()
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

test('a click on the buddy explains the selected word in a big bubble', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'ninja', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))
    on('ui.selection', () => ({ value: { text: ' actuator ' } }))
    on('model.complete', () => ({
        value: {
            isAnswered: true,
            text: 'A Spring Boot module with health and metrics endpoints.',
            usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
    }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.pointer({ type: 'down', x: 56, y: 1, button: 'left', in: 'buddy-band' })
    await ui.pointer({ type: 'up', x: 56, y: 1, button: 'left', in: 'buddy-band' })
    await ui.advance(100)
    await ui.redraw()

    expect(await ui.find({ type: 'Text', text: /actuator/, in: 'buddy-band' })).toBeTruthy()
    await ui.unmount()
})

test('the same selection is explained once, later clicks close the bubble and pet', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }))
    on('ui.selection', () => ({ value: { text: 'actuator', requestId: 'row-1' } }))
    let asked = 0
    on('model.complete', () => {
        asked += 1

        return { value: { isAnswered: true, text: 'A Spring Boot module.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    for (const click of ['explains', 'closes the bubble', 'pets']) {
        await ui.post({ type: 'pet', click }, { in: 'buddy-band' })
    }

    expect(asked).toBe(1)
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

test('a session waiting for you shows up on the left and its click lists what it waits for', async ($, on) => {
    stubEngine(on)
    const mine = { name: 'Mochi', species: 'ninja', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 }
    const other = {
        name: 'Ghosty',
        species: 'ghost',
        rarity: 'common',
        status: 'permission',
        reason: 'Claude needs your permission to use Bash',
        since: Date.now() - 120000,
        place: { folder: 'checkout-service', branch: 'feature/PAY-142-refunds', task: 'PAY-142' },
        updatedAt: Date.now(),
    }
    const store: Record<string, unknown> = { buddy: mine, 'session:other': other }
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', (_, e) => {
        const { key, value } = e as { key: string; value: unknown }
        store[key] = value

        return { value: undefined }
    })
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('session.id', () => ({ value: 'me' }))
    on('session.root', () => ({ value: '/work/billing-service' }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'feature/PAY-150-x\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'visitors' }, { in: 'buddy-band' })

    expect(store['session:me']).toMatchObject({ name: 'Mochi', status: 'idle', place: { task: 'PAY-150' } })
    const drawn = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    expect(drawn).toContain('"Waiting"')
    expect(drawn).toContain('"you"')
    expect(drawn).toContain('"PAY-142"')
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

test('the menu picks a species and hatches it', async ($, on) => {
    let now = Date.now()
    stubEngine(on, () => now)
    const store: Record<string, unknown> = { buddy: { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } }
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', (_, e) => {
        const { key, value } = e as { key: string; value: unknown }
        store[key] = value

        return { value: undefined }
    })
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    const main = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'new' }, { in: 'buddy-band' })
    const species = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'hatch:octopus' }, { in: 'buddy-band' })
    await ui.redraw()
    const swap = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'hide' }, { in: 'buddy-band' })

    expect(main).toContain('"theme:"')
    expect(main).toContain('"change"')
    expect(main).toContain('"buddy"')
    expect(main).toContain('"hide"')
    expect(main).not.toContain('"ru"')
    expect(species).toContain('"octopus"')
    expect(store.buddy).toMatchObject({ species: 'octopus' })
    expect(swap).toContain('"species":"octopus"')
    expect(swap).toContain('"leave":{"species":"cat"')
    await ui.unmount()
    now += 2000
    const hidden = await $.ui.mount(BAND)
    expect(await hidden.find({ key: 'buddy-band' })).toBeUndefined()
    await hidden.unmount()
})

test('a waiting session without a task key is named by its folder', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = {
        buddy: { name: 'Mochi', species: 'duck', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 },
        'session:other': {
            name: 'Mochi',
            species: 'duck',
            rarity: 'rare',
            status: 'waiting',
            reason: null,
            since: Date.now() - 60000,
            place: { folder: 'projects', branch: 'main', task: '' },
            updatedAt: Date.now(),
        },
    }
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', () => ({ value: undefined }))
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('session.id', () => ({ value: 'me' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const drawn = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(drawn).toContain('"projects"')
    await ui.unmount()
})

test('waiting sessions are named by their task key or folder, each one, not by a count', async ($, on) => {
    stubEngine(on)
    const waiting = (place: { folder: string; branch: string; task: string }, since: number) => ({
        name: 'Mochi',
        species: 'duck',
        rarity: 'rare',
        status: 'waiting',
        reason: null,
        since,
        place,
        title: 'Handover notes for the new team',
        updatedAt: Date.now(),
    })
    const store: Record<string, unknown> = {
        buddy: { name: 'Mochi', species: 'duck', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 },
        'session:content': waiting({ folder: 'api', branch: 'feature/PAY-12-refunds', task: 'PAY-12' }, Date.now() - 120000),
        'session:music': waiting({ folder: 'synth', branch: 'main', task: '' }, Date.now() - 60000),
    }
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', () => ({ value: undefined }))
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('session.id', () => ({ value: 'me' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const drawn = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(drawn).toContain('PAY-12')
    expect(drawn).toContain('"synth"')
    expect(drawn).not.toContain('"waiting"')
    expect(drawn).not.toContain('Handover')
    await ui.unmount()
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

test('card in the menu shows the card in a bubble above the buddy and closes the menu', async ($, on) => {
    stubEngine(on)
    on('store.get', (_, e) => ({ value: (e as { key: string }).key === 'buddy' ? { name: 'Mochi', species: 'cat', rarity: 'rare', stats: { DEBUGGING: 90, PATIENCE: 30, CHAOS: 40, WISDOM: 20, SNARK: 60 }, hatchedAt: 0 } : undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'menu', key: 'open' }, { in: 'buddy-band' })
    await ui.post({ type: 'menu', key: 'card' }, { in: 'buddy-band' })
    const drawn = JSON.stringify(await ui.drawn({ in: 'buddy-band' }))

    expect(drawn).toContain('"Mochi"')
    expect(drawn).toContain('"rare"')
    expect(drawn).not.toContain('"theme:"')
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

test('the card in a bubble keeps the stat bars in one column', () => {
    const lines = noteLinesOf({ text: cardOf(NOODLE) }, 64)
    const barStarts = lines.filter(line => /[█░]/.test(line)).map(line => line.search(/[█░]/))

    expect(barStarts).toEqual([10, 10, 10, 10, 10])
})

test('a bubble said on waking up is drawn over the fading tree, its frame whole', () => {
    const view: View = {
        t: 1000, cols: 64, species: 'ninja', rarity: 'common', mood: 'idle', moodAge: 0,
        pose: { x: 40, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 },
        bubble: { text: 'hi there', age: 2000 }, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null, note: null,
        action: null, toy: null, spark: null, season: null, neighbors: [], visitorsLabel: '', menu: null,
        nap: { x: 40, age: 9000, wokeAge: 100 }, trail: [], leave: null,
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
            bubble: null, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null, note: null,
            action, toy: null, spark: null, season: null, neighbors: [], visitorsLabel: '', menu: null, nap: null, trail: [], leave: null,
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
    bubble: null, agents: 0, hatchAge: null, hearts: [], rows: 3, jump: null, note: null, action: null, toy: null,
    spark: null, season: null, neighbors: [], visitorsLabel: '', menu: null, nap: null, trail: [], leave: null,
    ...overrides,
})

const rowOf = (view: View, row: number): string => {
    const cells = paint(view)

    return Array.from({ length: view.cols }, (_, x) => String.fromCodePoint(cells[(row * view.cols + x) * 3] ?? 0x20)).join('')
}

test('a bubble keeps clear of the waiting neighbors on the left, both texts stay whole', () => {
    const view = footerView({
        bubble: { text: '"Ideas for a new mod" is waiting for you', age: 5000 },
        neighbors: [{ id: 'other', species: 'ninja', rarity: 'common', status: 'waiting', label: 'Ideas for a new mod' }],
        visitorsLabel: 'Ideas for a new mod',
    })

    expect(rowOf(view, 1)).toContain('Ideas for a new mod')
    expect(rowOf(view, 1)).not.toContain('┤')
})

test('a bubble keeps clear of the subagents running behind the buddy', () => {
    const view = footerView({ cols: 64, pose: { x: 4, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, agents: 2, bubble: { text: 'minions deployed', age: 5000 } })

    expect(rowOf(view, 1)).toContain('─┤ minions deployed')
})

test('a neighbor that already waits when the session starts gets no bubble, its name is on the left', async ($, on) => {
    stubEngine(on)
    const other = { name: 'Noodle', species: 'ninja', rarity: 'common', status: 'waiting', reason: null, since: Date.now() - 60000, place: { folder: 'pixel-buddy', branch: 'main', task: '' }, updatedAt: Date.now() }
    const store: Record<string, unknown> = { buddy: NOODLE, 'session:other': other }
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', (_, e) => {
        const { key, value } = e as { key: string; value: unknown }
        store[key] = value

        return { value: undefined }
    })
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('session.id', () => ({ value: 'me' }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    const band = await ui.find({ type: 'Client', key: 'buddy-band' })

    expect(JSON.stringify(band)).toContain('"visitorsLabel":"pixel-buddy"')
    expect(JSON.stringify(band)).toContain('"bubble":null')
    await ui.unmount()
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

test('in a narrow strip the neighbor title is cut to fit, and the buddy with its tree stays clear of it', () => {
    const title = 'Payment retries and refunds flow'
    const neighbors = [{ id: 'other', species: 'ninja', rarity: 'common', status: 'waiting', label: title }] as const
    const x = petMinXOf(1, title, 44)
    const asleep = footerView({
        cols: 44, mood: 'sleep', neighbors: [...neighbors], visitorsLabel: title,
        pose: { x, isFacingLeft: true, isWalking: false, lookX: 0, lift: 0 }, nap: { x, age: 5000, wokeAge: null },
    })

    expect(x).toBeLessThanOrEqual(44 - 11)
    expect(rowOf(asleep, 1)).toContain('Payment retries and…')
})

const storeOn = (on: On, store: Record<string, unknown>) => {
    on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
    on('store.set', (_, e) => {
        const { key, value } = e as { key: string; value: unknown }
        store[key] = value

        return { value: undefined }
    })
    on('store.keys', () => ({ value: Object.keys(store) }))
    on('session.id', () => ({ value: 'me' }))
    on('classic.Stop', () => ({}))
}

const stopped = (background: number, answer: string) => ({
    hook_event_name: 'Stop', session_id: 'me', transcript_path: '/dev/null', cwd: '/', stop_hook_active: false, last_assistant_message: answer,
    background_tasks: Array.from({ length: background }, (_, i) => ({ id: `b${i}`, type: 'shell', status: 'running', description: 'gradle build' })),
    session_crons: [],
})

test('a session that ends its turn with work left in the background is working, not waiting for you', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE }
    storeOn(on, store)

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.classic.Stop(stopped(1, 'The build runs in the background, I will report when it ends.') as unknown as Parameters<typeof $.classic.Stop>[0])
    const busy = store['session:me']
    await $.classic.Stop(stopped(0, '**Done.**\n\nShould I bring Noodle back?') as unknown as Parameters<typeof $.classic.Stop>[0])

    expect(busy).toMatchObject({ status: 'working', reason: null })
    expect(store['session:me']).toMatchObject({ status: 'waiting', reason: null })
})

test('the status a session shares keeps no words of the conversation', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE }
    storeOn(on, store)
    on('session.messages', () => ({ value: [{ role: 'user', text: 'refund the order of Jane Doe', toolUses: [] }] }))
    on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.prompt.submit({ text: 'refund the order of Jane Doe' } as Parameters<typeof $.prompt.submit>[0])
    await $.classic.Stop(stopped(0, 'Refunded, Jane Doe gets a mail.') as unknown as Parameters<typeof $.classic.Stop>[0])
    const mine = store['session:me'] as Record<string, unknown>

    expect(Object.keys(mine).sort()).toEqual(['name', 'place', 'rarity', 'reason', 'since', 'species', 'status', 'updatedAt'])
    expect(JSON.stringify(mine)).not.toContain('Jane')
})

test('the list of waiting sessions says when Claude finished there', async ($, on) => {
    stubEngine(on)
    const other = { name: 'Tofu', species: 'ninja', rarity: 'common', status: 'waiting', reason: null, since: Date.now() - 5 * 60000, place: { folder: 'api', branch: 'main', task: '' }, updatedAt: Date.now() }
    storeOn(on, { buddy: NOODLE, 'session:other': other })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'visitors' }, { in: 'buddy-band' })
    await ui.redraw()
    const note = JSON.stringify(await ui.find({ type: 'Client', key: 'buddy-band' }))

    expect(note).toContain('api: your turn, Claude finished 5 min ago')
    await ui.unmount()
})

test('test runs are told apart from builds, excluded tests and pipes that hide the exit code', () => {
    const runs = ['./gradlew test', 'cd service && ./gradlew functionalTest', 'go test ./...', 'cargo test', 'pytest -q', 'npx jest', 'vitest run', 'npm run test', 'mvn -q verify']
    const notRuns = ['npm run build', './gradlew build -x test', './gradlew test | tail -50', 'git commit -m test', 'ls tests']

    expect(runs.filter(command => !isTestRun(command))).toEqual([])
    expect(notRuns.filter(isTestRun)).toEqual([])
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

test('a word explanation the model refused does not block the next one', async ($, on) => {
    stubEngine(on)
    on('store.get', () => ({ value: NOODLE }))
    on('store.set', () => ({ value: undefined }))
    let word = 'actuator'
    let asked = 0
    on('ui.selection', () => ({ value: { text: word, requestId: 'row-1' } }))
    on('model.complete', () => {
        asked += 1

        return { deny: 'haiku is blocked by policy' }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(BAND)
    await ui.post({ type: 'pet' }, { in: 'buddy-band' })
    word = 'outbox'
    await ui.post({ type: 'pet' }, { in: 'buddy-band' })

    expect(asked).toBe(2)
    await ui.unmount()
})

test('after a permission was answered and the tool ran, the session no longer shows as asking for it', async ($, on) => {
    stubEngine(on)
    const store: Record<string, unknown> = { buddy: NOODLE }
    storeOn(on, store)
    on('classic.Notification', () => ({}))
    on('classic.PostToolUse', () => ({}))
    const base = { session_id: 'me', transcript_path: '/dev/null', cwd: '/' }

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.classic.Notification({ ...base, hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' } as unknown as Parameters<typeof $.classic.Notification>[0])
    await $.classic.PostToolUse({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {}, tool_response: {} } as unknown as Parameters<typeof $.classic.PostToolUse>[0])
    await $.classic.Stop(stopped(0, 'Done.') as unknown as Parameters<typeof $.classic.Stop>[0])

    expect(store['session:me']).toMatchObject({ status: 'waiting' })
})

test('entries of sessions dead for more than a day are removed from the shared store', async ($, on) => {
    stubEngine(on)
    const dead = { name: 'Old', species: 'cat', rarity: 'common', status: 'waiting', reason: null, since: 0, place: { folder: 'x', branch: 'main', task: '' }, title: 'old', updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 }
    const store: Record<string, unknown> = { buddy: NOODLE, 'session:dead': dead }
    storeOn(on, store)
    on('store.delete', (_, e) => {
        delete store[(e as { key: string }).key]

        return { value: undefined }
    })

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    expect(Object.keys(store)).not.toContain('session:dead')
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

test('a double click keeps the open note on the strip, and a bubble wipes trick glyphs under it', () => {
    const noted = footerView({ cols: 64, rows: 6, note: { title: 'card', text: 'line one\nline two', age: 99999 }, jump: { age: 600, fromX: 10, toX: 30 } })
    const bubbled = footerView({ cols: 64, species: 'axolotl', mood: 'tool', pose: { x: 4, isFacingLeft: false, isWalking: false, lookX: 0, lift: 0 }, action: { kind: 'trick', age: 400 }, bubble: { text: 'hi there', age: 5000 } })

    expect(rowOf(noted, 0)).toContain('╭')
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

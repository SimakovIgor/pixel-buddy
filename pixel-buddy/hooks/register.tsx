import type { EngineInterface, Register, RenderElement, ResolveInput, Timer } from 'claude-code'

import type { BandProps } from './band-client'

import { STAT_NAMES, cardOf, hatch, introOf, peakOf, rarityOf } from './buddy'
import type { Buddy } from './buddy'
import { lineFor } from './lines'
import type { Moment } from './lines'
import { BUBBLE_MS, HEART_MS, LEAVE_MS, arriveMsOf, JUMP_MS, MIN_COLS, PORTRAIT_COLS, PORTRAIT_ROWS, FRUIT_MS, SLICE_MS, SWING_MS, TRICK_MS, WIDTH, encode, maxXOf, noteTtlOf, paintPortrait, rowsOf } from './scene'
import type { ActionKind, Menu, MenuItem, Mood, Pose, Season, View } from './scene'
import { SPECIES, speciesOf } from './species'
import type { SpeciesId } from './species'

const CLIENT_KEY = 'buddy-band'
const PORTRAIT_KEY = 'portrait'
const CARD = 'buddy-card'
const STORE_KEY = 'buddy'
const HAT_KEY = 'hat'
const THEME_KEY = 'theme'
const THEMES = ['auto', 'winter', 'halloween', 'off'] as const

type Theme = (typeof THEMES)[number]
const SESSION_PREFIX = 'session:'
const SYNC_EVERY_FRAMES = 60
const COMMAND = 'buddy'
const FRAME_MS = 50
const BLIT_WAIT_MS = 150
const BLIT_LATE = 'blit did not answer in 150 ms'
const CHATTER_GAP_MS = 20000
const SLEEP_AFTER_MS = 180000
const FOOTER_RESERVE = 96
const FOOTER_WAIT_MS = 1500
const MARATHON_MS = 90000
const LONG_THINK_MS = 60000
const TYPING_MS = 1500
const WALK_SPEED = 0.007
const LOOP_ERRORS = 3

const MOOD_MS: Partial<Record<Mood, number>> = { shock: 1600, dizzy: 3200, happy: 2600, love: 2600 }
const STAT_COLORS = ['#4aa8ff', '#5fd17a', '#ff7a5c', '#b57bff', '#ffcf3f']

type Beat = { at: number; mood?: Mood; say?: Moment; agents?: number; pet?: boolean }

const DEMO: readonly Beat[] = [
    { at: 0, mood: 'think', say: 'thinking' },
    { at: 2600, mood: 'tool' },
    { at: 4200, mood: 'shock', say: 'error' },
    { at: 6400, mood: 'tool', say: 'agents', agents: 2 },
    { at: 9000, mood: 'dizzy', say: 'loop', agents: 2 },
    { at: 12200, mood: 'happy', say: 'plan', agents: 0 },
    { at: 15000, pet: true },
    { at: 17800, mood: 'sleep' },
    { at: 22800, mood: 'think', say: 'thinking' },
    { at: 25000, mood: 'idle' },
]

type Walk = { x: number | null; target: number; isFacingLeft: boolean; nextAt: number }
type Glance = { x: number; until: number; nextAt: number; hopUntil: number }

let buddy: Buddy | null = null
let isOff = false
let hatchAt: number | null = null
let isNewborn = false
let buddyVersion = 0
let isArrivalPending = false
let leave: { species: SpeciesId; at: number } | null = null
let mood: Mood = 'idle'
let moodAt = 0
let bubble: { text: string; at: number } | null = null
let saidAt = 0
let lastSeenAt = 0
let typingAt = 0
let turnAt: number | null = null
let saidThinking = false
let errorStreak = 0
let agents = 0
let todoDone = false
let hearts: number[] = []
let demoAt: number | null = null
let demoStep = 0
let demoAgents: number | null = null
let walk: Walk = { x: null, target: 0, isFacingLeft: true, nextAt: 0 }
let glance: Glance = { x: 0, until: 0, nextAt: 0, hopUntil: 0 }
let timer: Timer | null = null
let timerAt = 0
let lastFrameAt = 0
let isTicking = false
let timerGeneration = 0
let frames = 0
let cols = WIDTH
let lastPortrait = ''
let isCardOpen = false
let isCardRaster = false
let jumpAt: number | null = null
let jumpFrom = 0
let jumpTo = 0
let messages = 0
let theme: Theme = 'auto'
let menuPage: 'main' | 'species' | null = null

const ALIASES: Record<string, string> = {
    rename: 'name',
}

const speciesFor = (word: string | undefined) => (word === undefined ? undefined : SPECIES.find(one => one.id === word.toLowerCase()))

const menuOf = (): Menu | null => {
    if (menuPage === null || buddy === null) {
        return null
    }
    if (menuPage === 'species') {
        const items: MenuItem[] = SPECIES.map(one => ({ key: `hatch:${one.id}`, label: one.name, isOn: one.id === buddy?.species }))

        return { items: [...items, { key: 'hatch:random', label: 'random', isOn: false }, { key: 'back', label: '←', isOn: false }] }
    }
    const items: MenuItem[] = [
        { key: 'card', label: 'card', isOn: false },
        { key: 'new', label: 'change buddy', isOn: false },
        { key: 'theme', label: `theme: ${theme}`, isOn: theme !== 'auto' && theme !== 'off' },
        { key: 'hide', label: 'hide', isOn: false },
        { key: 'close', label: '×', isOn: false },
    ]

    return { items }
}

let startedAt = 0

const dropSessionEntries = async ($: EngineInterface): Promise<void> => {
    const keys = (await $.store.keys()).filter(key => key.startsWith(SESSION_PREFIX))
    await Promise.all(keys.map(key => $.store.delete(key)))
}

const syncShared = async ($: EngineInterface, now: number): Promise<void> => {
    const version = buddyVersion
    const stored = knownOf((await $.store.get(STORE_KEY)) as Buddy | undefined)
    const isChangedHere = version !== buddyVersion
    if (!isChangedHere && stored !== undefined && buddy !== null && (stored.hatchedAt !== buddy.hatchedAt || stored.name !== buddy.name)) {
        if (stored.hatchedAt !== buddy.hatchedAt && now - stored.hatchedAt < arriveMsOf(stored.species)) {
            hatchAt = stored.hatchedAt
            isNewborn = true
        }
        buddy = stored
    }
    theme = await readTheme($)
}

const isHolidays = (now: number): boolean => {
    const date = new Date(now)

    return date.getMonth() === 11 || (date.getMonth() === 0 && date.getDate() <= 14)
}

const isHalloween = (now: number): boolean => {
    const date = new Date(now)

    return (date.getMonth() === 9 && date.getDate() >= 24) || (date.getMonth() === 10 && date.getDate() <= 2)
}

const seasonOf = (now: number): Season => {
    if (theme === 'winter' || theme === 'halloween') {
        return theme
    }
    if (theme === 'off') {
        return null
    }

    return isHolidays(now) ? 'winter' : isHalloween(now) ? 'halloween' : null
}

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme)

const readTheme = async ($: EngineInterface): Promise<Theme> => {
    const stored = await $.store.get(THEME_KEY)
    if (isTheme(stored)) {
        return stored
    }

    return (await $.store.get(HAT_KEY)) === 'on' ? 'winter' : 'auto'
}
let lastMessage = ''
let note: { title: string; text: string; at: number } | null = null
let action: { kind: ActionKind; at: number } | null = null
let nextTrickAt = 0
let isClientMode = false
let footerAt = 0
let isFooterFit = false
let isAboveChecked = false
let lastPropsKey = ''
const denied = new Set<string>()
let lastDeny = ''

const random = (): number => {
    const words = new Uint32Array(1)
    crypto.getRandomValues(words)

    return (words[0] ?? 0) / 0x100000000
}

const setMood = (next: Mood, now: number): void => {
    mood = next
    moodAt = now
}

const say = (moment: Moment, now: number, isUrgent = false): void => {
    if (buddy === null || (!isUrgent && now - saidAt < CHATTER_GAP_MS)) {
        return
    }
    bubble = { text: lineFor(moment, peakOf(buddy), random()), at: now }
    saidAt = now
}

const sayText = (line: string, now: number): void => {
    bubble = { text: line, at: now }
    saidAt = now
}

const currentMood = (now: number): Mood => {
    const span = MOOD_MS[mood]
    if (span !== undefined && now - moodAt > span) {
        mood = turnAt === null ? 'idle' : 'think'
    }
    if (mood === 'idle' && now - lastSeenAt > SLEEP_AFTER_MS) {
        return 'sleep'
    }

    return mood
}

const isNinja = (): boolean => buddy?.species === 'ninja'

const isShown = (now: number): boolean => buddy !== null && (!isOff || (leave !== null && now - leave.at < LEAVE_MS))

const pet = (now: number): void => {
    if (buddy === null) {
        return
    }
    setMood('love', now)
    hearts = [now, now + 250, now + 500]
    sayText(speciesOf(buddy.species).pet, now)
    if (isNinja()) {
        action = { kind: 'swing', at: now }
    }
}

const celebrate = (now: number): void => {
    if (action === null) {
        action = { kind: isNinja() ? 'fruit' : 'trick', at: now }
    }
}

const isFreeFor = (current: Mood): boolean => current === 'idle' || current === 'think' || current === 'tool'

const stepAction = (now: number, current: Mood): void => {
    const span = action === null ? 0 : { swing: SWING_MS, slice: SLICE_MS, fruit: FRUIT_MS, trick: TRICK_MS }[action.kind]
    if (action !== null && now - action.at > span) {
        action = null
    }
    if (action === null && buddy !== null && isFreeFor(current) && note === null && now > nextTrickAt) {
        if (nextTrickAt !== 0) {
            action = { kind: isNinja() ? (random() < 0.6 ? 'fruit' : 'swing') : 'trick', at: now }
        }
        nextTrickAt = now + 20000 + random() * 15000
    }
}

const runDemo = (now: number): void => {
    if (demoAt === null) {
        return
    }
    const elapsed = now - demoAt
    while (demoStep < DEMO.length && (DEMO[demoStep]?.at ?? Infinity) <= elapsed) {
        const beat = DEMO[demoStep] as Beat
        if (beat.mood === 'shock' && isNinja()) {
            action = { kind: 'slice', at: now }
        } else if (beat.mood !== undefined) {
            setMood(beat.mood, now)
        }
        if (beat.say !== undefined) {
            say(beat.say, now, true)
        }
        if (beat.say === 'plan') {
            action = null
            celebrate(now)
        }
        if (beat.agents !== undefined) {
            demoAgents = beat.agents
        }
        if (beat.pet === true) {
            pet(now)
        }
        demoStep += 1
    }
    if (demoStep >= DEMO.length) {
        demoAt = null
        demoAgents = null
        lastSeenAt = now
    }
}

const isRestless = (current: Mood): boolean => current === 'idle'

const stepWalk = (now: number, elapsed: number, current: Mood): void => {
    const home = maxXOf(cols)
    const x = walk.x ?? home
    if (current === 'think' || current === 'tool') {
        walk.target = home
    } else if (!isRestless(current)) {
        walk.target = x
    } else if (now > walk.nextAt && Math.abs(walk.target - x) < 0.5 && now - typingAt > TYPING_MS) {
        walk.target = Math.round(random() * home)
        walk.nextAt = now + 7000 + random() * 9000
    }
    const gap = walk.target - x
    const move = Math.sign(gap) * Math.min(Math.abs(gap), elapsed * WALK_SPEED)
    if (Math.abs(gap) >= 0.5) {
        walk.isFacingLeft = gap < 0
    }
    if (now - typingAt < TYPING_MS) {
        walk.isFacingLeft = true
    }
    walk.x = Math.min(home, x + move)
}

const stepGlance = (now: number): void => {
    if (now < glance.nextAt) {
        return
    }
    glance = {
        x: Math.round(random() * 2) - 1,
        until: now + 1200,
        nextAt: now + 4000 + random() * 5000,
        hopUntil: random() < 0.25 ? now + 200 : 0,
    }
}

const poseOf = (now: number): Pose => {
    const x = walk.x ?? maxXOf(cols)
    const isTyping = now - typingAt < TYPING_MS
    const isGlancing = now < glance.until

    return {
        x,
        isFacingLeft: walk.isFacingLeft,
        isWalking: Math.abs(walk.target - x) >= 0.5,
        lookX: isTyping ? -1 : isGlancing ? glance.x : 0,
        lift: now < glance.hopUntil ? 1 : 0,
    }
}

const viewOf = (now: number): View | null => {
    if (buddy === null) {
        return null
    }

    return {
        t: now,
        cols,
        species: buddy.species,
        rarity: buddy.rarity,
        mood: demoAt === null ? currentMood(now) : mood,
        moodAge: now - moodAt,
        pose: poseOf(now),
        bubble: bubble === null ? null : { text: bubble.text, age: now - bubble.at },
        agents: demoAgents ?? agents,
        hatchAge: hatchAt === null ? null : now - hatchAt,
        leave: leave === null ? null : { species: leave.species, age: now - leave.at },
        hearts: hearts.map(at => now - at),
        rows: rowsOf(note, cols, menuOf()),
        jump: jumpAt === null ? null : { age: now - jumpAt, fromX: jumpFrom, toX: jumpTo },
        note: note === null ? null : { title: note.title, text: note.text, age: now - note.at },
        action: action === null ? null : { kind: action.kind, age: now - action.at },
        toy: null,
        spark: null,
        season: seasonOf(now),
        menu: menuOf(),
        nap: null,
        trail: [],
    }
}

const bandPropsOf = (now: number): BandProps | null => {
    if (buddy === null) {
        return null
    }

    return {
        cols,
        rows: rowsOf(note, cols, menuOf()),
        species: buddy.species,
        rarity: buddy.rarity,
        mood: demoAt === null ? currentMood(now) : mood,
        moodAt,
        isWorking: turnAt !== null,
        typingAt,
        bubble,
        hearts,
        agents: demoAgents ?? agents,
        hatchAt,
        leave,
        jumpAt,
        note,
        action,
        season: seasonOf(now),
        menu: menuOf(),
    }
}

const startJump = (now: number): boolean => {
    if (!isClientMode) {
        return false
    }
    const from = Math.round(walk.x ?? maxXOf(cols))
    jumpFrom = from
    jumpTo = Math.max(0, Math.min(maxXOf(cols), from > cols / 2 ? from - 14 : from + 14))
    jumpAt = now
    walk.target = from

    return true
}

const landJump = (now: number): void => {
    if (jumpAt === null || now - jumpAt <= JUMP_MS) {
        return
    }
    jumpAt = null
    walk.x = jumpTo
    walk.target = jumpTo
    setMood('happy', now)
    sayText('wheee!', now)
}

const refreshAgents = async ($: EngineInterface): Promise<void> => {
    const list = await $.agent.list()
    agents = list.filter(agent => agent.status === 'running').length
}

const blitOrLate = async ($: EngineInterface, site: string, key: string, cells: string): Promise<string | undefined> => {
    const late = $.clock.sleep(BLIT_WAIT_MS).then(() => BLIT_LATE)
    const painted = $.ui.blit({ requestId: site, key, cells }).then(result => result.deny)

    return Promise.race([painted, late])
}

const show = async ($: EngineInterface, site: string, key: string, cells: string): Promise<boolean> => {
    if (denied.has(site)) {
        return true
    }
    const deny = await blitOrLate($, site, key, cells)
    if (deny !== undefined && deny !== BLIT_LATE) {
        denied.add(site)
    }
    lastDeny = deny ?? lastDeny

    return deny !== undefined
}

const frame = async ($: EngineInterface): Promise<void> => {
    const now = await $.clock.now()
    const elapsed = Math.min(200, now - (lastFrameAt || now))
    lastFrameAt = now
    frames += 1
    runDemo(now)
    if (hatchAt !== null && buddy !== null && now - hatchAt > arriveMsOf(buddy.species)) {
        hatchAt = null
        if (isNewborn) {
            sayText(introOf(buddy), now)
            setMood('happy', now)
        }
        isNewborn = false
    }
    if (leave !== null && now - leave.at > LEAVE_MS) {
        leave = null
        $.ui.invalidate('ui.render')
    }
    if (turnAt !== null && !saidThinking && now - turnAt > LONG_THINK_MS) {
        saidThinking = true
        say('thinking', now)
    }
    if (bubble !== null && now - bubble.at > BUBBLE_MS) {
        bubble = null
    }
    hearts = hearts.filter(at => now - at < HEART_MS)
    landJump(now)
    if (note !== null && now - note.at > noteTtlOf(note.text)) {
        note = null
    }
    stepAction(now, demoAt === null ? currentMood(now) : mood)
    if (frames % 10 === 0) {
        await refreshAgents($)
    }
    if (frames % SYNC_EVERY_FRAMES === 0) {
        await syncShared($, now)
    }
    const view = viewOf(now)
    if (view === null || !isShown(now)) {
        return
    }
    if (footerAt === 0 && !isAboveChecked && now - startedAt > FOOTER_WAIT_MS) {
        isAboveChecked = true
        $.ui.invalidate('ui.render')
    }
    if (isClientMode) {
        const key = JSON.stringify(bandPropsOf(now))
        if (key !== lastPropsKey) {
            lastPropsKey = key
            $.ui.invalidate('ui.render')
        }
    }
    if (jumpAt === null) {
        stepWalk(now, elapsed, view.mood)
        stepGlance(now)
    }
    const fresh = { ...view, pose: poseOf(now) }
    let needsRedraw = false
    if (isCardOpen && isCardRaster) {
        const portrait = encode(paintPortrait(fresh))
        if (portrait !== lastPortrait) {
            lastPortrait = portrait
            needsRedraw = (await show($, CARD, PORTRAIT_KEY, portrait)) || needsRedraw
        }
    }
    if (needsRedraw) {
        $.ui.invalidate('ui.render')
    }
}

const tick = async ($: EngineInterface): Promise<void> => {
    if (isTicking) {
        return
    }
    isTicking = true
    const generation = timerGeneration
    await frame($).finally(() => {
        isTicking = generation === timerGeneration ? false : isTicking
    })
}

const ensureTimer = ($: EngineInterface, now: number): void => {
    if (timer !== null && now - Math.max(timerAt, lastFrameAt) < 1000) {
        return
    }
    timer?.cancel()
    timerGeneration += 1
    isTicking = false
    timerAt = now
    timer = $.clock.every(FRAME_MS, () => void tick($).catch((error: unknown) => {
        lastDeny = `frame failed: ${String(error)}`
    }))
}

const knownOf = (stored: Buddy | undefined): Buddy | undefined => {
    if (stored?.species === undefined || SPECIES.some(one => one.id === stored.species)) {
        return stored?.species === undefined ? undefined : stored
    }

    return { ...stored, species: (stored.species as string) === 'bird' ? 'penguin' : 'cat' }
}

const loadBuddy = async ($: EngineInterface, now: number): Promise<void> => {
    const stored = knownOf((await $.store.get(STORE_KEY)) as Buddy | undefined)
    isArrivalPending = true
    if (stored !== undefined) {
        buddy = stored
        return
    }
    buddy = hatch(random, now)
    isNewborn = true
    await $.store.set(STORE_KEY, buddy)
}

const rehatch = async ($: EngineInterface, now: number, species?: SpeciesId): Promise<void> => {
    leave = buddy === null ? null : { species: buddy.species, at: now }
    buddy = hatch(random, now, species)
    buddyVersion += 1
    hatchAt = leave === null ? now : now + LEAVE_MS
    isNewborn = true
    bubble = null
    await $.store.set(STORE_KEY, buddy)
}

const TEST_RUNNERS = /(^|[\s;&/])(gradlew\s+(\S+\s+)*(?<!-x\s)(\w*[tT]est|check)|mvn\s+(\S+\s+)*(test|verify)|(npm|pnpm|yarn|bun)\s+(run\s+)?test|go\s+test|cargo\s+test|pytest|jest|vitest|dotnet\s+test|rspec|phpunit)\b/

export const isTestRun = (command: string): boolean => !command.includes('|') && TEST_RUNNERS.test(command)

const help = (): string => [
    'Your buddy lives on clicks:',
    '  click             pet it',
    '  double click      jump',
    '  drag              carry it',
    '  click empty spot  throw a ball',
    '  right click       menu: card, change buddy, theme (calendar, winter, halloween, off), hide',
    '',
    'Commands, for what a click cannot do:',
    '  /buddy               its card: portrait, stats, personality',
    '  /buddy name <name>   rename it',
    '  /buddy on            bring it back in this session after hide',
    '  /buddy help          this list',
    '',
    'The menu as commands, if you prefer typing:',
    '  /buddy hatch [cat, duck, ghost, octopus, axolotl, robot, ninja, penguin]',
    '  /buddy hat · /buddy theme [auto, winter, halloween, off] · /buddy off',
].join('\n')

const speciesList = (): string => SPECIES.map(one => one.id).join(', ')

const perform = async ($: EngineInterface, now: number, arg: string, rest: readonly string[]): Promise<string> => {
    if (buddy === null) {
        await loadBuddy($, now)
    }
    const current = buddy as Buddy
    if (arg === '' || arg === 'card') {
        await $.ui.open({ id: CARD, title: current.name })
        isCardOpen = true
        lastPortrait = ''

        return `${cardOf(current)}\n\nMenu: right click on the strip\n/buddy name <new name> · /buddy on · /buddy help`
    }
    if (arg === 'pet') {
        pet(now)

        return `${current.name} is happy`
    }
    if (arg === 'theme' || arg === 'hat') {
        const wanted = rest[0]?.toLowerCase()
        const toggled = arg === 'hat' ? (theme === 'winter' ? 'auto' : 'winter') : null
        theme = isTheme(wanted) ? wanted : toggled ?? THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'auto'
        await $.store.set(THEME_KEY, theme)
        $.ui.invalidate('ui.render')

        return {
            auto: 'Theme follows the calendar',
            winter: 'Santa hat on, snow is falling',
            halloween: 'Boo! Witch hat on',
            off: 'No theme',
        }[theme]
    }
    if (arg === 'fruit') {
        if (!isNinja()) {
            return 'Only a ninja slices fruit: /buddy hatch ninja'
        }
        action = { kind: 'fruit', at: now }

        return 'Hai!'
    }
    if (arg === 'jump') {
        return startJump(now) ? 'Jump!' : 'Not enough room to jump'
    }
    if (arg === 'demo') {
        demoAt = now
        demoStep = 0
        saidAt = 0

        return 'Showing every reaction, 25 seconds'
    }
    if (arg === 'hatch') {
        const wanted = speciesFor(rest[0])
        if (rest[0] !== undefined && wanted === undefined) {
            return `No such species. There are: ${speciesList()}`
        }
        await rehatch($, now, wanted?.id)

        return 'Hatching…'
    }
    if (arg === 'name' && rest.length > 0) {
        buddy = { ...current, name: rest.join(' ').slice(0, 14) }
        buddyVersion += 1
        await $.store.set(STORE_KEY, buddy)
        sayText(`I'm ${buddy.name} now`, now)

        return `Renamed to ${buddy.name}`
    }
    if (arg === 'off' || arg === 'on') {
        leave = arg === 'off' && !isOff ? { species: current.species, at: now } : null
        hatchAt = arg === 'on' && isOff ? now : hatchAt
        isOff = arg === 'off'
        $.ui.invalidate('ui.render')

        return isOff ? 'Buddy is resting' : 'Buddy is back'
    }
    if (arg === 'debug') {
        return [
            `frames ${frames}, last frame ${Math.round(now - lastFrameAt)} ms ago`,
            `drawing: ${isClientMode ? 'client' : 'not drawn yet'}`,
            `clicks heard: ${messages}${lastMessage === '' ? '' : `, last: ${lastMessage}`}`,
            `problems: ${lastDeny || 'none'}`,
        ].join('\n')
    }

    return help()
}

const pressMenu = async ($: EngineInterface, now: number, key: string): Promise<void> => {
    if (key === 'open' || key === 'back') {
        menuPage = 'main'
    } else if (key === 'new') {
        menuPage = 'species'
    } else if (key.startsWith('hatch:')) {
        menuPage = null
        const species = key.slice('hatch:'.length)
        await perform($, now, 'hatch', species === 'random' ? [] : [species])
    } else if (key === 'theme') {
        await perform($, now, 'theme', [])
    } else if (key === 'hide') {
        menuPage = null
        await perform($, now, 'off', [])
    } else if (key === 'card' && buddy !== null) {
        menuPage = null
        const [title = '', ...lines] = cardOf(buddy).split('\n')
        note = { title, text: lines.filter(line => line !== '').join('\n'), at: now }
    } else {
        menuPage = null
    }
    $.ui.invalidate('ui.render')
}

const drawBand = async ($: EngineInterface, e: ResolveInput & { requestId?: string }, theirs: RenderElement, width: number, isFooter: boolean): Promise<RenderElement> => {
    const now = await $.clock.now()
    if (isArrivalPending) {
        isArrivalPending = false
        hatchAt = now
    }
    cols = Math.min(WIDTH, width)
    const props = bandPropsOf(now)
    if (props === null || cols < MIN_COLS || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
        return theirs
    }
    isClientMode = true
    lastPropsKey = JSON.stringify(props)
    const { Box, Text } = $.ui.resolve(e)
    if (isFooter) {
        return (
            <Box flexDirection="row">
                {theirs}
                <Text> </Text>
                {h('Client', { key: CLIENT_KEY, module: './band-client.tsx', props, width: cols, height: props.rows })}
            </Box>
        )
    }

    return (
        <Box flexDirection="column">
            {theirs}
            <Box flexDirection="row" justifyContent="flex-end">
                {h('Client', { key: CLIENT_KEY, module: './band-client.tsx', props, width: cols, height: props.rows })}
            </Box>
        </Box>
    )
}

export const register: Register = on => {
    on('session.start', async ($, e, next) => {
        const now = await $.clock.now()
        theme = await readTheme($)
        lastSeenAt = now
        await $.command.register({ name: COMMAND, description: 'Your pixel buddy. Most things are clicks: right click it for the menu', argumentHint: 'help · name <new name> · on' })
        await loadBuddy($, now)
        startedAt = now
        await dropSessionEntries($)
        ensureTimer($, now)

        return next(e)
    })

    on('command.run', { command: COMMAND }, async ($, e) => {
        const now = await $.clock.now()
        const [raw = '', ...rest] = e.args.trim().split(/\s+/)
        const word = raw.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '')
        ensureTimer($, now)
        lastSeenAt = now

        return { text: await perform($, now, ALIASES[word] ?? word, rest) }
    }).catch(() => ({ text: 'pixel-buddy hit an error here, /buddy debug shows the last one' }))

    on('prompt.edit', async ($, e, next) => {
        typingAt = await $.clock.now()

        return next(e)
    })

    on('prompt.submit', async ($, e, next) => {
        const now = await $.clock.now()
        ensureTimer($, now)
        if (now - lastSeenAt > SLEEP_AFTER_MS) {
            say('back', now, true)
        }
        lastSeenAt = now

        return next(e)
    }).catch(($, e, next) => next(e))

    on('turn.start', async ($, e, next) => {
        if (e.agentId === undefined) {
            const now = await $.clock.now()
            turnAt = now
            saidThinking = false
            if (MOOD_MS[mood] === undefined) {
                setMood('think', now)
            }
        }

        return next(e)
    })

    on('turn.complete', async ($, e, next) => {
        if (e.agentId === undefined && turnAt !== null) {
            const now = await $.clock.now()
            const isMarathon = e.reason === 'answer' && now - turnAt > MARATHON_MS
            turnAt = null
            lastSeenAt = now
            if (isMarathon) {
                setMood('happy', now)
                say('marathon', now, true)
            } else if (MOOD_MS[mood] === undefined) {
                setMood('idle', now)
            }
        }

        return next(e)
    })

    on('agent.spawn', async ($, e, next) => {
        if (e.resume === undefined) {
            say('agents', await $.clock.now())
        }

        return next(e)
    }).catch(($, e, next) => next(e))

    on('tool.call', async ($, e, next) => {
        const isMain = e.agentId === undefined
        const callAt = await $.clock.now()
        ensureTimer($, callAt)
        if (isMain && MOOD_MS[mood] === undefined) {
            setMood('tool', callAt)
        }
        const ran = await next(e)
        if (!isMain) {
            return ran
        }
        const now = await $.clock.now()
        if (ran.isError === true) {
            errorStreak += 1
            if (errorStreak >= LOOP_ERRORS) {
                errorStreak = 0
                setMood('dizzy', now)
                say('loop', now, true)
            } else if (isNinja()) {
                action = { kind: 'slice', at: now }
                say('error', now, errorStreak === 1)
            } else {
                setMood('shock', now)
                say('error', now, errorStreak === 1)
            }

            return ran
        }
        if (ran.deny === undefined) {
            errorStreak = 0
        }
        if (MOOD_MS[mood] === undefined) {
            setMood('think', now)
        }
        if (e.tool === 'Bash' && /\bgit commit\b/.test(e.command)) {
            setMood('happy', now)
            say('commit', now)
            celebrate(now)
        } else if (e.tool === 'Bash' && isTestRun(e.command)) {
            say('green', now)
            celebrate(now)
        }
        if (e.tool === 'TodoWrite') {
            const isDone = e.todos.length > 0 && e.todos.every(todo => todo.status === 'completed')
            if (isDone && !todoDone) {
                setMood('happy', now)
                say('plan', now, true)
                celebrate(now)
            }
            todoDone = isDone
        }

        return ran
    }).catch(($, e, next) => next(e))

    on('ui.message', async ($, e, next) => {
        if (e.element !== CLIENT_KEY) {
            return next(e)
        }
        const now = await $.clock.now()
        const kind = (e.data as { type?: string } | null)?.type
        messages += 1
        lastMessage = `${kind ?? 'unknown'} ${new Date(now).toLocaleTimeString()}`
        lastSeenAt = now
        if (kind === 'pet' && note !== null) {
            note = null
        } else if (kind === 'pet') {
            pet(now)
        }
        if (kind === 'jump') {
            startJump(now)
        }
        if (kind === 'menu') {
            await pressMenu($, now, String((e.data as { key?: unknown } | null)?.key ?? 'close'))
        }
        if (kind === 'error') {
            lastDeny = `client error: ${String((e.data as { message?: unknown } | null)?.message ?? '')}`
        }
        if (kind === 'caught') {
            const toy = (e.data as { kind?: string } | null)?.kind
            if (toy === 'shuriken') {
                action = { kind: 'swing', at: now - SWING_MS * 0.4 }
                sayText('hai!', now)
            } else {
                setMood('happy', now)
                sayText('got it!', now)
            }
        }
        const props = bandPropsOf(now)

        return props === null ? {} : { props }
    })

    on('ui.close', async ($, e, next) => {
        if (e.id === CARD) {
            isCardOpen = false
        }

        return next(e)
    }).catch(($, e, next) => next(e))

    on('ui.render', { component: 'Pane', requestId: CARD }, async ($, e) => {
        const { Box, Text } = $.ui.resolve(e)
        const now = await $.clock.now()
        const view = viewOf(now)
        if (buddy === null || view === null) {
            return <Text dimColor>No buddy yet</Text>
        }
        const rarity = rarityOf(buddy.rarity)
        const color = `#${rarity.color.toString(16).padStart(6, '0')}`
        const species = speciesOf(buddy.species)
        const portrait = encode(paintPortrait(view))
        lastPortrait = portrait
        isCardRaster = e.surface === 'terminal'
        const picture = e.surface === 'terminal' ? $.ui.resolve(e).Raster({ key: PORTRAIT_KEY, columns: PORTRAIT_COLS, rows: PORTRAIT_ROWS, cells: portrait }) : null
        const isWide = e.props.bodyColumns >= PORTRAIT_COLS + 24

        return (
            <Box flexDirection="column" rowGap={1}>
                <Box flexDirection={isWide ? 'row' : 'column'} columnGap={2}>
                    {picture}
                    <Box flexDirection="column">
                        <Text color={color} weight="bold">{buddy.name}</Text>
                        <Text>{species.name}</Text>
                        <Text color={color}>{'★'.repeat(rarity.stars)}{'☆'.repeat(5 - rarity.stars)} {rarity.label}</Text>
                        <Text dimColor>hatched {new Date(buddy.hatchedAt).toLocaleDateString('en-US')}</Text>
                    </Box>
                </Box>
                <Box flexDirection="column">
                    {STAT_NAMES.map((stat, i) => (
                        <Box flexDirection="row" columnGap={1}>
                            <Text dimColor>{stat.padEnd(9)}</Text>
                            <Text color={STAT_COLORS[i] ?? color}>{'█'.repeat(Math.round(buddy!.stats[stat] / 10))}</Text>
                            <Text dimColor>{'░'.repeat(10 - Math.round(buddy!.stats[stat] / 10))} {buddy!.stats[stat]}</Text>
                        </Box>
                    ))}
                </Box>
                <Text dimColor>{help()}</Text>
            </Box>
        )
    })

    on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
        const columns = e.viewport?.columns
        if (!isShown(await $.clock.now()) || columns === undefined || e.surface !== 'terminal') {
            return next(e)
        }
        const width = Math.min(WIDTH, columns - FOOTER_RESERVE)
        const isFit = width >= MIN_COLS
        const isChanged = footerAt === 0 || isFit !== isFooterFit
        footerAt = await $.clock.now()
        isFooterFit = isFit
        if (isChanged) {
            $.ui.invalidate('ui.render')
        }
        if (!isFit) {
            return next(e)
        }

        return drawBand($, e, await next(e), width, true)
    })

    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        const now = await $.clock.now()
        const isInFooter = e.surface === 'terminal' && (footerAt === 0 ? now - startedAt < FOOTER_WAIT_MS : isFooterFit)
        if (!isShown(now) || e.props.hasSurvey || isInFooter) {
            return next(e)
        }

        return drawBand($, e, await next(e), e.props.bodyColumns, false)
    })
}

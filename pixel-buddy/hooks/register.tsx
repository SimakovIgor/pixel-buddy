import type { EngineInterface, Register, RenderElement, ResolveInput, Timer } from 'claude-code'

import type { BandProps } from './band-client'

import { FULL, SNACKS, VIBE_MARKS, affectionOf, bar, cardOf, fullnessOf, hatch, headerOf, introOf, levelOf, meter, peakOf, rarityOf, vibeOf } from './buddy'
import type { Buddy, Mood as Feeling, SnackKind } from './buddy'
import { FACTS, factOf, sayingMsOf } from './facts'
import type { Fact } from './facts'
import { lineFor } from './lines'
import type { Moment } from './lines'
import { BUBBLE_MS, HEART_MS, LEAVE_MS, TROPHY_MS, arriveMsOf, JUMP_MS, MIN_COLS, FRUIT_MS, SLICE_MS, SWING_MS, TRICK_MS, WIDTH, rowsOf, PORTRAIT_COLS, PORTRAIT_ROWS, encode, portraitOf } from './scene'
import type { ActionKind, Menu, MenuItem, Mood, Season } from './scene'
import { SPECIES, speciesOf } from './species'
import type { SpeciesId } from './species'
import { BALLS, BALL_WINDOW_MS, COMEBACK_MS, DEEP_THOUGHT, DUCK_MS, GROWN_LEVEL, HIVE, REGULAR_DAYS, TROPHIES, commitTrophiesAt, countOf, dayKeyOf, emojisOf, foundOf, nextTally, ownedTrophiesOf, tallyOf, toastOf, trophyOf } from './trophies'
import type { Found, TrophyId } from './trophies'
import { shareOf } from './share'
import { trophyCaseOf } from './badges'

const CLIENT_KEY = 'buddy-band'
const PET_PREFIX = 'pet:'
const SEATS_KEY = 'seats'
const SEATS_KEPT = 50
const MAIN_KEY = 'main'
const LEGACY_BUDDY = 'buddy'
const LEGACY_NEST = 'nest'
const NEST_MAX = 12
const HAT_KEY = 'hat'
const THEME_KEY = 'theme'
const FACTS_KEY = 'facts'
const TROPHY_KEY = 'trophies'
const TALLY_KEY = 'tally'
const THEMES = ['auto', 'winter', 'halloween', 'off'] as const

type Theme = (typeof THEMES)[number]
const SESSION_PREFIX = 'session:'
const SYNC_EVERY_FRAMES = 15
const AGENTS_EVERY_FRAMES = 3
const COMMAND = 'buddy'
const FRAME_MS = 200
const CHATTER_GAP_MS = 20000
const SLEEP_AFTER_MS = 180000
const FOOTER_RESERVE = 96
const FOOTER_WAIT_MS = 1500
const MARATHON_MS = 90000
const LONG_THINK_MS = 60000
const FACT_AFTER_MS = 90000
const FACT_EVERY_MS = 3 * 60000
const TYPING_QUIET_MS = 10000
const LOOP_ERRORS = 3
const SNACK_QUEUE = 3
const HUNGRY_NAG_MS = 20 * 60000
const TIRED_NAG_MS = 30 * 60000
const LONELY_NAG_MS = 45 * 60000
const BREAK_MS = 10 * 60000
const CARD_MS = 60000
const CARD_DRAW_WAIT_MS = 1500
const TROPHY_SAY_MS = 1500
const NOMS = ['nom!', 'yum!', 'crunch!', 'mmm!']

const MOOD_MS: Partial<Record<Mood, number>> = { shock: 1600, dizzy: 3200, happy: 2600, love: 2600 }

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
let timer: Timer | null = null
let timerAt = 0
let lastFrameAt = 0
let isTicking = false
let timerGeneration = 0
let frames = 0
let cols = WIDTH
let jumpAt: number | null = null
let messages = 0
let theme: Theme = 'auto'
let menuPage: 'main' | 'nest' | 'species' | null = null
let nest: Buddy[] = []
let sessionId = ''
let seats: Record<string, number> = {}
let mainId: number | null = null
let arrivalLine: string | null = null
let snacks: Array<{ kind: SnackKind; at: number }> = []
let hungryNagAt = 0
let tiredNagAt = 0
let lonelyNagAt = 0
let activeSince = 0
let lastActiveAt = 0
let joy: { what: string; at: number } | null = null
let cardAt: number | null = null
let caseAt: number | null = null
let cardDrawnAt = 0
let isCardInChat = false
let lastMenuKey = ''
let aboveDraws = 0
let found: Found = {}
let trophyShow: { id: TrophyId; at: number; isSaid: boolean } | null = null
let trophyQueue: TrophyId[] = []
let dizzyAt = 0
let answers = 0
let catches: number[] = []
let talliedDay = ''
let isFactsOn = true
let factStep: number | null = null
let factAt = 0
let talk: { parts: Fact; index: number; at: number } | null = null

const ALIASES: Record<string, string> = {
    rename: 'name',
    trophy: 'trophies',
    brag: 'share',
}

const speciesFor = (word: string | undefined) => (word === undefined ? undefined : SPECIES.find(one => one.id === word.toLowerCase()))

const menuOf = (): Menu | null => {
    if (menuPage === null || buddy === null) {
        return null
    }
    if (menuPage === 'species') {
        const items: MenuItem[] = SPECIES.map(one => ({ key: `hatch:${one.id}`, label: one.name, isOn: false }))

        return { items: [...items, { key: 'hatch:random', label: 'random', isOn: false }, { key: 'back', label: '←', isOn: false }], header: 'a new egg: pick a species, everyone else stays in your nest' }
    }
    if (menuPage === 'nest') {
        const items: MenuItem[] = [buddy, ...nest].map(one => ({
            key: one === buddy ? 'close' : `pick:${one.hatchedAt}`,
            label: `${one.name} ${speciesOf(one.species).name} lv${levelOf(one.xp ?? 0).level}${one.isShiny === true ? ' ✦' : ''}`,
            isOn: one === buddy,
        }))
        const isFull = nest.length + 1 >= NEST_MAX

        return {
            items: [...items, { key: isFull ? 'full' : 'new', label: isFull ? 'nest is full' : '+ new egg', isOn: false }, { key: 'back', label: '←', isOn: false }],
            header: `your nest: ${nest.length + 1} ${nest.length === 0 ? 'buddy' : 'buddies'}. Pick one for this window`,
        }
    }
    const items: MenuItem[] = [
        cardAt === null ? { key: 'card', label: 'card', isOn: false } : { key: 'card-close', label: 'hide card', isOn: true },
        { key: 'feed', label: 'feed', isOn: false },
        { key: 'nest', label: 'buddies', isOn: false },
        caseAt === null ? { key: 'trophies', label: 'trophies', isOn: false } : { key: 'trophies-close', label: 'hide trophies', isOn: true },
        { key: 'share', label: 'share', isOn: false },
        { key: 'theme', label: 'theme', isOn: theme !== 'auto' && theme !== 'off' },
        { key: 'facts', label: 'facts', isOn: isFactsOn },
        { key: 'hide', label: 'hide', isOn: false },
        { key: 'close', label: '×', isOn: false },
    ]

    return { items, header: headerOf(buddy, lastFrameAt || startedAt, feelingOf(lastFrameAt || startedAt)) }
}

let startedAt = 0

const LEGACY_KEYS = ['lang', 'tropic', 'homes']

const dropLegacyKeys = async ($: EngineInterface): Promise<void> => {
    const keys = (await $.store.keys()).filter(key => key.startsWith(SESSION_PREFIX) || LEGACY_KEYS.includes(key))
    await Promise.all(keys.map(key => $.store.delete(key)))
}

const petKey = (id: number): string => `${PET_PREFIX}${id}`

const wantedId = (): number | null => seats[sessionId] ?? mainId

const readSeats = async ($: EngineInterface): Promise<Record<string, number>> => {
    const stored = await $.store.get(SEATS_KEY).catch(() => undefined)
    const isSeats = typeof stored === 'object' && stored !== null && !Array.isArray(stored) && Object.values(stored).every(id => typeof id === 'number')

    return isSeats ? (stored as Record<string, number>) : {}
}

const seatAt = async ($: EngineInterface, id: number): Promise<void> => {
    if (sessionId === '') {
        return
    }
    const others = Object.entries(await readSeats($)).filter(([seat]) => seat !== sessionId)
    seats = Object.fromEntries([...others.slice(-(SEATS_KEPT - 1)), [sessionId, id]])
    await $.store.set(SEATS_KEY, seats)
}

const readMain = async ($: EngineInterface): Promise<number | null> => {
    const stored = await $.store.get(MAIN_KEY).catch(() => undefined)

    return typeof stored === 'number' ? stored : null
}

const byAge = (a: Buddy, b: Buddy): number => a.hatchedAt - b.hatchedAt

const readPets = async ($: EngineInterface): Promise<Buddy[]> => {
    const keys = (await $.store.keys().catch(() => [] as string[])).filter(key => key.startsWith(PET_PREFIX))
    const pets = await Promise.all(keys.map(async key => knownOf((await $.store.get(key).catch(() => undefined)) as Buddy | undefined)))

    return pets.filter((one): one is Buddy => one !== undefined).sort(byAge)
}

const migrate = async ($: EngineInterface): Promise<Buddy[]> => {
    const legacy = knownOf((await $.store.get(LEGACY_BUDDY).catch(() => undefined)) as Buddy | undefined)
    const legacyNest = await $.store.get(LEGACY_NEST).catch(() => undefined)
    const kept = Array.isArray(legacyNest) ? legacyNest.map(one => knownOf(one as Buddy)) : []
    const pets = [...kept, legacy].filter((one): one is Buddy => one !== undefined).sort(byAge)
    if (pets.length === 0) {
        return []
    }
    await Promise.all(pets.map(one => $.store.set(petKey(one.hatchedAt), one).catch(() => undefined)))
    if (legacy !== undefined) {
        mainId = legacy.hatchedAt
        await $.store.set(MAIN_KEY, mainId).catch(() => undefined)
    }
    await $.store.delete(LEGACY_BUDDY).catch(() => undefined)
    await $.store.delete(LEGACY_NEST).catch(() => undefined)

    return pets
}

const rest = (one: Buddy, now: number): Buddy =>
    ({ ...one, belly: { value: Math.round(fullnessOf(one, now)), at: now }, affection: { value: Math.round(affectionOf(one, now)), at: now } })

const wake = (one: Buddy, now: number): Buddy =>
    ({ ...one, belly: { value: one.belly?.value ?? 60, at: now }, affection: { value: one.affection?.value ?? 60, at: now } })

const syncShared = async ($: EngineInterface): Promise<void> => {
    const version = buddyVersion
    const stored = buddy === null ? undefined : knownOf((await $.store.get(petKey(buddy.hatchedAt)).catch(() => undefined)) as Buddy | undefined)
    if (version === buddyVersion && stored !== undefined && buddy !== null && stored.hatchedAt === buddy.hatchedAt) {
        buddy = { ...buddy, name: stored.name, xp: stored.xp ?? buddy.xp, belly: stored.belly ?? buddy.belly, affection: stored.affection ?? buddy.affection }
    }
    theme = await readTheme($)
    found = { ...foundOf(await $.store.get(TROPHY_KEY).catch(() => undefined)), ...found }
    applyFacts(await $.store.get(FACTS_KEY).catch(() => undefined))
}

const applyFacts = (stored: unknown): void => {
    const saved = typeof stored === 'object' && stored !== null ? (stored as { next?: unknown; isOff?: unknown }) : {}
    isFactsOn = saved.isOff !== true
    factStep = typeof saved.next === 'number' ? Math.max(saved.next, factStep ?? saved.next) : factStep
}

const saveFacts = ($: EngineInterface): Promise<void> =>
    $.store.set(FACTS_KEY, { next: factStep, isOff: !isFactsOn }).then(() => undefined, () => undefined)

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
let action: { kind: ActionKind; at: number } | null = null
let nextTrickAt = 0
let isClientMode = false
let footerAt = 0
let isFooterFit = false
let isAboveChecked = false
let lastPropsKey = ''
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
    talk = null
}

const sayText = (line: string, now: number): void => {
    bubble = { text: line, at: now }
    saidAt = now
    talk = null
}

const tellFact = ($: EngineInterface, now: number): Fact => {
    const step = factStep ?? Math.floor(random() * FACTS.length)
    const fact = factOf(step)
    factStep = step + 1
    factAt = now
    void saveFacts($)
    bubble = { text: fact[0] ?? '', at: now }
    saidAt = now
    talk = { parts: fact, index: 0, at: now }

    return fact
}

const stepTalk = (now: number): void => {
    if (talk === null || now - talk.at <= sayingMsOf(talk.parts[talk.index] ?? '')) {
        return
    }
    const index = talk.index + 1
    const part = talk.parts[index]
    if (part === undefined) {
        talk = null

        return
    }
    talk = { ...talk, index, at: now }
    bubble = { text: part, at: now }
    saidAt = now
}

const isFactTime = (now: number): boolean =>
    isFactsOn && isShown(now) && !isOff && demoAt === null && hatchAt === null && turnAt !== null && talk === null
    && now - turnAt > FACT_AFTER_MS && now - factAt > FACT_EVERY_MS && now - saidAt > CHATTER_GAP_MS && now - typingAt > TYPING_QUIET_MS

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

const award = ($: EngineInterface, id: TrophyId, now: number): void => {
    if (found[id] !== undefined) {
        return
    }
    found = { ...found, [id]: now }
    trophyQueue = [...trophyQueue, id]
    void $.store.get(TROPHY_KEY)
        .then(stored => $.store.set(TROPHY_KEY, { ...foundOf(stored), ...found }))
        .catch((error: unknown) => {
            lastDeny = `store failed: ${String(error)}`
        })
}

const claimOwned = ($: EngineInterface, now: number): void => {
    ownedTrophiesOf([...(buddy === null ? [] : [buddy]), ...nest]).forEach(id => award($, id, now))
}

const tallyDay = async ($: EngineInterface, now: number): Promise<void> => {
    if (talliedDay === dayKeyOf(now)) {
        return
    }
    const tally = nextTally(tallyOf(await $.store.get(TALLY_KEY)), now)
    talliedDay = tally.day
    await $.store.set(TALLY_KEY, tally)
    if (tally.streak >= REGULAR_DAYS) {
        award($, 'regular', now)
    }
}

const showTrophy = ($: EngineInterface, now: number): void => {
    if (trophyShow !== null && !trophyShow.isSaid && now - trophyShow.at > TROPHY_SAY_MS) {
        trophyShow = { ...trophyShow, isSaid: true }
        sayText(`${trophyOf(trophyShow.id).name}!`, now)
    }
    if (trophyShow !== null && now - trophyShow.at > TROPHY_MS) {
        trophyShow = null
    }
    const [next, ...rest] = trophyQueue
    if (trophyShow !== null || next === undefined || buddy === null || hatchAt !== null || !isShown(now) || demoAt !== null) {
        return
    }
    trophyQueue = rest
    trophyShow = { id: next, at: now, isSaid: false }
    setMood('happy', now)
    bubble = null
    action = null
    $.ui.toast(toastOf(next, found))
}

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

const markActive = (now: number): void => {
    if (now - lastActiveAt > BREAK_MS) {
        activeSince = now
    }
    lastActiveAt = now
}

const workedMs = (now: number): number => (lastActiveAt !== 0 && now - lastActiveAt <= BREAK_MS ? now - activeSince : 0)

const cheer = (what: string, now: number): void => {
    joy = { what, at: now }
}

const feelingOf = (now: number): Feeling => vibeOf({
    fullness: buddy === null ? 100 : fullnessOf(buddy, now),
    affection: buddy === null ? 100 : affectionOf(buddy, now),
    workedMs: workedMs(now),
    joy: joy === null ? null : { what: joy.what, agoMs: now - joy.at },
})

const saveBuddy = ($: EngineInterface, next: Buddy): void => {
    buddy = next
    void $.store.set(petKey(next.hatchedAt), next).catch((error: unknown) => {
        lastDeny = `store failed: ${String(error)}`
    })
}

const cherish = ($: EngineInterface, amount: number, now: number): void => {
    if (buddy !== null) {
        saveBuddy($, { ...buddy, affection: { value: Math.min(100, Math.round(affectionOf(buddy, now) + amount)), at: now } })
    }
}

const PANEL_HINT = 'Don\'t see it? Click the "▸ plugin panel hidden" line right above the prompt'

const openCase = ($: EngineInterface, now: number): void => {
    caseAt = now
    cardAt = null
    sayText('my trophies are up there ↑', now)
    $.ui.toast(`Trophy case opened above the prompt. ${PANEL_HINT}`)
}

const openCard = ($: EngineInterface, now: number): void => {
    cardAt = now
    caseAt = null
    isCardInChat = false
    sayText('my card is up there ↑', now)
    $.ui.toast(`Card opened above the prompt. ${PANEL_HINT}`)
}

const cardInChat = ($: EngineInterface, now: number): void => {
    if (buddy === null) {
        return
    }
    isCardInChat = true
    cardOf(buddy, now, feelingOf(now)).split('\n').slice(0, 7).filter(line => line !== '').forEach(line => $.ui.log(line))
    sayText('here is my card, in the chat', now)
}

const hexOf = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

const drawCard = ($: EngineInterface, e: ResolveInput, now: number, width: number): RenderElement | null => {
    if (buddy === null || cardAt === null) {
        return null
    }
    cardDrawnAt = now
    const { Box, Text } = $.ui.resolve(e)
    const rarity = rarityOf(buddy.rarity)
    const color = hexOf(rarity.color)
    const species = speciesOf(buddy.species)
    const feeling = feelingOf(now)
    const { level, into, need } = levelOf(buddy.xp ?? 0)
    const belly = Math.round(fullnessOf(buddy, now))
    const love = Math.round(affectionOf(buddy, now))
    const stars = `${'★'.repeat(rarity.stars)}${'☆'.repeat(5 - rarity.stars)}`
    const portrait = encode(portraitOf(buddy.species, buddy.rarity, buddy.isShiny === true, seasonOf(now), now))
    const picture = e.surface === 'terminal' ? $.ui.resolve(e).Raster({ key: 'card-portrait', columns: PORTRAIT_COLS, rows: PORTRAIT_ROWS, cells: portrait }) : null

    return (
        <Box key="buddy-card" flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} width={Math.min(width, 72)}>
            <Box flexDirection="row" columnGap={2}>
                {picture}
                <Box flexDirection="column">
                    <Text color={color} weight="bold">{buddy.name}{buddy.isShiny === true ? ' ✦' : ''}</Text>
                    <Text>{species.name} · {stars} {rarity.label}</Text>
                    <Text>{VIBE_MARKS[feeling.vibe]} {feeling.vibe}: {feeling.why}</Text>
                    <Box flexDirection="row">
                        <Text>level {level} </Text>
                        <Text color={color}>{meter(into, need)}</Text>
                        <Text> {into}/{need} xp</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Text>belly </Text>
                        <Text color="#ffb35c">{bar(belly)}</Text>
                        <Text> {belly}%</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Text>love  </Text>
                        <Text color="#ff7aa8">{bar(love)}</Text>
                        <Text> {love}%</Text>
                    </Box>
                </Box>
            </Box>
            <Box flexDirection="row">
                <Text>trophies {countOf(found) === 0 ? '' : `${emojisOf(found)} `}</Text>
                <Text dimColor>{countOf(found)} of {TROPHIES.length} · menu → trophies</Text>
            </Box>
            <Text dimColor>this window's buddy · {nest.length + 1} in your nest · menu → hide card</Text>
        </Box>
    )
}

const CASE_GOLD = 0xffcf3f

const CASE_CELL = 16

const badgeTextOf = ($: EngineInterface, e: ResolveInput, width: number): RenderElement => {
    const { Box, Text } = $.ui.resolve(e)
    const perRow = Math.max(2, Math.min(7, Math.floor((width - 4) / CASE_CELL)))
    const rows = Array.from({ length: Math.ceil(TROPHIES.length / perRow) }, (_, i) => TROPHIES.slice(i * perRow, (i + 1) * perRow))

    return (
        <Box key="trophy-badges" flexDirection="column">
            {rows.map((row, r) => (
                <Box key={`row-${r}`} flexDirection="row">
                    {row.map(one => {
                        if (found[one.id] !== undefined) {
                            return <Box key={one.id} width={CASE_CELL}><Text color={hexOf(rarityOf(one.rarity).color)}>{one.emoji} {one.label}</Text></Box>
                        }

                        return <Box key={one.id} width={CASE_CELL}><Text dimColor>{one.isSecret ? '?  ???' : `○  ${one.label}`}</Text></Box>
                    })}
                </Box>
            ))}
        </Box>
    )
}

const drawCase = ($: EngineInterface, e: ResolveInput, now: number, width: number): RenderElement | null => {
    if (caseAt === null) {
        return null
    }
    const { Box, Text } = $.ui.resolve(e)
    const room = Math.min(width, 92)
    const shown = e.surface === 'terminal' ? trophyCaseOf(found, room - 4) : null
    const latest = TROPHIES.filter(one => found[one.id] !== undefined).sort((a, b) => (found[b.id] ?? 0) - (found[a.id] ?? 0))[0]
    const badges = e.surface === 'terminal' && shown !== null
        ? $.ui.resolve(e).Raster({ key: 'trophy-badges', columns: shown.columns, rows: shown.rows, cells: encode(shown.cells) })
        : badgeTextOf($, e, room)

    return (
        <Box key="trophy-case" flexDirection="column" borderStyle="round" borderColor={hexOf(CASE_GOLD)} paddingX={1} width={shown === null ? room : shown.columns + 4}>
            <Box flexDirection="row">
                <Text color={hexOf(CASE_GOLD)} weight="bold">trophies </Text>
                <Text>{countOf(found)} of {TROPHIES.length}</Text>
                <Text dimColor>{latest === undefined ? ' · rare moments of your work earn them' : ` · the latest: ${latest.name}`} · menu → share shows them off</Text>
            </Box>
            {badges}
        </Box>
    )
}

const dropSnack = (kind: SnackKind, now: number): void => {
    if (buddy === null || snacks.length >= SNACK_QUEUE) {
        return
    }
    snacks = [...snacks, { kind, at: now + snacks.length }]
}

const feedByHand = (now: number): string => {
    if (buddy === null) {
        return ''
    }
    if (fullnessOf(buddy, now) >= FULL) {
        sayText('so full… maybe later', now)

        return `${buddy.name} is full`
    }
    dropSnack('berry', now)

    return `${buddy.name} got a berry`
}

const grow = ($: EngineInterface, now: number, kind: SnackKind): void => {
    if (buddy === null) {
        return
    }
    const fullness = fullnessOf(buddy, now)
    const xp = SNACKS[kind].xp + (kind === 'berry' && feelingOf(now).vibe === 'hungry' ? 1 : 0)
    const before = levelOf(buddy.xp ?? 0).level
    const next: Buddy = { ...buddy, xp: (buddy.xp ?? 0) + xp, belly: { value: Math.min(100, Math.round(fullness + SNACKS[kind].food)), at: now } }
    saveBuddy($, next)
    const after = levelOf(next.xp ?? 0).level
    void tallyDay($, now).catch((error: unknown) => {
        lastDeny = `store failed: ${String(error)}`
    })
    if (after >= GROWN_LEVEL) {
        award($, 'grown', now)
    }
    setMood('happy', now)
    if (after > before) {
        cheer(`a new level, ${after}`, now)
        sayText(`level ${after}!`, now)
        action = null
        celebrate(now)

        return
    }
    sayText(NOMS[Math.floor(random() * NOMS.length)] ?? 'nom!', now)
}

const isFreeFor = (current: Mood): boolean => current === 'idle' || current === 'think' || current === 'tool'

const stepAction = (now: number, current: Mood): void => {
    const span = action === null ? 0 : { swing: SWING_MS, slice: SLICE_MS, fruit: FRUIT_MS, trick: TRICK_MS }[action.kind]
    if (action !== null && now - action.at > span) {
        action = null
    }
    if (action === null && buddy !== null && isFreeFor(current) && now > nextTrickAt) {
        if (nextTrickAt !== 0) {
            action = { kind: isNinja() ? (random() < 0.6 ? 'fruit' : 'swing') : 'trick', at: now }
        }
        nextTrickAt = feelingOf(now).vibe === 'joyful' ? now + 10000 + random() * 8000 : now + 20000 + random() * 15000
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

const bandPropsOf = (now: number): BandProps | null => {
    if (buddy === null) {
        return null
    }

    return {
        cols,
        rows: rowsOf(cols, menuOf()),
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
        action,
        season: seasonOf(now),
        menu: menuOf(),
        snack: snacks[0] ?? null,
        isShiny: buddy.isShiny === true,
        vibe: feelingOf(now).vibe,
        trophy: trophyShow === null ? null : { rarity: trophyOf(trophyShow.id).rarity, at: trophyShow.at },
    }
}

const startJump = (now: number): boolean => {
    if (!isClientMode) {
        return false
    }
    jumpAt = now

    return true
}

const landJump = (now: number): void => {
    if (jumpAt === null || now - jumpAt <= JUMP_MS) {
        return
    }
    jumpAt = null
    setMood('happy', now)
    sayText('wheee!', now)
}

const nag = (now: number): void => {
    const { vibe } = feelingOf(now)
    if (vibe === 'hungry' && now - hungryNagAt > HUNGRY_NAG_MS) {
        hungryNagAt = now
        say('hungry', now, true)
    } else if (vibe === 'tired' && now - tiredNagAt > TIRED_NAG_MS) {
        tiredNagAt = now
        say('tired', now, true)
    } else if (vibe === 'lonely' && now - lonelyNagAt > LONELY_NAG_MS) {
        lonelyNagAt = now
        say('lonely', now, true)
    }
}

const refreshAgents = async ($: EngineInterface, now: number): Promise<void> => {
    const list = await $.agent.list()
    const running = list.filter(agent => agent.status === 'running').length
    if (running > agents) {
        say('agents', now)
    }
    agents = running
    if (agents >= HIVE) {
        award($, 'hive', now)
    }
}

const frame = async ($: EngineInterface): Promise<void> => {
    const now = await $.clock.now()
    lastFrameAt = now
    frames += 1
    runDemo(now)
    if (hatchAt !== null && buddy !== null && now - hatchAt > arriveMsOf(buddy.species)) {
        hatchAt = null
        if (isNewborn) {
            sayText(introOf(buddy), now)
            setMood('happy', now)
        } else if (arrivalLine !== null) {
            sayText(arrivalLine, now)
            setMood('happy', now)
        }
        isNewborn = false
        arrivalLine = null
    }
    if (leave !== null && now - leave.at > LEAVE_MS) {
        leave = null
        $.ui.invalidate('ui.render')
    }
    showTrophy($, now)
    if (turnAt !== null && !saidThinking && now - turnAt > LONG_THINK_MS) {
        saidThinking = true
        say('thinking', now)
    }
    stepTalk(now)
    if (isFactTime(now)) {
        tellFact($, now)
    }
    if (cardAt !== null && !isCardInChat && cardDrawnAt < cardAt && now - cardAt > CARD_DRAW_WAIT_MS) {
        cardInChat($, now)
    }
    if (cardAt !== null && now - cardAt > CARD_MS) {
        cardAt = null
        $.ui.invalidate('ui.render')
    }
    if (caseAt !== null && now - caseAt > CARD_MS) {
        caseAt = null
        $.ui.invalidate('ui.render')
    }
    if (bubble !== null && now - bubble.at > BUBBLE_MS) {
        bubble = null
    }
    hearts = hearts.filter(at => now - at < HEART_MS)
    landJump(now)
    stepAction(now, demoAt === null ? currentMood(now) : mood)
    if (buddy !== null && !isOff && demoAt === null && hatchAt === null && turnAt === null && currentMood(now) !== 'sleep') {
        nag(now)
    }
    if (frames % AGENTS_EVERY_FRAMES === 0) {
        await refreshAgents($, now)
    }
    if (frames % SYNC_EVERY_FRAMES === 0) {
        await syncShared($)
    }
    if (buddy === null || !isShown(now)) {
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
    sessionId = await $.session.id().catch(() => '')
    seats = await readSeats($)
    mainId = await readMain($)
    const found = await readPets($)
    const migrated = found.length > 0 ? found : await migrate($)
    const pets = migrated.length > 0 ? migrated : await $.clock.sleep(150).catch(() => undefined).then(() => readPets($))
    isArrivalPending = true
    const id = wantedId()
    const chosen = pets.find(one => one.hatchedAt === id) ?? pets[pets.length - 1]
    if (chosen !== undefined) {
        buddy = wake(chosen, now)
        nest = pets.filter(one => one !== chosen)
        if (mainId === null) {
            mainId = chosen.hatchedAt
            await $.store.set(MAIN_KEY, mainId)
        }
        if (seats[sessionId] !== chosen.hatchedAt) {
            await seatAt($, chosen.hatchedAt)
        }

        return
    }
    buddy = hatch(random, now)
    isNewborn = true
    nest = []
    mainId = buddy.hatchedAt
    await $.store.set(petKey(buddy.hatchedAt), buddy)
    await $.store.set(MAIN_KEY, mainId)
    await seatAt($, buddy.hatchedAt)
}

const swapTo = async ($: EngineInterface, now: number, next: Buddy, isNew: boolean): Promise<void> => {
    const previous = buddy === null ? null : rest(buddy, now)
    leave = previous === null ? null : { species: previous.species, at: now }
    nest = [...nest.filter(one => one.hatchedAt !== next.hatchedAt), ...(previous === null ? [] : [previous])]
    buddy = next
    snacks = []
    joy = null
    buddyVersion += 1
    hatchAt = leave === null ? now : now + LEAVE_MS
    isNewborn = isNew
    bubble = null
    mainId = next.hatchedAt
    if (previous !== null) {
        await $.store.set(petKey(previous.hatchedAt), previous)
    }
    await $.store.set(petKey(next.hatchedAt), next)
    await $.store.set(MAIN_KEY, mainId)
    await seatAt($, next.hatchedAt)
}

const bringBack = async ($: EngineInterface, now: number, hatchedAt: number): Promise<void> => {
    const chosen = nest.find(one => one.hatchedAt === hatchedAt)
    if (chosen !== undefined) {
        await swapTo($, now, wake(chosen, now), false)
        arrivalLine = `${chosen.name} is back!`
    }
}

const rehatch = async ($: EngineInterface, now: number, species?: SpeciesId): Promise<boolean> => {
    if (nest.length + 1 >= NEST_MAX) {
        return false
    }
    await swapTo($, now, hatch(random, now, species), true)
    claimOwned($, now)

    return true
}

const TEST_RUNNERS = /(^|[\s;&/])(gradlew\s+(\S+\s+)*(?<!-x\s)(\w*[tT]est|check)|mvn\s+(\S+\s+)*(test|verify)|(npm|pnpm|yarn|bun)\s+(run\s+)?test|go\s+test|cargo\s+test|pytest|jest|vitest|dotnet\s+test|rspec|phpunit)\b/

export const isTestRun = (command: string): boolean => !command.includes('|') && TEST_RUNNERS.test(command)

const help = (): string => [
    'Your buddy lives on clicks:',
    '  click             pet it',
    '  double click      its own move',
    '  drag              carry it',
    '  click empty spot  throw a ball',
    '  right click       menu: card, feed, buddies, trophies, share, theme, facts, hide',
    '',
    'It eats what your work drops: a cookie for an answer, a fish for green tests, a cake for a commit.',
    'Snacks give xp and levels. Every buddy you hatch stays in your nest, each window keeps its own.',
    'Rare moments earn trophies, six of them secret.',
    'While Claude works on a long answer, it tells a fact about space, Earth, code, math or philosophy.',
    '',
    'Commands:',
    '  /buddy               its full card with stats and personality',
    '  /buddy trophies      open the trophy case',
    '  /buddy share         copy a card of your buddy to show it off',
    '  /buddy name <name>   rename it',
    '  /buddy feed          a berry',
    '  /buddy fact          a fact right now',
    '  /buddy facts on|off  facts while Claude works',
    '  /buddy on            bring it back after hide',
    '  /buddy hatch [cat, duck, ghost, octopus, axolotl, robot, ninja, penguin]',
    '  /buddy theme [auto, winter, halloween, off] · /buddy off',
].join('\n')

const speciesList = (): string => SPECIES.map(one => one.id).join(', ')

const perform = async ($: EngineInterface, now: number, arg: string, rest: readonly string[]): Promise<string> => {
    if (buddy === null) {
        await loadBuddy($, now)
    }
    const current = buddy as Buddy
    if (arg === '' || arg === 'card') {
        const others = nest.map(one => `${one.name} the ${speciesOf(one.species).name}, lv${levelOf(one.xp ?? 0).level}`).join(' · ')
        const nestLine = nest.length === 0 ? 'your nest: just this one so far' : `also in your nest: ${others}`

        return `${cardOf(current, now, feelingOf(now))}\n\n${nestLine}\nMenu: right click on the strip\n/buddy name <new name> · /buddy feed · /buddy on · /buddy help`
    }
    if (arg === 'feed') {
        return feedByHand(now)
    }
    if (arg === 'trophies') {
        caseAt = now
        cardAt = null
        $.ui.invalidate('ui.render')

        return `${countOf(found)} of ${TROPHIES.length} trophies, the case is open above the prompt. Don't see it? Click "▸ plugin panel hidden" there`
    }
    if (arg === 'share') {
        const text = shareOf(current, found)
        const { isCopied } = await $.ui.copy({ text })

        return `${isCopied ? 'Copied, paste it in any chat' : 'Copy it from here'}:\n\n${text}`
    }
    if (arg === 'pet') {
        pet(now)

        return `${current.name} is happy`
    }
    if (arg === 'theme') {
        const wanted = rest[0]?.toLowerCase()
        theme = isTheme(wanted) ? wanted : THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'auto'
        await $.store.set(THEME_KEY, theme)
        $.ui.invalidate('ui.render')

        return {
            auto: 'Theme follows the calendar',
            winter: 'Santa hat on, snow is falling',
            halloween: 'Boo! Witch hat on',
            off: 'No theme',
        }[theme]
    }
    if (arg === 'fact') {
        return `Did you know? ${tellFact($, now).join(' ')}`
    }
    if (arg === 'facts') {
        const wanted = rest[0]?.toLowerCase()
        isFactsOn = wanted === 'on' || (wanted !== 'off' && !isFactsOn)
        await saveFacts($)
        $.ui.invalidate('ui.render')

        return isFactsOn ? `${current.name} tells a fact now and then while Claude works on a long answer` : `No more facts. /buddy facts on brings them back`
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
        return (await rehatch($, now, wanted?.id)) ? `Hatching… ${current.name} waits in your nest` : `Your nest is full: ${NEST_MAX} buddies`
    }
    if (arg === 'name' && rest.length > 0) {
        buddy = { ...current, name: rest.join(' ').slice(0, 14) }
        buddyVersion += 1
        await $.store.set(petKey(buddy.hatchedAt), buddy)
        sayText(`I'm ${buddy.name} now`, now)

        return `Renamed to ${buddy.name}`
    }
    if (arg === 'off' || arg === 'on') {
        leave = arg === 'off' && !isOff ? { species: current.species, at: now } : null
        hatchAt = arg === 'on' && isOff ? now : hatchAt
        isOff = arg === 'off'
        $.ui.invalidate('ui.render')
        if (isOff) {
            $.ui.toast(`${current.name} is hiding in this window. /buddy on brings it back`)
        }

        return isOff ? `${current.name} is hiding. /buddy on brings it back` : `${current.name} is back`
    }
    if (arg === 'debug') {
        return [
            `frames ${frames}, last frame ${Math.round(now - lastFrameAt)} ms ago`,
            `drawing: ${isClientMode ? 'client' : 'not drawn yet'}`,
            `clicks heard: ${messages}${lastMessage === '' ? '' : `, last: ${lastMessage}`}`,
            `menu: ${lastMenuKey || 'never pressed'}`,
            `card: ${cardAt === null ? 'closed' : `open ${Math.round((now - cardAt) / 1000)} s, ${cardDrawnAt >= cardAt ? 'drawn above the prompt' : isCardInChat ? 'sent to the chat' : 'not drawn yet'}`}`,
            `above the prompt drawn ${aboveDraws} times, frames ${timer === null ? 'stopped' : 'running'}`,
            `problems: ${lastDeny || 'none'}`,
        ].join('\n')
    }

    return help()
}

const pressMenu = async ($: EngineInterface, now: number, key: string): Promise<void> => {
    lastMenuKey = `${key} ${new Date(now).toLocaleTimeString()}`
    if (key === 'back' && menuPage === 'species') {
        menuPage = 'nest'
    } else if (key === 'open' || key === 'back') {
        menuPage = 'main'
    } else if (key === 'card') {
        menuPage = null
        openCard($, now)
    } else if (key === 'card-close') {
        menuPage = null
        cardAt = null
    } else if (key === 'trophies') {
        menuPage = null
        openCase($, now)
    } else if (key === 'trophies-close') {
        menuPage = null
        caseAt = null
    } else if (key === 'feed') {
        menuPage = null
        feedByHand(now)
    } else if (key === 'share' && buddy !== null) {
        menuPage = null
        const { isCopied } = await $.ui.copy({ text: shareOf(buddy, found) })
        sayText(isCopied ? 'show me off!' : 'try /buddy share', now)
        $.ui.toast(isCopied ? `A card of ${buddy.name} is on your clipboard: paste it in any chat to show it off` : 'Could not copy here, /buddy share prints the card')
    } else if (key === 'nest') {
        menuPage = 'nest'
        nest = (await readPets($)).filter(one => one.hatchedAt !== buddy?.hatchedAt)
    } else if (key.startsWith('pick:')) {
        menuPage = null
        await bringBack($, now, Number(key.slice('pick:'.length)))
    } else if (key === 'full') {
        sayText(`my nest is full: ${NEST_MAX} buddies`, now)
    } else if (key === 'new') {
        menuPage = 'species'
    } else if (key.startsWith('hatch:')) {
        menuPage = null
        const species = key.slice('hatch:'.length)
        await perform($, now, 'hatch', species === 'random' ? [] : [species])
    } else if (key === 'theme') {
        await perform($, now, 'theme', [])
        sayText(`theme: ${theme}`, now)
    } else if (key === 'facts') {
        menuPage = null
        await perform($, now, 'facts', [])
        if (isFactsOn) {
            tellFact($, now)
        } else {
            sayText('ok, no more facts', now)
        }
    } else if (key === 'hide') {
        menuPage = null
        await perform($, now, 'off', [])
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
    const band = bandPropsOf(now)
    const props = band === null ? null : { ...band, isDesktop: e.surface !== 'terminal' }
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
        found = foundOf(await $.store.get(TROPHY_KEY))
        applyFacts(await $.store.get(FACTS_KEY).catch(() => undefined))
        claimOwned($, now)
        startedAt = now
        await dropLegacyKeys($)
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

    on('prompt.edit', ($, e, next) => {
        void $.clock.now().then(now => {
            typingAt = now
        })

        return next(e)
    })

    on('prompt.submit', async ($, e, next) => {
        const now = await $.clock.now()
        ensureTimer($, now)
        markActive(now)
        if (cardAt !== null || caseAt !== null) {
            cardAt = null
            caseAt = null
            $.ui.invalidate('ui.render')
        }
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
            markActive(now)
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
            markActive(now)
            if (e.reason === 'answer') {
                dropSnack('cookie', now)
                answers += 1
                if (answers === DEEP_THOUGHT) {
                    award($, 'deep-thought', now)
                }
            }
            if (isMarathon) {
                setMood('happy', now)
                say('marathon', now, true)
            } else if (MOOD_MS[mood] === undefined) {
                setMood('idle', now)
            }
        }

        return next(e)
    })

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
        markActive(now)
        if (ran.isError === true) {
            errorStreak += 1
            if (errorStreak >= LOOP_ERRORS) {
                errorStreak = 0
                dizzyAt = now
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
            dropSnack('cake', now)
            cheer('a commit', now)
            commitTrophiesAt(new Date(now)).forEach(id => award($, id, now))
        } else if (e.tool === 'Bash' && isTestRun(e.command)) {
            say('green', now)
            celebrate(now)
            dropSnack('fish', now)
            cheer('green tests', now)
            if (now - dizzyAt < COMEBACK_MS) {
                award($, 'comeback', now)
            }
        }
        if (e.tool === 'TodoWrite') {
            const isDone = e.todos.length > 0 && e.todos.every(todo => todo.status === 'completed')
            if (isDone && !todoDone) {
                setMood('happy', now)
                say('plan', now, true)
                celebrate(now)
                dropSnack('cake', now)
                cheer('a finished plan', now)
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
        if (kind === 'pet') {
            pet(now)
            cherish($, 8, now)
            if (buddy?.species === 'duck' && now - dizzyAt < DUCK_MS) {
                award($, 'rubber-duck', now)
            }
        }
        if (kind === 'jump') {
            startJump(now)
            cherish($, 2, now)
        }
        if (kind === 'menu') {
            await pressMenu($, now, String((e.data as { key?: unknown } | null)?.key ?? 'close'))
        }
        if (kind === 'error') {
            lastDeny = `client error: ${String((e.data as { message?: unknown } | null)?.message ?? '')}`
        }
        if (kind === 'ate') {
            const data = e.data as { at?: unknown; isHanded?: unknown } | null
            const eaten = snacks.find(one => one.at === data?.at)
            if (eaten !== undefined) {
                snacks = snacks.filter(one => one !== eaten)
                grow($, now, eaten.kind)
                if (data?.isHanded === true) {
                    hearts = [now, now + 250, now + 500]
                    cherish($, 6, now)
                }
            }
        }
        if (kind === 'caught') {
            const toy = (e.data as { kind?: string } | null)?.kind
            if (toy === 'shuriken') {
                action = { kind: 'swing', at: now - SWING_MS * 0.4 }
                sayText('hai!', now)
            } else {
                setMood('happy', now)
                sayText('got it!', now)
                catches = [...catches.filter(at => now - at < BALL_WINDOW_MS), now]
                if (catches.length >= BALLS) {
                    award($, 'ball', now)
                }
            }
            cherish($, 5, now)
        }
        const props = bandPropsOf(now)

        return props === null ? {} : { props }
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
        aboveDraws += 1
        const isInFooter = e.surface === 'terminal' && (footerAt === 0 ? now - startedAt < FOOTER_WAIT_MS : isFooterFit)
        const card = isShown(now) && !e.props.hasSurvey ? drawCard($, e, now, e.props.bodyColumns) ?? drawCase($, e, now, e.props.bodyColumns) : null
        const { Box } = $.ui.resolve(e)
        const theirs = card === null ? await next(e) : <Box key="buddy-above" flexDirection="column">{card}{await next(e)}</Box>
        if (!isShown(now) || e.props.hasSurvey || isInFooter) {
            return theirs
        }

        return drawBand($, e, theirs, e.props.bodyColumns, false)
    })
}

import type { EngineInterface, Register, RenderElement, ResolveInput, Timer } from 'claude-code'

import type { BandProps } from './band-client'

import { FULL, REPO, SNACKS, VIBE_MARKS, affectionOf, bar, cardOf, fullnessOf, growthLineOf, growthOf, hatch, headerOf, introOf, levelOf, meter, peakOf, rarityOf, rarityWordOf, vibeLabelOf, vibeOf } from './buddy'
import type { Buddy, Mood as Feeling, SnackKind } from './buddy'
import { FACTS, factOf, sayingMsOf } from './facts'
import { isRu, plural, setLanguage, t } from './i18n'
import type { Fact } from './facts'
import { lineFor } from './lines'
import type { Moment } from './lines'
import { BUBBLE_MS, HEART_MS, LEAVE_MS, TROPHY_MS, arriveMsOf, JUMP_MS, MIN_COLS, FRUIT_MS, SLICE_MS, SWING_MS, TRICK_MS, WIDTH, rowsOf, PORTRAIT_COLS, PORTRAIT_ROWS, ROWS, CATCH_AFTER_MS, CHASE_CELLS_PER_MS, EAT_SHOW_MS, FOOD_FALL_MS, HAND_Y, SHURIKEN_MS, WANDER_JITTER_MS, WANDER_PAUSE_MS, ballYOf, encode, foodXOf, foodYOf, handXOf, maxXOf, paint, portraitOf, sameCells, walkPaceOf } from './scene'
import type { ActionKind, FoodView, Menu, MenuItem, Mood, Pose, Season, View } from './scene'
import { SPECIES, SPRITE_W, byGender, speciesOf } from './species'
import type { SpeciesId } from './species'
import { BALLS, BALL_WINDOW_MS, COMEBACK_MS, DEEP_THOUGHT, DUCK_MS, GROWN_LEVEL, HIVE, REGULAR_DAYS, TROPHIES, commitTrophiesAt, countOf, dayKeyOf, emojisOf, foundOf, nextTally, ownedTrophiesOf, tallyOf, textOf, toastOf, trophyOf } from './trophies'
import type { Found, TrophyId } from './trophies'
import { shareOf } from './share'
import { trophyCaseOf } from './badges'
import { cellsSvgOf, filmSvgOf } from './vscode'

const CLIENT_KEY = 'buddy-band'
const PANE_ID = 'pixel-buddy'
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
const CLIENT_SILENT_FRAMES = 15000 / FRAME_MS
const CLIENT_RESTARTS_MAX = 3
const CHATTER_GAP_MS = 20000
const SLEEP_AFTER_MS = 180000
const FOOTER_RESERVE = 96
const FOOTER_WAIT_MS = 1500
const MARATHON_MS = 90000
const LONG_THINK_MS = 60000
const FACT_AFTER_MS = 30000
const FACT_EVERY_MS = 2 * 60000
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
const NOMS_RU = ['ням!', 'вкусно!', 'хрум!', 'ммм!']

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
let clientKey = CLIENT_KEY
let clientRestarts = 0
let clientHeardFrame: number | null = null
let stageDrawnAt = 0
let lastStageKey = ''
let editorShot: { cols: number; cells: Uint32Array; film: readonly Uint32Array[]; svg: string; isAway: boolean; start: number } | null = null
let editorTimer: Timer | null = null
let wanderPlan: Plan | null = null
let anchorX = 4
let anchorFacingLeft = false
let isEditorAttached = false
const aboveSurfaces = new Set<string>()
let editorToy: { kind: 'ball' | 'shuriken'; at: number; fromX: number; x: number; y: number; targetX: number; catchAt: number } | null = null
let editorSpark: { at: number; x: number; y: number } | null = null
let filmCache: { key: string; frames: Map<number, Uint32Array> } = { key: '', frames: new Map() }
let cols = WIDTH
let jumpAt: number | null = null
let messages = 0
let theme: Theme = 'auto'
let menuPage: 'main' | 'nest' | 'species' | 'settings' | null = null
let nest: Buddy[] = []
let sessionId = ''
let seats: Record<string, number> = {}
let mainId: number | null = null
let arrivalLine: string | null = null
let snacks: Array<{ kind: SnackKind; at: number; isHanded?: boolean }> = []
let editorFood: { kind: SnackKind; at: number; x: number; landAt: number; isHanded: boolean; eatenAt: number | null } | null = null
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
    const page = menuPage
    if (page === null || buddy === null) {
        return null
    }
    if (page === 'species') {
        const items: MenuItem[] = SPECIES.map(one => ({ key: `hatch:${one.id}`, label: ownedOf(one.id) === undefined ? speciesOf(one.id).name : `${speciesOf(one.id).name} ✓`, isOn: false }))

        return { items: [...items, { key: 'hatch:random', label: t('random', 'случайный'), isOn: false }, { key: 'back', label: '←', isOn: false }], header: t('pick a new species, ✓ calls yours back', 'выбери вид, ✓ вернет твоего') }
    }
    if (page === 'nest') {
        const items: MenuItem[] = [buddy, ...nest].map(one => ({
            key: one === buddy ? 'close' : `pick:${one.hatchedAt}`,
            label: `${one.name} ${speciesOf(one.species).name} ${t('lv', 'ур')}${levelOf(one.xp ?? 0).level}${one.isShiny === true ? ' ✦' : ''}`,
            isOn: one === buddy,
        }))
        const isFull = nest.length + 1 >= NEST_MAX

        return {
            items: [...items, { key: isFull ? 'full' : 'new', label: isFull ? t('nest is full', 'гнездо полное') : t('+ new egg', '+ новое яйцо'), isOn: false }, { key: 'back', label: '←', isOn: false }],
            header: t(
                `your nest: ${nest.length + 1} ${nest.length === 0 ? 'buddy' : 'buddies'}. Pick one for this window`,
                `в гнезде ${nest.length + 1} ${plural(nest.length + 1, 'питомец', 'питомца', 'питомцев')}, выбери для окна`,
            ),
        }
    }
    if (page === 'settings') {
        return {
            items: [
                { key: 'language', label: t('Русский', 'English'), isOn: false },
                { key: 'theme', label: `${t('theme', 'тема')}: ${themeNameOf(theme)}`, isOn: theme !== 'auto' && theme !== 'off' },
                { key: 'facts', label: t('facts', 'факты'), isOn: isFactsOn },
                { key: 'hide', label: t('hide', 'спрятать'), isOn: false },
                { key: 'back', label: '←', isOn: false },
            ],
            header: t('settings', 'настройки'),
        }
    }
    const items: MenuItem[] = [
        cardAt === null ? { key: 'card', label: t('card', 'карточка'), isOn: false } : { key: 'card-close', label: t('hide card', 'скрыть карточку'), isOn: true },
        { key: 'nest', label: t('buddies', 'питомцы'), isOn: false },
        caseAt === null ? { key: 'trophies', label: t('trophies', 'трофеи'), isOn: false } : { key: 'trophies-close', label: t('hide trophies', 'скрыть трофеи'), isOn: true },
        { key: 'share', label: t('share', 'поделиться'), isOn: false },
        { key: 'settings', label: t('settings', 'настройки'), isOn: false },
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

const themeNameOf = (value: Theme): string => (isRu() ? { auto: 'авто', winter: 'зима', halloween: 'хэллоуин', off: 'выкл' }[value] : value)

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

const panelHint = (): string => t('Don\'t see it? Click the "▸ plugin panel hidden" line right above the prompt', 'Не видно? Нажми на строку "▸ plugin panel hidden" прямо над полем ввода')

const openCase = ($: EngineInterface, now: number): void => {
    caseAt = now
    cardAt = null
    sayText(t('my trophies are up there ↑', 'мои трофеи вон там ↑'), now)
    $.ui.toast(t(`Trophy case opened above the prompt. ${panelHint()}`, `Витрина трофеев открыта над полем ввода. ${panelHint()}`))
}

const openCard = ($: EngineInterface, now: number): void => {
    cardAt = now
    caseAt = null
    isCardInChat = false
    sayText(t('my card is up there ↑', 'моя карточка вон там ↑'), now)
    $.ui.toast(t(`Card opened above the prompt. ${panelHint()}`, `Карточка открыта над полем ввода. ${panelHint()}`))
}

const cardInChat = ($: EngineInterface, now: number): void => {
    if (buddy === null) {
        return
    }
    isCardInChat = true
    cardOf(buddy, now, feelingOf(now)).split('\n').slice(0, 7).filter(line => line !== '').forEach(line => $.ui.log(line))
    sayText(t('here is my card, in the chat', 'вот моя карточка, в чате'), now)
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
    const portrait = portraitOf(buddy.species, buddy.rarity, buddy.isShiny === true, seasonOf(now), now, growthOf(buddy, now))
    const picture = e.surface === 'terminal'
        ? $.ui.resolve(e).Raster({ key: 'card-portrait', columns: PORTRAIT_COLS, rows: PORTRAIT_ROWS, cells: encode(portrait) })
        : e.surface === 'vscode' ? $.ui.resolve(e).Svg({ source: cellsSvgOf(portrait, PORTRAIT_COLS, PORTRAIT_ROWS, 5), alt: buddy.name, width: PORTRAIT_COLS * 5, height: PORTRAIT_ROWS * 10 }) : null

    return (
        <Box key="buddy-card" flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} width={Math.min(width, 72)}>
            <Box flexDirection="row" columnGap={2}>
                {picture}
                <Box flexDirection="column">
                    <Text color={color} weight="bold">{buddy.name}{buddy.isShiny === true ? ' ✦' : ''}</Text>
                    <Text>{species.name} · {stars} {rarityWordOf(buddy.rarity, buddy.species)}</Text>
                    {growthLineOf(buddy, now) === '' ? null : <Text dimColor>{growthLineOf(buddy, now)}</Text>}
                    <Text>{VIBE_MARKS[feeling.vibe]} {vibeLabelOf(feeling.vibe)}: {feeling.why}</Text>
                    <Box flexDirection="row">
                        <Text>{t('level', 'уровень')} {level} </Text>
                        <Text color={color}>{meter(into, need)}</Text>
                        <Text> {into}/{need} xp</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Text>{t('belly ', 'сытость ')}</Text>
                        <Text color="#ffb35c">{bar(belly)}</Text>
                        <Text> {belly}%</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Text>{t('love  ', 'любовь  ')}</Text>
                        <Text color="#ff7aa8">{bar(love)}</Text>
                        <Text> {love}%</Text>
                    </Box>
                </Box>
            </Box>
            <Box flexDirection="row">
                <Text>{t('trophies', 'трофеи')} {countOf(found) === 0 ? '' : `${emojisOf(found)} `}</Text>
                <Text dimColor>{t(`${countOf(found)} of ${TROPHIES.length} · menu → trophies`, `${countOf(found)} из ${TROPHIES.length} · меню → трофеи`)}</Text>
            </Box>
            <Text dimColor>{t(`this window's buddy · ${nest.length + 1} in your nest · menu → hide card`, `питомец этого окна · в гнезде ${nest.length + 1} · меню → скрыть карточку`)}</Text>
            <Text dimColor>{t(`a ⭐ on ${REPO} helps others find it`, `⭐ на ${REPO} поможет другим найти мод`)}</Text>
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
                            return <Box key={one.id} width={CASE_CELL}><Text color={hexOf(rarityOf(one.rarity).color)}>{one.emoji} {textOf(one).label}</Text></Box>
                        }

                        return <Box key={one.id} width={CASE_CELL}><Text dimColor>{one.isSecret ? '?  ???' : `○  ${textOf(one).label}`}</Text></Box>
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
    const shown = e.surface === 'terminal' || e.surface === 'vscode' ? trophyCaseOf(found, room - 4) : null
    const latest = TROPHIES.filter(one => found[one.id] !== undefined).sort((a, b) => (found[b.id] ?? 0) - (found[a.id] ?? 0))[0]
    const badges = e.surface === 'terminal' && shown !== null
        ? $.ui.resolve(e).Raster({ key: 'trophy-badges', columns: shown.columns, rows: shown.rows, cells: encode(shown.cells) })
        : e.surface === 'vscode' && shown !== null
            ? $.ui.resolve(e).Svg({ source: cellsSvgOf(shown.cells, shown.columns, shown.rows, 5), alt: t(`${countOf(found)} of ${TROPHIES.length} trophies`, `${countOf(found)} из ${TROPHIES.length} трофеев`), width: shown.columns * 5, height: shown.rows * 10 })
            : badgeTextOf($, e, room)

    return (
        <Box key="trophy-case" flexDirection="column" borderStyle="round" borderColor={hexOf(CASE_GOLD)} paddingX={1} width={shown === null || e.surface === 'vscode' ? room : shown.columns + 4}>
            <Box flexDirection="row">
                <Text color={hexOf(CASE_GOLD)} weight="bold">{t('trophies ', 'трофеи ')}</Text>
                <Text>{t(`${countOf(found)} of ${TROPHIES.length}`, `${countOf(found)} из ${TROPHIES.length}`)}</Text>
                <Text dimColor>
                    {latest === undefined ? t(' · rare moments of your work earn them', ' · их дают редкие моменты твоей работы') : t(` · the latest: ${latest.name}`, ` · последний: ${textOf(latest).name}`)}
                    {t(' · menu → share shows them off', ' · меню → поделиться покажет их')}
                </Text>
            </Box>
            {badges}
        </Box>
    )
}

const EDITOR_PX = 8
const EDITOR_COLS = 40
const CARD_COLS = 72
const EDITOR_X = 4
const TYPING_LOOK_MS = 1500
const MENU_TEXT_COLOR = '#d6d3e0'
const MENU_ON_COLOR = '#ffd23b'
const MENU_EDGE_COLOR = '#6c6880'
const MENU_HEADER_COLOR = '#9a96ad'

const editorViewOf = (now: number, offset: number, cols: number, x0: number, pose: Partial<Pose>): View => {
    const current = buddy as Buddy
    const t = now + offset
    const shown = demoAt === null ? currentMood(now) : mood
    const typed = bubble === null ? 0 : [...bubble.text].length * 32 + 200

    return {
        t,
        cols,
        species: current.species,
        rarity: current.rarity,
        mood: shown,
        moodAge: t - moodAt,
        pose: { x: x0, isFacingLeft: false, isWalking: false, lookX: 0, lift: 0, ...pose },
        bubble: bubble === null ? null : { text: bubble.text, age: Math.min(BUBBLE_MS - 800, Math.max(now - bubble.at, typed)) },
        agents: demoAgents ?? agents,
        hatchAge: hatchAt === null ? null : t - hatchAt,
        leave: leave === null ? null : { species: leave.species, age: t - leave.at },
        hearts: hearts.map(at => t - at),
        rows: ROWS,
        jump: null,
        action: action === null ? null : { kind: action.kind, age: t - action.at },
        toy: toyViewOf(t, x0, pose.isFacingLeft === true),
        spark: sparkViewOf(t),
        food: foodViewAt(t),
        isShiny: current.isShiny === true,
        growth: growthOf(current, now),
        vibe: feelingOf(now).vibe,
        trophy: trophyShow === null ? null : { rarity: trophyOf(trophyShow.id).rarity, age: t - trophyShow.at },
        isDesktop: false,
        isEditor: true,
        season: seasonOf(now),
        menu: null,
        nap: shown === 'sleep' ? { x: x0, age: Math.max(0, now - lastSeenAt - SLEEP_AFTER_MS) + offset + 2000, wokeAge: null } : null,
        trail: [],
    }
}

const oneShotOf = (now: number): number => {
    const ends = [
        hatchAt === null || buddy === null ? 0 : hatchAt + arriveMsOf(buddy.species),
        leave === null ? 0 : leave.at + LEAVE_MS,
    ]

    return Math.max(0, ...ends.map(end => end - now))
}

type Leg = { from: number; to: number; ms: number }

type Plan = { kind: 'wander' | 'work' | 'chase' | 'eat'; startAt: number; maxX: number; legs: Leg[]; total: number; isFacingLeft: boolean }

const BALL_FAR = 6
const SPARK_KEEP_MS = 1500
const BALL_FLY_MS = 350
const EDITOR_FRESH_MS = 30000
const EDITOR_AHEAD_FRAMES = 12
const EDITOR_STEP_MS = 50
const EDITOR_TICK_MS = 100
const EDITOR_AWAY_MS = SLEEP_AFTER_MS + 15000
const EDITOR_REFILL_FRAMES = 4
const GLANCE_SLOT_MS = 6500
const GLANCE_MS = 1200
const HOP_MS = 200

const planKindOf = (now: number): Plan['kind'] | null => {
    const shown = demoAt === null ? currentMood(now) : mood
    if (editorToy !== null) {
        return editorToy.kind === 'ball' ? 'chase' : null
    }
    if (oneShotOf(now) > 0 || action !== null || jumpAt !== null) {
        return null
    }
    if (canEatAt(now, shown)) {
        return 'eat'
    }
    if (turnAt !== null && (shown === 'think' || shown === 'tool')) {
        return 'work'
    }

    return shown === 'idle' ? 'wander' : null
}

const rollerOf = (seed: number): (() => number) => {
    let state = Math.abs(Math.floor(seed)) % 233280

    return () => {
        state = (state * 9301 + 49297) % 233280

        return state / 233280
    }
}

const walkOf = (from: number, to: number, speed: number): Leg => ({ from, to, ms: Math.max(1, Math.round(Math.abs(to - from) / speed)) })

const planOf = (kind: Plan['kind'], x: number, maxX: number, now: number): Plan => {
    const speed = walkPaceOf(feelingOf(now).vibe)
    const from = Math.max(0, Math.min(maxX, x))
    const legs: Leg[] = []
    if (kind !== 'wander') {
        const to = Math.max(0, Math.min(maxX, kind === 'work' ? maxX : kind === 'chase' ? editorToy?.targetX ?? from : (editorFood?.x ?? from) + 1 - SPRITE_W / 2))
        const pace = kind === 'chase' || (kind === 'eat' && editorFood?.isHanded === true) ? CHASE_CELLS_PER_MS : speed
        legs.push(...(from === to ? [] : [walkOf(from, to, pace)]), { from: to, to, ms: 3600000 })
    } else {
        const roll = rollerOf(now)
        legs.push({ from, to: from, ms: 2000 + Math.round(roll() * 3000) })
        let at = from
        for (let i = 0; i < 6; i++) {
            const to = i === 5 ? from : Math.round(roll() * maxX)
            const walk = walkOf(at, to, speed)
            if (to !== at) {
                legs.push(walk)
            }
            legs.push({ from: to, to, ms: Math.max(1000, WANDER_PAUSE_MS + Math.round(roll() * WANDER_JITTER_MS) - (to === at ? 0 : walk.ms)) })
            at = to
        }
    }

    return { kind, startAt: now, maxX, legs, total: legs.reduce((sum, leg) => sum + leg.ms, 0), isFacingLeft: anchorFacingLeft }
}

const poseAt = (plan: Plan, now: number): { x: number; isWalking: boolean; isFacingLeft: boolean } => {
    let isFacingLeft = plan.isFacingLeft
    let left = Math.max(0, now - plan.startAt) % Math.max(1, plan.total)
    for (const leg of plan.legs) {
        if (leg.to !== leg.from) {
            isFacingLeft = leg.to < leg.from
        }
        if (left < leg.ms) {
            return { x: leg.from + (leg.to - leg.from) * (left / leg.ms), isWalking: leg.to !== leg.from, isFacingLeft }
        }
        left -= leg.ms
    }

    return { x: plan.legs[0]?.from ?? anchorX, isWalking: false, isFacingLeft }
}

const glanceAt = (t: number): { lookX: number; lift: number } => {
    const slot = Math.floor(t / GLANCE_SLOT_MS)
    const roll = rollerOf(slot * 7919 + (buddy?.hatchedAt ?? 0))
    const start = slot * GLANCE_SLOT_MS + Math.round(roll() * (GLANCE_SLOT_MS - GLANCE_MS))
    const lookX = Math.round(roll() * 2) - 1
    const isHop = roll() < (feelingOf(t).vibe === 'joyful' ? 0.6 : 0.25)
    if (t < start || t >= start + GLANCE_MS) {
        return { lookX: 0, lift: 0 }
    }

    return { lookX, lift: isHop && t < start + HOP_MS ? 1 : 0 }
}

const settlePlan = (now: number, cols: number): void => {
    const kind = planKindOf(now)
    const maxX = maxXOf(cols)
    if (wanderPlan !== null && wanderPlan.kind === kind && wanderPlan.maxX === maxX) {
        return
    }
    if (wanderPlan !== null) {
        const at = poseAt(wanderPlan, now)
        anchorX = Math.round(at.x)
        anchorFacingLeft = at.isFacingLeft
        wanderPlan = null
    }
    if (kind !== null) {
        wanderPlan = planOf(kind, anchorX, maxX, now)
    }
}

const editorFrameOf = (now: number, cols: number, offset = 0): Uint32Array => {
    settlePlan(now, cols)
    const isTyping = now + offset - typingAt < TYPING_LOOK_MS
    const glance = isTyping ? { lookX: -1, lift: 0 } : glanceAt(now + offset)
    if (wanderPlan === null) {
        return paint(editorViewOf(now, offset, cols, Math.max(0, Math.min(maxXOf(cols), anchorX)), { isFacingLeft: isTyping || anchorFacingLeft, ...glance }))
    }
    const at = poseAt(wanderPlan, now + offset)

    return paint(editorViewOf(now, offset, cols, Math.round(at.x), { isWalking: at.isWalking, isFacingLeft: at.isFacingLeft, ...glance }))
}

const sceneKeyOf = (now: number, cols: number): string => JSON.stringify([
    cols,
    buddy?.species ?? '',
    buddy?.rarity ?? '',
    buddy?.isShiny === true,
    demoAt === null ? currentMood(now) : mood,
    moodAt,
    bubble?.text ?? '',
    hearts,
    action,
    snacks.map(snack => snack.at),
    editorFood === null ? null : [editorFood.at, editorFood.x, editorFood.eatenAt],
    typingAt,
    trophyShow?.at ?? 0,
    hatchAt ?? 0,
    leave?.at ?? 0,
    demoAgents ?? agents,
    feelingOf(now).vibe,
    seasonOf(now),
    wanderPlan?.kind ?? '',
    wanderPlan?.startAt ?? 0,
    anchorX,
    anchorFacingLeft,
    editorToy?.at ?? 0,
    editorSpark?.at ?? 0,
])

const gridOf = (now: number): number => Math.floor(now / EDITOR_STEP_MS) * EDITOR_STEP_MS

const editorFrameAt = (now: number, cols: number, at: number): Uint32Array => {
    settlePlan(now, cols)
    const key = sceneKeyOf(now, cols)
    if (filmCache.key !== key) {
        filmCache = { key, frames: new Map() }
    }
    const cached = filmCache.frames.get(at)
    if (cached !== undefined) {
        return cached
    }
    const cells = editorFrameOf(now, cols, at - now)
    filmCache.frames.forEach((_, time) => {
        if (time < now - EDITOR_STEP_MS * 2) {
            filmCache.frames.delete(time)
        }
    })
    filmCache.frames.set(at, cells)

    return cells
}

const editorPictureOf = (now: number, cols: number): string => {
    serveFood(now, cols)
    const start = gridOf(now)
    if (isAwayFromEditor(now)) {
        if (editorShot?.isAway !== true || editorShot.cols !== cols) {
            const still = editorFrameAt(now, cols, start)
            editorShot = { cols, cells: still, film: [still], svg: cellsSvgOf(still, cols, ROWS, EDITOR_PX), isAway: true, start }
        }

        return editorShot.svg
    }
    if (editorShot !== null && editorShot.cols === cols && !isEditorFrameStale(now)) {
        return editorShot.svg
    }
    const film = Array.from({ length: EDITOR_AHEAD_FRAMES }, (_, i) => editorFrameAt(now, cols, start + i * EDITOR_STEP_MS))
    const [cells = new Uint32Array(0)] = film
    editorShot = { cols, cells, film, svg: filmSvgOf(film, EDITOR_STEP_MS, cols, ROWS, EDITOR_PX), isAway: false, start }

    return editorShot.svg
}

const isEditorFrameStale = (now: number): boolean => {
    if (editorShot === null || buddy === null || !isShown(now)) {
        return false
    }
    const index = (gridOf(now) - editorShot.start) / EDITOR_STEP_MS
    const planned = editorShot.film[index]
    if (editorShot.isAway || planned === undefined || index >= editorShot.film.length - EDITOR_REFILL_FRAMES) {
        return true
    }
    const cells = editorFrameAt(now, editorShot.cols, gridOf(now))

    return cells !== planned && !sameCells(cells, planned)
}

const isAwayFromEditor = (now: number): boolean => turnAt === null && now - Math.max(lastSeenAt, typingAt) > EDITOR_AWAY_MS

const watchEditorFrames = ($: EngineInterface, now: number): void => {
    if (now - stageDrawnAt >= EDITOR_FRESH_MS) {
        editorTimer?.cancel()
        editorTimer = null

        return
    }
    editorTimer ??= $.clock.every(EDITOR_TICK_MS, () => void $.clock.now().then(at => {
        if (at - stageDrawnAt >= EDITOR_FRESH_MS) {
            editorTimer?.cancel()
            editorTimer = null

            return
        }
        settleFood($, at)
        settleToy($, at)
        if (isAwayFromEditor(at) ? editorShot?.isAway === false : isEditorFrameStale(at)) {
            $.ui.invalidate('ui.render')
        }
    }).catch((error: unknown) => {
        lastDeny = `editor frame failed: ${String(error)}`
    }))
}

const editorKeyOf = (now: number): string => JSON.stringify([
    planKindOf(now),
    demoAt === null ? currentMood(now) : mood,
    bubble?.text ?? '',
    hearts.length > 0,
    action?.kind ?? '',
    snacks[0]?.at ?? 0,
    trophyShow?.id ?? '',
    hatchAt !== null,
    leave !== null,
    demoAgents ?? agents,
    seasonOf(now),
    isOff,
    menuPage,
    cardAt !== null,
    caseAt !== null,
    buddy === null ? '' : headerOf(buddy, now, feelingOf(now)),
    editorToy?.at ?? 0,
    isRu(),
])

const ate = ($: EngineInterface, at: unknown, isHanded: boolean, now: number): void => {
    const eaten = snacks.find(one => one.at === at)
    if (eaten === undefined) {
        return
    }
    snacks = snacks.filter(one => one !== eaten)
    grow($, now, eaten.kind)
    if (isHanded) {
        hearts = [now, now + 250, now + 500]
        cherish($, 6, now)
    }
}

const petByHand = ($: EngineInterface, now: number): void => {
    pet(now)
    cherish($, 8, now)
    if (buddy?.species === 'duck' && now - dizzyAt < DUCK_MS) {
        award($, 'rubber-duck', now)
    }
}

const caught = ($: EngineInterface, kind: 'ball' | 'shuriken', now: number): void => {
    if (kind === 'shuriken') {
        action = { kind: 'swing', at: now - SWING_MS * 0.4 }
        sayText(t('hai!', 'кия!'), now)
    } else {
        setMood('happy', now)
        sayText(t('got it!', buddy === null ? 'поймал!' : byGender(buddy.species, 'поймал!', 'поймала!')), now)
    }
    catches = [...catches.filter(at => now - at < BALL_WINDOW_MS), now]
    if (catches.length >= BALLS) {
        award($, 'ball', now)
    }
    cherish($, 5, now)
}

const petXAt = (now: number): number => (wanderPlan === null ? anchorX : poseAt(wanderPlan, now).x)

const canEatAt = (now: number, shown: Mood): boolean =>
    editorFood !== null && editorFood.eatenAt === null && now >= editorFood.landAt && shown !== 'sleep' && editorToy === null
    && (turnAt === null || editorFood.kind === 'berry' || editorFood.isHanded)

const serveFood = (now: number, cols: number): void => {
    const snack = snacks[0]
    if (editorFood !== null || snack === undefined) {
        return
    }
    const x = foodXOf(petXAt(now), cols, rollerOf(snack.at)())
    editorFood = { kind: snack.kind, at: snack.at, x, landAt: snack.at + FOOD_FALL_MS, isHanded: snack.isHanded === true, eatenAt: null }
}

const eatAtOf = (): number | null => {
    if (editorFood?.eatenAt !== null && editorFood?.eatenAt !== undefined) {
        return editorFood.eatenAt
    }
    const [walk] = wanderPlan?.kind === 'eat' ? wanderPlan.legs : []

    return walk === undefined || wanderPlan === null ? null : wanderPlan.startAt + (walk.to === walk.from ? 0 : walk.ms)
}

const settleFood = ($: EngineInterface, now: number): void => {
    if (isClientMode || stageDrawnAt === 0) {
        return
    }
    serveFood(now, editorShot?.cols ?? EDITOR_COLS)
    if (editorFood === null) {
        return
    }
    if (editorFood.eatenAt !== null) {
        if (now - editorFood.eatenAt > EAT_SHOW_MS) {
            editorFood = null
        }

        return
    }
    const eatAt = eatAtOf()
    if (eatAt === null || now < eatAt) {
        return
    }
    editorFood = { ...editorFood, eatenAt: eatAt }
    ate($, editorFood.at, editorFood.isHanded, now)
}

const foodViewAt = (t: number): FoodView | null => {
    if (editorFood === null) {
        return null
    }
    const eatenAt = eatAtOf()
    if (eatenAt !== null && t - eatenAt > EAT_SHOW_MS) {
        return null
    }

    return {
        kind: editorFood.kind,
        x: editorFood.x,
        y: foodYOf(editorFood.landAt, t),
        eatenAge: eatenAt !== null && t >= eatenAt ? t - eatenAt : null,
    }
}

const throwToy = (now: number): void => {
    if (buddy === null || editorToy !== null) {
        return
    }
    const cols = editorShot?.cols ?? EDITOR_COLS
    const maxX = maxXOf(cols)
    const petX = petXAt(now)
    if (buddy.species === 'ninja') {
        editorToy = { kind: 'shuriken', at: now, fromX: cols - 1, x: cols - 1, y: 1, targetX: petX, catchAt: now + SHURIKEN_MS }

        return
    }
    const center = petX + SPRITE_W / 2
    const far = maxX + SPRITE_W - 3
    const isToLeft = center > (maxX + SPRITE_W) / 2
    const lo = isToLeft ? 1 : Math.min(far, Math.round(center + BALL_FAR))
    const hi = isToLeft ? Math.max(1, Math.round(center - BALL_FAR)) : far
    const x = lo + Math.round(rollerOf(now)() * (hi - lo))
    const targetX = Math.max(0, Math.min(maxX, x + 1 - SPRITE_W / 2))
    const runMs = Math.abs(targetX - petX) / CHASE_CELLS_PER_MS
    editorToy = { kind: 'ball', at: now, fromX: isToLeft ? 0 : cols - 2, x, y: 2, targetX, catchAt: now + Math.max(BALL_FLY_MS + CATCH_AFTER_MS, Math.round(runMs) + 60) }
}

const catchAtOf = (toy: NonNullable<typeof editorToy>): number => {
    const [run] = toy.kind === 'ball' && wanderPlan?.kind === 'chase' ? wanderPlan.legs : []
    if (run === undefined || wanderPlan === null) {
        return toy.catchAt
    }

    return Math.max(toy.at + BALL_FLY_MS + CATCH_AFTER_MS, wanderPlan.startAt + (run.to === run.from ? 0 : run.ms) + 60)
}

const ballAt = (toy: NonNullable<typeof editorToy>, t: number): { x: number; y: number } => {
    const age = t - toy.at
    if (age >= BALL_FLY_MS) {
        return { x: toy.x, y: ballYOf(age - BALL_FLY_MS) }
    }
    const p = age / BALL_FLY_MS

    return { x: Math.round(toy.fromX + (toy.x - toy.fromX) * p), y: Math.round(toy.y - (toy.y + 1) * p) }
}

const settleToy = ($: EngineInterface, now: number): void => {
    if (editorToy === null || now < catchAtOf(editorToy)) {
        if (editorSpark !== null && now - editorSpark.at > SPARK_KEEP_MS) {
            editorSpark = null
        }

        return
    }
    const toy = editorToy
    const catchAt = catchAtOf(toy)
    editorSpark = toy.kind === 'ball' ? { at: catchAt, ...ballAt(toy, catchAt) } : null
    editorToy = null
    caught($, toy.kind, now)
}

const toyViewOf = (t: number, x0: number, isFacingLeft: boolean): View['toy'] => {
    if (editorToy === null || t >= catchAtOf(editorToy)) {
        return null
    }
    const age = t - editorToy.at
    if (editorToy.kind === 'ball') {
        return { kind: 'ball', ...ballAt(editorToy, t), age }
    }
    const handX = handXOf(x0, isFacingLeft)
    const p = Math.min(1, age / SHURIKEN_MS)

    return { kind: 'shuriken', x: Math.round(editorToy.x + (handX - editorToy.x) * p), y: Math.round(editorToy.y + (HAND_Y - editorToy.y) * p), age }
}

const sparkViewOf = (t: number): View['spark'] => {
    const catchAt = editorToy === null ? 0 : catchAtOf(editorToy)
    const spark = editorToy !== null && editorToy.kind === 'ball' && t >= catchAt ? { at: catchAt, ...ballAt(editorToy, catchAt) } : editorSpark

    return spark === null || t < spark.at ? null : { x: spark.x, y: spark.y, age: t - spark.at }
}

const pressEditor = ($: EngineInterface, key: string) => (): Promise<void> => $.clock.now().then(now => pressEditorAt($, key, now))

const pressEditorAt = async ($: EngineInterface, key: string, now: number): Promise<void> => {
    lastSeenAt = now
    if (key === 'pet') {
        petByHand($, now)
    } else if (key === 'feed') {
        feedByHand(now, true)
    } else if (key === 'ball') {
        throwToy(now)
    } else if (key === 'card' || key === 'trophies') {
        menuPage = null
        cardAt = key === 'card' ? now : null
        caseAt = key === 'trophies' ? now : null
        isCardInChat = false
    } else if (key === 'card-close' || key === 'trophies-close') {
        menuPage = null
        cardAt = null
        caseAt = null
    } else if (key === 'unhide') {
        await perform($, now, 'on', [])
    } else {
        await pressMenu($, now, key)
    }
    $.ui.invalidate('ui.render')
}

const drawEditor = ($: EngineInterface, e: ResolveInput, now: number, bodyColumns: number): RenderElement | null => {
    if (e.surface === 'terminal' || e.surface === 'mobile') {
        return null
    }
    isEditorAttached = isEditorAttached || e.surface === 'vscode'
    stageDrawnAt = now
    beginArrival(now)
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const current = buddy
    if (current === null) {
        return <Text dimColor>{t('Your buddy is hatching…', 'Питомец вылупляется…')}</Text>
    }
    if (isOff) {
        return (
            <Box key="buddy-stage" flexDirection="row" columnGap={1}>
                <Text dimColor>{t(`${current.name} is hiding`, `${current.name} ${byGender(current.species, 'спрятался', 'спряталась')}`)}</Text>
                <Button key="editor-unhide" plain onPress={pressEditor($, 'unhide')}>{t('[bring back]', '[вернуть]')}</Button>
            </Box>
        )
    }
    const cols = EDITOR_COLS
    const strip = editorPictureOf(now, cols)
    const menu = menuOf()
    const chip = (key: string, label: string, press: string) => <Button key={key} plain dimColor onPress={pressEditor($, press)}>{label}</Button>

    return (
        <Box key="buddy-stage" flexDirection="column" alignItems="flex-end">
            <Box flexDirection="row" flexWrap="nowrap" alignItems="flex-end" columnGap={1}>
                <Svg source={strip} alt={`${current.name}, ${speciesOf(current.species).name}, ${t('level', 'уровень')} ${levelOf(current.xp ?? 0).level}${bubble === null ? '' : `: ${bubble.text}`}`} width={cols * EDITOR_PX} height={ROWS * 2 * EDITOR_PX} />
                <Box flexDirection="column" rowGap={0.25}>
                    <Box flexDirection="row" flexWrap="nowrap" columnGap={1}>
                        {chip('editor-heart', '❤️', 'pet')}
                        {chip('editor-snack', '🍪', 'feed')}
                    </Box>
                    <Box flexDirection="row" flexWrap="nowrap" columnGap={1}>
                        {chip('editor-ball', current.species === 'ninja' ? '✦' : '⚾', 'ball')}
                        {chip('editor-menu', menu === null ? '⋯' : '×', menu === null ? 'open' : 'close')}
                    </Box>
                </Box>
            </Box>
            {menu === null ? null : (
                <Box flexDirection="column" alignItems="flex-end">
                    {menu.header === undefined ? null : <Text color={MENU_HEADER_COLOR}>{menu.header}</Text>}
                    <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" columnGap={1}>
                        {menu.items.filter(item => item.key !== 'close').map(item => (
                            <Button key={`editor-${item.key}`} plain onPress={pressEditor($, item.key)}>
                                <Text color={MENU_EDGE_COLOR}>[</Text>
                                <Text color={item.isOn ? MENU_ON_COLOR : MENU_TEXT_COLOR}>{item.label}</Text>
                                <Text color={MENU_EDGE_COLOR}>]</Text>
                            </Button>
                        ))}
                    </Box>
                </Box>
            )}
            {drawCard($, e, now, bodyColumns || CARD_COLS)}
            {drawCase($, e, now, bodyColumns || CARD_COLS)}
        </Box>
    )
}

const dropSnack = (kind: SnackKind, now: number, isHanded = false): void => {
    if (buddy === null || snacks.length >= SNACK_QUEUE) {
        return
    }
    snacks = [...snacks, { kind, at: now + snacks.length, isHanded }]
}

const feedByHand = (now: number, isHanded = false): string => {
    if (buddy === null) {
        return ''
    }
    if (fullnessOf(buddy, now) >= FULL) {
        sayText(t('so full… maybe later', 'живот полный… может, позже'), now)

        return t(`${buddy.name} is full`, `${buddy.name} больше не хочет есть`)
    }
    dropSnack('berry', now, isHanded)

    return t(`${buddy.name} got a berry`, `ягода для ${buddy.name}`)
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
        cheer(t(`a new level, ${after}`, `новый уровень, ${after}`), now)
        sayText(t(`level ${after}!`, `уровень ${after}!`), now)
        action = null
        celebrate(now)

        return
    }
    const noms = isRu() ? NOMS_RU : NOMS
    sayText(noms[Math.floor(random() * noms.length)] ?? 'nom!', now)
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
        growth: growthOf(buddy, now),
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
        snack: snacks[0] === undefined ? null : { kind: snacks[0].kind, at: snacks[0].at },
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
    sayText(t('wheee!', 'уиии!'), now)
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
    settleFood($, now)
    settleToy($, now)
    if (stageDrawnAt !== 0) {
        const key = editorKeyOf(now)
        if (key !== lastStageKey) {
            lastStageKey = key
            $.ui.invalidate('ui.render')
        }
        watchEditorFrames($, now)
    }
    if (buddy === null || !isShown(now)) {
        clientHeardFrame = null
        return
    }
    restartSilentClient($)
    celebrateGrowth($, now)
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

const isInEditor = async ($: EngineInterface): Promise<boolean> => {
    const surfaces = await $.session.surfaces().catch(() => [])

    return surfaces.length === 0 ? isEditorAttached : surfaces.every(one => one === 'vscode')
}

const openStage = async ($: EngineInterface): Promise<string | null> => {
    if (!(await isInEditor($))) {
        return t('the panel lives in VS Code and Cursor; here the buddy is at the bottom right', 'панель есть в VS Code и Cursor, здесь питомец живет справа внизу')
    }
    const opened = await $.ui.open({ id: PANE_ID, title: 'Pixel Buddy' }).catch((error: unknown) => ({ isPlaced: false as const, reason: String(error) }))

    return opened.isPlaced ? null : opened.reason
}

const celebrateGrowth = ($: EngineInterface, now: number): void => {
    if (buddy === null || hatchAt !== null) {
        return
    }
    const growth = growthOf(buddy, now)
    if (buddy.growth === growth) {
        return
    }
    const isGrownUp = buddy.growth !== undefined
    saveBuddy($, { ...buddy, growth })
    if (isGrownUp) {
        sayText(growth === 'adult'
            ? t('I am all grown up now!', byGender(buddy.species, 'я совсем взрослый!', 'я совсем взрослая!'))
            : t('look, I grew up a bit!', byGender(buddy.species, 'смотри, я подрос!', 'смотри, я подросла!')), now)
        hearts = [now, now + 250, now + 500]
    }
}

const restartSilentClient = ($: EngineInterface): void => {
    if (clientHeardFrame === null || clientRestarts >= CLIENT_RESTARTS_MAX || frames - clientHeardFrame <= CLIENT_SILENT_FRAMES) {
        return
    }
    clientRestarts += 1
    clientKey = `${CLIENT_KEY}-${clientRestarts}`
    clientHeardFrame = null
    $.ui.invalidate('ui.render')
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
        arrivalLine = t(`${chosen.name} is back!`, `${chosen.name} ${byGender(chosen.species, 'вернулся', 'вернулась')}!`)
    }
}

const ownedOf = (species: SpeciesId): Buddy | undefined => [...(buddy === null ? [] : [buddy]), ...nest].find(one => one.species === species)

const rehatch = async ($: EngineInterface, now: number, species?: SpeciesId): Promise<'hatched' | 'full' | 'every' | Buddy> => {
    const owned = species === undefined ? undefined : ownedOf(species)
    if (owned !== undefined) {
        return owned
    }
    const fresh = SPECIES.filter(one => ownedOf(one.id) === undefined)
    if (fresh.length === 0) {
        return 'every'
    }
    if (nest.length + 1 >= NEST_MAX) {
        return 'full'
    }
    await swapTo($, now, hatch(random, now, species ?? fresh[Math.floor(random() * fresh.length)]?.id), true)
    claimOwned($, now)

    return 'hatched'
}

const TEST_RUNNERS = /(^|[\s;&/])(gradlew\s+(\S+\s+)*(?<!-x\s)(\w*[tT]est|check)|mvn\s+(\S+\s+)*(test|verify)|(npm|pnpm|yarn|bun)\s+(run\s+)?test|go\s+test|cargo\s+test|pytest|jest|vitest|dotnet\s+test|rspec|phpunit)\b/

export const isTestRun = (command: string): boolean => !command.includes('|') && TEST_RUNNERS.test(command)

const HELP_RU = [
    'Питомец живет на кликах:',
    '  клик               погладить',
    '  двойной клик       его трюк',
    '  перетаскивание     перенести',
    '  клик по пустому    бросить мяч',
    '  правый клик        меню: карточка, питомцы, трофеи, поделиться и настройки (язык, тема, факты, спрятать)',
    'В VS Code и Cursor то же самое кнопками рядом с ним: ❤️ погладить, 🍪 ягода, ⚾ мяч, ⋯ меню.',
    '',
    'Он ест то, что остается от работы: печенье за ответ, рыбу за зеленые тесты, торт за коммит.',
    'Новый питомец вылупляется крошкой и растет три недели. Еда дает опыт и уровни. Каждый вылупившийся питомец остается в гнезде, по одному каждого вида, у каждого окна свой.',
    'За редкие моменты дают трофеи, шесть из них секретные.',
    'Пока Claude готовит длинный ответ, питомец рассказывает факт про космос, Землю, код, математику или философию.',
    '',
    'Команды:',
    '  /buddy               полная карточка со статами и характером',
    '  /buddy trophies      открыть витрину трофеев',
    '  /buddy share         скопировать карточку питомца, чтобы похвастаться',
    '  /buddy name <имя>    переименовать',
    '  /buddy feed          ягода',
    '  /buddy fact          факт прямо сейчас',
    '  /buddy facts on|off  факты, пока Claude работает',
    '  /buddy on            вернуть после hide',
    '  /buddy panel         панель питомца справа (VS Code и Cursor)',
    '  /buddy hatch [cat, duck, ghost, octopus, axolotl, robot, ninja, penguin]',
    '  /buddy theme [auto, winter, halloween, off] · /buddy off',
    '',
    'Язык: правый клик → настройки, или /config, строка pixel-buddy.',
]

const help = (): string => isRu() ? HELP_RU.join('\n') : [
    'Your buddy lives on clicks:',
    '  click             pet it',
    '  double click      its own move',
    '  drag              carry it',
    '  click empty spot  throw a ball',
    '  right click       menu: card, buddies, trophies, share and settings (language, theme, facts, hide)',
    'In VS Code and Cursor the same moves are buttons next to it: ❤️ pet, 🍪 a berry, ⚾ a ball, ⋯ the menu.',
    '',
    'It eats what your work drops: a cookie for an answer, a fish for green tests, a cake for a commit.',
    'A new buddy hatches tiny and grows up over three weeks. Snacks give xp and levels. Every buddy you hatch stays in your nest, one of each species, each window keeps its own.',
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
    '  /buddy panel         the buddy panel on the right (VS Code and Cursor)',
    '  /buddy hatch [cat, duck, ghost, octopus, axolotl, robot, ninja, penguin]',
    '  /buddy theme [auto, winter, halloween, off] · /buddy off',
    '',
    'Language, English or Русский: right click → settings, or /config, the pixel-buddy row.',
].join('\n')

const speciesList = (): string => SPECIES.map(one => one.id).join(', ')

const perform = async ($: EngineInterface, now: number, arg: string, rest: readonly string[]): Promise<string> => {
    if (buddy === null) {
        await loadBuddy($, now)
    }
    const current = buddy as Buddy
    if ((arg === '' || arg === 'card') && (await isInEditor($))) {
        return `${headerOf(current, now, feelingOf(now))}\n${t('⋯ next to the buddy opens the menu · /buddy help lists commands', '⋯ рядом с питомцем открывает меню · /buddy help покажет команды')}`
    }
    if (arg === '' || arg === 'card') {
        const others = nest.map(one => t(`${one.name} the ${speciesOf(one.species).name}, lv${levelOf(one.xp ?? 0).level}`, `${one.name}, ${speciesOf(one.species).name}, ур${levelOf(one.xp ?? 0).level}`)).join(' · ')
        const nestLine = nest.length === 0 ? t('your nest: just this one so far', 'в гнезде пока только этот питомец') : t(`also in your nest: ${others}`, `еще в гнезде: ${others}`)
        const menuLine = t('Menu: right click on the strip\n/buddy name <new name> · /buddy feed · /buddy on · /buddy help', 'Меню: правый клик по полоске\n/buddy name <имя> · /buddy feed · /buddy on · /buddy help')

        return `${cardOf(current, now, feelingOf(now))}\n\n${nestLine}\n${menuLine}`
    }
    if (arg === 'feed') {
        return feedByHand(now)
    }
    if (arg === 'panel') {
        const problem = await openStage($)

        return problem ?? t('In VS Code and Cursor the buddy panel opens on the right', 'В VS Code и Cursor панель питомца открывается справа')
    }
    if (arg === 'trophies') {
        caseAt = now
        cardAt = null
        $.ui.invalidate('ui.render')

        return t(
            `${countOf(found)} of ${TROPHIES.length} trophies, the case is open above the prompt. Don't see it? Click "▸ plugin panel hidden" there`,
            `${countOf(found)} из ${TROPHIES.length} трофеев, витрина открыта над полем ввода. Не видно? Нажми там "▸ plugin panel hidden"`,
        )
    }
    if (arg === 'share') {
        const text = shareOf(current, found)
        const { isCopied } = await $.ui.copy({ text })

        return `${isCopied ? t('Copied, paste it in any chat', 'Скопировано, вставь в любой чат') : t('Copy it from here', 'Скопируй отсюда')}:\n\n${text}`
    }
    if (arg === 'pet') {
        pet(now)

        return t(`${current.name} is happy`, `${current.name} ${byGender(current.species, 'доволен', 'довольна')}`)
    }
    if (arg === 'theme') {
        const wanted = rest[0]?.toLowerCase()
        theme = isTheme(wanted) ? wanted : THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'auto'
        await $.store.set(THEME_KEY, theme)
        $.ui.invalidate('ui.render')

        return {
            auto: t('Theme follows the calendar', 'Тема по календарю'),
            winter: t('Santa hat on, snow is falling', 'Шапка Санты надета, идет снег'),
            halloween: t('Boo! Witch hat on', 'Бу! Шляпа ведьмы надета'),
            off: t('No theme', 'Без темы'),
        }[theme]
    }
    if (arg === 'fact') {
        return `${t('Did you know?', 'А знаешь?')} ${tellFact($, now).join(' ')}`
    }
    if (arg === 'facts') {
        const wanted = rest[0]?.toLowerCase()
        isFactsOn = wanted === 'on' || (wanted !== 'off' && !isFactsOn)
        await saveFacts($)
        $.ui.invalidate('ui.render')

        return isFactsOn
            ? t(`${current.name} tells a fact now and then while Claude works on a long answer`, `${current.name} иногда рассказывает факт, пока Claude готовит длинный ответ`)
            : t('No more facts. /buddy facts on brings them back', 'Больше никаких фактов. /buddy facts on вернет их')
    }
    if (arg === 'jump') {
        return startJump(now) ? t('Jump!', 'Прыг!') : t('Not enough room to jump', 'Мало места для прыжка')
    }
    if (arg === 'demo') {
        demoAt = now
        demoStep = 0
        saidAt = 0

        return t('Showing every reaction, 25 seconds', 'Показываю все реакции, 25 секунд')
    }
    if (arg === 'hatch') {
        const wanted = speciesFor(rest[0])
        if (rest[0] !== undefined && wanted === undefined) {
            return t(`No such species. There are: ${speciesList()}`, `Такого вида нет. Есть: ${speciesList()}`)
        }
        const hatching = await rehatch($, now, wanted?.id)
        if (hatching === 'hatched') {
            return t(`Hatching… ${current.name} waits in your nest`, `Вылупляется… ${current.name} ждет в гнезде`)
        }
        if (hatching === 'full') {
            return t(`Your nest is full: ${NEST_MAX} buddies`, `Гнездо полное: ${NEST_MAX} ${plural(NEST_MAX, 'питомец', 'питомца', 'питомцев')}`)
        }
        if (hatching === 'every') {
            return t('You have one of every species already. Menu → buddies brings any of them back', 'У тебя уже есть питомец каждого вида. Меню → питомцы вернет любого')
        }
        if (hatching.hatchedAt === current.hatchedAt) {
            return t(
                `${current.name} is your ${speciesOf(current.species).name} already, one of each species`,
                `${current.name} уже ${byGender(current.species, 'твой', 'твоя')} ${speciesOf(current.species).name}, по одному каждого вида`,
            )
        }
        await bringBack($, now, hatching.hatchedAt)

        return t(
            `You have a ${speciesOf(hatching.species).name} already: ${hatching.name} comes back from the nest`,
            `У тебя уже есть ${speciesOf(hatching.species).name}: ${hatching.name} возвращается из гнезда`,
        )
    }
    if (arg === 'name' && rest.length > 0) {
        buddy = { ...current, name: rest.join(' ').slice(0, 14) }
        buddyVersion += 1
        await $.store.set(petKey(buddy.hatchedAt), buddy)
        sayText(t(`I'm ${buddy.name} now`, `теперь я ${buddy.name}`), now)

        return t(`Renamed to ${buddy.name}`, `Новое имя: ${buddy.name}`)
    }
    if (arg === 'off' || arg === 'on') {
        leave = arg === 'off' && !isOff ? { species: current.species, at: now } : null
        hatchAt = arg === 'on' && isOff ? now : hatchAt
        isOff = arg === 'off'
        $.ui.invalidate('ui.render')
        if (isOff) {
            $.ui.toast(t(`${current.name} is hiding in this window. /buddy on brings it back`, `${current.name} ${byGender(current.species, 'спрятался', 'спряталась')} в этом окне. /buddy on вернет`))
        }

        return isOff
            ? t(`${current.name} is hiding. /buddy on brings it back`, `${current.name} ${byGender(current.species, 'спрятался', 'спряталась')}. /buddy on вернет`)
            : t(`${current.name} is back`, `${current.name} ${byGender(current.species, 'вернулся', 'вернулась')}`)
    }
    if (arg === 'debug') {
        return [
            `frames ${frames}, last frame ${Math.round(now - lastFrameAt)} ms ago`,
            `drawing: ${isClientMode ? 'client' : 'not drawn yet'}${clientRestarts === 0 ? '' : `, restarted ${clientRestarts} times after it stopped answering${clientRestarts >= CLIENT_RESTARTS_MAX ? ', gave up' : ''}`}`,
            `clicks heard: ${messages}${lastMessage === '' ? '' : `, last: ${lastMessage}`}`,
            `menu: ${lastMenuKey || 'never pressed'}`,
            `card: ${cardAt === null ? 'closed' : `open ${Math.round((now - cardAt) / 1000)} s, ${cardDrawnAt >= cardAt ? 'drawn above the prompt' : isCardInChat ? 'sent to the chat' : 'not drawn yet'}`}`,
            `above the prompt drawn ${aboveDraws} times, frames ${timer === null ? 'stopped' : 'running'}`,
            `above the prompt asked on: ${[...aboveSurfaces].join(', ') || 'none'}`,
            `problems: ${lastDeny || 'none'}`,
        ].join('\n')
    }

    return help()
}

const switchLanguage = async ($: EngineInterface, now: number): Promise<void> => {
    const next = isRu() ? 'English' : 'Русский'
    setLanguage(next)
    sayText(t('hi! I speak English now', 'привет! теперь я говорю по-русски'), now)
    const rows = await $.config.list().catch(() => [])
    const row = rows.find(one => one.key.startsWith('pixel-buddy') && one.key.endsWith('.language'))
    const saved = row === undefined ? { deny: 'no row' } : await $.config.set({ key: row.key, value: next }).catch(() => ({ deny: 'failed' }))
    if (saved.deny !== undefined) {
        $.ui.toast(t('English in this window only: /config, the pixel-buddy row, keeps it', 'Русский только в этом окне: закрепить можно в /config, строка pixel-buddy'))
    }
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
    } else if (key === 'settings') {
        menuPage = 'settings'
    } else if (key === 'language') {
        menuPage = null
        await switchLanguage($, now)
    } else if (key === 'share' && buddy !== null) {
        menuPage = null
        const { isCopied } = await $.ui.copy({ text: shareOf(buddy, found) })
        sayText(isCopied ? t('show me off!', 'похвастайся мной!') : t('try /buddy share', 'попробуй /buddy share'), now)
        $.ui.toast(isCopied
            ? t(`A card of ${buddy.name} is on your clipboard: paste it in any chat to show it off`, `Карточка ${buddy.name} в буфере обмена: вставь в любой чат и похвастайся`)
            : t('Could not copy here, /buddy share prints the card', 'Здесь не скопировать, /buddy share выведет карточку'))
    } else if (key === 'nest') {
        menuPage = 'nest'
        nest = (await readPets($)).filter(one => one.hatchedAt !== buddy?.hatchedAt)
    } else if (key.startsWith('pick:')) {
        menuPage = null
        await bringBack($, now, Number(key.slice('pick:'.length)))
    } else if (key === 'full') {
        sayText(t(`my nest is full: ${NEST_MAX} buddies`, `гнездо полное: ${NEST_MAX} ${plural(NEST_MAX, 'питомец', 'питомца', 'питомцев')}`), now)
    } else if (key === 'new') {
        menuPage = 'species'
    } else if (key.startsWith('hatch:')) {
        menuPage = null
        const species = key.slice('hatch:'.length)
        await perform($, now, 'hatch', species === 'random' ? [] : [species])
    } else if (key === 'theme') {
        await perform($, now, 'theme', [])
        sayText(`${t('theme', 'тема')}: ${themeNameOf(theme)}`, now)
    } else if (key === 'facts') {
        menuPage = null
        await perform($, now, 'facts', [])
        if (isFactsOn) {
            tellFact($, now)
        } else {
            sayText(t('ok, no more facts', 'ладно, без фактов'), now)
        }
    } else if (key === 'hide') {
        menuPage = null
        await perform($, now, 'off', [])
    } else {
        menuPage = null
    }
    $.ui.invalidate('ui.render')
}

const beginArrival = (now: number): void => {
    if (isArrivalPending) {
        isArrivalPending = false
        hatchAt = now
    }
}

const drawBand = async ($: EngineInterface, e: ResolveInput & { requestId?: string }, theirs: RenderElement, width: number, isFooter: boolean): Promise<RenderElement> => {
    const now = await $.clock.now()
    beginArrival(now)
    cols = Math.min(WIDTH, width)
    const band = bandPropsOf(now)
    const props = band === null ? null : { ...band, isDesktop: e.surface !== 'terminal' }
    if (props === null || cols < MIN_COLS || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
        return theirs
    }
    isClientMode = true
    clientHeardFrame = clientHeardFrame ?? frames
    lastPropsKey = JSON.stringify(props)
    const { Box, Text } = $.ui.resolve(e)
    if (isFooter) {
        return (
            <Box flexDirection="row">
                {theirs}
                <Text> </Text>
                {h('Client', { key: clientKey, module: './band-client.tsx', props, width: cols, height: props.rows })}
            </Box>
        )
    }

    return (
        <Box flexDirection="column">
            {theirs}
            <Box flexDirection="row" justifyContent="flex-end">
                {h('Client', { key: clientKey, module: './band-client.tsx', props, width: cols, height: props.rows })}
            </Box>
        </Box>
    )
}

export const register: Register = (on, options) => {
    setLanguage(options.language)
    on('session.start', async ($, e, next) => {
        const now = await $.clock.now()
        theme = await readTheme($)
        lastSeenAt = now
        await $.command.register({ name: COMMAND, description: t('Your pixel buddy. Most things are clicks: right click it for the menu', 'Твой пиксельный питомец. Почти все через клики: правый клик открывает меню'), argumentHint: t('help · name <new name> · on', 'help · name <имя> · on') })
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
    }).catch(() => ({ text: t('pixel-buddy hit an error here, /buddy debug shows the last one', 'в pixel-buddy случилась ошибка, /buddy debug покажет последнюю') }))

    on('session.attach', async ($, e, next) => {
        isEditorAttached = isEditorAttached || e.surface === 'vscode'

        return next(e)
    })

    on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e, next) => {
        const now = await $.clock.now()

        return drawEditor($, e, now, e.props.bodyColumns) ?? next(e)
    })

    on('prompt.edit', ($, e, next) => {
        void $.clock.now().then(now => {
            typingAt = now
            if (editorShot?.isAway === true) {
                $.ui.invalidate('ui.render')
            }
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
            cheer(t('a commit', 'коммит'), now)
            commitTrophiesAt(new Date(now)).forEach(id => award($, id, now))
        } else if (e.tool === 'Bash' && isTestRun(e.command)) {
            say('green', now)
            celebrate(now)
            dropSnack('fish', now)
            cheer(t('green tests', 'зеленые тесты'), now)
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
                cheer(t('a finished plan', 'готовый план'), now)
            }
            todoDone = isDone
        }

        return ran
    }).catch(($, e, next) => next(e))

    on('ui.message', async ($, e, next) => {
        if (e.element !== clientKey) {
            return next(e)
        }
        clientHeardFrame = frames
        const kind = (e.data as { type?: string } | null)?.type
        if (kind === 'alive') {
            return {}
        }
        const now = await $.clock.now()
        messages += 1
        lastMessage = `${kind ?? 'unknown'} ${new Date(now).toLocaleTimeString()}`
        lastSeenAt = now
        if (kind === 'pet') {
            petByHand($, now)
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
            ate($, data?.at, data?.isHanded === true, now)
        }
        if (kind === 'caught') {
            caught($, (e.data as { kind?: string } | null)?.kind === 'shuriken' ? 'shuriken' : 'ball', now)
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
        aboveSurfaces.add(e.surface)
        if (e.surface === 'vscode') {
            const theirs = await next(e)
            const stage = drawEditor($, e, await $.clock.now(), e.props.bodyColumns)
            const { Box } = $.ui.resolve(e)

            return stage === null ? theirs : <Box key="buddy-above" flexDirection="column">{theirs}{stage}</Box>
        }
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

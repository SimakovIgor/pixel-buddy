import type { ClientElements, ClientModule, ClientPointerEvent, JsonValue } from 'claude-code'

import type { Rarity, SnackKind, Vibe } from './buddy'
import { DEFAULT, NAP_FADE_MS, ROWS, TRAIL_MS, maxXOf, menuLayoutOf, menuRowsOf, paint } from './scene'
import type { ActionKind, Menu, Mood, Pose, Season, View } from './scene'
import { SPRITE_W } from './species'
import type { SpeciesId } from './species'

export type BandProps = {
    cols: number
    rows: number
    species: SpeciesId
    rarity: Rarity
    mood: Mood
    moodAt: number
    isWorking: boolean
    typingAt: number
    bubble: { text: string; at: number } | null
    hearts: number[]
    agents: number
    hatchAt: number | null
    leave: { species: SpeciesId; at: number } | null
    jumpAt: number | null
    action: { kind: ActionKind; at: number } | null
    season: Season
    menu: Menu | null
    snack: { kind: SnackKind; at: number } | null
    isShiny: boolean
    vibe: Vibe
    trophy: { rarity: Rarity; at: number } | null
    isDesktop?: boolean
}

type Food = { kind: SnackKind; at: number; x: number; landAt: number; eatenAt: number | null; isHanded: boolean }

type Toy = { kind: 'ball' | 'shuriken'; at: number; x: number; y: number }

type Drag = { offset: number; startX: number; isMoved: boolean }

type BandState = {
    x: number
    target: number
    isFacingLeft: boolean
    nextWanderAt: number
    glanceX: number
    glanceUntil: number
    nextGlanceAt: number
    hopUntil: number
    lastAt: number
    pointer: { x: number; y: number } | null
    drag: Drag | null
    lastClickAt: number
    jump: { at: number; fromX: number; toX: number } | null
    toy: Toy | null
    spark: { at: number; x: number; y: number } | null
    nap: { x: number; at: number; wokeAt: number | null } | null
    trail: { x: number; at: number }[]
    food: Food | null
    lastEatenAt: number
}

const FRAME_MS = 50
const WALK_SPEED = 0.007
const CHASE_SPEED = 0.016
const FACE_DEADZONE = 3
const TYPING_MS = 1500
const DOUBLE_CLICK_MS = 350
const JUMP_SPAN = 14

let latest: BandProps | null = null
let live: BandState | null = null
let reported = ''

const report = (post: (data: JsonValue) => void, where: string, error: unknown): void => {
    const message = `${where}: ${error instanceof Error ? `${error.message} ${error.stack?.split('\n')[1]?.trim() ?? ''}` : String(error)}`
    if (message !== reported) {
        reported = message
        post({ type: 'error', message })
    }
}

const homeOf = (p: BandProps): number => maxXOf(p.cols)

const clampX = (x: number, p: BandProps): number => Math.max(0, Math.min(homeOf(p), x))

const initialOf = (p: BandProps, now: number): BandState => ({
    x: homeOf(p),
    target: homeOf(p),
    isFacingLeft: true,
    nextWanderAt: now + 4000,
    glanceX: 0,
    glanceUntil: 0,
    nextGlanceAt: now + 3000,
    hopUntil: 0,
    lastAt: now,
    pointer: null,
    drag: null,
    lastClickAt: 0,
    jump: null,
    toy: null,
    spark: null,
    nap: null,
    trail: [],
    food: null,
    lastEatenAt: 0,
})

const jumpOf = (s: BandState, p: BandProps): BandState['jump'] => {
    if (p.jumpAt === null) {
        return null
    }
    if (s.jump?.at === p.jumpAt) {
        return s.jump
    }
    const fromX = Math.round(s.x)
    const span = JUMP_SPAN + Math.round(Math.random() * 10)

    return { at: p.jumpAt, fromX, toX: clampX(fromX > p.cols / 2 ? fromX - span : fromX + span, p) }
}

const BALL_GROUND = 4
const SHURIKEN_MS = 450
const TOY_GIVE_UP_MS = 6000
const CATCH_AFTER_MS = 300

const ballYOf = (age: number): number => BALL_GROUND - Math.round(5 * Math.exp(-age / 420) * Math.abs(Math.cos(age / 120)))

const handOf = (s: BandState): { x: number; y: number } => ({ x: s.isFacingLeft ? Math.round(s.x) + 1 : Math.round(s.x) + SPRITE_W - 2, y: 3 })

const toyAt = (s: BandState, now: number): { x: number; y: number } | null => {
    if (s.toy === null) {
        return null
    }
    const age = now - s.toy.at
    if (s.toy.kind === 'ball') {
        return { x: s.toy.x, y: ballYOf(age) }
    }
    const hand = handOf(s)
    const p = Math.min(1, age / SHURIKEN_MS)

    return { x: Math.round(s.toy.x + (hand.x - s.toy.x) * p), y: Math.round(s.toy.y + (hand.y - s.toy.y) * p) }
}

const catchToy = (s: BandState, p: BandProps, now: number, post: (data: JsonValue) => void): BandState => {
    if (s.toy === null) {
        return s
    }
    const age = now - s.toy.at
    if (age > TOY_GIVE_UP_MS) {
        return { ...s, toy: null }
    }
    const reach = Math.abs(s.x + SPRITE_W / 2 - s.toy.x - 1)
    const isThere = Math.abs(s.x - clampX(s.toy.x + 1 - SPRITE_W / 2, p)) < 0.5
    const isCaught = s.toy.kind === 'ball' ? age > CATCH_AFTER_MS && (reach <= 1.5 || (isThere && reach <= SPRITE_W / 2 + 2)) : age >= SHURIKEN_MS
    if (!isCaught) {
        return s
    }
    const at = toyAt(s, now) ?? { x: s.toy.x, y: BALL_GROUND }
    post({ type: 'caught', kind: s.toy.kind })

    return { ...s, toy: null, spark: { at: now, x: at.x, y: at.y } }
}

const FOOD_FALL_MS = 450
const EAT_MS = 500
const FOOD_GROUND = 4

const foodOf = (s: BandState, p: BandProps, now: number): Food | null => {
    if (s.food !== null && s.food.eatenAt !== null) {
        return now - s.food.eatenAt > EAT_MS ? null : s.food
    }
    if (p.snack === null || p.snack.at === s.lastEatenAt) {
        return null
    }
    if (s.food !== null && s.food.at === p.snack.at) {
        return s.food
    }
    const center = s.x + SPRITE_W / 2
    const way = center > p.cols / 2 ? -1 : 1
    const x = Math.round(Math.max(1, Math.min(p.cols - 3, center + way * (8 + Math.random() * 8))))

    return { kind: p.snack.kind, at: p.snack.at, x, landAt: now + FOOD_FALL_MS, eatenAt: null, isHanded: false }
}

const plateOf = (food: Food, p: BandProps): number => clampX(food.x + 1 - SPRITE_W / 2, p)

const canEat = (s: BandState, p: BandProps, now: number): boolean =>
    s.food !== null && s.food.eatenAt === null && now >= s.food.landAt && p.mood !== 'sleep' && s.jump === null && s.drag === null
    && s.toy === null && (!p.isWorking || s.food.kind === 'berry' || s.food.isHanded)

const eatFood = (s: BandState, p: BandProps, now: number, post: (data: JsonValue) => void): BandState => {
    if (s.food === null || !canEat(s, p, now) || Math.abs(s.x - plateOf(s.food, p)) >= 0.5) {
        return s
    }
    post({ type: 'ate', at: s.food.at, kind: s.food.kind, isHanded: s.food.isHanded })

    return { ...s, food: { ...s.food, eatenAt: now }, lastEatenAt: s.food.at }
}

const isChasing = (s: BandState, p: BandProps): boolean =>
    s.pointer !== null && s.drag === null && (p.mood === 'idle' || p.mood === 'love')

const targetOf = (s: BandState, p: BandProps, now: number, x: number): { target: number; nextWanderAt: number } => {
    const isTyping = now - p.typingAt < TYPING_MS
    if (s.toy?.kind === 'ball') {
        return { target: clampX(s.toy.x + 1 - SPRITE_W / 2, p), nextWanderAt: now + 6000 }
    }
    if (s.toy?.kind === 'shuriken') {
        return { target: x, nextWanderAt: now + 6000 }
    }
    if (s.food !== null && canEat(s, p, now)) {
        return { target: plateOf(s.food, p), nextWanderAt: now + 6000 }
    }
    if (isChasing(s, p) && s.pointer !== null) {
        const isOnTop = isOnSprite({ ...s, x }, p, s.pointer)

        return { target: isOnTop ? x : clampX(s.pointer.x - SPRITE_W / 2, p), nextWanderAt: now + 6000 }
    }
    if (p.isWorking && (p.mood === 'think' || p.mood === 'tool')) {
        return { target: homeOf(p), nextWanderAt: s.nextWanderAt }
    }
    if (p.mood === 'sleep' && s.nap !== null) {
        return { target: clampX(s.nap.x, p), nextWanderAt: s.nextWanderAt }
    }
    if (p.mood !== 'idle') {
        return { target: x, nextWanderAt: s.nextWanderAt }
    }
    if (now > s.nextWanderAt && Math.abs(s.target - x) < 0.5 && !isTyping) {
        return { target: Math.round(Math.random() * homeOf(p)), nextWanderAt: now + 7000 + Math.random() * 9000 }
    }

    return { target: clampX(s.target, p), nextWanderAt: s.nextWanderAt }
}

const napOf = (s: BandState, p: BandProps, now: number, x: number): BandState['nap'] => {
    if (p.mood === 'sleep') {
        return s.nap !== null && s.nap.wokeAt === null ? s.nap : { x: Math.round(x), at: now, wokeAt: null }
    }
    if (s.nap === null || (s.nap.wokeAt !== null && now - s.nap.wokeAt > NAP_FADE_MS)) {
        return null
    }

    return s.nap.wokeAt === null ? { ...s.nap, wokeAt: now } : s.nap
}

const step = (s: BandState, p: BandProps, now: number): BandState => {
    const elapsed = Math.min(200, now - s.lastAt)
    const jump = jumpOf(s, p)
    const x = s.jump !== null && jump === null ? s.jump.toX : clampX(s.x, p)
    const nap = napOf(s, p, now, x)
    const trail = s.trail.length === 0 ? s.trail : s.trail.filter(point => now - point.at < TRAIL_MS)
    const food = foodOf(s, p, now)
    if (jump !== null || s.drag !== null) {
        return { ...s, x, jump, nap, trail, food, lastAt: now }
    }
    const { target, nextWanderAt } = targetOf({ ...s, nap, food }, p, now, x)
    const gap = target - x
    const isTyping = now - p.typingAt < TYPING_MS
    const glance = now > s.nextGlanceAt
        ? { glanceX: Math.round(Math.random() * 2) - 1, glanceUntil: now + 1200, nextGlanceAt: now + 4000 + Math.random() * 5000, hopUntil: Math.random() < (p.vibe === 'joyful' ? 0.6 : 0.25) ? now + 200 : 0 }
        : { glanceX: s.glanceX, glanceUntil: s.glanceUntil, nextGlanceAt: s.nextGlanceAt, hopUntil: s.hopUntil }

    const isHurrying = food !== null && food.isHanded && food.eatenAt === null
    const speed = isChasing(s, p) || s.toy !== null || isHurrying ? CHASE_SPEED : WALK_SPEED * (p.vibe === 'tired' ? 0.55 : p.vibe === 'hungry' ? 0.8 : 1)
    const isGoingToFood = food !== null && food.eatenAt === null && now >= food.landAt
    const watched = s.toy !== null ? s.toy.x : isGoingToFood ? food.x : s.pointer === null || s.drag !== null ? null : s.pointer.x
    const offset = watched === null ? 0 : watched - (x + SPRITE_W / 2)
    const facesPointer = Math.abs(offset) > FACE_DEADZONE ? offset < 0 : null

    return {
        ...s,
        ...glance,
        x: x + Math.sign(gap) * Math.min(Math.abs(gap), elapsed * speed),
        target,
        nextWanderAt,
        isFacingLeft: facesPointer ?? (isTyping ? true : Math.abs(gap) >= 0.5 ? gap < 0 : s.isFacingLeft),
        jump,
        nap,
        trail,
        food,
        lastAt: now,
    }
}

const isOnSprite = (s: BandState, p: BandProps, pointer: { x: number; y: number }): boolean =>
    pointer.x >= Math.round(s.x) && pointer.x < Math.round(s.x) + SPRITE_W && pointer.y >= p.rows - ROWS

const menuKeyAt = (p: BandProps, x: number, y: number): string | null => {
    if (p.menu === null || y >= menuRowsOf(p.menu, p.cols)) {
        return null
    }
    const spot = menuLayoutOf(p.menu, p.cols).find(one => one.row === y && x >= one.x && x < one.x + one.width)

    return spot?.key ?? null
}

const onPointer = (s: BandState, p: BandProps, e: ClientPointerEvent, post: (data: JsonValue) => void, now: number): BandState => {
    const pointer = { x: e.x, y: e.y }
    if (e.type === 'leave') {
        return { ...s, pointer: null }
    }
    if (e.button === 'right') {
        if (e.type === 'down') {
            post({ type: 'menu', key: p.menu === null ? 'open' : 'close' })
        }

        return { ...s, pointer }
    }
    if (e.type === 'down' && p.menu !== null) {
        const key = menuKeyAt(p, e.x, e.y)
        if (key !== null || e.y < menuRowsOf(p.menu, p.cols) || !isOnSprite(s, p, pointer)) {
            post({ type: 'menu', key: key ?? 'close' })

            return { ...s, pointer }
        }
    }
    if (e.type === 'move' && s.drag === null) {
        return { ...s, pointer }
    }
    if (e.type === 'down' && s.jump === null && isOnSprite(s, p, pointer)) {
        return { ...s, pointer, drag: { offset: e.x - s.x, startX: s.x, isMoved: false } }
    }
    const isOnFood = s.food !== null && s.food.eatenAt === null && Math.abs(e.x - s.food.x - 0.5) <= 1.5 && e.y >= p.rows - ROWS
    if (e.type === 'down' && s.food !== null && isOnFood) {
        return { ...s, pointer, food: { ...s.food, isHanded: true } }
    }
    if (e.type === 'down' && s.jump === null && s.toy === null && s.drag === null && e.y >= p.rows - ROWS) {
        const kind = p.species === 'ninja' ? 'shuriken' : 'ball'
        const y = (e.y - (p.rows - ROWS)) * 2

        const x = Math.max(1, Math.min(homeOf(p) + SPRITE_W - 3, e.x))

        return { ...s, pointer, toy: { kind, at: now, x, y }, isFacingLeft: x < s.x + SPRITE_W / 2 }
    }
    if (e.type === 'move' && s.drag !== null) {
        const x = clampX(e.x - s.drag.offset, p)
        const isMoved = s.drag.isMoved || Math.abs(x - s.drag.startX) >= 1
        const trail = Math.round(x) === Math.round(s.x) ? s.trail : [...s.trail.filter(point => now - point.at < TRAIL_MS), { x: s.x, at: now }].slice(-8)

        return { ...s, pointer, x, target: x, trail, isFacingLeft: x < s.x ? true : x > s.x ? false : s.isFacingLeft, drag: { ...s.drag, isMoved } }
    }
    if (e.type === 'up' && s.drag !== null) {
        if (!s.drag.isMoved) {
            post({ type: now - s.lastClickAt < DOUBLE_CLICK_MS ? 'jump' : 'pet' })
        }

        return { ...s, pointer, drag: null, lastClickAt: s.drag.isMoved ? s.lastClickAt : now, nextWanderAt: now + 8000 }
    }

    return { ...s, pointer }
}

const poseOf = (s: BandState, p: BandProps, now: number): Pose => {
    const isTyping = now - p.typingAt < TYPING_MS
    const offset = s.pointer === null ? null : s.pointer.x - (s.x + SPRITE_W / 2)
    const lookAtPointer = offset === null ? null : Math.abs(offset) <= 1 ? 0 : Math.sign(offset)

    return {
        x: s.x,
        isFacingLeft: s.isFacingLeft,
        isWalking: s.drag !== null || Math.abs(s.target - s.x) >= 0.5,
        lookX: lookAtPointer ?? (isTyping ? -1 : now < s.glanceUntil ? s.glanceX : 0),
        lift: s.drag === null && now < s.hopUntil ? 1 : 0,
    }
}

const moodOf = (s: BandState, p: BandProps): Mood => {
    const isPetting = s.drag === null && s.pointer !== null && isOnSprite(s, p, s.pointer)

    return isPetting && (p.mood === 'idle' || p.mood === 'sleep') ? 'love' : p.mood
}

const viewOf = (s: BandState, p: BandProps, now: number): View => ({
    t: now,
    cols: p.cols,
    species: p.species,
    rarity: p.rarity,
    mood: moodOf(s, p),
    moodAge: now - p.moodAt,
    pose: poseOf(s, p, now),
    bubble: p.bubble === null ? null : { text: p.bubble.text, age: now - p.bubble.at },
    agents: p.agents,
    hatchAge: p.hatchAt === null ? null : now - p.hatchAt,
    leave: p.leave === null ? null : { species: p.leave.species, age: now - p.leave.at },
    hearts: p.hearts.map(at => now - at),
    rows: p.rows,
    jump: s.jump === null ? null : { age: now - s.jump.at, fromX: s.jump.fromX, toX: s.jump.toX },
    action: p.action === null ? null : { kind: p.action.kind, age: now - p.action.at },
    toy: s.toy === null ? null : { kind: s.toy.kind, ...(toyAt(s, now) ?? { x: s.toy.x, y: 0 }), age: now - s.toy.at },
    spark: s.spark === null ? null : { x: s.spark.x, y: s.spark.y, age: now - s.spark.at },
    food: s.food === null ? null : {
        kind: s.food.kind,
        x: s.food.x,
        y: now >= s.food.landAt ? FOOD_GROUND : Math.round(FOOD_GROUND - ((s.food.landAt - now) / FOOD_FALL_MS) * 6),
        eatenAge: s.food.eatenAt === null ? null : now - s.food.eatenAt,
    },
    isShiny: p.isShiny,
    vibe: p.vibe,
    trophy: p.trophy === null ? null : { rarity: p.trophy.rarity, age: now - p.trophy.at },
    isDesktop: p.isDesktop,
    season: p.season,
    menu: p.menu,
    nap: s.nap === null ? null : { x: s.nap.x, age: now - s.nap.at, wokeAge: s.nap.wokeAt === null ? null : now - s.nap.wokeAt },
    trail: s.trail.map(point => ({ x: Math.round(point.x), age: now - point.at })),
})

const hex = (color: number | undefined): string | undefined =>
    color === undefined || color === DEFAULT ? undefined : `#${color.toString(16).padStart(6, '0')}`

type Span = { text: string; color: number; back: number }

const spansOf = (cells: Uint32Array, cols: number, row: number): Span[] => {
    const spans: Span[] = []
    for (let x = 0; x < cols; x++) {
        const at = (row * cols + x) * 3
        const char = String.fromCodePoint(cells[at] ?? 0x20)
        const color = cells[at + 1] ?? DEFAULT
        const back = cells[at + 2] ?? DEFAULT
        const last = spans[spans.length - 1]
        if (last !== undefined && last.color === color && last.back === back) {
            last.text += char
        } else {
            spans.push({ text: char, color, back })
        }
    }

    return spans
}

const draw = (elements: ClientElements, s: BandState, p: BandProps, now: number) => {
    const { Box, Text } = elements
    const cells = paint(viewOf(s, p, now))
    const rows = Array.from({ length: p.rows }, (_, row) => spansOf(cells, p.cols, row))

    return (
        <Box flexDirection="column" width={p.cols}>
            {rows.map(spans => (
                <Box flexDirection="row">
                    {spans.map(span => <Text mono color={hex(span.color)} backgroundColor={hex(span.back)}>{span.text}</Text>)}
                </Box>
            ))}
        </Box>
    )
}

const advance = (s: BandState, p: BandProps, now: number, post: (data: JsonValue) => void): BandState =>
    eatFood(catchToy(step(s, p, now), p, now, post), p, now, post)

let shownFrame = ''

const BuddyBand: ClientModule<BandProps, BandState> = (props, surface) => {
    latest = props
    const now = Date.now()
    if (surface.state === undefined || live === null) {
        live = initialOf(props, now)
        surface.setState(live)
        surface.every(FRAME_MS, () => {
            if (live === null || latest === null) {
                return
            }
            try {
                const now = Date.now()
                live = advance(live, latest, now, surface.post)
                const frame = paint(viewOf(live, latest, now)).join(',')
                if (frame !== shownFrame) {
                    shownFrame = frame
                    surface.setState(live)
                }
            } catch (error) {
                report(surface.post, 'tick', error)
            }
        })
        surface.onPointer(event => {
            if (live === null || latest === null) {
                return
            }
            try {
                live = onPointer(live, latest, event, surface.post, Date.now())
                surface.setState(live)
            } catch (error) {
                report(surface.post, 'pointer', error)
            }
        })
    }
    try {
        return draw(surface.elements, live, props, now)
    } catch (error) {
        report(surface.post, 'draw', error)

        return surface.elements.Text({ children: '' })
    }
}

export default BuddyBand

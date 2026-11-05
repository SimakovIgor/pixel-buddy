import { rarityOf } from './buddy'
import type { Rarity } from './buddy'
import { NAP_H, SPRITE_H, SPRITE_W, speciesOf } from './species'
import type { SpeciesId } from './species'

export const DEFAULT = 0x01000000
export const ROWS = 3
export const HATCH_MS = 3000
export const BUBBLE_MS = 7000
export const HEART_MS = 1600
export const PORTRAIT_COLS = SPRITE_W * 2
export const PORTRAIT_ROWS = ROWS * 2
export const WIDTH = 64
export const MIN_COLS = SPRITE_W + 24

const NONE = 0xffffffff
const UPPER = 0x2580
const LOWER = 0x2584
const BUBBLE_MAX = 38
const TYPE_MS = 32

export type Mood = 'idle' | 'think' | 'tool' | 'shock' | 'dizzy' | 'happy' | 'love' | 'sleep'

export type Pose = {
    x: number
    isFacingLeft: boolean
    isWalking: boolean
    lookX: number
    lift: number
}

export type View = {
    t: number
    cols: number
    species: SpeciesId
    rarity: Rarity
    mood: Mood
    moodAge: number
    pose: Pose
    bubble: { text: string; age: number } | null
    agents: number
    hatchAge: number | null
    hearts: readonly number[]
    rows: number
    jump: Jump | null
    note: Note | null
    action: Action | null
    toy: Toy | null
    spark: Spark | null
    season: Season
    neighbors: readonly Neighbor[]
    visitorsLabel: string
    menu: Menu | null
    nap: Nap | null
    trail: readonly TrailPoint[]
    leave: Leave | null
}

export type Leave = { species: SpeciesId; age: number }

export type TrailPoint = { x: number; age: number }

export const TRAIL_MS = 420

export type Nap = { x: number; age: number; wokeAge: number | null }

export const NAP_FADE_MS = 700
const BREATH_MS = 1400
const WAKE_HOP_MS = 240

export type MenuItem = { key: string; label: string; isOn: boolean }
export type Menu = { items: readonly MenuItem[] }
export type MenuSpot = { key: string; x: number; row: number; width: number }

export const menuLayoutOf = (menu: Menu, cols: number): MenuSpot[] => {
    const spots: MenuSpot[] = []
    let x = 1
    let row = 0
    for (const item of menu.items) {
        const width = [...item.label].length + 2
        if (x + width > cols - 1 && x > 1) {
            row += 1
            x = 1
        }
        spots.push({ key: item.key, x, row, width })
        x += width + 1
    }

    return spots
}

export const menuRowsOf = (menu: Menu | null, cols: number): number =>
    menu === null ? 0 : Math.max(0, ...menuLayoutOf(menu, cols).map(spot => spot.row)) + 1



export type NeighborStatus = 'working' | 'waiting' | 'permission' | 'idle'
export type Neighbor = { id: string; species: SpeciesId; rarity: Rarity; status: NeighborStatus; label: string }

const VISITORS_SHOWN = 4

const visitorsLabelFit = (count: number, label: string, cols: number): string => {
    const room = cols - SPRITE_W - 1 - TREE_BACK - 4 - Math.min(count, VISITORS_SHOWN) * 3
    const chars = [...label]
    if (room < 4) {
        return ''
    }

    return chars.length <= room ? label : `${chars.slice(0, room - 1).join('').trimEnd()}…`
}

export const visitorsWidthOf = (count: number, label: string, cols: number): number =>
    count === 0 ? 0 : 1 + Math.min(count, VISITORS_SHOWN) * 3 + 1 + [...visitorsLabelFit(count, label, cols)].length + 2

export const petMinXOf = (count: number, label: string, cols: number): number => (count === 0 ? 0 : visitorsWidthOf(count, label, cols) + TREE_BACK)

export type Season = 'winter' | 'halloween' | null
export type Toy = { kind: 'ball' | 'shuriken'; x: number; y: number; age: number }
export type Spark = { x: number; y: number; age: number }

export type Jump = { age: number; fromX: number; toX: number }
export type Note = { title: string; text: string; age: number }
export type ActionKind = 'swing' | 'slice' | 'fruit' | 'trick'
export type Action = { kind: ActionKind; age: number }

export const JUMP_MS = 1600
export const SWING_MS = 420
export const SLICE_MS = 1150
export const FRUIT_MS = 2500
export const TRICK_MS = 2600
const HOP_AT = 140
const POOF_AT = 420
const APPEAR_AT = 900
const LAND_AT = 1250
const SMOKE_MS = 520
const NOTE_TYPE_MS = 22
const NOTE_MAX_LINES = 8

const RAINBOW = [0xff3b4a, 0xff9a1f, 0xffe23b, 0x3ee06b, 0x3ba7ff, 0x9b5cff]
const EGG = 0xfff1d6
const EGG_SPOT = 0x8fd3c7
const CRACK = 0x3a2f2a
const BUBBLE_TEXT = 0xece8f5
const BUBBLE_EDGE = 0x6c6880
const WHITE = 0xffffff
const RED = 0xff4a5a
const SLEEP = 0x8fa8ff
const HEART = 0xff6b9a

const EGG_ART = ['..eeee..', '.eeseee.', 'eeeeeese', 'eseeeeee', 'eeeeseee', '.eeeeee.']

const cycle = <T>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length] as T

const scale = (color: number, k: number): number => {
    const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * k)))

    return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

const hash = (n: number): number => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453

    return x - Math.floor(x)
}

type Canvas = { width: number; rows: number; base: number; pixels: Uint32Array; glyphs: Uint32Array; colors: Uint32Array }

const canvasOf = (cols: number, rows: number, baseRows = 0): Canvas => ({
    width: cols,
    rows,
    base: baseRows,
    pixels: new Uint32Array(cols * rows * 2).fill(NONE),
    glyphs: new Uint32Array(cols * rows),
    colors: new Uint32Array(cols * rows),
})

const dot = (c: Canvas, x: number, y: number, color: number, size = 1): void => {
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            const px = Math.round(x) * size + dx
            const py = Math.round(y) * size + dy + c.base * 2
            if (px >= 0 && py >= 0 && px < c.width && py < c.rows * 2) {
                c.pixels[py * c.width + px] = color
            }
        }
    }
}

const clearGlyph = (c: Canvas, x: number, row: number): void => {
    const at = row + c.base
    const px = Math.round(x)
    if (px >= 0 && px < c.width && at >= 0 && at < c.rows) {
        c.glyphs[at * c.width + px] = 0
    }
}

const write = (c: Canvas, x: number, row: number, text: string, color: number | ((i: number) => number)): void => {
    const at = row + c.base;
    [...text].forEach((char, i) => {
        const px = Math.round(x) + i
        if (px >= 0 && px < c.width && at >= 0 && at < c.rows && char !== ' ') {
            c.glyphs[at * c.width + px] = char.codePointAt(0) ?? 0x20
            c.colors[at * c.width + px] = typeof color === 'number' ? color : color(i)
        }
    })
}

const SMOKE = 0xd9d6e4
const SMOKE_BY_SEASON = { winter: 0xeaf4ff, halloween: 0x9b6bd6 }

const smokeOf = (v: View): number => (v.season === null ? SMOKE : SMOKE_BY_SEASON[v.season])

const drawSmoke = (c: Canvas, cx: number, cy: number, age: number, color = SMOKE): void => {
    if (age < 0 || age > SMOKE_MS) {
        return
    }
    const fade = 1 - age / SMOKE_MS
    const r = 1 + age / 110
    for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2 + hash(k) * 0.6
        const d = r * (0.5 + 0.5 * hash(k + 3))
        dot(c, cx + Math.cos(angle) * d * 1.8, cy + Math.sin(angle) * d * 0.8, scale(color, 0.35 + 0.65 * fade))
    }
    if (age < 180) {
        for (let dx = -2; dx <= 2; dx++) {
            dot(c, cx + dx, cy, WHITE)
            dot(c, cx + dx * 0.5, cy - 1, scale(color, 0.9))
        }
    }
}

const jumpLift = (age: number): number => {
    if (age < HOP_AT) {
        return 1
    }
    if (age < POOF_AT) {
        return -Math.round(3 * Math.sin(((age - HOP_AT) / (POOF_AT - HOP_AT)) * (Math.PI / 2)))
    }
    if (age < LAND_AT) {
        return -Math.round(2 * (1 - (age - APPEAR_AT) / (LAND_AT - APPEAR_AT)))
    }

    return age < LAND_AT + 120 ? 1 : 0
}

const drawJump = (c: Canvas, v: View, jump: Jump): void => {
    const age = jump.age
    const isLeft = jump.toX < jump.fromX
    const sprite = (x: number) => {
        const flying = { ...v, mood: 'idle' as const, pose: { ...v.pose, isFacingLeft: isLeft, isWalking: age < POOF_AT, lift: jumpLift(age) } }
        drawSprite(c, flying, x)
        drawHat(c, flying, x)
    }
    if (age < POOF_AT) {
        sprite(jump.fromX)
    }
    if (age >= APPEAR_AT) {
        sprite(jump.toX)
    }
    drawSmoke(c, jump.fromX + SPRITE_W / 2, 2, age - POOF_AT, smokeOf(v))
    drawSmoke(c, jump.toX + SPRITE_W / 2, 2, age - APPEAR_AT, smokeOf(v))
    const dust = age - LAND_AT
    if (dust >= 0 && dust < 260) {
        const spread = 1 + Math.floor(dust / 70)
        write(c, jump.toX - spread, 2, '·', 0xb9b3a8)
        write(c, jump.toX + SPRITE_W - 1 + spread, 2, '·', 0xb9b3a8)
    }
}

const eyeColor = (v: View, body: number, shade: number, eye: number): number => {
    if (v.mood === 'sleep' || v.mood === 'happy' || v.mood === 'love') {
        return shade
    }
    if (v.mood === 'shock') {
        return WHITE
    }
    if (v.mood === 'dizzy') {
        return Math.floor(v.t / 120) % 2 === 0 ? eye : RED
    }

    return v.t % 3300 < 120 ? body : eye
}

const frameIndex = (v: View): number => {
    if (v.pose.isWalking) {
        return Math.floor(v.t / 140) % 2
    }
    const pace: Record<Mood, number> = { idle: 700, think: 260, tool: 160, shock: 90, dizzy: 110, happy: 140, love: 200, sleep: 100000 }

    return Math.floor(v.t / pace[v.mood]) % 2
}

const shakeOf = (v: View): number => {
    if ((v.mood === 'shock' && v.moodAge < 600) || v.mood === 'dizzy') {
        return Math.floor(v.t / 50) % 2 === 0 ? 1 : -1
    }

    return 0
}

const liftOf = (v: View): number => {
    if (v.nap !== null && v.nap.wokeAge !== null && v.nap.wokeAge < WAKE_HOP_MS) {
        return 1
    }
    const trick = trickAgeOf(v)
    if (trick !== null && trickLiftOf(v, trick) !== 0) {
        return trickLiftOf(v, trick)
    }
    if (v.mood === 'happy' || v.mood === 'love') {
        return Math.floor(v.t / 140) % 2 === 0 ? 1 : 0
    }

    return v.pose.lift
}

const drawSprite = (c: Canvas, v: View, x0: number, size = 1, light = 1): void => {
    const species = speciesOf(v.species)
    const frame = cycle(species.frames, frameIndex(v)).map(line => (v.pose.isFacingLeft ? [...line].reverse().join('') : line))
    const body = species.colors.b ?? WHITE
    const shade = species.colors.s ?? body
    const eye = eyeColor(v, body, shade, species.colors.e ?? 0)
    const x = x0 + shakeOf(v)
    const y = v.jump === null ? liftOf(v) : v.pose.lift
    const eyes: Array<[number, number]> = []
    frame.forEach((line, dy) => [...line].forEach((cell, dx) => {
        if (cell === '.') {
            return
        }
        if (cell === 'e') {
            eyes.push([dx, dy])
        }
        if (isSwordOut(v) && (cell === 'k' || cell === 'g' || cell === 'd')) {
            return
        }
        const isGleam = cell === 'k' && dy === Math.floor(v.t / 110) % 6
        dot(c, x + dx, y + dy, scale(cell === 'e' ? body : isGleam ? WHITE : species.colors[cell] ?? body, light), size)
    }))
    const isLooking = v.mood === 'idle' || v.mood === 'think'
    eyes.forEach(([dx, dy]) => {
        const lookX = isLooking ? v.pose.lookX : 0
        const target = frame[dy]?.[dx + lookX]
        const isInside = target !== undefined && target !== '.' && target !== 'e'
        dot(c, x + dx + (isInside ? lookX : 0), y + dy, scale(eye, light), size)
    })
}

const NAP_TOP = SPRITE_H - NAP_H
const TREE_BACK = 5

type Tree = { art: readonly (readonly string[])[]; colors: Record<string, number> }

const PALM: Tree = {
    art: [
        [
            '...gg.ggl....',
            '.gl..gccgg.l.',
            'g...t..g...g.',
            '...t.........',
            '..t..........',
            '.tt..........',
        ],
        [
            '..lgg.ggl....',
            'g.l..gccgg.gl',
            '....t..g.....',
            '...t.........',
            '..t..........',
            '.tt..........',
        ],
    ],
    colors: { g: 0x3fae4a, l: 0x7ad66a, t: 0xa0703f, c: 0x6b4a2a },
}

const SAKURA: Tree = {
    art: [
        [
            '...pPpp.pPpp.',
            '.pPpppPppPpp.',
            'p.p.t........',
            '....t........',
            '...t.........',
            '..tt.........',
        ],
    ],
    colors: { p: 0xffc8d4, P: 0xff9fb8, t: 0x7a5048 },
}

const PETAL = 0xffc4d2

const treeOf = (v: View): Tree => (v.species === 'ninja' ? SAKURA : PALM)

const isTreeLeftOf = (v: View, napX: number): boolean => napX - TREE_BACK >= visitorsWidthOf(v.neighbors.length, v.visitorsLabel, v.cols)

const treeAlphaOf = (nap: Nap): number =>
    nap.wokeAge === null ? Math.min(1, nap.age / NAP_FADE_MS) : Math.max(0, 1 - nap.wokeAge / NAP_FADE_MS)

export const isLying = (v: View): boolean => v.mood === 'sleep' && v.nap !== null && v.nap.wokeAge === null && v.jump === null && !v.pose.isWalking

const treeXOf = (v: View, nap: Nap, i: number): number =>
    isTreeLeftOf(v, nap.x) ? nap.x - TREE_BACK + i : nap.x + SPRITE_W - 1 + TREE_BACK - i

const drawTree = (c: Canvas, v: View): void => {
    if (v.nap === null) {
        return
    }
    const nap = v.nap
    const tree = treeOf(v)
    cycle(tree.art, Math.floor(v.t / 900)).forEach((line, dy) => [...line].forEach((cell, i) => {
        if (cell !== '.') {
            dot(c, treeXOf(v, nap, i), dy, scale(tree.colors[cell] ?? WHITE, treeAlphaOf(nap)))
        }
    }))
}

const drawPetals = (c: Canvas, v: View): void => {
    if (v.nap === null || treeOf(v) !== SAKURA) {
        return
    }
    for (let k = 0; k < 2; k++) {
        const life = (v.t + k * 1950) % 3900
        const p = life / 3900
        const i = 6 + k * 3 + Math.round(p * 3 + Math.sin(life / 260))
        dot(c, treeXOf(v, v.nap, i), 2 + p * 3.6, scale(PETAL, treeAlphaOf(v.nap) * (1 - p * 0.4)))
    }
}

const drawNap = (c: Canvas, v: View, x0: number): void => {
    const species = speciesOf(v.species)
    const isLeft = isTreeLeftOf(v, v.nap?.x ?? x0)
    const body = species.colors.b ?? WHITE
    const lid = species.colors.z ?? species.colors.s ?? body
    const isInhale = Math.floor(v.t / BREATH_MS) % 2 === 0
    species.nap.forEach((line, dy) => [...line].forEach((cell, dx) => {
        if (cell === '.' || (cell === '^' && !isInhale)) {
            return
        }
        const color = cell === 'e' ? lid : cell === '^' ? body : species.colors[cell] ?? body
        dot(c, isLeft ? x0 + dx : x0 + SPRITE_W - 1 - dx, NAP_TOP + dy, color)
    }))
    const hat = v.season === null ? null : HATS[v.season]
    hat?.art.forEach((line, dy) => [...line].slice(1, 7).forEach((cell, i) => {
        if (cell !== '.') {
            dot(c, isLeft ? x0 + 4 + i : x0 + SPRITE_W - 5 - i, NAP_TOP - 1 + dy, hat.colors[cell] ?? WHITE)
        }
    }))
    const drift = Math.floor(v.t / 700) % 3
    write(c, isLeft ? x0 + 8 + drift : x0 + 1 - drift, 0, drift === 2 ? 'Z' : 'z', SLEEP)
}

const ghostsOf = (v: View, x0: number): TrailPoint[] => {
    const seen = new Set([x0])
    const ghosts: TrailPoint[] = []
    for (const point of [...v.trail].sort((a, b) => a.age - b.age)) {
        if (point.age < TRAIL_MS && !seen.has(point.x) && ghosts.length < 3) {
            seen.add(point.x)
            ghosts.push(point)
        }
    }

    return ghosts
}

const drawTrail = (c: Canvas, v: View, x0: number): void => {
    const species = speciesOf(v.species)
    const body = species.colors.b ?? WHITE
    const isDark = Math.max((body >> 16) & 0xff, (body >> 8) & 0xff, body & 0xff) < 0x60
    const tint = isDark ? scale(body, 2.6) : body
    const frame = (species.frames[0] ?? []).map(line => (v.pose.isFacingLeft ? [...line].reverse().join('') : line))
    ghostsOf(v, x0).reverse().forEach(ghost => {
        const fade = (1 - ghost.age / TRAIL_MS) * 0.7
        frame.forEach((line, dy) => [...line].forEach((cell, dx) => {
            if (cell !== '.' && (dx + dy) % 2 === 0) {
                dot(c, ghost.x + dx, v.pose.lift + dy, scale(tint, fade))
            }
        }))
    })
}

const drawMood = (c: Canvas, v: View, x0: number): void => {
    const side = v.pose.isFacingLeft ? x0 + SPRITE_W : x0 - 1
    const step = v.pose.isFacingLeft ? 1 : -1
    if (v.mood === 'think') {
        const dots = '.'.repeat(1 + (Math.floor(v.t / 300) % 3))
        write(c, v.pose.isFacingLeft ? side : side - dots.length + 1, 0, dots, scale(0xc39bff, 0.9))
    }
    if (v.mood === 'tool') {
        write(c, side, 0, Math.floor(v.t / 200) % 2 === 0 ? '*' : '+', 0xffc233)
    }
    if (v.mood === 'shock') {
        write(c, side, 0, '!', Math.floor(v.t / 100) % 2 === 0 ? RED : 0xffe23b)
    }
    if (v.mood === 'dizzy') {
        write(c, side, 0, cycle(['@', '~'], Math.floor(v.t / 150)), 0xffe23b)
    }
    if (v.mood === 'sleep' && !isLying(v)) {
        const drift = Math.floor(v.t / 700) % 3
        write(c, side + step * drift, 2 - drift, drift === 2 ? 'Z' : 'z', SLEEP)
    }
    if (v.mood === 'happy') {
        for (let k = 0; k < 4; k++) {
            const beat = Math.floor(v.t / 160)
            write(c, side + step * Math.floor(hash(k + beat) * 3), Math.floor(hash(k * 7 + beat) * ROWS), k % 2 === 0 ? '*' : '+', cycle(RAINBOW, k + beat))
        }
    }
}

const trickAgeOf = (v: View): number | null => (v.action?.kind === 'trick' && v.action.age < TRICK_MS ? v.action.age : null)

const trickFadeOf = (age: number): number => Math.max(0, Math.min(1, age / 200, (TRICK_MS - age) / 300))

const trickLiftOf = (v: View, age: number): number => {
    if (v.species === 'duck') {
        return age % 1300 < 260 ? 1 : 0
    }
    if (v.species === 'cat') {
        return age > 1150 && age < 1450 ? 1 : 0
    }
    if (v.species === 'penguin') {
        return age < 2200 && Math.floor(age / 220) % 2 === 0 ? 1 : 0
    }

    return 0
}

const lightOf = (v: View): number => {
    const age = trickAgeOf(v)

    return age !== null && v.species === 'ghost' && age < 2000 ? 0.3 + 0.7 * Math.abs(Math.cos(age / 330)) : 1
}

type Side = { dir: number; ahead: (d: number) => number }
type Trick = (c: Canvas, v: View, x0: number, age: number, side: Side) => void

const JUGGLE = [0xff5a5a, 0xffd23b, 0x4aa8ff]
const BUBBLE = 0x9fe8ff
const MOTH = 0xffb03b
const MOTH_EDGE = 0xff7a1a
const MOTH_BODY = 0xc08a4a
const DROP = 0x7fd6ff
const LASER = 0xff3b4a
const RADAR = 0x4cff8a
const WISP = 0xc9c3ef

const juggle: Trick = (c, _v, x0, age) => {
    JUGGLE.forEach((color, k) => {
        const angle = (age / 900 + k / 3) * Math.PI * 2
        const x = x0 + 4 + Math.cos(angle) * 7
        const y = 2 - Math.sin(angle) * 2.2
        const tint = scale(color, trickFadeOf(age))
        dot(c, x, y, scale(WHITE, trickFadeOf(age) * 0.9))
        dot(c, x + 1, y, tint)
        dot(c, x, y + 1, tint)
        dot(c, x + 1, y + 1, scale(tint, 0.7))
    })
}

const blowBubbles: Trick = (c, _v, _x0, age, side) => {
    for (let k = 0; k < 5; k++) {
        const life = age - k * 380
        if (life < 0 || life > 1100) {
            continue
        }
        const p = life / 1100
        write(c, side.ahead(1 + Math.round(p * 4 + Math.sin(life / 150 + k))), 1 - Math.round(p), p > 0.85 ? '·' : p > 0.4 ? 'O' : 'o', scale(BUBBLE, 1 - p * 0.3))
    }
}

const sing: Trick = (c, _v, _x0, age, side) => {
    for (let k = 0; k < 4; k++) {
        const life = age - k * 500
        if (life < 0 || life > 1300) {
            continue
        }
        const p = life / 1300
        write(c, side.ahead(1 + Math.round(p * 5)), 2 - Math.min(2, Math.floor(p * 3)), k % 2 === 0 ? '♪' : '♫', scale(cycle(RAINBOW, k * 2 + 1), 1 - p * 0.4))
    }
}

const chaseMoth: Trick = (c, _v, _x0, age, side) => {
    const isFleeing = age >= 1250
    const q = isFleeing ? (age - 1250) / (TRICK_MS - 1250) : 0
    const x = isFleeing ? side.ahead(2 + q * 14) : side.ahead(16 - (age / 1250) * 14)
    const y = isFleeing ? 1 - q * 2 + Math.sin(age / 140) * 0.8 : 2 + Math.sin(age / 170) * 1.3
    const alpha = 1 - q
    const isOpen = Math.floor(age / 110) % 2 === 0
    dot(c, x, y, scale(MOTH_BODY, alpha))
    dot(c, x, y + 1, scale(MOTH_BODY, alpha))
    dot(c, x - 1, y, scale(MOTH, alpha))
    dot(c, x + 1, y, scale(MOTH, alpha))
    if (isOpen) {
        dot(c, x - 2, y, scale(MOTH, alpha))
        dot(c, x + 2, y, scale(MOTH, alpha))
        dot(c, x - 1, y + 1, scale(MOTH_EDGE, alpha))
        dot(c, x + 1, y + 1, scale(MOTH_EDGE, alpha))
    }
    if (age > 1100 && age < 1500) {
        write(c, side.ahead(1), 0, '!', 0xffe23b)
    }
}

const splash: Trick = (c, _v, x0, age) => {
    const landed = (age % 1300) - 260
    if (landed < 0 || landed > 700) {
        return
    }
    const p = landed / 700
    for (let k = 0; k < 6; k++) {
        const way = k % 2 === 0 ? -1 : 1
        const reach = 1 + Math.floor(k / 2) * 1.5
        dot(c, x0 + 4.5 + way * (5 + reach * p * 3), 5 - Math.sin(p * Math.PI) * (2 + (k % 3)), scale(DROP, 1 - p * 0.5))
    }
    write(c, x0 - 1 - Math.floor(p * 2), 2, '~', DROP)
    write(c, x0 + SPRITE_W + Math.floor(p * 2), 2, '~', DROP)
}

const boo: Trick = (c, v, x0, age) => {
    for (let k = 0; k < 4; k++) {
        const life = (age + k * 450) % 1800
        const p = life / 1800
        const x = k < 2 ? x0 - 1 - k : x0 + SPRITE_W + k - 2
        const glow = (1 - p) * trickFadeOf(age)
        if (glow > 0.35) {
            dot(c, x + Math.sin(life / 200), 5 - p * 6, scale(WISP, glow))
        }
    }
    if (age > 1900) {
        write(c, v.pose.isFacingLeft ? x0 - 5 : x0 + SPRITE_W + 1, 0, 'boo!', 0xd9d4f5)
    }
}

const scan: Trick = (c, v, _x0, age, side) => {
    if (age < 1700) {
        const end = 2 + Math.sin((age / 1700) * Math.PI) * 3
        for (let i = 0; i <= 9; i++) {
            dot(c, side.ahead(i), 2 + (end - 2) * (i / 9), i === 9 ? WHITE : scale(LASER, 0.6 + 0.4 * (i / 9)))
        }

        return
    }
    const q = (age - 1700) / (TRICK_MS - 1700)
    for (let k = 0; k < 3; k++) {
        const d = Math.floor(q * 6) - k * 2
        if (d >= 0) {
            write(c, side.ahead(d), 0, v.pose.isFacingLeft ? '(' : ')', scale(RADAR, 1 - k * 0.3))
        }
    }
}

const TRICKS: Partial<Record<SpeciesId, Trick>> = {
    octopus: juggle,
    axolotl: blowBubbles,
    penguin: sing,
    cat: chaseMoth,
    duck: splash,
    ghost: boo,
    robot: scan,
}

const drawTrick = (c: Canvas, v: View, x0: number): void => {
    const age = trickAgeOf(v)
    const trick = TRICKS[v.species]
    if (age === null || trick === undefined) {
        return
    }
    const dir = v.pose.isFacingLeft ? -1 : 1
    const front = v.pose.isFacingLeft ? x0 - 1 : x0 + SPRITE_W
    trick(c, v, x0, age, { dir, ahead: d => front + dir * d })
}

const BLADE = 0xe8eef5
const TRAIL = 0x9fd8ff
const BUG = 0x6abf4b
const BUG_HEAD = 0x2f5d1f
const BUG_ART = ['.hb.', 'lbbl']
const SWING_IN_SLICE = 450

const FRUIT_HITS = [520, 1020, 1520]
const HIT_IN_SWING = SWING_MS * 0.45

const swingAgeOf = (v: View): number | null => {
    if (v.action === null) {
        return null
    }
    if (v.action.kind === 'fruit') {
        const age = v.action.age
        const hit = FRUIT_HITS.find(at => age >= at - HIT_IN_SWING && age < at - HIT_IN_SWING + SWING_MS)

        return hit === undefined ? null : age - (hit - HIT_IN_SWING)
    }
    const age = v.action.kind === 'swing' ? v.action.age : v.action.age - SWING_IN_SLICE

    return age >= 0 && age < SWING_MS ? age : null
}

type Fruit = { art: readonly string[]; colors: Record<string, number>; juice: number }

const FRUITS: readonly Fruit[] = [
    { art: ['.l.', 'rrr', 'rrr'], colors: { l: 0x5fd17a, r: 0xe8343f }, juice: 0xff6b6b },
    { art: ['.l.', 'ooo', 'ooo'], colors: { l: 0x5fd17a, o: 0xff9a1f }, juice: 0xffc061 },
    { art: ['gggg', 'rrrr'], colors: { g: 0x3a9d4a, r: 0xff5a6e }, juice: 0xff8a9a },
]

const TANGERINES: readonly Fruit[] = [
    { art: ['.l.', 'ooo', 'ooo'], colors: { l: 0x3fbf5f, o: 0xff9a1f }, juice: 0xffc061 },
]

const PUMPKINS: readonly Fruit[] = [
    { art: ['.g.', 'oko', 'oko'], colors: { g: 0x3fbf5f, o: 0xff7a1a, k: 0xc4561a }, juice: 0xffb36b },
]

const drawFruitPiece = (c: Canvas, fruit: Fruit, x: number, y: number, part: 'whole' | 'left' | 'right', alpha: number): void => {
    const mid = Math.ceil((fruit.art[0]?.length ?? 2) / 2)
    fruit.art.forEach((line, dy) => [...line].forEach((cell, dx) => {
        const isKept = part === 'whole' || (part === 'left' ? dx < mid : dx >= mid)
        if (cell !== '.' && isKept) {
            dot(c, x + dx, y + dy, scale(fruit.colors[cell] ?? WHITE, alpha))
        }
    }))
}

const drawFruits = (c: Canvas, v: View, x0: number): void => {
    if (v.action === null || v.action.kind !== 'fruit' || v.species !== 'ninja') {
        return
    }
    const age = v.action.age
    const dir = v.pose.isFacingLeft ? -1 : 1
    const hitX = v.pose.isFacingLeft ? x0 - 5 : x0 + SPRITE_W + 1
    FRUIT_HITS.forEach((hit, k) => {
        const basket = v.season === 'halloween' ? PUMPKINS : v.season === 'winter' ? TANGERINES : FRUITS
        const fruit = basket[k % basket.length] as Fruit
        const launch = hit - 480
        if (age < launch) {
            return
        }
        if (age < hit) {
            const p = (age - launch) / (hit - launch)
            drawFruitPiece(c, fruit, hitX + dir * (14 - k * 2) * (1 - p), 6 - 6 * Math.sin(p * Math.PI * 0.5), 'whole', 1)

            return
        }
        const after = age - hit
        const alpha = Math.max(0, 1 - after / 800)
        if (alpha <= 0) {
            return
        }
        const fall = (after / 160) ** 2
        drawFruitPiece(c, fruit, hitX - 1 - after / 110, fall, 'left', alpha)
        drawFruitPiece(c, fruit, hitX + 1 + after / 110, fall - 0.5, 'right', alpha)
        for (let d = 0; d < 4; d++) {
            dot(c, hitX + 1 + (hash(k * 9 + d) - 0.5) * after / 35, 1 + hash(k * 7 + d) * 2 + fall * 0.6, scale(fruit.juice, alpha))
        }
    })
}

const isSwordOut = (v: View): boolean => v.species === 'ninja' && swingAgeOf(v) !== null

const drawSwing = (c: Canvas, v: View, x0: number): void => {
    const age = swingAgeOf(v)
    if (age === null || v.species !== 'ninja') {
        return
    }
    const dir = v.pose.isFacingLeft ? -1 : 1
    const hand = { x: v.pose.isFacingLeft ? x0 + 1 : x0 + SPRITE_W - 2, y: 3 }
    const angleAt = (p: number) => -1.1 + p * 2.2
    const phase = age / SWING_MS
    for (let k = 1; k <= 5; k++) {
        const past = phase - k * 0.07
        if (past < 0) {
            continue
        }
        const a = angleAt(past)
        dot(c, hand.x + dir * Math.cos(a) * 6, hand.y + Math.sin(a) * 3.2, scale(TRAIL, 1 - k / 6))
    }
    const a = angleAt(phase)
    for (let i = 1; i <= 5; i++) {
        dot(c, hand.x + dir * Math.cos(a) * i, hand.y + Math.sin(a) * i * 0.6, i === 5 ? WHITE : BLADE)
    }
    dot(c, hand.x, hand.y, 0xf4c430)
}

const drawBug = (c: Canvas, x: number, y: number, part: 'whole' | 'left' | 'right', alpha: number): void => {
    BUG_ART.forEach((line, dy) => [...line].forEach((cell, dx) => {
        const isKept = part === 'whole' || (part === 'left' ? dx < 2 : dx >= 2)
        if (cell !== '.' && isKept) {
            dot(c, x + dx, y + dy, scale(cell === 'h' ? BUG_HEAD : cell === 'l' ? BUG_HEAD : BUG, alpha))
        }
    }))
}

const drawSlice = (c: Canvas, v: View, x0: number): void => {
    if (v.action === null || v.action.kind !== 'slice' || v.species !== 'ninja') {
        return
    }
    const age = v.action.age
    const dir = v.pose.isFacingLeft ? -1 : 1
    const hitX = v.pose.isFacingLeft ? x0 - 5 : x0 + SPRITE_W + 1
    const startX = hitX + dir * 18
    const hitAt = SWING_IN_SLICE + SWING_MS * 0.45
    if (age < hitAt) {
        const p = Math.min(1, age / hitAt)
        const legs = Math.floor(age / 80) % 2
        drawBug(c, startX + (hitX - startX) * p, 2 + legs * 0.4, 'whole', 1)

        return
    }
    const after = age - hitAt
    const alpha = Math.max(0, 1 - after / (SLICE_MS - hitAt))
    drawBug(c, hitX - after / 90, 2 + after / 150, 'left', alpha)
    drawBug(c, hitX + after / 90, 2 - after / 220, 'right', alpha)
    for (let k = 0; k < 5; k++) {
        if (hash(k + 11) * 400 < after) {
            dot(c, hitX + 2 + (hash(k) - 0.5) * after / 40, 2 + hash(k + 5) * 3, scale(0x9ef07a, alpha))
        }
    }
}

const wrapText = (text: string, width: number): string[] => {
    if (text.includes('\n')) {
        return text.split('\n').flatMap(part => wrapText(part, width)).slice(0, NOTE_MAX_LINES)
    }
    if (text.trim() !== '' && [...text.trimEnd()].length <= width) {
        return [text.trimEnd()]
    }
    const lines: string[] = []
    let line = ''
    for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
        if (line === '') {
            line = word
        } else if (line.length + 1 + word.length <= width) {
            line += ` ${word}`
        } else {
            lines.push(line)
            line = word
        }
        while (line.length > width) {
            lines.push(line.slice(0, width))
            line = line.slice(width)
        }
    }
    if (line !== '') {
        lines.push(line)
    }

    return lines.slice(0, NOTE_MAX_LINES)
}

const noteWidthOf = (cols: number): number => Math.max(20, cols - 2)

export const noteLinesOf = (note: { text: string }, cols: number): string[] => wrapText(note.text, noteWidthOf(cols) - 4)

export const rowsOf = (note: { text: string } | null, cols: number, menu: Menu | null = null): number =>
    menuRowsOf(menu, cols) + (note === null ? ROWS : ROWS + noteLinesOf(note, cols).length + 2)

export const noteTtlOf = (text: string): number => 9000 + text.length * 60

const writeAbsolute = (c: Canvas, x: number, row: number, text: string, color: number | ((i: number) => number)): void =>
    write(c, x, row - c.base, text, color)

const drawNote = (c: Canvas, v: View, x0: number, accent: number): void => {
    if (v.note === null) {
        return
    }
    const ttl = noteTtlOf(v.note.text)
    const alpha = v.note.age > ttl - 600 ? Math.max(0, (ttl - v.note.age) / 600) : 1
    const top = menuRowsOf(v.menu, c.width)
    const lines = noteLinesOf(v.note, c.width)
    const width = noteWidthOf(c.width)
    const left = 1
    for (let row = top; row <= top + lines.length + 1; row++) {
        for (let x = left; x < left + width && x < c.width; x++) {
            c.pixels[row * 2 * c.width + x] = NONE
            c.pixels[(row * 2 + 1) * c.width + x] = NONE
            c.glyphs[row * c.width + x] = 0
        }
    }
    const edge = scale(BUBBLE_EDGE, alpha)
    const title = ` ${[...v.note.title].slice(0, width - 8).join('')} `
    writeAbsolute(c, left, top + 0, `╭─${title}${'─'.repeat(Math.max(0, width - 3 - [...title].length))}╮`, i => (i >= 2 && i < 2 + [...title].length ? scale(accent, alpha) : edge))
    let budget = Math.floor(v.note.age / NOTE_TYPE_MS)
    lines.forEach((line, i) => {
        writeAbsolute(c, left, top + 1 + i, '│', edge)
        writeAbsolute(c, left + width - 1, top + 1 + i, '│', edge)
        const shown = [...line].slice(0, Math.max(0, budget)).join('')
        budget -= [...line].length
        writeAbsolute(c, left + 2, top + 1 + i, shown, scale(BUBBLE_TEXT, alpha))
        if (budget < 0 && shown.length < line.length && Math.floor(v.t / 300) % 2 === 0) {
            writeAbsolute(c, left + 2 + shown.length, top + 1 + i, '▍', scale(accent, alpha))
        }
    })
    const bottom = 1 + lines.length
    const tail = Math.max(left + 2, Math.min(left + width - 3, x0 + Math.floor(SPRITE_W / 2)))
    writeAbsolute(c, left, top + bottom, `╰${'─'.repeat(width - 2)}╯`, edge)
    writeAbsolute(c, tail, top + bottom, '┬', edge)
}

const BALL = 0xff5a3c
const BALL_SHADE = 0xc23a22
const BALL_SHINE = 0xffd2c4
const STEEL = 0xc9d3dc
const STEEL_CORE = 0x555b66
const SNOW = 0xe8f0ff
const SPARK_MS = 260

const drawToy = (c: Canvas, v: View): void => {
    if (v.toy === null) {
        return
    }
    const { x, y } = v.toy
    if (v.toy.kind === 'ball') {
        dot(c, x, y, BALL_SHINE)
        dot(c, x + 1, y, BALL)
        dot(c, x, y + 1, BALL)
        dot(c, x + 1, y + 1, BALL_SHADE)

        return
    }
    const isPlus = Math.floor(v.toy.age / 60) % 2 === 0
    const arms = isPlus ? [[0, -1], [0, 1], [-1, 0], [1, 0]] : [[-1, -1], [1, 1], [-1, 1], [1, -1]]
    arms.forEach(([dx, dy]) => dot(c, x + (dx ?? 0), y + (dy ?? 0), STEEL))
    dot(c, x, y, STEEL_CORE)
}

const drawSpark = (c: Canvas, v: View): void => {
    if (v.spark === null || v.spark.age > SPARK_MS) {
        return
    }
    const r = 1 + v.spark.age / 70
    for (let k = 0; k < 8; k++) {
        const angle = (k / 8) * Math.PI * 2
        dot(c, v.spark.x + Math.cos(angle) * r * 1.6, v.spark.y + Math.sin(angle) * r * 0.8, k % 2 === 0 ? WHITE : 0xffe23b)
    }
}

const HATS: Record<'winter' | 'halloween', { art: readonly string[]; colors: Record<string, number> }> = {
    winter: { art: ['..rrrrp.', '.tttttt.'], colors: { r: 0xd62828, p: 0xf5f5f5, t: 0xf5f5f5 } },
    halloween: { art: ['...ppw..', '.ppoopp.'], colors: { p: 0x6b3fa0, w: 0x4a2b70, o: 0xff8a2a } },
}

const drawHat = (c: Canvas, v: View, x0: number, size = 1, light = 1): void => {
    if (v.season === null) {
        return
    }
    const hat = HATS[v.season]
    const y = v.jump === null ? liftOf(v) : v.pose.lift
    const x = x0 + shakeOf(v)
    hat.art.forEach((line, dy) => [...line].forEach((cell, dx) => {
        if (cell === '.') {
            return
        }
        const column = v.pose.isFacingLeft ? SPRITE_W - 1 - (dx + 1) : dx + 1
        dot(c, x + column, y + dy, scale(hat.colors[cell] ?? WHITE, light), size)
    }))
}

const BAT = 0x9a7cc4

const drawBats = (c: Canvas, v: View): void => {
    for (let k = 0; k < 2; k++) {
        const x = ((v.t * (0.006 + k * 0.002) + k * 0.5 * c.width) % (c.width + 6)) - 3
        const y = 1 + Math.round(Math.sin(v.t / 300 + k * 2)) - c.base * 2
        const isUp = Math.floor(v.t / 160 + k) % 2 === 0
        dot(c, x - 1, y + (isUp ? 0 : 1), BAT)
        dot(c, x + 1, y + (isUp ? 0 : 1), BAT)
        dot(c, x, y + (isUp ? 1 : 0), BAT)
    }
}

const drawSnow = (c: Canvas, v: View): void => {
    if (v.season === 'halloween') {
        drawBats(c, v)

        return
    }
    if (v.season !== 'winter') {
        return
    }
    const count = Math.max(4, Math.floor(c.width / 7))
    const height = c.rows * 2
    for (let k = 0; k < count; k++) {
        const fall = (v.t * (0.0016 + hash(k + 7) * 0.0012) + hash(k + 3) * height) % (height + 1)
        const x = hash(k) * c.width + Math.sin(v.t / 700 + k) * 1.5
        dot(c, x, fall - c.base * 2 - 0.5, scale(SNOW, 0.55 + 0.45 * hash(k + 11)))
    }
}

const VISITOR_LABEL = 0xb9b5c9

const drawVisitors = (c: Canvas, v: View): void => {
    const shown = v.neighbors.slice(0, VISITORS_SHOWN)
    shown.forEach((neighbor, i) => {
        const species = speciesOf(neighbor.species)
        const body = scale(species.colors.b ?? WHITE, 0.85)
        const x = 1 + i * 3
        const hop = Math.floor((v.t + i * 170) / 220) % 2
        const top = 3 - hop
        dot(c, x, top, body)
        dot(c, x + 1, top, body)
        dot(c, x, top + 1, body)
        dot(c, x + 1, top + 1, species.colors.e ?? 0)
        dot(c, x + hop, top + 2, scale(body, 0.7))
        if (Math.floor((v.t + i * 150) / 300) % 2 === 0) {
            write(c, x, 0, '!', neighbor.status === 'permission' ? RED : 0xffe23b)
        }
    })
    if (shown.length > 0) {
        write(c, 1 + shown.length * 3 + 1, 1, visitorsLabelFit(v.neighbors.length, v.visitorsLabel, c.width), VISITOR_LABEL)
    }
}

const MENU_EDGE = 0x6c6880
const MENU_TEXT = 0xd6d3e0
const MENU_ON = 0xffd23b

const drawMenu = (c: Canvas, v: View): void => {
    if (v.menu === null) {
        return
    }
    const rows = menuRowsOf(v.menu, c.width)
    for (let i = 0; i < rows * 2 * c.width; i++) {
        c.pixels[i] = NONE
    }
    const items = new Map(v.menu.items.map(item => [item.key, item]))
    menuLayoutOf(v.menu, c.width).forEach(spot => {
        const item = items.get(spot.key)
        if (item !== undefined) {
            writeAbsolute(c, spot.x, spot.row, `[${item.label}]`, i => (i === 0 || i === spot.width - 1 ? MENU_EDGE : item.isOn ? MENU_ON : MENU_TEXT))
        }
    })
}

type BubbleSide = { isLeft: boolean; room: number; edge: number }

const bubbleSideOf = (c: Canvas, v: View, x0: number): BubbleSide => {
    const minis = Math.min(3, v.agents)
    const left = x0 - (!v.pose.isFacingLeft && minis > 0 ? minis * 3 : 0)
    const right = x0 + SPRITE_W + (v.pose.isFacingLeft && minis > 0 ? minis * 3 + 1 : 0)
    const roomLeft = left - 2 - visitorsWidthOf(v.neighbors.length, v.visitorsLabel, c.width)
    const roomRight = c.width - right - 2

    return roomLeft >= roomRight ? { isLeft: true, room: roomLeft, edge: left } : { isLeft: false, room: roomRight, edge: right }
}

const drawHearts = (c: Canvas, v: View, x0: number): void => {
    const isLeft = !bubbleSideOf(c, v, x0).isLeft
    v.hearts.forEach((age, k) => {
        if (age < 0 || age > HEART_MS) {
            return
        }
        const rise = age / HEART_MS
        const x = (isLeft ? x0 - 2 - k * 2 : x0 + SPRITE_W + 1 + k * 2) + Math.round(Math.sin(age / 180 + k * 2) * 0.6)
        write(c, x, 2 - Math.min(2, Math.floor(rise * 3)), '♥', scale(HEART, 1 - rise * 0.5))
    })
}

const drawAura = (c: Canvas, v: View, x0: number): void => {
    const rarity = rarityOf(v.rarity)
    for (let k = 0; k < rarity.stars - 2; k++) {
        const beat = Math.floor(v.t / 450) + k * 5
        if (hash(beat) > 0.45) {
            continue
        }
        const x = hash(beat + 1) > 0.5 ? x0 + SPRITE_W : x0 - 1
        write(c, x, Math.floor(hash(beat + 2) * ROWS), hash(beat + 3) > 0.5 ? '+' : '·', rarity.color)
    }
}

const drawMinis = (c: Canvas, v: View, x0: number): void => {
    const species = speciesOf(v.species)
    const color = species.colors.b ?? WHITE
    const eye = species.colors.e ?? 0
    const behind = v.pose.isFacingLeft ? x0 + SPRITE_W + 1 : x0 - 3
    const step = v.pose.isFacingLeft ? 3 : -3
    for (let k = 0; k < Math.min(3, v.agents); k++) {
        const x = behind + k * step
        const hop = Math.floor(v.t / 180 + k) % 2
        const top = 3 - hop
        dot(c, x, top, color)
        dot(c, x + 1, top, color)
        dot(c, x, top + 1, color)
        dot(c, x + 1, top + 1, eye)
        dot(c, x + hop, top + 2, scale(color, 0.7))
    }
}

const bubbleAlpha = (age: number): number => {
    if (age > BUBBLE_MS) {
        return 0
    }

    return age > BUBBLE_MS - 700 ? (BUBBLE_MS - age) / 700 : 1
}

const drawBubble = (c: Canvas, v: View, x0: number): void => {
    if (v.bubble === null) {
        return
    }
    const alpha = bubbleAlpha(v.bubble.age)
    if (alpha <= 0) {
        return
    }
    const { isLeft, room: space, edge: side } = bubbleSideOf(c, v, x0)
    const room = Math.min(BUBBLE_MAX, space - 4)
    if (room < 4) {
        return
    }
    const chars = [...v.bubble.text]
    const text = chars.length <= room ? v.bubble.text : `${chars.slice(0, room - 1).join('').trimEnd()}…`
    const shown = [...text].slice(0, Math.floor(v.bubble.age / TYPE_MS)).join('')
    const width = [...text].length + 4
    const x = isLeft ? side - width - 2 : side + 2
    const edge = scale(BUBBLE_EDGE, alpha)
    for (let y = 0; y < ROWS * 2; y++) {
        for (let dx = isLeft ? 0 : -1; dx < width + (isLeft ? 2 : 0); dx++) {
            dot(c, x + dx, y, NONE)
            clearGlyph(c, x + dx, Math.floor(y / 2))
        }
    }
    write(c, x, 0, `╭${'─'.repeat(width - 2)}╮`, edge)
    write(c, x, 1, isLeft ? '│' : '┤', edge)
    write(c, x + 2, 1, shown, scale(BUBBLE_TEXT, alpha))
    write(c, x + width - 1, 1, isLeft ? '├─' : '│', edge)
    write(c, x, 2, `╰${'─'.repeat(width - 2)}╯`, edge)
    if (!isLeft) {
        write(c, x - 1, 1, '─', edge)
    }
}

const drawEgg = (c: Canvas, x0: number, age: number, glow: number): void => {
    const center = x0 + 1
    if (age < 2300) {
        const speed = age < 1500 ? 260 : 90
        const wobble = Math.floor(age / speed) % 2 === 0 ? 1 : -1
        const tint = age > 1200 ? Math.min(1, (age - 1200) / 900) : 0
        EGG_ART.forEach((line, dy) => [...line].forEach((cell, dx) => {
            if (cell !== '.') {
                const base = cell === 's' ? EGG_SPOT : EGG
                dot(c, center + dx + wobble, dy, tint > 0 && hash(dx + dy * 9 + Math.floor(age / 120)) < tint * 0.4 ? glow : base)
            }
        }))
        if (age > 1500) {
            [[2, 2], [3, 3], [4, 2], [5, 3]].forEach(([dx, dy]) => dot(c, center + (dx ?? 0) + wobble, dy ?? 0, CRACK))
        }

        return
    }
    const spread = 1 + Math.floor((age - 2300) / 90)
    EGG_ART.slice(3).forEach((line, dy) => [...line].forEach((cell, dx) => {
        if (cell !== '.') {
            dot(c, center + dx + (dx < 4 ? -spread : spread), dy + 3, EGG)
        }
    }))
    for (let k = 0; k < 12; k++) {
        const angle = (k / 12) * Math.PI * 2
        dot(c, center + 4 + Math.cos(angle) * spread * 1.6, 2.5 + Math.sin(angle) * spread * 0.6, k % 3 === 0 ? glow : cycle(RAINBOW, k))
    }
}

export const LEAVE_MS = 1400

const ARRIVE_MS: Record<SpeciesId, number> = {
    duck: HATCH_MS,
    penguin: HATCH_MS,
    ninja: 900,
    octopus: 900,
    axolotl: 1100,
    ghost: 1400,
    robot: 1500,
    cat: 1300,
}

export const arriveMsOf = (species: SpeciesId): number => ARRIVE_MS[species]

type Show = (c: Canvas, v: View, x0: number, age: number) => void

const INK = 0x6b3fa0
const FLAME = [0xff7a1a, 0xffc233, 0xffe9a8]

const posed = (v: View, x: number, pose: Partial<Pose>): View =>
    ({ ...v, mood: 'idle', action: null, nap: null, jump: null, trail: [], pose: { ...v.pose, x, isWalking: false, lift: 0, lookX: 0, ...pose } })

const drawBody = (c: Canvas, v: View, x: number, pose: Partial<Pose> = {}, light = 1): void => {
    if (light < 0.2) {
        return
    }
    const view = posed(v, x, pose)
    drawSprite(c, view, x, 1, light)
    drawHat(c, view, x, 1, light)
}

const edgeOf = (c: Canvas, x0: number): number => (x0 + SPRITE_W / 2 < c.width / 2 ? -SPRITE_W - 1 : c.width + 1)

const drawFlame = (c: Canvas, x0: number, y: number, t: number): void => {
    for (let i = 0; i < 4; i++) {
        dot(c, x0 + 3 + i, y + (hash(i + Math.floor(t / 60)) > 0.5 ? 1 : 0), cycle(FLAME, i + Math.floor(t / 90)))
    }
}

const drawDust = (c: Canvas, x0: number, age: number): void => {
    if (age >= 0 && age < 300) {
        const spread = 1 + Math.floor(age / 100)
        write(c, x0 - spread, 2, '·', 0xb9b3a8)
        write(c, x0 + SPRITE_W - 1 + spread, 2, '·', 0xb9b3a8)
    }
}

const drawBubbles = (c: Canvas, x0: number, age: number): void => {
    for (let k = 0; k < 7; k++) {
        const life = age - k * 70
        if (life > 0 && life < 700) {
            const p = life / 700
            write(c, x0 - 1 + ((k * 4) % (SPRITE_W + 2)), 2 - Math.floor(p * 3), p > 0.75 ? '·' : 'o', scale(BUBBLE, 1 - p * 0.3))
        }
    }
}

const puffIn = (color: number): Show => (c, v, x0, age) => {
    drawSmoke(c, x0 + SPRITE_W / 2, 2, age - 120, color)
    drawSmoke(c, x0 + SPRITE_W / 2 - 3, 3, age - 220, color)
    if (age > 360) {
        drawBody(c, v, x0)
    }
}

const puffOut = (color: number): Show => (c, v, x0, age) => {
    if (age < 300) {
        drawBody(c, v, x0)
    }
    drawSmoke(c, x0 + SPRITE_W / 2, 2, age - 240, color)
    drawSmoke(c, x0 + SPRITE_W / 2 + 3, 3, age - 340, color)
}

const ARRIVALS: Record<SpeciesId, Show> = {
    duck: (c, v, x0, age) => drawEgg(c, x0, age, rarityOf(v.rarity).color),
    penguin: (c, v, x0, age) => drawEgg(c, x0, age, rarityOf(v.rarity).color),
    ninja: puffIn(SMOKE),
    octopus: puffIn(INK),
    axolotl: (c, v, x0, age) => {
        drawBubbles(c, x0, age)
        if (age > 380) {
            drawBody(c, v, x0)
        }
    },
    ghost: (c, v, x0, age) => {
        drawBody(c, v, x0, {}, Math.min(1, age / 1100))
        for (let k = 0; k < 4; k++) {
            const p = ((age + k * 300) % 1200) / 1200
            if (age < 1200 && p < 0.7) {
                dot(c, x0 + (k < 2 ? -1 - k : SPRITE_W + k - 2), 5 - p * 6, scale(WISP, 1 - p))
            }
        }
    },
    robot: (c, v, x0, age) => {
        const lift = -Math.round(Math.max(0, 1 - age / 1000) * 8)
        drawBody(c, v, x0, { lift })
        drawFlame(c, x0, lift + 6, age)
        drawDust(c, x0, age - 1000)
    },
    cat: (c, v, x0, age) => {
        const edge = edgeOf(c, x0)
        const p = Math.min(1, age / 900)
        const x = Math.round(edge + (x0 - edge) * (1 - (1 - p) ** 2))
        drawBody(c, v, x, { isWalking: p < 1, isFacingLeft: edge > x0, lift: age > 950 && age < 1150 ? -1 : 0 })
    },
}

const walkOut: Show = (c, v, x0, age) => {
    const edge = edgeOf(c, x0)
    const p = Math.min(1, age / 1200)
    drawBody(c, v, Math.round(x0 + (edge - x0) * p * p), { isWalking: true, isFacingLeft: edge < x0 })
}

const LEAVES: Record<SpeciesId, Show> = {
    duck: walkOut,
    penguin: walkOut,
    cat: walkOut,
    ninja: puffOut(SMOKE),
    octopus: puffOut(INK),
    axolotl: (c, v, x0, age) => {
        if (age < 320) {
            drawBody(c, v, x0)
        }
        drawBubbles(c, x0, age - 200)
    },
    ghost: (c, v, x0, age) => drawBody(c, v, x0, { lift: -Math.round((age / LEAVE_MS) * 3) }, Math.max(0, 1 - age / 1100)),
    robot: (c, v, x0, age) => {
        const shake = age < 300 ? (Math.floor(age / 50) % 2 === 0 ? 1 : -1) : 0
        const lift = age < 300 ? 0 : -Math.round(((age - 300) / 1000) * 9)
        drawBody(c, v, x0 + shake, { lift })
        drawFlame(c, x0 + shake, lift + 6, age)
        drawDust(c, x0, age)
    },
}

type Hop = (c: Canvas, v: View, jump: Jump) => void

const relay = (out: Show, back: Show, at: number, outPace: number, backPace: number): Hop => (c, v, jump) => {
    if (jump.age < at) {
        out(c, v, jump.fromX, jump.age * outPace)
    } else {
        back(c, v, jump.toX, (jump.age - at) * backPace)
    }
}

const splashAt = (c: Canvas, x0: number, age: number): void => {
    if (age < 0 || age > 500) {
        return
    }
    const p = age / 500
    for (let k = 0; k < 6; k++) {
        const way = k % 2 === 0 ? -1 : 1
        dot(c, x0 + 4.5 + way * (3 + p * 4 + (k >> 1)), 5 - Math.sin(p * Math.PI) * (2 + (k % 3)), scale(DROP, 1 - p * 0.5))
    }
}

const dive: Hop = (c, v, jump) => {
    if (jump.age < 600) {
        drawBody(c, v, jump.fromX, { lift: Math.round((jump.age / 600) * 6) })
    }
    splashAt(c, jump.fromX, jump.age - 150)
    if (jump.age >= 800) {
        drawBody(c, v, jump.toX, { lift: Math.max(0, 6 - Math.round(((jump.age - 800) / 500) * 6)) })
    }
    splashAt(c, jump.toX, jump.age - 800)
}

const drawBelly = (c: Canvas, v: View, x: number, isHeadRight: boolean): void => {
    const species = speciesOf(v.species)
    species.nap.forEach((line, dy) => [...line].forEach((cell, dx) => {
        if (cell !== '.' && cell !== '^') {
            dot(c, isHeadRight ? x + dx : x + SPRITE_W - 1 - dx, SPRITE_H - NAP_H + dy, species.colors[cell] ?? WHITE)
        }
    }))
}

const slide: Hop = (c, v, jump) => {
    const p = Math.min(1, jump.age / 1100)
    const x = Math.round(jump.fromX + (jump.toX - jump.fromX) * (1 - (1 - p) ** 2))
    const dir = jump.toX > jump.fromX ? 1 : -1
    if (jump.age >= 1250) {
        drawBody(c, v, jump.toX)

        return
    }
    drawBelly(c, v, x, dir > 0)
    for (let k = 1; k <= 3; k++) {
        const glow = (1 - p) * (1 - k * 0.25)
        if (glow > 0.3) {
            dot(c, (dir > 0 ? x : x + SPRITE_W - 1) - dir * k * 2, 5 - (k % 2), scale(SNOW, glow))
        }
    }
}

const sprint: Hop = (c, v, jump) => {
    const p = Math.min(1, jump.age / 700)
    const x = Math.round(jump.fromX + (jump.toX - jump.fromX) * p)
    const dir = jump.toX > jump.fromX ? 1 : -1
    const trail = [1, 2, 3].map(k => ({ x: x - dir * k * 3, age: k * 90 })).filter(point => p < 1 && (point.x - jump.fromX) * dir >= 0)
    const running = posed(v, x, { isWalking: p < 1, isFacingLeft: dir < 0 })
    drawTrail(c, { ...running, trail }, x)
    drawBody(c, v, x, { isWalking: p < 1, isFacingLeft: dir < 0 })
    drawDust(c, jump.toX, jump.age - 700)
}

const JUMPS: Record<SpeciesId, Hop> = {
    ninja: (c, v, jump) => drawJump(c, v, jump),
    robot: relay(LEAVES.robot, ARRIVALS.robot, 700, 1.9, 1.6),
    ghost: relay(LEAVES.ghost, ARRIVALS.ghost, 700, 2, 1.5),
    octopus: relay(puffOut(INK), puffIn(INK), 500, 1, 1),
    axolotl: relay(LEAVES.axolotl, ARRIVALS.axolotl, 500, 1, 1),
    duck: dive,
    penguin: slide,
    cat: sprint,
}

const toCells = (c: Canvas): Uint32Array => {
    const cells = new Uint32Array(c.width * c.rows * 3)
    for (let row = 0; row < c.rows; row++) {
        for (let x = 0; x < c.width; x++) {
            const top = c.pixels[row * 2 * c.width + x] ?? NONE
            const bottom = c.pixels[(row * 2 + 1) * c.width + x] ?? NONE
            const glyph = c.glyphs[row * c.width + x] ?? 0
            const at = (row * c.width + x) * 3
            if (top === NONE && bottom === NONE) {
                cells.set(glyph === 0 ? [0x20, DEFAULT, DEFAULT] : [glyph, c.colors[row * c.width + x] ?? DEFAULT, DEFAULT], at)
            } else if (bottom === NONE) {
                cells.set([UPPER, top, DEFAULT], at)
            } else if (top === NONE) {
                cells.set([LOWER, bottom, DEFAULT], at)
            } else {
                cells.set([UPPER, top, bottom], at)
            }
        }
    }

    return cells
}

export const maxXOf = (cols: number): number => Math.max(0, cols - SPRITE_W - 1)

export const paint = (v: View): Uint32Array => {
    const c = canvasOf(v.cols, v.rows, v.rows - ROWS)
    const x0 = Math.max(0, Math.min(maxXOf(v.cols), Math.round(v.pose.x)))
    const isJumping = v.jump !== null
    const isLeaving = v.leave !== null && v.leave.age < LEAVE_MS
    const isArriving = !isLeaving && v.hatchAge !== null && v.hatchAge < arriveMsOf(v.species)
    const isHere = !isJumping && !isLeaving && !isArriving
    drawSnow(c, v)
    if (isHere) {
        drawTree(c, v)
    }
    drawMenu(c, v)
    drawNote(c, v, x0, rarityOf(v.rarity).color)
    drawVisitors(c, v)
    if (v.leave !== null && isLeaving && !isJumping) {
        LEAVES[v.leave.species](c, { ...v, species: v.leave.species }, x0, v.leave.age)
    }
    if (v.hatchAge !== null && isArriving && !isJumping && v.hatchAge >= 0) {
        ARRIVALS[v.species](c, v, x0, v.hatchAge)
    }
    if (v.jump !== null) {
        JUMPS[v.species](c, v, v.jump)
    }
    if (isHere) {
        drawAura(c, v, x0)
        drawMood(c, v, x0)
        drawMinis(c, v, x0)
        drawSlice(c, v, x0)
        drawFruits(c, v, x0)
        drawTrail(c, v, x0)
        if (isLying(v)) {
            drawNap(c, v, x0)
        } else {
            drawSprite(c, v, x0, 1, lightOf(v))
            drawHat(c, v, x0, 1, lightOf(v))
        }
        drawTrick(c, v, x0)
        drawPetals(c, v)
        drawSwing(c, v, x0)
    }
    if (v.note === null) {
        drawBubble(c, v, x0)
    }
    drawToy(c, v)
    drawSpark(c, v)
    drawHearts(c, v, x0)

    return toCells(c)
}

export const paintPortrait = (v: View): Uint32Array => {
    const c = canvasOf(PORTRAIT_COLS, PORTRAIT_ROWS)
    const still = { ...v, jump: null, action: null, pose: { ...v.pose, isWalking: false, lift: 0 } }
    drawSprite(c, still, 0, 2)
    drawHat(c, { ...still, mood: 'idle' }, 0, 2)

    return toCells(c)
}

export const encode = (cells: Uint32Array): string => {
    const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength)
    const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
    if (native !== undefined) {
        return native.call(bytes)
    }
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }

    return btoa(binary)
}

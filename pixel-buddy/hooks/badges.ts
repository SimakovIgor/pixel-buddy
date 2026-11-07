import { rarityOf } from './buddy'
import type { Rarity } from './buddy'
import { canvasOf, dot, scale, toCells, write } from './scene'
import type { Canvas } from './scene'
import { TROPHIES, textOf } from './trophies'
import type { Found, Trophy, TrophyId } from './trophies'

export const BADGE = 10
const GAP = 2
const MAX_PER_ROW = 7
const MIN_PER_ROW = 3
const LOCKED_RIM = 0x4a4d5e
const LOCKED_FILL = 0x23252f
const LOCKED_ICON = 0x3a3d4d
const LOCKED_MARK = 0x6c6880
const LABEL_DIM = 0x6c6880
const LINE_ROWS = BADGE / 2 + 2

const SHAPES: Record<Rarity, readonly string[]> = {
    common: [],
    uncommon: [],
    rare: [
        '...####...',
        '.########.',
        '.########.',
        '##########',
        '##########',
        '##########',
        '##########',
        '.########.',
        '.########.',
        '...####...',
    ],
    epic: [
        '....##....',
        '..######..',
        '.########.',
        '##########',
        '##########',
        '##########',
        '##########',
        '.########.',
        '..######..',
        '....##....',
    ],
    legendary: [
        '##########',
        '##########',
        '##########',
        '##########',
        '##########',
        '##########',
        '.########.',
        '..######..',
        '...####...',
        '....##....',
    ],
}

const ICON_TOP: Record<Rarity, number> = { common: 2, uncommon: 2, rare: 2, epic: 2, legendary: 1 }

const PALETTE: Record<string, number> = {
    w: 0xffffff,
    k: 0x1d1b26,
    y: 0xffd23f,
    o: 0xff8a2a,
    r: 0xe8404f,
    q: 0xa82a36,
    g: 0x5fd17a,
    b: 0x4aa8ff,
    p: 0xb57bff,
    n: 0x9a6a46,
    s: 0xc9d3dc,
}

const ICONS: Record<TrophyId, readonly string[]> = {
    'night-owl': ['n....n', 'nnnnnn', 'nwnnwn', 'nknnkn', '.nyyn.', '..nn..'],
    friday: ['..ss..', '.ssss.', '.sbbs.', '.ssss.', 'rssssr', '.o..o.'],
    comeback: ['..gg..', '.gggg.', 'gggggg', '..gg..', '..gg..', '..gg..'],
    ball: ['.rrrr.', 'rwrrrr', 'rrrrrr', 'rrrrrq', 'rrrrqq', '.qqqq.'],
    regular: ['rrrrrr', 'wwwwww', 'wkwkwk', 'wwwwww', 'wkwkww', 'wwwwww'],
    grown: ['.gggg.', 'gggggg', 'gggggg', '.gggg.', '..nn..', '..nn..'],
    shiny: ['..yy..', '..yy..', 'yywwyy', 'yywwyy', '..yy..', '..yy..'],
    legend: ['......', 'y.yy.y', 'yyyyyy', 'yryyby', 'yyyyyy', '......'],
    'deep-thought': ['w.w.ww', 'w.w..w', 'www.ww', '..w.w.', '..w.ww', '......'],
    'rubber-duck': ['..yy..', '.yyky.', '.yyyoo', 'yyyy..', 'yyyyy.', '.yyy..'],
    leet: ['......', 'gg....', '.gg...', 'gg....', '...ggg', '......'],
    hive: ['ww..ww', '.wwww.', '.ykyk.', 'ykykyk', '.ykyk.', '......'],
    spooky: ['...g..', '.oooo.', 'okooko', 'oooooo', 'okkkko', '.oooo.'],
    'new-year': ['p..y..', '.p.y.b', '..ww..', 'rrwwgg', '..ww..', '.r.g.b'],
}

const QUESTION = ['..ww..', '.w..w.', '....w.', '...w..', '......', '...w..']

const isInside = (shape: readonly string[], x: number, y: number): boolean => shape[y]?.[x] === '#'

const isRim = (shape: readonly string[], x: number, y: number): boolean =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isInside(shape, x + (dx ?? 0), y + (dy ?? 0)))

const drawBadge = (c: Canvas, trophy: Trophy, isFound: boolean, x0: number, y0: number): void => {
    const shape = SHAPES[trophy.rarity]
    const color = rarityOf(trophy.rarity).color
    const rim = isFound ? color : LOCKED_RIM
    const fill = isFound ? scale(color, 0.28) : LOCKED_FILL
    shape.forEach((line, y) => [...line].forEach((cell, x) => {
        if (cell !== '#') {
            return
        }
        const isGlint = isFound && isRim(shape, x, y) && x + y <= 3
        dot(c, x0 + x, y0 + y, isGlint ? scale(rim, 1.45) : isRim(shape, x, y) ? rim : fill)
    }))
    const isMystery = !isFound && trophy.isSecret
    const icon = isMystery ? QUESTION : ICONS[trophy.id]
    const top = ICON_TOP[trophy.rarity]
    icon.forEach((line, dy) => [...line].forEach((cell, dx) => {
        const x = dx + 2
        const y = dy + top
        if (cell === '.' || !isInside(shape, x, y) || isRim(shape, x, y)) {
            return
        }
        const ink = isFound ? PALETTE[cell] ?? 0xffffff : isMystery ? LOCKED_MARK : LOCKED_ICON
        dot(c, x0 + x, y0 + y, ink)
    }))
}

export type TrophyCase = { cells: Uint32Array; columns: number; rows: number }

export const trophyCaseOf = (found: Found, width: number): TrophyCase => {
    const perRow = Math.max(MIN_PER_ROW, Math.min(MAX_PER_ROW, Math.floor((width + GAP) / (BADGE + GAP))))
    const lines = Math.ceil(TROPHIES.length / perRow)
    const columns = perRow * (BADGE + GAP) - GAP
    const rows = lines * LINE_ROWS - 1
    const c = canvasOf(columns, rows)
    TROPHIES.forEach((trophy, i) => {
        const isFound = found[trophy.id] !== undefined
        const x0 = (i % perRow) * (BADGE + GAP)
        const row0 = Math.floor(i / perRow) * LINE_ROWS
        drawBadge(c, trophy, isFound, x0, row0 * 2)
        const label = isFound || !trophy.isSecret ? textOf(trophy).label : '???'
        write(c, x0 + Math.floor((BADGE - label.length) / 2), row0 + BADGE / 2, label, isFound ? rarityOf(trophy.rarity).color : LABEL_DIM)
    })

    return { cells: toCells(c), columns, rows }
}

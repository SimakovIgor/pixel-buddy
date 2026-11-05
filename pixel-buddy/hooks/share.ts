import { levelOf, rarityOf } from './buddy'
import type { Buddy } from './buddy'
import { colorsOf } from './scene'
import { speciesOf } from './species'
import { TROPHIES, countOf, trophyOf } from './trophies'
import type { Found, TrophyId } from './trophies'

export const REPO = 'github.com/SimakovIgor/pixel-buddy'

const BACKDROPS = ['⬛', '⬜', '🟦', '🟪']

const hueOf = (r: number, g: number, b: number, max: number, spread: number): number => {
    if (max === r) {
        return (((g - b) / spread) * 60 + 360) % 360
    }

    return max === g ? ((b - r) / spread) * 60 + 120 : ((r - g) / spread) * 60 + 240
}

const squareOf = (color: number): string => {
    const r = ((color >> 16) & 255) / 255
    const g = ((color >> 8) & 255) / 255
    const b = (color & 255) / 255
    const max = Math.max(r, g, b)
    const spread = max - Math.min(r, g, b)
    const light = (max + max - spread) / 2
    const saturation = spread === 0 ? 0 : spread / (1 - Math.abs(2 * light - 1))
    if (light < 0.3) {
        return '⬛'
    }
    if (spread < 0.16 || saturation < 0.3) {
        return light < 0.5 ? '⬛' : '⬜'
    }
    const hue = hueOf(r, g, b, max, spread)
    if (hue >= 15 && hue < 45) {
        return max < 0.85 ? '🟫' : light > 0.75 ? '🟨' : '🟧'
    }
    if (hue >= 45 && hue < 70) {
        return '🟨'
    }
    if (hue >= 70 && hue < 170) {
        return '🟩'
    }
    if (hue >= 170 && hue < 240) {
        return '🟦'
    }

    return (hue < 15 || hue >= 345) && light <= 0.7 ? '🟥' : '🟪'
}

export const gridOf = (buddy: Buddy): string[] => {
    const colors = colorsOf(buddy.species, buddy.isShiny === true)
    const frame = speciesOf(buddy.species).frames[0] ?? []
    const cells = frame.map(line => [...line].map(cell => (cell === '.' ? null : squareOf(colors[cell] ?? colors.b ?? 0xffffff))))
    const used = new Set(cells.flat())
    const backdrop = BACKDROPS.find(one => !used.has(one)) ?? '⬛'

    return cells.map(row => row.map(cell => cell ?? backdrop).join(''))
}

const latestOf = (found: Found): TrophyId | null =>
    TROPHIES.map(one => one.id).filter(id => found[id] !== undefined).sort((a, b) => (found[b] ?? 0) - (found[a] ?? 0))[0] ?? null

export const shareOf = (buddy: Buddy, found: Found): string => {
    const species = speciesOf(buddy.species).name
    const shine = buddy.isShiny === true ? ' shiny' : ''
    const latest = latestOf(found)
    const trophies = `🏆 ${countOf(found)} of ${TROPHIES.length} trophies${latest === null ? '' : `, the latest: ${trophyOf(latest).name}`}`

    return [
        `${buddy.name}, my ${rarityOf(buddy.rarity).label}${shine} ${species} · level ${levelOf(buddy.xp ?? 0).level}`,
        ...gridOf(buddy),
        trophies,
        `Pixel Buddy for Claude Code: ${REPO}`,
    ].join('\n')
}

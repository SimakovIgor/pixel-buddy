import { isSnarky } from './lines'
import { SPECIES, speciesOf } from './species'
import type { SpeciesId } from './species'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'] as const

export type StatName = (typeof STAT_NAMES)[number]

export type Belly = { value: number; at: number }

export type Buddy = {
    name: string
    species: SpeciesId
    rarity: Rarity
    stats: Record<StatName, number>
    hatchedAt: number
    xp?: number
    belly?: Belly
    isShiny?: boolean
}

export type SnackKind = 'cookie' | 'fish' | 'cake' | 'berry'

export const SNACKS: Record<SnackKind, { xp: number; food: number }> = {
    cookie: { xp: 1, food: 6 },
    fish: { xp: 3, food: 15 },
    cake: { xp: 5, food: 20 },
    berry: { xp: 0, food: 15 },
}

export const HUNGRY = 25
export const FULL = 90
const FRESH_BELLY = 60
const BELLY_PER_HOUR = 8
const SHINY_ODDS = 0.01

export const fullnessOf = (buddy: Buddy, now: number): number => {
    const belly = buddy.belly ?? { value: FRESH_BELLY, at: now }

    return Math.max(0, Math.min(100, belly.value - ((now - belly.at) / 3600000) * BELLY_PER_HOUR))
}

export type Level = { level: number; into: number; need: number }

export const levelOf = (xp: number): Level => {
    let level = 1
    let rest = Math.max(0, Math.floor(xp))
    while (rest >= level * 10) {
        rest -= level * 10
        level += 1
    }

    return { level, into: rest, need: level * 10 }
}

type RarityInfo = { id: Rarity; weight: number; stars: number; floor: number; color: number; label: string }

export const RARITIES: readonly RarityInfo[] = [
    { id: 'common', weight: 60, stars: 1, floor: 5, color: 0x9a9aa8, label: 'common' },
    { id: 'uncommon', weight: 25, stars: 2, floor: 15, color: 0x5fd17a, label: 'uncommon' },
    { id: 'rare', weight: 10, stars: 3, floor: 25, color: 0x4aa8ff, label: 'rare' },
    { id: 'epic', weight: 4, stars: 4, floor: 35, color: 0xb57bff, label: 'epic' },
    { id: 'legendary', weight: 1, stars: 5, floor: 50, color: 0xffcf3f, label: 'legendary' },
]

const NAMES = ['Mochi', 'Pixel', 'Biscuit', 'Noodle', 'Pickle', 'Tofu', 'Byte', 'Mango', 'Sprout', 'Nugget', 'Waffle', 'Dumpling']

const MOODS: Record<StatName, string> = {
    DEBUGGING: 'reads stack traces for fun',
    PATIENCE: 'calm, waits for the build without a word',
    CHAOS: 'unpredictable, loves a red build',
    WISDOM: 'quiet, notices what you missed',
    SNARK: 'sarcastic, but loves you',
}

export const rarityOf = (id: Rarity): RarityInfo => RARITIES.find(one => one.id === id) ?? (RARITIES[0] as RarityInfo)

export const peakOf = (buddy: Buddy): StatName =>
    STAT_NAMES.reduce((best, stat) => (buddy.stats[stat] > buddy.stats[best] ? stat : best), STAT_NAMES[0] as StatName)

const pick = <T>(list: readonly T[], roll: number): T => list[Math.floor(roll * list.length) % list.length] as T

const rollRarity = (roll: number): Rarity => {
    const total = RARITIES.reduce((sum, one) => sum + one.weight, 0)
    let left = roll * total
    for (const one of RARITIES) {
        left -= one.weight
        if (left < 0) {
            return one.id
        }
    }

    return 'common'
}

export const hatch = (random: () => number, now: number, species?: SpeciesId): Buddy => {
    const rarity = rollRarity(random())
    const floor = rarityOf(rarity).floor
    const peak = pick(STAT_NAMES, random())
    const stats = Object.fromEntries(STAT_NAMES.map(stat => {
        const value = stat === peak ? 80 + random() * 20 : floor + random() * (75 - floor)

        return [stat, Math.round(value)]
    })) as Record<StatName, number>

    return {
        name: pick(NAMES, random()),
        species: species ?? pick(SPECIES, random()).id,
        rarity,
        stats,
        hatchedAt: now,
        xp: 0,
        belly: { value: 100, at: now },
        isShiny: random() < SHINY_ODDS,
    }
}

const bar = (value: number): string => {
    const filled = Math.round(value / 10)

    return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

const dateOf = (at: number): string =>
    new Date(at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

const ODDS = RARITIES.map(one => `${one.label} ${one.weight}%`).join(' · ')

const meter = (into: number, need: number): string => {
    const filled = Math.round((into / need) * 10)

    return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

export const cardOf = (buddy: Buddy, now: number): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)
    const stars = '★'.repeat(rarity.stars) + '☆'.repeat(5 - rarity.stars)
    const peak = peakOf(buddy)
    const { level, into, need } = levelOf(buddy.xp ?? 0)
    const belly = Math.round(fullnessOf(buddy, now))

    return [
        `${buddy.name} · ${species.name} · ${stars} ${rarity.label}${buddy.isShiny === true ? ' · ✦ shiny, 1 in 100' : ''}`,
        `hatched ${dateOf(buddy.hatchedAt)}`,
        '',
        `level ${String(level).padEnd(4)}${meter(into, need)} ${into}/${need} xp, earned from your work`,
        `belly ${bar(belly)} ${belly}%${belly < HUNGRY ? ', hungry: right click → feed' : ''}`,
        '',
        `stars are rarity, rolled at hatching: ${ODDS}`,
        'rarer buddies roll higher stats',
        '',
        'stats, rolled at hatching too:',
        ...STAT_NAMES.map(stat => `${stat.padEnd(10)}${bar(buddy.stats[stat])} ${String(buddy.stats[stat]).padStart(3)}${stat === peak ? '  ← highest, sets the personality' : ''}`),
        '',
        `personality: ${MOODS[peak]}`,
        isSnarky(peak) ? 'with CHAOS or SNARK on top it teases you' : 'it cheers you on; a buddy with CHAOS or SNARK on top teases instead',
    ].join('\n')
}

export const introOf = (buddy: Buddy): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)

    return `hi! I'm ${buddy.name}, ${rarity.label} ${species.name} ${'★'.repeat(rarity.stars)}`
}

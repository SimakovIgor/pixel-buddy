import { SPECIES, speciesOf } from './species'
import type { SpeciesId } from './species'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'] as const

export type StatName = (typeof STAT_NAMES)[number]

export type Buddy = {
    name: string
    species: SpeciesId
    rarity: Rarity
    stats: Record<StatName, number>
    hatchedAt: number
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
    }
}

const bar = (value: number): string => {
    const filled = Math.round(value / 10)

    return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

const dateOf = (at: number): string =>
    new Date(at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

export const cardOf = (buddy: Buddy): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)
    const stars = '★'.repeat(rarity.stars) + '☆'.repeat(5 - rarity.stars)

    return [
        `${buddy.name} · ${species.name} · ${stars} ${rarity.label}`,
        `hatched ${dateOf(buddy.hatchedAt)}`,
        '',
        ...STAT_NAMES.map(stat => `${stat.padEnd(10)}${bar(buddy.stats[stat])} ${buddy.stats[stat]}`),
        '',
        `personality: ${MOODS[peakOf(buddy)]}`,
    ].join('\n')
}

export const introOf = (buddy: Buddy): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)

    return `hi! I'm ${buddy.name}, ${rarity.label} ${species.name} ${'★'.repeat(rarity.stars)}`
}

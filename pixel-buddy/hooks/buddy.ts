import { isRu, t } from './i18n'
import { isSnarky } from './lines'
import { SPECIES, SPRITE_W, byGender, speciesOf } from './species'
import type { SpeciesId } from './species'

export const REPO = 'github.com/SimakovIgor/pixel-buddy'

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
    affection?: Belly
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

const FRESH_LOVE = 60
const LOVE_PER_HOUR = 4
export const LONELY = 30
export const TIRED_AFTER_MS = 2 * 3600000
export const JOY_MS = 30 * 60000

export const affectionOf = (buddy: Buddy, now: number): number => {
    const love = buddy.affection ?? { value: FRESH_LOVE, at: now }

    return Math.max(0, Math.min(100, love.value - ((now - love.at) / 3600000) * LOVE_PER_HOUR))
}

export type Vibe = 'joyful' | 'content' | 'tired' | 'hungry' | 'lonely'

export type MoodFacts = { fullness: number; affection: number; workedMs: number; joy: { what: string; agoMs: number } | null }

export type Mood = { vibe: Vibe; why: string }

const durationOf = (ms: number): string => {
    const minutes = Math.round(ms / 60000)

    return minutes >= 60 ? t(`${Math.floor(minutes / 60)}h ${minutes % 60}m`, `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`) : t(`${minutes} min`, `${minutes} мин`)
}

const agoOf = (ms: number): string => (ms < 90000 ? t('just now', 'только что') : t(`${Math.round(ms / 60000)} min ago`, `${Math.round(ms / 60000)} мин назад`))

export const vibeOf = (facts: MoodFacts): Mood => {
    if (facts.fullness < HUNGRY) {
        return { vibe: 'hungry', why: t(`belly ${Math.round(facts.fullness)}%, work or /buddy feed fills it`, `сытость ${Math.round(facts.fullness)}%, накормит работа или /buddy feed`) }
    }
    if (facts.workedMs >= TIRED_AFTER_MS) {
        return { vibe: 'tired', why: t(`${durationOf(facts.workedMs)} of work without a break, a short walk helps`, `${durationOf(facts.workedMs)} работы без перерыва, поможет короткая прогулка`) }
    }
    if (facts.affection < LONELY) {
        return { vibe: 'lonely', why: t('not petted for a while, a click on it helps', 'давно не гладили, поможет клик по нему') }
    }
    if (facts.joy !== null && facts.joy.agoMs < JOY_MS) {
        return { vibe: 'joyful', why: `${facts.joy.what} ${agoOf(facts.joy.agoMs)}` }
    }
    if (facts.fullness >= 70 && facts.affection >= 70) {
        return { vibe: 'joyful', why: t('well fed and loved', 'сытость и ласка') }
    }

    return { vibe: 'content', why: t('fed, petted, rested', 'сытость, ласка, отдых') }
}

export const VIBE_MARKS: Record<Vibe, string> = { joyful: '♪', content: '·', tired: 'zz', hungry: '~', lonely: '?' }

const VIBES_RU: Record<Vibe, string> = { joyful: 'радость', content: 'покой', tired: 'усталость', hungry: 'голод', lonely: 'скука' }

export const vibeLabelOf = (vibe: Vibe): string => (isRu() ? VIBES_RU[vibe] : vibe)

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

const RARITIES_RU: Record<Rarity, readonly [string, string]> = {
    common: ['обычный', 'обычная'],
    uncommon: ['необычный', 'необычная'],
    rare: ['редкий', 'редкая'],
    epic: ['эпический', 'эпическая'],
    legendary: ['легендарный', 'легендарная'],
}

const MOODS_RU: Record<StatName, string> = {
    DEBUGGING: 'читает стектрейсы для удовольствия',
    PATIENCE: 'спокойный, молча ждет сборку',
    CHAOS: 'непредсказуемый, любит красную сборку',
    WISDOM: 'тихий, замечает, что ты упустил',
    SNARK: 'язвительный, но любит тебя',
}

const MOODS: Record<StatName, string> = {
    DEBUGGING: 'reads stack traces for fun',
    PATIENCE: 'calm, waits for the build without a word',
    CHAOS: 'unpredictable, loves a red build',
    WISDOM: 'quiet, notices what you missed',
    SNARK: 'sarcastic, but loves you',
}

export const rarityOf = (id: Rarity): RarityInfo => {
    const rarity = RARITIES.find(one => one.id === id) ?? (RARITIES[0] as RarityInfo)

    return isRu() ? { ...rarity, label: RARITIES_RU[rarity.id][0] } : rarity
}

export const rarityWordOf = (id: Rarity, species: SpeciesId): string => (isRu() ? byGender(species, RARITIES_RU[id][0], RARITIES_RU[id][1]) : rarityOf(id).label)

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
        affection: { value: 70, at: now },
        isShiny: random() < SHINY_ODDS,
    }
}

export const bar = (value: number): string => {
    const filled = Math.round(value / 10)

    return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

const dateOf = (at: number): string => {
    const date = new Date(at)

    return isRu()
        ? `${date.getDate()} ${MONTHS_RU[date.getMonth()] ?? ''} ${date.getFullYear()}`
        : date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

const oddsOf = (): string => RARITIES.map(one => `${isRu() ? RARITIES_RU[one.id][1] : one.label} ${one.weight}%`).join(' · ')

export const meter = (into: number, need: number): string => {
    const filled = Math.round((into / need) * 10)

    return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

const portraitOf = (buddy: Buddy): string[] => {
    const frame = speciesOf(buddy.species).frames[0] ?? []
    const filled = (row: number, col: number): boolean => {
        const cell = frame[row]?.[col] ?? '.'

        return cell !== '.' && cell !== 'e'
    }

    return [0, 2, 4].map(row => Array.from({ length: SPRITE_W }, (_, col) => {
        const top = filled(row, col)
        const bottom = filled(row + 1, col)

        return top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' '
    }).join(''))
}

export const cardOf = (buddy: Buddy, now: number, mood: Mood | null = null): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)
    const stars = '★'.repeat(rarity.stars) + '☆'.repeat(5 - rarity.stars)
    const peak = peakOf(buddy)
    const { level, into, need } = levelOf(buddy.xp ?? 0)
    const belly = Math.round(fullnessOf(buddy, now))
    const love = Math.round(affectionOf(buddy, now))
    const [top = '', middle = '', bottom = ''] = portraitOf(buddy)

    const shiny = byGender(buddy.species, 'блестящий', 'блестящая')

    return [
        `${top}   ${buddy.name} · ${species.name} · ${stars} ${rarityWordOf(buddy.rarity, buddy.species)}${buddy.isShiny === true ? t(' · ✦ shiny, 1 in 100', ` · ✦ ${shiny}, 1 из 100`) : ''}`,
        `${middle}   ${t('hatched', 'день рождения:')} ${dateOf(buddy.hatchedAt)}`,
        `${bottom}   ${mood === null ? '' : `${t('mood', 'настроение')}: ${vibeLabelOf(mood.vibe)} ${VIBE_MARKS[mood.vibe]} ${mood.why}`}`.trimEnd(),
        '',
        t(`level ${String(level).padEnd(4)}${meter(into, need)} ${into}/${need} xp, earned from your work`, `уровень ${String(level).padEnd(2)}${meter(into, need)} ${into}/${need} xp, за твою работу`),
        t(`belly     ${bar(belly)} ${belly}%${belly < HUNGRY ? ', hungry: /buddy feed' : ''}`, `сытость   ${bar(belly)} ${belly}%${belly < HUNGRY ? ', голод: /buddy feed' : ''}`),
        t(`love      ${bar(love)} ${love}%, grows when you pet it or play ball`, `любовь    ${bar(love)} ${love}%, растет, когда гладишь или играешь в мяч`),
        '',
        t(`stars are rarity, rolled at hatching: ${oddsOf()}`, `звезды показывают редкость, она выпадает при вылуплении: ${oddsOf()}`),
        t('rarer buddies roll higher stats', 'у редких питомцев статы выше'),
        '',
        t('stats, rolled at hatching too:', 'статы, тоже выпадают при вылуплении:'),
        ...STAT_NAMES.map(stat => `${stat.padEnd(10)}${bar(buddy.stats[stat])} ${String(buddy.stats[stat]).padStart(3)}${stat === peak ? t('  ← highest, sets the personality', '  ← самый высокий, задает характер') : ''}`),
        '',
        t(`personality: ${MOODS[peak]}`, `характер: ${MOODS_RU[peak]}`),
        isSnarky(peak)
            ? t('with CHAOS or SNARK on top it teases you', 'с CHAOS или SNARK на первом месте он тебя подкалывает')
            : t('it cheers you on; a buddy with CHAOS or SNARK on top teases instead', 'он тебя подбадривает, а питомец с CHAOS или SNARK на первом месте подкалывает'),
        '',
        t(`like your buddy? a ⭐ on ${REPO} helps others find it`, `нравится питомец? ⭐ на ${REPO} поможет другим найти мод`),
    ].join('\n')
}

export const headerOf = (buddy: Buddy, now: number, mood: Mood): string => {
    const { level, into, need } = levelOf(buddy.xp ?? 0)
    const filled = Math.round((into / need) * 5)

    return `${buddy.name} · ${t('lv', 'ур')} ${level} ${'▰'.repeat(filled)}${'▱'.repeat(5 - filled)} · ${t('belly', 'сытость')} ${Math.round(fullnessOf(buddy, now))}%`
        + ` · ${t('love', 'любовь')} ${Math.round(affectionOf(buddy, now))}% · ${vibeLabelOf(mood.vibe)} ${VIBE_MARKS[mood.vibe]}`
}

export const introOf = (buddy: Buddy): string => {
    const rarity = rarityOf(buddy.rarity)
    const species = speciesOf(buddy.species)

    return t(
        `hi! I'm ${buddy.name}, ${rarity.label} ${species.name} ${'★'.repeat(rarity.stars)}`,
        `привет! я ${buddy.name}, ${rarityWordOf(buddy.rarity, buddy.species)} ${species.name} ${'★'.repeat(rarity.stars)}`,
    )
}

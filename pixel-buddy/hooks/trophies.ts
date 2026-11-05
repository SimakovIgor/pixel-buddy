import { levelOf } from './buddy'
import type { Buddy, Rarity } from './buddy'

export type TrophyId =
    | 'night-owl'
    | 'friday'
    | 'comeback'
    | 'ball'
    | 'regular'
    | 'grown'
    | 'shiny'
    | 'legend'
    | 'deep-thought'
    | 'rubber-duck'
    | 'leet'
    | 'hive'
    | 'spooky'
    | 'new-year'

export type Trophy = { id: TrophyId; name: string; rarity: Rarity; hint: string; isSecret: boolean }

export type Found = Partial<Record<TrophyId, number>>

export type Tally = { day: string; streak: number }

export const TROPHIES: readonly Trophy[] = [
    { id: 'night-owl', name: 'Night Owl', rarity: 'rare', hint: 'a commit between 2 and 5 at night', isSecret: false },
    { id: 'friday', name: 'Friday Deploy', rarity: 'rare', hint: 'a commit on a Friday after 6 in the evening', isSecret: false },
    { id: 'comeback', name: 'Comeback', rarity: 'rare', hint: 'green tests soon after three failures in a row', isSecret: false },
    { id: 'ball', name: 'Ball Champ', rarity: 'rare', hint: 'ten balls caught in one minute', isSecret: false },
    { id: 'regular', name: 'Regular', rarity: 'epic', hint: 'a snack every day for a week', isSecret: false },
    { id: 'grown', name: 'All Grown Up', rarity: 'epic', hint: 'a buddy at level 10', isSecret: false },
    { id: 'shiny', name: 'Shiny!', rarity: 'legendary', hint: 'a shiny buddy in your nest', isSecret: false },
    { id: 'legend', name: 'Legend', rarity: 'legendary', hint: 'a legendary buddy in your nest', isSecret: false },
    { id: 'deep-thought', name: 'Deep Thought', rarity: 'rare', hint: 'the 42nd answer in one session', isSecret: true },
    { id: 'rubber-duck', name: 'Rubber Duck', rarity: 'rare', hint: 'a duck petted while things keep failing', isSecret: true },
    { id: 'leet', name: '1337', rarity: 'epic', hint: 'a commit at 13:37', isSecret: true },
    { id: 'hive', name: 'Hive Mind', rarity: 'epic', hint: 'eight subagents at once', isSecret: true },
    { id: 'spooky', name: 'Spooky Commit', rarity: 'epic', hint: 'a commit on Halloween', isSecret: true },
    { id: 'new-year', name: 'Happy New Commit', rarity: 'legendary', hint: 'a commit in the hour around midnight on New Year\'s Eve', isSecret: true },
]

export const GROWN_LEVEL = 10
export const REGULAR_DAYS = 7
export const BALLS = 10
export const BALL_WINDOW_MS = 60000
export const COMEBACK_MS = 15 * 60000
export const DUCK_MS = 60000
export const HIVE = 8
export const DEEP_THOUGHT = 42

const DAY_MS = 24 * 3600000

export const trophyOf = (id: TrophyId): Trophy => TROPHIES.find(one => one.id === id) ?? (TROPHIES[0] as Trophy)

const isTrophyId = (value: string): value is TrophyId => TROPHIES.some(one => one.id === value)

export const foundOf = (value: unknown): Found =>
    value === null || typeof value !== 'object'
        ? {}
        : Object.fromEntries(Object.entries(value).filter(([id, at]) => isTrophyId(id) && typeof at === 'number'))

export const commitTrophiesAt = (at: Date): TrophyId[] => {
    const hour = at.getHours()
    const month = at.getMonth()
    const date = at.getDate()
    const ids: Array<TrophyId | null> = [
        hour >= 2 && hour < 5 ? 'night-owl' : null,
        at.getDay() === 5 && hour >= 18 ? 'friday' : null,
        hour === 13 && at.getMinutes() === 37 ? 'leet' : null,
        month === 9 && date === 31 ? 'spooky' : null,
        (month === 11 && date === 31 && hour === 23) || (month === 0 && date === 1 && hour === 0) ? 'new-year' : null,
    ]

    return ids.filter((id): id is TrophyId => id !== null)
}

export const ownedTrophiesOf = (pets: readonly Buddy[]): TrophyId[] => {
    const ids: Array<TrophyId | null> = [
        pets.some(one => one.isShiny === true) ? 'shiny' : null,
        pets.some(one => one.rarity === 'legendary') ? 'legend' : null,
        pets.some(one => levelOf(one.xp ?? 0).level >= GROWN_LEVEL) ? 'grown' : null,
    ]

    return ids.filter((id): id is TrophyId => id !== null)
}

const pad = (n: number): string => String(n).padStart(2, '0')

export const dayKeyOf = (at: number): string => {
    const day = new Date(at)

    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

export const tallyOf = (value: unknown): Tally => {
    const tally = value as Partial<Tally> | null | undefined

    return typeof tally?.day === 'string' && typeof tally.streak === 'number' ? { day: tally.day, streak: tally.streak } : { day: '', streak: 0 }
}

export const nextTally = (tally: Tally, now: number): Tally => {
    const today = dayKeyOf(now)
    if (tally.day === today) {
        return tally
    }

    return { day: today, streak: tally.day === dayKeyOf(now - DAY_MS) ? tally.streak + 1 : 1 }
}

export const countOf = (found: Found): number => TROPHIES.filter(one => found[one.id] !== undefined).length

export const toastOf = (id: TrophyId, found: Found): string => {
    const trophy = trophyOf(id)

    return `Trophy: ${trophy.name}, ${trophy.rarity}, for ${trophy.hint}. ${countOf(found)} of ${TROPHIES.length} found, /buddy trophies lists them`
}

export const listOf = (found: Found): string => {
    const lines = TROPHIES.map(one => {
        const at = found[one.id]
        if (at !== undefined) {
            return `  ◆ ${one.name}, ${one.rarity}: ${one.hint}. Found ${dayKeyOf(at)}`
        }

        return one.isSecret ? `  · ??? a secret ${one.rarity} one` : `  · ${one.name}, ${one.rarity}: ${one.hint}`
    })

    return [`Trophies: ${countOf(found)} of ${TROPHIES.length} found`, ...lines, 'A secret one shows its name once you find it.'].join('\n')
}

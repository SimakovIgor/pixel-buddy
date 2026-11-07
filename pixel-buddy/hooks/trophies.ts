import { levelOf, rarityOf } from './buddy'
import type { Buddy, Rarity } from './buddy'
import { isRu, t } from './i18n'

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

export type Trophy = { id: TrophyId; name: string; label: string; emoji: string; rarity: Rarity; hint: string; isSecret: boolean }

export type Found = Partial<Record<TrophyId, number>>

export type Tally = { day: string; streak: number }

export const TROPHIES: readonly Trophy[] = [
    { id: 'night-owl', name: 'Night Owl', label: 'Night Owl', emoji: '🦉', rarity: 'rare', hint: 'a commit between 2 and 5 at night', isSecret: false },
    { id: 'friday', name: 'Friday Deploy', label: 'Friday', emoji: '🚀', rarity: 'rare', hint: 'a commit on a Friday after 6 in the evening', isSecret: false },
    { id: 'comeback', name: 'Comeback', label: 'Comeback', emoji: '📈', rarity: 'rare', hint: 'green tests soon after three failures in a row', isSecret: false },
    { id: 'ball', name: 'Ball Champ', label: 'Ball Champ', emoji: '⚽', rarity: 'rare', hint: 'ten balls caught in one minute', isSecret: false },
    { id: 'regular', name: 'Regular', label: 'Regular', emoji: '📅', rarity: 'epic', hint: 'a snack every day for a week', isSecret: false },
    { id: 'grown', name: 'All Grown Up', label: 'Grown Up', emoji: '🌳', rarity: 'epic', hint: 'a buddy at level 10', isSecret: false },
    { id: 'shiny', name: 'Shiny!', label: 'Shiny!', emoji: '✨', rarity: 'legendary', hint: 'a shiny buddy in your nest', isSecret: false },
    { id: 'legend', name: 'Legend', label: 'Legend', emoji: '👑', rarity: 'legendary', hint: 'a legendary buddy in your nest', isSecret: false },
    { id: 'deep-thought', name: 'Deep Thought', label: 'Thinker', emoji: '🧠', rarity: 'rare', hint: 'the 42nd answer in one session', isSecret: true },
    { id: 'rubber-duck', name: 'Rubber Duck', label: 'Duck', emoji: '🦆', rarity: 'rare', hint: 'a duck petted while things keep failing', isSecret: true },
    { id: 'leet', name: '1337', label: '1337', emoji: '💻', rarity: 'epic', hint: 'a commit at 13:37', isSecret: true },
    { id: 'hive', name: 'Hive Mind', label: 'Hive Mind', emoji: '🐝', rarity: 'epic', hint: 'eight subagents at once', isSecret: true },
    { id: 'spooky', name: 'Spooky Commit', label: 'Spooky', emoji: '🎃', rarity: 'epic', hint: 'a commit on Halloween', isSecret: true },
    { id: 'new-year', name: 'Happy New Commit', label: 'New Year', emoji: '🎆', rarity: 'legendary', hint: 'a commit in the hour around midnight on New Year\'s Eve', isSecret: true },
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

const RU: Record<TrophyId, { name: string; label: string; hint: string }> = {
    'night-owl': { name: 'Ночная сова', label: 'Сова', hint: 'коммит с 2 до 5 ночи' },
    friday: { name: 'Деплой в пятницу', label: 'Пятница', hint: 'коммит в пятницу после 18:00' },
    comeback: { name: 'Камбэк', label: 'Камбэк', hint: 'зеленые тесты вскоре после трех падений подряд' },
    ball: { name: 'Чемпион по мячу', label: 'Мячик', hint: 'десять пойманных мячей за минуту' },
    regular: { name: 'Завсегдатай', label: 'Неделя', hint: 'еду каждый день целую неделю' },
    grown: { name: 'Совсем взрослый', label: 'Взрослый', hint: 'питомца 10 уровня' },
    shiny: { name: 'Блеск!', label: 'Блеск!', hint: 'блестящего питомца в гнезде' },
    legend: { name: 'Легенда', label: 'Легенда', hint: 'легендарного питомца в гнезде' },
    'deep-thought': { name: 'Глубокая мысль', label: 'Мыслитель', hint: '42-й ответ за одну сессию' },
    'rubber-duck': { name: 'Резиновая уточка', label: 'Уточка', hint: 'ласку утки, пока все падает' },
    leet: { name: '1337', label: '1337', hint: 'коммит в 13:37' },
    hive: { name: 'Улей', label: 'Улей', hint: 'восемь субагентов сразу' },
    spooky: { name: 'Жуткий коммит', label: 'Жуть', hint: 'коммит на Хэллоуин' },
    'new-year': { name: 'С новым коммитом', label: 'Новый год', hint: 'коммит в час вокруг полуночи в Новый год' },
}

export const textOf = (trophy: Trophy): Trophy => (isRu() ? { ...trophy, ...RU[trophy.id] } : trophy)

export const trophyOf = (id: TrophyId): Trophy => textOf(TROPHIES.find(one => one.id === id) ?? (TROPHIES[0] as Trophy))

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

const foundOrder = (found: Found): Trophy[] =>
    TROPHIES.filter(one => found[one.id] !== undefined).sort((a, b) => (found[a.id] ?? 0) - (found[b.id] ?? 0))

export const emojisOf = (found: Found): string => foundOrder(found).map(one => one.emoji).join(' ')

export const toastOf = (id: TrophyId, found: Found): string => {
    const trophy = trophyOf(id)

    return t(
        `${trophy.emoji} Trophy: ${trophy.name}, ${trophy.rarity}, for ${trophy.hint}. ${countOf(found)} of ${TROPHIES.length} found. Menu → share to show it off`,
        `${trophy.emoji} Трофей: ${trophy.name}, ${rarityOf(trophy.rarity).label}, за ${trophy.hint}. Найдено ${countOf(found)} из ${TROPHIES.length}. Меню → поделиться, чтобы похвастаться`,
    )
}

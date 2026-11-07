export type Lang = 'en' | 'ru'

export const LANGUAGES = ['English', 'Русский'] as const

let lang: Lang = 'en'

export const setLanguage = (value: unknown): void => {
    lang = value === 'Русский' ? 'ru' : 'en'
}

export const isRu = (): boolean => lang === 'ru'

export const t = (en: string, ru: string): string => (lang === 'ru' ? ru : en)

export const plural = (n: number, one: string, few: string, many: string): string => {
    const tens = Math.abs(n) % 100
    const ones = tens % 10
    if (tens >= 11 && tens <= 14) {
        return many
    }
    if (ones === 1) {
        return one
    }

    return ones >= 2 && ones <= 4 ? few : many
}

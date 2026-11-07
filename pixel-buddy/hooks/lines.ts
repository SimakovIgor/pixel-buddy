import type { StatName } from './buddy'
import { isRu } from './i18n'

export type Moment = 'error' | 'loop' | 'marathon' | 'plan' | 'agents' | 'commit' | 'green' | 'thinking' | 'back' | 'hungry' | 'tired' | 'lonely'

type Lines = readonly string[]

const LINES: Record<Moment, { calm: Lines; snark: Lines }> = {
    error: {
        calm: ['oops. it happens', 'that one failed, let\'s look', 'a red one. no panic'],
        snark: ['exit 1. a classic', 'have you tried reading the error?', 'bold move. didn\'t work'],
    },
    loop: {
        calm: ['we\'ve tried this three times. new idea?', 'same error again. step back?'],
        snark: ['definition of insanity, round 3', 'we\'ve been here. I have the t-shirt'],
    },
    marathon: {
        calm: ['done! that was a long one', 'phew. finished'],
        snark: ['done. I aged a little', 'finally. I almost fell asleep'],
    },
    plan: {
        calm: ['every step checked off!', 'plan complete. nice work'],
        snark: ['all done. suspiciously smooth', 'plan complete. who are you?'],
    },
    agents: {
        calm: ['I\'ll keep an eye on the little ones', 'helpers are out!'],
        snark: ['minions deployed', 'sending the interns'],
    },
    commit: {
        calm: ['nice commit!', 'saved. good feeling'],
        snark: ['committed. no take-backs', 'a commit! frame it'],
    },
    green: {
        calm: ['green! all good', 'tests pass ✓'],
        snark: ['green. are you sure they test anything?', 'passed. on the first try??'],
    },
    thinking: {
        calm: ['hmm, thinking with you', 'big one. take your time'],
        snark: ['still thinking. bring snacks', 'loading brain…'],
    },
    back: {
        calm: ['oh, you\'re back!', 'missed you'],
        snark: ['look who\'s back', 'I didn\'t touch anything. honest'],
    },
    hungry: {
        calm: ['my tummy rumbles… snack?', 'a berry would be nice'],
        snark: ['I could eat a whole build', 'feed me and I\'ll review your PR'],
    },
    tired: {
        calm: ['two hours straight. stretch?', 'a short walk, maybe? I\'ll wait'],
        snark: ['my pixels are numb. break?', 'even CI takes breaks'],
    },
    lonely: {
        calm: ['pet me?', 'I missed your clicks'],
        snark: ['I\'m not needy. pet me', 'a click would be nice. just saying'],
    },
}

const LINES_RU: Record<Moment, { calm: Lines; snark: Lines }> = {
    error: {
        calm: ['ой. бывает', 'это упало, давай посмотрим', 'красное. без паники'],
        snark: ['exit 1. классика', 'а ошибку читать пробовал?', 'смело. не сработало'],
    },
    loop: {
        calm: ['третий раз одно и то же. новая идея?', 'снова та же ошибка. шаг назад?'],
        snark: ['определение безумия, раунд 3', 'мы тут уже были. у меня есть футболка'],
    },
    marathon: {
        calm: ['готово! это было долго', 'фух. закончили'],
        snark: ['готово. я немного постарел', 'наконец. я чуть не уснул'],
    },
    plan: {
        calm: ['все пункты отмечены!', 'план выполнен. отличная работа'],
        snark: ['все готово. подозрительно гладко', 'план выполнен. кто ты такой?'],
    },
    agents: {
        calm: ['присмотрю за малышами', 'помощники вышли!'],
        snark: ['миньоны отправлены', 'отправляем стажеров'],
    },
    commit: {
        calm: ['классный коммит!', 'сохранено. приятно'],
        snark: ['закоммичено. назад дороги нет', 'коммит! в рамочку'],
    },
    green: {
        calm: ['зелено! все хорошо', 'тесты прошли ✓'],
        snark: ['зелено. а они точно что-то проверяют?', 'прошли. с первого раза??'],
    },
    thinking: {
        calm: ['хмм, думаю вместе с тобой', 'большая задача. не спеши'],
        snark: ['все еще думает. неси печеньки', 'загружаю мозг…'],
    },
    back: {
        calm: ['о, ты снова тут!', 'я скучал'],
        snark: ['смотрите, кто пришел', 'я ничего не трогал. честно'],
    },
    hungry: {
        calm: ['в животе урчит… перекусим?', 'ягодка бы не помешала'],
        snark: ['я бы съел целую сборку', 'покорми, и я посмотрю твой PR'],
    },
    tired: {
        calm: ['два часа без перерыва. потянемся?', 'может, короткая прогулка? я подожду'],
        snark: ['мои пиксели затекли. перерыв?', 'даже CI отдыхает'],
    },
    lonely: {
        calm: ['погладишь?', 'я скучаю по твоим кликам'],
        snark: ['я не навязываюсь. погладь', 'клик был бы кстати. просто говорю'],
    },
}

const SNARKY: readonly StatName[] = ['SNARK', 'CHAOS']

export const isSnarky = (stat: StatName): boolean => SNARKY.includes(stat)

export const lineFor = (moment: Moment, peak: StatName, roll: number): string => {
    const pool = (isRu() ? LINES_RU : LINES)[moment][isSnarky(peak) ? 'snark' : 'calm']

    return pool[Math.floor(roll * pool.length) % pool.length] ?? ''
}

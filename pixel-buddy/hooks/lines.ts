import type { StatName } from './buddy'

export type Moment = 'error' | 'loop' | 'marathon' | 'plan' | 'agents' | 'commit' | 'green' | 'thinking' | 'back'

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
}

const SNARKY: readonly StatName[] = ['SNARK', 'CHAOS']

export const lineFor = (moment: Moment, peak: StatName, roll: number): string => {
    const pool = LINES[moment][SNARKY.includes(peak) ? 'snark' : 'calm']

    return pool[Math.floor(roll * pool.length) % pool.length] ?? ''
}

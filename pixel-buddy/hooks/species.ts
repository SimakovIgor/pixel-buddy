import { isRu } from './i18n'

export type SpeciesId = 'cat' | 'duck' | 'ghost' | 'octopus' | 'axolotl' | 'robot' | 'ninja' | 'penguin'

export type Species = {
    id: SpeciesId
    name: string
    pet: string
    colors: Record<string, number>
    frames: readonly (readonly string[])[]
    nap: readonly string[]
}

export const SPRITE_W = 10
export const SPRITE_H = 6
export const NAP_H = 4

const EYE = 0x1d1b26
const CHEEK = 0xff8fab
const MOUTH = 0x5a2a3a

export const SPECIES: readonly Species[] = [
    {
        id: 'cat',
        name: 'cat',
        pet: 'purrr',
        colors: { b: 0xf2a65a, s: 0xc97b35, e: EYE, c: CHEEK, m: MOUTH },
        frames: [
            [
                '..b.....b.',
                '..bc...cb.',
                's.bbbbbbb.',
                's.bebbbeb.',
                '.scbbmbbc.',
                '...sbbbs..',
            ],
            [
                '..b.....b.',
                '..bc...cb.',
                '..bbbbbbb.',
                '..bebbbeb.',
                's.cbbmbbc.',
                '.s.sbbbs..',
            ],
        ],
        nap: [
            '....b....b',
            's.^^bbbbbb',
            'sbbbbebbeb',
            '.sssbcbbcb',
        ],
    },
    {
        id: 'duck',
        name: 'duck',
        pet: 'quack!',
        colors: { b: 0xffd84a, s: 0xe0b52a, e: EYE, o: 0xff8a2a, c: CHEEK },
        frames: [
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cboobc..',
                '..sbbbbs..',
                '...o..o...',
            ],
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cboobc..',
                '.s.bbbb.s.',
                '..o....o..',
            ],
        ],
        nap: [
            '.....bbbb.',
            's.^^bebbeb',
            'sbbbcboobc',
            '.ssssssss.',
        ],
    },
    {
        id: 'ghost',
        name: 'ghost',
        pet: 'boo~',
        colors: { b: 0xece9fb, s: 0xb9b3dd, e: EYE, c: CHEEK, m: MOUTH },
        frames: [
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cbmmbc..',
                '..bbbbbb..',
                '..s.ss.s..',
            ],
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cbmmbc..',
                '..bbbbbb..',
                '..ss.ss.s.',
            ],
        ],
        nap: [
            '.....bbbb.',
            '.s^^bebbeb',
            's.bbcbmmbc',
            '.s.sbbbbbb',
        ],
    },
    {
        id: 'octopus',
        name: 'octopus',
        pet: 'blub',
        colors: { b: 0xff7a9c, s: 0xd9506f, e: EYE, c: 0xffc2d1, m: MOUTH },
        frames: [
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cbbbbc..',
                '.s.s..s.s.',
                's.s....s.s',
            ],
            [
                '...bbbb...',
                '..bbbbbb..',
                '..bebbeb..',
                '..cbbbbc..',
                '..s.ss.s..',
                '.s.s..s.s.',
            ],
        ],
        nap: [
            '.....bbbb.',
            '...^bebbeb',
            '.s.sbcbbcb',
            's.s.s.ss.s',
        ],
    },
    {
        id: 'axolotl',
        name: 'axolotl',
        pet: 'mlem',
        colors: { b: 0xffb3d1, s: 0xe58aae, o: 0xff4f8a, e: EYE, c: 0xff7aa8, m: MOUTH },
        frames: [
            [
                'o..bbbb..o',
                '.obbbbbbo.',
                '.bbebbebb.',
                '.bcbmmbcb.',
                '..bbbbbb..',
                '..s....s..',
            ],
            [
                '.o.bbbb.o.',
                'o.bbbbbb.o',
                '.bbebbebb.',
                '.bcbmmbcb.',
                '..bbbbbb..',
                '...s..s...',
            ],
        ],
        nap: [
            '...o.bbbbo',
            's.^^bebbeb',
            '.sbbbcmmbc',
            '..s..s..s.',
        ],
    },
    {
        id: 'robot',
        name: 'robot',
        pet: 'beep boop',
        colors: { b: 0xa9bdd1, s: 0x6f8399, o: 0x4cff8a, e: 0x2bd8ff, m: 0x2b3440 },
        frames: [
            [
                '....o.....',
                '..bbbbbb..',
                '..bebbeb..',
                '..bmmmmb..',
                '.sbbbbbbs.',
                '..s....s..',
            ],
            [
                '....o.....',
                '..bbbbbb..',
                '..bebbeb..',
                '..bmmmmb..',
                's.bbbbbb.s',
                '..s....s..',
            ],
        ],
        nap: [
            '....bbbbbo',
            's^^^bebbeb',
            'sbbbbmmmmb',
            '.s.s.s..s.',
        ],
    },
    {
        id: 'ninja',
        name: 'ninja',
        pet: 'hai!',
        colors: { b: 0x2b2d42, s: 0xf2c9a0, e: 0x141414, z: 0xb98a66, r: 0xe63946, k: 0xdfe6ee, g: 0xf4c430, d: 0x8b1e2d },
        frames: [
            [
                '..bbbbbb.k',
                'rrrrrrrr.k',
                '.bsessesbk',
                '..bbbbbbgg',
                '..bbbbbb.d',
                '..b....b..',
            ],
            [
                '..bbbbbb.k',
                '.rrrrrrr.k',
                'rrsessesbk',
                '..bbbbbbgg',
                '..bbbbbb.d',
                '...b..b...',
            ],
        ],
        nap: [
            '..r..bbbb.',
            '.r..rrrrrr',
            'b.^bbseseb',
            'bbbbbbbbbb',
        ],
    },
    {
        id: 'penguin',
        name: 'penguin',
        pet: 'noot noot!',
        colors: { b: 0x3f6aa8, s: 0x2f4f80, w: 0xf2f5fa, e: 0x141414, o: 0xffa23a, c: 0xff9ab0 },
        frames: [
            [
                '...bbbb...',
                '..bbbbbb..',
                '.bwewwewb.',
                '.bwcoocwb.',
                'bbwwwwwwbb',
                '..oo..oo..',
            ],
            [
                '...bbbb...',
                '..bbbbbb..',
                '.bwewwewb.',
                'bbwcoocwbb',
                '.bwwwwwwb.',
                '.oo....oo.',
            ],
        ],
        nap: [
            '.....bbbb.',
            '..^^bweweb',
            'obbbbcoocb',
            'o.swwwwwws',
        ],
    },
]

const RU: Record<SpeciesId, { name: string; pet: string; isFem: boolean }> = {
    cat: { name: 'кот', pet: 'мррр', isFem: false },
    duck: { name: 'утка', pet: 'кря!', isFem: true },
    ghost: { name: 'призрак', pet: 'бу~', isFem: false },
    octopus: { name: 'осьминог', pet: 'буль', isFem: false },
    axolotl: { name: 'аксолотль', pet: 'млем', isFem: false },
    robot: { name: 'робот', pet: 'бип-буп', isFem: false },
    ninja: { name: 'ниндзя', pet: 'кия!', isFem: false },
    penguin: { name: 'пингвин', pet: 'нут-нут!', isFem: false },
}

export const speciesOf = (id: string): Species => {
    const species = SPECIES.find(one => one.id === id) ?? (SPECIES[0] as Species)

    return isRu() ? { ...species, name: RU[species.id].name, pet: RU[species.id].pet } : species
}

export const byGender = (id: string, masculine: string, feminine: string): string => (RU[speciesOf(id).id].isFem ? feminine : masculine)

export type Growth = 'baby' | 'young' | 'adult'

const LITTLE: Record<SpeciesId, Record<'baby' | 'young', readonly (readonly string[])[]>> = {
    cat: {
        baby: [['b.....b', 'bc...cb', 'bbbbbbb', 'bebbbeb', 'cbbmbbc'], ['b.....b', 'bc...cb', 'bbbbbbb', 'bebbbeb', 'cbbmbbc']],
        young: [['.b.....b', '.bc...cb', '.bbbbbbb', 'sbebbbeb', 'scbbmbbc', '..sb.bs.'], ['.b.....b', '.bc...cb', '.bbbbbbb', '.bebbbeb', 'scbbmbbc', 's.sb.bs.']],
    },
    duck: {
        baby: [['.bbbb.', 'bebbeb', 'cboobc', '.o..o.'], ['.bbbb.', 'bebbeb', 'cboobc', 'o....o']],
        young: [['..bbbb..', '.bebbeb.', '.cboobc.', '.sbbbbs.', '..o..o..'], ['..bbbb..', '.bebbeb.', '.cboobc.', '.sbbbbs.', '.o....o.']],
    },
    ghost: {
        baby: [['.bbbb.', 'bebbeb', 'bbmmbb', 's.ss.s'], ['.bbbb.', 'bebbeb', 'bbmmbb', '.s..s.']],
        young: [['..bbbb..', '.bebbeb.', '.cbmmbc.', '.bbbbbb.', '.s.ss.s.'], ['..bbbb..', '.bebbeb.', '.cbmmbc.', '.bbbbbb.', 's.s..s.s']],
    },
    octopus: {
        baby: [['.bbbb.', 'bebbeb', 'cbbbbc', 's.ss.s'], ['.bbbb.', 'bebbeb', 'cbbbbc', '.s..s.']],
        young: [['..bbbb..', '.bbbbbb.', '.bebbeb.', '.cbbbbc.', 's.s..s.s'], ['..bbbb..', '.bbbbbb.', '.bebbeb.', '.cbbbbc.', '.s.ss.s.']],
    },
    axolotl: {
        baby: [['obbbbo', 'bebbeb', '.bmmb.', '.s..s.'], ['obbbbo', 'bebbeb', '.bmmb.', 's....s']],
        young: [['o.bbbb.o', '.bbbbbb.', '.bebbeb.', '.cbmmbc.', '..s..s..'], ['o.bbbb.o', '.bbbbbb.', '.bebbeb.', '.cbmmbc.', '.s....s.']],
    },
    robot: {
        baby: [['..o...', 'bbbbbb', 'bebbeb', '.s..s.'], ['...o..', 'bbbbbb', 'bebbeb', 's....s']],
        young: [['...o....', '.bbbbbb.', '.bebbeb.', '.bmmmmb.', '..s..s..'], ['....o...', '.bbbbbb.', '.bebbeb.', '.bmmmmb.', '.s....s.']],
    },
    ninja: {
        baby: [['.bbbb.', 'rrrrrr', 'bseseb', '.b..b.'], ['.bbbb.', 'rrrrrr', 'bseseb', 'b....b']],
        young: [['.bbbbbb.', 'rrrrrrrr', '.bseseb.', '.bbbbbb.', '.b....b.'], ['.bbbbbb.', 'rrrrrrrr', '.bseseb.', '.bbbbbb.', 'b......b']],
    },
    penguin: {
        baby: [['.bbbb.', 'bewweb', 'bwoowb', '.o..o.'], ['.bbbb.', 'bewweb', 'bwoowb', 'o....o']],
        young: [['..bbbb..', '.bbbbbb.', 'bwewwewb', 'bwcoocwb', '.oo..oo.'], ['..bbbb..', '.bbbbbb.', 'bwewwewb', 'bwcoocwb', 'oo....oo']],
    },
}

const boxOf = (rows: readonly string[], height: number): readonly string[] => {
    const side = Math.floor((SPRITE_W - (rows[0]?.length ?? 0)) / 2)
    const wide = rows.map(line => `${'.'.repeat(side)}${line}`.padEnd(SPRITE_W, '.'))

    return [...Array.from({ length: Math.max(0, height - wide.length) }, () => '.'.repeat(SPRITE_W)), ...wide]
}

const boxed = new Map<string, readonly (readonly string[])[]>()

const boxedOf = (key: string, make: () => readonly (readonly string[])[]): readonly (readonly string[])[] => {
    const known = boxed.get(key) ?? make()
    boxed.set(key, known)

    return known
}

export const miniOf = (id: string, frame: number): readonly string[] => {
    const baby = LITTLE[speciesOf(id).id].baby

    return baby[frame % baby.length] ?? []
}

export const framesOf = (id: string, growth: Growth = 'adult'): readonly (readonly string[])[] => {
    const species = speciesOf(id)
    if (growth === 'adult') {
        return species.frames
    }

    return boxedOf(`${species.id}:${growth}`, () => LITTLE[species.id][growth].map(rows => boxOf(rows, SPRITE_H)))
}

export const napOf = (id: string, growth: Growth = 'adult'): readonly string[] => {
    const species = speciesOf(id)
    if (growth !== 'baby') {
        return species.nap
    }

    return boxedOf(`${species.id}:nap`, () => [boxOf(LITTLE[species.id].baby[0] ?? [], NAP_H)])[0] ?? species.nap
}

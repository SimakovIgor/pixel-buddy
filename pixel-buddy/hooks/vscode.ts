import { DEFAULT, sameCells } from './scene'

const UPPER = 0x2580
const LOWER = 0x2584
const BLOCK = 0x2588
const TEXT = 0xd6d3e0

const hex = (color: number): string => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`

const xml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isPainted = (color: number | undefined): color is number => color !== undefined && color !== DEFAULT && color <= 0xffffff

export const frameSvgOf = (cells: Uint32Array, cols: number, rows: number, px: number): string => {
    const height = rows * 2
    const pixels = new Array<number>(cols * height).fill(-1)
    const backs: string[] = []
    const texts: string[] = []
    for (let row = 0; row < rows; row++) {
        let run: { x: number; chars: string[]; color: number } | null = null
        const flush = () => {
            if (run !== null) {
                texts.push(`<text x="${run.x * px}" y="${(row * 2 + 1.55) * px}" textLength="${run.chars.length * px}" lengthAdjust="spacingAndGlyphs" fill="${hex(run.color)}">${xml(run.chars.join(''))}</text>`)
                run = null
            }
        }
        for (let x = 0; x < cols; x++) {
            const at = (row * cols + x) * 3
            const glyph = cells[at] ?? 0x20
            const fg = cells[at + 1]
            const bg = cells[at + 2]
            if (glyph === UPPER || glyph === LOWER || glyph === BLOCK) {
                flush()
                const top = glyph === LOWER ? bg : fg
                const bottom = glyph === UPPER ? bg : fg
                if (isPainted(top)) {
                    pixels[row * 2 * cols + x] = top
                }
                if (isPainted(bottom)) {
                    pixels[(row * 2 + 1) * cols + x] = bottom
                }
                continue
            }
            if (isPainted(bg)) {
                backs.push(`<rect x="${x * px}" y="${row * 2 * px}" width="${px}" height="${2 * px}" fill="${hex(bg)}"/>`)
            }
            if (glyph === 0x20 || glyph === 0) {
                flush()
                continue
            }
            const color = isPainted(fg) ? fg : TEXT
            if (run !== null && run.color === color && run.x + run.chars.length === x) {
                run.chars.push(String.fromCodePoint(glyph))
            } else {
                flush()
                run = { x, chars: [String.fromCodePoint(glyph)], color }
            }
        }
        flush()
    }
    const rects: string[] = []
    for (let y = 0; y < height; y++) {
        let x = 0
        while (x < cols) {
            const color = pixels[y * cols + x] ?? -1
            let end = x + 1
            while (end < cols && pixels[y * cols + end] === color) {
                end += 1
            }
            if (color >= 0) {
                rects.push(`<rect x="${x * px}" y="${y * px}" width="${(end - x) * px}" height="${px}" fill="${hex(color)}"/>`)
            }
            x = end
        }
    }

    return `${backs.join('')}${rects.join('')}${texts.join('')}`
}

const pct = (n: number): string => `${Number(n.toFixed(3))}%`

export const filmSvgOf = (frames: readonly Uint32Array[], frameMs: number, cols: number, rows: number, px: number): string => {
    const shots: Array<{ cells: Uint32Array; start: number; end: number }> = []
    frames.forEach((cells, i) => {
        const last = shots[shots.length - 1]
        if (last !== undefined && sameCells(last.cells, cells)) {
            last.end = (i + 1) * frameMs
        } else {
            shots.push({ cells, start: i * frameMs, end: (i + 1) * frameMs })
        }
    })
    const [first] = shots
    if (first === undefined || shots.length === 1) {
        return cellsSvgOf(first?.cells ?? new Uint32Array(0), cols, rows, px)
    }
    const total = frames.length * frameMs
    const styles: string[] = []
    const bodies = shots.map((shot, k) => {
        const isLast = k === shots.length - 1
        const steps = [
            shot.start > 0 ? '0% { opacity: 0; }' : '',
            `${pct((shot.start / total) * 100)} { opacity: 1; }`,
            isLast ? '' : `${pct((shot.end / total) * 100)} { opacity: 0; }`,
            `100% { opacity: ${isLast ? 1 : 0}; }`,
        ].filter(step => step !== '').join(' ')
        styles.push(`.s${k} { opacity: 0; animation: s${k} ${total}ms step-end 1 forwards; } @keyframes s${k} { ${steps} }`)

        return `<g class="s${k}">${frameSvgOf(shot.cells, cols, rows, px)}</g>`
    })

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * px}" height="${rows * 2 * px}" viewBox="0 0 ${cols * px} ${rows * 2 * px}" shape-rendering="crispEdges"><style>${styles.join(' ')}</style><g font-family="Menlo, Monaco, monospace" font-size="${(px * 1.62).toFixed(1)}">${bodies.join('')}</g></svg>`
}

export const cellsSvgOf = (cells: Uint32Array, cols: number, rows: number, px: number): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * px}" height="${rows * 2 * px}" viewBox="0 0 ${cols * px} ${rows * 2 * px}" shape-rendering="crispEdges"><g font-family="Menlo, Monaco, monospace" font-size="${(px * 1.62).toFixed(1)}">${frameSvgOf(cells, cols, rows, px)}</g></svg>`

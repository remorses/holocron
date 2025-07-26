import React, { ReactNode } from 'react'

export function jsxDedent(strings: any, ...values: any[]) {
    // Remove initial and end space for first and last strings
    if (strings.length) {
        strings = [
            strings[0].replace(/^\s+/, ''),
            ...strings.slice(1, -1),
            strings[strings.length - 1].replace(/\s+$/, ''),
        ]
    }
    // ── 1. compute common left indent ─────────────────────────
    const minIndent = strings.reduce((min, chunk) => {
        if (!chunk.trim()) return min
        for (const line of chunk.split('\n')) {
            if (!line.trim()) continue
            min = Math.min(min, line?.match(/^ */)?.[0].length || 0)
        }
        return min
    }, Infinity)

    // ── 2. build output, giving keys to both statics & holes ──
    const out: ReactNode[] = []
    for (let i = 0; i < strings.length; i++) {
        // trim this static chunk (all but first line)
        const cleaned = strings[i]
            .split('\n')
            .map((l, idx) => (idx === 0 ? l : l.slice(minIndent)))
            .join('\n')

        if (cleaned) out.push(<span key={`s${i}`}>{cleaned}</span>)

        if (i < values.length) {
            const v = values[i]
            if (React.isValidElement(v)) {
                // clone only if it lacks a key
                out.push(
                    v.key == null ? React.cloneElement(v, { key: `v${i}` }) : v,
                )
            } else {
                out.push(v)
            }
        }
    }
    return <>{out}</>
}

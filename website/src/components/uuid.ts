import * as base62 from '@urlpack/base62'

// short id is a compressed version of an uuid, it removes the - and uses upper case letters too in the encoding (base62)

const HEX_LEN = 32
const UUID_SEGMENTS = [8, 4, 4, 4, 12] as const

/** hex (no dashes) → Uint8Array */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    }
    return bytes
}

/** Uint8Array → hex (no dashes) */
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * Encode a UUID (36‑char with dashes) into a 22‑char Base62 string.
 */
export function encodeUuidToShortId(uuid: string): string {
    const hex = uuid.replace(/-/g, '') // strip dashes
    const bytes = hexToBytes(hex) // hex → bytes
    return base62.encode(bytes) // bytes → Base62
}

/**
 * Decode a 22‑char Base62 string back to a 36‑char UUID.
 */
export function decodeShortIdToUuid(str: string): string {
    const bytes = base62.decode(str) // Base62 → bytes
    let hex = bytesToHex(bytes) // bytes → hex
    hex = hex.padStart(HEX_LEN, '0') // ensure 32 chars
    // re‑insert dashes at 8‑4‑4‑4‑12
    const parts: string[] = []
    let offset = 0
    for (const len of UUID_SEGMENTS) {
        parts.push(hex.slice(offset, offset + len))
        offset += len
    }
    return parts.join('-')
}

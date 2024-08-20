import crypto from "crypto"

export function URL2Key(url: string): {
    key_name: string
    key_version: string | undefined
    key_vault_url: string
} {
    const u = new URL(url)
    const parts = u.pathname.split("/")
    if (parts.length < 2) {
        throw new Error("Invalid URL")
    }
    return {
        key_name: parts[2],
        key_version: parts.length >= 4 && parts[3].length > 0 ? parts[3] : undefined,
        key_vault_url: u.origin,
    }
}

const algo = "aes-128-cbc"

export function cipherFromKey(key: Buffer): crypto.Cipher {
    return crypto.createCipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}

export function decipherFromKey(key: Buffer): crypto.Decipher {
    return crypto.createDecipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}

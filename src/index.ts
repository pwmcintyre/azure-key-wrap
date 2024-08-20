import { AzureDecrypter } from "./encryption/decrypt"
import { AzureEncrypter } from "./encryption/encrypt"

// plaintext message
export type Message = string

// encrypted message
export type EncryptedMessage = {
    value: string
    encryption_key: DataEncryptionKey
}

export type DataEncryptionKey = {
    encrypted_data_key_alg: string
    encrypted: Buffer
    key_url: string
    plaintext: Buffer
}

// config items
const vault = "https://pwmcintyre-example.vault.azure.net"
const key = "key-1"

async function main() {

    // instantiate encrypter and decrypter
    const encrypter = new AzureEncrypter(vault, key)
    const decrypter = new AzureDecrypter()

    // create a message
    const plaintext = "Hello, World!"
    // const plaintext = crypto.randomBytes(100 * 1024).toString('hex') // if you want a large message

    // run the encryption and decryption
    await run(plaintext, encrypter, decrypter)
    await run(plaintext, encrypter, decrypter)

}

async function run(
    plaintext: Message,
    encrypter: AzureEncrypter,
    decrypter: AzureDecrypter,
) {
    // encrypt
    console.time("encrypt")
    const encrypted: EncryptedMessage = await encrypter.encrypt(plaintext)
    console.timeEnd("encrypt")

    // ... optionally send this message over the wire

    // decrypt
    console.time("decrypt")
    const decrypted: Message = await decrypter.decrypt(encrypted)
    console.timeEnd("decrypt")

    // done
    console.info("success", {
        plaintext,
        encrypted: {
            value: encrypted.value,
            encrypted_data_key_alg: encrypted.encryption_key.encrypted_data_key_alg,
            encrypted_data_key: encrypted.encryption_key.encrypted.toString('base64'),
            key_url: encrypted.encryption_key.key_url,
        },
        decrypted,
    })

    // verify the decrypted text
    if (decrypted !== plaintext) {
        throw new Error("Decrypted text does not match original plaintext")
    }
}

main()

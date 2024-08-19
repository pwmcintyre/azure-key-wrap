import { DefaultAzureCredential } from "@azure/identity"
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys"
import crypto from "crypto"

const credential = new DefaultAzureCredential()

// Example usage
const keyVaultUrl = "https://pwmcintyre-example.vault.azure.net/"
const keyName = "key-1"
const keyVersion = undefined // latest version
const azureKeyClient = new KeyClient(keyVaultUrl, credential)

// crypto settings
const algo = "aes-128-cbc"
const wrapping_algo = "RSA1_5"


function cipherFromKey(key: Buffer): crypto.Cipher {
    return crypto.createCipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}
function decipherFromKey(key: Buffer): crypto.Decipher {
    return crypto.createDecipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}

async function main() {

    // create a Data Encryption Key (DEK) for client-side encryption
    // note: sometimes called Client Encryption Key (CEK), Key Encryption Key (KEK)
    const DEK = crypto.randomBytes(32)
    const cipher = cipherFromKey(DEK)

    // encrypt something
    const plaintext = "Hello, World!"
    const encrypted = cipher.update(plaintext, 'utf8', 'base64') + cipher.final('base64')

    // get the Key from the Azure Key Vault
    const keyResponse = await azureKeyClient.getKey(keyName, { version: keyVersion })

    // create cryptograph client for the Key
    const cryptographyClient = new CryptographyClient(keyResponse, credential)

    // wrap the DEK
    const wrapResult = await cryptographyClient.wrapKey(wrapping_algo, DEK)
    const wrapped_DEK = Buffer.from(wrapResult.result)

    // unwrap the encrypted DEK
    const unwrapResult = await cryptographyClient.unwrapKey(wrapping_algo, wrapped_DEK)
    const unwrapped_DEK = Buffer.from(unwrapResult.result)

    // decrypt the encrypted blob
    const decipher = decipherFromKey(unwrapped_DEK)
    let decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8')

    // done
    console.log({
        plaintext,
        encrypted,
        decrypted,
        key: DEK.toString("base64"),
        wrapped_key: wrapped_DEK.toString("base64"),
        unwrapped_key: unwrapped_DEK.toString("base64"),
    })

    // verify the decrypted text
    if (decrypted !== plaintext) {
        throw new Error("Decrypted text does not match original plaintext")
    }

    // example output:
    // {
    //     plaintext: 'Hello, World!',
    //     encrypted: 'IP8zyhgbWC8mb0AV12DT8g==',
    //     decrypted: 'Hello, World!',
    //     key: 'c2yluM9LZsrTic4xAcH9UkuUpmkMxHK5xJbzq4PAec4=',
    //     wrapped_key: 'OX0+yx4ZIg64LY1v3+vUwEoqiZCQMlNwL5kWQM3SiIHYT/qarivoRYlOCEu7TDacoSwIUDJq0iBXOEk1Z+cY1PPuVzKUIxC/irYgVHPm5sYYFidKQP+0YPAplnFhme+VL9OFRKu9rU+lvOEm1Ax1kYdpFXxuQSUjUV9/OlIZXqZNQbgduYL1805V0fQDaVVdFmYeQXozf2cVExc4S9njelb0FUBQj6q91lBmdd1K5nZF9GBCtMOcoPdChBO/LcCig40K+wvvJHIxMrdQ8jzJT+vtbPC543kFwypj2MWSWJjRqOkd4BSPmpn4/QGtwrvz0tIhaqOaLmGJBpGkMBUGOQ==',
    //     unwrapped_key: 'c2yluM9LZsrTic4xAcH9UkuUpmkMxHK5xJbzq4PAec4='
    // }
}

main()

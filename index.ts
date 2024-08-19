import { DefaultAzureCredential } from "@azure/identity"
import { CryptographyClient, KeyClient, KeyWrapAlgorithm } from "@azure/keyvault-keys"
import crypto from "crypto"

const credential = new DefaultAzureCredential()

// types
type Message = string
type EncryptedMessage = {
    value: string
    encrypted_data_key: string
    encrypted_data_key_alg: string
    key_url: string
}

// crypto settings
const algo = "aes-128-cbc"
const wrapping_algo = "RSA1_5"

async function main() {

    const plaintext = "Hello, World!"
    // const plaintext = crypto.randomBytes(100 * 1024).toString('hex') // if you want a large message
    const encrypted = await encrypt(plaintext)
    let decrypted = await decrypt(encrypted)

    // done
    console.log({
        plaintext,
        encrypted,
        decrypted,
    })

    // verify the decrypted text
    if (decrypted !== plaintext) {
        throw new Error("Decrypted text does not match original plaintext")
    }

    // example output:
    // {
    //     plaintext: 'Hello, World!',
    //     encrypted: {
    //       value: '/56blYlXG91vJ4YMM0gCOA==',
    //       encrypted_data_key: 'jVreRh9UPOPjIGvHq80hvXkU+WTfdnr/tE/4no8ZbmMzphZqUqYpyjqz7BM/azUadDSfZ4bCesRjiaOgaD3D0ajIYlt+vRUCszgpoHmCVuGonNw4pd99Xke1ACE8V06t/cDH8K2fdP7ODbvfaRhWwfrnp7SqSgXCsg91t9bXEjjbKNXoXz05zy12EvZQEuYHYDCaXnCkMn2uqEfz/ItwrZJERM9yBE/K0Pr9r7xqUxg0P7a0FFWTQIwESjrY247mR+yyp+eFawS3AyhD+BddNdD10mPuCK01IWV6yjqBOJBf1j8+CVoqCHVMVL//7hkx4YsmvtVMWOaCyCi0rc82Qw==',
    //       encrypted_data_key_alg: 'RSA1_5',
    //       key_url: 'https://pwmcintyre-example.vault.azure.net/keys/key-1/155eb9a29049494d81eafb450f58ec43'
    //     },
    //     decrypted: 'Hello, World!'
    // }
}

// helpers
function cipherFromKey(key: Buffer): crypto.Cipher {
    return crypto.createCipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}
function decipherFromKey(key: Buffer): crypto.Decipher {
    return crypto.createDecipheriv(algo, Buffer.from(key).subarray(0, 16), Buffer.from(key).subarray(16))
}

async function encrypt(message: Message): Promise<EncryptedMessage> {

    // key details
    const keyVaultUrl = "https://pwmcintyre-example.vault.azure.net"
    const keyName = "key-1"
    const keyVersion = undefined // latest version

    // create a Azure Key Client
    const azureKeyClient = new KeyClient(keyVaultUrl, credential)

    // create a Data Encryption Key (DEK) for client-side encryption
    // note: sometimes called Client Encryption Key (CEK), Key Encryption Key (KEK)
    const DEK = crypto.randomBytes(32)
    const cipher = cipherFromKey(DEK)

    // encrypt something
    const encrypted = cipher.update(message, 'utf8', 'base64') + cipher.final('base64')

    // get the Key from the Azure Key Vault
    const keyResponse = await azureKeyClient.getKey(keyName, { version: keyVersion })

    // create cryptograph client for the Key
    const cryptographyClient = new CryptographyClient(keyResponse, credential)

    // wrap the DEK
    const wrapResult = await cryptographyClient.wrapKey(wrapping_algo, DEK)
    const wrapped_DEK = Buffer.from(wrapResult.result)

    return {
        value: encrypted,
        encrypted_data_key: wrapped_DEK.toString("base64"),
        encrypted_data_key_alg: wrapResult.algorithm,
        key_url: wrapResult.keyID!,
    }
}

async function decrypt(encrypted: EncryptedMessage): Promise<Message> {

    // key details
    const u = new URL(encrypted.key_url)
    const keyVaultUrl = u.origin
    const keyName = u.pathname.split("/")[2]
    const keyVersion = u.pathname.split("/")[3] // unsafe, please validate
    const wrap_alg = encrypted.encrypted_data_key_alg as KeyWrapAlgorithm

    // create a Azure Key Client
    const azureKeyClient = new KeyClient(keyVaultUrl, credential)

    // get the Key from the Azure Key Vault
    const keyResponse = await azureKeyClient.getKey(keyName, { version: keyVersion })

    // create cryptograph client for the Key
    const cryptographyClient = new CryptographyClient(keyResponse, credential)

    // unwrap the encrypted DEK
    const wrapped_DEK = Buffer.from(encrypted.encrypted_data_key, "base64")
    const unwrapResult = await cryptographyClient.unwrapKey(wrap_alg, wrapped_DEK)
    const unwrapped_DEK = Buffer.from(unwrapResult.result)

    // decrypt the encrypted blob
    const decipher = decipherFromKey(unwrapped_DEK)
    return decipher.update(encrypted.value, 'base64', 'utf8') + decipher.final('utf8')

}

main()

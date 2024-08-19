import { DefaultAzureCredential } from "@azure/identity"
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys"
import crypto from "crypto"

const credential = new DefaultAzureCredential()

// types
type Message = string
type EncryptedMessage = {
    value: string
    encrypted_data_key: string
    key_url: string
}

// crypto settings
const algo = "aes-128-cbc"
const wrapping_algo = "RSA1_5"

async function main() {

    const plaintext = "Hello, World!"
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
    //       value: 'SE/bj2sfBH2Z34tmBOIIyQ==',
    //       encrypted_data_key: 'SGd/W+fxkyvIdAmA0iC6ctC5Lx6abTZWkI0UDEIDfKNfjH9U3CMDXkdQPipLfylbgrrXoyYrV8GRlhexQ3H4dwqtyoJZcNDpc7r6nmq9H/omzI2PWuwwd5G8RVkFfM/EgkwJa9YVSsi1skzkqrQtWck/jfwfUNNdmNF0wCgo3FwBYalFhyP3rW5wN74XU0nRCasEoLmkBV3H1tZBTz5W2aDy2zQP9BoqddbaLH+mwmeKqfyfUFIaUuDF77CG2SKj8q66+u9iqB96EvX1O0TXSAHu71fG8oH6PTBeIFusIrZUiny98yCwOoJNT03nyTO7dquuJzMoaTPSOGCjgiFk+A==',
    //       key_url: 'https://pwmcintyre-example.vault.azure.net/keys/key-1/'
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
    const keyURL = new URL(`/keys/${keyName}/${keyVersion ?? ''}`, keyVaultUrl)

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
        key_url: keyURL.toString(),
    }
}

async function decrypt(encrypted: EncryptedMessage): Promise<Message> {

    // key details
    const u = new URL(encrypted.key_url)
    const keyVaultUrl = u.origin
    const keyName = u.pathname.split("/")[2]
    const keyVersion = u.pathname.split("/")[3] // unsafe, please validate

    // create a Azure Key Client
    const azureKeyClient = new KeyClient(keyVaultUrl, credential)

    // get the Key from the Azure Key Vault
    const keyResponse = await azureKeyClient.getKey(keyName, { version: keyVersion })

    // create cryptograph client for the Key
    const cryptographyClient = new CryptographyClient(keyResponse, credential)

    // unwrap the encrypted DEK
    const wrapped_DEK = Buffer.from(encrypted.encrypted_data_key, "base64")
    const unwrapResult = await cryptographyClient.unwrapKey(wrapping_algo, wrapped_DEK)
    const unwrapped_DEK = Buffer.from(unwrapResult.result)

    // decrypt the encrypted blob
    const decipher = decipherFromKey(unwrapped_DEK)
    return decipher.update(encrypted.value, 'base64', 'utf8') + decipher.final('utf8')

}

main()

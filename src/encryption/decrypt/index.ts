import { DefaultAzureCredential, TokenCredential } from "@azure/identity"
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys"
import { decipherFromKey, URL2Key } from ".."
import { DataEncryptionKey, EncryptedMessage, Message } from "../.."
import { AzureEncrypter } from "../encrypt"

export class AzureDecrypter {

    // azure key client
    private readonly azureKeyClient: KeyClient

    // Data Encryption Key (DEK) for client-side encryption
    private readonly _dek: Promise<DataEncryptionKey>

    constructor(
        private readonly credential: TokenCredential = new DefaultAzureCredential(),
    ) { }

    private cache = new Map<string, DataEncryptionKey>()

    public async decrypt(message: EncryptedMessage): Promise<Message> {

        // check cache for this Data Encryption Key (DEK)
        let decryption_key = this.cache.get(message.encryption_key.key_url)
        if (decryption_key === undefined) {

            // split URL into parts
            const parts = URL2Key(message.encryption_key.key_url)

            // get the Key from the Azure Key Vault
            const azureKeyClient = new KeyClient(parts.key_vault_url, this.credential)
            const keyResponse = await azureKeyClient.getKey(parts.key_name, { version: parts.key_version })
            const cryptographyClient = new CryptographyClient(keyResponse, this.credential)
            
            // unwrap Data Encryption Key
            const unwrapResult = await cryptographyClient.unwrapKey( AzureEncrypter.wrapping_algo, message.encryption_key.encrypted)
            const unwrapped_DEK = Buffer.from(unwrapResult.result)

            // save to cache
            decryption_key = {
                encrypted_data_key_alg: unwrapResult.algorithm,
                encrypted: message.encryption_key.encrypted,
                key_url: message.encryption_key.key_url,
                plaintext: unwrapped_DEK,
            }
            this.cache.set(message.encryption_key.key_url, decryption_key)
        }

        // decrypt
        const decipher = decipherFromKey(decryption_key.plaintext)
        return decipher.update(message.value, 'base64', 'utf8') + decipher.final('utf8')

    }

}

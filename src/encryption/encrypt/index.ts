import { DefaultAzureCredential, TokenCredential } from "@azure/identity"
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys"
import crypto from "crypto"
import { cipherFromKey } from ".."
import { DataEncryptionKey, EncryptedMessage, Message } from "../.."

export class AzureEncrypter {

    // crypto settings
    public static readonly wrapping_algo = "RSA1_5"

    // azure key client
    private readonly azureKeyClient: KeyClient

    // Data Encryption Key (DEK) for client-side encryption
    private readonly _dek: Promise<DataEncryptionKey>

    constructor(
        private readonly vault: string,
        private readonly key: string,
        private readonly credential: TokenCredential = new DefaultAzureCredential(),
    ) {
        const azureKeyClient = new KeyClient(vault, credential)

        // instantiate Data Encryption Key and wrap it
        this._dek = new Promise( async (resolve, reject) => {

            // make a new plaintext key for client-side encryption
            const plaintext = crypto.randomBytes(32)
            
            // wrap the key for distribution
            const keyResponse = await azureKeyClient.getKey(key)
            const cryptographyClient = new CryptographyClient(keyResponse, credential)
            const wrapResult = await cryptographyClient.wrapKey(AzureEncrypter.wrapping_algo, plaintext)
            const encrypted = Buffer.from(wrapResult.result)

            // keep both
            return resolve({
                encrypted_data_key_alg: wrapResult.algorithm,
                encrypted,
                key_url: wrapResult.keyID!,
                plaintext,
            })
        })
    }

    public async encrypt(message: Message): Promise<EncryptedMessage> {

        const encryption_key = await this._dek

        // instantiate cipher
        const cipher = cipherFromKey(encryption_key.plaintext)

        // encrypt message
        const encrypted = cipher.update(message, 'utf8', 'base64') + cipher.final('base64')

        return {
            value: encrypted,
            encryption_key,
        }
    }

}

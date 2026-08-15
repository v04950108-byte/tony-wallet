const crypto = require("crypto");
const { TronWeb } = require("tronweb");

/*
 * Ключ шифрования НЕ должен находиться
 * в GitHub.
 *
 * Он будет записан в .env:
 *
 * WALLET_ENCRYPTION_KEY=...
 */

function getEncryptionKey() {
  const key =
    process.env.WALLET_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY is not configured."
    );
  }

  /*
   * Требуем ровно 32 байта.
   */
  const buffer =
    Buffer.from(key, "hex");

  if (buffer.length !== 32) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must contain 64 hexadecimal characters."
    );
  }

  return buffer;
}

/*
 * Шифрование приватного ключа.
 *
 * AES-256-GCM:
 *
 * private key
 *     ↓
 * encrypted data
 *
 * Вместе сохраняем:
 * - IV
 * - authentication tag
 * - ciphertext
 */

function encryptPrivateKey(
  privateKey
) {
  const key =
    getEncryptionKey();

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  const encrypted = Buffer.concat([
    cipher.update(
      privateKey,
      "utf8"
    ),
    cipher.final()
  ]);

  const authTag =
    cipher.getAuthTag();

  return {
    encrypted:
      encrypted.toString("hex"),

    iv:
      iv.toString("hex"),

    authTag:
      authTag.toString("hex")
  };
}

/*
 * Расшифровка приватного ключа.
 */

function decryptPrivateKey(
  encrypted,
  iv,
  authTag
) {
  const key =
    getEncryptionKey();

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex")
    );

  decipher.setAuthTag(
    Buffer.from(
      authTag,
      "hex"
    )
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          encrypted,
          "hex"
        )
      ),
      decipher.final()
    ]);

  return decrypted.toString(
    "utf8"
  );
}

/*
 * Создание нового TRON-аккаунта.
 *
 * ВАЖНО:
 * Используется библиотека TronWeb.
 *
 * Никаких seed-фраз пользователей
 * в логах или ответах API нет.
 */

function createTRONWallet() {
  const account =
    TronWeb.utils.accounts.generateAccount();

  if (
    !account ||
    !account.address
  ) {
    throw new Error(
      "Failed to generate TRON wallet."
    );
  }

  return {
    address:
      account.address.base58,

    hexAddress:
      account.address.hex,

    privateKey:
      account.privateKey
  };
}

/*
 * Создаём кошелёк и сразу
 * шифруем приватный ключ.
 */

function createEncryptedWallet() {
  const wallet =
    createTRONWallet();

  const encrypted =
    encryptPrivateKey(
      wallet.privateKey
    );

  return {
    address:
      wallet.address,

    encryptedPrivateKey:
      encrypted.encrypted,

    encryptionIv:
      encrypted.iv,

    encryptionAuthTag:
      encrypted.authTag
  };
}

module.exports = {
  createTRONWallet,
  createEncryptedWallet,
  encryptPrivateKey,
  decryptPrivateKey
};

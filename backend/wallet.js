const crypto = require("crypto");
const { TronWeb } = require("tronweb");

/*
 * WALLET_ENCRYPTION_KEY находится только в .env
 *
 * Требование:
 * 64 hex-символа = 32 байта
 */

function getEncryptionKey() {
  const key = process.env.WALLET_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY is not configured."
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters."
    );
  }

  return Buffer.from(key, "hex");
}

/*
 * Шифрование приватного ключа.
 *
 * AES-256-GCM
 */

function encryptPrivateKey(privateKey) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex")
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
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(
    Buffer.from(authTag, "hex")
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encrypted, "hex")
    ),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

/*
 * Создание нового TRON-аккаунта.
 *
 * TronWeb 6.x:
 * await TronWeb.createAccount()
 */

async function createTRONWallet() {
  const account = await TronWeb.createAccount();

  if (
    !account ||
    !account.address ||
    !account.address.base58 ||
    !account.privateKey
  ) {
    throw new Error(
      "Failed to generate TRON wallet."
    );
  }

  return {
    address: account.address.base58,

    hexAddress: account.address.hex,

    privateKey: account.privateKey
  };
}

/*
 * Создаём новый кошелёк
 * и сразу шифруем приватный ключ.
 */

async function createEncryptedWallet() {
  const wallet = await createTRONWallet();

  const encrypted = encryptPrivateKey(
    wallet.privateKey
  );

  return {
    address: wallet.address,

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

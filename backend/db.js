const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(
  __dirname,
  "data"
);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}

const dbPath = path.join(
  dataDir,
  "wallet.db"
);

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

/*
 * Пользователи
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL UNIQUE,

    email_verified INTEGER NOT NULL DEFAULT 0,

    tron_address TEXT,

    encrypted_private_key TEXT,

    encryption_iv TEXT,

    encryption_auth_tag TEXT,

    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL,

    code_hash TEXT NOT NULL,

    expires_at INTEGER NOT NULL,

    attempts INTEGER NOT NULL DEFAULT 0,

    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS
  idx_verification_email
  ON verification_codes(email);
`);

/*
 * Миграция для существующей базы.
 *
 * Если база уже была создана
 * старой версией проекта,
 * добавляем новые колонки.
 */

const columns =
  db.prepare(`
    PRAGMA table_info(users)
  `).all();

const columnNames =
  new Set(
    columns.map(
      column => column.name
    )
  );

const migrations = [
  [
    "tron_address",
    "TEXT"
  ],

  [
    "encrypted_private_key",
    "TEXT"
  ],

  [
    "encryption_iv",
    "TEXT"
  ],

  [
    "encryption_auth_tag",
    "TEXT"
  ]
];

for (
  const [name, type]
  of migrations
) {
  if (!columnNames.has(name)) {
    db.exec(`
      ALTER TABLE users
      ADD COLUMN ${name} ${type}
    `);
  }
}

/*
 * Получить пользователя
 * по email.
 */

function getUserByEmail(
  email
) {
  return db
    .prepare(`
      SELECT *
      FROM users
      WHERE email = ?
      LIMIT 1
    `)
    .get(email);
}

/*
 * Получить пользователя
 * по ID.
 */

function getUserById(id) {
  return db
    .prepare(`
      SELECT
        id,
        email,
        email_verified,
        tron_address,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `)
    .get(id);
}

/*
 * Создать пользователя.
 */

function createUser(
  email,
  wallet
) {
  const result =
    db.prepare(`
      INSERT INTO users (
        email,
        email_verified,
        tron_address,
        encrypted_private_key,
        encryption_iv,
        encryption_auth_tag,
        created_at
      )
      VALUES (?, 1, ?, ?, ?, ?, ?)
    `).run(
      email,

      wallet.address,

      wallet.encryptedPrivateKey,

      wallet.encryptionIv,

      wallet.encryptionAuthTag,

      Date.now()
    );

  return result.lastInsertRowid;
}

/*
 * Сохранить TRON-кошелёк
 * существующему пользователю.
 */

function saveUserWallet(
  userId,
  wallet
) {
  db.prepare(`
    UPDATE users

    SET
      tron_address = ?,
      encrypted_private_key = ?,
      encryption_iv = ?,
      encryption_auth_tag = ?

    WHERE id = ?
  `).run(
    wallet.address,

    wallet.encryptedPrivateKey,

    wallet.encryptionIv,

    wallet.encryptionAuthTag,

    userId
  );
}

/*
 * Подтвердить пользователя.
 */

function verifyExistingUser(
  email
) {
  db.prepare(`
    UPDATE users

    SET email_verified = 1

    WHERE email = ?
  `).run(email);
}

/*
 * Сохранить код подтверждения.
 */

function saveVerificationCode(
  email,
  codeHash,
  expiresAt
) {
  db.prepare(`
    DELETE FROM verification_codes

    WHERE email = ?
  `).run(email);

  db.prepare(`
    INSERT INTO verification_codes (
      email,
      code_hash,
      expires_at,
      attempts,
      created_at
    )
    VALUES (?, ?, ?, 0, ?)
  `).run(
    email,

    codeHash,

    expiresAt,

    Date.now()
  );
}

/*
 * Получить код.
 */

function getVerificationCode(
  email
) {
  return db
    .prepare(`
      SELECT *
      FROM verification_codes
      WHERE email = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(email);
}

/*
 * Увеличить количество
 * неправильных попыток.
 */

function incrementAttempts(
  id
) {
  db.prepare(`
    UPDATE verification_codes

    SET attempts = attempts + 1

    WHERE id = ?
  `).run(id);
}

/*
 * Удалить код.
 */

function deleteVerificationCode(
  id
) {
  db.prepare(`
    DELETE FROM verification_codes

    WHERE id = ?
  `).run(id);
}

module.exports = {
  getUserByEmail,

  getUserById,

  createUser,

  saveUserWallet,

  verifyExistingUser,

  saveVerificationCode,

  getVerificationCode,

  incrementAttempts,

  deleteVerificationCode
};

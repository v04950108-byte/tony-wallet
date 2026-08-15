const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Папка для базы данных
const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}

// Файл базы данных
const dbPath = path.join(
  dataDir,
  "wallet.db"
);

const db = new Database(dbPath);

// Оптимизация SQLite
db.pragma("journal_mode = WAL");

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL UNIQUE,

    email_verified INTEGER NOT NULL DEFAULT 0,

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
  Получить пользователя по email
*/

function getUserByEmail(email) {
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
  Получить пользователя по ID
*/

function getUserById(id) {
  return db
    .prepare(`
      SELECT
        id,
        email,
        email_verified,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `)
    .get(id);
}

/*
  Создать пользователя
*/

function createUser(email) {
  const result = db
    .prepare(`
      INSERT INTO users (
        email,
        email_verified,
        created_at
      )
      VALUES (?, 1, ?)
    `)
    .run(
      email,
      Date.now()
    );

  return result.lastInsertRowid;
}

/*
  Подтвердить существующего пользователя
*/

function verifyExistingUser(email) {
  db.prepare(`
    UPDATE users
    SET email_verified = 1
    WHERE email = ?
  `).run(email);
}

/*
  Сохранить новый код подтверждения
*/

function saveVerificationCode(
  email,
  codeHash,
  expiresAt
) {
  // Старые коды этого email удаляем
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
  Получить последний код
*/

function getVerificationCode(email) {
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
  Увеличить количество неправильных попыток
*/

function incrementAttempts(id) {
  db.prepare(`
    UPDATE verification_codes
    SET attempts = attempts + 1
    WHERE id = ?
  `).run(id);
}

/*
  Удалить использованный/старый код
*/

function deleteVerificationCode(id) {
  db.prepare(`
    DELETE FROM verification_codes
    WHERE id = ?
  `).run(id);
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  verifyExistingUser,
  saveVerificationCode,
  getVerificationCode,
  incrementAttempts,
  deleteVerificationCode
};

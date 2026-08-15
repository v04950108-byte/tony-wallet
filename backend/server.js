require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const {
  getUserByEmail,
  getUserById,
  createUser,
  saveUserWallet,
  verifyExistingUser,
  saveVerificationCode,
  getVerificationCode,
  incrementAttempts,
  deleteVerificationCode
} = require("./db");

const {
  sendVerificationCode,
  verifyMailer
} = require("./mailer");

const {
  createEncryptedWallet
} = require("./wallet");

const {
  getBalances,
  isValidAddress,
  TRON_NETWORK
} = require("./tron");

const app = express();

const PORT = Number(
  process.env.PORT || 3000
);

const SESSION_SECRET =
  process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is missing in .env"
  );
}

/* =========================
   Middleware
========================= */

app.use(
  express.json({
    limit: "10kb"
  })
);

app.use(cookieParser());

app.use(
  express.static(
    path.join(
      __dirname,
      "..",
      "frontend"
    )
  )
);

/* =========================
   Rate limits
========================= */

const requestCodeLimiter =
  rateLimit({
    windowMs:
      10 * 60 * 1000,

    limit: 3,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,

      message:
        "Слишком много запросов. Попробуйте позже."
    }
  });

const verifyCodeLimiter =
  rateLimit({
    windowMs:
      10 * 60 * 1000,

    limit: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,

      message:
        "Слишком много попыток."
    }
  });

/* =========================
   Helpers
========================= */

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function generateCode() {
  return crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();
}

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

/* =========================
   Session
========================= */

function createSessionToken(userId) {
  const payload =
    JSON.stringify({
      userId,
      createdAt: Date.now()
    });

  const payloadEncoded =
    Buffer
      .from(payload)
      .toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        SESSION_SECRET
      )
      .update(payloadEncoded)
      .digest("base64url");

  return (
    payloadEncoded +
    "." +
    signature
  );
}

function verifySessionToken(token) {
  try {
    if (!token) {
      return null;
    }

    const parts =
      token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [
      payloadEncoded,
      signature
    ] = parts;

    const expected =
      crypto
        .createHmac(
          "sha256",
          SESSION_SECRET
        )
        .update(payloadEncoded)
        .digest("base64url");

    const signatureBuffer =
      Buffer.from(signature);

    const expectedBuffer =
      Buffer.from(expected);

    if (
      signatureBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer
          .from(
            payloadEncoded,
            "base64url"
          )
          .toString("utf8")
      );

    const maxAge =
      30 *
      24 *
      60 *
      60 *
      1000;

    if (
      Date.now() -
        payload.createdAt >
      maxAge
    ) {
      return null;
    }

    return payload;

  } catch {
    return null;
  }
}

function setSessionCookie(
  res,
  userId
) {
  const token =
    createSessionToken(userId);

  res.cookie(
    "tony_session",
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      maxAge:
        30 *
        24 *
        60 *
        60 *
        1000,

      path: "/"
    }
  );
}

/* =========================
   Health
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      service:
        "TONY Wallet API",

      network:
        TRON_NETWORK,

      time:
        new Date().toISOString()
    });
  }
);

/* =========================
   Request verification code
========================= */

app.post(
  "/api/auth/request-code",
  requestCodeLimiter,
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );

      if (
        !isValidEmail(email)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Введите корректный email."
          });
      }

      const existingUser =
        getUserByEmail(email);

      if (
        existingUser &&
        existingUser.email_verified
      ) {
        return res.json({
          success: true,

          message:
            "Если этот email доступен для регистрации, код будет отправлен."
        });
      }

      const code =
        generateCode();

      const codeHash =
        hashCode(code);

      const expiresAt =
        Date.now() +
        10 *
        60 *
        1000;

      saveVerificationCode(
        email,
        codeHash,
        expiresAt
      );

      await sendVerificationCode(
        email,
        code
      );

      return res.json({
        success: true,

        message:
          "Код подтверждения отправлен."
      });

    } catch (error) {
      console.error(
        "REQUEST CODE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Не удалось отправить код."
        });
    }
  }
);

/* =========================
   Verify code
========================= */

app.post(
  "/api/auth/verify-code",
  verifyCodeLimiter,
  (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );

      const code =
        String(
          req.body.code || ""
        ).trim();

      if (
        !isValidEmail(email)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Некорректный email."
          });
      }

      if (
        !/^\d{6}$/.test(code)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Код должен содержать 6 цифр."
          });
      }

      const record =
        getVerificationCode(
          email
        );

      if (!record) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Код не найден. Запросите новый."
          });
      }

      if (
        Date.now() >
        record.expires_at
      ) {
        deleteVerificationCode(
          record.id
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              "Срок действия кода истёк."
          });
      }

      if (
        record.attempts >= 5
      ) {
        deleteVerificationCode(
          record.id
        );

        return res
          .status(429)
          .json({
            success: false,

            message:
              "Слишком много неправильных попыток."
          });
      }

      const incomingHash =
        hashCode(code);

      const incomingBuffer =
        Buffer.from(
          incomingHash
        );

      const storedBuffer =
        Buffer.from(
          record.code_hash
        );

      const valid =
        incomingBuffer.length ===
          storedBuffer.length &&
        crypto.timingSafeEqual(
          incomingBuffer,
          storedBuffer
        );

      if (!valid) {
        incrementAttempts(
          record.id
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              "Неверный код."
          });
      }

      /*
       * Код правильный.
       *
       * Теперь создаём TRON wallet.
       */

      let user =
        getUserByEmail(email);

      let userId;

      /*
       * Если пользователя ещё нет,
       * создаём новый кошелёк.
       */

      if (!user) {
        const wallet =
          createEncryptedWallet();

        userId =
          createUser(
            email,
            wallet
          );
      }

      /*
       * Если пользователь уже существует,
       * но кошелёк отсутствует,
       * создаём его.
       */

      else {
        userId = user.id;

        if (
          !user.tron_address ||
          !user.encrypted_private_key
        ) {
          const wallet =
            createEncryptedWallet();

          saveUserWallet(
            userId,
            wallet
          );
        }

        verifyExistingUser(
          email
        );
      }

      deleteVerificationCode(
        record.id
      );

      user =
        getUserById(userId);

      setSessionCookie(
        res,
        userId
      );

      return res.json({
        success: true,

        message:
          "Email подтверждён.",

        user: {
          id: user.id,

          email: user.email,

          tronAddress:
            user.tron_address,

          network:
            TRON_NETWORK
        }
      });

    } catch (error) {
      console.error(
        "VERIFY CODE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Ошибка подтверждения."
        });
    }
  }
);

/* =========================
   Current user
========================= */

app.get(
  "/api/auth/me",
  (req, res) => {
    const token =
      req.cookies.tony_session;

    const session =
      verifySessionToken(token);

    if (!session) {
      return res.json({
        success: true,

        authenticated: false
      });
    }

    const user =
      getUserById(
        session.userId
      );

    if (!user) {
      return res.json({
        success: true,

        authenticated: false
      });
    }

    return res.json({
      success: true,

      authenticated: true,

      user
    });
  }
);

/* =========================
   TRON wallet
========================= */

app.get(
  "/api/wallet",
  async (req, res) => {
    try {
      const token =
        req.cookies.tony_session;

      const session =
        verifySessionToken(token);

      if (!session) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Необходима авторизация."
          });
      }

      const user =
        getUserById(
          session.userId
        );

      if (!user) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Пользователь не найден."
          });
      }

      if (
        !user.tron_address
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "TRON-кошелёк не создан."
          });
      }

      const balances =
        await getBalances(
          user.tron_address
        );

      return res.json({
        success: true,

        network:
          TRON_NETWORK,

        address:
          user.tron_address,

        balances
      });

    } catch (error) {
      console.error(
        "WALLET ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Не удалось получить данные кошелька."
        });
    }
  }
);

/* =========================
   Validate address
========================= */

app.post(
  "/api/wallet/validate-address",
  (req, res) => {
    const address =
      String(
        req.body.address || ""
      ).trim();

    return res.json({
      success: true,

      valid:
        isValidAddress(address)
    });
  }
);

/* =========================
   Logout
========================= */

app.post(
  "/api/auth/logout",
  (req, res) => {
    res.clearCookie(
      "tony_session",
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/"
      }
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   Frontend
========================= */

app.get(
  "*splat",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "..",
        "frontend",
        "index.html"
      )
    );
  }
);

/* =========================
   Start
========================= */

app.listen(
  PORT,
  async () => {
    console.log(
      `TONY Wallet running on port ${PORT}`
    );

    console.log(
      `TRON network: ${TRON_NETWORK}`
    );

    try {
      await verifyMailer();

      console.log(
        "SMTP connection is ready."
      );

    } catch (error) {
      console.error(
        "SMTP ERROR:",
        error.message
      );

      console.log(
        "Server started, but email service is not configured."
      );
    }
  }
);

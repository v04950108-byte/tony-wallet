const nodemailer = require("nodemailer");

const SMTP_HOST =
  process.env.SMTP_HOST;

const SMTP_PORT =
  Number(process.env.SMTP_PORT || 465);

const SMTP_SECURE =
  String(
    process.env.SMTP_SECURE
  ).toLowerCase() === "true";

const SMTP_USER =
  process.env.SMTP_USER;

const SMTP_PASS =
  process.env.SMTP_PASS;

const SMTP_FROM =
  process.env.SMTP_FROM ||
  SMTP_USER;

let transporter = null;

function createTransporter() {
  if (
    !SMTP_HOST ||
    !SMTP_USER ||
    !SMTP_PASS
  ) {
    throw new Error(
      "SMTP settings are not configured in .env"
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,

    port: SMTP_PORT,

    secure: SMTP_SECURE,

    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },

    connectionTimeout: 10000,

    greetingTimeout: 10000,

    socketTimeout: 15000
  });
}

function getTransporter() {
  if (!transporter) {
    transporter =
      createTransporter();
  }

  return transporter;
}

async function verifyMailer() {
  const mailer =
    getTransporter();

  await mailer.verify();

  return true;
}

async function sendVerificationCode(
  email,
  code
) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error(
      "Invalid verification code."
    );
  }

  const mailer =
    getTransporter();

  await mailer.sendMail({
    from: SMTP_FROM,

    to: email,

    subject:
      "TONY Wallet — код подтверждения",

    text:
      `Ваш код подтверждения: ${code}\n\n` +
      `Код действителен 10 минут.\n\n` +
      `Если вы не регистрировались в TONY Wallet, просто проигнорируйте это письмо.`,

    html: `
      <!DOCTYPE html>
      <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport"
                content="width=device-width, initial-scale=1.0">
          <title>TONY Wallet</title>
        </head>

        <body style="
          margin:0;
          padding:0;
          background:#f4f6f8;
          font-family:Arial,sans-serif;
        ">

          <div style="
            max-width:520px;
            margin:40px auto;
            background:#ffffff;
            border-radius:16px;
            padding:32px;
            box-sizing:border-box;
          ">

            <h1 style="
              margin:0 0 20px;
              font-size:26px;
            ">
              TONY Wallet
            </h1>

            <p style="
              font-size:16px;
              line-height:1.5;
            ">
              Код подтверждения вашего email:
            </p>

            <div style="
              margin:25px 0;
              padding:20px;
              text-align:center;
              background:#f1f3f5;
              border-radius:12px;
              font-size:34px;
              font-weight:700;
              letter-spacing:8px;
            ">
              ${code}
            </div>

            <p style="
              color:#666;
              font-size:14px;
              line-height:1.5;
            ">
              Код действителен 10 минут.
            </p>

            <p style="
              color:#666;
              font-size:14px;
              line-height:1.5;
            ">
              Если вы не запрашивали этот код,
              проигнорируйте письмо.
            </p>

          </div>

        </body>
      </html>
    `
  });
}

module.exports = {
  sendVerificationCode,
  verifyMailer
};
